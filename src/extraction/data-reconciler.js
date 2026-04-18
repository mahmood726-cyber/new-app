/**
 * Data Reconciler Module
 * Reconciles extracted data from multiple sources (PDF, registry, supplements)
 *
 * @module data-reconciler
 */

/**
 * Source priority for conflict resolution (higher = more trusted)
 */
export const SOURCE_PRIORITY = {
    registry_results: 100,      // ClinicalTrials.gov results section
    pdf_table: 90,              // Data from PDF tables
    registry_protocol: 80,       // Registry protocol information
    pdf_prose: 70,              // Data from PDF text
    supplement_table: 60,       // Supplement tables
    supplement_prose: 50,       // Supplement text
    inferred: 20,               // Calculated/inferred values
    default: 10                 // Default/fallback values
};

/**
 * Fields that can be reconciled
 */
export const RECONCILABLE_FIELDS = {
    trial_id: { type: 'string', unique: true },
    trial_name: { type: 'string', unique: true },
    nct_id: { type: 'string', unique: true },
    sample_size: { type: 'number', tolerance: 0.05 },
    n_randomized: { type: 'number', tolerance: 0.05 },
    n_treatment: { type: 'number', tolerance: 0.05 },
    n_control: { type: 'number', tolerance: 0.05 },
    followup_months: { type: 'number', tolerance: 0.1 },
    intervention_name: { type: 'string', fuzzy: true },
    comparator: { type: 'string', fuzzy: true },
    primary_outcome: { type: 'object', compare: 'effect' },
    publication_year: { type: 'number', exact: true },
    doi: { type: 'string', unique: true }
};

/**
 * Main data reconciler class
 */
export class DataReconciler {
    constructor(options = {}) {
        this.options = {
            strictMode: options.strictMode ?? false,
            logConflicts: options.logConflicts ?? true,
            preferredSource: options.preferredSource ?? null,
            numericTolerance: options.numericTolerance ?? 0.05,
            ...options
        };
        this.conflicts = [];
        this.sources = [];
    }

    /**
     * Reconcile data from multiple sources
     * @param {Array} sources - Array of { data, source, priority } objects
     * @returns {Object} Reconciled data with metadata
     */
    reconcile(sources) {
        this.sources = sources;
        this.conflicts = [];

        const result = {
            success: true,
            data: {},
            conflicts: [],
            sourceContributions: {},
            confidence: 1.0
        };

        // Sort sources by priority
        const sortedSources = [...sources].sort((a, b) =>
            (b.priority || SOURCE_PRIORITY[b.source] || SOURCE_PRIORITY.default) -
            (a.priority || SOURCE_PRIORITY[a.source] || SOURCE_PRIORITY.default)
        );

        // Reconcile each field
        result.data = this.reconcileAllFields(sortedSources);

        // Record conflicts
        result.conflicts = this.conflicts;

        // Calculate confidence based on conflicts
        result.confidence = this.calculateConfidence();

        // Track which source contributed each field
        result.sourceContributions = this.trackContributions(sortedSources);

        return result;
    }

    /**
     * Reconcile all fields from sorted sources
     */
    reconcileAllFields(sortedSources) {
        const reconciled = {};

        // Get all unique field paths
        const allFields = new Set();
        for (const source of sortedSources) {
            this.collectFieldPaths(source.data, '', allFields);
        }

        // Reconcile each field
        for (const fieldPath of allFields) {
            const values = this.getValuesForField(sortedSources, fieldPath);

            if (values.length > 0) {
                const reconciledValue = this.reconcileField(fieldPath, values);
                this.setNestedValue(reconciled, fieldPath, reconciledValue);
            }
        }

        // Handle special array fields (outcomes, subgroups)
        reconciled.outcomes = this.reconcileOutcomes(sortedSources);
        reconciled.subgroups = this.reconcileSubgroups(sortedSources);
        reconciled.baseline = this.reconcileBaseline(sortedSources);

        return reconciled;
    }

    /**
     * Collect all field paths from an object
     */
    collectFieldPaths(obj, prefix, paths) {
        if (!obj || typeof obj !== 'object') return;

        // Skip arrays - handle them specially
        if (Array.isArray(obj)) return;

        for (const [key, value] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;

            // Skip complex nested objects and arrays
            if (Array.isArray(value) || key === 'outcomes' || key === 'subgroups' || key === 'baseline') {
                continue;
            }

            if (value && typeof value === 'object') {
                this.collectFieldPaths(value, path, paths);
            } else {
                paths.add(path);
            }
        }
    }

    /**
     * Get all values for a field from sources
     */
    getValuesForField(sources, fieldPath) {
        const values = [];

        for (const source of sources) {
            const value = this.getNestedValue(source.data, fieldPath);

            if (value !== null && value !== undefined) {
                values.push({
                    value,
                    source: source.source,
                    priority: source.priority || SOURCE_PRIORITY[source.source] || SOURCE_PRIORITY.default
                });
            }
        }

        return values;
    }

