/**
 * Validator Module
 * Cross-validation checks for extracted data
 *
 * @module validator
 */

/**
 * Validate complete extracted data
 * @param {Object} data - Extracted trial data
 * @returns {Object} Validation report
 */
export function validateExtraction(data) {
    const report = {
        valid: true,
        errors: [],
        warnings: [],
        checks: {}
    };

    // Run all validation checks
    const checks = [
        checkEffectEstimates,
        checkConfidenceIntervals,
        checkEventCounts,
        checkSampleSizeConsistency,
        checkPValueConsistency,
        checkBaselineBalance,
        checkOutcomeCompleteness
    ];

    for (const check of checks) {
        const result = check(data);
        report.checks[result.name] = result;

        if (!result.passed) {
            if (result.severity === 'error') {
                report.errors.push(...result.issues);
                report.valid = false;
            } else {
                report.warnings.push(...result.issues);
            }
        }
    }

    report.summary = generateSummary(report);

    return report;
}

/**
 * Check effect estimates are valid
 */
function checkEffectEstimates(data) {
    const issues = [];
    const outcomes = data.outcomes || [];

    for (const outcome of outcomes) {
        const effect = outcome.effect || outcome;

        // Check HR/RR/OR is positive
        if (effect.value != null && effect.value <= 0) {
            issues.push({
                outcome: outcome.name || 'unknown',
                issue: `Effect estimate is non-positive (${effect.value})`,
                severity: 'error'
            });
        }

        // Check for unrealistic values
        if (effect.value != null && (effect.value > 10 || effect.value < 0.1)) {
            issues.push({
                outcome: outcome.name || 'unknown',
                issue: `Effect estimate is extreme (${effect.value})`,
                severity: 'warning'
            });
        }
    }

    return {
        name: 'effect_estimates',
        passed: issues.filter(i => i.severity === 'error').length === 0,
        severity: issues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issues
    };
}

/**
 * Check confidence intervals are valid
 */
function checkConfidenceIntervals(data) {
    const issues = [];
    const outcomes = data.outcomes || [];

    for (const outcome of outcomes) {
        const effect = outcome.effect || outcome;

        if (effect.ci_lower != null && effect.ci_upper != null) {
            // Check bounds order
            if (effect.ci_lower > effect.ci_upper) {
                issues.push({
                    outcome: outcome.name || 'unknown',
                    issue: `CI lower (${effect.ci_lower}) > upper (${effect.ci_upper})`,
                    severity: 'error'
                });
            }

            // Check point estimate within CI
            if (effect.value != null) {
                if (effect.value < effect.ci_lower || effect.value > effect.ci_upper) {
                    issues.push({
                        outcome: outcome.name || 'unknown',
                        issue: `Point estimate (${effect.value}) outside CI (${effect.ci_lower}-${effect.ci_upper})`,
                        severity: 'error'
                    });
                }
            }

            // Check for negative bounds on ratio scales
            if (effect.ci_lower < 0) {
                const type = effect.effect_type || 'ratio';
                if (['HR', 'RR', 'OR', 'IRR'].includes(type)) {
                    issues.push({
                        outcome: outcome.name || 'unknown',
                        issue: `Negative CI lower bound for ${type}`,
                        severity: 'error'
                    });
                }
            }

            // Check CI width is reasonable
            const ciWidth = effect.ci_upper - effect.ci_lower;
            const relWidth = effect.value ? ciWidth / effect.value : null;
            if (relWidth && relWidth > 2) {
                issues.push({
                    outcome: outcome.name || 'unknown',
                    issue: `Very wide confidence interval (width = ${ciWidth.toFixed(2)})`,
                    severity: 'warning'
                });
            }
        }
    }

    return {
        name: 'confidence_intervals',
        passed: issues.filter(i => i.severity === 'error').length === 0,
        severity: issues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issues
    };
}

/**
 * Check event counts are valid
 */
