/**
 * Benchmark Datasets from R Packages
 * For validation against metafor, meta, netmeta, and mada
 */

// ============================================================
// METAFOR PACKAGE DATASETS
// ============================================================

/**
 * dat.bcg from metafor
 * BCG vaccine for preventing tuberculosis
 * Colditz et al. (1994)
 */
export const datBCG = {
    name: 'dat.bcg',
    description: 'BCG vaccine trials for tuberculosis prevention',
    source: 'metafor',
    reference: 'Colditz et al. (1994). JAMA 271:698-702',
    effectType: 'RR',
    studies: [
        { trial: 1, author: 'Aronson', year: 1948, tpos: 4, tneg: 119, cpos: 11, cneg: 128, ablat: 44, alloc: 'random' },
        { trial: 2, author: 'Ferguson & Simes', year: 1949, tpos: 6, tneg: 300, cpos: 29, cneg: 274, ablat: 55, alloc: 'random' },
        { trial: 3, author: 'Rosenthal et al', year: 1960, tpos: 3, tneg: 228, cpos: 11, cneg: 209, ablat: 42, alloc: 'random' },
        { trial: 4, author: 'Hart & Sutherland', year: 1977, tpos: 62, tneg: 13536, cpos: 248, cneg: 12619, ablat: 52, alloc: 'random' },
        { trial: 5, author: 'Frimodt-Moller et al', year: 1973, tpos: 33, tneg: 5036, cpos: 47, cneg: 5761, ablat: 13, alloc: 'alternate' },
        { trial: 6, author: 'Stein & Aronson', year: 1953, tpos: 180, tneg: 1361, cpos: 372, cneg: 1079, ablat: 44, alloc: 'alternate' },
        { trial: 7, author: 'Vandiviere et al', year: 1973, tpos: 8, tneg: 2537, cpos: 10, cneg: 619, ablat: 19, alloc: 'random' },
        { trial: 8, author: 'TPT Madras', year: 1980, tpos: 505, tneg: 87886, cpos: 499, cneg: 87892, ablat: 13, alloc: 'random' },
        { trial: 9, author: 'Coetzee & Berjak', year: 1968, tpos: 29, tneg: 7470, cpos: 45, cneg: 7232, ablat: 27, alloc: 'random' },
        { trial: 10, author: 'Rosenthal et al', year: 1961, tpos: 17, tneg: 1699, cpos: 65, cneg: 1600, ablat: 42, alloc: 'random' },
        { trial: 11, author: 'Comstock et al', year: 1974, tpos: 186, tneg: 50448, cpos: 141, cneg: 27197, ablat: 18, alloc: 'systematic' },
        { trial: 12, author: 'Comstock & Webster', year: 1969, tpos: 5, tneg: 2493, cpos: 3, cneg: 2338, ablat: 33, alloc: 'systematic' },
        { trial: 13, author: 'Comstock et al', year: 1976, tpos: 27, tneg: 16886, cpos: 29, cneg: 17825, ablat: 33, alloc: 'systematic' }
    ],
    expectedResults: {
        method: 'DL',
        pooledLogRR: -0.7145,
        tau2: 0.3088,
        I2: 92.1,
        Q: 152.23,
        k: 13
    }
};

/**
 * dat.senn2013 from metafor
 * Glucose lowering drugs for type 2 diabetes (Network Meta-Analysis)
 */
export const datSenn2013 = {
    name: 'dat.senn2013',
    description: 'Anti-diabetic drugs network meta-analysis',
    source: 'metafor',
    reference: 'Senn et al. (2013). Res Synth Methods 4:310-323',
    effectType: 'MD',
    studies: [
        { study: 'Willms 1999', treat1: 'acarb', treat2: 'plac', y1i: -1.06, y2i: -0.09, sd1i: 2.25, sd2i: 2.25, n1i: 34, n2i: 33 },
        { study: 'Wolffenbuttel 1999', treat1: 'acarb', treat2: 'plac', y1i: -0.46, y2i: 0.35, sd1i: 1.25, sd2i: 1.25, n1i: 65, n2i: 64 },
        { study: 'Holman 1999', treat1: 'metf', treat2: 'plac', y1i: -0.97, y2i: 0.24, sd1i: 1.90, sd2i: 1.90, n1i: 30, n2i: 20 },
        { study: 'Goldstein 2003', treat1: 'piog', treat2: 'plac', y1i: -0.87, y2i: 0.03, sd1i: 1.30, sd2i: 1.30, n1i: 61, n2i: 63 },
        { study: 'Yang 2002', treat1: 'rosi', treat2: 'plac', y1i: -0.98, y2i: 0.22, sd1i: 1.05, sd2i: 1.05, n1i: 102, n2i: 102 },
        { study: 'Rosenstock 2005', treat1: 'sita', treat2: 'plac', y1i: -0.59, y2i: 0.25, sd1i: 1.20, sd2i: 1.20, n1i: 66, n2i: 66 },
        { study: 'Scott 2007', treat1: 'sulf', treat2: 'plac', y1i: -1.12, y2i: 0.09, sd1i: 1.40, sd2i: 1.40, n1i: 65, n2i: 63 }
    ]
};

