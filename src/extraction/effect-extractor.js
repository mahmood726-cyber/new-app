/**
 * Effect Extractor Module
 * Extracts hazard ratios, risk ratios, odds ratios, confidence intervals, and p-values
 *
 * @module effect-extractor
 */

/**
 * Extract effect estimate from text
 * @param {string} text - Text containing effect estimate
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted effect with confidence
 */
export function extractEffect(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return {
            success: false,
            error: 'Invalid input text'
        };
    }

    const config = {
        detectEffectType: options.detectEffectType ?? true,
        extractPValue: options.extractPValue ?? true,
        ...options
    };

    // Try all patterns
    let result = null;

    // Pattern 1: "0.78 (95% CI, 0.72 to 0.84)"
    result = tryPattern1(text);
    if (result) return enhanceResult(result, text, config);

    // Pattern 2: "0.78 (0.72-0.84)"
    result = tryPattern2(text);
    if (result) return enhanceResult(result, text, config);

    // Pattern 3: "0.78 [0.72, 0.84]"
    result = tryPattern3(text);
    if (result) return enhanceResult(result, text, config);

    // Pattern 4: "HR 0.78; 95% CI 0.72-0.84"
    result = tryPattern4(text);
    if (result) return enhanceResult(result, text, config);

    // Pattern 5: "0.78 (0.72-0.84); P<0.001"
    result = tryPattern5(text);
    if (result) return enhanceResult(result, text, config);

    // Pattern 6: Reference category "1.00 (reference)"
    result = tryPatternReference(text);
    if (result) return enhanceResult(result, text, config);

    // Pattern 7: Not estimable "NE" or "NR"
    result = tryPatternNE(text);
    if (result) return enhanceResult(result, text, config);

    // Pattern 8: Effect with SE instead of CI
    result = tryPatternSE(text);
    if (result) return enhanceResult(result, text, config);

    // Flexible fallback for common publication phrasing and bracket formats.
    result = tryFlexiblePattern(text);
    if (result) return enhanceResult(result, text, config);

    return {
        success: false,
        error: 'No effect estimate pattern matched',
        raw_text: text
    };
}

/**
 * Pattern 1: "0.78 (95% CI, 0.72 to 0.84)" - handles 90%, 95%, 99% CI levels
 */
function tryPattern1(text) {
    // Match any CI level: 90%, 95%, 99%
    const pattern = /(\d+\.?\d*)\s*\(\s*(90|95|99)\s*%?\s*CI\s*[,:]?\s*(\d+\.?\d*)\s*(?:to|-|–)\s*(\d+\.?\d*)\s*\)/i;
    const match = text.match(pattern);

    if (match) {
        return {
            value: parseFloat(match[1]),
            ci_lower: parseFloat(match[3]),
            ci_upper: parseFloat(match[4]),
            ci_level: parseInt(match[2]),
            pattern: 'pattern1',
            confidence: 0.95
        };
    }
    return null;
}

/**
 * Pattern 2: "0.78 (0.72-0.84)" or "0.78 (0.72, 0.84)"
 */
function tryPattern2(text) {
    const pattern = /(\d+\.?\d*)\s*\(\s*(\d+\.?\d*)\s*[-–,]\s*(\d+\.?\d*)\s*\)/;
    const match = text.match(pattern);

    if (match) {
        const value = parseFloat(match[1]);
        const lower = parseFloat(match[2]);
        const upper = parseFloat(match[3]);

        // Validate: lower < value < upper (usually)
        if (lower <= value && value <= upper) {
            return {
                value,
                ci_lower: lower,
                ci_upper: upper,
                ci_level: 95, // Assume 95% if not specified
                pattern: 'pattern2',
                confidence: 0.88
            };
        }
    }
    return null;
}

/**
 * Pattern 3: "0.78 [0.72, 0.84]"
 */
