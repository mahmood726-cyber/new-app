/**
 * Baseline Extractor Module
 * Extracts baseline characteristics from Table 1
 *
 * @module baseline-extractor
 */

import { parseTable } from './table-parser.js';

/**
 * Standard baseline characteristics taxonomy
 */
export const BASELINE_TAXONOMY = {
    // Demographics
    age: {
        patterns: [/\bage\b/i, /\bage,?\s*(?:yr|years?|y)\b/i],
        type: 'continuous',
        unit: 'years'
    },
    sex_male: {
        patterns: [/\bmale\s*(?:sex)?\b/i, /\bmen\b/i, /\bsex.*male\b/i],
        type: 'categorical',
        is_percentage: true
    },
    sex_female: {
        patterns: [/\bfemale\s*(?:sex)?\b/i, /\bwomen\b/i, /\bsex.*female\b/i],
        type: 'categorical',
        is_percentage: true
    },
    race_white: {
        patterns: [/\bwhite\b/i, /\bcaucasian\b/i],
        type: 'categorical',
        is_percentage: true
    },
    race_black: {
        patterns: [/\bblack\b/i, /\bafrican[- ]?american\b/i],
        type: 'categorical',
        is_percentage: true
    },
    race_asian: {
        patterns: [/\basian\b/i],
        type: 'categorical',
        is_percentage: true
    },
    bmi: {
        patterns: [/\bbmi\b/i, /\bbody\s*mass\s*index\b/i],
        type: 'continuous',
        unit: 'kg/m²'
    },
    weight: {
        patterns: [/\bweight\b/i, /\bbody\s*weight\b/i],
        type: 'continuous',
        unit: 'kg'
    },

    // Cardiovascular
    blood_pressure_systolic: {
        patterns: [/\bsystolic\s*(?:blood\s*)?pressure\b/i, /\bsbp\b/i],
        type: 'continuous',
        unit: 'mmHg'
    },
    blood_pressure_diastolic: {
        patterns: [/\bdiastolic\s*(?:blood\s*)?pressure\b/i, /\bdbp\b/i],
        type: 'continuous',
        unit: 'mmHg'
    },
    heart_rate: {
        patterns: [/\bheart\s*rate\b/i, /\bpulse\b/i, /\bhr\s*\(?bpm\)?/i],
        type: 'continuous',
        unit: 'bpm'
    },
    lvef: {
        patterns: [/\blvef\b/i, /\bleft\s*ventricular\s*ejection\s*fraction\b/i, /\bejection\s*fraction\b/i, /\bef\b(?!g)/i],
        type: 'continuous',
        unit: '%'
    },

    // NYHA Class
    nyha_ii: {
        patterns: [/\bnyha\s*(?:class\s*)?ii\b/i, /\bclass\s*ii\b/i],
        type: 'categorical',
        is_percentage: true
    },
    nyha_iii: {
        patterns: [/\bnyha\s*(?:class\s*)?iii\b/i, /\bclass\s*iii\b/i],
        type: 'categorical',
        is_percentage: true
    },
    nyha_iv: {
        patterns: [/\bnyha\s*(?:class\s*)?iv\b/i, /\bclass\s*iv\b/i],
        type: 'categorical',
        is_percentage: true
    },

    // Comorbidities
    diabetes: {
        patterns: [/\bdiabetes\s*(?:mellitus)?\b/i, /\btype\s*2\s*diabetes\b/i, /\bt2dm\b/i],
        type: 'categorical',
        is_percentage: true
    },
    hypertension: {
        patterns: [/\bhypertension\b/i, /\bhigh\s*blood\s*pressure\b/i],
        type: 'categorical',
        is_percentage: true
    },
    atrial_fibrillation: {
        patterns: [/\batrial\s*fibrillation\b/i, /\baf\b(?!ter)/i, /\bafib\b/i],
        type: 'categorical',
        is_percentage: true
    },
    ischemic_etiology: {
        patterns: [/\bischemic\s*(?:heart\s*disease|etiology|cause)\b/i, /\bcad\b/i, /\bcoronary\s*artery\s*disease\b/i],
        type: 'categorical',
        is_percentage: true
    },
    prior_mi: {
        patterns: [/\bprior\s*(?:mi|myocardial\s*infarction)\b/i, /\bprevious\s*(?:mi|myocardial\s*infarction)\b/i],
        type: 'categorical',
        is_percentage: true
    },
    prior_stroke: {
        patterns: [/\bprior\s*stroke\b/i, /\bprevious\s*stroke\b/i, /\bhistory\s*of\s*stroke\b/i],
        type: 'categorical',
        is_percentage: true
    },
    ckd: {
        patterns: [/\bchronic\s*kidney\s*disease\b/i, /\bckd\b/i, /\brenal\s*insufficiency\b/i],
        type: 'categorical',
        is_percentage: true
    },

    // Lab values
    egfr: {
        patterns: [/\begfr\b/i, /\bestimated\s*gfr\b/i, /\bglomerular\s*filtration\s*rate\b/i],
        type: 'continuous',
        unit: 'mL/min/1.73m²'
    },
    creatinine: {
        patterns: [/\bcreatinine\b/i, /\bserum\s*creatinine\b/i],
        type: 'continuous',
        unit: 'mg/dL'
    },
    hemoglobin: {
        patterns: [/\bhemoglobin\b/i, /\bhb\b/i, /\bhgb\b/i],
        type: 'continuous',
        unit: 'g/dL'
    },
    hba1c: {
        patterns: [/\bhba1c\b/i, /\bglycated\s*hemoglobin\b/i, /\bhemoglobin\s*a1c\b/i],
        type: 'continuous',
        unit: '%'
    },
    ntprobnp: {
        patterns: [/\bnt[-\s]?probnp\b/i, /\bn[-\s]?terminal\s*pro[-\s]?b[-\s]?type\b/i],
        type: 'continuous',
        unit: 'pg/mL'
    },
    bnp: {
        patterns: [/\bbnp\b(?!ro)/i, /\bb[-\s]?type\s*natriuretic\s*peptide\b/i],
        type: 'continuous',
        unit: 'pg/mL'
    },

    // Medications
    ace_inhibitor: {
        patterns: [/\bace\s*inhibitor\b/i, /\bacei\b/i],
        type: 'categorical',
        is_percentage: true
    },
    arb: {
        patterns: [/\barb\b/i, /\bangiotensin\s*receptor\s*blocker\b/i],
        type: 'categorical',
        is_percentage: true
    },
    arni: {
        patterns: [/\barni\b/i, /\bsacubitril\b/i, /\bentresto\b/i],
        type: 'categorical',
        is_percentage: true
    },
    beta_blocker: {
        patterns: [/\bbeta[-\s]?blocker\b/i, /\bβ[-\s]?blocker\b/i],
        type: 'categorical',
        is_percentage: true
    },
    mra: {
        patterns: [/\bmra\b/i, /\bmineralocorticoid\s*receptor\s*antagonist\b/i, /\baldosterone\s*antagonist\b/i],
        type: 'categorical',
        is_percentage: true
    },
    diuretic: {
        patterns: [/\bdiuretic\b/i, /\bloop\s*diuretic\b/i],
        type: 'categorical',
        is_percentage: true
    },
    digoxin: {
        patterns: [/\bdigoxin\b/i, /\bdigitalis\b/i],
        type: 'categorical',
        is_percentage: true
    },

    // Devices
    icd: {
        patterns: [/\bicd\b/i, /\bimplantable\s*cardioverter\s*defibrillator\b/i],
        type: 'categorical',
        is_percentage: true
    },
    crt: {
        patterns: [/\bcrt\b/i, /\bcardiac\s*resynchronization\s*therapy\b/i],
        type: 'categorical',
        is_percentage: true
    },
    pacemaker: {
        patterns: [/\bpacemaker\b/i],
        type: 'categorical',
        is_percentage: true
    }
};

