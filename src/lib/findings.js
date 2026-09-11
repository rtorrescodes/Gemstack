const crypto = require('node:crypto');
const { normalizePath } = require('./hasher');

/**
 * Computes canonical 64-character lowercase hexadecimal SHA-256 fingerprint for a finding.
 *
 * @param {object} params
 * @param {string} params.code - Finding error code
 * @param {string|null} params.contractId - Optional contract id
 * @param {string} params.phase - Phase where violation was found
 * @param {string} params.location - File path of the violation
 * @returns {string} 64-char lowercase hex SHA-256
 */
function computeFindingFingerprint({ code, contractId, phase, location }) {
  const normLocation = normalizePath(location);
  const payload = JSON.stringify({
    code: code || 'UNKNOWN_ERROR',
    contractId: contractId ?? null,
    phase: phase || 'unknown',
    location: normLocation || null
  });

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Formats a cosmetic display string for a fingerprint (12-char prefix).
 * Never used for internal storage, indexing or anti-loop logic.
 *
 * @param {string} fingerprint
 * @returns {string} 12-char display token
 */
function formatDisplayFingerprint(fingerprint) {
  if (typeof fingerprint !== 'string') return '';
  return fingerprint.slice(0, 12);
}

/**
 * Creates a structured Finding object.
 *
 * @param {object} params
 * @returns {object} Finding
 */
function createFinding({ code, contractId, phase, location, delta = null, details = null }) {
  const fp = computeFindingFingerprint({ code, contractId, phase, location });
  return {
    fingerprint: fp,
    display_id: formatDisplayFingerprint(fp),
    code,
    contractId: contractId ?? null,
    phase,
    location: normalizePath(location),
    delta,
    details,
    status: 'OPEN',
    is_blocking: true,
    detected_at: new Date().toISOString(),
    resolved_at: null
  };
}

/**
 * Computes the full frozen contextHash for an accepted exception.
 * Context identity = SHA-256(upstreamAcceptedPhaseHash + currentComparedPhaseHash + normalizedContractRepresentation).
 *
 * @param {object} params
 * @param {string} params.upstreamAcceptedPhaseHash
 * @param {string} params.currentComparedPhaseHash
 * @param {string} params.normalizedContractRepresentation - Deterministically serialized contract JSON
 * @returns {string} 64-character lowercase hex SHA-256
 */
function computeContextHash({ upstreamAcceptedPhaseHash, currentComparedPhaseHash, normalizedContractRepresentation }) {
  const payload = JSON.stringify({
    upstreamAcceptedPhaseHash: upstreamAcceptedPhaseHash || '',
    currentComparedPhaseHash: currentComparedPhaseHash || '',
    normalizedContractRepresentation: normalizedContractRepresentation || ''
  });

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Reconciles findings between successive checks (Anti-Loop mechanism):
 * - If an existing finding is no longer in current violations -> status becomes 'RESOLVED'.
 * - If a finding was 'RESOLVED' but the violation recurs -> status reopens to 'OPEN'.
 * - New violations are added as 'OPEN'.
 *
 * @param {Array<object>} existingFindings
 * @param {Array<object>} currentViolations
 * @returns {Array<object>} Reconciled findings
 */
function reconcileFindings(existingFindings = [], currentViolations = []) {
  const reconciled = [];
  const currentViolationFps = new Map();

  for (const v of currentViolations) {
    const fp = computeFindingFingerprint({
      code: v.code,
      contractId: v.contractId,
      phase: v.phase,
      location: v.location
    });
    currentViolationFps.set(fp, v);
  }

  // Process existing findings
  for (const f of existingFindings) {
    if (currentViolationFps.has(f.fingerprint)) {
      const v = currentViolationFps.get(f.fingerprint);
      currentViolationFps.delete(f.fingerprint); // Handled

      // If it was RESOLVED, reopen it (anti-loop protection)
      if (f.status === 'RESOLVED') {
        reconciled.push({
          ...f,
          status: 'OPEN',
          is_blocking: true,
          delta: v.delta,
          detected_at: new Date().toISOString(),
          resolved_at: null
        });
      } else {
        reconciled.push({
          ...f,
          delta: v.delta,
          is_blocking: f.status !== 'ACCEPTED_EXCEPTION'
        });
      }
    } else {
      // Violation not present in current analysis -> mark RESOLVED if it was OPEN
      if (f.status === 'OPEN') {
        reconciled.push({
          ...f,
          status: 'RESOLVED',
          is_blocking: false,
          resolved_at: new Date().toISOString()
        });
      } else {
        reconciled.push(f);
      }
    }
  }

  // Any remaining current violations are new
  for (const [fp, v] of currentViolationFps.entries()) {
    reconciled.push(createFinding(v));
  }

  return reconciled;
}

/**
 * Evaluates accepted exceptions against current findings.
 * If an exception matches the finding fingerprint AND has an identical full contextHash,
 * it suppresses the blocker (is_blocking: false, status: 'ACCEPTED_EXCEPTION').
 * If contextHash differs, the exception does NOT suppress and finding remains OPEN / blocking.
 *
 * @param {Array<object>} findings
 * @param {Array<object>} acceptedExceptions
 * @param {object} currentContext - { upstreamAcceptedPhaseHash, currentComparedPhaseHash, normalizedContractRepresentation }
 * @returns {Array<object>} Evaluated findings
 */
function evaluateAcceptedExceptions(findings = [], acceptedExceptions = [], currentContext = {}) {
  const currentContextHash = computeContextHash(currentContext);

  const exceptionMap = new Map();
  for (const ex of acceptedExceptions) {
    if (ex && ex.fingerprint) {
      exceptionMap.set(ex.fingerprint, ex);
    }
  }

  return findings.map(f => {
    if (exceptionMap.has(f.fingerprint)) {
      const ex = exceptionMap.get(f.fingerprint);
      if (ex.contextHash === currentContextHash) {
        return {
          ...f,
          status: 'ACCEPTED_EXCEPTION',
          is_blocking: false,
          exceptionReason: ex.reason || 'Approved exception'
        };
      } else {
        // Context mutated -> exception invalidated
        return {
          ...f,
          status: 'OPEN',
          is_blocking: true,
          exceptionInvalidated: true
        };
      }
    }
    return f;
  });
}

/**
 * Marks findings as SUPERSEDED if associated contracts were formally amended or removed.
 *
 * @param {Array<object>} findings
 * @param {Array<string>} activeContractIds
 * @returns {Array<object>}
 */
function markSupersededFindings(findings = [], activeContractIds = []) {
  const activeSet = new Set(activeContractIds);
  return findings.map(f => {
    if (f.contractId && !activeSet.has(f.contractId)) {
      return {
        ...f,
        status: 'SUPERSEDED',
        is_blocking: false,
        superseded_at: new Date().toISOString()
      };
    }
    return f;
  });
}

module.exports = {
  computeFindingFingerprint,
  formatDisplayFingerprint,
  createFinding,
  computeContextHash,
  reconcileFindings,
  evaluateAcceptedExceptions,
  markSupersededFindings
};