function tryPattern3(text) {
    const pattern = /(\d+\.?\d*)\s*\[\s*(\d+\.?\d*)\s*[-–,]\s*(\d+\.?\d*)\s*\]/;
    const match = text.match(pattern);

    if (match) {
        return {
            value: parseFloat(match[1]),
            ci_lower: parseFloat(match[2]),
            ci_upper: parseFloat(match[3]),
            ci_level: 95,
            pattern: 'pattern3',
            confidence: 0.88
        };
    }
    return null;
}

/**
 * Pattern 4: "HR 0.78; 95% CI 0.72-0.84" or "HR: 0.78, 95% CI: 0.72-0.84"
 * Also handles 90% and 99% CI
 */
function tryPattern4(text) {
    const pattern = /(?:HR|RR|OR|IRR|RD|ARR|NNT)\s*[=:]?\s*(\d+\.?\d*)\s*[;,]?\s*(90|95|99)\s*%?\s*CI\s*[=:]?\s*(-?\d+\.?\d*)\s*[-–to]\s*(-?\d+\.?\d*)/i;
    const match = text.match(pattern);

    if (match) {
        // Also detect effect type
        const typeMatch = text.match(/(HR|RR|OR|IRR|RD|ARR|NNT)/i);
        return {
            value: parseFloat(match[1]),
            ci_lower: parseFloat(match[3]),
            ci_upper: parseFloat(match[4]),
            ci_level: parseInt(match[2]),
            effect_type: typeMatch ? typeMatch[1].toUpperCase() : null,
            pattern: 'pattern4',
            confidence: 0.95
        };
    }
    return null;
}

/**
 * Pattern 5: "0.78 (0.72-0.84); P<0.001" or "0.78 (0.72-0.84), p=0.03"
 */