/**
 * dat.raudenbush1985 from metafor
 * Teacher expectancy effects on student IQ
 */
export const datRaudenbush1985 = {
    name: 'dat.raudenbush1985',
    description: 'Teacher expectancy effects on pupil IQ',
    source: 'metafor',
    reference: 'Raudenbush (1984). J Educ Psychol 76:85-97',
    effectType: 'SMD',
    studies: [
        { study: 1, author: 'Rosenthal et al', year: 1968, weeks: 1, setting: 'high_track', yi: 0.03, vi: 0.0066 },
        { study: 2, author: 'Rosenthal et al', year: 1968, weeks: 2, setting: 'low_track', yi: 0.12, vi: 0.0330 },
        { study: 3, author: 'Conn et al', year: 1968, weeks: 2, setting: 'normal', yi: -0.14, vi: 0.0048 },
        { study: 4, author: 'Jose & Cody', year: 1971, weeks: 3, setting: 'normal', yi: 1.18, vi: 0.0400 },
        { study: 5, author: 'Pellegrini & Hicks', year: 1972, weeks: 0, setting: 'normal', yi: 0.26, vi: 0.0450 },
        { study: 6, author: 'Evans & Rosenthal', year: 1969, weeks: 3, setting: 'normal', yi: -0.06, vi: 0.0163 },
        { study: 7, author: 'Fielder et al', year: 1971, weeks: 3, setting: 'normal', yi: -0.02, vi: 0.0033 },
        { study: 8, author: 'Claiborn', year: 1969, weeks: 0, setting: 'normal', yi: -0.32, vi: 0.0350 },
        { study: 9, author: 'Kester', year: 1969, weeks: 1, setting: 'normal', yi: 0.27, vi: 0.0570 },
        { study: 10, author: 'Maxwell', year: 1970, weeks: 0, setting: 'normal', yi: 0.80, vi: 0.1109 },
        { study: 11, author: 'Carter', year: 1970, weeks: 0, setting: 'normal', yi: 0.54, vi: 0.0615 },
        { study: 12, author: 'Flowers', year: 1966, weeks: 0, setting: 'normal', yi: 0.18, vi: 0.0440 },
        { study: 13, author: 'Keshock', year: 1970, weeks: 1, setting: 'normal', yi: -0.02, vi: 0.0106 },
        { study: 14, author: 'Henrikson', year: 1970, weeks: 2, setting: 'normal', yi: 0.23, vi: 0.0284 },
        { study: 15, author: 'Fine', year: 1972, weeks: 1, setting: 'normal', yi: -0.18, vi: 0.0330 },
        { study: 16, author: 'Greiger', year: 1970, weeks: 3, setting: 'normal', yi: -0.06, vi: 0.0280 },
        { study: 17, author: 'Rosenthal et al', year: 1974, weeks: 0, setting: 'normal', yi: 0.30, vi: 0.0340 },
        { study: 18, author: 'Fleming & Anttonen', year: 1971, weeks: 2, setting: 'normal', yi: 0.07, vi: 0.0028 },
        { study: 19, author: 'Ginsburg', year: 1970, weeks: 1, setting: 'normal', yi: -0.07, vi: 0.0135 }
    ],
    expectedResults: {
        method: 'REML',
        pooledSMD: 0.084,
        tau2: 0.019,
        I2: 44.7
    }
};

// ============================================================
// MADA PACKAGE DATASETS (Diagnostic Test Accuracy)
// ============================================================

/**
 * AuditC from mada package
 * AUDIT-C for alcohol misuse screening
 */
