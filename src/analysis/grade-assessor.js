/**
 * GRADE Certainty Assessment Module
 *
 * Implements the full GRADE (Grading of Recommendations Assessment,
 * Development and Evaluation) framework for assessing certainty of evidence.
 *
 * Reference: Guyatt GH, et al. GRADE guidelines. J Clin Epidemiol. 2011;64(4):383-94.
 *
 * Five domains for downgrading:
 * 1. Risk of Bias - methodological limitations
 * 2. Inconsistency - unexplained heterogeneity
 * 3. Indirectness - indirect population, intervention, comparison, or outcome
 * 4. Imprecision - wide confidence intervals
 * 5. Publication Bias - missing studies
 *
 * Three domains for upgrading (observational studies):
 * 1. Large magnitude of effect
 * 2. Dose-response gradient
 * 3. Plausible confounding would reduce effect
 */

// GRADE certainty levels
export const CertaintyLevel = {
    HIGH: 4,
    MODERATE: 3,
    LOW: 2,
    VERY_LOW: 1
};

export const CertaintyLabels = {
    4: { symbol: '⊕⊕⊕⊕', text: 'High', description: 'Very confident the true effect lies close to estimate' },
    3: { symbol: '⊕⊕⊕◯', text: 'Moderate', description: 'Moderately confident; true effect likely close to estimate' },
    2: { symbol: '⊕⊕◯◯', text: 'Low', description: 'Limited confidence; true effect may be substantially different' },
    1: { symbol: '⊕◯◯◯', text: 'Very Low', description: 'Very little confidence; true effect likely substantially different' }
};

// Domain assessment criteria
export const DomainCriteria = {
    riskOfBias: {
        name: 'Risk of Bias',
        description: 'Methodological limitations in included studies',
        factors: [
            { id: 'randomization', label: 'Randomization sequence generation', weight: 1 },
            { id: 'allocation', label: 'Allocation concealment', weight: 1 },
            { id: 'blinding_participants', label: 'Blinding of participants/personnel', weight: 1 },
            { id: 'blinding_outcome', label: 'Blinding of outcome assessment', weight: 1 },
            { id: 'attrition', label: 'Incomplete outcome data', weight: 1 },
            { id: 'selective_reporting', label: 'Selective reporting', weight: 1 },
            { id: 'other_bias', label: 'Other bias', weight: 0.5 }
        ]
    },
    inconsistency: {
        name: 'Inconsistency',
        description: 'Unexplained heterogeneity across studies',
        thresholds: {
            I2_low: 25,
            I2_moderate: 50,
            I2_high: 75
        }
    },
    indirectness: {
        name: 'Indirectness',
        description: 'Indirect evidence regarding PICO',
        factors: [
            { id: 'population', label: 'Population differs from target', weight: 1 },
            { id: 'intervention', label: 'Intervention differs', weight: 1 },
            { id: 'comparison', label: 'Comparison differs', weight: 1 },
            { id: 'outcome', label: 'Outcome is surrogate', weight: 1 }
        ]
    },
    imprecision: {
        name: 'Imprecision',
        description: 'Wide confidence intervals or small sample size',
        thresholds: {
            ois_events: 300,        // Optimal Information Size for dichotomous
            ois_continuous: 400,    // OIS for continuous outcomes
            ci_width_ratio: 1.25    // CI crossing clinically important threshold
        }
    },
    publicationBias: {
        name: 'Publication Bias',
        description: 'Suspicion of missing studies',
        factors: [
            { id: 'funnel_asymmetry', label: 'Funnel plot asymmetry', weight: 1 },
            { id: 'eggers_test', label: 'Egger\'s test significant', weight: 1 },
            { id: 'small_study_effect', label: 'Small study effects', weight: 0.5 },
            { id: 'industry_funding', label: 'Industry-funded studies dominant', weight: 0.5 }
        ]
    }
};

/**
 * Main GRADE Assessor Class
 */
export class GRADEAssessor {
    constructor() {
        this.assessments = new Map();
        this.auditLog = [];
    }

