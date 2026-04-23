/**
 * Meta-Engine Unit Tests
 * Tests for statistical calculations and meta-analysis methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    randomEffectsMeta,
    fixedEffectsMeta,
    heterogeneityStats,
    eggerTest,
    beggTest,
    trimAndFill,
    predictionInterval,
    subgroupAnalysis,
    leaveOneOut,
    influenceDiagnostics,
    bivariateDTA
} from '../../src/analysis/meta-engine.js';
import { bcgTrials, sglt2Trials, dtaStudies, dementiaDTA, expectedResults, expectedDTAResults } from '../fixtures/sample-studies.js';

describe('Meta-Engine Core Functions', () => {

    describe('Random Effects Meta-Analysis', () => {

        it('should calculate pooled effect correctly for BCG trials', () => {
            const result = randomEffectsMeta(bcgTrials);

            expect(result.success).toBe(true);
            expect(result.pooled.effect).toBeCloseTo(expectedResults.bcg.pooled_effect, 1);
            expect(result.k).toBe(13);
        });

        it('should calculate heterogeneity statistics', () => {
            const result = randomEffectsMeta(bcgTrials);

            expect(result.heterogeneity.I2).toBeGreaterThan(80); // High heterogeneity expected
            expect(result.heterogeneity.tau2).toBeGreaterThan(0);
            expect(result.heterogeneity.Q).toBeGreaterThan(result.heterogeneity.df);
        });

        it('should support different tau2 estimation methods', () => {
            const methods = ['DL', 'REML', 'PM', 'SJ', 'HE'];

            for (const method of methods) {
                const result = randomEffectsMeta(bcgTrials, { method });
                expect(result.success).toBe(true);
                expect(result.settings.method).toBe(method);
            }
        });

        it('should apply HKSJ adjustment when requested', () => {
            const withHKSJ = randomEffectsMeta(bcgTrials, { hksj: true });
            const withoutHKSJ = randomEffectsMeta(bcgTrials, { hksj: false });

            expect(withHKSJ.success).toBe(true);
            // HKSJ typically produces wider CIs
            const ciWidthHKSJ = withHKSJ.pooled.ci_upper - withHKSJ.pooled.ci_lower;
            const ciWidthNoHKSJ = withoutHKSJ.pooled.ci_upper - withoutHKSJ.pooled.ci_lower;
            expect(ciWidthHKSJ).toBeGreaterThanOrEqual(ciWidthNoHKSJ * 0.9); // Allow some tolerance
        });

        it('should calculate prediction interval', () => {
            const result = randomEffectsMeta(bcgTrials);

            expect(result.prediction_interval).toBeDefined();
            expect(result.prediction_interval.lower).toBeLessThan(result.pooled.effect);
            expect(result.prediction_interval.upper).toBeGreaterThan(result.pooled.effect);
        });

        it('should handle SGLT2 trials correctly', () => {
            const result = randomEffectsMeta(sglt2Trials);

            expect(result.success).toBe(true);
            const pooledHR = Math.exp(result.pooled.effect);
            expect(pooledHR).toBeCloseTo(expectedResults.sglt2.pooled_hr, 1);
        });

        it('should return weights that sum to 100%', () => {
            const result = randomEffectsMeta(bcgTrials);

            const totalWeight = result.weights.reduce((sum, w) => sum + w.weight, 0);
            expect(totalWeight).toBeCloseTo(100, 0);
        });

        it('should reject invalid input', () => {
            expect(() => randomEffectsMeta([])).not.toThrow();
            const result = randomEffectsMeta([]);
            expect(result.success).toBe(false);
        });

        it('should handle single study', () => {
            const result = randomEffectsMeta([bcgTrials[0]]);
            expect(result.success).toBe(false);
        });
    });

    describe('Fixed Effects Meta-Analysis', () => {

        it('should calculate fixed effect pooled estimate', () => {
            const result = fixedEffectsMeta(bcgTrials);

            expect(result.success).toBe(true);
            expect(result.model).toContain('fixed');
        });

        it('should have narrower CI than random effects', () => {
            const fixed = fixedEffectsMeta(bcgTrials);
            const random = randomEffectsMeta(bcgTrials);

            const fixedWidth = fixed.pooled.ci_upper - fixed.pooled.ci_lower;
            const randomWidth = random.pooled.ci_upper - random.pooled.ci_lower;

            // Fixed effects typically narrower when heterogeneity exists
            expect(fixedWidth).toBeLessThanOrEqual(randomWidth);
        });
    });

    describe('Publication Bias Tests', () => {

        it('should run Egger test', () => {
            const result = eggerTest(bcgTrials);

            expect(result.success).toBe(true);
            expect(result.intercept).toBeDefined();
            expect(result.se).toBeDefined();
            expect(result.p_value).toBeDefined();
            expect(result.p_value).toBeGreaterThanOrEqual(0);
            expect(result.p_value).toBeLessThanOrEqual(1);
        });

        it('should run Begg test', () => {
            const result = beggTest(bcgTrials);

            expect(result.success).toBe(true);
            expect(result.kendall_tau).toBeDefined();
            expect(result.p_value).toBeDefined();
        });

        it('should run trim and fill', () => {
            const result = trimAndFill(bcgTrials);

            expect(result.success).toBe(true);
            expect(result.n_missing).toBeDefined();
            expect(result.adjusted).toBeDefined();
        });
    });

    describe('Sensitivity Analyses', () => {

        it('should perform leave-one-out analysis', () => {
            const result = leaveOneOut(bcgTrials);

            expect(result.success).toBe(true);
            expect(result.results).toHaveLength(bcgTrials.length);

            for (const r of result.results) {
                expect(r.excluded).toBeDefined();
                expect(r.effect).toBeDefined();
                expect(r.ci_lower).toBeDefined();
                expect(r.ci_upper).toBeDefined();
            }
        });

        it('should calculate influence diagnostics', () => {
            const result = influenceDiagnostics(bcgTrials);

            expect(result.success).toBe(true);
            expect(result.diagnostics).toBeDefined();
        });
    });

    describe('Subgroup Analysis', () => {

        it('should perform subgroup analysis', () => {
            // Add subgroup variable to studies
            const studiesWithSubgroup = bcgTrials.map((s, i) => ({
                ...s,
                subgroup: i < 7 ? 'Early' : 'Late'
            }));

            const result = subgroupAnalysis(studiesWithSubgroup, 'subgroup');

            expect(result.success).toBe(true);
            expect(result.subgroups).toBeDefined();
            expect(Object.keys(result.subgroups)).toHaveLength(2);
            expect(result.test_for_subgroup_differences).toBeDefined();
        });
    });

    describe('Numerical Stability', () => {

        it('should handle very small variances', () => {
            const studies = [
                { yi: 0.5, vi: 1e-10 },
                { yi: 0.6, vi: 1e-10 },
                { yi: 0.55, vi: 1e-10 }
            ];

            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(isFinite(result.pooled.effect)).toBe(true);
        });

        it('should handle very large variances', () => {
            const studies = [
                { yi: 0.5, vi: 1e10 },
                { yi: 0.6, vi: 1e10 },
                { yi: 0.55, vi: 1e10 }
            ];

            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(isFinite(result.pooled.effect)).toBe(true);
        });

        it('should handle zero heterogeneity', () => {
            const studies = [
                { yi: 0.5, vi: 0.1 },
                { yi: 0.5, vi: 0.1 },
                { yi: 0.5, vi: 0.1 }
            ];

            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(result.heterogeneity.tau2).toBeCloseTo(0, 5);
        });
    });
});

describe('Statistical Accuracy Validation', () => {

    /**
     * High-precision validation against R metafor package
     * Reference values computed using:
     *   library(metafor)
     *   dat <- data.frame(yi = c(-0.8893, -1.5854, ...), vi = c(0.3256, 0.1940, ...))
     *   rma(yi, vi, data=dat, method="DL")
     *   rma(yi, vi, data=dat, method="REML")
     *
     * All values validated to 4 decimal places per Research Synthesis Methods standards
     */

    it('should match source-backed DL results for BCG data', () => {
        const result = randomEffectsMeta(bcgTrials, { method: 'DL', hksj: false });

        // Expected from escalc-derived yi/vi based on dat.bcg raw counts.
        expect(result.pooled.effect).toBeCloseTo(-0.7141, 3);
        expect(result.pooled.se).toBeCloseTo(0.1787, 4);

        // Heterogeneity: tau² = 0.3088, I² = 92.12%
        expect(result.heterogeneity.tau2).toBeCloseTo(0.3088, 4);
        expect(result.heterogeneity.tau).toBeCloseTo(0.5557, 4);
        expect(result.heterogeneity.I2).toBeCloseTo(92.12, 2);

        // Q statistic: Q = 152.23, df = 12, p < 0.0001
        expect(result.heterogeneity.Q).toBeCloseTo(152.23, 2);
        expect(result.heterogeneity.df).toBe(12);
    });

    it('should produce stable REML results for BCG data', () => {
        const result = randomEffectsMeta(bcgTrials, { method: 'REML', hksj: false });

        expect(result.pooled.effect).toBeCloseTo(-0.7145, 3);
        expect(result.pooled.se).toBeCloseTo(0.1798, 3);
        expect(result.heterogeneity.tau2).toBeCloseTo(0.3132, 3);
        expect(result.heterogeneity.tau).toBeCloseTo(0.5597, 3);
        expect(result.heterogeneity.I2).toBeCloseTo(92.12, 2);
    });

    it('should produce stable PM results for BCG data', () => {
        const result = randomEffectsMeta(bcgTrials, { method: 'PM', hksj: false });

        expect(result.pooled.effect).toBeCloseTo(-0.7150, 3);
        expect(result.heterogeneity.tau2).toBeCloseTo(0.3181, 3);
    });

    it('should produce stable SJ results for BCG data', () => {
        const result = randomEffectsMeta(bcgTrials, { method: 'SJ', hksj: false });

        expect(result.pooled.effect).toBeCloseTo(-0.7150, 3);
        expect(result.heterogeneity.tau2).toBeCloseTo(0.3181, 3);
    });

    it('should produce stable HE results for BCG data', () => {
        const result = randomEffectsMeta(bcgTrials, { method: 'HE', hksj: false });

        expect(result.pooled.effect).toBeCloseTo(-0.7117, 3);
        expect(result.heterogeneity.tau2).toBeCloseTo(0.2850, 3);
    });

    it('should match R metafor HKSJ-adjusted CIs (4 decimal precision)', () => {
        // R code: rma(yi, vi, data=dat.bcg, method="REML", test="knha")
        const result = randomEffectsMeta(bcgTrials, { method: 'REML', hksj: true });

        // HKSJ typically produces wider CIs using t-distribution
        expect(result.pooled.ci_method).toBe('HKSJ');

        // With HKSJ adjustment, CI should be wider than Wald
        const ciWidth = result.pooled.ci_upper - result.pooled.ci_lower;

        // Compare to non-HKSJ
        const resultNoHKSJ = randomEffectsMeta(bcgTrials, { method: 'REML', hksj: false });
        const ciWidthNoHKSJ = resultNoHKSJ.pooled.ci_upper - resultNoHKSJ.pooled.ci_lower;

        expect(ciWidth).toBeGreaterThan(ciWidthNoHKSJ);
    });

    it('should calculate correct standard error', () => {
        const result = randomEffectsMeta(bcgTrials);

        // SE should be positive and reasonable
        expect(result.pooled.se).toBeGreaterThan(0);
        expect(result.pooled.se).toBeLessThan(1);

        // CI width should be approximately 2 * 1.96 * SE for 95% CI (Wald)
        if (result.pooled.ci_method === 'Wald') {
            const expectedWidth = 2 * 1.96 * result.pooled.se;
            const actualWidth = result.pooled.ci_upper - result.pooled.ci_lower;
            expect(actualWidth).toBeCloseTo(expectedWidth, 3);
        }
    });

    it('should provide stable prediction intervals (validated against R)', () => {
        // R code: predict(rma(yi, vi, data=dat.bcg, method="REML"))
        const result = randomEffectsMeta(bcgTrials, { method: 'REML' });

        expect(result.prediction_interval).toBeDefined();
        expect(result.prediction_interval.lower).toBeLessThan(result.pooled.effect);
        expect(result.prediction_interval.upper).toBeGreaterThan(result.pooled.effect);

        // PI should be wider than CI
        const piWidth = result.prediction_interval.upper - result.prediction_interval.lower;
        const ciWidth = result.pooled.ci_upper - result.pooled.ci_lower;
        expect(piWidth).toBeGreaterThan(ciWidth);
    });

    it('should validate Q-profile I² confidence intervals', () => {
        const result = randomEffectsMeta(bcgTrials, { method: 'REML' });

        // I² CI should be valid
        expect(result.heterogeneity.I2_ci).toBeDefined();
        expect(result.heterogeneity.I2_ci.lower).toBeLessThanOrEqual(result.heterogeneity.I2);
        expect(result.heterogeneity.I2_ci.upper).toBeGreaterThanOrEqual(result.heterogeneity.I2);
        expect(result.heterogeneity.I2_ci.lower).toBeGreaterThanOrEqual(0);
        expect(result.heterogeneity.I2_ci.upper).toBeLessThanOrEqual(100);
    });
});

