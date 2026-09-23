const fs = require('node:fs');
const path = require('node:path');
const { createFinding } = require('./findings');

const VALID_ENV_TIERS = ['test', 'ci', 'development', 'staging', 'production'];
const PROVIDER_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const REMOTE_URL_PATTERN = /^https?:\/\//i;

/**
 * Resolves the deterministic environment tier.
 *
 * @param {object} [options={}]
 * @param {string} [options.environment]
 * @param {object} [options.env=process.env]
 * @returns {string} One of: 'test', 'ci', 'development', 'staging', 'production'
 */
function resolveEnvironmentTier(options = {}) {
  const env = options.env || process.env;

  const rawEnv = (options.environment || '').toLowerCase().trim();
  if (rawEnv && VALID_ENV_TIERS.includes(rawEnv)) {
    return rawEnv;
  }

  const rawGemstackEnv = (env.GEMSTACK_ENV || '').toLowerCase().trim();
  if (rawGemstackEnv && VALID_ENV_TIERS.includes(rawGemstackEnv)) {
    return rawGemstackEnv;
  }

  // Detect CI first
  if (env.CI === 'true' || env.CI === '1' || env.CONTINUOUS_INTEGRATION === 'true') {
    return 'ci';
  }

  // Detect test runner
  if (env.NODE_ENV === 'test' || typeof global.it === 'function' || typeof global.test === 'function' || process.argv.includes('--test')) {
    return 'test';
  }

  return 'development';
}

/**
 * Validates whether commercial providers are permitted in a given environment tier.
 *
 * @param {string} envTier
 * @param {object} [options={}]
 * @param {boolean} [options.allowBillable=false]
 * @param {object} [options.ciWaiver=null]
 * @returns {{ allowed: boolean, reasonCode: string, message: string }}
 */
function checkEnvironmentCommercialPolicy(envTier, options = {}) {
  if (envTier === 'test') {
    return {
      allowed: false,
      reasonCode: 'ENV_COMMERCIAL_DENIED',
      message: 'Commercial provider invocation is strictly denied in test environment.'
    };
  }

  if (envTier === 'ci') {
    if (options.ciWaiver && options.ciWaiver.signed === true && options.ciWaiver.expires_at > Date.now()) {
      return {
        allowed: true,
        reasonCode: 'CI_WAIVER_ACCEPTED',
        message: 'Commercial invocation permitted in CI via explicit signed waiver.'
      };
    }
    return {
      allowed: false,
      reasonCode: 'ENV_COMMERCIAL_DENIED',
      message: 'Commercial provider invocation is denied in CI environment without explicit signed waiver.'
    };
  }

  if (envTier === 'development') {
    if (!options.allowBillable) {
      return {
        allowed: false,
        reasonCode: 'BILLABLE_ACTION_UNAUTHORIZED',
        message: 'Commercial provider actions in development require explicit authorization (--allow-billable).'
      };
    }
    return {
      allowed: true,
      reasonCode: 'DEV_AUTHORIZED',
      message: 'Commercial execution authorized for development session.'
    };
  }

  // staging / production
  return {
    allowed: true,
    reasonCode: 'PRODUCTION_ALLOWED',
    message: 'Commercial execution permitted under managed environment.'
  };
}

/**
 * Validates integrity of a MOCK provider configuration to prevent network escape.
 *
 * @param {object} providerConfig
 * @returns {{ valid: boolean, reasonCode: string|null, message: string|null }}
 */
