'use strict';

/**
 * Context Fatigue & Noise Pruning Engine (Gemstack 2.0 Sprint D)
 * Monitors accumulated token load, detects redundancy, and prunes ephemeral noise.
 */

const DEFAULT_TOKEN_THRESHOLD = 16000;
const DEFAULT_REDUNDANCY_THRESHOLD = 0.4;

/**
 * Fast conservative token estimation (~4 characters per token).
 * @param {string} text 
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculates redundancy ratio based on repeated content blocks and duplicate messages.
 * @param {Array<string|object>} messages 
 * @returns {number} Float between 0.0 and 1.0
 */
function computeRedundancyRatio(messages) {
  if (!Array.isArray(messages) || messages.length <= 1) return 0;

  const texts = messages.map(m => (typeof m === 'string' ? m : (m.content || m.text || JSON.stringify(m))));
  const totalLength = texts.reduce((acc, t) => acc + t.length, 0);
  if (totalLength === 0) return 0;

  const seen = new Set();
  let duplicateLength = 0;

  for (const t of texts) {
    const trimmed = t.trim();
    if (seen.has(trimmed)) {
      duplicateLength += trimmed.length;
    } else {
      seen.add(trimmed);
    }
  }

  return Number((duplicateLength / totalLength).toFixed(4));
}

/**
 * Detects whether the current context window suffers from token fatigue or high redundancy.
 * @param {Array<string|object>} messages 
 * @param {object} options - { tokenThreshold?: number, redundancyThreshold?: number }
 * @returns {{ fatigue: boolean, total_tokens: number, token_limit: number, redundancy_ratio: number, reason?: string }}
 */
function detectContextFatigue(messages, options = {}) {
  const tokenThreshold = options.tokenThreshold || DEFAULT_TOKEN_THRESHOLD;
  const redundancyThreshold = options.redundancyThreshold || DEFAULT_REDUNDANCY_THRESHOLD;

  if (!Array.isArray(messages)) {
    return {
      fatigue: false,
      total_tokens: 0,
      token_limit: tokenThreshold,
      redundancy_ratio: 0
    };
  }

  const texts = messages.map(m => (typeof m === 'string' ? m : (m.content || m.text || JSON.stringify(m))));
  const totalTokens = texts.reduce((acc, t) => acc + estimateTokens(t), 0);
  const redundancyRatio = computeRedundancyRatio(messages);

  let fatigue = false;
  const reasons = [];

  if (totalTokens > tokenThreshold) {
    fatigue = true;
    reasons.push(`Token count (${totalTokens}) exceeds threshold (${tokenThreshold})`);
  }

  if (redundancyRatio > redundancyThreshold) {
    fatigue = true;
    reasons.push(`Redundancy ratio (${(redundancyRatio * 100).toFixed(1)}%) exceeds limit (${(redundancyThreshold * 100).toFixed(1)}%)`);
  }

  return {
    fatigue,
    total_tokens: totalTokens,
    token_limit: tokenThreshold,
    redundancy_ratio: redundancyRatio,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined
  };
}

/**
 * Deterministically prunes ephemeral noise, duplicated tool outputs, and redundant dialogue.
 * Guarantees preservation of architectural contracts, state definitions, and critical decisions.
 * @param {Array<string|object>} messages 
 * @param {object} options - { retainTail?: number }
 * @returns {Array<string|object>} Pruned message array
 */
function pruneContextNoise(messages, options = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const retainTail = options.retainTail || 3;

  const isContractOrState = (text) => {
    return (
      text.includes('gemstack-contracts') ||
      text.includes('gemstack-inherited-contracts') ||
      text.includes('gemstack-test-matrix') ||
      text.includes('phase_hashes') ||
      text.includes('handoff.md') ||
      text.includes('### Intentos fallidos') ||
      text.includes('4. Intentos fallidos')
    );
  };

  const isEphemeralNoise = (text) => {
    const trimmed = text.trim();
    if (trimmed.length < 5) return true;
    if (/^(ok|done|entendido|continuando|esperando|running)(?:\.{1,3})?$/i.test(trimmed)) return true;
    return false;
  };

  const seenHashes = new Set();
  const pruned = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const text = typeof m === 'string' ? m : (m.content || m.text || JSON.stringify(m));

    // Always preserve contracts, invariants and state
    if (isContractOrState(text)) {
      pruned.push(m);
      continue;
    }

    // Always preserve recent tail messages
    if (i >= messages.length - retainTail) {
      pruned.push(m);
      continue;
    }

    // Skip pure ephemeral chit-chat
    if (isEphemeralNoise(text)) {
      continue;
    }

    // De-duplicate identical intermediate messages
    const trimmed = text.trim();
    if (seenHashes.has(trimmed)) {
      continue;
    }
    seenHashes.add(trimmed);

    pruned.push(m);
  }

  return pruned;
}

module.exports = {
  estimateTokens,
  computeRedundancyRatio,
  detectContextFatigue,
  pruneContextNoise
};