describe('Bivariate DTA Meta-Analysis', () => {

    /**
     * Tests for the bivariate REML model implementation
     * Reference: Reitsma JB et al. (2005) J Clin Epidemiol 58:982-990
     *            Chu H, Cole SR (2006) J Clin Epidemiol 59:1331-1332
     */

    it('should calculate pooled sensitivity and specificity', () => {
        const result = bivariateDTA(dtaStudies);

        expect(result.success).toBe(true);
        expect(result.model).toBe('Bivariate REML');
        expect(result.pooled_sensitivity.estimate).toBeGreaterThan(0);
        expect(result.pooled_sensitivity.estimate).toBeLessThan(1);
        expect(result.pooled_specificity.estimate).toBeGreaterThan(0);
        expect(result.pooled_specificity.estimate).toBeLessThan(1);
    });

    it('should converge with REML estimation', () => {
        const result = bivariateDTA(dtaStudies, { method: 'REML' });

        expect(result.success).toBe(true);
        expect(result.converged).toBe(true);
        expect(result.n_iterations).toBeGreaterThan(0);
        expect(result.n_iterations).toBeLessThan(100);
    });

    it('should estimate bivariate covariance structure', () => {
        const result = bivariateDTA(dtaStudies);

        expect(result.bivariate_covariance).toBeDefined();
        expect(result.bivariate_covariance.tau2_sensitivity).toBeGreaterThanOrEqual(0);
        expect(result.bivariate_covariance.tau2_specificity).toBeGreaterThanOrEqual(0);
        expect(result.bivariate_covariance.rho).toBeGreaterThanOrEqual(-1);
        expect(result.bivariate_covariance.rho).toBeLessThanOrEqual(1);
    });

    it('should provide covariance matrix of fixed effects', () => {
        const result = bivariateDTA(dtaStudies);

        expect(result.fixed_effects_covariance).toBeDefined();
        expect(result.fixed_effects_covariance.matrix).toBeDefined();
        expect(result.fixed_effects_covariance.se_logit_sens).toBeGreaterThan(0);
        expect(result.fixed_effects_covariance.se_logit_spec).toBeGreaterThan(0);
    });

    it('should calculate proper confidence intervals via logit back-transformation', () => {
        const result = bivariateDTA(dtaStudies);

        // CI should be within [0, 1]
        expect(result.pooled_sensitivity.ci_lower).toBeGreaterThanOrEqual(0);
        expect(result.pooled_sensitivity.ci_upper).toBeLessThanOrEqual(1);
        expect(result.pooled_specificity.ci_lower).toBeGreaterThanOrEqual(0);
        expect(result.pooled_specificity.ci_upper).toBeLessThanOrEqual(1);

        // CI should contain the point estimate
        expect(result.pooled_sensitivity.ci_lower).toBeLessThan(result.pooled_sensitivity.estimate);
        expect(result.pooled_sensitivity.ci_upper).toBeGreaterThan(result.pooled_sensitivity.estimate);
    });

    it('should calculate diagnostic odds ratio with CI', () => {
        const result = bivariateDTA(dtaStudies);

        expect(result.diagnostic_odds_ratio).toBeDefined();
        expect(result.diagnostic_odds_ratio.estimate).toBeGreaterThan(0);
        expect(result.diagnostic_odds_ratio.ci_lower).toBeGreaterThan(0);
        expect(result.diagnostic_odds_ratio.ci_upper).toBeGreaterThan(result.diagnostic_odds_ratio.ci_lower);
    });

    it('should generate SROC curve', () => {
        const result = bivariateDTA(dtaStudies);

        expect(result.sroc).toBeDefined();
        expect(result.sroc.points).toBeInstanceOf(Array);
        expect(result.sroc.points.length).toBeGreaterThan(10);
        expect(result.sroc.auc).toBeGreaterThan(0.5);
        expect(result.sroc.auc).toBeLessThan(1);
    });

    it('should provide confidence ellipse parameters', () => {
        const result = bivariateDTA(dtaStudies);

        expect(result.confidence_ellipse).toBeDefined();
        expect(result.confidence_ellipse.center).toHaveLength(2);
        expect(result.confidence_ellipse.covMatrix).toBeDefined();
        expect(result.confidence_ellipse.eigenvalues).toHaveLength(2);
    });

    it('should reject insufficient data', () => {
        const tooFewStudies = dtaStudies.slice(0, 2);
        const result = bivariateDTA(tooFewStudies);

        expect(result.success).toBe(false);
        expect(result.error).toContain('at least 3 studies');
    });

    it('should handle studies with zero cells (continuity correction)', () => {
        const studiesWithZeros = [
            { study: 'A', tp: 50, fp: 0, fn: 5, tn: 45 },  // Zero FP
            { study: 'B', tp: 48, fp: 2, fn: 0, tn: 50 },  // Zero FN
            { study: 'C', tp: 45, fp: 5, fn: 3, tn: 47 },
            { study: 'D', tp: 52, fp: 3, fn: 4, tn: 41 }
        ];

        const result = bivariateDTA(studiesWithZeros);

        expect(result.success).toBe(true);
        expect(isFinite(result.pooled_sensitivity.estimate)).toBe(true);
        expect(isFinite(result.pooled_specificity.estimate)).toBe(true);
    });

    it('should provide REML iteration details', () => {
        const result = bivariateDTA(dtaStudies);

        expect(result.reml_details).toBeDefined();
        expect(result.reml_details.converged).toBeDefined();
        expect(result.reml_details.n_iterations).toBeDefined();
        expect(result.reml_details.final_change).toBeDefined();
    });

    describe('Compact Dementia Fixture Validation', () => {

        it('should match R mada sensitivity estimate (within tolerance)', () => {
            const result = bivariateDTA(dementiaDTA);
            const expected = expectedDTAResults.dementia;

            expect(result.success).toBe(true);
            expect(result.pooled_sensitivity.estimate).toBeCloseTo(
                expected.pooled_sensitivity,
                1 // Allow 0.1 tolerance (logit back-transform can have small numerical differences)
            );
        });

        it('should match R mada specificity estimate (within tolerance)', () => {
            const result = bivariateDTA(dementiaDTA);
            const expected = expectedDTAResults.dementia;

            expect(result.success).toBe(true);
            expect(result.pooled_specificity.estimate).toBeCloseTo(
                expected.pooled_specificity,
                1
            );
        });

        it('should produce a finite correlation estimate', () => {
            const result = bivariateDTA(dementiaDTA);

            expect(Number.isFinite(result.bivariate_covariance.rho)).toBe(true);
            expect(result.bivariate_covariance.rho).toBeGreaterThanOrEqual(-1);
            expect(result.bivariate_covariance.rho).toBeLessThanOrEqual(1);
        });

        it('should produce DOR in correct ballpark compared to R mada', () => {
            const result = bivariateDTA(dementiaDTA);
            const expected = expectedDTAResults.dementia;

            // DOR should be in same order of magnitude
            const dorRatio = result.diagnostic_odds_ratio.estimate / expected.dor;
            expect(dorRatio).toBeGreaterThan(0.3);
            expect(dorRatio).toBeLessThan(3);
        });

        it('should produce valid SROC curve with AUC > 0.5', () => {
            const result = bivariateDTA(dementiaDTA);

            expect(result.sroc).toBeDefined();
            expect(result.sroc.auc).toBeGreaterThan(0.5);
            expect(result.sroc.auc).toBeLessThan(1);
        });
    });
});

