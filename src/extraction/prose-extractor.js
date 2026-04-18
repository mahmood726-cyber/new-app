/**
 * Prose Extractor Module
 * Extracts statistical results from narrative text in Results sections
 *
 * @module prose-extractor
 */

import { extractEffect, extractPValue, detectEffectType } from './effect-extractor.js';
import { mapOutcome } from './outcome-mapper.js';

/**
 * Extract all results from prose text
 * @param {string} text - Full text or Results section
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted results
 */
export function extractFromProse(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return {
            success: false,
            error: 'Invalid input text'
        };
    }

    const config = {
        extractOutcomes: options.extractOutcomes ?? true,
        extractEventCounts: options.extractEventCounts ?? true,
        extractFollowUp: options.extractFollowUp ?? true,
        extractNNT: options.extractNNT ?? true,
        ...options
    };

    // Segment text into sentences
    const sentences = segmentSentences(text);

    // Find sentences with statistical content
    const statSentences = sentences.filter(s => hasStatisticalContent(s));

    const results = {
        success: true,
        outcomes: [],
        eventCounts: [],
        followUp: null,
        sampleSize: null
    };

    // Extract from each statistical sentence
    for (const sentence of statSentences) {
        // Try to extract outcome results
        if (config.extractOutcomes) {
            const outcomeResult = extractOutcomeFromSentence(sentence);
            if (outcomeResult) {
                results.outcomes.push(outcomeResult);
            }
        }

        // Try to extract event counts
        if (config.extractEventCounts) {
            const eventResult = extractEventCountsFromSentence(sentence);
            if (eventResult) {
                results.eventCounts.push(eventResult);
            }
        }
    }

    // Extract follow-up information
    if (config.extractFollowUp) {
        results.followUp = extractFollowUp(text);
    }

    // Extract sample size
    results.sampleSize = extractSampleSize(text);

    // Extract NNT if mentioned
    if (config.extractNNT) {
        results.nnt = extractNNT(text);
    }

    // Deduplicate and merge outcomes
    results.outcomes = mergeOutcomes(results.outcomes);

    return results;
}

/**
 * Segment text into sentences
 * @param {string} text - Text to segment
 * @returns {Array<string>} Sentences
 */
function segmentSentences(text) {
    // Handle abbreviations that contain periods
    const protectedText = text
        .replace(/\bvs\./gi, 'vs<DOT>')
        .replace(/\bet\s+al\./gi, 'et al<DOT>')
        .replace(/\bFig\./gi, 'Fig<DOT>')
        .replace(/\bNo\./gi, 'No<DOT>')
        .replace(/\bi\.e\./gi, 'ie<DOT>')
        .replace(/\be\.g\./gi, 'eg<DOT>')
        .replace(/(\d+)\.(\d+)/g, '$1<DECIMAL>$2');

    // Split on sentence boundaries
    const sentences = protectedText.split(/(?<=[.!?])\s+(?=[A-Z])/);

    // Restore protected elements
    return sentences.map(s => s
        .replace(/<DOT>/g, '.')
        .replace(/<DECIMAL>/g, '.')
        .trim()
    ).filter(s => s.length > 10);
}

/**
 * Check if sentence contains statistical content
 * @param {string} sentence - Sentence to check
 * @returns {boolean}
 */
function hasStatisticalContent(sentence) {
    const patterns = [
        /\bhazard\s+ratio\b/i,
        /\bHR\b/,
        /\brisk\s+ratio\b/i,
        /\bodds\s+ratio\b/i,
        /\bconfidence\s+interval\b/i,
        /\b95\s*%\s*CI\b/i,
        /\bP\s*[<>=]\s*\d/,
        /\(\s*\d+\.?\d*\s*[-–]\s*\d+\.?\d*\s*\)/,
        /\d+\s*patients?\s*\(\s*\d+\.?\d*\s*%\s*\)/i,
        /\d+\.?\d*\s*(?:events?|deaths?)\s*per\s*\d+/i,
        /\bprimary\s+(?:outcome|endpoint)\b/i,
        /\bsecondary\s+(?:outcome|endpoint)\b/i
    ];

    return patterns.some(p => p.test(sentence));
}

