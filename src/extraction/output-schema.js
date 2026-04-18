/**
 * Output Schema Module
 * Canonical output format for extracted trial data
 *
 * @module output-schema
 */

/**
 * Standard output schema definition
 */
export const SCHEMA = {
    trial_id: { type: 'string', required: true, example: 'NCT03036124' },
    trial_name: { type: 'string', required: true, example: 'DAPA-HF' },
    publication: {
        type: 'object',
        properties: {
            doi: { type: 'string', example: '10.1056/NEJMoa1911303' },
            pmid: { type: 'string', example: '31535829' },
            year: { type: 'number', example: 2019 },
            journal: { type: 'string', example: 'N Engl J Med' },
            authors: { type: 'array', items: 'string' }
        }
    },
    population: {
        type: 'object',
        properties: {
            description: { type: 'string', required: true },
            inclusion_criteria: { type: 'string' },
            exclusion_criteria: { type: 'string' },
            n_randomized: { type: 'number', required: true },
            n_treatment: { type: 'number', required: true },
            n_control: { type: 'number', required: true },
            n_analyzed: { type: 'number' }
        }
    },
    intervention: {
        type: 'object',
        properties: {
            name: { type: 'string', required: true, example: 'Dapagliflozin' },
            dose: { type: 'string', example: '10mg daily' },
            class: { type: 'string', example: 'SGLT2i' },
            description: { type: 'string' }
        }
    },
    comparator: { type: 'string', required: true, example: 'Placebo' },
    followup: {
        type: 'object',
        properties: {
            median_months: { type: 'number', example: 18.2 },
            mean_months: { type: 'number' },
            person_years: { type: 'number' },
            type: { type: 'string', enum: ['median', 'mean'] }
        }
    },
    outcomes: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                mapped_name: { type: 'string' },
                category: { type: 'string' },
                is_primary: { type: 'boolean' },
                definition: { type: 'string' },
                events_treatment: { type: 'number' },
                events_control: { type: 'number' },
                n_treatment: { type: 'number' },
                n_control: { type: 'number' },
                effect_type: { type: 'string', enum: ['HR', 'RR', 'OR', 'IRR', 'MD', 'SMD'] },
                effect: { type: 'number', required: true },
                ci_lower: { type: 'number', required: true },
                ci_upper: { type: 'number', required: true },
                ci_level: { type: 'number', default: 95 },
                p_value: { type: 'number' },
                p_operator: { type: 'string', enum: ['<', '=', '>'] },
                confidence: { type: 'number' },
                source: { type: 'string' }
            }
        }
    },
    subgroups: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                variable: { type: 'string', required: true },
                variable_label: { type: 'string' },
                categories: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string', required: true },
                            effect: { type: 'number' },
                            ci_lower: { type: 'number' },
                            ci_upper: { type: 'number' }
                        }
                    }
                },
                interaction_p: { type: 'number' }
            }
        }
    },
    baseline: {
        type: 'object',
        properties: {
            sample_sizes: {
                type: 'object',
                properties: {
                    total: { type: 'number' },
                    treatment: { type: 'number' },
                    control: { type: 'number' }
                }
            },
            characteristics: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        key: { type: 'string' },
                        label: { type: 'string', required: true },
                        type: { type: 'string', enum: ['continuous', 'categorical'] },
                        unit: { type: 'string' },
                        treatment: { type: 'object' },
                        control: { type: 'object' }
                    }
                }
            }
        }
    },
    extraction_metadata: {
        type: 'object',
        properties: {
            timestamp: { type: 'string', format: 'date-time' },
            engine_version: { type: 'string' },
            overall_confidence: { type: 'number' },
            processing_time_ms: { type: 'number' },
            source_type: { type: 'string' },
            manual_review_flags: { type: 'array', items: 'string' }
        }
    }
};

/**
 * Create empty data object following schema
 * @returns {Object} Empty data structure
 */
export function createEmptyData() {
    return {
        trial_id: null,
        trial_name: null,
        publication: {
            doi: null,
            pmid: null,
            year: null,
            journal: null,
            authors: []
        },
        population: {
            description: null,
            inclusion_criteria: null,
            exclusion_criteria: null,
            n_randomized: null,
            n_treatment: null,
            n_control: null,
            n_analyzed: null
        },
        intervention: {
            name: null,
            dose: null,
            class: null,
            description: null
        },
        comparator: null,
        followup: {
            median_months: null,
            mean_months: null,
            person_years: null,
            type: null
        },
        outcomes: [],
        subgroups: [],
        baseline: {
            sample_sizes: {
                total: null,
                treatment: null,
                control: null
            },
            characteristics: []
        },
        extraction_metadata: {
            timestamp: new Date().toISOString(),
            engine_version: '2.0.0',
            overall_confidence: null,
            processing_time_ms: null,
            source_type: null,
            manual_review_flags: []
        }
    };
}

/**
 * Validate data against schema
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result
 */
