/**
 * Subgroup Extractor Module
 * Extracts subgroup analyses from forest plot descriptions and tables
 *
 * @module subgroup-extractor
 */

import { extractEffect } from './effect-extractor.js';

/**
 * Standard subgroup variables and their categories
 */
export const SUBGROUP_TAXONOMY = {
    age: {
        patterns: [/\bage\b/i],
        categories: [
            { pattern: /<\s*65/, label: '<65 years' },
            { pattern: /[≥>=]\s*65/, label: '≥65 years' },
            { pattern: /<\s*75/, label: '<75 years' },
            { pattern: /[≥>=]\s*75/, label: '≥75 years' },
            { pattern: /65\s*[-–to]\s*74/, label: '65-74 years' }
        ]
    },
    sex: {
        patterns: [/\bsex\b/i, /\bgender\b/i],
        categories: [
            { pattern: /\bmale\b/i, label: 'Male' },
            { pattern: /\bfemale\b/i, label: 'Female' },
            { pattern: /\bmen\b/i, label: 'Male' },
            { pattern: /\bwomen\b/i, label: 'Female' }
        ]
    },
    diabetes: {
        patterns: [/\bdiabetes\b/i, /\bdiabetic\b/i, /\bDM\b/, /\bT2DM\b/],
        categories: [
            { pattern: /\byes\b/i, label: 'Yes' },
            { pattern: /\bno\b/i, label: 'No' },
            { pattern: /\bwith\s+diabetes\b/i, label: 'Yes' },
            { pattern: /\bwithout\s+diabetes\b/i, label: 'No' }
        ]
    },
    lvef: {
        patterns: [/\bLVEF\b/i, /\bejection\s+fraction\b/i, /\bEF\b/],
        categories: [
            { pattern: /[≤<]\s*30/, label: '≤30%' },
            { pattern: />?\s*30/, label: '>30%' },
            { pattern: /[≤<]\s*40/, label: '≤40%' },
            { pattern: /[≤<]\s*35/, label: '≤35%' },
            { pattern: /35\s*[-–to]\s*40/, label: '35-40%' },
            { pattern: /40\s*[-–to]\s*49/, label: '40-49%' },
            { pattern: /[≥>]\s*50/, label: '≥50%' }
        ]
    },
    egfr: {
        patterns: [/\beGFR\b/i, /\bestimated\s+GFR\b/i, /\bglomerular\s+filtration\b/i],
        categories: [
            { pattern: /<\s*30/, label: '<30' },
            { pattern: /30\s*[-–to]\s*<?\s*60/, label: '30-<60' },
            { pattern: /[≥>]\s*60/, label: '≥60' },
            { pattern: /<\s*45/, label: '<45' },
            { pattern: /45\s*[-–to]\s*<?\s*60/, label: '45-<60' },
            { pattern: /[≥>]\s*45/, label: '≥45' },
            { pattern: /<\s*60/, label: '<60' }
        ]
    },
    region: {
        patterns: [/\bregion\b/i, /\bgeograph/i],
        categories: [
            { pattern: /\bnorth\s*america\b/i, label: 'North America' },
            { pattern: /\beurope\b/i, label: 'Europe' },
            { pattern: /\basia\b/i, label: 'Asia' },
            { pattern: /\blatin\s*america\b/i, label: 'Latin America' },
            { pattern: /\basia[\s-]?pacific\b/i, label: 'Asia-Pacific' }
        ]
    },
    race: {
        patterns: [/\brace\b/i, /\bethnicity\b/i],
        categories: [
            { pattern: /\bwhite\b/i, label: 'White' },
            { pattern: /\bblack\b/i, label: 'Black' },
            { pattern: /\basian\b/i, label: 'Asian' },
            { pattern: /\bhispanic\b/i, label: 'Hispanic' }
        ]
    },
    nyha: {
        patterns: [/\bNYHA\b/i, /\bNew\s+York\s+Heart\b/i],
        categories: [
            { pattern: /\bII\b|class\s*2/i, label: 'Class II' },
            { pattern: /\bIII\b|class\s*3/i, label: 'Class III' },
            { pattern: /\bIV\b|class\s*4/i, label: 'Class IV' },
            { pattern: /II\s*[-–]\s*III/i, label: 'Class II-III' },
            { pattern: /III\s*[-–]\s*IV/i, label: 'Class III-IV' }
        ]
    },
    bmi: {
        patterns: [/\bBMI\b/i, /\bbody\s+mass\s+index\b/i],
        categories: [
            { pattern: /<\s*25/, label: '<25' },
            { pattern: /25\s*[-–to]\s*<?\s*30/, label: '25-<30' },
            { pattern: /[≥>]\s*30/, label: '≥30' },
            { pattern: /<\s*30/, label: '<30' }
        ]
    },
    hf_etiology: {
        patterns: [/\betiology\b/i, /\bischemic\b/i, /\bcause\s+of\s+heart\s+failure\b/i],
        categories: [
            { pattern: /\bischemic\b/i, label: 'Ischemic' },
            { pattern: /\bnon[-\s]?ischemic\b/i, label: 'Non-ischemic' },
            { pattern: /\bidiopathic\b/i, label: 'Idiopathic' }
        ]
    },
    af: {
        patterns: [/\batrial\s+fibrillation\b/i, /\bAF\b/, /\bAFib\b/i],
        categories: [
            { pattern: /\byes\b/i, label: 'Yes' },
            { pattern: /\bno\b/i, label: 'No' },
            { pattern: /\bwith\s+AF\b/i, label: 'Yes' },
            { pattern: /\bwithout\s+AF\b/i, label: 'No' }
        ]
    },
    ntprobnp: {
        patterns: [/\bNT[-\s]?proBNP\b/i, /\bBNP\b/],
        categories: [
            { pattern: /<\s*median/i, label: 'Below median' },
            { pattern: /[≥>]\s*median/i, label: 'At or above median' },
            { pattern: /<\s*1000/, label: '<1000' },
            { pattern: /[≥>]\s*1000/, label: '≥1000' }
        ]
    }
};

