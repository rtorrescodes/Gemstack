'use strict';

/**
 * Formal Contract Amendment Engine (Gemstack 2.0 Sprint C)
 * Replaces silent contract mutations with signed, auditable amendment records.
 */

const crypto = require('crypto');

const REQUIRED_AMENDMENT_FIELDS = ['amendment_id', 'contract_id', 'version', 'reason', 'approved_by', 'signature'];

/**
 * Computes deterministic signature for an amendment.
 * @param {object} amendment - { amendment_id, contract_id, version, reason, approved_by }
 * @param {string|null} secret - Optional HMAC secret
 * @returns {string} Hex-encoded SHA-256 or HMAC-SHA256 digest
 */
function computeAmendmentSignature(amendment, secret = null) {
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

  if (secret && typeof secret === 'string' && secret.length > 0) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Validates that any changes from upstreamContracts to currentContracts are justified by signed amendments.
 * @param {Array<object>} upstreamContracts 
 * @param {Array<object>} currentContracts 
 * @param {Array<object>} amendments 
 * @param {object} options - { secret?: string }
 * @returns {{ valid: boolean, code?: string, error?: string, verified_amendments?: number }}
 */
function validateContractAmendments(upstreamContracts = [], currentContracts = [], amendments = [], options = {}) {
  const upstreamMap = new Map((upstreamContracts || []).map(c => [c.id, c]));
  const currentMap = new Map((currentContracts || []).map(c => [c.id, c]));
  const amendmentList = Array.isArray(amendments) ? amendments : [];
  const amendmentMap = new Map(amendmentList.map(a => [a.contract_id, a]));

  // 1. Detect modified or removed contracts
  const changedContractIds = [];

  for (const [id, upstream] of upstreamMap.entries()) {
    if (!currentMap.has(id)) {
      changedContractIds.push({ id, type: 'REMOVED', upstream });
    } else {
      const current = currentMap.get(id);
      if (JSON.stringify(upstream) !== JSON.stringify(current)) {
        changedContractIds.push({ id, type: 'MODIFIED', upstream, current });
      }
    }
  }

  // 2. Ensure each changed contract has a valid, signed amendment
  for (const changed of changedContractIds) {
    if (!amendmentMap.has(changed.id)) {
      return {
        valid: false,
        code: 'UNAUTHORIZED_CONTRACT_MUTATION',
        error: `El contrato congelado "${changed.id}" fue ${changed.type === 'REMOVED' ? 'eliminado' : 'modificado'} sin un registro formal de enmienda.`
      };
    }
  }

  // 3. Verify each declared amendment
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

    const expectedSig = computeAmendmentSignature(a, options.secret);
    if (a.signature !== expectedSig) {
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
  computeAmendmentSignature,
  validateContractAmendments
};