    /**
     * Assess certainty for an outcome
     * @param {Object} outcome - Outcome data
     * @param {Object} metaAnalysisResults - Results from meta-analysis
     * @param {Object} studyData - Individual study data
     * @param {Object} options - Assessment options
     * @returns {Object} Complete GRADE assessment
     */
    assessOutcome(outcome, metaAnalysisResults, studyData, options = {}) {
        const assessmentId = `${outcome.name}_${Date.now()}`;

        // Start with baseline certainty (RCTs start HIGH, observational starts LOW)
        const studyDesign = options.studyDesign || 'rct';
        let baselineCertainty = studyDesign === 'rct' ? CertaintyLevel.HIGH : CertaintyLevel.LOW;

        // Assess each domain
        const domains = {
            riskOfBias: this.assessRiskOfBias(studyData, options.robAssessment),
            inconsistency: this.assessInconsistency(metaAnalysisResults),
            indirectness: this.assessIndirectness(outcome, options.picoMatch),
            imprecision: this.assessImprecision(outcome, metaAnalysisResults, options),
            publicationBias: this.assessPublicationBias(metaAnalysisResults, options.publicationBiasData)
        };

        // Calculate total downgrade
        let totalDowngrade = 0;
        const downgradeReasons = [];

        Object.entries(domains).forEach(([domain, assessment]) => {
            if (assessment.downgrade > 0) {
                totalDowngrade += assessment.downgrade;
                downgradeReasons.push({
                    domain,
                    level: assessment.downgrade,
                    reason: assessment.reason
                });
            }
        });

        // Check for upgrades (only for observational studies)
        let totalUpgrade = 0;
        const upgradeReasons = [];

        if (studyDesign === 'observational') {
            const upgrades = this.assessUpgradeDomains(outcome, metaAnalysisResults);
            totalUpgrade = upgrades.total;
            upgradeReasons.push(...upgrades.reasons);
        }

        // Calculate final certainty
        let finalCertainty = baselineCertainty - totalDowngrade + totalUpgrade;
        finalCertainty = Math.max(CertaintyLevel.VERY_LOW, Math.min(CertaintyLevel.HIGH, finalCertainty));

        const assessment = {
            id: assessmentId,
            outcome: outcome.name,
            timestamp: new Date().toISOString(),
            studyDesign,
            baselineCertainty,
            domains,
            totalDowngrade,
            downgradeReasons,
            totalUpgrade,
            upgradeReasons,
            finalCertainty,
            certaintyLabel: CertaintyLabels[finalCertainty],
            manualOverrides: options.manualOverrides || {},
            notes: options.notes || ''
        };

        this.assessments.set(assessmentId, assessment);
        this.logAction('assessment', assessmentId, assessment);

        return assessment;
    }

    /**
     * Assess Risk of Bias domain
     */
    assessRiskOfBias(studyData, robAssessment = {}) {
        const studies = studyData?.studies || [];

        if (studies.length === 0 && Object.keys(robAssessment).length === 0) {
            return {
                score: null,
                downgrade: 0,
                reason: 'Insufficient data for assessment',
                details: null
            };
        }

        // If manual ROB assessment provided, use it
        if (robAssessment.overall) {
            const downgradeMap = {
                'low': 0,
                'some_concerns': 1,
                'high': 2
            };
            return {
                score: robAssessment.overall,
                downgrade: downgradeMap[robAssessment.overall] || 0,
                reason: robAssessment.reason || `Overall risk of bias: ${robAssessment.overall}`,
                details: robAssessment
            };
        }

        // Automated assessment based on study characteristics
        let riskScore = 0;
        const issues = [];

        studies.forEach(study => {
            // Check for common bias indicators
            if (!study.randomization || study.randomization === 'unclear') {
                riskScore += 0.5;
                issues.push(`${study.name}: unclear randomization`);
            }
            if (!study.blinding || study.blinding === 'open-label') {
                riskScore += 0.5;
                issues.push(`${study.name}: open-label design`);
            }
            if (study.attrition_rate > 20) {
                riskScore += 0.5;
                issues.push(`${study.name}: high attrition (${study.attrition_rate}%)`);
            }
            if (study.intention_to_treat === false) {
                riskScore += 0.3;
                issues.push(`${study.name}: per-protocol analysis only`);
            }
        });

        // Normalize by number of studies
        const normalizedScore = studies.length > 0 ? riskScore / studies.length : 0;

        let downgrade = 0;
        let overallRisk = 'low';

        if (normalizedScore >= 1.0) {
            downgrade = 2;
            overallRisk = 'high';
        } else if (normalizedScore >= 0.5) {
            downgrade = 1;
            overallRisk = 'some_concerns';
        }

        return {
            score: normalizedScore,
            downgrade,
            reason: downgrade > 0 ? `Risk of bias: ${overallRisk} (${issues.slice(0, 3).join('; ')})` : 'Low risk of bias',
            details: { issues, overallRisk, normalizedScore }
        };
    }

    /**
     * Assess Inconsistency domain (heterogeneity)
     */
    assessInconsistency(metaAnalysisResults) {
        if (!metaAnalysisResults?.heterogeneity) {
            return {
                score: null,
                downgrade: 0,
                reason: 'Single study or insufficient data',
                details: null
            };
        }

        const { I2, Q, Q_pvalue, tau2 } = metaAnalysisResults.heterogeneity;
        const I2Percent = I2 * 100;

        let downgrade = 0;
        let severity = 'low';
        const issues = [];

        // I-squared assessment per Cochrane guidance
        if (I2Percent >= 75) {
            downgrade = 2;
            severity = 'considerable';
            issues.push(`I² = ${I2Percent.toFixed(1)}% (considerable heterogeneity)`);
        } else if (I2Percent >= 50) {
            downgrade = 1;
            severity = 'substantial';
            issues.push(`I² = ${I2Percent.toFixed(1)}% (substantial heterogeneity)`);
        } else if (I2Percent >= 25) {
            // Moderate heterogeneity - consider downgrading if Q-test significant
            if (Q_pvalue && Q_pvalue < 0.10) {
                downgrade = 1;
                severity = 'moderate';
                issues.push(`I² = ${I2Percent.toFixed(1)}% with significant Q-test (p=${Q_pvalue.toFixed(3)})`);
            }
        }

        // Check if CIs overlap
        if (metaAnalysisResults.studies?.length > 1) {
            const overlapScore = this.calculateCIOverlap(metaAnalysisResults.studies);
            if (overlapScore < 0.3 && downgrade === 0) {
                downgrade = 1;
                issues.push('Poor confidence interval overlap between studies');
            }
        }

        // Check prediction interval
        if (metaAnalysisResults.predictionInterval) {
            const { lower, upper } = metaAnalysisResults.predictionInterval;
            // If prediction interval crosses null AND clinical thresholds, consider heterogeneity important
            if (lower < 1 && upper > 1.25) {
                if (downgrade === 0) downgrade = 1;
                issues.push('Wide prediction interval suggests important heterogeneity');
            }
        }

        return {
            score: I2Percent,
            downgrade,
            reason: downgrade > 0 ? issues.join('; ') : 'Low heterogeneity',
            details: {
                I2: I2Percent,
                Q,
                Q_pvalue,
                tau2,
                severity,
                predictionInterval: metaAnalysisResults.predictionInterval
            }
        };
    }

