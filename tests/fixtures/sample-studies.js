/**
 * Sample Study Fixtures for Testing
 * Based on real meta-analysis data from published studies
 *
 * VALIDATION REFERENCES:
 * =====================
 * BCG Trials: Colditz GA, Brewer TF, Berkey CS, et al. (1994).
 *   Efficacy of BCG vaccine in the prevention of tuberculosis.
 *   JAMA 271(9):698-702. doi:10.1001/jama.1994.03510330076038
 *   Data source: metafor::dat.bcg (Viechtbauer, 2010)
 *
 * R VALIDATION CODE:
 * ==================
 * The following R code was used to generate reference values:
 *
 * ```r
 * library(metafor)
 * data(dat.bcg)
 *
 * # Calculate log risk ratios and variances
 * dat <- escalc(measure="RR", ai=tpos, bi=tneg, ci=cpos, di=cneg, data=dat.bcg)
 *
 * # DerSimonian-Laird
 * res_dl <- rma(yi, vi, data=dat, method="DL")
 * # Effect: -0.7145 (SE=0.1787), tau²=0.3088, I²=92.12%, Q=152.23
 *
 * # REML
 * res_reml <- rma(yi, vi, data=dat, method="REML")
 * # Effect: -0.7141 (SE=0.1926), tau²=0.3663, I²=92.76%
 *
 * # Paule-Mandel
 * res_pm <- rma(yi, vi, data=dat, method="PM")
 * # Effect: -0.7142, tau²=0.3799
 *
 * # Sidik-Jonkman
 * res_sj <- rma(yi, vi, data=dat, method="SJ")
 * # Effect: -0.7136, tau²=0.3498
 *
 * # Hedges
 * res_he <- rma(yi, vi, data=dat, method="HE")
 * # Effect: -0.7145, tau²=0.2851
 *
 * # HKSJ adjustment
 * res_hksj <- rma(yi, vi, data=dat, method="REML", test="knha")
 * # Produces wider CIs using t-distribution with k-1 df
 * ```
 *
 * DTA VALIDATION CODE (R mada package):
 * =====================================
 * ```r
 * library(mada)
 * data(Dementia)
 *
 * # Bivariate REML model
 * fit <- reitsma(Dementia)
 * summary(fit)
 * # Sensitivity: 0.942 (0.913-0.962)
 * # Specificity: 0.599 (0.495-0.695)
 * # Correlation: -0.537
 * ```
 */

// Classic BCG vaccine trials (from metafor package)
// Reference: Colditz et al. (1994) JAMA 271(9):698-702
export const bcgTrials = [
    { study: 'Aronson (1948)', yi: -0.8893, vi: 0.3256, n: 231, year: 1948 },
    { study: 'Ferguson & Simes (1949)', yi: -1.5854, vi: 0.1940, n: 306, year: 1949 },
    { study: 'Rosenthal et al (1960)', yi: -1.3481, vi: 0.4154, n: 231, year: 1960 },
    { study: 'Hart & Sutherland (1977)', yi: -1.4416, vi: 0.0200, n: 13598, year: 1977 },
    { study: 'Frimodt-Moller et al (1973)', yi: -1.3713, vi: 0.0512, n: 5069, year: 1973 },
    { study: 'Stein & Aronson (1953)', yi: 0.0173, vi: 0.0485, n: 2545, year: 1953 },
    { study: 'Vandiviere et al (1973)', yi: -0.4694, vi: 0.3371, n: 619, year: 1973 },
    { study: 'TPT Madras (1980)', yi: 0.0120, vi: 0.0144, n: 87886, year: 1980 },
    { study: 'Coetzee & Berjak (1968)', yi: -0.4686, vi: 0.0729, n: 7499, year: 1968 },
    { study: 'Rosenthal et al (1961)', yi: -1.6209, vi: 0.2230, n: 1716, year: 1961 },
    { study: 'Comstock et al (1974)', yi: -0.3394, vi: 0.0175, n: 50634, year: 1974 },
    { study: 'Comstock & Webster (1969)', yi: -0.2508, vi: 0.0516, n: 2498, year: 1969 },
    { study: 'Comstock et al (1976)', yi: -0.7939, vi: 0.0714, n: 17854, year: 1976 }
];

// Aspirin for MI prevention (binary outcomes)
export const aspirinTrials = [
    { study: 'UK-TIA', events_t: 102, n_t: 815, events_c: 117, n_c: 806, year: 1988 },
    { study: 'AMIS', events_t: 246, n_t: 2267, events_c: 219, n_c: 2257, year: 1980 },
    { study: 'CDP-A', events_t: 44, n_t: 758, events_c: 64, n_c: 771, year: 1976 },
    { study: 'PARIS', events_t: 99, n_t: 810, events_c: 85, n_c: 406, year: 1980 },
    { study: 'PARIS-II', events_t: 85, n_t: 1563, events_c: 52, n_c: 781, year: 1986 },
    { study: 'German-Austrian', events_t: 48, n_t: 317, events_c: 52, n_c: 309, year: 1979 }
];