/**
 * Extract baseline characteristics from table
 * @param {Object} tableData - Raw or parsed table data
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted baseline characteristics
 */
export function extractBaseline(tableData, options = {}) {
    const config = {
        normalizeValues: options.normalizeValues ?? true,
        ...options
    };

    // Parse table if not already parsed
    let parsedTable = tableData;
    if (!tableData.headers && tableData.raw) {
        parsedTable = parseTable(tableData);
        if (!parsedTable.success) {
            return parsedTable;
        }
    }

    // Identify group columns
    const groups = identifyGroups(parsedTable);

    // Extract characteristics
    const characteristics = [];

    const dataRows = parsedTable.data || parsedTable.dataRows || [];

    for (const row of dataRows) {
        if (!row || row.length === 0) continue;

        const rowLabel = row[0]?.raw || row[0]?.toString() || '';

        // Match to taxonomy
        const matched = matchCharacteristic(rowLabel);

        if (matched) {
            const values = extractValuesFromRow(row, groups, matched.type);

            if (values) {
                characteristics.push({
                    key: matched.key,
                    label: rowLabel,
                    type: matched.type,
                    unit: matched.unit,
                    ...values
                });
            }
        } else if (isValidCharacteristic(rowLabel)) {
            // Unknown but valid characteristic
            const guessedType = guessValueType(row);
            const values = extractValuesFromRow(row, groups, guessedType);

            if (values) {
                characteristics.push({
                    key: normalizeKey(rowLabel),
                    label: rowLabel,
                    type: guessedType,
                    ...values,
                    unmapped: true
                });
            }
        }
    }

    // Extract sample sizes from header
    const sampleSizes = extractSampleSizes(parsedTable);

    return {
        success: true,
        groups,
        sample_sizes: sampleSizes,
        characteristics,
        count: characteristics.length
    };
}

