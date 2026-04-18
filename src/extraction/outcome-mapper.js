/**
 * Outcome Mapper Module
 * Maps extracted outcome labels to standardized taxonomy
 *
 * @module outcome-mapper
 */

/**
 * Outcome taxonomy with categories and patterns
 */
export const OUTCOME_TAXONOMY = {
    // Primary Mortality Outcomes
    all_cause_mortality: {
        category: 'mortality',
        priority: 1,
        patterns: [
            /\ball[- ]?cause\s+(death|mortality)\b/i,
            /\bdeath\s+from\s+any\s+cause\b/i,
            /\btotal\s+(death|mortality)\b/i,
            /\boverall\s+(death|mortality)\b/i,
            /\bmortality\s*\(all[- ]?cause\)/i,
            /\bdeath\s*\(any\s+cause\)/i
        ],
        aliases: ['ACM', 'all-cause death', 'total death', 'death any cause']
    },

    cv_mortality: {
        category: 'mortality',
        priority: 2,
        patterns: [
            /\bcardiovascular\s+(death|mortality)\b/i,
            /\bcv\s+(death|mortality)\b/i,
            /\bdeath\s+from\s+cardiovascular\s+causes?\b/i,
            /\bcardiac\s+(death|mortality)\b/i,
            /\bheart\s+(death|mortality)\b/i
        ],
        aliases: ['CV death', 'cardiac death', 'CVD']
    },

    sudden_death: {
        category: 'mortality',
        priority: 3,
        patterns: [
            /\bsudden\s+(cardiac\s+)?(death|arrest)\b/i,
            /\bscd\b/i,
            /\barrhythmic\s+death\b/i
        ],
        aliases: ['SCD', 'sudden cardiac death']
    },

    // Hospitalization Outcomes
    hf_hospitalization: {
        category: 'hospitalization',
        priority: 1,
        patterns: [
            /\bheart\s+failure\s+hospitalization\b/i,
            /\bhf\s+hospitalization\b/i,
            /\bhhf\b/i,
            /\bhospitalization\s+for\s+(worsening\s+)?heart\s+failure\b/i,
            /\bhf\s+admission\b/i,
            /\badmission\s+for\s+heart\s+failure\b/i,
            /\bworsening\s+hf\s+requiring\s+hospitalization\b/i
        ],
        aliases: ['HHF', 'HF hospitalization', 'HFH']
    },

    cv_hospitalization: {
        category: 'hospitalization',
        priority: 2,
        patterns: [
            /\bcardiovascular\s+hospitalization\b/i,
            /\bcv\s+hospitalization\b/i,
            /\bhospitalization\s+for\s+cardiovascular\b/i
        ],
        aliases: ['CV hospitalization']
    },

    all_cause_hospitalization: {
        category: 'hospitalization',
        priority: 3,
        patterns: [
            /\ball[- ]?cause\s+hospitalization\b/i,
            /\btotal\s+hospitalization\b/i,
            /\bany\s+hospitalization\b/i
        ],
        aliases: ['any hospitalization']
    },

    // Composite Endpoints
    composite_cv_death_hfh: {
        category: 'composite',
        priority: 1,
        patterns: [
            /\bcv\s+(death|mortality)\s+(or|and)\s+(hhf|hf\s+hospitalization)\b/i,
            /\b(hhf|hf\s+hospitalization)\s+(or|and)\s+cv\s+(death|mortality)\b/i,
            /\bcomposite\s+of\s+cv\s+death\s+(or|and)\s+hf/i,
            /\bprimary\s+(composite\s+)?(outcome|endpoint)\b/i,
            /\bworsening\s+hf\s+event\s+or\s+cv\s+death\b/i
        ],
        aliases: ['primary composite', 'CV death/HHF']
    },

    composite_cv_death_mi_stroke: {
        category: 'composite',
        priority: 2,
        patterns: [
            /\bmace\b/i,
            /\bmajor\s+adverse\s+cardiovascular\s+events?\b/i,
            /\bcv\s+death.*mi.*stroke\b/i,
            /\b3[- ]?point\s+mace\b/i
        ],
        aliases: ['MACE', '3-point MACE', 'major adverse CV events']
    },

    composite_cv_death_mi_stroke_ua: {
        category: 'composite',
        priority: 3,
        patterns: [
            /\b4[- ]?point\s+mace\b/i,
            /\bcv\s+death.*mi.*stroke.*unstable\s+angina\b/i,
            /\bexpanded\s+mace\b/i
        ],
        aliases: ['4-point MACE', 'expanded MACE']
    },

    // Cardiovascular Events
    myocardial_infarction: {
        category: 'cv_events',
        priority: 1,
        patterns: [
            /\bmyocardial\s+infarction\b/i,
            /\bmi\b(?!\s*\=)/i,  // MI but not "MI=" (as in percentage)
            /\bheart\s+attack\b/i,
            /\bacute\s+coronary\s+syndrome\b/i,
            /\bacs\b/i
        ],
        aliases: ['MI', 'heart attack', 'ACS']
    },

    stroke: {
        category: 'cv_events',
        priority: 2,
        patterns: [
            /\bstroke\b/i,
            /\bcerebrovascular\s+accident\b/i,
            /\bcva\b/i,
            /\bischemic\s+stroke\b/i,
            /\bhemorrhagic\s+stroke\b/i,
            /\btia\b/i
        ],
        aliases: ['CVA', 'TIA', 'cerebrovascular event']
    },

    // Renal Outcomes
    renal_composite: {
        category: 'renal',
        priority: 1,
        patterns: [
            /\brenal\s+composite\b/i,
            /\bkidney\s+composite\b/i,
            /\bckd\s+progression\b/i,
            /\b(sustained\s+)?(?:decline|reduction)\s+(?:in\s+)?egfr\b/i,
            /\bworsening\s+(renal|kidney)\s+function\b/i,
            /\bdoubling\s+of\s+(?:serum\s+)?creatinine\b/i
        ],
        aliases: ['renal endpoint', 'kidney outcome']
    },

    esrd: {
        category: 'renal',
        priority: 2,
        patterns: [
            /\bESRD\b/i,
            /\bend[- ]?stage\s+(renal|kidney)\s+disease\b/i,
            /\brenal\s+replacement\s+therapy\b/i,
            /\bdialysis\b/i,
            /\bkidney\s+transplant\b/i
        ],
        aliases: ['ESRD', 'dialysis', 'renal failure']
    },

    egfr_slope: {
        category: 'renal',
        priority: 3,
        patterns: [
            /\begfr\s+slope\b/i,
            /\brate\s+of\s+(change|decline)\s+(?:in\s+)?egfr\b/i,
            /\begfr\s+(?:rate|change)\b/i
        ],
        aliases: ['eGFR decline rate']
    },

    // Quality of Life
    kccq: {
        category: 'qol',
        priority: 1,
        patterns: [
            /\bkccq\b/i,
            /\bkansas\s+city\s+cardiomyopathy\b/i,
            /\bkccq[- ]?(?:os|tss|css|pl)\b/i
        ],
        aliases: ['KCCQ', 'Kansas City Cardiomyopathy Questionnaire']
    },

    sf36: {
        category: 'qol',
        priority: 2,
        patterns: [
            /\bsf[- ]?36\b/i,
            /\bshort\s+form[- ]?36\b/i
        ],
        aliases: ['SF-36']
    },

    eq5d: {
        category: 'qol',
        priority: 3,
        patterns: [
            /\beq[- ]?5d\b/i,
            /\beuroqol\b/i
        ],
        aliases: ['EQ-5D', 'EuroQol']
    },

    // Safety Outcomes
    serious_adverse_events: {
        category: 'safety',
        priority: 1,
        patterns: [
            /\bserious\s+adverse\s+events?\b/i,
            /\bsae\b/i,
            /\bsevere\s+adverse\s+events?\b/i
        ],
        aliases: ['SAE', 'serious AE']
    },

    discontinuation: {
        category: 'safety',
        priority: 2,
        patterns: [
            /\bdiscontinuation\b/i,
            /\bwithdrawal\b/i,
            /\bstopp(ed|ing)\s+(?:study\s+)?(?:drug|treatment|medication)\b/i,
            /\bpermanent\s+discontinuation\b/i
        ],
        aliases: ['drug discontinuation', 'treatment discontinuation']
    },

    hypotension: {
        category: 'safety',
        priority: 3,
        patterns: [
            /\bhypotension\b/i,
            /\blow\s+blood\s+pressure\b/i,
            /\bsymptomatic\s+hypotension\b/i
        ],
        aliases: ['low BP']
    },

    acute_kidney_injury: {
        category: 'safety',
        priority: 4,
        patterns: [
            /\bacute\s+kidney\s+injury\b/i,
            /\baki\b/i,
            /\bacute\s+renal\s+(failure|injury)\b/i
        ],
        aliases: ['AKI', 'acute renal injury']
    },

    dka: {
        category: 'safety',
        priority: 5,
        patterns: [
            /\bdiabetic\s+ketoacidosis\b/i,
            /\bdka\b/i,
            /\bketoacidosis\b/i
        ],
        aliases: ['DKA']
    },

    hypoglycemia: {
        category: 'safety',
        priority: 6,
        patterns: [
            /\bhypoglyc[ae]mia\b/i,
            /\blow\s+blood\s+(?:sugar|glucose)\b/i,
            /\bsevere\s+hypoglyc[ae]mia\b/i
        ],
        aliases: ['low blood sugar']
    },

    amputation: {
        category: 'safety',
        priority: 7,
        patterns: [
            /\bamputation\b/i,
            /\blower[- ]?limb\s+amputation\b/i
        ],
        aliases: ['limb amputation']
    },

    fracture: {
        category: 'safety',
        priority: 8,
        patterns: [
            /\bfracture\b/i,
            /\bbone\s+fracture\b/i
        ],
        aliases: ['bone fracture']
    },

    genital_infection: {
        category: 'safety',
        priority: 9,
        patterns: [
            /\bgenital\s+(?:mycotic\s+)?infection\b/i,
            /\bgmi\b/i,
            /\byeast\s+infection\b/i,
            /\bfournier'?s?\s+gangrene\b/i
        ],
        aliases: ['GMI', 'genital mycotic infection']
    },

    uti: {
        category: 'safety',
        priority: 10,
        patterns: [
            /\burinary\s+tract\s+infection\b/i,
            /\buti\b/i
        ],
        aliases: ['UTI']
    }
};