function tryPattern5(text) {
    const pattern = /(\d+\.?\d*)\s*\(\s*(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*\)\s*[;,]?\s*[Pp]\s*[<>=]?\s*(\d+\.?\d*)/;
    const match = text.match(pattern);

    if (match) {
        const pOperator = text.match(/[Pp]\s*([<>=])/);
        return {
            value: parseFloat(match[1]),
            ci_lower: parseFloat(match[2]),
            ci_upper: parseFloat(match[3]),
            ci_level: 95,
            p_value: parseFloat(match[4]),
            p_operator: pOperator ? pOperator[1] : '=',
            pattern: 'pattern5',
            confidence: 0.95
        };
    }
    return null;
}

/**
 * Pattern Reference: "1.00 (reference)" or "1 (ref)"
 */
function tryPatternReference(text) {
    const pattern = /(\d+\.?\d*)\s*\(\s*(?:reference|ref\.?)\s*\)/i;
    const match = text.match(pattern);

    if (match) {
        return {
            value: parseFloat(match[1]),
            ci_lower: null,
            ci_upper: null,
            is_reference: true,
            pattern: 'reference',
            confidence: 0.98
        };
    }
    return null;
}

/**
 * Pattern NE: "NE" or "NR" or "Not estimable"
 */
function tryPatternNE(text) {
    const pattern = /\b(NE|NR|N\.E\.|N\.R\.|Not\s+estimable|Not\s+reported|Not\s+available)\b/i;
    const match = text.match(pattern);

    if (match) {
        return {
            value: null,
            ci_lower: null,
            ci_upper: null,
            not_estimable: true,
            reason: match[1].toUpperCase(),
            pattern: 'not_estimable',
            confidence: 0.90
        };
    }
    return null;
}

/**
 * Pattern SE: Effect with standard error "0.78 (SE 0.12)"
 */
function tryPatternSE(text) {
    const pattern = /(\d+\.?\d*)\s*\(\s*SE\s*[=:]?\s*(\d+\.?\d*)\s*\)/i;
    const match = text.match(pattern);

    if (match) {
        const value = parseFloat(match[1]);
        const se = parseFloat(match[2]);

        // Calculate 95% CI from SE (assuming normal distribution)
        const ci_lower = value - 1.96 * se;
        const ci_upper = value + 1.96 * se;

        return {
            value,
            se,
            ci_lower: Math.max(0, ci_lower), // Ratios can't be negative
            ci_upper,
            ci_level: 95,
            ci_derived: true,
            pattern: 'pattern_se',
            confidence: 0.82
        };
    }
    return null;
}

/**
 * Flexible fallback for bracketed CIs, spelled-out confidence intervals,
 * signed mean differences, and "RR=1.2" style labels.
 */
function tryFlexiblePattern(text) {
    const parenPattern = /(?:\b(?:HR|RR|OR|IRR|RD|ARR|NNT|NNH|MD|SMD|WMD)\b|hazard\s+ratio|risk\s+ratio|relative\s+risk|odds\s+ratio|mean\s+difference|standardized\s+mean\s+difference|Hedges(?:'s)?\s+g|Cohen(?:'s)?\s+d)?\s*(?:of)?\s*[=:]?\s*(-?\d+\.?\d*)\s*\(\s*(?:(90|95|99)\s*%?\s*(?:CI|confidence\s+interval)\s*[,:]?\s*)?(-?\d+\.?\d*)\s*(?:to|-|–|,)\s*(-?\d+\.?\d*)\s*\)/i;
    const parenMatch = text.match(parenPattern);
    if (parenMatch) {
        return {
            value: parseFloat(parenMatch[1]),
            ci_lower: parseFloat(parenMatch[3]),
            ci_upper: parseFloat(parenMatch[4]),
            ci_level: parenMatch[2] ? parseInt(parenMatch[2]) : 95,
            pattern: 'flex_paren',
            confidence: 0.92
        };
    }

    const bracketPattern = /(?:\b(?:HR|RR|OR|IRR|RD|ARR|NNT|NNH|MD|SMD|WMD)\b|hazard\s+ratio|risk\s+ratio|relative\s+risk|odds\s+ratio)?\s*(?:of)?\s*[=:]?\s*(-?\d+\.?\d*)\s*\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]/i;
    const bracketMatch = text.match(bracketPattern);
    if (bracketMatch) {
        return {
            value: parseFloat(bracketMatch[1]),
            ci_lower: parseFloat(bracketMatch[2]),
            ci_upper: parseFloat(bracketMatch[3]),
            ci_level: 95,
            pattern: 'flex_bracket',
            confidence: 0.9
        };
    }

    return null;
}

/**
 * Enhance result with additional extractions
 */
function enhanceResult(result, text, config) {
    // Detect effect type if not already detected
    if (config.detectEffectType && !result.effect_type) {
        result.effect_type = detectEffectType(text);
    }

    // Extract p-value if not already extracted
    if (config.extractPValue && !result.p_value && !result.is_reference && !result.not_estimable) {
        const pValue = extractPValue(text);
        if (pValue) {
            result.p_value = pValue.value;
            result.p_operator = pValue.operator;
        }
    }

    if (result.se == null && result.ci_lower != null && result.ci_upper != null) {
        result.se = calculateSE(result);
    }
    if (result.vi == null && result.se != null) {
        result.vi = result.se * result.se;
    }

    result.success = true;
    result.raw_text = text;

    return result;
}

/**
 * Detect effect type (HR, RR, OR, RD, NNT, etc.)
 * @param {string} text - Text to analyze
 * @returns {string|null} Effect type
 */