/**
 * Extract outcome result from a sentence
 * @param {string} sentence - Sentence to parse
 * @returns {Object|null} Extracted outcome
 */
function extractOutcomeFromSentence(sentence) {
    // Try to identify the outcome being discussed
    const outcomePatterns = [
        /\b(?:the\s+)?primary\s+(?:composite\s+)?(?:outcome|endpoint|end\s*point)\b/i,
        /\b(?:the\s+)?secondary\s+(?:outcome|endpoint)\b/i,
        /\b(?:death|mortality)\s+(?:from\s+)?(?:any|all|cardiovascular)\s+causes?\b/i,
        /\bheart\s+failure\s+hospitalization\b/i,
        /\bcardiovascular\s+(?:death|mortality)\b/i,
        /\bcomposite\s+of\s+[^,]+(?:,\s*[^,]+)*(?:,?\s*(?:and|or)\s+[^,]+)/i,
        /\bworsening\s+(?:heart\s+failure|renal\s+function)\b/i
    ];

    let outcomeMatch = null;
    for (const pattern of outcomePatterns) {
        const match = sentence.match(pattern);
        if (match) {
            outcomeMatch = match[0];
            break;
        }
    }

    // Extract the effect estimate
    const effect = extractEffect(sentence);

    if (!effect.success) {
        return null;
    }

    // Map outcome to taxonomy
    const mappedOutcome = outcomeMatch ? mapOutcome(outcomeMatch) : null;

    return {
        outcome: {
            raw: outcomeMatch,
            mapped: mappedOutcome?.mapped || null,
            category: mappedOutcome?.category || null
        },
        effect: {
            type: effect.effect_type || detectEffectType(sentence),
            value: effect.value,
            ci_lower: effect.ci_lower,
            ci_upper: effect.ci_upper,
            p_value: effect.p_value || extractPValue(sentence)?.value
        },
        source: 'prose',
        confidence: calculateConfidence(outcomeMatch, effect),
        raw_sentence: sentence
    };
}

/**
 * Extract event counts from sentence
 * Example: "386 patients (16.3%) in the dapagliflozin group and 502 (21.2%) in the placebo group"
 * @param {string} sentence - Sentence to parse
 * @returns {Object|null} Extracted event counts
 */
function extractEventCountsFromSentence(sentence) {
    // Pattern: N patients (X%) in [group] and M (Y%) in [other group]
    const twoGroupPattern = /(\d+)\s*(?:patients?)?\s*\((\d+\.?\d*)\s*%\s*\)\s*in\s*(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:group|arm)?\s*(?:and|versus|vs\.?)\s*(\d+)\s*(?:patients?)?\s*\((\d+\.?\d*)\s*%\s*\)\s*in\s*(?:the\s+)?(\w+(?:\s+\w+)?)/i;

    const match = sentence.match(twoGroupPattern);

    if (match) {
        return {
            group1: {
                name: match[3].toLowerCase(),
                events: parseInt(match[1]),
                percentage: parseFloat(match[2])
            },
            group2: {
                name: match[6].toLowerCase(),
                events: parseInt(match[4]),
                percentage: parseFloat(match[5])
            },
            source: 'prose',
            raw_sentence: sentence
        };
    }

    // Single group pattern: "occurred in 386 (16.3%) patients"
    const singlePattern = /(?:occurred|observed|reported)\s+in\s+(\d+)\s*(?:\((\d+\.?\d*)\s*%\s*\))?\s*(?:patients?|subjects?|participants?)/i;
    const singleMatch = sentence.match(singlePattern);

    if (singleMatch) {
        return {
            events: parseInt(singleMatch[1]),
            percentage: singleMatch[2] ? parseFloat(singleMatch[2]) : null,
            source: 'prose',
            raw_sentence: sentence
        };
    }

    return null;
}