/**
 * Extract subgroup analyses from text/tables
 * @param {string|Object} source - Text or table data
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted subgroups
 */
export function extractSubgroups(source, options = {}) {
    const config = {
        extractInteractionP: options.extractInteractionP ?? true,
        ...options
    };

    let text;
    if (typeof source === 'string') {
        text = source;
    } else if (source.raw) {
        text = source.raw;
    } else {
        return { success: false, error: 'Invalid source' };
    }

    const subgroups = [];
    const lines = text.split('\n');

    // Find subgroup analysis section
    const subgroupSection = findSubgroupSection(text);

    // Parse each line for subgroup data
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Identify subgroup variable
        const variable = identifySubgroupVariable(line);

        if (variable) {
            // Extract categories and effects
            const analysis = parseSubgroupLine(line, variable);

            if (analysis) {
                // Look for interaction p-value (often on next line or in same line)
                if (config.extractInteractionP) {
                    analysis.interaction_p = extractInteractionP(line) ||
                        (lines[i + 1] ? extractInteractionP(lines[i + 1]) : null);
                }

                subgroups.push(analysis);
            }
        }
    }

    // Try to extract from forest plot format
    if (subgroups.length === 0) {
        const forestSubgroups = extractFromForestPlotFormat(text);
        subgroups.push(...forestSubgroups);
    }

    return {
        success: true,
        subgroups,
        count: subgroups.length,
        variables: [...new Set(subgroups.map(s => s.variable))]
    };
}

/**
 * Find subgroup analysis section in text
 * @param {string} text - Full text
 * @returns {string|null} Subgroup section
 */
function findSubgroupSection(text) {
    const patterns = [
        /subgroup\s+analysis/i,
        /prespecified\s+subgroups?/i,
        /subgroups?\s+of\s+interest/i,
        /forest\s+plot/i,
        /effect\s+according\s+to\s+subgroup/i
    ];

    for (const pattern of patterns) {
        const match = text.match(new RegExp(pattern.source + '[^]*?(?=\\n\\n|$)', 'i'));
        if (match) {
            return match[0];
        }
    }

    return null;
}

/**
 * Identify subgroup variable from line
 * @param {string} line - Line of text
 * @returns {Object|null} Identified variable
 */
function identifySubgroupVariable(line) {
    for (const [key, def] of Object.entries(SUBGROUP_TAXONOMY)) {
        for (const pattern of def.patterns) {
            if (pattern.test(line)) {
                return { key, definition: def };
            }
        }
    }
    return null;
}

/**
 * Parse subgroup line to extract categories and effects
 * @param {string} line - Line containing subgroup data
 * @param {Object} variable - Identified variable
 * @returns {Object|null} Parsed subgroup analysis
 */
function parseSubgroupLine(line, variable) {
    const categories = [];

    // Check each known category
    for (const cat of variable.definition.categories) {
        if (cat.pattern.test(line)) {
            // Try to extract effect for this category
            // Look for HR/effect near the category mention
            const parts = line.split(cat.pattern);
            if (parts.length > 1) {
                const effect = extractEffect(parts[1]);
                if (effect.success) {
                    categories.push({
                        label: cat.label,
                        effect: {
                            value: effect.value,
                            ci_lower: effect.ci_lower,
                            ci_upper: effect.ci_upper,
                            type: effect.effect_type
                        }
                    });
                }
            }
        }
    }

    if (categories.length === 0) {
        // Try generic parsing
        const genericCategories = parseGenericSubgroup(line);
        categories.push(...genericCategories);
    }

    if (categories.length === 0) {
        return null;
    }

    return {
        variable: variable.key,
        variable_label: formatVariableName(variable.key),
        categories,
        raw: line
    };
}

/**
 * Parse subgroup with generic patterns
 * @param {string} line - Line to parse
 * @returns {Array} Categories found
 */