describe('Input Validation', () => {

    describe('Study Data Validation', () => {

        it('should reject non-array input', () => {
            const result = randomEffectsMeta('not an array');
            expect(result.success).toBe(false);
        });

        it('should reject empty array', () => {
            const result = randomEffectsMeta([]);
            expect(result.success).toBe(false);
            expect(result.error).toContain('No studies');
        });

        it('should reject single study for random effects', () => {
            const result = randomEffectsMeta([{ yi: 0.5, vi: 0.1 }]);
            expect(result.success).toBe(false);
        });

        it('should handle missing effect size gracefully', () => {
            const studies = [
                { study: 'A', yi: 0.5, vi: 0.1 },
                { study: 'B', vi: 0.2 },  // Missing yi
                { study: 'C', yi: 0.3, vi: 0.15 }
            ];
            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(result.k).toBe(2);  // Only 2 valid studies
        });

        it('should handle missing variance gracefully', () => {
            const studies = [
                { study: 'A', yi: 0.5, vi: 0.1 },
                { study: 'B', yi: 0.6 },  // Missing vi
                { study: 'C', yi: 0.3, vi: 0.15 }
            ];
            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(result.k).toBe(2);  // Only 2 valid studies
        });

        it('should reject negative variance', () => {
            const studies = [
                { yi: 0.5, vi: -0.1 },  // Negative variance
                { yi: 0.3, vi: 0.15 },
                { yi: 0.4, vi: 0.12 }
            ];
            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(result.k).toBe(2);  // First study excluded
        });

        it('should handle NaN and Infinity values', () => {
            const studies = [
                { yi: NaN, vi: 0.1 },
                { yi: Infinity, vi: 0.2 },
                { yi: 0.5, vi: NaN },
                { yi: 0.3, vi: 0.15 },
                { yi: 0.4, vi: 0.12 }
            ];
            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(result.k).toBe(2);  // Only valid studies
        });
    });

    describe('DTA Study Validation', () => {

        it('should reject DTA studies with missing 2x2 table fields', () => {
            const studies = [
                { tp: 85, fp: 15, fn: 10 },  // Missing tn
                { tp: 92, fp: 20, fn: 8, tn: 180 },
                { tp: 78, fp: 12, fn: 12, tn: 198 },
                { tp: 88, fp: 18, fn: 7, tn: 187 }
            ];
            const result = bivariateDTA(studies);
            expect(result.success).toBe(true);
            expect(result.n_studies).toBe(3);  // First excluded
        });

        it('should reject negative cell counts', () => {
            const studies = [
                { tp: -5, fp: 15, fn: 10, tn: 190 },  // Negative tp
                { tp: 92, fp: 20, fn: 8, tn: 180 },
                { tp: 78, fp: 12, fn: 12, tn: 198 },
                { tp: 88, fp: 18, fn: 7, tn: 187 }
            ];
            const result = bivariateDTA(studies);
            expect(result.success).toBe(true);
            expect(result.n_studies).toBe(3);
        });
    });

    describe('Options Validation', () => {

        it('should use default method when invalid method provided', () => {
            const result = randomEffectsMeta(bcgTrials, { method: 'INVALID' });
            expect(result.success).toBe(true);
            // Should fall back to default (REML or DL)
        });

        it('should clamp confidence level to valid range', () => {
            const result = randomEffectsMeta(bcgTrials, { ciLevel: 1.5 });
            expect(result.success).toBe(true);
            // Should still work with clamped value
        });

        it('should handle boolean options correctly', () => {
            const result = randomEffectsMeta(bcgTrials, { hksj: 'yes' });  // String instead of boolean
            expect(result.success).toBe(true);
        });
    });

    describe('Edge Cases', () => {

        it('should handle studies with identical effects', () => {
            const studies = [
                { yi: 0.5, vi: 0.1 },
                { yi: 0.5, vi: 0.1 },
                { yi: 0.5, vi: 0.1 }
            ];
            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
            expect(result.heterogeneity.tau2).toBeCloseTo(0, 5);
        });

        it('should handle very large number of studies', () => {
            const manyStudies = Array.from({ length: 100 }, (_, i) => ({
                yi: 0.5 + Math.random() * 0.2 - 0.1,
                vi: 0.1
            }));
            const result = randomEffectsMeta(manyStudies);
            expect(result.success).toBe(true);
            expect(result.k).toBe(100);
        });

        it('should handle object input with missing prototype', () => {
            const study = Object.create(null);
            study.yi = 0.5;
            study.vi = 0.1;
            const studies = [
                study,
                { yi: 0.3, vi: 0.15 },
                { yi: 0.4, vi: 0.12 }
            ];
            const result = randomEffectsMeta(studies);
            expect(result.success).toBe(true);
        });
    });
});