    /**
     * Calculate overlap of confidence intervals between studies
     */
    calculateCIOverlap(studies) {
        if (studies.length < 2) return 1;

        let overlapCount = 0;
        let totalComparisons = 0;

        for (let i = 0; i < studies.length; i++) {
            for (let j = i + 1; j < studies.length; j++) {
                const s1 = studies[i];
                const s2 = studies[j];

                if (s1.ci_lower && s1.ci_upper && s2.ci_lower && s2.ci_upper) {
                    // Check if CIs overlap
                    const overlap = Math.max(0,
                        Math.min(s1.ci_upper, s2.ci_upper) - Math.max(s1.ci_lower, s2.ci_lower)
                    );
                    if (overlap > 0) overlapCount++;
                    totalComparisons++;
                }
            }
        }

        return totalComparisons > 0 ? overlapCount / totalComparisons : 1;
    }

    /**
     * Assess Indirectness domain
     */
    assessIndirectness(outcome, picoMatch = {}) {
        let downgrade = 0;
        const issues = [];

        // Population indirectness
        if (picoMatch.population === 'indirect') {
            downgrade += 0.5;
            issues.push('Population differs from target');
        } else if (picoMatch.population === 'very_indirect') {
            downgrade += 1;
            issues.push('Population substantially differs from target');
        }

        // Intervention indirectness
        if (picoMatch.intervention === 'indirect') {
            downgrade += 0.5;
            issues.push('Intervention differs from target');
        }

        // Comparison indirectness
        if (picoMatch.comparison === 'indirect') {
            downgrade += 0.5;
            issues.push('Comparator differs from clinical question');
        }

        // Outcome indirectness (surrogate outcomes)
        if (outcome.is_surrogate || picoMatch.outcome === 'surrogate') {
            downgrade += 1;
            issues.push('Surrogate outcome used');
        } else if (picoMatch.outcome === 'indirect') {
            downgrade += 0.5;
            issues.push('Outcome measurement differs from target');
        }

        // Time horizon indirectness
        if (picoMatch.followup === 'short') {
            downgrade += 0.5;
            issues.push('Follow-up duration may be too short');
        }

        // Round to max 2 levels
        downgrade = Math.min(2, Math.round(downgrade));

        return {
            score: downgrade,
            downgrade,
            reason: downgrade > 0 ? issues.join('; ') : 'Direct evidence',
            details: { picoMatch, issues }
        };
    }