export function detectEffectType(text) {
    if (/Hedges(?:'s)?\s+g/i.test(text) || /Cohen(?:'s)?\s+d/i.test(text)) {
        return 'SMD';
    }
    if (/\bHR\b\s*[=:]?/i.test(text)) return 'HR';
    if (/\bRR\b\s*[=:]?/i.test(text)) return 'RR';
    if (/\bOR\b\s*[=:]?/i.test(text)) return 'OR';
    if (/\bIRR\b\s*[=:]?/i.test(text)) return 'IRR';
    if (/\bMD\b\s*[=:]?/i.test(text)) return 'MD';
    if (/\bSMD\b\s*[=:]?/i.test(text)) return 'SMD';

    const patterns = [
        // Ratio measures
        { pattern: /\bhazard\s+ratio\b/i, type: 'HR' },
        { pattern: /\bHR\b(?!\s*=)/, type: 'HR' },
        { pattern: /\brisk\s+ratio\b/i, type: 'RR' },
        { pattern: /\brelative\s+risk\b/i, type: 'RR' },
        { pattern: /\bRR\b(?!\s*=)/, type: 'RR' },
        { pattern: /\bodds\s+ratio\b/i, type: 'OR' },
        { pattern: /\bOR\b(?!\s*=)/, type: 'OR' },
        { pattern: /\bincidence\s+rate\s+ratio\b/i, type: 'IRR' },
        { pattern: /\bIRR\b(?!\s*=)/, type: 'IRR' },

        // Absolute measures
        { pattern: /\brisk\s+difference\b/i, type: 'RD' },
        { pattern: /\brate\s+difference\b/i, type: 'RD' },
        { pattern: /\bRD\b(?!\s*=)/, type: 'RD' },
        { pattern: /\babsolute\s+risk\s+(?:reduction|difference)\b/i, type: 'ARR' },
        { pattern: /\bARR\b(?!\s*=)/, type: 'ARR' },
        { pattern: /\bnumber\s+needed\s+to\s+treat\b/i, type: 'NNT' },
        { pattern: /\bNNT\b(?!\s*=)/, type: 'NNT' },
        { pattern: /\bnumber\s+needed\s+to\s+harm\b/i, type: 'NNH' },
        { pattern: /\bNNH\b(?!\s*=)/, type: 'NNH' },

        // Continuous measures
        { pattern: /\bmean\s+difference\b/i, type: 'MD' },
        { pattern: /\bMD\b(?!\s*=)/, type: 'MD' },
        { pattern: /\bstandardized\s+mean\s+difference\b/i, type: 'SMD' },
        { pattern: /\bSMD\b(?!\s*=)/, type: 'SMD' },
        { pattern: /\bweighted\s+mean\s+difference\b/i, type: 'WMD' },
        { pattern: /\bWMD\b/, type: 'WMD' },
        { pattern: /\bHedges['']?\s*g\b/i, type: 'SMD' },
        { pattern: /\bCohen['']?\s*d\b/i, type: 'SMD' }
    ];

    for (const { pattern, type } of patterns) {
        if (pattern.test(text)) {
            return type;
        }
    }

    return null;
}

/**
 * Extract p-value from text
 * @param {string} text - Text containing p-value
 * @returns {Object|null} P-value with operator
 */
export function extractPValue(text) {
    if (/\bNS\b|\bnot\s+significant\b/i.test(text)) {
        return {
            value: 0.051,
            operator: '>'
        };
    }

    // Pattern: P<0.001, P=0.03, p-value=0.05, P value <0.0001
    const patterns = [
        /[Pp]\s*[-]?\s*value\s*[=<>]\s*(\d+\.?\d*)/,
        /[Pp]\s*[=<>]\s*(\d+\.?\d*)/,
        /\(\s*[Pp]\s*[=<>]\s*(\d+\.?\d*)\s*\)/,
        /[Pp]\s*=\s*(\d+\.?\d*(?:e[-+]?\d+)?)/i  // Scientific notation
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            // Extract operator
            const opMatch = text.match(/[Pp]\s*[-]?\s*(?:value)?\s*([=<>])/);
            return {
                value: parseFloat(match[1]),
                operator: opMatch ? opMatch[1] : '='
            };
        }
    }

    // Handle "P<.001" format
    const shortPattern = /[Pp]\s*([<>=])\s*\.(\d+)/;
    const shortMatch = text.match(shortPattern);
    if (shortMatch) {
        return {
            value: parseFloat('0.' + shortMatch[2]),
            operator: shortMatch[1]
        };
    }

    return null;
}