/**
 * Map an outcome label to standardized taxonomy
 * @param {string} label - Raw outcome label from paper
 * @param {Object} options - Mapping options
 * @returns {Object} Mapping result
 */
export function mapOutcome(label, options = {}) {
    if (!label || typeof label !== 'string') {
        return {
            success: false,
            error: 'Invalid label',
            mapped: null
        };
    }

    const cleanLabel = label.trim().toLowerCase();
    const matches = [];

    // Check each taxonomy entry
    for (const [key, taxonomy] of Object.entries(OUTCOME_TAXONOMY)) {
        for (const pattern of taxonomy.patterns) {
            if (pattern.test(cleanLabel)) {
                matches.push({
                    key,
                    category: taxonomy.category,
                    priority: taxonomy.priority,
                    confidence: calculateMatchConfidence(label, pattern),
                    matchedPattern: pattern.toString()
                });
                break; // Only count first match per taxonomy entry
            }
        }

        // Also check aliases
        for (const alias of taxonomy.aliases) {
            if (cleanLabel.includes(alias.toLowerCase())) {
                const existing = matches.find(m => m.key === key);
                if (!existing) {
                    matches.push({
                        key,
                        category: taxonomy.category,
                        priority: taxonomy.priority,
                        confidence: 0.85,
                        matchedAlias: alias
                    });
                }
            }
        }
    }

    if (matches.length === 0) {
        return {
            success: true,
            mapped: null,
            original: label,
            suggestedCategory: guessCategory(label),
            confidence: 0
        };
    }

    // Sort by confidence and priority
    matches.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.priority - b.priority;
    });

    const best = matches[0];

    return {
        success: true,
        mapped: best.key,
        category: best.category,
        original: label,
        confidence: best.confidence,
        alternatives: matches.slice(1).map(m => m.key)
    };
}

