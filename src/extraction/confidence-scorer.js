/**
 * Confidence Scorer Module
 * Estimates extraction confidence for data quality assessment
 *
 * @module confidence-scorer
 */

/**
 * Calculate overall confidence score for extracted data
 * @param {Object} extractedData - Complete extracted trial data
 * @returns {Object} Confidence scores
 */
export function calculateConfidence(extractedData) {
    const scores = {
        overall: 0,
        components: {},
        flags: []
    };

    // Score each component
    scores.components.trial_info = scoreTrialInfo(extractedData);
    scores.components.outcomes = scoreOutcomes(extractedData.outcomes || []);
    scores.components.baseline = scoreBaseline(extractedData.baseline);
    scores.components.subgroups = scoreSubgroups(extractedData.subgroups);
    scores.components.source_quality = scoreSourceQuality(extractedData);

    // Calculate weighted overall score
    const weights = {
        trial_info: 0.15,
        outcomes: 0.40,
        baseline: 0.15,
        subgroups: 0.10,
        source_quality: 0.20
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [component, weight] of Object.entries(weights)) {
        const score = scores.components[component]?.score || 0;
        if (score > 0) {
            weightedSum += score * weight;
            totalWeight += weight;
        }
    }

    scores.overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Add interpretation
    scores.interpretation = interpretScore(scores.overall);

    // Collect flags from all components
    for (const component of Object.values(scores.components)) {
        if (component.flags) {
            scores.flags.push(...component.flags);
        }
    }

    return scores;
}

/**
 * Score trial information completeness
 */
function scoreTrialInfo(data) {
    const required = ['trial_id', 'trial_name', 'population', 'intervention', 'comparator'];
    const desirable = ['publication', 'followup', 'enrollment'];

    let score = 0;
    const flags = [];

    // Check required fields
    let requiredFound = 0;
    for (const field of required) {
        if (hasValue(data[field])) {
            requiredFound++;
        } else {
            flags.push({ field, issue: 'missing', severity: 'high' });
        }
    }
    score += (requiredFound / required.length) * 0.7;

    // Check desirable fields
    let desirableFound = 0;
    for (const field of desirable) {
        if (hasValue(data[field])) {
            desirableFound++;
        } else {
            flags.push({ field, issue: 'missing', severity: 'low' });
        }
    }
    score += (desirableFound / desirable.length) * 0.3;

    return {
        score,
        completeness: {
            required: requiredFound / required.length,
            desirable: desirableFound / desirable.length
        },
        flags
    };
}

/**
 * Score outcome extraction quality
 */
function scoreOutcomes(outcomes) {
    if (!outcomes || outcomes.length === 0) {
        return {
            score: 0,
            flags: [{ issue: 'No outcomes extracted', severity: 'critical' }]
        };
    }

    const scores = [];
    const flags = [];

    for (const outcome of outcomes) {
        let outcomeScore = 0;
        const effect = outcome.effect || outcome;

        // Point estimate (essential)
        if (effect.value != null) {
            outcomeScore += 0.3;
        } else {
            flags.push({ outcome: outcome.name, issue: 'Missing point estimate', severity: 'critical' });
        }

        // Confidence interval (important)
        if (effect.ci_lower != null && effect.ci_upper != null) {
            outcomeScore += 0.25;

            // Validate CI
            if (effect.ci_lower <= effect.value && effect.value <= effect.ci_upper) {
                outcomeScore += 0.05; // Bonus for valid CI
            }
        } else {
            flags.push({ outcome: outcome.name, issue: 'Missing CI', severity: 'high' });
        }

        // Effect type identified
        if (effect.effect_type || effect.type) {
            outcomeScore += 0.1;
        }

        // P-value
        if (effect.p_value != null) {
            outcomeScore += 0.1;
        }

        // Event counts
        if (outcome.treatment?.events != null || outcome.events_treatment != null) {
            outcomeScore += 0.1;
        }
        if (outcome.control?.events != null || outcome.events_control != null) {
            outcomeScore += 0.1;

        }

        // Outcome mapping
        if (outcome.mapped || outcome.category) {
            outcomeScore += 0.05;
        }

        // Existing confidence from extraction
        if (outcome.confidence) {
            outcomeScore = (outcomeScore + outcome.confidence) / 2;
        }

        scores.push({
            outcome: outcome.name,
            score: Math.min(1, outcomeScore)
        });
    }

    // Average outcome scores
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

    // Penalty for missing primary outcome
    const hasPrimary = outcomes.some(o =>
        o.is_primary || /primary|composite/i.test(o.name || '')
    );
    const primaryPenalty = hasPrimary ? 0 : 0.1;

    return {
        score: Math.max(0, avgScore - primaryPenalty),
        per_outcome: scores,
        outcome_count: outcomes.length,
        has_primary: hasPrimary,
        flags
    };
}