/**
 * Extract follow-up duration
 * @param {string} text - Full text
 * @returns {Object|null} Follow-up information
 */
function extractFollowUp(text) {
    const patterns = [
        // Median follow-up
        {
            pattern: /median\s+(?:follow[- ]?up|observation)\s+(?:period\s+)?(?:of\s+)?(?:was\s+)?(\d+\.?\d*)\s*(months?|years?|days?|weeks?)/i,
            type: 'median'
        },
        // Mean follow-up
        {
            pattern: /mean\s+(?:follow[- ]?up|observation)\s+(?:period\s+)?(?:of\s+)?(?:was\s+)?(\d+\.?\d*)\s*(months?|years?|days?|weeks?)/i,
            type: 'mean'
        },
        // Follow-up of X months
        {
            pattern: /follow[- ]?up\s+(?:period\s+)?(?:of\s+)?(\d+\.?\d*)\s*(months?|years?|days?|weeks?)/i,
            type: 'unspecified'
        },
        // After X months/years
        {
            pattern: /after\s+(?:a\s+)?(?:median\s+)?(?:of\s+)?(\d+\.?\d*)\s*(months?|years?)\s+of\s+follow[- ]?up/i,
            type: 'median'
        }
    ];

    for (const { pattern, type } of patterns) {
        const match = text.match(pattern);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2].toLowerCase().replace(/s$/, '');

            // Convert to months
            let months;
            switch (unit) {
                case 'year': months = value * 12; break;
                case 'week': months = value / 4.33; break;
                case 'day': months = value / 30.44; break;
                default: months = value;
            }

            return {
                value,
                unit,
                months: Math.round(months * 10) / 10,
                type,
                raw: match[0]
            };
        }
    }

    return null;
}

/**
 * Extract sample size
 * @param {string} text - Full text
 * @returns {Object|null} Sample size information
 */
function extractSampleSize(text) {
    const patterns = [
        // "randomized N patients"
        /(?:we\s+)?(?:randomly\s+)?(?:assigned|randomized|enrolled)\s+(\d+)\s+(?:patients?|subjects?|participants?)/i,
        // "N patients were randomized"
        /(\d+)\s+(?:patients?|subjects?|participants?)\s+(?:were\s+)?(?:randomly\s+)?(?:assigned|randomized|enrolled)/i,
        // "sample size of N"
        /sample\s+size\s+(?:of\s+)?(\d+)/i,
        // "total of N patients"
        /total\s+of\s+(\d+)\s+(?:patients?|subjects?|participants?)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return {
                total: parseInt(match[1]),
                raw: match[0]
            };
        }
    }

    // Try to find group sizes
    const groupPattern = /(\d+)\s+(?:patients?|subjects?|participants?)\s+(?:were\s+)?(?:assigned|randomized)\s+to\s+(?:the\s+)?(\w+)(?:\s+group)?/gi;
    const groups = [];
    let groupMatch;

    while ((groupMatch = groupPattern.exec(text)) !== null) {
        groups.push({
            name: groupMatch[2].toLowerCase(),
            n: parseInt(groupMatch[1])
        });
    }

    if (groups.length > 0) {
        return {
            total: groups.reduce((sum, g) => sum + g.n, 0),
            groups,
            raw: 'Calculated from group sizes'
        };
    }

    return null;
}

/**
 * Extract NNT (Number Needed to Treat)
 * @param {string} text - Full text
 * @returns {Object|null} NNT information
 */