    /**
     * Assess Imprecision domain with enhanced OIS calculation
     *
     * Implements GRADE guidelines for imprecision assessment including:
     * - Optimal Information Size (OIS) calculation for dichotomous and continuous outcomes
     * - Clinical decision threshold crossing
     * - Fragility assessment
     *
     * References:
     * - Guyatt GH, et al. GRADE guidelines: 6. Rating the quality of evidence—imprecision.
     *   J Clin Epidemiol. 2011;64(12):1283-93.
     * - Schünemann HJ, et al. GRADE: assessing imprecision. Cochrane Handbook Ch 15.
     */
    assessImprecision(outcome, metaAnalysisResults, options = {}) {
        let downgrade = 0;
        const issues = [];

        const effect = outcome.effect || metaAnalysisResults?.pooledEffect;
        const ciLower = outcome.ci_lower || metaAnalysisResults?.ci?.lower;
        const ciUpper = outcome.ci_upper || metaAnalysisResults?.ci?.upper;

        if (!ciLower || !ciUpper) {
            return {
                score: null,
                downgrade: 0,
                reason: 'Insufficient data for imprecision assessment',
                details: null
            };
        }

        const totalN = metaAnalysisResults?.totalSampleSize || outcome.total_n;
        const totalEvents = outcome.events || metaAnalysisResults?.totalEvents || 0;
        const outcomeType = outcome.effect_type || 'ratio';

        // Calculate Optimal Information Size (OIS) using proper formulas
        const oisResult = this.calculateOIS(outcome, metaAnalysisResults, options);
        const oisThreshold = oisResult.ois;
        const oisMethod = oisResult.method;

        // OIS criterion (GRADE criterion 1)
        if (oisResult.available) {
            const metOIS = oisResult.metOIS;
            if (!metOIS) {
                // Check severity of OIS deficit
                const oisRatio = oisResult.actualSize / oisThreshold;
                if (oisRatio < 0.25) {
                    downgrade += 2;
                    issues.push(`Severely underpowered: ${oisResult.criterion} (${oisResult.actualValue}) is <25% of OIS (${oisThreshold})`);
                } else if (oisRatio < 0.5) {
                    downgrade += 1;
                    issues.push(`Underpowered: ${oisResult.criterion} (${oisResult.actualValue}) is <50% of OIS (${oisThreshold})`);
                } else {
                    downgrade += 1;
                    issues.push(`${oisResult.criterion} (${oisResult.actualValue}) below OIS (${oisThreshold})`);
                }
            }
        }

        // Clinical decision threshold criterion (GRADE criterion 2)
        // For ratio measures (OR, RR, HR)
        if (['OR', 'RR', 'HR', 'ratio'].includes(outcomeType)) {
            const nullValue = 1;
            // GRADE recommends RRR of 25% as default clinical threshold
            const clinicalThresholdBenefit = options.mcid || 0.75;  // 25% reduction = clinical benefit
            const clinicalThresholdHarm = options.mcid_harm || 1.25;  // 25% increase = clinical harm

            // Check if CI is wide (spans from appreciable benefit to appreciable harm)
            if (ciLower < clinicalThresholdBenefit && ciUpper > clinicalThresholdHarm) {
                // CI includes both appreciable benefit AND appreciable harm
                if (downgrade < 2) {
                    downgrade = 2;
                    issues.push(`95% CI spans from appreciable benefit (<${clinicalThresholdBenefit}) to appreciable harm (>${clinicalThresholdHarm})`);
                }
            } else if (ciLower < nullValue && ciUpper > nullValue) {
                // CI crosses null only - check if it also crosses a clinical threshold
                const crossesClinicalThreshold = ciLower < clinicalThresholdBenefit || ciUpper > clinicalThresholdHarm;

                if (crossesClinicalThreshold && downgrade < 1) {
                    downgrade = Math.max(downgrade, 1);
                    issues.push(`95% CI crosses null and clinical threshold (${ciLower.toFixed(2)} to ${ciUpper.toFixed(2)})`);
                }
            } else if (!issues.some(i => i.includes('OIS'))) {
                // CI doesn't cross null - check width on log scale for additional concern
                const ciWidthLog = Math.abs(Math.log(ciUpper) - Math.log(ciLower));
                if (ciWidthLog > 1.0 && downgrade < 1) {  // CI width > e ≈ 2.7-fold range
                    downgrade = 1;
                    issues.push(`Very wide CI even though not crossing null (ratio: ${(ciUpper/ciLower).toFixed(2)})`);
                }
            }
        } else {
            // For continuous outcomes (MD, SMD)
            const mcid = options.mcid || null;
            if (mcid) {
                // With MCID defined
                if (ciLower < -mcid && ciUpper > mcid) {
                    if (downgrade < 2) {
                        downgrade = 2;
                        issues.push(`95% CI spans from clinically important benefit (<${-mcid}) to harm (>${mcid})`);
                    }
                } else if (ciLower < 0 && ciUpper > 0) {
                    // Crosses null but not both thresholds
                    const crossesThreshold = Math.abs(ciLower) > mcid || Math.abs(ciUpper) > mcid;
                    if (crossesThreshold && downgrade < 1) {
                        downgrade = Math.max(downgrade, 1);
                        issues.push('95% CI crosses null and clinical importance threshold');
                    }
                }
            } else {
                // Without MCID, use SMD-based rule of thumb
                const ciWidth = Math.abs(ciUpper - ciLower);
                // For SMD, width > 0.8 (large effect threshold) suggests imprecision
                if (ciWidth > 0.8 && downgrade < 1) {
                    downgrade = 1;
                    issues.push(`Wide CI (width = ${ciWidth.toFixed(2)} > 0.8 SMD units)`);
                }
            }
        }

        // Additional check: fragility index if available
        if (outcome.fragilityIndex !== undefined && outcome.fragilityIndex < 5) {
            if (downgrade < 1) {
                issues.push(`Low fragility index (FI=${outcome.fragilityIndex}): result could change with few event changes`);
            }
        }

        // Number of events rule for dichotomous outcomes
        // GRADE rule of thumb: < 300 total events warrants imprecision concern
        if (totalEvents > 0 && totalEvents < 300) {
            if (!issues.some(i => i.includes('events') || i.includes('OIS'))) {
                if (downgrade < 1) {
                    downgrade = 1;
                    issues.push(`Total events (${totalEvents}) < 300: insufficient for precise estimate`);
                }
            }
        }

        // Ensure maximum downgrade of 2
        downgrade = Math.min(2, downgrade);

        return {
            score: downgrade,
            downgrade,
            reason: downgrade > 0 ? issues.join('; ') : 'Adequate precision',
            details: {
                ci: { lower: ciLower, upper: ciUpper },
                sampleSize: totalN,
                events: totalEvents,
                ois: oisResult,
                clinicalThresholds: {
                    benefit: options.mcid || (outcomeType.match(/OR|RR|HR|ratio/) ? 0.75 : null),
                    harm: options.mcid_harm || (outcomeType.match(/OR|RR|HR|ratio/) ? 1.25 : null)
                },
                issues
            }
        };
    }