/**
 * Calculate confidence of pattern match
 * @param {string} label - Original label
 * @param {RegExp} pattern - Matched pattern
 * @returns {number} Confidence 0-1
 */
function calculateMatchConfidence(label, pattern) {
    const match = label.match(pattern);
    if (!match) return 0;

    // Confidence based on match length relative to label length
    const matchLength = match[0].length;
    const labelLength = label.length;
    const coverage = matchLength / labelLength;

    // Higher confidence for more complete matches
    if (coverage > 0.8) return 0.98;
    if (coverage > 0.5) return 0.92;
    if (coverage > 0.3) return 0.85;
    return 0.75;
}

/**
 * Guess outcome category from label
 * @param {string} label - Outcome label
 * @returns {string} Guessed category
 */
function guessCategory(label) {
    const lower = label.toLowerCase();

    if (/death|mortality|fatal|died/.test(lower)) return 'mortality';
    if (/hospital|admission|readmission/.test(lower)) return 'hospitalization';
    if (/composite|combined|primary\s+endpoint/.test(lower)) return 'composite';
    if (/renal|kidney|egfr|creatinine/.test(lower)) return 'renal';
    if (/quality|qol|kccq|sf-?36|eq-?5d/.test(lower)) return 'qol';
    if (/adverse|safety|side\s+effect|tolerability/.test(lower)) return 'safety';
    if (/stroke|mi|myocardial|coronary|angina/.test(lower)) return 'cv_events';

    return 'unknown';
}