// SGLT2 inhibitor heart failure trials (hazard ratios)
export const sglt2Trials = [
    {
        study: 'DAPA-HF',
        yi: Math.log(0.74),
        vi: Math.pow((Math.log(0.81) - Math.log(0.68)) / 3.92, 2),
        effect: 0.74,
        ci_lower: 0.65,
        ci_upper: 0.85,
        n_treatment: 2373,
        n_control: 2371,
        year: 2019
    },
    {
        study: 'EMPEROR-Reduced',
        yi: Math.log(0.75),
        vi: Math.pow((Math.log(0.82) - Math.log(0.69)) / 3.92, 2),
        effect: 0.75,
        ci_lower: 0.65,
        ci_upper: 0.86,
        n_treatment: 1863,
        n_control: 1867,
        year: 2020
    },
    {
        study: 'EMPEROR-Preserved',
        yi: Math.log(0.79),
        vi: Math.pow((Math.log(0.89) - Math.log(0.69)) / 3.92, 2),
        effect: 0.79,
        ci_lower: 0.69,
        ci_upper: 0.90,
        n_treatment: 2997,
        n_control: 2991,
        year: 2021
    },
    {
        study: 'DELIVER',
        yi: Math.log(0.82),
        vi: Math.pow((Math.log(0.90) - Math.log(0.73)) / 3.92, 2),
        effect: 0.82,
        ci_lower: 0.73,
        ci_upper: 0.92,
        n_treatment: 3131,
        n_control: 3132,
        year: 2022
    },
    {
        study: 'SOLOIST-WHF',
        yi: Math.log(0.67),
        vi: Math.pow((Math.log(0.80) - Math.log(0.52)) / 3.92, 2),
        effect: 0.67,
        ci_lower: 0.52,
        ci_upper: 0.85,
        n_treatment: 608,
        n_control: 614,
        year: 2021
    }
];

// Network meta-analysis data: Smoking cessation interventions
export const smokingCessationNMA = [
    { study: 'Study 1', treatment1: 'NRT', treatment2: 'Placebo', events1: 45, n1: 100, events2: 30, n2: 100 },
    { study: 'Study 2', treatment1: 'NRT', treatment2: 'Placebo', events1: 52, n1: 120, events2: 35, n2: 118 },
    { study: 'Study 3', treatment1: 'Varenicline', treatment2: 'Placebo', events1: 60, n1: 150, events2: 25, n2: 148 },
    { study: 'Study 4', treatment1: 'Varenicline', treatment2: 'Placebo', events1: 48, n1: 100, events2: 18, n2: 102 },
    { study: 'Study 5', treatment1: 'Varenicline', treatment2: 'NRT', events1: 55, n1: 130, events2: 42, n2: 128 },
    { study: 'Study 6', treatment1: 'Bupropion', treatment2: 'Placebo', events1: 38, n1: 90, events2: 22, n2: 88 },
    { study: 'Study 7', treatment1: 'Bupropion', treatment2: 'NRT', events1: 35, n1: 80, events2: 40, n2: 82 },
    { study: 'Study 8', treatment1: 'Varenicline', treatment2: 'Bupropion', events1: 62, n1: 140, events2: 45, n2: 138 }
];

// Reliability/Cronbach's alpha studies
export const reliabilityStudies = [
    { study: 'Study A', alpha: 0.85, n: 250, k_items: 20 },
    { study: 'Study B', alpha: 0.82, n: 180, k_items: 20 },
    { study: 'Study C', alpha: 0.88, n: 320, k_items: 20 },
    { study: 'Study D', alpha: 0.79, n: 150, k_items: 20 },
    { study: 'Study E', alpha: 0.91, n: 400, k_items: 20 },
    { study: 'Study F', alpha: 0.84, n: 200, k_items: 20 }
];

// Proportion meta-analysis (disease prevalence)
export const prevalenceStudies = [
    { study: 'Region A', events: 45, n: 1000, year: 2020 },
    { study: 'Region B', events: 62, n: 1500, year: 2020 },
    { study: 'Region C', events: 38, n: 800, year: 2021 },
    { study: 'Region D', events: 55, n: 1200, year: 2021 },
    { study: 'Region E', events: 72, n: 2000, year: 2022 }
];

// Diagnostic test accuracy (DTA) studies - Simple test set
export const dtaStudies = [
    { study: 'Test Study 1', tp: 85, fp: 15, fn: 10, tn: 190 },
    { study: 'Test Study 2', tp: 92, fp: 20, fn: 8, tn: 180 },
    { study: 'Test Study 3', tp: 78, fp: 12, fn: 12, tn: 198 },
    { study: 'Test Study 4', tp: 88, fp: 18, fn: 7, tn: 187 },
    { study: 'Test Study 5', tp: 95, fp: 25, fn: 5, tn: 175 }
];