export const AuditC = {
    name: 'AuditC',
    description: 'AUDIT-C for hazardous drinking detection',
    source: 'mada',
    reference: 'Kriston et al. (2008)',
    type: 'DTA',
    studies: [
        { study: 'Aertgeerts 2000', TP: 224, FP: 168, FN: 12, TN: 91, cutoff: 5 },
        { study: 'Bradley 2003', TP: 62, FP: 81, FN: 18, TN: 258, cutoff: 3 },
        { study: 'Bush 1998', TP: 148, FP: 69, FN: 18, TN: 167, cutoff: 3 },
        { study: 'Chung 2000', TP: 31, FP: 73, FN: 1, TN: 117, cutoff: 2 },
        { study: 'Dawson 2005', TP: 3867, FP: 1627, FN: 538, TN: 7001, cutoff: 4 },
        { study: 'Frank 2008', TP: 61, FP: 30, FN: 27, TN: 93, cutoff: 5 },
        { study: 'Gual 2002', TP: 69, FP: 61, FN: 26, TN: 189, cutoff: 5 },
        { study: 'Knight 2003', TP: 25, FP: 9, FN: 5, TN: 35, cutoff: 2 },
        { study: 'Seale 2006', TP: 86, FP: 48, FN: 20, TN: 151, cutoff: 4 },
        { study: 'Selin 2006', TP: 47, FP: 178, FN: 8, TN: 462, cutoff: 4 }
    ]
};

/**
 * Dementia from mada package
 * Mini-Mental State Examination for dementia
 */
export const Dementia = {
    name: 'Dementia',
    description: 'MMSE for dementia screening',
    source: 'mada',
    reference: 'Mitchell (2009)',
    type: 'DTA',
    studies: [
        { study: 'Borson 2000', TP: 37, FP: 3, FN: 1, TN: 22 },
        { study: 'Brodaty 2002', TP: 19, FP: 9, FN: 3, TN: 45 },
        { study: 'Buschke 1999', TP: 25, FP: 5, FN: 2, TN: 101 },
        { study: 'Callahan 2002', TP: 27, FP: 75, FN: 26, TN: 3779 },
        { study: 'Gagnon 1990', TP: 27, FP: 10, FN: 7, TN: 206 },
        { study: 'Ganguli 1993', TP: 10, FP: 11, FN: 11, TN: 1550 },
        { study: 'Kahle-Wrobleski 2007', TP: 70, FP: 9, FN: 7, TN: 130 },
        { study: 'Lam 2008', TP: 199, FP: 16, FN: 26, TN: 113 },
        { study: 'Lavery 2007', TP: 115, FP: 20, FN: 58, TN: 1095 },
        { study: 'Mackinnon 1998', TP: 50, FP: 17, FN: 8, TN: 99 }
    ]
};

// ============================================================
// NETMETA PACKAGE DATASETS (Network Meta-Analysis)
// ============================================================

/**
 * Senn2013 network format for netmeta
 */
export const smokingCessationNMA = {
    name: 'smokingcessation',
    description: 'Smoking cessation interventions network',
    source: 'netmeta',
    reference: 'Hasselblad (1998)',
    type: 'NMA',
    treatments: ['A', 'B', 'C', 'D'],
    treatmentLabels: {
        'A': 'No contact',
        'B': 'Self-help',
        'C': 'Individual counselling',
        'D': 'Group counselling'
    },
    contrasts: [
        { study: 1, treat1: 'A', treat2: 'B', effect: 0.49, se: 0.64 },
        { study: 2, treat1: 'A', treat2: 'B', effect: -0.50, se: 0.75 },
        { study: 3, treat1: 'A', treat2: 'C', effect: 0.74, se: 0.59 },
        { study: 4, treat1: 'A', treat2: 'C', effect: 0.52, se: 0.36 },
        { study: 5, treat1: 'A', treat2: 'C', effect: 0.60, se: 0.28 },
        { study: 6, treat1: 'A', treat2: 'D', effect: 1.18, se: 0.59 },
        { study: 7, treat1: 'B', treat2: 'C', effect: 0.89, se: 0.43 },
        { study: 8, treat1: 'B', treat2: 'C', effect: 0.21, se: 0.32 },
        { study: 9, treat1: 'B', treat2: 'D', effect: 0.79, se: 0.36 },
        { study: 10, treat1: 'C', treat2: 'D', effect: 0.43, se: 0.26 }
    ]
};

/**
 * Parkinson's disease treatments
 */