    /**
     * Reconcile a single field
     */
    reconcileField(fieldPath, values) {
        if (values.length === 0) return null;
        if (values.length === 1) return values[0].value;

        const fieldConfig = RECONCILABLE_FIELDS[fieldPath.split('.').pop()] || {};

        // Check for conflicts
        const hasConflict = this.detectConflict(values, fieldConfig);

        if (hasConflict) {
            this.conflicts.push({
                field: fieldPath,
                values: values.map(v => ({ value: v.value, source: v.source })),
                resolution: 'highest_priority',
                resolvedValue: values[0].value
            });
        }

        // Return value from highest priority source
        return values[0].value;
    }

    /**
     * Detect if values are in conflict
     */
    detectConflict(values, fieldConfig) {
        if (values.length < 2) return false;

        const first = values[0].value;

        for (let i = 1; i < values.length; i++) {
            const current = values[i].value;

            if (typeof first === 'number' && typeof current === 'number') {
                const tolerance = fieldConfig.tolerance || this.options.numericTolerance;
                const diff = Math.abs(first - current) / Math.max(Math.abs(first), Math.abs(current), 1);

                if (diff > tolerance) return true;
            } else if (typeof first === 'string' && typeof current === 'string') {
                if (fieldConfig.fuzzy) {
                    if (!this.fuzzyMatch(first, current)) return true;
                } else {
                    if (first.toLowerCase().trim() !== current.toLowerCase().trim()) return true;
                }
            } else if (first !== current) {
                return true;
            }
        }

        return false;
    }

    /**
     * Fuzzy string matching
     */
    fuzzyMatch(str1, str2, threshold = 0.8) {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return true;
        if (s1.includes(s2) || s2.includes(s1)) return true;

        // Levenshtein distance
        const distance = this.levenshteinDistance(s1, s2);
        const maxLen = Math.max(s1.length, s2.length);
        const similarity = 1 - distance / maxLen;

        return similarity >= threshold;
    }

    /**
     * Calculate Levenshtein distance
     */
    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
            }
        }

        return dp[m][n];
    }

    /**
     * Reconcile outcomes from multiple sources
     */
    reconcileOutcomes(sources) {
        const outcomeMap = new Map();

        for (const source of sources) {
            const outcomes = source.data?.outcomes || [];

            for (const outcome of outcomes) {
                const key = this.getOutcomeKey(outcome);
                const existing = outcomeMap.get(key);

                if (!existing) {
                    outcomeMap.set(key, {
                        ...outcome,
                        _sources: [source.source]
                    });
                } else {
                    // Merge data, preferring higher priority source
                    const sourcePriority = source.priority || SOURCE_PRIORITY[source.source] || SOURCE_PRIORITY.default;
                    const existingPriority = SOURCE_PRIORITY[existing._sources[0]] || SOURCE_PRIORITY.default;

                    if (sourcePriority > existingPriority) {
                        // Replace with higher priority data
                        outcomeMap.set(key, {
                            ...existing,
                            ...outcome,
                            _sources: [source.source, ...existing._sources]
                        });
                    } else {
                        // Add source to existing
                        existing._sources.push(source.source);
                        // Fill in missing fields
                        for (const [field, value] of Object.entries(outcome)) {
                            if (existing[field] === null || existing[field] === undefined) {
                                existing[field] = value;
                            }
                        }
                    }
                }
            }
        }

        return Array.from(outcomeMap.values());
    }

    /**
     * Get unique key for an outcome
     */
    getOutcomeKey(outcome) {
        const name = (outcome.mapped_name || outcome.name || '').toLowerCase().trim();
        return name.replace(/\s+/g, '_');
    }

    /**
     * Reconcile subgroups from multiple sources
     */
    reconcileSubgroups(sources) {
        const subgroupMap = new Map();

        for (const source of sources) {
            const subgroups = source.data?.subgroups || [];

            for (const sg of subgroups) {
                const key = (sg.variable || '').toLowerCase().trim();
                const existing = subgroupMap.get(key);

                if (!existing) {
                    subgroupMap.set(key, {
                        ...sg,
                        _sources: [source.source]
                    });
                } else {
                    // Merge categories
                    const allCategories = [...(existing.categories || [])];

                    for (const cat of sg.categories || []) {
                        const catExists = allCategories.find(c =>
                            c.label?.toLowerCase() === cat.label?.toLowerCase()
                        );

                        if (!catExists) {
                            allCategories.push(cat);
                        }
                    }

                    existing.categories = allCategories;
                    existing._sources.push(source.source);

                    // Use interaction p from higher priority source
                    if (sg.interaction_p !== null && sg.interaction_p !== undefined) {
                        if (existing.interaction_p === null || existing.interaction_p === undefined) {
                            existing.interaction_p = sg.interaction_p;
                        }
                    }
                }
            }
        }

        return Array.from(subgroupMap.values());
    }

    /**
     * Reconcile baseline characteristics
     */
    reconcileBaseline(sources) {
        const charMap = new Map();

        for (const source of sources) {
            const chars = source.data?.baseline?.characteristics || [];

            for (const char of chars) {
                const key = (char.key || char.label || '').toLowerCase().trim();
                const existing = charMap.get(key);

                if (!existing) {
                    charMap.set(key, { ...char });
                } else {
                    // Fill in missing values
                    if (!existing.treatment && char.treatment) existing.treatment = char.treatment;
                    if (!existing.control && char.control) existing.control = char.control;
                }
            }
        }

        return {
            characteristics: Array.from(charMap.values())
        };
    }

    /**
     * Calculate overall confidence based on conflicts
     */
    calculateConfidence() {
        if (this.conflicts.length === 0) return 1.0;

        // Reduce confidence for each conflict
        const conflictPenalty = 0.05;
        const confidence = Math.max(0.5, 1.0 - this.conflicts.length * conflictPenalty);

        return Math.round(confidence * 100) / 100;
    }

    /**
     * Track which source contributed each field
     */
    trackContributions(sources) {
        const contributions = {};

        for (const source of sources) {
            contributions[source.source] = {
                fieldsContributed: 0,
                priority: source.priority || SOURCE_PRIORITY[source.source] || SOURCE_PRIORITY.default
            };
        }

        // Count field contributions (simplified)
        for (const source of sources) {
            if (source.data) {
                contributions[source.source].fieldsContributed = this.countFields(source.data);
            }
        }

        return contributions;
    }

    /**
     * Count fields in an object
     */
    countFields(obj, count = 0) {
        if (!obj || typeof obj !== 'object') return count;

        for (const value of Object.values(obj)) {
            if (value !== null && value !== undefined) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    count = this.countFields(value, count);
                } else {
                    count++;
                }
            }
        }

        return count;
    }

    /**
     * Get nested value from object
     */
    getNestedValue(obj, path) {
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === null || current === undefined) return null;
            current = current[part];
        }

        return current;
    }

    /**
     * Set nested value in object
     */
    setNestedValue(obj, path, value) {
        const parts = path.split('.');
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) current[part] = {};
            current = current[part];
        }

        current[parts[parts.length - 1]] = value;
    }

    /**
     * Get conflict report
     */
    getConflictReport() {
        if (this.conflicts.length === 0) {
            return {
                hasConflicts: false,
                count: 0,
                summary: 'No conflicts detected'
            };
        }

        const byField = {};
        for (const conflict of this.conflicts) {
            byField[conflict.field] = conflict;
        }

        return {
            hasConflicts: true,
            count: this.conflicts.length,
            conflicts: this.conflicts,
            byField,
            summary: `${this.conflicts.length} conflict(s) detected and resolved`
        };
    }
}

