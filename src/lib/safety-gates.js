const crypto = require('crypto');
const { checkEnvironmentCommercialPolicy, resolveEnvironmentTier } = require('./provider-registry');

const tokenSpendingLedger = new Map();

function resetTokenSpendingLedger() {
  tokenSpendingLedger.clear();
}

/**
 * Issues a cryptographically signed spending token from a trusted boundary.
 *
 * @param {object} params
 * @param {string} [params.secret]
 * @param {string} [params.provider_id='*']
 * @param {string} [params.action_id='*']
 * @param {number} [params.max_budget_units=100]
 * @param {number} [params.ttl_seconds=3600]
 * @returns {object} Signed spending token
 */
function issueSpendingToken({ secret, provider_id = '*', action_id = '*', max_budget_units = 100, ttl_seconds = 3600 } = {}) {
  const tokenId = (crypto.randomUUID && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttl_seconds * 1000).toISOString();
  const effectiveSecret = secret || process.env.GEMSTACK_BOUNDARY_SECRET || 'gemstack-boundary-internal-signing-secret';

  const payload = [tokenId, provider_id, action_id, String(max_budget_units), expiresAt].join(':');
  const signature = crypto.createHmac('sha256', effectiveSecret).update(payload).digest('hex');

  return {
    token_id: tokenId,
    provider_id,
    action_id,
    max_budget_units: Number(max_budget_units),
    issued_at: issuedAt,
    expires_at: expiresAt,
    signature,
    spent_units: 0
  };
}

/**
 * Verifies a spending token signature and expiration.
 *
 * @param {object} token
 * @param {string} [secret]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifySpendingToken(token, secret) {
  if (!token || typeof token !== 'object') return { valid: false, reason: 'TOKEN_INVALID_FORMAT' };
  if (!token.token_id || !token.signature || !token.expires_at) return { valid: false, reason: 'TOKEN_INCOMPLETE' };

  const effectiveSecret = secret || process.env.GEMSTACK_BOUNDARY_SECRET || 'gemstack-boundary-internal-signing-secret';
  const payload = [token.token_id, token.provider_id || '*', token.action_id || '*', String(token.max_budget_units), token.expires_at].join(':');
  const expectedSig = crypto.createHmac('sha256', effectiveSecret).update(payload).digest('hex');

  const bufA = Buffer.from(token.signature);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, reason: 'TOKEN_SIGNATURE_INVALID' };
  }

  return { valid: true };
}

/**
 * Creates a normalized, structured gate decision object.
 *
 * @param {object} params
 * @param {boolean} params.authorized
 * @param {string} params.decision - 'ALLOW' | 'DENY'
 * @param {string} params.reasonCode
 * @param {string} params.message
 * @param {object} [params.context={}]
 * @returns {object} Structured gate decision
 */
function createGateDecision({ authorized, decision, reasonCode, message, context = {} }) {
  // Strip any accidental credential fields from context
  const cleanContext = {};
  for (const [k, v] of Object.entries(context)) {
    const lk = k.toLowerCase();
    if (!lk.includes('key') && !lk.includes('secret') && !lk.includes('token') && !lk.includes('pass')) {
      cleanContext[k] = v;
    }
  }

  return {
    authorized: Boolean(authorized),
    decision: decision || (authorized ? 'ALLOW' : 'DENY'),
    reasonCode,
    reason_code: reasonCode, // backward/spec compatibility
    message,
    context: cleanContext
  };
}

/**
 * ProviderCapabilityGate: Validates provider registration, environment allowance,
 * capability declaration, and adapter execution support.
 *
 * @param {object} request
 * @param {string} request.provider_id
 * @param {string} request.capability_id
 * @param {string} [request.environment]
 * @param {object} [request.adapter]
 * @param {object} registry - ProviderRegistry instance
 * @param {object} [options={}]
 * @returns {object} Structured gate decision
 */