/**
 * Score baseline characteristics extraction
 */
function scoreBaseline(baseline) {
    if (!baseline || !baseline.characteristics) {
        return {
            score: 0.5, // Baseline is helpful but not critical
            flags: [{ issue: 'No baseline data', severity: 'medium' }]
        };
    }

    let score = 0.6; // Base score for having baseline data
    const flags = [];

    const chars = baseline.characteristics;

    // Check for key characteristics
    const keyChars = ['age', 'sex_male', 'diabetes', 'lvef', 'egfr'];
    const foundKey = keyChars.filter(k =>
        chars.some(c => c.key === k || c.label?.toLowerCase().includes(k))
    );

    score += (foundKey.length / keyChars.length) * 0.2;

    // Check for complete values
    const completeChars = chars.filter(c =>
        (c.treatment != null && c.control != null)
    );
    const completeness = chars.length > 0 ? completeChars.length / chars.length : 0;
    score += completeness * 0.2;

    // Check sample sizes
    if (baseline.sample_sizes?.total) {
        score += 0.05;
    }

    // Flag unmapped characteristics
    const unmapped = chars.filter(c => c.unmapped);
    if (unmapped.length > chars.length * 0.3) {
        flags.push({
            issue: `${unmapped.length} unmapped characteristics`,
            severity: 'low'
        });
    }

    return {
        score: Math.min(1, score),
        characteristic_count: chars.length,
        completeness,
        flags
    };
}

/**
 * Score subgroup analysis extraction
 */
function scoreSubgroups(subgroups) {
    if (!subgroups || subgroups.length === 0) {
        return {
            score: 0.7, // Subgroups are optional
            flags: []
        };
    }

    let score = 0.7;
    const flags = [];

    // Bonus for subgroups
    score += Math.min(subgroups.length * 0.05, 0.15);

    // Check completeness of subgroup data
    for (const sg of subgroups) {
        if (!sg.categories || sg.categories.length < 2) {
            flags.push({
                subgroup: sg.variable,
                issue: 'Incomplete categories',
                severity: 'low'
            });
        }

        // Bonus for interaction p-values
        if (sg.interaction_p != null) {
            score += 0.02;
        }
    }

    return {
        score: Math.min(1, score),
        subgroup_count: subgroups.length,
        flags
    };
}

/**
 * Score source quality
 */
function scoreSourceQuality(data) {
    let score = 0.7; // Base score
    const flags = [];

    // Check data sources
    if (data.extraction_metadata) {
        const meta = data.extraction_metadata;

        // Table extraction is more reliable
        if (meta.table_extraction_count > 0) {
            score += 0.1;
        }

        // Prose extraction is less reliable
        if (meta.prose_only) {
            score -= 0.1;
            flags.push({ issue: 'Prose-only extraction', severity: 'medium' });
        }

        // Processing time as proxy for complexity
        if (meta.processingTimeMs && meta.processingTimeMs < 10000) {
            score += 0.05; // Fast processing suggests clean document
        }
    }

    // Cross-validation success
    if (data.validation?.passed === true) {
        score += 0.15;
    } else if (data.validation?.errors?.length > 0) {
        score -= data.validation.errors.length * 0.05;
        flags.push({
            issue: `${data.validation.errors.length} validation errors`,
            severity: 'high'
        });
    }

    // Publication source
    if (data.publication?.doi) {
        score += 0.05;
    }

    return {
        score: Math.max(0, Math.min(1, score)),
        flags
    };
}

