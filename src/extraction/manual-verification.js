/**
 * Manual Verification Layer
 * Requires human confirmation before data is used in meta-analysis
 *
 * Implements editorial requirements for:
 * - Explicit user confirmation
 * - Audit trail maintenance
 * - Discrepancy flagging
 * - Source cross-validation
 *
 * @module manual-verification
 */

/**
 * Verification status enum
 */
export const VerificationStatus = {
    PENDING: 'pending',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
    FLAGGED: 'flagged',
    NEEDS_REVIEW: 'needs_review'
};

/**
 * Verification priority levels
 */
export const VerificationPriority = {
    CRITICAL: 1,    // Must verify before analysis
    HIGH: 2,        // Should verify
    MEDIUM: 3,      // Recommended to verify
    LOW: 4          // Optional verification
};

/**
 * Main verification manager class
 */
export class VerificationManager {
    constructor() {
        this.verificationQueue = [];
        this.verificationHistory = [];
        this.auditLog = [];
        this.callbacks = {
            onVerificationRequired: null,
            onVerificationComplete: null,
            onDiscrepancyFound: null
        };
    }

    /**
     * Initialize verification for extracted data
     * @param {Object} extractedData - Raw extracted data
     * @param {Object} options - Verification options
     * @returns {Object} Verification task list
     */
    initializeVerification(extractedData, options = {}) {
        const tasks = [];
        const now = new Date().toISOString();

        // Log initialization
        this.addAuditEntry('verification_init', {
            trial_id: extractedData.trial_id,
            source: extractedData.extraction_metadata?.source_type,
            timestamp: now
        });

        // Create verification tasks for outcomes
        if (extractedData.outcomes) {
            for (const outcome of extractedData.outcomes) {
                const task = this.createOutcomeVerificationTask(outcome, extractedData);
                tasks.push(task);
            }
        }

        // Create verification tasks for baseline characteristics
        if (extractedData.baseline?.characteristics) {
            const baselineTask = this.createBaselineVerificationTask(extractedData.baseline);
            tasks.push(baselineTask);
        }

        // Create verification tasks for sample sizes
        if (extractedData.population) {
            const sampleTask = this.createSampleSizeVerificationTask(extractedData);
            tasks.push(sampleTask);
        }

        // Sort by priority
        tasks.sort((a, b) => a.priority - b.priority);

        this.verificationQueue = tasks;

        return {
            total_tasks: tasks.length,
            critical_tasks: tasks.filter(t => t.priority === VerificationPriority.CRITICAL).length,
            high_tasks: tasks.filter(t => t.priority === VerificationPriority.HIGH).length,
            tasks: tasks
        };
    }

    /**
     * Create verification task for an outcome
     */
    createOutcomeVerificationTask(outcome, extractedData) {
        const flags = [];
        let priority = VerificationPriority.MEDIUM;

        // Check for issues that require verification
        const effect = outcome.effect ?? outcome.value ?? outcome;

        // Critical: Missing essential data
        if (effect.value == null) {
            flags.push({ type: 'missing', field: 'effect_value', severity: 'critical' });
            priority = VerificationPriority.CRITICAL;
        }

        // Critical: CI issues
        if (effect.ci_lower != null && effect.ci_upper != null) {
            if (effect.ci_lower > effect.ci_upper) {
                flags.push({ type: 'invalid', field: 'ci_bounds', severity: 'critical' });
                priority = VerificationPriority.CRITICAL;
            }
            if (effect.value != null && (effect.value < effect.ci_lower || effect.value > effect.ci_upper)) {
                flags.push({ type: 'inconsistent', field: 'effect_outside_ci', severity: 'critical' });
                priority = VerificationPriority.CRITICAL;
            }
        } else {
            flags.push({ type: 'missing', field: 'confidence_interval', severity: 'high' });
            if (priority > VerificationPriority.HIGH) priority = VerificationPriority.HIGH;
        }

        // High: Low confidence extraction
        if (outcome.confidence && outcome.confidence < 0.7) {
            flags.push({ type: 'low_confidence', value: outcome.confidence, severity: 'high' });
            if (priority > VerificationPriority.HIGH) priority = VerificationPriority.HIGH;
        }

        // High: Prose-only extraction
        if (outcome.source === 'prose') {
            flags.push({ type: 'prose_extraction', severity: 'high' });
            if (priority > VerificationPriority.HIGH) priority = VerificationPriority.HIGH;
        }

        // Medium: Extreme values
        if (effect.value != null && (effect.value > 5 || effect.value < 0.2)) {
            flags.push({ type: 'extreme_value', value: effect.value, severity: 'medium' });
        }

        // Medium: P-value/CI inconsistency
        if (effect.p_value != null && effect.ci_lower != null && effect.ci_upper != null) {
            const excludesNull = effect.ci_lower > 1 || effect.ci_upper < 1;
            if ((excludesNull && effect.p_value >= 0.05) || (!excludesNull && effect.p_value < 0.05)) {
                // Allow edge cases
                if (!(effect.p_value >= 0.04 && effect.p_value <= 0.06)) {
                    flags.push({ type: 'pvalue_ci_mismatch', severity: 'medium' });
                }
            }
        }

        return {
            id: `outcome_${outcome.name || 'unknown'}_${Date.now()}`,
            type: 'outcome',
            name: outcome.name || 'Unknown Outcome',
            data: outcome,
            priority,
            status: VerificationStatus.PENDING,
            flags,
            extracted_values: {
                effect: effect.value,
                ci_lower: effect.ci_lower,
                ci_upper: effect.ci_upper,
                p_value: effect.p_value,
                effect_type: effect.effect_type || effect.type,
                events_treatment: outcome.events_treatment,
                events_control: outcome.events_control
            },
            verified_values: null,
            verifier: null,
            verification_timestamp: null,
            notes: ''
        };
    }

