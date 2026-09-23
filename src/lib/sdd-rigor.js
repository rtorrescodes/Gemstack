'use strict';

/**
 * SDD Rigor Engine (Gemstack 2.0 Sprint C)
 * Defines and enforces 4 levels of SDD rigor: quick, fix, feature, high-risk.
 */

const RIGOR_LEVELS = Object.freeze(['quick', 'fix', 'feature', 'high-risk']);

/**
 * Detects the declared rigor level from spec content or metadata.
 * @param {string} specContent - Content of spec.md or quick.md
 * @returns {string} Detected rigor level ('quick'|'fix'|'feature'|'high-risk')
 */
function detectRigorLevel(specContent) {
  if (!specContent || typeof specContent !== 'string') {
    return 'feature';
  }

  // Check YAML frontmatter: rigor: <level>
  const frontmatterMatch = specContent.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (frontmatterMatch) {
    const rMatch = frontmatterMatch[1].match(/^\s*rigor:\s*([a-zA-Z0-9_-]+)/m);
    if (rMatch) {
      const level = rMatch[1].trim().toLowerCase();
      if (!RIGOR_LEVELS.includes(level)) {
        const err = new Error(`Nivel de rigor inválido "${level}". Niveles válidos: ${RIGOR_LEVELS.join(', ')}`);
        err.code = 'INVALID_RIGOR_LEVEL';
        throw err;
      }
      return level;
    }
  }

  // Check Markdown annotations: **Rigor Level**: `level` or Rigor: level
  const inlineMatch = specContent.match(/\*\*Rigor(?:\s+Level)?\*\*:\s*`?([a-zA-Z0-9_-]+)`?/i);
  if (inlineMatch) {
    const level = inlineMatch[1].trim().toLowerCase();
    if (!RIGOR_LEVELS.includes(level)) {
      const err = new Error(`Nivel de rigor inválido "${level}". Niveles válidos: ${RIGOR_LEVELS.join(', ')}`);
      err.code = 'INVALID_RIGOR_LEVEL';
      throw err;
    }
    return level;
  }

  return 'feature';
}

/**
 * Validates requirements for a given rigor level.
 * @param {string} rigorLevel - 'quick'|'fix'|'feature'|'high-risk'
 * @param {object} context - Context containing specContent, planContent, tasksContent, testMatrix, sidecar, etc.
 * @returns {{ valid: boolean, code?: string, error?: string, [key: string]: any }}
 */
function validateRigorRequirements(rigorLevel, context = {}) {
  const normLevel = (rigorLevel || 'feature').toLowerCase();
  if (!RIGOR_LEVELS.includes(normLevel)) {
    const err = new Error(`Nivel de rigor inválido "${normLevel}".`);
    err.code = 'INVALID_RIGOR_LEVEL';
    throw err;
  }

  const {
    specContent = '',
    planContent = null,
    tasksContent = null,
    testMatrix = [],
    sidecar = null
  } = context;

  switch (normLevel) {
    case 'quick': {
      if (!specContent || typeof specContent !== 'string' || specContent.trim().length === 0) {
        return {
          valid: false,
          code: 'QUICK_SPEC_MISSING',
          error: 'Quick rigor requires at least one spec or quick artifact'
        };
      }
      return {
        valid: true,
        rigor: 'quick',
        single_artifact_allowed: true
      };
    }

    case 'fix': {
      // Must have at least one regression test in the test matrix
      const matrix = Array.isArray(testMatrix) ? testMatrix : [];
      const regressionTest = matrix.find(t => {
        const cat = (t.category || '').toUpperCase();
        const id = (t.id || '').toUpperCase();
        const desc = (t.description || '').toLowerCase();
        return cat === 'REGRESSION' || id.includes('REG') || desc.includes('regression') || desc.includes('reproduce');
      });

      if (!regressionTest) {
        return {
          valid: false,
          code: 'FIX_MISSING_REGRESSION_TEST',
          error: 'Fix rigor requires at least one linked regression test in the test matrix (category REGRESSION or ID matching *REG*)'
        };
      }

      return {
        valid: true,
        rigor: 'fix',
        regression_test_id: regressionTest.id
      };
    }

    case 'feature': {
      if (!specContent) {
        return { valid: false, code: 'FEATURE_SPEC_MISSING', error: 'Feature rigor requires spec.md' };
      }
      if (!planContent) {
        return { valid: false, code: 'FEATURE_PLAN_MISSING', error: 'Feature rigor requires plan.md' };
      }
      if (!tasksContent) {
        return { valid: false, code: 'FEATURE_TASKS_MISSING', error: 'Feature rigor requires tasks.md' };
      }
      return {
        valid: true,
        rigor: 'feature'
      };
    }

    case 'high-risk': {
      // 1. Threat Model in specContent
      const hasThreatModel = context.hasThreatModel ||
        /##\s+(?:[0-9.]+\s+)?(?:Threat\s+Model|Modelo\s+de\s+Amenazas)/i.test(specContent);
      if (!hasThreatModel) {
        return {
          valid: false,
          code: 'HIGH_RISK_MISSING_THREAT_MODEL',
          error: 'High-risk rigor requires an explicit Threat Model section in spec.md'
        };
      }

      // 2. Rollback Plan in planContent
      const hasRollbackPlan = context.hasRollbackPlan ||
        (planContent && /##\s+(?:[0-9.]+\s+)?(?:Rollback\s+Plan|Plan\s+de\s+Rollback)/i.test(planContent));
      if (!hasRollbackPlan) {
        return {
          valid: false,
          code: 'HIGH_RISK_MISSING_ROLLBACK_PLAN',
          error: 'High-risk rigor requires an explicit Rollback Plan section in plan.md'
        };
      }

      // 3. Dual human approvals in sidecar
      const approvals = sidecar && Array.isArray(sidecar.approvals) ? sidecar.approvals : [];
      const validApprovals = approvals.filter(a => a && a.approver && a.signature);
      const uniqueApprovers = new Set(validApprovals.map(a => a.approver));

      if (uniqueApprovers.size < 2) {
        return {
          valid: false,
          code: 'HIGH_RISK_INSUFFICIENT_APPROVALS',
          error: `High-risk rigor requires at least 2 distinct human approval signatures. Found: ${uniqueApprovers.size}`
        };
      }

      return {
        valid: true,
        rigor: 'high-risk',
        approvals_count: uniqueApprovers.size
      };
    }

    default:
      return { valid: false, code: 'UNKNOWN_RIGOR', error: `Unknown rigor: ${normLevel}` };
  }
}

module.exports = {
  RIGOR_LEVELS,
  detectRigorLevel,
  validateRigorRequirements
};