/**
 * Identify treatment groups from table headers
 * @param {Object} parsedTable - Parsed table
 * @returns {Array} Group information
 */
function identifyGroups(parsedTable) {
    const groups = [];
    const headers = parsedTable.headers || [];

    if (headers.length === 0) return groups;

    const headerRow = headers[headers.length - 1]; // Use last header row

    for (let i = 1; i < headerRow.length; i++) {
        const header = headerRow[i];
        const headerText = header?.raw || header?.toString() || '';

        if (headerText) {
            const sampleMatch = headerText.match(/\(n\s*=\s*(\d+)\)/i) ||
                headerText.match(/n\s*=\s*(\d+)/i);

            groups.push({
                column: i,
                name: headerText.replace(/\(n\s*=\s*\d+\)/i, '').trim(),
                n: sampleMatch ? parseInt(sampleMatch[1]) : null
            });
        }
    }

    // Identify which is treatment vs control
    for (const group of groups) {
        const lower = group.name.toLowerCase();
        if (/placebo|control|standard|usual\s*care/.test(lower)) {
            group.role = 'control';
        } else {
            group.role = 'treatment';
        }
    }

    return groups;
}

/**
 * Match row label to taxonomy
 * @param {string} label - Row label
 * @returns {Object|null} Matched taxonomy entry
 */
function matchCharacteristic(label) {
    const cleanLabel = label.toLowerCase().trim();

    for (const [key, def] of Object.entries(BASELINE_TAXONOMY)) {
        for (const pattern of def.patterns) {
            if (pattern.test(cleanLabel)) {
                return {
                    key,
                    type: def.type,
                    unit: def.unit,
                    is_percentage: def.is_percentage
                };
            }
        }
    }

    return null;
}

/**
 * Check if row label is a valid characteristic
 * @param {string} label - Row label
 * @returns {boolean}
 */
function isValidCharacteristic(label) {
    if (!label || label.length < 3) return false;

    // Skip headers, totals, notes
    const skipPatterns = [
        /^characteristic/i,
        /^variable/i,
        /^total/i,
        /^note/i,
        /^abbrev/i,
        /^\d+$/,
        /^-+$/
    ];

    return !skipPatterns.some(p => p.test(label.trim()));
}

/**
 * Guess value type from row data
 * @param {Array} row - Table row
 * @returns {string} Guessed type
 */
function guessValueType(row) {
    for (let i = 1; i < row.length; i++) {
        const cell = row[i]?.raw || row[i]?.toString() || '';

        // Mean ± SD pattern
        if (/\d+\.?\d*\s*[±+\-]\s*\d+/.test(cell)) {
            return 'continuous';
        }

        // Median (IQR) pattern
        if (/\d+\.?\d*\s*[\(\[]\d+\.?\d*\s*[-–,]\s*\d+\.?\d*[\)\]]/.test(cell)) {
            return 'continuous';
        }

        // Percentage pattern
        if (/\d+\s*\(\s*\d+\.?\d*\s*%?\s*\)/.test(cell) || /\d+\.?\d*\s*%/.test(cell)) {
            return 'categorical';
        }
    }

    return 'unknown';
}

/**
 * Extract values from table row
 * @param {Array} row - Table row
 * @param {Array} groups - Group definitions
 * @param {string} type - Value type
 * @returns {Object|null} Extracted values
 */
function extractValuesFromRow(row, groups, type) {
    const values = {};

    for (const group of groups) {
        if (group.column >= row.length) continue;

        const cell = row[group.column];
        const cellText = cell?.raw || cell?.toString() || '';

        if (!cellText || cellText.trim() === '' || /^(NR|NA|—|-|–)$/i.test(cellText.trim())) {
            values[group.role] = null;
            continue;
        }

        if (type === 'continuous') {
            values[group.role] = parseContinuousValue(cellText);
        } else if (type === 'categorical') {
            values[group.role] = parseCategoricalValue(cellText);
        } else {
            // Try both
            const cont = parseContinuousValue(cellText);
            const cat = parseCategoricalValue(cellText);

            values[group.role] = cont || cat || { raw: cellText };
        }
    }

    // Check if we got any values
    const hasValues = Object.values(values).some(v => v !== null);
    return hasValues ? values : null;
}

/**
 * Parse continuous value (mean±SD, median (IQR))
 * @param {string} text - Cell text
 * @returns {Object|null} Parsed value
 */