    /**
     * Create verification task for baseline characteristics
     */
    createBaselineVerificationTask(baseline) {
        const flags = [];
        let priority = VerificationPriority.MEDIUM;

        const chars = baseline.characteristics || [];

        // Check for unmapped characteristics
        const unmapped = chars.filter(c => c.unmapped);
        if (unmapped.length > 0) {
            flags.push({
                type: 'unmapped_characteristics',
                count: unmapped.length,
                severity: 'low'
            });
        }

        // Check for missing key characteristics
        const keyChars = ['age', 'sex', 'diabetes', 'hypertension'];
        const foundKeys = keyChars.filter(k =>
            chars.some(c => c.key === k || c.label?.toLowerCase().includes(k))
        );
        if (foundKeys.length < 2) {
            flags.push({ type: 'missing_key_characteristics', severity: 'medium' });
        }

        // Check sample size consistency
        if (baseline.sample_sizes) {
            const { treatment, control, total } = baseline.sample_sizes;
            if (treatment && control && total) {
                if (Math.abs(total - (treatment + control)) > 1) {
                    flags.push({ type: 'sample_size_mismatch', severity: 'high' });
                    priority = VerificationPriority.HIGH;
                }
            }
        }

        return {
            id: `baseline_${Date.now()}`,
            type: 'baseline',
            name: 'Baseline Characteristics',
            data: baseline,
            priority,
            status: VerificationStatus.PENDING,
            flags,
            extracted_values: {
                n_characteristics: chars.length,
                sample_sizes: baseline.sample_sizes,
                key_characteristics: foundKeys
            },
            verified_values: null,
            verifier: null,
            verification_timestamp: null,
            notes: ''
        };
    }

    /**
     * Create verification task for sample sizes
     */
    createSampleSizeVerificationTask(extractedData) {
        const flags = [];
        let priority = VerificationPriority.HIGH; // Sample sizes are always important

        const pop = extractedData.population || {};

        if (!pop.n_randomized) {
            flags.push({ type: 'missing', field: 'n_randomized', severity: 'critical' });
            priority = VerificationPriority.CRITICAL;
        }

        if (!pop.n_treatment || !pop.n_control) {
            flags.push({ type: 'missing', field: 'arm_sizes', severity: 'high' });
        }

        // Check for consistency with outcomes
        if (extractedData.outcomes) {
            for (const outcome of extractedData.outcomes) {
                if (outcome.n_treatment && pop.n_treatment) {
                    const diff = Math.abs(outcome.n_treatment - pop.n_treatment);
                    if (diff > 50) {
                        flags.push({
                            type: 'outcome_n_mismatch',
                            outcome: outcome.name,
                            difference: diff,
                            severity: 'medium'
                        });
                    }
                }
            }
        }

        return {
            id: `sample_size_${Date.now()}`,
            type: 'sample_size',
            name: 'Sample Size Verification',
            data: pop,
            priority,
            status: VerificationStatus.PENDING,
            flags,
            extracted_values: {
                n_randomized: pop.n_randomized,
                n_treatment: pop.n_treatment,
                n_control: pop.n_control,
                n_analyzed: pop.n_analyzed
            },
            verified_values: null,
            verifier: null,
            verification_timestamp: null,
            notes: ''
        };
    }