/**
 * Extract multiple effects from a table cell or text block
 * @param {string} text - Text containing multiple effects
 * @returns {Array} Array of extracted effects
 */
export function extractMultipleEffects(text) {
    const results = [];

    // Split by common separators
    const segments = text.split(/[;|\n]/);

    for (const segment of segments) {
        if (segment.trim()) {
            const result = extractEffect(segment.trim());
            if (result.success) {
                results.push(result);
            }
        }
    }

    return results;
}

/**
 * Validate extracted effect
 * Implements tolerance for edge cases around p=0.05 and CI boundaries
 * @param {Object} effect - Extracted effect object
 * @returns {Object} Validation result
 */
export function validateEffect(effect) {
    const issues = [];
    const warnings = [];

    if (!effect || !effect.success) {
        return { valid: false, issues: ['No valid effect extracted'], warnings: [] };
    }

    // Check if point estimate is within CI
    if (effect.ci_lower !== null && effect.ci_upper !== null) {
        if (effect.value < effect.ci_lower || effect.value > effect.ci_upper) {
            issues.push('Point estimate outside confidence interval');
        }
    }

    // Check CI bounds order
    if (effect.ci_lower !== null && effect.ci_upper !== null) {
        if (effect.ci_lower > effect.ci_upper) {
            issues.push('CI lower bound greater than upper bound');
        }
    }

    // Check for negative values (invalid for ratios)
    const isRatio = effect.effect_type && ['HR', 'RR', 'OR', 'IRR'].includes(effect.effect_type);
    if (isRatio) {
        if (effect.value < 0 || (effect.ci_lower !== null && effect.ci_lower < 0)) {
            issues.push('Negative value for ratio effect');
        }
    }

    // Check p-value range
    if (effect.p_value !== null && effect.p_value !== undefined) {
        if (effect.p_value < 0 || effect.p_value > 1) {
            issues.push('P-value outside valid range [0,1]');
        }
    }

    // Cross-validate p-value with CI (with tolerance for edge cases)
    if (effect.p_value !== null && effect.ci_lower !== null && effect.ci_upper !== null) {
        const nullValue = isRatio ? 1 : 0;
        const excludesNull = effect.ci_lower > nullValue || effect.ci_upper < nullValue;

        // Tolerance for edge cases
        const tolerance = isRatio ? 0.02 : 0.01;
        const marginLower = isRatio
            ? Math.abs(effect.ci_lower - nullValue) / nullValue
            : Math.abs(effect.ci_lower - nullValue);
        const marginUpper = isRatio
            ? Math.abs(effect.ci_upper - nullValue) / nullValue
            : Math.abs(effect.ci_upper - nullValue);
        const nearBoundary = marginLower < tolerance || marginUpper < tolerance;
        const pNearThreshold = effect.p_value >= 0.04 && effect.p_value <= 0.06;

        // Only flag clear inconsistencies (not edge cases)
        if (excludesNull && effect.p_value >= 0.05) {
            if (!(pNearThreshold && nearBoundary)) {
                warnings.push('P-value inconsistent with CI (CI excludes null but P>=0.05)');
            }
        }
        if (!excludesNull && effect.p_value < 0.05 && effect.p_operator !== '<') {
            if (!(pNearThreshold && nearBoundary)) {
                warnings.push('P-value inconsistent with CI (CI includes null but P<0.05)');
            }
        }

        // Strong inconsistency check
        if (effect.p_value < 0.001 && !excludesNull) {
            issues.push('Severe inconsistency: P < 0.001 but CI includes null');
        }
    }

    return {
        valid: issues.length === 0,
        issues,
        warnings
    };
}

