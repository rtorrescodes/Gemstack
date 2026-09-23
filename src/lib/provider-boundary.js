const crypto = require('node:crypto');
const { PROVIDER_ID_REGEX } = require('./provider-registry');
const { evaluateProviderCapability, evaluateBillableAction } = require('./safety-gates');

/**
 * Normalizes provider identity and prevents alias spoofing or path traversal.
 *
 * @param {string} rawId
 * @returns {string} Normalized provider slug
 */
function normalizeProviderId(rawId) {
  if (typeof rawId !== 'string') {
    throw new Error('Provider ID must be a string.');
  }

  const trimmed = rawId.trim().toLowerCase();
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error('Provider ID contains illegal path characters: "' + rawId + '"');
  }

  if (!PROVIDER_ID_REGEX.test(trimmed)) {
    throw new Error('Provider ID does not match canonical slug format: "' + rawId + '"');
  }

  return trimmed;
}

/**
 * Creates a cryptographically bound execution token.
 *
 * @param {string} providerId
 * @param {string} capabilityId
 * @param {string} actionId
 * @param {object} [tokenPayload={}]
 * @returns {string} SHA-256 bound token
 */
function createBoundToken(providerId, capabilityId, actionId, tokenPayload = {}, secret = null) {
  const payload = JSON.stringify({
    providerId,
    capabilityId,
    actionId,
    token: tokenPayload
  });
  const effectiveSecret = secret || process.env.GEMSTACK_BOUNDARY_SECRET;
  if (effectiveSecret) {
    return crypto.createHmac('sha256', effectiveSecret).update(payload, 'utf8').digest('hex');
  }
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Executes an action through the mandatory provider execution boundary.
 *
 * @param {object} actionRequest
 * @param {object} adapter
 * @param {object} options
 * @param {object} options.registry - ProviderRegistry
 * @param {object} options.ledger - Cost ledger
 * @returns {Promise<object>|object} Execution result
 */
function executeProviderAction(actionRequest, adapter, options = {}) {
  if (!actionRequest || typeof actionRequest !== 'object') {
    const err = new Error('Action request must be an object.');
    err.reasonCode = 'UNDECLARED_BILLABLE_ACTION';
    throw err;
  }

  // 1. Normalize Provider Identity (Bypass & Alias Protection)
  let normalizedProviderId;
  try {
    normalizedProviderId = normalizeProviderId(actionRequest.provider_id);
  } catch (aliasErr) {
    const err = new Error('Provider alias or ID rejected: ' + aliasErr.message);
    err.reasonCode = 'UNKNOWN_PROVIDER_IDENTITY';
    throw err;
  }

  const req = {
    ...actionRequest,
    provider_id: normalizedProviderId
  };

  // 2. Gate 1: ProviderCapabilityGate
  const capDecision = evaluateProviderCapability(req, options.registry, {
    ...options,
    adapter
  });

  if (!capDecision.authorized) {
    const err = new Error('Provider capability denied: ' + capDecision.message);
    err.reasonCode = capDecision.reasonCode;
    err.decision = capDecision;
    throw err;
  }

  // 3. Gate 2: BillableActionGate
  const billDecision = evaluateBillableAction(req, options.ledger, options);

  if (!billDecision.authorized) {
    const err = new Error('Billable action denied: ' + billDecision.message);
    err.reasonCode = billDecision.reasonCode;
    err.decision = billDecision;
    throw err;
  }

  // 4. Bound Context Token
  const boundToken = createBoundToken(
    normalizedProviderId,
    req.capability_id,
    req.action_id,
    req.authorization_token
  );

  const executionContext = {
    provider_id: normalizedProviderId,
    capability_id: req.capability_id,
    action_id: req.action_id,
    boundToken,
    authorized: true
  };

  if (!adapter || typeof adapter.execute !== 'function') {
    const err = new Error('Adapter missing execute() method.');
    err.reasonCode = 'PROVIDER_CAPABILITY_UNSUPPORTED';
    throw err;
  }

  return adapter.execute(req, executionContext);
}

/**
 * Executes an action with re-entrant fallback chains.
 * Re-evaluates all gates independently for each candidate; authorization is NEVER inherited.
 *
 * @param {object} primaryCandidate - { request, adapter }
 * @param {Array<object>} fallbackCandidates - Array of { request, adapter }
 * @param {object} options
 * @returns {object} Execution result
 */
function executeWithFallback(primaryCandidate, fallbackCandidates = [], options = {}) {
  try {
    const result = executeProviderAction(primaryCandidate.request, primaryCandidate.adapter, options);
    return {
      success: true,
      provider_id: primaryCandidate.request.provider_id,
      result,
      fallbackUsed: false
    };
  } catch (primaryErr) {
    // Primary failed (network error, rate limit, denial, etc.)
    // Iterate fallback candidates
    for (let i = 0; i < fallbackCandidates.length; i++) {
      const fb = fallbackCandidates[i];

      // Re-enter gates independently!
      // Invariant: fallback provider != inherited authorization
      // If fallback candidate request does not satisfy spending gates independently -> emit PROVIDER_FALLBACK_UNAUTHORIZED
      try {
        const fbResult = executeProviderAction(fb.request, fb.adapter, options);
        return {
          success: true,
          provider_id: fb.request.provider_id,
          result: fbResult,
          fallbackUsed: true,
          fallbackIndex: i
        };
      } catch (fbErr) {
        if (fbErr.reasonCode === 'BILLABLE_ACTION_UNAUTHORIZED' || fbErr.reasonCode === 'ENV_COMMERCIAL_DENIED') {
          const fallbackErr = new Error('Fallback provider "' + (fb.request ? fb.request.provider_id : 'unknown') + '" failed authorization: ' + fbErr.message);
          fallbackErr.reasonCode = 'PROVIDER_FALLBACK_UNAUTHORIZED';
          fallbackErr.originalReason = fbErr.reasonCode;
          throw fallbackErr;
        }
        // If it was an execution error (not authorization), continue to next fallback if available
        if (i === fallbackCandidates.length - 1) {
          throw fbErr;
        }
      }
    }

    throw primaryErr;
  }
}

module.exports = {
  normalizeProviderId,
  createBoundToken,
  executeProviderAction,
  executeWithFallback
};