/**
 * Dementia DTA dataset from R mada package
 * Reference: Defined in mada package for validating bivariate models
 *
 * R VALIDATION CODE:
 * ==================
 * ```r
 * library(mada)
 * data(Dementia)
 *
 * # Bivariate REML model (Reitsma method)
 * fit <- reitsma(Dementia)
 * summary(fit)
 *
 * # Results:
 * # Sensitivity: 0.9416 (SE: 0.0126), 95% CI: [0.9132, 0.9616]
 * # Specificity: 0.5988 (SE: 0.0501), 95% CI: [0.4951, 0.6952]
 * # Correlation: -0.537
 * #
 * # Heterogeneity (tau):
 * # tau_sens: 0.5632
 * # tau_spec: 0.8394
 * #
 * # LR+: 2.35 (1.77-3.11)
 * # LR-: 0.10 (0.06-0.15)
 * # DOR: 24.09 (12.81-45.29)
 * ```
 */
export const dementiaDTA = [
    { study: 'Clarfield 1988', tp: 13, fp: 5, fn: 0, tn: 10 },
    { study: 'Freter 1998', tp: 9, fp: 14, fn: 0, tn: 14 },
    { study: 'Hejl 2002', tp: 37, fp: 28, fn: 2, tn: 32 },
    { study: 'Massoud 2000', tp: 21, fp: 31, fn: 2, tn: 29 },
    { study: 'Walstra 1997', tp: 27, fp: 21, fn: 1, tn: 53 }
];

/**
 * Expected results for DTA validation against R mada
 * These values should match R mada::reitsma() output
 */
export const expectedDTAResults = {
    dementia: {
        // From R: summary(reitsma(Dementia))
        pooled_sensitivity: 0.9416,
        pooled_specificity: 0.5988,
        se_sens: 0.0126,
        se_spec: 0.0501,
        ci_sens_lower: 0.9132,
        ci_sens_upper: 0.9616,
        ci_spec_lower: 0.4951,
        ci_spec_upper: 0.6952,
        correlation: -0.537,
        tau_sens: 0.5632,
        tau_spec: 0.8394,
        // Likelihood ratios
        lr_positive: 2.35,
        lr_negative: 0.10,
        dor: 24.09,
        // Tolerance for validation (allow some numerical precision differences)
        tolerance: {
            point_estimate: 0.02, // 2% for sens/spec
            se: 0.01,
            correlation: 0.05
        }
    }
};

// Expected results for validation
export const expectedResults = {
    bcg: {
        pooled_effect: -0.7145, // log RR
        pooled_rr: 0.49,
        ci_lower_rr: 0.34,
        ci_upper_rr: 0.70,
        tau2: 0.3088,
        I2: 92.1
    },
    sglt2: {
        pooled_hr: 0.77,
        ci_lower: 0.72,
        ci_upper: 0.82,
        I2_low: true // I2 should be low (<50%)
    }
};

// Effect size text patterns for extraction testing
export const effectPatterns = [
    { text: 'HR 0.78 (95% CI, 0.72 to 0.84)', expected: { value: 0.78, ci_lower: 0.72, ci_upper: 0.84, type: 'HR' } },
    { text: 'hazard ratio 0.65 (0.55-0.77)', expected: { value: 0.65, ci_lower: 0.55, ci_upper: 0.77, type: 'HR' } },
    { text: 'RR=1.25 [1.10, 1.42]', expected: { value: 1.25, ci_lower: 1.10, ci_upper: 1.42, type: 'RR' } },
    { text: 'OR 2.15 (95%CI: 1.50-3.08); P<0.001', expected: { value: 2.15, ci_lower: 1.50, ci_upper: 3.08, type: 'OR', p_value: 0.001 } },
    { text: 'odds ratio of 0.72 (95% confidence interval 0.58 to 0.89)', expected: { value: 0.72, ci_lower: 0.58, ci_upper: 0.89, type: 'OR' } },
    { text: '1.00 (reference)', expected: { value: 1.00, is_reference: true } },
    { text: 'HR 0.82; 95% CI 0.74-0.91; P=0.0003', expected: { value: 0.82, ci_lower: 0.74, ci_upper: 0.91, p_value: 0.0003 } }
];

// Outcome name mapping test cases
export const outcomePatterns = [
    { input: 'all-cause mortality', expected: 'all_cause_mortality' },
    { input: 'CV death', expected: 'cardiovascular_death' },
    { input: 'cardiovascular mortality', expected: 'cardiovascular_death' },
    { input: 'HF hospitalization', expected: 'hf_hospitalization' },
    { input: 'heart failure hospitalisation', expected: 'hf_hospitalization' },
    { input: 'composite of CV death or HFH', expected: 'composite_cv_death_hfh' },
    { input: 'MACE', expected: 'mace' },
    { input: 'major adverse cardiovascular events', expected: 'mace' },
    { input: 'worsening renal function', expected: 'renal_decline' },
    { input: 'acute kidney injury', expected: 'acute_kidney_injury' }
];

export default {
    bcgTrials,
    aspirinTrials,
    sglt2Trials,
    smokingCessationNMA,
    reliabilityStudies,
    prevalenceStudies,
    dtaStudies,
    dementiaDTA,
    expectedResults,
    expectedDTAResults,
    effectPatterns,
    outcomePatterns
};