    /**
     * Calculate Optimal Information Size (OIS) for dichotomous or continuous outcomes
     *
     * For dichotomous outcomes, uses formula from GRADE handbook:
     * OIS = 4 * (Zα + Zβ)² / (RRR)² × CER × (1 - CER) / CER × (1 - CER)
     *
     * Simplified for RRR=25%, α=0.05, β=0.20:
     * OIS ≈ 300 events (or sample size based on event rate)
     *
     * For continuous outcomes:
     * OIS = 4 × (Zα + Zβ)² × σ² / δ²
     *
     * Where δ is the minimal clinically important difference
     *
     * Reference: Guyatt GH, et al. J Clin Epidemiol. 2011;64(12):1283-93.
     */
    calculateOIS(outcome, metaAnalysisResults, options = {}) {
        const outcomeType = outcome.effect_type || 'ratio';
        const totalN = metaAnalysisResults?.totalSampleSize || outcome.total_n || 0;
        const totalEvents = outcome.events || metaAnalysisResults?.totalEvents || 0;

        // Statistical parameters
        const alpha = options.alpha || 0.05;
        const beta = options.beta || 0.20;  // 80% power
        const Zalpha = 1.96;  // Z for two-tailed α=0.05
        const Zbeta = 0.84;   // Z for β=0.20 (80% power)
        const Z = Zalpha + Zbeta;  // ≈ 2.80

        if (['OR', 'RR', 'HR', 'ratio'].includes(outcomeType)) {
            // Dichotomous outcome OIS calculation

            // Control event rate (CER)
            const cer = options.cer || outcome.controlEventRate || 0.10;  // Default 10%

            // Relative risk reduction (RRR) - default 25% as per GRADE guidance
            const rrr = options.rrr || options.minRRR || 0.25;

            // Calculate OIS for events
            // Formula: OIS_events = 4 × (Zα + Zβ)² / RRR² × [1/(CER × (1-CER))]
            // Simplified: ≈ 300 events for RRR=25%, CER=20%

            const oisEvents = Math.ceil(
                4 * Math.pow(Z, 2) / Math.pow(rrr, 2) *
                (1 / (cer * (1 - cer)))
            );

            // Convert to sample size
            const oisSampleSize = Math.ceil(oisEvents / cer);

            // Determine which criterion to use (events or sample size)
            const useEvents = totalEvents > 0;
            const metOIS = useEvents ?
                totalEvents >= Math.min(oisEvents, 300) :
                totalN >= oisSampleSize;

            return {
                available: true,
                method: 'dichotomous_grade',
                ois: useEvents ? Math.min(oisEvents, 300) : oisSampleSize,
                oisEvents: oisEvents,
                oisSampleSize: oisSampleSize,
                actualSize: useEvents ? totalEvents : totalN,
                actualValue: useEvents ? totalEvents : totalN,
                criterion: useEvents ? 'Total events' : 'Sample size',
                metOIS: metOIS,
                parameters: {
                    cer: cer,
                    rrr: rrr,
                    alpha: alpha,
                    power: 1 - beta
                },
                notes: [
                    `CER=${(cer*100).toFixed(0)}%, RRR=${(rrr*100).toFixed(0)}%`,
                    `OIS for events: ${oisEvents}`,
                    `GRADE rule of thumb: 300 events for RRR≥25%`,
                    useEvents ?
                        `Actual events: ${totalEvents}` :
                        `Actual sample: ${totalN}`
                ]
            };
        } else {
            // Continuous outcome OIS calculation

            // Standardized effect size (SMD) threshold
            const mcid = options.mcid || 0.5;  // Default: medium effect (Cohen's d = 0.5)

            // SD - assume 1 for standardized, or use provided
            const sd = options.sd || 1;

            // OIS for continuous outcomes
            // Formula: OIS = 4 × (Zα + Zβ)² × σ² / δ²
            // For SMD with δ=0.5: OIS ≈ 126 per group (252 total)

            const oisPerGroup = Math.ceil(
                2 * Math.pow(Z, 2) * Math.pow(sd, 2) / Math.pow(mcid, 2)
            );
            const oisTotal = 2 * oisPerGroup;

            // GRADE rule of thumb: 400 participants for continuous outcomes
            const gradeThreshold = 400;
            const oisFinal = Math.max(oisTotal, gradeThreshold);

            const metOIS = totalN >= oisFinal;

            return {
                available: totalN > 0,
                method: 'continuous_grade',
                ois: oisFinal,
                oisCalculated: oisTotal,
                oisPerGroup: oisPerGroup,
                actualSize: totalN,
                actualValue: totalN,
                criterion: 'Sample size',
                metOIS: metOIS,
                parameters: {
                    mcid: mcid,
                    sd: sd,
                    alpha: alpha,
                    power: 1 - beta
                },
                notes: [
                    `MCID=${mcid} (SMD units)`,
                    `Calculated OIS: ${oisTotal} (${oisPerGroup}/group)`,
                    `GRADE rule of thumb: 400 for continuous`,
                    `Using threshold: ${oisFinal}`
                ]
            };
        }
    }