function validateMockIntegrity(providerConfig) {
  if (!providerConfig || typeof providerConfig !== 'object') {
    return {
      valid: false,
      reasonCode: 'MOCK_PROVIDER_ESCAPE_VIOLATION',
      message: 'Mock provider configuration must be a valid object.'
    };
  }

  if (providerConfig.type !== 'MOCK') {
    return {
      valid: false,
      reasonCode: 'MOCK_PROVIDER_ESCAPE_VIOLATION',
      message: 'Provider is not declared with type "MOCK".'
    };
  }

  // Scan for remote endpoints, urls, or external host configurations
  const forbiddenFields = ['url', 'endpoint', 'baseUrl', 'base_url', 'host', 'remoteUrl', 'remote_url'];
  for (const field of forbiddenFields) {
    if (typeof providerConfig[field] === 'string' && providerConfig[field].trim()) {
      const val = providerConfig[field].trim();
      if (REMOTE_URL_PATTERN.test(val) || val.includes('://') || (!val.includes('localhost') && !val.includes('127.0.0.1') && val.includes('.'))) {
        return {
          valid: false,
          reasonCode: 'MOCK_PROVIDER_ESCAPE_VIOLATION',
          message: 'Mock provider declared forbidden remote endpoint at field "' + field + '": ' + val
        };
      }
    }
  }

  // Scan nested capabilities for remote endpoint overrides
  if (providerConfig.capabilities && typeof providerConfig.capabilities === 'object') {
    for (const [capId, cap] of Object.entries(providerConfig.capabilities)) {
      if (cap && typeof cap === 'object') {
        for (const field of forbiddenFields) {
          if (typeof cap[field] === 'string' && cap[field].trim()) {
            return {
              valid: false,
              reasonCode: 'MOCK_PROVIDER_ESCAPE_VIOLATION',
              message: 'Mock capability "' + capId + '" declared forbidden remote endpoint at "' + field + '".'
            };
          }
        }
      }
    }
  }

  return {
    valid: true,
    reasonCode: null,
    message: null
  };
}

/**
 * Creates an in-memory ProviderRegistry instance.
 *
 * @param {object} providersMap
 * @returns {object} ProviderRegistry
 */
function createProviderRegistry(providersMap = {}) {
  const normalizedProviders = new Map();

  for (const [rawId, config] of Object.entries(providersMap)) {
    const id = rawId.toLowerCase().trim();
    if (!PROVIDER_ID_REGEX.test(id)) {
      throw new Error('Invalid provider ID format: "' + rawId + '". Must match slug pattern: ' + PROVIDER_ID_REGEX.toString());
    }

    const type = (config.type || 'COMMERCIAL').toUpperCase();
    const capabilities = new Map();

    if (config.capabilities) {
      if (Array.isArray(config.capabilities)) {
        for (const cap of config.capabilities) {
          capabilities.set(cap, { id: cap });
        }
      } else if (typeof config.capabilities === 'object') {
        for (const [capId, capVal] of Object.entries(config.capabilities)) {
          capabilities.set(capId, capVal);
        }
      }
    }

    normalizedProviders.set(id, {
      ...config,
      id,
      type,
      capabilities
    });
  }

  return {
    hasProvider(providerId) {
      if (typeof providerId !== 'string') return false;
      return normalizedProviders.has(providerId.toLowerCase().trim());
    },

    getProvider(providerId) {
      if (typeof providerId !== 'string') return null;
      return normalizedProviders.get(providerId.toLowerCase().trim()) || null;
    },

    hasCapability(providerId, capabilityId) {
      const p = this.getProvider(providerId);
      if (!p) return false;
      return p.capabilities.has(capabilityId);
    },

    getCapability(providerId, capabilityId) {
      const p = this.getProvider(providerId);
      if (!p) return null;
      return p.capabilities.get(capabilityId) || null;
    },

    listProviders() {
      return Array.from(normalizedProviders.values());
    }
  };
}

/**
 * Loads provider registry from repository artifacts or ledger.
 *
 * @param {string} rootPath
 * @param {string} [featureDir='']
 * @returns {object} ProviderRegistry
 */
function loadProviderRegistry(rootPath, featureDir = '') {
  const candidatePaths = [
    path.join(rootPath, featureDir, 'cost-ledger.json'),
    path.join(rootPath, 'cost-ledger.json'),
    path.join(rootPath, '.gemstack/cost-ledger.json'),
    path.join(rootPath, '.gemstack/providers.json')
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (raw.providers && typeof raw.providers === 'object') {
          return createProviderRegistry(raw.providers);
        }
      } catch (e) {
        // Fall through to next candidate
      }
    }
  }

  return createProviderRegistry({});
}

module.exports = {
  VALID_ENV_TIERS,
  PROVIDER_ID_REGEX,
  resolveEnvironmentTier,
  checkEnvironmentCommercialPolicy,
  validateMockIntegrity,
  createProviderRegistry,
  loadProviderRegistry
};