function evaluateProviderCapability(request, registry, options = {}) {
  if (!request || typeof request !== 'object') {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'UNKNOWN_PROVIDER_IDENTITY',
      message: 'Capability evaluation request must be an object.',
      context: {}
    });
  }

  const providerId = (request.provider_id || '').toLowerCase().trim();
  const capabilityId = request.capability_id;
  const envTier = resolveEnvironmentTier({ environment: request.environment, ...options });

  // 1. Is Provider Registered?
  if (!providerId || !registry || !registry.hasProvider(providerId)) {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'UNKNOWN_PROVIDER_IDENTITY',
      message: 'Provider "' + (request.provider_id || '') + '" is not registered in provider registry.',
      context: { provider_id: request.provider_id, capability_id: capabilityId, environment: envTier }
    });
  }

  const provider = registry.getProvider(providerId);

  // 2. Is Provider Permitted in Active Environment?
  if (provider.type === 'COMMERCIAL') {
    const envPolicy = checkEnvironmentCommercialPolicy(envTier, options);
    if (!envPolicy.allowed) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: envPolicy.reasonCode,
        message: envPolicy.message,
        context: { provider_id: providerId, capability_id: capabilityId, environment: envTier }
      });
    }
  }

  // 3. Is Capability Declared for this Provider?
  if (!capabilityId || !registry.hasCapability(providerId, capabilityId)) {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'PROVIDER_CAPABILITY_UNDECLARED',
      message: 'Capability "' + (capabilityId || '') + '" is not declared for provider "' + providerId + '".',
      context: { provider_id: providerId, capability_id: capabilityId, environment: envTier }
    });
  }

  // 4. Does Adapter Support Capability?
  if (request.adapter) {
    const hasAdapterSupport = typeof request.adapter.supportsCapability === 'function'
      ? request.adapter.supportsCapability(capabilityId)
      : (Array.isArray(request.adapter.supportedCapabilities) && request.adapter.supportedCapabilities.includes(capabilityId));

    if (!hasAdapterSupport) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: 'PROVIDER_CAPABILITY_UNSUPPORTED',
        message: 'Adapter for provider "' + providerId + '" does not implement capability "' + capabilityId + '".',
        context: { provider_id: providerId, capability_id: capabilityId, environment: envTier }
      });
    }
  }

  // 5. Success
  return createGateDecision({
    authorized: true,
    decision: 'ALLOW',
    reasonCode: 'CAPABILITY_VERIFIED',
    message: 'Provider "' + providerId + '" capability "' + capabilityId + '" verified successfully.',
    context: { provider_id: providerId, capability_id: capabilityId, environment: envTier }
  });
}

/**
 * BillableActionGate: Evaluates spending authorization, cost state classification,
 * budget limits, and fail-closed commercial defaults.
 *
 * @param {object} request
 * @param {string} request.action_id
 * @param {string} request.provider_id
 * @param {string} request.capability_id
 * @param {string} [request.environment]
 * @param {number} [request.requested_units=1]
 * @param {object} [request.authorization_token]
 * @param {object} ledger - Loaded cost-ledger object or ProviderRegistry
 * @param {object} [options={}]
 * @param {string[]} [options.declaredActions] - Optional whitelist of declared actions in spec.md
 * @returns {object} Structured gate decision
 */