    /**
     * Assess Publication Bias domain
     */
    assessPublicationBias(metaAnalysisResults, publicationBiasData = {}) {
        let downgrade = 0;
        const issues = [];
        const nStudies = metaAnalysisResults?.studies?.length || 0;

        // Need at least 10 studies to assess publication bias reliably
        if (nStudies < 10) {
            return {
                score: null,
                downgrade: 0,
                reason: 'Too few studies (<10) to assess publication bias',
                details: { nStudies, assessable: false }
            };
        }

        // Egger's test
        if (metaAnalysisResults?.eggersTest) {
            const { pValue, intercept } = metaAnalysisResults.eggersTest;
            if (pValue < 0.10) {
                downgrade += 1;
                issues.push(`Egger's test significant (p=${pValue.toFixed(3)}, intercept=${intercept.toFixed(2)})`);
            }
        }

        // Funnel plot asymmetry (visual or statistical)
        if (publicationBiasData.funnelAsymmetry === true) {
            if (downgrade === 0) downgrade = 1;
            issues.push('Funnel plot asymmetry detected');
        }

        // Trim and fill results
        if (metaAnalysisResults?.trimAndFill) {
            const { missingStudies, adjustedEffect, originalEffect } = metaAnalysisResults.trimAndFill;
            if (missingStudies > 0) {
                const effectChange = Math.abs(adjustedEffect - originalEffect) / Math.abs(originalEffect);
                if (effectChange > 0.20) {
                    downgrade = Math.max(downgrade, 1);
                    issues.push(`Trim-and-fill suggests ${missingStudies} missing studies, ${(effectChange * 100).toFixed(0)}% effect change`);
                }
            }
        }

        // Small study effects
        if (publicationBiasData.smallStudyEffect === true) {
            if (downgrade === 0) downgrade = 1;
            issues.push('Small study effects present');
        }

        // Industry funding concerns
        if (publicationBiasData.industryFunded > 0.7) {
            issues.push('Majority of studies industry-funded');
            // This alone doesn't warrant downgrade but adds to concern
        }

        downgrade = Math.min(2, downgrade);

        return {
            score: downgrade,
            downgrade,
            reason: downgrade > 0 ? issues.join('; ') : 'No serious concern for publication bias',
            details: {
                nStudies,
                eggersTest: metaAnalysisResults?.eggersTest,
                trimAndFill: metaAnalysisResults?.trimAndFill,
                issues
            }
        };
    }

    /**
     * Assess upgrade domains for observational studies
     */
    assessUpgradeDomains(outcome, metaAnalysisResults) {
        let total = 0;
        const reasons = [];

        // 1. Large magnitude of effect
        const effect = outcome.effect || metaAnalysisResults?.pooledEffect;
        const ciLower = outcome.ci_lower || metaAnalysisResults?.ci?.lower;

        if (effect && ciLower) {
            // For ratio measures
            if (effect >= 2 && ciLower >= 1.5) {
                total += 1;
                reasons.push({ domain: 'large_effect', reason: `Large effect (RR/OR ≥2, lower CI ≥1.5)` });
            }
            if (effect >= 5 && ciLower >= 3) {
                total += 1;  // Can upgrade by 2 for very large effects
                reasons.push({ domain: 'very_large_effect', reason: `Very large effect (RR/OR ≥5)` });
            }
        }

        // 2. Dose-response gradient
        if (outcome.dose_response === true || metaAnalysisResults?.doseResponse?.significant) {
            total += 1;
            reasons.push({ domain: 'dose_response', reason: 'Clear dose-response gradient observed' });
        }

        // 3. Plausible confounding would reduce effect
        // (This typically requires manual assessment)
        if (outcome.confounding_direction === 'toward_null') {
            total += 1;
            reasons.push({ domain: 'confounding', reason: 'Plausible confounding would reduce effect' });
        }

        // Maximum upgrade is 2 levels
        total = Math.min(2, total);

        return { total, reasons };
    }

    /**
     * Apply manual override to an assessment
     */
    applyOverride(assessmentId, domain, override) {
        const assessment = this.assessments.get(assessmentId);
        if (!assessment) return null;

        const oldDowngrade = assessment.domains[domain]?.downgrade || 0;

        assessment.domains[domain] = {
            ...assessment.domains[domain],
            downgrade: override.downgrade,
            reason: override.reason,
            manualOverride: true,
            overrideBy: override.user,
            overrideDate: new Date().toISOString(),
            originalDowngrade: oldDowngrade
        };

        // Recalculate total
        assessment.totalDowngrade = Object.values(assessment.domains)
            .reduce((sum, d) => sum + (d.downgrade || 0), 0);

        let newCertainty = assessment.baselineCertainty - assessment.totalDowngrade + assessment.totalUpgrade;
        assessment.finalCertainty = Math.max(1, Math.min(4, newCertainty));
        assessment.certaintyLabel = CertaintyLabels[assessment.finalCertainty];

        this.logAction('override', assessmentId, { domain, override, oldDowngrade });

        return assessment;
    }

    /**
     * Log action for audit trail
     */
    logAction(type, assessmentId, data) {
        this.auditLog.push({
            timestamp: new Date().toISOString(),
            type,
            assessmentId,
            data
        });
    }