function parseContinuousValue(text) {
    // Mean ± SD: "67.5 ± 10.8" or "67.5 (10.8)"
    const meanSDPattern = /(\d+\.?\d*)\s*([±+\-])\s*(\d+\.?\d*)/;
    const meanSDMatch = text.match(meanSDPattern);

    if (meanSDMatch) {
        return {
            mean: parseFloat(meanSDMatch[1]),
            sd: parseFloat(meanSDMatch[3]),
            type: 'mean_sd'
        };
    }

    // Median (IQR): "67 (58-76)" or "67 [58, 76]"
    const medianIQRPattern = /(\d+\.?\d*)\s*[\(\[](\d+\.?\d*)\s*[-–,]\s*(\d+\.?\d*)[\)\]]/;
    const medianIQRMatch = text.match(medianIQRPattern);

    if (medianIQRMatch) {
        return {
            median: parseFloat(medianIQRMatch[1]),
            q1: parseFloat(medianIQRMatch[2]),
            q3: parseFloat(medianIQRMatch[3]),
            type: 'median_iqr'
        };
    }

    // Plain number
    const numberPattern = /^(\d+\.?\d*)$/;
    const numberMatch = text.trim().match(numberPattern);

    if (numberMatch) {
        return {
            value: parseFloat(numberMatch[1]),
            type: 'single'
        };
    }

    return null;
}

/**
 * Parse categorical value (n (%), %)
 * @param {string} text - Cell text
 * @returns {Object|null} Parsed value
 */
function parseCategoricalValue(text) {
    // N (X%) pattern: "1543 (65.3%)" or "1543 (65.3)"
    const nPctPattern = /(\d+)\s*\(\s*(\d+\.?\d*)\s*%?\s*\)/;
    const nPctMatch = text.match(nPctPattern);

    if (nPctMatch) {
        return {
            n: parseInt(nPctMatch[1]),
            percentage: parseFloat(nPctMatch[2]),
            type: 'n_percentage'
        };
    }

    // Percentage only: "65.3%" or "65.3"
    const pctPattern = /^(\d+\.?\d*)\s*%?$/;
    const pctMatch = text.trim().match(pctPattern);

    if (pctMatch) {
        const value = parseFloat(pctMatch[1]);
        // If value > 100, probably a count not percentage
        if (value <= 100) {
            return {
                percentage: value,
                type: 'percentage'
            };
        }
    }

    // Plain count: just a number
    const countPattern = /^(\d+)$/;
    const countMatch = text.trim().match(countPattern);

    if (countMatch) {
        return {
            n: parseInt(countMatch[1]),
            type: 'count'
        };
    }

    return null;
}

/**
 * Extract sample sizes from table headers
 * @param {Object} parsedTable - Parsed table
 * @returns {Object} Sample sizes
 */
function extractSampleSizes(parsedTable) {
    const sizes = { total: null, treatment: null, control: null };
    const headers = parsedTable.headers || [];

    for (const row of headers) {
        for (const cell of row) {
            const text = cell?.raw || cell?.toString() || '';

            const sizeMatch = text.match(/\(n\s*=\s*(\d+)\)/i) ||
                text.match(/n\s*=\s*(\d+)/i);

            if (sizeMatch) {
                const n = parseInt(sizeMatch[1]);

                if (/placebo|control/i.test(text)) {
                    sizes.control = n;
                } else if (text.length > 0) {
                    sizes.treatment = n;
                }
            }
        }
    }

    if (sizes.treatment && sizes.control) {
        sizes.total = sizes.treatment + sizes.control;
    }

    return sizes;
}

/**
 * Normalize characteristic key
 * @param {string} label - Raw label
 * @returns {string} Normalized key
 */
function normalizeKey(label) {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50);
}

/**
 * Compare baseline characteristics between groups
 * @param {Object} baselineData - Extracted baseline data
 * @returns {Object} Comparison summary
 */
export function compareGroups(baselineData) {
    const summary = {
        balanced: [],
        imbalanced: [],
        missing: []
    };

    for (const char of baselineData.characteristics) {
        const treatment = char.treatment;
        const control = char.control;

        if (!treatment || !control) {
            summary.missing.push(char.label);
            continue;
        }

        // Compare based on type
        if (char.type === 'continuous') {
            const diff = Math.abs((treatment.mean || 0) - (control.mean || 0));
            const sd = Math.max(treatment.sd || 1, control.sd || 1);
            const smd = diff / sd; // Standardized mean difference

            if (smd < 0.1) {
                summary.balanced.push({ ...char, smd });
            } else {
                summary.imbalanced.push({ ...char, smd });
            }
        } else if (char.type === 'categorical') {
            const pct1 = treatment.percentage || 0;
            const pct2 = control.percentage || 0;
            const diff = Math.abs(pct1 - pct2);

            if (diff < 5) {
                summary.balanced.push({ ...char, difference: diff });
            } else {
                summary.imbalanced.push({ ...char, difference: diff });
            }
        }
    }

    return summary;
}

export default {
    BASELINE_TAXONOMY,
    extractBaseline,
    compareGroups
};