/**
 * Check if value exists and is not empty
 */
function hasValue(val) {
    if (val == null) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    if (typeof val === 'object' && Object.keys(val).length === 0) return false;
    return true;
}

/**
 * Interpret confidence score
 */
function interpretScore(score) {
    if (score >= 0.9) {
        return {
            level: 'high',
            label: 'High Confidence',
            description: 'Data can be used with minimal manual review',
            color: '#22c55e'
        };
    } else if (score >= 0.7) {
        return {
            level: 'medium',
            label: 'Medium Confidence',
            description: 'Quick review recommended for key fields',
            color: '#f59e0b'
        };
    } else if (score >= 0.5) {
        return {
            level: 'low',
            label: 'Low Confidence',
            description: 'Thorough manual review required',
            color: '#ef4444'
        };
    } else {
        return {
            level: 'very_low',
            label: 'Very Low Confidence',
            description: 'Data may be incomplete or unreliable',
            color: '#7f1d1d'
        };
    }
}

/**
 * Calculate field-level confidence
 * @param {Object} field - Extracted field data
 * @param {Object} context - Extraction context
 * @returns {number} Confidence 0-1
 */
export function calculateFieldConfidence(field, context = {}) {
    let confidence = 0.5; // Base confidence

    // Source reliability
    const sourceBonus = {
        'table': 0.2,
        'structured': 0.15,
        'prose': 0.05,
        'inferred': -0.1
    };
    if (context.source && sourceBonus[context.source]) {
        confidence += sourceBonus[context.source];
    }

    // Pattern match quality
    if (context.patternMatch) {
        confidence += context.patternMatch * 0.2;
    }

    // Cross-validation
    if (context.crossValidated) {
        confidence += 0.1;
    }

    // Consistency with other fields
    if (context.consistent) {
        confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
}

/**
 * Aggregate confidence across multiple sources
 * @param {Array} sources - Array of {value, confidence} objects
 * @returns {Object} Aggregated result
 */
export function aggregateConfidence(sources) {
    if (!sources || sources.length === 0) {
        return { value: null, confidence: 0 };
    }

    if (sources.length === 1) {
        return sources[0];
    }

    // Check if all sources agree
    const values = sources.map(s => s.value);
    const allAgree = values.every(v => v === values[0]);

    if (allAgree) {
        // All sources agree - high confidence
        const maxConf = Math.max(...sources.map(s => s.confidence));
        return {
            value: values[0],
            confidence: Math.min(1, maxConf + 0.1),
            sources: sources.length,
            agreement: 'unanimous'
        };
    }

    // Sources disagree - use highest confidence value
    const sorted = sources.sort((a, b) => b.confidence - a.confidence);
    return {
        value: sorted[0].value,
        confidence: sorted[0].confidence * 0.8, // Penalty for disagreement
        sources: sources.length,
        agreement: 'partial',
        alternatives: sorted.slice(1).map(s => s.value)
    };
}

/**
 * Generate review priority list
 * @param {Object} confidenceData - Confidence scores
 * @param {Object} extractedData - Extracted data
 * @returns {Array} Prioritized review items
 */
export function generateReviewPriority(confidenceData, extractedData) {
    const items = [];

    // Add low-confidence outcomes
    if (confidenceData.components.outcomes?.per_outcome) {
        for (const outcomeScore of confidenceData.components.outcomes.per_outcome) {
            if (outcomeScore.score < 0.7) {
                items.push({
                    type: 'outcome',
                    name: outcomeScore.outcome,
                    confidence: outcomeScore.score,
                    priority: outcomeScore.score < 0.5 ? 'high' : 'medium'
                });
            }
        }
    }

    // Add flags
    for (const flag of confidenceData.flags || []) {
        if (flag.severity === 'critical' || flag.severity === 'high') {
            items.push({
                type: 'flag',
                issue: flag.issue,
                field: flag.field || flag.outcome,
                priority: flag.severity === 'critical' ? 'critical' : 'high'
            });
        }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return items;
}

export default {
    calculateConfidence,
    calculateFieldConfidence,
    aggregateConfidence,
    generateReviewPriority
};