    /**
     * Generate Summary of Findings table
     */
    generateSoFTable(outcomes, metaAnalysisResults, studyData, options = {}) {
        const assessments = outcomes.map(outcome =>
            this.assessOutcome(outcome, metaAnalysisResults, studyData, options)
        );

        const table = {
            title: 'Summary of Findings Table',
            population: options.population || 'Not specified',
            intervention: options.intervention || 'Not specified',
            comparison: options.comparison || 'Standard care',
            outcomes: assessments.map(a => ({
                name: a.outcome,
                nStudies: metaAnalysisResults?.studies?.length || 'N/A',
                nParticipants: metaAnalysisResults?.totalSampleSize || 'N/A',
                certainty: a.certaintyLabel,
                relativeEffect: this.formatEffect(outcomes.find(o => o.name === a.outcome)),
                anticipatedEffect: this.calculateAnticipatedEffect(outcomes.find(o => o.name === a.outcome), options.baselineRisk),
                downgradeReasons: a.downgradeReasons
            })),
            footnotes: this.generateFootnotes(assessments),
            generated: new Date().toISOString()
        };

        return table;
    }

    /**
     * Format effect estimate for SoF table
     */
    formatEffect(outcome) {
        if (!outcome?.effect) return 'N/A';

        const effect = outcome.effect.toFixed(2);
        const type = outcome.effect_type || 'RR';

        if (outcome.ci_lower && outcome.ci_upper) {
            return `${type} ${effect} (95% CI ${outcome.ci_lower.toFixed(2)} to ${outcome.ci_upper.toFixed(2)})`;
        }
        return `${type} ${effect}`;
    }

    /**
     * Calculate anticipated absolute effects
     */
    calculateAnticipatedEffect(outcome, baselineRisk) {
        if (!outcome?.effect || !baselineRisk) {
            return { control: 'N/A', intervention: 'N/A', difference: 'N/A' };
        }

        const controlRate = baselineRisk;
        const rr = outcome.effect;
        const interventionRate = controlRate * rr;
        const difference = interventionRate - controlRate;

        return {
            control: `${(controlRate * 1000).toFixed(0)} per 1000`,
            intervention: `${(interventionRate * 1000).toFixed(0)} per 1000`,
            difference: `${difference > 0 ? '+' : ''}${(difference * 1000).toFixed(0)} per 1000 (95% CI ${((controlRate * outcome.ci_lower - controlRate) * 1000).toFixed(0)} to ${((controlRate * outcome.ci_upper - controlRate) * 1000).toFixed(0)})`
        };
    }

    /**
     * Generate footnotes for SoF table
     */
    generateFootnotes(assessments) {
        const footnotes = [];
        let footnoteIndex = 1;

        assessments.forEach(a => {
            a.downgradeReasons.forEach(r => {
                const existingNote = footnotes.find(f => f.text === r.reason);
                if (!existingNote) {
                    footnotes.push({
                        index: footnoteIndex++,
                        domain: r.domain,
                        text: r.reason
                    });
                }
            });
        });

        return footnotes;
    }

    /**
     * Export assessment to various formats
     */
    exportAssessment(assessmentId, format = 'json') {
        const assessment = this.assessments.get(assessmentId);
        if (!assessment) return null;

        switch (format) {
            case 'json':
                return JSON.stringify(assessment, null, 2);

            case 'text':
                return this.formatAssessmentText(assessment);

            case 'gradepro':
                return this.formatForGRADEpro(assessment);

            default:
                return assessment;
        }
    }

    /**
     * Format assessment as human-readable text
     */
    formatAssessmentText(assessment) {
        let text = `GRADE Assessment: ${assessment.outcome}\n`;
        text += '='.repeat(50) + '\n\n';

        text += `Study Design: ${assessment.studyDesign.toUpperCase()}\n`;
        text += `Baseline Certainty: ${CertaintyLabels[assessment.baselineCertainty].text}\n\n`;

        text += 'Domain Assessments:\n';
        text += '-'.repeat(30) + '\n';

        Object.entries(assessment.domains).forEach(([domain, data]) => {
            const downgradeText = data.downgrade > 0 ?
                `↓${data.downgrade} level${data.downgrade > 1 ? 's' : ''}` :
                'No downgrade';
            text += `${DomainCriteria[domain]?.name || domain}: ${downgradeText}\n`;
            if (data.reason) text += `  Reason: ${data.reason}\n`;
        });

        text += '\n' + '-'.repeat(30) + '\n';
        text += `Total Downgrade: ${assessment.totalDowngrade} level${assessment.totalDowngrade !== 1 ? 's' : ''}\n`;

        if (assessment.totalUpgrade > 0) {
            text += `Total Upgrade: +${assessment.totalUpgrade} level${assessment.totalUpgrade !== 1 ? 's' : ''}\n`;
        }

        text += `\nFinal Certainty: ${assessment.certaintyLabel.symbol} ${assessment.certaintyLabel.text}\n`;
        text += `Interpretation: ${assessment.certaintyLabel.description}\n`;

        return text;
    }