export function validateSchema(data) {
    const errors = [];
    const warnings = [];

    // Check required top-level fields
    if (!data.trial_id) errors.push('Missing required field: trial_id');
    if (!data.trial_name) warnings.push('Missing field: trial_name');
    if (!data.comparator) warnings.push('Missing field: comparator');

    // Check population
    if (!data.population?.n_randomized) {
        warnings.push('Missing field: population.n_randomized');
    }

    // Check intervention
    if (!data.intervention?.name) {
        warnings.push('Missing field: intervention.name');
    }

    // Check outcomes
    if (!data.outcomes || data.outcomes.length === 0) {
        errors.push('No outcomes found');
    } else {
        for (let i = 0; i < data.outcomes.length; i++) {
            const outcome = data.outcomes[i];
            if (!outcome.name) errors.push(`Outcome ${i}: missing name`);
            if (outcome.effect == null) errors.push(`Outcome ${i} (${outcome.name}): missing effect`);
            if (outcome.ci_lower == null) warnings.push(`Outcome ${i} (${outcome.name}): missing ci_lower`);
            if (outcome.ci_upper == null) warnings.push(`Outcome ${i} (${outcome.name}): missing ci_upper`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Normalize data to match schema exactly
 * @param {Object} data - Raw extracted data
 * @returns {Object} Normalized data
 */
export function normalizeData(data) {
    const normalized = createEmptyData();

    // Copy direct fields
    normalized.trial_id = data.trial_id || data.nct_id || null;
    normalized.trial_name = data.trial_name || data.name || null;
    normalized.comparator = data.comparator || 'Placebo';

    // Normalize publication
    if (data.publication) {
        Object.assign(normalized.publication, data.publication);
    }

    // Normalize population
    if (data.population) {
        Object.assign(normalized.population, data.population);
    }

    // Normalize intervention
    if (data.intervention) {
        if (typeof data.intervention === 'string') {
            normalized.intervention.name = data.intervention;
        } else {
            Object.assign(normalized.intervention, data.intervention);
        }
    }

    // Normalize followup
    if (data.followup) {
        Object.assign(normalized.followup, data.followup);
    } else if (data.median_followup) {
        normalized.followup.median_months = data.median_followup;
        normalized.followup.type = 'median';
    }

    // Normalize outcomes
    normalized.outcomes = (data.outcomes || []).map(normalizeOutcome);

    // Normalize subgroups
    normalized.subgroups = data.subgroups || [];

    // Normalize baseline
    if (data.baseline) {
        normalized.baseline = data.baseline;
    }

    // Metadata
    normalized.extraction_metadata = {
        ...normalized.extraction_metadata,
        timestamp: new Date().toISOString(),
        overall_confidence: data.confidence || data.overall_confidence || null,
        ...data.extraction_metadata
    };

    return normalized;
}

/**
 * Normalize single outcome
 */
function normalizeOutcome(outcome) {
    // Handle nested effect object
    const effect = outcome.effect || outcome;

    return {
        name: outcome.name || outcome.outcome || 'Unknown',
        mapped_name: outcome.mapped || outcome.mapped_name || null,
        category: outcome.category || null,
        is_primary: outcome.is_primary || false,
        definition: outcome.definition || null,
        events_treatment: outcome.events_treatment || outcome.treatment?.events || null,
        events_control: outcome.events_control || outcome.control?.events || null,
        n_treatment: outcome.n_treatment || outcome.treatment?.total || null,
        n_control: outcome.n_control || outcome.control?.total || null,
        effect_type: effect.effect_type || effect.type || 'HR',
        effect: effect.value || effect.effect || null,
        ci_lower: effect.ci_lower || null,
        ci_upper: effect.ci_upper || null,
        ci_level: effect.ci_level || 95,
        p_value: effect.p_value || null,
        p_operator: effect.p_operator || null,
        confidence: outcome.confidence || effect.confidence || null,
        source: outcome.source || null
    };
}

/**
 * Convert to MetaEngine-compatible format
 * @param {Object} data - Normalized data
 * @returns {Object} MetaEngine format
 */
export function toMetaEngineFormat(data) {
    return {
        study_id: data.trial_id,
        study_name: data.trial_name,
        year: data.publication?.year,
        n_total: data.population?.n_randomized,
        n_treatment: data.population?.n_treatment,
        n_control: data.population?.n_control,
        outcomes: data.outcomes.map(o => ({
            name: o.mapped_name || o.name,
            yi: Math.log(o.effect), // Log-transformed effect
            vi: calculateVariance(o), // Variance
            effect: o.effect,
            ci_lower: o.ci_lower,
            ci_upper: o.ci_upper,
            events_t: o.events_treatment,
            events_c: o.events_control,
            n_t: o.n_treatment,
            n_c: o.n_control
        }))
    };
}

/**
 * Calculate variance from CI
 */
function calculateVariance(outcome) {
    if (!outcome.ci_lower || !outcome.ci_upper || !outcome.effect) {
        return null;
    }

    // SE = (log(ci_upper) - log(ci_lower)) / (2 * 1.96)
    const logCIWidth = Math.log(outcome.ci_upper) - Math.log(outcome.ci_lower);
    const se = logCIWidth / (2 * 1.96);
    return se * se;
}

export default {
    SCHEMA,
    createEmptyData,
    validateSchema,
    normalizeData,
    toMetaEngineFormat
};