function evaluateBillableAction(request, ledger, options = {}) {
  if (!request || typeof request !== 'object') {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'UNDECLARED_BILLABLE_ACTION',
      message: 'Billable action request must be an object.',
      context: {}
    });
  }

  const actionId = request.action_id;
  const providerId = (request.provider_id || '').toLowerCase().trim();
  const capabilityId = request.capability_id;
  const envTier = resolveEnvironmentTier({ environment: request.environment, ...options });
  const requestedUnits = request.requested_units !== undefined ? request.requested_units : 1;

  if (typeof requestedUnits !== 'number' || !Number.isFinite(requestedUnits) || requestedUnits <= 0) {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'INVALID_REQUESTED_UNITS',
      message: 'Requested units must be a strictly positive finite number.',
      context: { action_id: actionId, provider_id: providerId, requested_units: requestedUnits }
    });
  }

  // 1. Action Declaration Check (Must be explicitly declared)
  if (!actionId || typeof actionId !== 'string' || !actionId.trim()) {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'UNDECLARED_BILLABLE_ACTION',
      message: 'Action ID is missing or invalid.',
      context: { action_id: actionId, provider_id: providerId, environment: envTier }
    });
  }

  if (options.declaredActions && Array.isArray(options.declaredActions)) {
    if (!options.declaredActions.includes(actionId)) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: 'UNDECLARED_BILLABLE_ACTION',
        message: 'Billable action "' + actionId + '" is not declared in specification or active plan.',
        context: { action_id: actionId, provider_id: providerId, environment: envTier }
      });
    }
  }

  // Resolve Provider & Capability from Ledger
  let providerEntry = null;
  let capabilityEntry = null;

  if (ledger && ledger.providers && ledger.providers[providerId]) {
    providerEntry = ledger.providers[providerId];
    if (providerEntry.capabilities && providerEntry.capabilities[capabilityId]) {
      capabilityEntry = providerEntry.capabilities[capabilityId];
    }
  }

  // 2. Cost State Resolution (Strict Fail-Closed)
  const costState = capabilityEntry ? capabilityEntry.cost_state : (request.cost_state || 'UNKNOWN');

  if (costState === 'UNKNOWN' || !['FREE', 'BILLABLE', 'POTENTIALLY_BILLABLE'].includes(costState)) {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'UNKNOWN_COST_CLASSIFICATION',
      message: 'Action "' + actionId + '" has UNKNOWN cost classification. Fail-closed: execution denied.',
      context: { action_id: actionId, provider_id: providerId, capability_id: capabilityId, cost_state: 'UNKNOWN', environment: envTier }
    });
  }

  // 3. Environment Check for Commercial / Billable
  const isCommercial = providerEntry ? providerEntry.type === 'COMMERCIAL' : (costState !== 'FREE');
  if (isCommercial) {
    const envPolicy = checkEnvironmentCommercialPolicy(envTier, options);
    if (!envPolicy.allowed) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: envPolicy.reasonCode,
        message: envPolicy.message,
        context: { action_id: actionId, provider_id: providerId, capability_id: capabilityId, cost_state: costState, environment: envTier }
      });
    }
  }

  // 4. FREE Actions (Permitted for Local / MOCK / Zero Cost)
  if (costState === 'FREE') {
    return createGateDecision({
      authorized: true,
      decision: 'ALLOW',
      reasonCode: 'ACTION_AUTHORIZED_FREE',
      message: 'Action "' + actionId + '" is FREE and authorized for execution.',
      context: { action_id: actionId, provider_id: providerId, capability_id: capabilityId, cost_state: 'FREE', environment: envTier }
    });
  }

  // 5. BILLABLE / POTENTIALLY_BILLABLE Actions -> Require Explicit Spending Token
  const token = request.authorization_token;
  if (!token || typeof token !== 'object') {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'BILLABLE_ACTION_UNAUTHORIZED',
      message: 'Action "' + actionId + '" on provider "' + providerId + '" requires explicit spending authorization.',
      context: { action_id: actionId, provider_id: providerId, capability_id: capabilityId, cost_state: costState, environment: envTier }
    });
  }

  const boundarySecret = options.boundarySecret || process.env.GEMSTACK_BOUNDARY_SECRET;

  if (boundarySecret) {
    const verified = verifySpendingToken(token, boundarySecret);
    if (!verified.valid) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: 'BILLABLE_ACTION_UNAUTHORIZED',
        message: 'Authorization token rejected by trusted boundary: ' + verified.reason,
        context: { action_id: actionId, provider_id: providerId, reason: verified.reason }
      });
    }
  } else if (token.signature && token.token_id) {
    const verified = verifySpendingToken(token);
    if (!verified.valid) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: 'BILLABLE_ACTION_UNAUTHORIZED',
        message: 'Authorization token signature invalid.',
        context: { action_id: actionId, provider_id: providerId }
      });
    }
  } else {
    // Legacy fallback only when no boundarySecret is active
    const isTokenValid = token && (token.granted === true || token.granted_by || token.source === 'CLI_FLAG' || token.max_budget_units !== undefined);
    if (!isTokenValid) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: 'BILLABLE_ACTION_UNAUTHORIZED',
        message: 'Action "' + actionId + '" on provider "' + providerId + '" requires explicit spending authorization.',
        context: { action_id: actionId, provider_id: providerId, capability_id: capabilityId, cost_state: costState, environment: envTier }
      });
    }
  }

  // Expiration check
  if (token.expires_at) {
    const expMs = Date.parse(token.expires_at);
    if (!Number.isNaN(expMs) && Date.now() > expMs) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: 'TOKEN_EXPIRED',
        message: 'Authorization token expired at ' + token.expires_at + '.',
        context: { action_id: actionId, provider_id: providerId, expires_at: token.expires_at }
      });
    }
  }

  // Scope check (Provider & Action)
  if (token.provider_id && token.provider_id !== '*' && token.provider_id.toLowerCase() !== providerId.toLowerCase()) {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'TOKEN_SCOPE_MISMATCH',
      message: 'Token scope provider "' + token.provider_id + '" does not match requested provider "' + providerId + '".',
      context: { action_id: actionId, provider_id: providerId, token_provider: token.provider_id }
    });
  }

  if (token.action_id && token.action_id !== '*' && token.action_id !== actionId) {
    return createGateDecision({
      authorized: false,
      decision: 'DENY',
      reasonCode: 'TOKEN_SCOPE_MISMATCH',
      message: 'Token scope action "' + token.action_id + '" does not match requested action "' + actionId + '".',
      context: { action_id: actionId, provider_id: providerId, token_action: token.action_id }
    });
  }

  // 6. Budget & Unit Threshold Check
  const estimatedUnitCost = (capabilityEntry && typeof capabilityEntry.estimated_unit_cost === 'number') ? capabilityEntry.estimated_unit_cost : 1;
  const estimatedTotalCost = requestedUnits * estimatedUnitCost;

  if (token && typeof token.max_budget_units === 'number') {
    const tokenId = token.token_id;
    const currentSpent = tokenId ? (tokenSpendingLedger.get(tokenId) || 0) : 0;
    const projectedTotal = currentSpent + estimatedTotalCost;

    if (projectedTotal > token.max_budget_units) {
      return createGateDecision({
        authorized: false,
        decision: 'DENY',
        reasonCode: 'BUDGET_THRESHOLD_EXCEEDED',
        message: 'Action "' + actionId + '" estimated cost (' + projectedTotal + ') exceeds authorized budget limit (' + token.max_budget_units + ').',
        context: {
          action_id: actionId,
          provider_id: providerId,
          capability_id: capabilityId,
          cost_state: costState,
          environment: envTier,
          estimated_total_cost: estimatedTotalCost,
          current_spent: currentSpent,
          projected_total: projectedTotal,
          max_budget_units: token.max_budget_units
        }
      });
    }

    if (tokenId) {
      tokenSpendingLedger.set(tokenId, projectedTotal);
    }
  }

  // 7. Full Authorization Pass
  return createGateDecision({
    authorized: true,
    decision: 'ALLOW',
    reasonCode: 'ACTION_AUTHORIZED',
    message: 'Action "' + actionId + '" authorized for execution within budget.',
    context: { action_id: actionId, provider_id: providerId, capability_id: capabilityId, cost_state: costState, environment: envTier, estimated_total_cost: estimatedTotalCost }
  });
}

module.exports = {
  createGateDecision,
  evaluateProviderCapability,
  evaluateBillableAction,
  issueSpendingToken,
  verifySpendingToken,
  resetTokenSpendingLedger
};