    /**
     * Format for GRADEpro software compatibility
     */
    formatForGRADEpro(assessment) {
        // GRADEpro-compatible format
        return {
            outcome: assessment.outcome,
            certainty: assessment.certaintyLabel.text.toLowerCase(),
            rob: assessment.domains.riskOfBias?.downgrade > 0 ?
                (assessment.domains.riskOfBias.downgrade > 1 ? 'very serious' : 'serious') : 'not serious',
            inconsistency: assessment.domains.inconsistency?.downgrade > 0 ?
                (assessment.domains.inconsistency.downgrade > 1 ? 'very serious' : 'serious') : 'not serious',
            indirectness: assessment.domains.indirectness?.downgrade > 0 ?
                (assessment.domains.indirectness.downgrade > 1 ? 'very serious' : 'serious') : 'not serious',
            imprecision: assessment.domains.imprecision?.downgrade > 0 ?
                (assessment.domains.imprecision.downgrade > 1 ? 'very serious' : 'serious') : 'not serious',
            publication_bias: assessment.domains.publicationBias?.downgrade > 0 ?
                (assessment.domains.publicationBias.downgrade > 1 ? 'strongly suspected' : 'suspected') : 'undetected',
            footnotes: assessment.downgradeReasons.map(r => r.reason)
        };
    }

    /**
     * Get audit log
     */
    getAuditLog(assessmentId = null) {
        if (assessmentId) {
            return this.auditLog.filter(entry => entry.assessmentId === assessmentId);
        }
        return this.auditLog;
    }
}

// Create singleton instance
let gradeAssessorInstance = null;

export function getGRADEAssessor() {
    if (!gradeAssessorInstance) {
        gradeAssessorInstance = new GRADEAssessor();
    }
    return gradeAssessorInstance;
}

/**
 * Create GRADE assessment UI component
 */
export function createGRADEAssessmentUI(containerId, outcome, metaResults, studyData) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const assessor = getGRADEAssessor();

    // Create initial assessment
    const assessment = assessor.assessOutcome(outcome, metaResults, studyData);

    const html = `
        <div class="grade-assessment" data-assessment-id="${assessment.id}">
            <h4>GRADE Certainty Assessment: ${outcome.name}</h4>

            <div class="grade-summary">
                <div class="certainty-badge certainty-${assessment.certaintyLabel.text.toLowerCase().replace(' ', '-')}">
                    ${assessment.certaintyLabel.symbol} ${assessment.certaintyLabel.text}
                </div>
                <p class="certainty-interpretation">${assessment.certaintyLabel.description}</p>
            </div>

            <table class="grade-domains-table">
                <thead>
                    <tr>
                        <th>Domain</th>
                        <th>Assessment</th>
                        <th>Downgrade</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(assessment.domains).map(([domain, data]) => `
                        <tr class="domain-row" data-domain="${domain}">
                            <td><strong>${DomainCriteria[domain]?.name || domain}</strong></td>
                            <td class="domain-reason">${data.reason || 'Not assessed'}</td>
                            <td class="downgrade-level">
                                ${data.downgrade > 0 ? `<span class="downgrade">-${data.downgrade}</span>` : '<span class="no-downgrade">0</span>'}
                            </td>
                            <td>
                                <button class="btn-sm btn-override" data-domain="${domain}">Override</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2"><strong>Final Certainty</strong></td>
                        <td colspan="2">
                            <span class="final-certainty">${assessment.certaintyLabel.symbol} ${assessment.certaintyLabel.text}</span>
                        </td>
                    </tr>
                </tfoot>
            </table>

            <div class="grade-notes">
                <label>Assessment Notes:</label>
                <textarea id="grade-notes-${assessment.id}" placeholder="Add notes about this assessment...">${assessment.notes}</textarea>
            </div>

            <div class="grade-actions">
                <button class="btn-primary" id="export-grade-${assessment.id}">Export Assessment</button>
                <button class="btn-secondary" id="view-audit-${assessment.id}">View Audit Log</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Add event listeners for override buttons
    container.querySelectorAll('.btn-override').forEach(btn => {
        btn.addEventListener('click', () => showOverrideDialog(assessment.id, btn.dataset.domain));
    });

    return assessment;
}

/**
 * Show override dialog for manual domain adjustment
 */
function showOverrideDialog(assessmentId, domain) {
    const domainInfo = DomainCriteria[domain];

    const dialog = document.createElement('div');
    dialog.className = 'grade-override-dialog';
    dialog.innerHTML = `
        <div class="dialog-content">
            <h4>Override ${domainInfo?.name || domain} Assessment</h4>
            <div class="form-group">
                <label>Downgrade Level:</label>
                <select id="override-level">
                    <option value="0">No downgrade (0)</option>
                    <option value="1">Serious (-1)</option>
                    <option value="2">Very serious (-2)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Reason for override:</label>
                <textarea id="override-reason" required placeholder="Provide justification..."></textarea>
            </div>
            <div class="dialog-actions">
                <button class="btn-primary" id="confirm-override">Apply Override</button>
                <button class="btn-secondary" id="cancel-override">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('confirm-override').addEventListener('click', () => {
        const override = {
            downgrade: parseInt(document.getElementById('override-level').value),
            reason: document.getElementById('override-reason').value,
            user: 'Current User'  // In production, get from auth
        };

        const assessor = getGRADEAssessor();
        assessor.applyOverride(assessmentId, domain, override);

        dialog.remove();

        // Refresh the UI
        // This would trigger a re-render in a real application
    });

    document.getElementById('cancel-override').addEventListener('click', () => {
        dialog.remove();
    });
}

export default GRADEAssessor;