/**
 * Convert effect from log scale
 * @param {Object} effect - Effect in log scale
 * @returns {Object} Effect in original scale
 */
export function convertFromLog(effect) {
    return {
        ...effect,
        value: Math.exp(effect.value),
        ci_lower: effect.ci_lower !== null ? Math.exp(effect.ci_lower) : null,
        ci_upper: effect.ci_upper !== null ? Math.exp(effect.ci_upper) : null,
        converted_from: 'log'
    };
}

/**
 * Convert effect to log scale
 * @param {Object} effect - Effect in original scale
 * @returns {Object} Effect in log scale
 */
export function convertToLog(effect) {
    if (effect.value <= 0) {
        return { success: false, error: 'Cannot log-transform non-positive value' };
    }

    return {
        ...effect,
        value: Math.log(effect.value),
        ci_lower: effect.ci_lower !== null && effect.ci_lower > 0 ? Math.log(effect.ci_lower) : null,
        ci_upper: effect.ci_upper !== null && effect.ci_upper > 0 ? Math.log(effect.ci_upper) : null,
        converted_to: 'log'
    };
}

/**
 * Get z-value for a given CI level
 * @param {number} ciLevel - CI level as percentage (90, 95, 99)
 * @returns {number} z-value
 */
function getZValueForCI(ciLevel) {
    const ciMap = {
        90: 1.645,
        95: 1.96,
        99: 2.576,
        99.9: 3.291
    };
    return ciMap[ciLevel] || 1.96;
}

/**
 * Calculate SE from CI
 * Properly handles different CI levels
 * @param {Object} effect - Effect with CI
 * @param {number} ciLevel - CI level (default: auto-detect from effect or 95)
 * @returns {number|null} Standard error
 */
export function calculateSE(effect, ciLevel = null) {
    if (effect.ci_lower === null || effect.ci_upper === null) {
        return null;
    }

    // Use provided CI level, or effect's CI level, or default to 95
    const level = ciLevel || effect.ci_level || 95;
    const z = getZValueForCI(level);

    // For ratio measures, calculate on log scale
    const isRatio = ['HR', 'RR', 'OR', 'IRR'].includes(effect.effect_type);

    if (isRatio && effect.ci_lower > 0 && effect.ci_upper > 0) {
        const logCIWidth = Math.log(effect.ci_upper) - Math.log(effect.ci_lower);
        return logCIWidth / (2 * z);
    }

    // For difference measures (MD, SMD, RD, etc.)
    const ciWidth = effect.ci_upper - effect.ci_lower;
    return ciWidth / (2 * z);
}

/**
 * Calculate variance from CI
 * Properly handles different CI levels
 * @param {Object} effect - Effect with CI
 * @param {number} ciLevel - CI level (default: auto-detect from effect or 95)
 * @returns {number|null} Variance
 */
export function calculateVariance(effect, ciLevel = null) {
    const se = calculateSE(effect, ciLevel);
    return se !== null ? se * se : null;
}

/**
 * Determine if effect type is a ratio measure
 * @param {string} effectType - Effect type
 * @returns {boolean} True if ratio measure
 */
export function isRatioMeasure(effectType) {
    return ['HR', 'RR', 'OR', 'IRR'].includes(effectType);
}

/**
 * Determine if effect type is a difference measure
 * @param {string} effectType - Effect type
 * @returns {boolean} True if difference measure
 */
export function isDifferenceMeasure(effectType) {
    return ['MD', 'SMD', 'WMD', 'RD', 'ARR'].includes(effectType);
}

export function parseEffectSize(text, options = {}) {
    return extractEffect(text, options);
}

export default {
    extractEffect,
    parseEffectSize,
    extractMultipleEffects,
    extractPValue,
    detectEffectType,
    validateEffect,
    convertFromLog,
    convertToLog,
    calculateSE,
    calculateVariance,
    isRatioMeasure,
    isDifferenceMeasure
};