/**
 * Reconcile data from multiple sources
 * @param {Array} sources - Array of source objects
 * @param {Object} options - Reconciliation options
 * @returns {Object} Reconciled data
 */
export function reconcileData(sources, options = {}) {
    const reconciler = new DataReconciler(options);
    return reconciler.reconcile(sources);
}

/**
 * Merge registry data with PDF extraction
 * @param {Object} registryData - Data from ClinicalTrials.gov
 * @param {Object} pdfData - Data from PDF extraction
 * @returns {Object} Merged data
 */
export function mergeRegistryWithPDF(registryData, pdfData) {
    return reconcileData([
        { data: registryData, source: 'registry_results', priority: SOURCE_PRIORITY.registry_results },
        { data: pdfData, source: 'pdf_table', priority: SOURCE_PRIORITY.pdf_table }
    ]);
}

/**
 * Merge supplement data with main extraction
 * @param {Object} mainData - Main PDF extraction
 * @param {Object} supplementData - Supplement extraction
 * @returns {Object} Merged data
 */
export function mergeSupplementWithMain(mainData, supplementData) {
    return reconcileData([
        { data: mainData, source: 'pdf_table', priority: SOURCE_PRIORITY.pdf_table },
        { data: supplementData, source: 'supplement_table', priority: SOURCE_PRIORITY.supplement_table }
    ]);
}

/**
 * Validate consistency between sources
 * @param {Array} sources - Sources to validate
 * @returns {Object} Validation result
 */
export function validateConsistency(sources) {
    const reconciler = new DataReconciler({ logConflicts: true });
    const result = reconciler.reconcile(sources);

    return {
        isConsistent: result.conflicts.length === 0,
        conflictCount: result.conflicts.length,
        conflicts: result.conflicts,
        confidence: result.confidence,
        report: reconciler.getConflictReport()
    };
}

/**
 * Auto-detect source type from data structure
 * @param {Object} data - Data to analyze
 * @returns {string} Detected source type
 */
export function detectSourceType(data) {
    if (data.protocolSection || data.resultsSection) {
        return 'registry_results';
    }

    if (data.extraction_metadata?.source_type === 'supplement') {
        return 'supplement_table';
    }

    if (data.extraction_metadata?.source_type === 'pdf') {
        return 'pdf_table';
    }

    if (data.outcomes?.some(o => o.source === 'table')) {
        return 'pdf_table';
    }

    if (data.outcomes?.some(o => o.source === 'prose')) {
        return 'pdf_prose';
    }

    return 'default';
}

export default {
    DataReconciler,
    reconcileData,
    mergeRegistryWithPDF,
    mergeSupplementWithMain,
    validateConsistency,
    detectSourceType,
    SOURCE_PRIORITY
};
