const fs = require('node:fs');
const path = require('node:path');
const { createFinding } = require('./findings');

const VALID_COST_STATES = ['FREE', 'BILLABLE', 'POTENTIALLY_BILLABLE', 'UNKNOWN'];
const VALID_PROVIDER_TYPES = ['COMMERCIAL', 'LOCAL', 'MOCK'];

const FORBIDDEN_KEY_NAMES = new Set([
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'bearertoken',
  'bearer_token',
  'secret',
  'clientsecret',
  'client_secret',
  'authorization',
  'private_key',
  'privatekey',
  'passwd',
  'password',
  'credentials'
]);

const SECRET_VALUE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{16,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /Bearer\s+[a-zA-Z0-9._-]{16,}/i,
  /AIza[0-9A-Za-z-_]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

/**
 * Scans an arbitrary JSON-compatible data structure for forbidden credential keys and secret patterns.
 *
 * @param {*} data
 * @param {string} [currentPath='']
 * @returns {{ valid: boolean, violations: Array<{ path: string, reason: string }> }}
 */
function auditSecretsForbidden(data, currentPath = '') {
  const violations = [];

  function walk(node, p) {
    if (!node || typeof node !== 'object') {
      if (typeof node === 'string') {
        for (const pattern of SECRET_VALUE_PATTERNS) {
          if (pattern.test(node)) {
            violations.push({
              path: p,
              reason: 'Forbidden secret pattern detected matching ' + pattern.toString()
            });
            break;
          }
        }
      }
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], p + '[' + i + ']');
      }
      return;
    }

    for (const key of Object.keys(node)) {
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
      const rawNormalized = key.toLowerCase();
      const childPath = p ? p + '.' + key : key;

      if (FORBIDDEN_KEY_NAMES.has(rawNormalized) || FORBIDDEN_KEY_NAMES.has(normalizedKey)) {
        violations.push({
          path: childPath,
          reason: 'Forbidden credential property name detected: "' + key + '"'
        });
      }

      walk(node[key], childPath);
    }
  }

  walk(data, currentPath);

  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Validates the structure and constraints of a cost-ledger data object.
 *
 * @param {*} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLedgerSchema(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Cost ledger root must be a JSON object'] };
  }

  if (data.version !== 1) {
    errors.push('Cost ledger version must be 1, got ' + JSON.stringify(data.version));
  }

  if (typeof data.currency !== 'string' || !data.currency.trim()) {
    errors.push('Cost ledger requires non-empty string field "currency"');
  }

  if (!data.providers || typeof data.providers !== 'object' || Array.isArray(data.providers)) {
    errors.push('Cost ledger requires "providers" map');
    return { valid: false, errors };
  }

  const providerKeys = Object.keys(data.providers);
  for (const providerId of providerKeys) {
    const provider = data.providers[providerId];
    if (!provider || typeof provider !== 'object' || Array.isArray(provider)) {
      errors.push('Provider "' + providerId + '" must be an object');
      continue;
    }

    if (!VALID_PROVIDER_TYPES.includes(provider.type)) {
      errors.push('Provider "' + providerId + '" has invalid type "' + provider.type + '". Must be one of: ' + VALID_PROVIDER_TYPES.join(', '));
    }

    if (typeof provider.pricing_model !== 'string' || !provider.pricing_model.trim()) {
      errors.push('Provider "' + providerId + '" requires string field "pricing_model"');
    }

    if (!provider.capabilities || typeof provider.capabilities !== 'object' || Array.isArray(provider.capabilities)) {
      errors.push('Provider "' + providerId + '" requires "capabilities" map');
      continue;
    }

    for (const capId of Object.keys(provider.capabilities)) {
      const cap = provider.capabilities[capId];
      if (!cap || typeof cap !== 'object' || Array.isArray(cap)) {
        errors.push('Provider "' + providerId + '" capability "' + capId + '" must be an object');
        continue;
      }

      if (!VALID_COST_STATES.includes(cap.cost_state)) {
        errors.push('Capability "' + providerId + '.' + capId + '" has invalid cost_state "' + cap.cost_state + '". Must be one of: ' + VALID_COST_STATES.join(', '));
      }

      if (typeof cap.estimated_unit_cost !== 'number' || Number.isNaN(cap.estimated_unit_cost) || cap.estimated_unit_cost < 0) {
        errors.push('Capability "' + providerId + '.' + capId + '" requires non-negative number "estimated_unit_cost"');
      }

      if (cap.freshness_date !== undefined) {
        const parsedDate = Date.parse(cap.freshness_date);
        if (Number.isNaN(parsedDate)) {
          errors.push('Capability "' + providerId + '.' + capId + '" has invalid freshness_date: "' + cap.freshness_date + '"');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Checks if a capability entry freshness date is older than maxAgeDays.
 *
 * @param {object} capabilityEntry
 * @param {number} [maxAgeDays=90]
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ isStale: boolean, ageDays: number|null, message: string|null }}
 */
function checkStaleness(capabilityEntry, maxAgeDays = 90, referenceDate = new Date()) {
  if (!capabilityEntry || !capabilityEntry.freshness_date) {
    return {
      isStale: true,
      ageDays: null,
      message: 'Capability entry missing required freshness_date'
    };
  }

  const freshnessTime = Date.parse(capabilityEntry.freshness_date);
  if (Number.isNaN(freshnessTime)) {
    return {
      isStale: true,
      ageDays: null,
      message: 'Invalid freshness_date: "' + capabilityEntry.freshness_date + '"'
    };
  }

  const refTime = referenceDate.getTime();
  const diffMs = refTime - freshnessTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > maxAgeDays) {
    return {
      isStale: true,
      ageDays: diffDays,
      message: 'Pricing assumption freshness date "' + capabilityEntry.freshness_date + '" is ' + diffDays + ' days old (exceeds ' + maxAgeDays + ' days limit)'
    };
  }

  return {
    isStale: false,
    ageDays: diffDays,
    message: null
  };
}

/**
 * Serializes cost ledger object with UTF-16 code-unit sorted keys deterministically.
 *
 * @param {object} ledger
 * @returns {string} Formatted JSON string
 */
function serializeCostLedger(ledger) {
  function sortKeys(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const sorted = {};
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
    for (const k of keys) {
      sorted[k] = sortKeys(obj[k]);
    }
    return sorted;
  }

  return JSON.stringify(sortKeys(ledger), null, 2) + '\n';
}

/**
 * Loads, parses, and validates cost-ledger.json from disk.
 *
 * @param {string} filePath
 * @param {object} [options={}]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {number} [options.maxAgeDays=90]
 * @returns {{ ledger: object|null, findings: object[], valid: boolean }}
 */
function loadCostLedger(filePath, options = {}) {
  const { referenceDate = new Date(), maxAgeDays = 90 } = options;
  const findings = [];

  if (!fs.existsSync(filePath)) {
    findings.push(createFinding({
      code: 'COST_LEDGER_INVALID',
      contractId: 'upgrade-c-cost-states',
      phase: 'IMPLEMENTATION',
      location: filePath,
      details: 'Cost ledger file not found at: ' + filePath
    }));
    return { ledger: null, findings, valid: false };
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    findings.push(createFinding({
      code: 'COST_LEDGER_INVALID',
      contractId: 'upgrade-c-cost-states',
      phase: 'IMPLEMENTATION',
      location: filePath,
      details: 'Failed to read cost ledger: ' + err.message
    }));
    return { ledger: null, findings, valid: false };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    findings.push(createFinding({
      code: 'COST_LEDGER_INVALID',
      contractId: 'upgrade-c-cost-states',
      phase: 'IMPLEMENTATION',
      location: filePath,
      details: 'Cost ledger malformed JSON syntax: ' + err.message
    }));
    return { ledger: null, findings, valid: false };
  }

  // 1. Audit Secrets (Strict Fail-Closed)
  const secretsAudit = auditSecretsForbidden(data);
  if (!secretsAudit.valid) {
    for (const v of secretsAudit.violations) {
      findings.push(createFinding({
        code: 'COST_LEDGER_INVALID',
        contractId: 'secrets-forbidden-in-safety-artifacts',
        phase: 'IMPLEMENTATION',
        location: filePath,
        details: 'Secret violation at ' + v.path + ': ' + v.reason
      }));
    }
    return { ledger: null, findings, valid: false };
  }

  // 2. Validate Schema
  const schemaAudit = validateLedgerSchema(data);
  if (!schemaAudit.valid) {
    for (const err of schemaAudit.errors) {
      findings.push(createFinding({
        code: 'COST_LEDGER_INVALID',
        contractId: 'upgrade-c-cost-states',
        phase: 'IMPLEMENTATION',
        location: filePath,
        details: err
      }));
    }
    return { ledger: null, findings, valid: false };
  }

  // 3. Staleness Evaluation (Warnings)
  if (data.providers) {
    for (const [providerId, provider] of Object.entries(data.providers)) {
      if (provider.capabilities) {
        for (const [capId, cap] of Object.entries(provider.capabilities)) {
          const staleness = checkStaleness(cap, maxAgeDays, referenceDate);
          if (staleness.isStale) {
            const finding = createFinding({
              code: 'STALE_PROVIDER_COST_ASSUMPTION',
              contractId: 'upgrade-c-cost-states',
              phase: 'IMPLEMENTATION',
              location: filePath,
              details: '[' + providerId + '.' + capId + '] ' + staleness.message
            });
            finding.is_blocking = false; // WARNING severity
            findings.push(finding);
          }
        }
      }
    }
  }

  const hasBlockers = findings.some(f => f.is_blocking);
  return {
    ledger: hasBlockers ? null : data,
    findings,
    valid: !hasBlockers
  };
}

module.exports = {
  VALID_COST_STATES,
  VALID_PROVIDER_TYPES,
  FORBIDDEN_KEY_NAMES,
  auditSecretsForbidden,
  validateLedgerSchema,
  checkStaleness,
  serializeCostLedger,
  loadCostLedger
};