function parseGenericSubgroup(line) {
    const categories = [];

    // Pattern: "Category: HR (CI)"
    const pattern = /([A-Za-z0-9\s<>=≤≥-]+?)\s*:\s*(\d+\.?\d*)\s*\(\s*(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)\s*\)/g;

    let match;
    while ((match = pattern.exec(line)) !== null) {
        categories.push({
            label: match[1].trim(),
            effect: {
                value: parseFloat(match[2]),
                ci_lower: parseFloat(match[3]),
                ci_upper: parseFloat(match[4])
            }
        });
    }

    return categories;
}

/**
 * Extract interaction p-value
 * @param {string} text - Text to search
 * @returns {Object|null} Interaction p-value
 */
function extractInteractionP(text) {
    const patterns = [
        /[Pp]\s*(?:for\s+)?interaction\s*[=<>]\s*(\d+\.?\d*)/i,
        /interaction\s+[Pp]\s*[=<>]\s*(\d+\.?\d*)/i,
        /[Pp]\s*int\s*[=<>]\s*(\d+\.?\d*)/i,
        /heterogeneity\s+[Pp]\s*[=<>]\s*(\d+\.?\d*)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const opMatch = text.match(/[Pp]\s*(?:for\s+)?(?:interaction|int|heterogeneity)\s*([=<>])/i);
            return {
                value: parseFloat(match[1]),
                operator: opMatch ? opMatch[1] : '=',
                significant: parseFloat(match[1]) < 0.05
            };
        }
    }

    return null;
}

/**
 * Extract subgroups from forest plot format
 * @param {string} text - Forest plot text
 * @returns {Array} Extracted subgroups
 */
function extractFromForestPlotFormat(text) {
    const subgroups = [];
    const lines = text.split('\n');

    let currentVariable = null;
    let currentCategories = [];

    for (const line of lines) {
        // Check if this is a variable header
        const varMatch = identifySubgroupVariable(line);

        if (varMatch && !/\d+\.\d+\s*\(/.test(line)) {
            // This is a variable header, not a data line
            if (currentVariable && currentCategories.length > 0) {
                subgroups.push({
                    variable: currentVariable.key,
                    variable_label: formatVariableName(currentVariable.key),
                    categories: currentCategories
                });
            }
            currentVariable = varMatch;
            currentCategories = [];
        } else if (currentVariable) {
            // This might be a category line
            const effect = extractEffect(line);
            if (effect.success) {
                // Try to extract category label
                let label = line.replace(/\d+\.?\d*\s*\(.*?\)/, '').trim();
                label = label.replace(/^\s*[-–•]\s*/, '');

                if (label) {
                    currentCategories.push({
                        label,
                        effect: {
                            value: effect.value,
                            ci_lower: effect.ci_lower,
                            ci_upper: effect.ci_upper
                        }
                    });
                }
            }
        }
    }

    // Don't forget the last variable
    if (currentVariable && currentCategories.length > 0) {
        subgroups.push({
            variable: currentVariable.key,
            variable_label: formatVariableName(currentVariable.key),
            categories: currentCategories
        });
    }

    return subgroups;
}

/**
 * Format variable key to readable name
 * @param {string} key - Variable key
 * @returns {string} Formatted name
 */
function formatVariableName(key) {
    const names = {
        age: 'Age',
        sex: 'Sex',
        diabetes: 'Diabetes',
        lvef: 'Left Ventricular Ejection Fraction',
        egfr: 'eGFR',
        region: 'Region',
        race: 'Race/Ethnicity',
        nyha: 'NYHA Class',
        bmi: 'Body Mass Index',
        hf_etiology: 'HF Etiology',
        af: 'Atrial Fibrillation',
        ntprobnp: 'NT-proBNP'
    };

    return names[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Analyze heterogeneity across subgroups
 * @param {Object} subgroupData - Extracted subgroup data
 * @returns {Object} Heterogeneity analysis
 */
export function analyzeSubgroupHeterogeneity(subgroupData) {
    const analysis = {
        significantInteractions: [],
        consistentEffects: [],
        summary: ''
    };

    for (const subgroup of subgroupData.subgroups) {
        if (subgroup.interaction_p?.significant) {
            analysis.significantInteractions.push({
                variable: subgroup.variable_label,
                p_value: subgroup.interaction_p.value
            });
        }

        // Check if effects are consistent across categories
        if (subgroup.categories.length >= 2) {
            const effects = subgroup.categories.map(c => c.effect?.value).filter(v => v != null);
            const allSameDirection = effects.every(e => e > 1) || effects.every(e => e < 1);

            if (allSameDirection) {
                analysis.consistentEffects.push(subgroup.variable_label);
            }
        }
    }

    if (analysis.significantInteractions.length === 0) {
        analysis.summary = 'No significant treatment-by-subgroup interactions were observed.';
    } else {
        const vars = analysis.significantInteractions.map(i => i.variable).join(', ');
        analysis.summary = `Significant interactions were observed for: ${vars}.`;
    }

    return analysis;
}

export default {
    SUBGROUP_TAXONOMY,
    extractSubgroups,
    analyzeSubgroupHeterogeneity,
    formatVariableName
};