    /**
     * Submit verification for a task
     * @param {string} taskId - Task identifier
     * @param {Object} verification - Verification data
     * @returns {Object} Updated task
     */
    submitVerification(taskId, verification) {
        const task = this.verificationQueue.find(t => t.id === taskId);
        if (!task) {
            throw new Error(`Verification task not found: ${taskId}`);
        }

        const now = new Date().toISOString();

        // Update task
        task.status = verification.status;
        task.verified_values = verification.values;
        task.verifier = verification.verifier || 'anonymous';
        task.verification_timestamp = now;
        task.notes = verification.notes || '';

        // Calculate changes
        const changes = this.calculateChanges(task.extracted_values, verification.values);
        task.changes = changes;

        // Add to history
        this.verificationHistory.push({
            task_id: taskId,
            task_type: task.type,
            task_name: task.name,
            status: verification.status,
            changes,
            timestamp: now,
            verifier: task.verifier
        });

        // Add audit entry
        this.addAuditEntry('verification_submitted', {
            task_id: taskId,
            task_type: task.type,
            status: verification.status,
            changes_count: changes.length,
            verifier: task.verifier,
            timestamp: now
        });

        // Trigger callback
        if (this.callbacks.onVerificationComplete) {
            this.callbacks.onVerificationComplete(task);
        }

        return task;
    }

    /**
     * Calculate changes between extracted and verified values
     */
    calculateChanges(extracted, verified) {
        const changes = [];

        if (!verified) return changes;

        for (const [key, extractedValue] of Object.entries(extracted)) {
            const verifiedValue = verified[key];

            if (verifiedValue !== undefined && verifiedValue !== extractedValue) {
                changes.push({
                    field: key,
                    extracted: extractedValue,
                    verified: verifiedValue,
                    type: extractedValue == null ? 'added' :
                          verifiedValue == null ? 'removed' : 'modified'
                });
            }
        }

        // Check for new fields in verified
        for (const [key, verifiedValue] of Object.entries(verified)) {
            if (extracted[key] === undefined && verifiedValue !== undefined) {
                changes.push({
                    field: key,
                    extracted: null,
                    verified: verifiedValue,
                    type: 'added'
                });
            }
        }

        return changes;
    }

    /**
     * Get verification progress
     */
    getProgress() {
        const total = this.verificationQueue.length;
        const completed = this.verificationQueue.filter(
            t => t.status !== VerificationStatus.PENDING
        ).length;
        const verified = this.verificationQueue.filter(
            t => t.status === VerificationStatus.VERIFIED
        ).length;
        const flagged = this.verificationQueue.filter(
            t => t.status === VerificationStatus.FLAGGED
        ).length;
        const rejected = this.verificationQueue.filter(
            t => t.status === VerificationStatus.REJECTED
        ).length;

        const criticalPending = this.verificationQueue.filter(
            t => t.priority === VerificationPriority.CRITICAL &&
                 t.status === VerificationStatus.PENDING
        ).length;

        return {
            total,
            completed,
            verified,
            flagged,
            rejected,
            pending: total - completed,
            critical_pending: criticalPending,
            progress_percent: total > 0 ? Math.round((completed / total) * 100) : 100,
            can_proceed: criticalPending === 0,
            message: criticalPending > 0
                ? `${criticalPending} critical item(s) require verification before analysis`
                : completed < total
                    ? `${total - completed} item(s) pending verification`
                    : 'All items verified'
        };
    }

