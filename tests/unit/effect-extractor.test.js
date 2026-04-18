/**
 * Effect Extractor Unit Tests
 * Tests for regex pattern matching and effect size extraction
 */

import { describe, it, expect } from 'vitest';
import { extractEffect, parseEffectSize, detectEffectType } from '../../src/extraction/effect-extractor.js';
import { effectPatterns } from '../fixtures/sample-studies.js';

describe('Effect Extractor', () => {

    describe('Basic Pattern Matching', () => {

        it('should extract HR with parentheses format', () => {
            const result = extractEffect('HR 0.78 (95% CI, 0.72 to 0.84)');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(0.78, 2);
            expect(result.ci_lower).toBeCloseTo(0.72, 2);
            expect(result.ci_upper).toBeCloseTo(0.84, 2);
            expect(result.effect_type).toBe('HR');
        });

        it('should extract effect with dash format CI', () => {
            const result = extractEffect('hazard ratio 0.65 (0.55-0.77)');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(0.65, 2);
            expect(result.ci_lower).toBeCloseTo(0.55, 2);
            expect(result.ci_upper).toBeCloseTo(0.77, 2);
        });

        it('should extract effect with bracket format CI', () => {
            const result = extractEffect('RR=1.25 [1.10, 1.42]');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(1.25, 2);
            expect(result.ci_lower).toBeCloseTo(1.10, 2);
            expect(result.ci_upper).toBeCloseTo(1.42, 2);
            expect(result.effect_type).toBe('RR');
        });

        it('should extract OR with P-value', () => {
            const result = extractEffect('OR 2.15 (95%CI: 1.50-3.08); P<0.001');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(2.15, 2);
            expect(result.ci_lower).toBeCloseTo(1.50, 2);
            expect(result.ci_upper).toBeCloseTo(3.08, 2);
            expect(result.effect_type).toBe('OR');
            expect(result.p_value).toBeLessThanOrEqual(0.001);
        });

        it('should handle reference category', () => {
            const result = extractEffect('1.00 (reference)');

            expect(result.success).toBe(true);
            expect(result.value).toBe(1.0);
            expect(result.is_reference).toBe(true);
        });

        it('should handle spelled out confidence interval', () => {
            const result = extractEffect('odds ratio of 0.72 (95% confidence interval 0.58 to 0.89)');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(0.72, 2);
            expect(result.ci_lower).toBeCloseTo(0.58, 2);
            expect(result.ci_upper).toBeCloseTo(0.89, 2);
        });

        it('should extract semicolon-separated format', () => {
            const result = extractEffect('HR 0.82; 95% CI 0.74-0.91; P=0.0003');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(0.82, 2);
            expect(result.ci_lower).toBeCloseTo(0.74, 2);
            expect(result.ci_upper).toBeCloseTo(0.91, 2);
            expect(result.p_value).toBeCloseTo(0.0003, 4);
        });
    });

    describe('P-value Extraction', () => {

        it('should extract P < 0.001', () => {
            const result = extractEffect('HR 0.75 (0.65-0.85), P<0.001');

            expect(result.p_value).toBeLessThanOrEqual(0.001);
            expect(result.p_operator).toBe('<');
        });

        it('should extract P = 0.03', () => {
            const result = extractEffect('RR 1.2 (1.01-1.42), P=0.03');

            expect(result.p_value).toBeCloseTo(0.03, 2);
            expect(result.p_operator).toBe('=');
        });

        it('should extract P > 0.05', () => {
            const result = extractEffect('OR 1.05 (0.85-1.30), P>0.05');

            expect(result.p_value).toBeGreaterThanOrEqual(0.05);
            expect(result.p_operator).toBe('>');
        });

        it('should handle NS (not significant)', () => {
            const result = extractEffect('HR 0.98 (0.82-1.17), NS');

            expect(result.p_value).toBeGreaterThan(0.05);
        });
    });

    describe('Effect Type Detection', () => {

        it('should detect hazard ratio', () => {
            expect(detectEffectType('HR 0.75')).toBe('HR');
            expect(detectEffectType('hazard ratio 0.75')).toBe('HR');
            expect(detectEffectType('Hazard Ratio: 0.75')).toBe('HR');
        });

        it('should detect risk ratio', () => {
            expect(detectEffectType('RR 1.25')).toBe('RR');
            expect(detectEffectType('risk ratio 1.25')).toBe('RR');
            expect(detectEffectType('relative risk 1.25')).toBe('RR');
        });

        it('should detect odds ratio', () => {
            expect(detectEffectType('OR 2.0')).toBe('OR');
            expect(detectEffectType('odds ratio 2.0')).toBe('OR');
        });

        it('should detect mean difference', () => {
            expect(detectEffectType('MD -2.5')).toBe('MD');
            expect(detectEffectType('mean difference -2.5')).toBe('MD');
        });

        it('should detect standardized mean difference', () => {
            expect(detectEffectType('SMD 0.5')).toBe('SMD');
            expect(detectEffectType("Cohen's d 0.5")).toBe('SMD');
            expect(detectEffectType("Hedges' g 0.5")).toBe('SMD');
        });
    });

    describe('Edge Cases', () => {

        it('should handle negative effects (mean difference)', () => {
            const result = extractEffect('MD -5.2 (-8.1 to -2.3)');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(-5.2, 1);
            expect(result.ci_lower).toBeCloseTo(-8.1, 1);
            expect(result.ci_upper).toBeCloseTo(-2.3, 1);
        });

        it('should handle very small effects', () => {
            const result = extractEffect('HR 0.001 (0.0005-0.002)');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(0.001, 4);
        });

        it('should handle very large effects', () => {
            const result = extractEffect('OR 150.5 (45.2-502.3)');

            expect(result.success).toBe(true);
            expect(result.value).toBeCloseTo(150.5, 1);
        });

        it('should return failure for no effect found', () => {
            const result = extractEffect('The study showed improvement in outcomes');

            expect(result.success).toBe(false);
        });

        it('should handle NE (not estimable)', () => {
            const result = extractEffect('HR NE');

            expect(result.success).toBe(true);
            expect(result.value).toBeNull();
            expect(result.not_estimable).toBe(true);
        });

        it('should handle 90% CI', () => {
            const result = extractEffect('HR 0.75 (90% CI: 0.60-0.94)');

            expect(result.success).toBe(true);
            expect(result.ci_level).toBe(90);
        });

        it('should handle 99% CI', () => {
            const result = extractEffect('OR 1.5 (99% CI 1.1 to 2.0)');

            expect(result.success).toBe(true);
            expect(result.ci_level).toBe(99);
        });
    });

    describe('Fixture Validation', () => {

        it.each(effectPatterns)('should correctly parse: $text', ({ text, expected }) => {
            const result = extractEffect(text);

            expect(result.success).toBe(true);

            if (expected.value !== undefined) {
                expect(result.value).toBeCloseTo(expected.value, 2);
            }
            if (expected.ci_lower !== undefined) {
                expect(result.ci_lower).toBeCloseTo(expected.ci_lower, 2);
            }
            if (expected.ci_upper !== undefined) {
                expect(result.ci_upper).toBeCloseTo(expected.ci_upper, 2);
            }
            if (expected.type !== undefined) {
                expect(result.effect_type).toBe(expected.type);
            }
            if (expected.is_reference !== undefined) {
                expect(result.is_reference).toBe(expected.is_reference);
            }
        });
    });
});

describe('Variance Calculation', () => {

    it('should calculate variance from CI correctly', () => {
        // For a 95% CI, variance = ((ci_upper - ci_lower) / 3.92)^2
        const result = extractEffect('HR 0.75 (0.65-0.87)');

        const expectedSE = (Math.log(0.87) - Math.log(0.65)) / 3.92;
        const expectedVar = expectedSE * expectedSE;

        expect(result.vi).toBeCloseTo(expectedVar, 4);
    });

    it('should calculate SE from CI', () => {
        const result = extractEffect('MD 5.0 (2.0 to 8.0)');

        const expectedSE = (8.0 - 2.0) / 3.92;
        expect(result.se).toBeCloseTo(expectedSE, 2);
    });
});