export const parkinsonNMA = {
    name: 'parkinson',
    description: 'Treatments for Parkinson\'s disease',
    source: 'netmeta',
    reference: 'Defined in netmeta package',
    type: 'NMA',
    treatments: ['1', '2', '3', '4', '5'],
    treatmentLabels: {
        '1': 'Placebo',
        '2': 'Pramipexole',
        '3': 'Ropinirole',
        '4': 'Bromocriptine',
        '5': 'Cabergoline'
    },
    contrasts: [
        { study: 'Poewe 2003', treat1: '1', treat2: '2', effect: -2.10, se: 0.38, responders1: 79, n1: 103, responders2: 91, n2: 103 },
        { study: 'Shannon 1997', treat1: '1', treat2: '2', effect: -1.77, se: 0.55, responders1: 27, n1: 52, responders2: 36, n2: 49 },
        { study: 'Parkinson 2000', treat1: '1', treat2: '3', effect: -1.24, se: 0.34, responders1: 45, n1: 83, responders2: 52, n2: 85 },
        { study: 'Adler 1997', treat1: '1', treat2: '3', effect: -1.82, se: 0.51, responders1: 17, n1: 45, responders2: 26, n2: 46 },
        { study: 'Korczyn 1999', treat1: '3', treat2: '4', effect: 0.18, se: 0.30, responders1: 52, n1: 179, responders2: 50, n2: 179 }
    ]
};

// ============================================================
// ADDITIONAL CLINICAL DATASETS
// ============================================================

/**
 * SGLT2 inhibitors for heart failure (contemporary trials)
 */
export const SGLT2HeartFailure = {
    name: 'sglt2_hf',
    description: 'SGLT2 inhibitors in heart failure',
    source: 'Published trials 2019-2023',
    effectType: 'HR',
    outcome: 'CV death or HF hospitalization',
    studies: [
        { study: 'DAPA-HF', year: 2019, drug: 'Dapagliflozin', hr: 0.74, ci_lower: 0.65, ci_upper: 0.85, events_t: 386, n_t: 2373, events_c: 502, n_c: 2371, ef: 'HFrEF' },
        { study: 'EMPEROR-Reduced', year: 2020, drug: 'Empagliflozin', hr: 0.75, ci_lower: 0.65, ci_upper: 0.86, events_t: 361, n_t: 1863, events_c: 462, n_c: 1867, ef: 'HFrEF' },
        { study: 'EMPEROR-Preserved', year: 2021, drug: 'Empagliflozin', hr: 0.79, ci_lower: 0.69, ci_upper: 0.90, events_t: 415, n_t: 2997, events_c: 511, n_c: 2991, ef: 'HFpEF' },
        { study: 'DELIVER', year: 2022, drug: 'Dapagliflozin', hr: 0.82, ci_lower: 0.73, ci_upper: 0.92, events_t: 512, n_t: 3131, events_c: 610, n_c: 3132, ef: 'HFmrEF/HFpEF' },
        { study: 'SOLOIST-WHF', year: 2021, drug: 'Sotagliflozin', hr: 0.67, ci_lower: 0.52, ci_upper: 0.85, events_t: 51, n_t: 608, events_c: 76, n_c: 614, ef: 'Mixed' }
    ],
    expectedPooled: {
        hr: 0.77,
        ci_lower: 0.72,
        ci_upper: 0.82,
        I2: 0 // Low heterogeneity expected
    }
};

/**
 * Antidepressants for depression (Cipriani 2018)
 */