function extractNNT(text) {
    const pattern = /\bNNT\b\s*(?:of\s+)?(?:was\s+)?(\d+)\s*(?:\(\s*95\s*%?\s*CI\s*[,:]?\s*(\d+)\s*[-–]\s*(\d+)\s*\))?/i;
    const match = text.match(pattern);

    if (match) {
        return {
            value: parseInt(match[1]),
            ci_lower: match[2] ? parseInt(match[2]) : null,
            ci_upper: match[3] ? parseInt(match[3]) : null,
            raw: match[0]
        };
    }

    // Alternative pattern: "number needed to treat was X"
    const altPattern = /number\s+needed\s+to\s+treat\s+(?:was\s+)?(\d+)/i;
    const altMatch = text.match(altPattern);

    if (altMatch) {
        return {
            value: parseInt(altMatch[1]),
            raw: altMatch[0]
        };
    }

    return null;
}

/**
 * Calculate confidence score for extraction
 * @param {string} outcomeMatch - Matched outcome text
 * @param {Object} effect - Extracted effect
 * @returns {number} Confidence 0-1
 */
function calculateConfidence(outcomeMatch, effect) {
    let confidence = 0.7; // Base confidence

    // Boost for matched outcome
    if (outcomeMatch) confidence += 0.1;

    // Boost for complete CI
    if (effect.ci_lower !== null && effect.ci_upper !== null) confidence += 0.1;

    // Boost for p-value
    if (effect.p_value) confidence += 0.05;

    // Boost for detected effect type
    if (effect.effect_type) confidence += 0.05;

    return Math.min(0.95, confidence);
}

/**
 * Merge duplicate outcomes
 * @param {Array} outcomes - Array of extracted outcomes
 * @returns {Array} Merged outcomes
 */
function mergeOutcomes(outcomes) {
    const merged = new Map();

    for (const outcome of outcomes) {
        const key = outcome.outcome.mapped || outcome.outcome.raw || 'unknown';

        if (merged.has(key)) {
            const existing = merged.get(key);
            // Keep the one with higher confidence
            if (outcome.confidence > existing.confidence) {
                merged.set(key, outcome);
            }
        } else {
            merged.set(key, outcome);
        }
    }

    return [...merged.values()];
}

/**
 * Extract primary outcome statement
 * @param {string} text - Full text
 * @returns {Object|null} Primary outcome info
 */
export function extractPrimaryOutcome(text) {
    const patterns = [
        /\bprimary\s+(?:efficacy\s+)?(?:outcome|endpoint|end\s*point)\s+(?:was|is)\s+(?:the\s+)?(?:a\s+)?(?:composite\s+of\s+)?([^.]+)/i,
        /\bprimary\s+(?:outcome|endpoint)\s*:\s*([^.]+)/i,
        /\bthe\s+primary\s+(?:composite\s+)?(?:outcome|endpoint)\s+(?:of|was)\s+([^.]+)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const definition = match[1].trim();
            const mapped = mapOutcome(definition);

            return {
                raw: definition,
                mapped: mapped.mapped,
                category: mapped.category,
                isComposite: /composite/i.test(match[0]) || /\band\b|\bor\b/.test(definition)
            };
        }
    }

    return null;
}

/**
 * Find Results section in text
 * @param {string} text - Full document text
 * @returns {string|null} Results section text
 */
export function findResultsSection(text) {
    // Look for Results header
    const resultMatch = text.match(/\bRESULTS?\b[^\n]*\n([\s\S]*?)(?=\bDISCUSSION\b|\bCONCLUSION|\bREFERENCE|\bMETHODS\s+AND\s+MATERIALS|\z)/i);

    if (resultMatch) {
        return resultMatch[1].trim();
    }

    // Alternative: look for Results section markers
    const altMatch = text.match(/(?:^|\n)Results\s*\n([\s\S]*?)(?:\n(?:Discussion|Conclusion|Reference)|\z)/i);

    if (altMatch) {
        return altMatch[1].trim();
    }

    return null;
}

export default {
    extractFromProse,
    extractPrimaryOutcome,
    findResultsSection,
    segmentSentences: segmentSentences
};
