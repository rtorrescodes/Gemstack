'use strict';

/**
 * Formal Contract Amendment Engine (Gemstack 2.0 Hardening)
 * Replaces silent contract mutations with signed, auditable amendment records
 * cryptographically bound to contract contents, feature contexts, and approving identities.
 */

const crypto = require('crypto');

const REQUIRED_AMENDMENT_FIELDS = ['amendment_id', 'contract_id', 'version', 'reason', 'approved_by', 'signature'];

/**
 * Computes canonical SHA-256 digest of a contract definition.
 * @param {object|null} contract
 * @returns {string} Hex-encoded SHA-256 digest
 */
function computeContractCanonicalHash(contract) {
  if (!contract) return 'NULL_CONTRACT';
  if (typeof contract === 'string') return contract;
  const keys = Object.keys(contract).sort();
  const sorted = {};
  for (const k of keys) sorted[k] = contract[k];
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Computes deterministic HMAC signature for an amendment, bound to contract baseline and proposal.
 * @param {object} amendment - { amendment_id, contract_id, version, reason, approved_by, [feature_id] }
 * @param {string} secret - Mandatory trusted secret (min 16 chars)
 * @param {object} [context={}] - { feature_id, previousContract, proposedContract, previous_contract_sha256, proposed_contract_sha256 }
 * @returns {string} Hex-encoded HMAC-SHA256 signature
 */
function computeAmendmentSignature(amendment, secret, context = {}) {
  if (!amendment || typeof amendment !== 'object') {
    throw new Error('Amendment must be an object');
  }

  const effectiveSecret = secret || process.env.GEMSTACK_AMENDMENT_SECRET;
  if (!effectiveSecret || typeof effectiveSecret !== 'string' || effectiveSecret.length < 16) {
    const err = new Error('A trusted amendment signing secret (min 16 chars) is required to compute or verify amendment signatures.');
    err.code = 'AMENDMENT_SECRET_MISSING';
    throw err;
  }

  const featureId = String(context.feature_id || amendment.feature_id || '*').trim();
  const contractId = String(amendment.contract_id || '').trim();
  const version = String(amendment.version || '').trim();
  const prevHash = String(context.previous_contract_sha256 || amendment.previous_contract_sha256 || (context.previousContract ? computeContractCanonicalHash(context.previousContract) : '*')).trim();
  const propHash = String(context.proposed_contract_sha256 || amendment.proposed_contract_sha256 || (context.proposedContract ? computeContractCanonicalHash(context.proposedContract) : '*')).trim();
  const approvedBy = String(amendment.approved_by || '').trim();
  const reason = String(amendment.reason || '').trim();

  const payload = [
    featureId,
    contractId,
    version,
    prevHash,
    propHash,
    approvedBy,
    reason
  ].join('|');

  return crypto.createHmac('sha256', effectiveSecret).update(payload).digest('hex');
}

/**
 * Computes deterministic integrity hash over the amendment metadata record.
 * Separate from human approval signature.
 * @param {object} amendment
 * @returns {string} Hex-encoded SHA-256 digest
 */
function computeAmendmentIntegrityHash(amendment) {
  if (!amendment || typeof amendment !== 'object') {
    throw new Error('Amendment must be an object');
  }

  const payload = [
    String(amendment.amendment_id || ''),
    String(amendment.contract_id || ''),
    String(amendment.version || ''),
    String(amendment.reason || '').trim(),
    String(amendment.approved_by || '').trim()
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Validates that any changes from upstreamContracts to currentContracts are justified by signed amendments.
 * @param {Array<object>} upstreamContracts 
 * @param {Array<object>} currentContracts 
 * @param {Array<object>} amendments 
 * @param {object} options - { secret?: string, feature_id?: string }
 * @returns {{ valid: boolean, code?: string, error?: string, verified_amendments?: number }}
 */
function validateContractAmendments(upstreamContracts = [], currentContracts = [], amendments = [], options = {}) {
  const upstreamMap = new Map((upstreamContracts || []).map(c => [c.id, c]));
  const currentMap = new Map((currentContracts || []).map(c => [c.id, c]));
  const amendmentList = Array.isArray(amendments) ? amendments : [];
  const amendmentMap = new Map(amendmentList.map(a => [a.contract_id, a]));

  // 1. Detect modified or removed contracts
  const changedContracts = [];

  for (const [id, upstream] of upstreamMap.entries()) {
    if (!currentMap.has(id)) {
      changedContracts.push({ id, type: 'REMOVED', upstream, current: null });
    } else {
      const current = currentMap.get(id);
      if (JSON.stringify(upstream) !== JSON.stringify(current)) {
        changedContracts.push({ id, type: 'MODIFIED', upstream, current });
      }
    }
  }

  // If no changes and no declared amendments -> clean pass
  if (changedContracts.length === 0 && amendmentList.length === 0) {
    return { valid: true, verified_amendments: 0 };
  }

  // 2. Ensure each changed contract has a declared formal amendment
  for (const changed of changedContracts) {
    if (!amendmentMap.has(changed.id)) {
      return {
        valid: false,
        code: 'UNAUTHORIZED_CONTRACT_MUTATION',
        error: `El contrato congelado "${changed.id}" fue ${changed.type === 'REMOVED' ? 'eliminado' : 'modificado'} sin un registro formal de enmienda.`
      };
    }
  }

  // 3. To approve modifications, a trusted secret is strictly mandatory
  const secret = options.secret || process.env.GEMSTACK_AMENDMENT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    return {
      valid: false,
      code: 'AMENDMENT_SECRET_MISSING',
      error: 'Se requiere una clave o secreto confiable (min 16 caracteres) para verificar la aprobación formal de enmiendas.'
    };
  }

  // 4. Verify each declared amendment
  for (const a of amendmentList) {
    for (const field of REQUIRED_AMENDMENT_FIELDS) {
      if (!a[field] && a[field] !== 0) {
        return {
          valid: false,
          code: 'AMENDMENT_MALFORMED',
          error: `Enmienda "${a.amendment_id || 'UNKNOWN'}" carece del campo obligatorio "${field}".`
        };
      }
    }

    // Anti-replay check across features
    if (options.feature_id && a.feature_id && a.feature_id !== options.feature_id) {
      return {
        valid: false,
        code: 'AMENDMENT_REPLAY_DETECTED',
        error: `Enmienda "${a.amendment_id}" pertenece a la feature "${a.feature_id}", no coincide con "${options.feature_id}".`
      };
    }

    const changed = changedContracts.find(c => c.id === a.contract_id);
    const upstreamContract = changed ? changed.upstream : upstreamMap.get(a.contract_id);
    const currentContract = changed ? changed.current : currentMap.get(a.contract_id);

    const prevHash = computeContractCanonicalHash(upstreamContract);
    const propHash = computeContractCanonicalHash(currentContract);

    if (a.previous_contract_sha256 && a.previous_contract_sha256 !== prevHash) {
      return {
        valid: false,
        code: 'AMENDMENT_BASELINE_MISMATCH',
        error: `El hash del contrato base previo no coincide con la enmienda "${a.amendment_id}".`
      };
    }

    if (a.proposed_contract_sha256 && a.proposed_contract_sha256 !== propHash) {
      return {
        valid: false,
        code: 'AMENDMENT_PROPOSED_MISMATCH',
        error: `El contrato propuesto actual difiere de la especificación aprobada en la enmienda "${a.amendment_id}".`
      };
    }

    const sigContext = {
      feature_id: options.feature_id || a.feature_id || '*',
      previousContract: upstreamContract,
      proposedContract: currentContract,
      previous_contract_sha256: a.previous_contract_sha256 || prevHash,
      proposed_contract_sha256: a.proposed_contract_sha256 || propHash
    };

    let expectedSig;
    try {
      expectedSig = computeAmendmentSignature(a, secret, sigContext);
    } catch (e) {
      return {
        valid: false,
        code: e.code || 'AMENDMENT_SIGNATURE_ERROR',
        error: e.message
      };
    }

    const bufA = Buffer.from(String(a.signature));
    const bufB = Buffer.from(String(expectedSig));
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return {
        valid: false,
        code: 'AMENDMENT_SIGNATURE_INVALID',
        error: `Firma criptográfica inválida para la enmienda "${a.amendment_id}" del contrato "${a.contract_id}".`
      };
    }
  }

  return {
    valid: true,
    verified_amendments: amendmentList.length
  };
}

module.exports = {
  REQUIRED_AMENDMENT_FIELDS,
  computeContractCanonicalHash,
  computeAmendmentSignature,
  computeAmendmentIntegrityHash,
  validateContractAmendments
};