export const antidepressantsNMA = {
    name: 'antidepressants',
    description: 'Antidepressants for major depressive disorder',
    source: 'Cipriani et al. Lancet 2018',
    reference: 'Cipriani A, et al. Lancet. 2018;391:1357-1366',
    type: 'NMA',
    treatments: [
        'agomelatine', 'amitriptyline', 'bupropion', 'citalopram',
        'clomipramine', 'duloxetine', 'escitalopram', 'fluoxetine',
        'fluvoxamine', 'mirtazapine', 'nefazodone', 'paroxetine',
        'placebo', 'reboxetine', 'sertraline', 'trazodone',
        'venlafaxine', 'vortioxetine'
    ],
    // Simplified subset of comparisons
    keyFindings: {
        mostEffective: ['amitriptyline', 'escitalopram', 'mirtazapine', 'paroxetine', 'venlafaxine'],
        bestTolerated: ['agomelatine', 'citalopram', 'escitalopram', 'fluoxetine', 'sertraline'],
        leastEffective: ['fluoxetine', 'fluvoxamine', 'reboxetine', 'trazodone']
    }
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Convert 2x2 table to effect size
 */
export function calculateEffectFromTable(tpos, tneg, cpos, cneg, measure = 'RR') {
    const a = tpos; // Treatment events
    const b = tneg; // Treatment non-events
    const c = cpos; // Control events
    const d = cneg; // Control non-events

    const n1 = a + b; // Treatment total
    const n2 = c + d; // Control total

    if (measure === 'OR') {
        const or = (a * d) / (b * c);
        const logOR = Math.log(or);
        const seLogOR = Math.sqrt(1/a + 1/b + 1/c + 1/d);
        return { yi: logOR, vi: seLogOR * seLogOR, or, se: seLogOR };
    } else if (measure === 'RR') {
        const p1 = a / n1;
        const p2 = c / n2;
        const rr = p1 / p2;
        const logRR = Math.log(rr);
        const seLogRR = Math.sqrt(1/a - 1/n1 + 1/c - 1/n2);
        return { yi: logRR, vi: seLogRR * seLogRR, rr, se: seLogRR };
    } else if (measure === 'RD') {
        const p1 = a / n1;
        const p2 = c / n2;
        const rd = p1 - p2;
        const seRD = Math.sqrt(p1*(1-p1)/n1 + p2*(1-p2)/n2);
        return { yi: rd, vi: seRD * seRD, rd, se: seRD };
    }

    throw new Error(`Unknown measure: ${measure}`);
}

/**
 * Calculate DTA measures (sensitivity, specificity, etc.)
 */
export function calculateDTAMeasures(TP, FP, FN, TN) {
    const sens = TP / (TP + FN);
    const spec = TN / (TN + FP);
    const ppv = TP / (TP + FP);
    const npv = TN / (TN + FN);
    const plr = sens / (1 - spec);
    const nlr = (1 - sens) / spec;
    const dor = (TP * TN) / (FP * FN);

    // Logit transformations for meta-analysis
    const logitSens = Math.log(sens / (1 - sens));
    const logitSpec = Math.log(spec / (1 - spec));
    const varLogitSens = 1 / TP + 1 / FN;
    const varLogitSpec = 1 / TN + 1 / FP;

    return {
        sensitivity: sens,
        specificity: spec,
        ppv, npv, plr, nlr, dor,
        logitSens, logitSpec,
        varLogitSens, varLogitSpec
    };
}

/**
 * Prepare BCG data for analysis
 */
export function prepareBCGData() {
    return datBCG.studies.map(s => {
        const effect = calculateEffectFromTable(s.tpos, s.tneg, s.cpos, s.cneg, 'RR');
        return {
            study: `${s.author} (${s.year})`,
            year: s.year,
            yi: effect.yi,
            vi: effect.vi,
            ablat: s.ablat,
            alloc: s.alloc
        };
    });
}

/**
 * Get all available datasets
 */
export function getAvailableDatasets() {
    return [
        { id: 'datBCG', name: 'BCG Vaccine Trials', type: 'pairwise', source: 'metafor' },
        { id: 'datRaudenbush1985', name: 'Teacher Expectancy', type: 'pairwise', source: 'metafor' },
        { id: 'datSenn2013', name: 'Anti-diabetic Drugs', type: 'NMA', source: 'metafor' },
        { id: 'AuditC', name: 'AUDIT-C Screening', type: 'DTA', source: 'mada' },
        { id: 'Dementia', name: 'MMSE Dementia', type: 'DTA', source: 'mada' },
        { id: 'smokingCessationNMA', name: 'Smoking Cessation', type: 'NMA', source: 'netmeta' },
        { id: 'parkinsonNMA', name: 'Parkinson Treatments', type: 'NMA', source: 'netmeta' },
        { id: 'SGLT2HeartFailure', name: 'SGLT2 in Heart Failure', type: 'pairwise', source: 'published' },
        { id: 'antidepressantsNMA', name: 'Antidepressants', type: 'NMA', source: 'Cipriani 2018' }
    ];
}

export default {
    datBCG,
    datSenn2013,
    datRaudenbush1985,
    AuditC,
    Dementia,
    smokingCessationNMA,
    parkinsonNMA,
    SGLT2HeartFailure,
    antidepressantsNMA,
    calculateEffectFromTable,
    calculateDTAMeasures,
    prepareBCGData,
    getAvailableDatasets
};