function checkEventCounts(data) {
    const issues = [];
    const outcomes = data.outcomes || [];

    for (const outcome of outcomes) {
        const treatment = outcome.treatment || outcome.events_treatment;
        const control = outcome.control || outcome.events_control;

        // Check treatment arm
        if (treatment) {
            if (treatment.events != null && treatment.total != null) {
                if (treatment.events > treatment.total) {
                    issues.push({
                        outcome: outcome.name || 'unknown',
                        arm: 'treatment',
                        issue: `Events (${treatment.events}) > total (${treatment.total})`,
                        severity: 'error'
                    });
                }

                // Check rate consistency
                if (treatment.rate != null) {
                    const expectedRate = (treatment.events / treatment.total) * 100;
                    if (Math.abs(treatment.rate - expectedRate) > 1) {
                        issues.push({
                            outcome: outcome.name || 'unknown',
                            arm: 'treatment',
                            issue: `Rate (${treatment.rate}%) inconsistent with events/total (${expectedRate.toFixed(1)}%)`,
                            severity: 'warning'
                        });
                    }
                }
            }
        }

        // Check control arm
        if (control) {
            if (control.events != null && control.total != null) {
                if (control.events > control.total) {
                    issues.push({
                        outcome: outcome.name || 'unknown',
                        arm: 'control',
                        issue: `Events (${control.events}) > total (${control.total})`,
                        severity: 'error'
                    });
                }
            }
        }
    }

    return {
        name: 'event_counts',
        passed: issues.filter(i => i.severity === 'error').length === 0,
        severity: issues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issues
    };
}

/**
 * Check sample size consistency across tables
 */
function checkSampleSizeConsistency(data) {
    const issues = [];

    const populationN = data.population?.n_randomized;
    const treatmentN = data.population?.n_treatment;
    const controlN = data.population?.n_control;

    // Check total equals sum
    if (populationN && treatmentN && controlN) {
        if (Math.abs(populationN - (treatmentN + controlN)) > 1) {
            issues.push({
                issue: `Total N (${populationN}) doesn't equal treatment + control (${treatmentN} + ${controlN})`,
                severity: 'error'
            });
        }
    }

    // Check baseline table matches
    const baselineN = data.baseline?.sample_sizes;
    if (baselineN && populationN) {
        if (baselineN.total && Math.abs(baselineN.total - populationN) > 10) {
            issues.push({
                issue: `Baseline table N (${baselineN.total}) differs from reported N (${populationN})`,
                severity: 'warning'
            });
        }
    }

    // Check outcome denominators
    const outcomes = data.outcomes || [];
    for (const outcome of outcomes) {
        const outcomeTreatN = outcome.treatment?.total || outcome.n_treatment;
        const outcomeControlN = outcome.control?.total || outcome.n_control;

        if (treatmentN && outcomeTreatN && Math.abs(treatmentN - outcomeTreatN) > 50) {
            issues.push({
                outcome: outcome.name || 'unknown',
                issue: `Outcome treatment N (${outcomeTreatN}) differs significantly from total treatment N (${treatmentN})`,
                severity: 'warning'
            });
        }
    }

    return {
        name: 'sample_size_consistency',
        passed: issues.filter(i => i.severity === 'error').length === 0,
        severity: issues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issues
    };
}

/**
 * Check p-value consistency with CI
 * Implements tolerance for edge cases around p=0.05 and CI boundaries
 */