    /**
     * Check if analysis can proceed
     * @returns {Object} Readiness status
     */
    checkAnalysisReadiness() {
        const progress = this.getProgress();

        const blockers = [];
        const warnings = [];

        // Critical items must be verified
        if (progress.critical_pending > 0) {
            blockers.push({
                type: 'critical_pending',
                message: `${progress.critical_pending} critical item(s) require verification`,
                items: this.verificationQueue.filter(
                    t => t.priority === VerificationPriority.CRITICAL &&
                         t.status === VerificationStatus.PENDING
                ).map(t => t.name)
            });
        }

        // Flagged items need attention
        if (progress.flagged > 0) {
            warnings.push({
                type: 'flagged_items',
                message: `${progress.flagged} item(s) flagged for review`,
                items: this.verificationQueue.filter(
                    t => t.status === VerificationStatus.FLAGGED
                ).map(t => t.name)
            });
        }

        // Rejected items
        if (progress.rejected > 0) {
            warnings.push({
                type: 'rejected_items',
                message: `${progress.rejected} item(s) rejected - will be excluded`,
                items: this.verificationQueue.filter(
                    t => t.status === VerificationStatus.REJECTED
                ).map(t => t.name)
            });
        }

        return {
            ready: blockers.length === 0,
            blockers,
            warnings,
            progress
        };
    }

    /**
     * Apply verified values to extracted data
     * @param {Object} extractedData - Original extracted data
     * @returns {Object} Data with verified values applied
     */
    applyVerifiedValues(extractedData) {
        const readiness = this.checkAnalysisReadiness();

        if (!readiness.ready) {
            throw new Error(`Cannot apply verified values: ${readiness.blockers[0]?.message}`);
        }

        // Deep clone
        const verifiedData = JSON.parse(JSON.stringify(extractedData));

        // Apply outcome verifications
        const outcomeTasks = this.verificationQueue.filter(
            t => t.type === 'outcome' && t.status === VerificationStatus.VERIFIED
        );

        for (const task of outcomeTasks) {
            const outcome = verifiedData.outcomes?.find(o => o.name === task.name);
            if (outcome && task.verified_values) {
                // Apply verified values
                Object.assign(outcome, task.verified_values);
                outcome._verified = true;
                outcome._verification_timestamp = task.verification_timestamp;
            }
        }

        // Remove rejected outcomes
        const rejectedOutcomes = this.verificationQueue.filter(
            t => t.type === 'outcome' && t.status === VerificationStatus.REJECTED
        ).map(t => t.name);

        if (verifiedData.outcomes) {
            verifiedData.outcomes = verifiedData.outcomes.filter(
                o => !rejectedOutcomes.includes(o.name)
            );
        }

        // Apply sample size verification
        const sampleTask = this.verificationQueue.find(
            t => t.type === 'sample_size' && t.status === VerificationStatus.VERIFIED
        );
        if (sampleTask?.verified_values) {
            verifiedData.population = {
                ...verifiedData.population,
                ...sampleTask.verified_values,
                _verified: true
            };
        }

        // Add verification metadata
        verifiedData.verification_metadata = {
            verified_at: new Date().toISOString(),
            total_tasks: this.verificationQueue.length,
            verified_count: this.verificationQueue.filter(
                t => t.status === VerificationStatus.VERIFIED
            ).length,
            rejected_count: rejectedOutcomes.length,
            audit_log: this.auditLog
        };

        // Log completion
        this.addAuditEntry('verification_applied', {
            trial_id: verifiedData.trial_id,
            outcomes_verified: outcomeTasks.length,
            outcomes_rejected: rejectedOutcomes.length
        });

        return verifiedData;
    }

    /**
     * Add entry to audit log
     */
    addAuditEntry(action, details) {
        this.auditLog.push({
            timestamp: new Date().toISOString(),
            action,
            details
        });
    }

    /**
     * Export audit log
     */
    exportAuditLog() {
        return {
            generated_at: new Date().toISOString(),
            total_entries: this.auditLog.length,
            verification_summary: this.getProgress(),
            entries: this.auditLog
        };
    }