/**
 * Map multiple outcomes at once
 * @param {Array<string>} labels - Array of outcome labels
 * @returns {Array<Object>} Array of mapping results
 */
export function mapOutcomes(labels) {
    return labels.map(label => mapOutcome(label));
}

/**
 * Get all outcomes in a category
 * @param {string} category - Category name
 * @returns {Array<Object>} Outcomes in category
 */
export function getOutcomesByCategory(category) {
    return Object.entries(OUTCOME_TAXONOMY)
        .filter(([_, tax]) => tax.category === category)
        .map(([key, tax]) => ({
            key,
            ...tax
        }))
        .sort((a, b) => a.priority - b.priority);
}

/**
 * Get available categories
 * @returns {Array<string>} Category names
 */
export function getCategories() {
    const categories = new Set();
    for (const tax of Object.values(OUTCOME_TAXONOMY)) {
        categories.add(tax.category);
    }
    return [...categories];
}

/**
 * Check if outcome is a composite endpoint
 * @param {string} key - Outcome key
 * @returns {boolean}
 */
export function isComposite(key) {
    const taxonomy = OUTCOME_TAXONOMY[key];
    return taxonomy?.category === 'composite';
}

/**
 * Get components of a composite outcome
 * @param {string} key - Composite outcome key
 * @returns {Array<string>} Component outcome keys
 */
export function getCompositeComponents(key) {
    const compositeMap = {
        'composite_cv_death_hfh': ['cv_mortality', 'hf_hospitalization'],
        'composite_cv_death_mi_stroke': ['cv_mortality', 'myocardial_infarction', 'stroke'],
        'composite_cv_death_mi_stroke_ua': ['cv_mortality', 'myocardial_infarction', 'stroke', 'unstable_angina']
    };

    return compositeMap[key] || [];
}

/**
 * Parse composite outcome definition from text
 * @param {string} text - Definition text (e.g., "CV death, HF hospitalization, or worsening HF")
 * @returns {Object} Parsed components
 */
export function parseCompositeDefinition(text) {
    const components = [];
    const separators = /\s*(?:,|;|\bor\b|\band\b)\s*/i;
    const parts = text.split(separators).map(p => p.trim()).filter(p => p.length > 0);

    for (const part of parts) {
        const mapped = mapOutcome(part);
        if (mapped.mapped) {
            components.push(mapped.mapped);
        } else {
            components.push({ unmapped: part });
        }
    }

    return {
        original: text,
        components,
        mappedCount: components.filter(c => typeof c === 'string').length,
        unmappedCount: components.filter(c => typeof c === 'object').length
    };
}

/**
 * Suggest standardized name for outcome
 * @param {string} key - Outcome key
 * @returns {string} Standardized name
 */
export function getStandardName(key) {
    const names = {
        'all_cause_mortality': 'All-Cause Mortality',
        'cv_mortality': 'Cardiovascular Mortality',
        'sudden_death': 'Sudden Cardiac Death',
        'hf_hospitalization': 'Heart Failure Hospitalization',
        'cv_hospitalization': 'Cardiovascular Hospitalization',
        'all_cause_hospitalization': 'All-Cause Hospitalization',
        'composite_cv_death_hfh': 'CV Death or HF Hospitalization',
        'composite_cv_death_mi_stroke': 'MACE (CV Death, MI, or Stroke)',
        'composite_cv_death_mi_stroke_ua': 'Expanded MACE',
        'myocardial_infarction': 'Myocardial Infarction',
        'stroke': 'Stroke',
        'renal_composite': 'Renal Composite Endpoint',
        'esrd': 'End-Stage Renal Disease',
        'egfr_slope': 'eGFR Slope',
        'kccq': 'KCCQ Score',
        'sf36': 'SF-36',
        'eq5d': 'EQ-5D',
        'serious_adverse_events': 'Serious Adverse Events',
        'discontinuation': 'Treatment Discontinuation',
        'hypotension': 'Hypotension',
        'acute_kidney_injury': 'Acute Kidney Injury',
        'dka': 'Diabetic Ketoacidosis',
        'hypoglycemia': 'Hypoglycemia',
        'amputation': 'Amputation',
        'fracture': 'Fracture',
        'genital_infection': 'Genital Infection',
        'uti': 'Urinary Tract Infection'
    };

    return names[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default {
    OUTCOME_TAXONOMY,
    mapOutcome,
    mapOutcomes,
    getOutcomesByCategory,
    getCategories,
    isComposite,
    getCompositeComponents,
    parseCompositeDefinition,
    getStandardName
};