function checkPValueConsistency(data) {
    const issues = [];
    const outcomes = data.outcomes || [];

    for (const outcome of outcomes) {
        const effect = outcome.effect || outcome;

        if (effect.p_value != null && effect.ci_lower != null && effect.ci_upper != null) {
            // Determine null value based on effect type
            const type = effect.effect_type || effect.type || 'HR';
            const isRatio = ['HR', 'RR', 'OR', 'IRR'].includes(type);
            const nullValue = isRatio ? 1 : 0;

            // Check if CI excludes null with tolerance for edge cases
            // For ratios, consider small relative margins
            // For differences, consider small absolute margins
            const tolerance = isRatio ? 0.02 : 0.01; // 2% for ratios, 0.01 for differences
            const marginLower = isRatio
                ? Math.abs(effect.ci_lower - nullValue) / nullValue
                : Math.abs(effect.ci_lower - nullValue);
            const marginUpper = isRatio
                ? Math.abs(effect.ci_upper - nullValue) / nullValue
                : Math.abs(effect.ci_upper - nullValue);

            const excludesNull = effect.ci_lower > nullValue || effect.ci_upper < nullValue;
            const nearBoundary = marginLower < tolerance || marginUpper < tolerance;

            // Define p-value edge zone (0.04 to 0.06)
            const pNearThreshold = effect.p_value >= 0.04 && effect.p_value <= 0.06;

            // P < 0.05 should correspond to CI excluding null
            // But allow edge cases where both are near the boundary
            if (excludesNull && effect.p_value >= 0.05) {
                // Only flag if NOT an edge case
                if (!(pNearThreshold && nearBoundary)) {
                    issues.push({
                        outcome: outcome.name || 'unknown',
                        issue: `CI excludes ${nullValue} but P = ${effect.p_value.toFixed(3)} >= 0.05`,
                        severity: 'warning',
                        edge_case: pNearThreshold || nearBoundary
                    });
                }
            }

            if (!excludesNull && effect.p_value < 0.05 && effect.p_operator !== '<') {
                // Only flag if NOT an edge case
                if (!(pNearThreshold && nearBoundary)) {
                    issues.push({
                        outcome: outcome.name || 'unknown',
                        issue: `CI includes ${nullValue} but P = ${effect.p_value.toFixed(3)} < 0.05`,
                        severity: 'warning',
                        edge_case: pNearThreshold || nearBoundary
                    });
                }
            }

            // Check p-value range
            if (effect.p_value < 0 || effect.p_value > 1) {
                issues.push({
                    outcome: outcome.name || 'unknown',
                    issue: `Invalid P-value: ${effect.p_value}`,
                    severity: 'error'
                });
            }

            // Additional check: very small p-value should have CI clearly excluding null
            if (effect.p_value < 0.001 && !excludesNull) {
                issues.push({
                    outcome: outcome.name || 'unknown',
                    issue: `P < 0.001 but CI includes null (${effect.ci_lower.toFixed(2)} to ${effect.ci_upper.toFixed(2)})`,
                    severity: 'warning',
                    note: 'May indicate reporting error or mismatched outcomes'
                });
            }
        }
    }

    return {
        name: 'pvalue_consistency',
        passed: issues.filter(i => i.severity === 'error').length === 0,
        severity: issues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issues
    };
}

/**
 * Check baseline characteristics balance
 */
function checkBaselineBalance(data) {
    const issues = [];
    const baseline = data.baseline?.characteristics || [];

    for (const char of baseline) {
        const treatment = char.treatment;
        const control = char.control;

        if (!treatment || !control) continue;

        if (char.type === 'continuous') {
            // Check for large differences (>0.5 SD)
            const diff = Math.abs((treatment.mean || 0) - (control.mean || 0));
            const pooledSD = Math.sqrt(
                (Math.pow(treatment.sd || 0, 2) + Math.pow(control.sd || 0, 2)) / 2
            );

            if (pooledSD > 0 && diff / pooledSD > 0.5) {
                issues.push({
                    characteristic: char.label,
                    issue: `Large imbalance: SMD = ${(diff / pooledSD).toFixed(2)}`,
                    severity: 'warning'
                });
            }
        } else if (char.type === 'categorical') {
            const diff = Math.abs((treatment.percentage || 0) - (control.percentage || 0));
            if (diff > 10) {
                issues.push({
                    characteristic: char.label,
                    issue: `Large imbalance: ${diff.toFixed(1)}% difference`,
                    severity: 'warning'
                });
            }
        }
    }

    return {
        name: 'baseline_balance',
        passed: issues.length < 3, // Allow some imbalances
        severity: 'warning',
        issues
    };
}