    /**
     * Cross-validate with registry data
     * @param {Object} extractedData - PDF extracted data
     * @param {Object} registryData - Registry data
     * @returns {Object} Discrepancy report
     */
    crossValidateWithRegistry(extractedData, registryData) {
        const discrepancies = [];

        // Compare sample sizes
        if (extractedData.population?.n_randomized && registryData.enrollment?.count) {
            const pdfN = extractedData.population.n_randomized;
            const regN = registryData.enrollment.count;
            const diff = Math.abs(pdfN - regN);

            if (diff > 10) {
                discrepancies.push({
                    field: 'sample_size',
                    pdf_value: pdfN,
                    registry_value: regN,
                    difference: diff,
                    severity: diff > 100 ? 'high' : 'medium'
                });
            }
        }

        // Compare outcomes
        if (extractedData.outcomes && registryData.outcomes) {
            for (const pdfOutcome of extractedData.outcomes) {
                const regOutcome = registryData.outcomes.find(
                    o => o.title?.toLowerCase().includes(pdfOutcome.name?.toLowerCase()) ||
                         pdfOutcome.name?.toLowerCase().includes(o.title?.toLowerCase())
                );

                if (regOutcome && pdfOutcome.is_primary !== (regOutcome.type === 'PRIMARY')) {
                    discrepancies.push({
                        field: 'primary_outcome',
                        outcome: pdfOutcome.name,
                        pdf_primary: pdfOutcome.is_primary,
                        registry_primary: regOutcome.type === 'PRIMARY',
                        severity: 'medium'
                    });
                }
            }
        }

        // Log discrepancies
        if (discrepancies.length > 0) {
            this.addAuditEntry('cross_validation', {
                discrepancy_count: discrepancies.length,
                discrepancies
            });

            if (this.callbacks.onDiscrepancyFound) {
                this.callbacks.onDiscrepancyFound(discrepancies);
            }
        }

        return {
            has_discrepancies: discrepancies.length > 0,
            discrepancy_count: discrepancies.length,
            discrepancies
        };
    }

    /**
     * Register callback
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }

    /**
     * Reset verification state
     */
    reset() {
        this.verificationQueue = [];
        this.verificationHistory = [];
        // Keep audit log for history
        this.addAuditEntry('verification_reset', {});
    }
}

/**
 * Create verification UI component
 * @param {Object} task - Verification task
 * @returns {string} HTML for verification form
 */
export function createVerificationUI(task) {
    const priorityLabels = {
        [VerificationPriority.CRITICAL]: 'Critical',
        [VerificationPriority.HIGH]: 'High',
        [VerificationPriority.MEDIUM]: 'Medium',
        [VerificationPriority.LOW]: 'Low'
    };

    const priorityColors = {
        [VerificationPriority.CRITICAL]: '#dc2626',
        [VerificationPriority.HIGH]: '#f59e0b',
        [VerificationPriority.MEDIUM]: '#3b82f6',
        [VerificationPriority.LOW]: '#6b7280'
    };

    const flagsHtml = task.flags.map(f => `
        <span class="verification-flag ${f.severity}">
            ${f.type.replace(/_/g, ' ')}
            ${f.value !== undefined ? `: ${f.value}` : ''}
        </span>
    `).join('');

    const fieldsHtml = Object.entries(task.extracted_values)
        .filter(([k, v]) => v !== undefined && v !== null)
        .map(([key, value]) => `
            <div class="verification-field">
                <label>${key.replace(/_/g, ' ')}</label>
                <div class="verification-value-row">
                    <span class="extracted-value">${formatValue(value)}</span>
                    <input type="text"
                           class="verified-input"
                           data-field="${key}"
                           placeholder="Verify or correct"
                           value="${value !== null ? value : ''}">
                </div>
            </div>
        `).join('');

    return `
        <div class="verification-task" data-task-id="${task.id}">
            <div class="verification-header">
                <h4>${task.name}</h4>
                <span class="priority-badge" style="background: ${priorityColors[task.priority]}">
                    ${priorityLabels[task.priority]}
                </span>
            </div>

            ${task.flags.length > 0 ? `
                <div class="verification-flags">
                    ${flagsHtml}
                </div>
            ` : ''}

            <div class="verification-fields">
                ${fieldsHtml}
            </div>

            <div class="verification-notes">
                <label>Notes</label>
                <textarea class="verification-notes-input"
                          placeholder="Add any notes about this verification..."></textarea>
            </div>

            <div class="verification-actions">
                <button class="btn btn-success verify-btn" data-status="verified">
                    Verify Correct
                </button>
                <button class="btn btn-warning flag-btn" data-status="flagged">
                    Flag for Review
                </button>
                <button class="btn btn-danger reject-btn" data-status="rejected">
                    Reject
                </button>
            </div>
        </div>
    `;
}

function formatValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : value.toFixed(3);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

/**
 * Singleton instance
 */
let _verificationManager = null;

export function getVerificationManager() {
    if (!_verificationManager) {
        _verificationManager = new VerificationManager();
    }
    return _verificationManager;
}

export default {
    VerificationManager,
    VerificationStatus,
    VerificationPriority,
    createVerificationUI,
    getVerificationManager
};