/**
 * Check outcome data completeness
 */
function checkOutcomeCompleteness(data) {
    const issues = [];
    const outcomes = data.outcomes || [];

    const requiredFields = ['value', 'ci_lower', 'ci_upper'];

    for (const outcome of outcomes) {
        const effect = outcome.effect || outcome;
        const missing = [];

        for (const field of requiredFields) {
            if (effect[field] == null) {
                missing.push(field);
            }
        }

        if (missing.length > 0) {
            issues.push({
                outcome: outcome.name || 'unknown',
                issue: `Missing: ${missing.join(', ')}`,
                severity: missing.includes('value') ? 'error' : 'warning'
            });
        }

        // Check for event counts
        if (!outcome.treatment?.events && !outcome.events_treatment) {
            issues.push({
                outcome: outcome.name || 'unknown',
                issue: 'Missing treatment event counts',
                severity: 'warning'
            });
        }
    }

    // Check for primary outcome
    const hasPrimary = outcomes.some(o =>
        o.is_primary ||
        /primary/i.test(o.name || '') ||
        o.mapped === 'composite_cv_death_hfh'
    );

    if (!hasPrimary && outcomes.length > 0) {
        issues.push({
            issue: 'Primary outcome not clearly identified',
            severity: 'warning'
        });
    }

    return {
        name: 'outcome_completeness',
        passed: issues.filter(i => i.severity === 'error').length === 0,
        severity: issues.some(i => i.severity === 'error') ? 'error' : 'warning',
        issues
    };
}

/**
 * Generate validation summary
 */
function generateSummary(report) {
    const passed = Object.values(report.checks).filter(c => c.passed).length;
    const total = Object.keys(report.checks).length;

    return {
        overall: report.valid ? 'PASS' : 'FAIL',
        checks_passed: passed,
        checks_total: total,
        error_count: report.errors.length,
        warning_count: report.warnings.length,
        message: report.valid
            ? `All critical checks passed (${passed}/${total}). ${report.warnings.length} warnings.`
            : `Validation failed with ${report.errors.length} errors. ${report.warnings.length} warnings.`
    };
}

/**
 * Flag data points requiring manual review
 * @param {Object} data - Extracted data
 * @param {Object} confidenceScores - Confidence scores
 * @returns {Array} Items requiring review
 */
export function flagForReview(data, confidenceScores) {
    const reviewItems = [];
    const threshold = 0.7;

    // Check outcomes
    const outcomes = data.outcomes || [];
    for (const outcome of outcomes) {
        const confidence = confidenceScores?.outcomes?.[outcome.name] || outcome.confidence;

        if (confidence && confidence < threshold) {
            reviewItems.push({
                type: 'outcome',
                item: outcome.name || 'unknown',
                confidence,
                reason: 'Low extraction confidence'
            });
        }
    }

    // Check baseline
    const characteristics = data.baseline?.characteristics || [];
    for (const char of characteristics) {
        if (char.unmapped) {
            reviewItems.push({
                type: 'baseline',
                item: char.label,
                reason: 'Unmapped characteristic'
            });
        }
    }

    // Check for potential OCR errors
    const text = data.raw_text || '';
    const ocrPatterns = [
        { pattern: /\bl\d+\b/, issue: 'Possible "1" misread as "l"' },
        { pattern: /\bO\d+\b/, issue: 'Possible "0" misread as "O"' },
        { pattern: /\d+[,\.]\s+\d+/, issue: 'Possible decimal point issue' }
    ];

    for (const { pattern, issue } of ocrPatterns) {
        if (pattern.test(text)) {
            reviewItems.push({
                type: 'text',
                reason: issue
            });
            break;
        }
    }

    return reviewItems;
}

export default {
    validateExtraction,
    flagForReview
};
