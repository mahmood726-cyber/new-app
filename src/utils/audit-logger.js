/**
 * Audit Logging System for Meta-Analysis Platform
 *
 * Provides comprehensive audit trail for:
 * - Data extraction decisions
 * - Analysis parameter choices
 * - Verification actions
 * - Export operations
 *
 * Essential for reproducibility and transparency in systematic reviews.
 */

// Log levels
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
};

// Action categories
export const ActionCategory = {
    EXTRACTION: 'extraction',
    VERIFICATION: 'verification',
    ANALYSIS: 'analysis',
    SENSITIVITY: 'sensitivity',
    EXPORT: 'export',
    USER_ACTION: 'user_action',
    SYSTEM: 'system'
};

/**
 * Single audit log entry
 */
export class AuditEntry {
    constructor(category, action, details, level = LogLevel.INFO) {
        this.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.timestamp = new Date().toISOString();
        this.category = category;
        this.action = action;
        this.details = details;
        this.level = level;
        this.user = details.user || 'system';
        this.sessionId = details.sessionId || null;

        // Capture context if available
        this.context = {
            analysisId: details.analysisId || null,
            studyId: details.studyId || null,
            outcomeId: details.outcomeId || null
        };
    }

    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            category: this.category,
            action: this.action,
            level: this.level,
            user: this.user,
            sessionId: this.sessionId,
            context: this.context,
            details: this.details
        };
    }

    toString() {
        const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
        return `[${this.timestamp}] [${levelNames[this.level]}] [${this.category}] ${this.action}: ${JSON.stringify(this.details)}`;
    }
}

/**
 * Main Audit Logger Class
 */
export class AuditLogger {
    constructor(options = {}) {
        this.entries = [];
        this.maxEntries = options.maxEntries || 10000;
        this.sessionId = options.sessionId || this.generateSessionId();
        this.startTime = new Date();
        this.listeners = [];

        // Initialize with session start
        this.log(ActionCategory.SYSTEM, 'session_start', {
            startTime: this.startTime.toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
        });
    }

    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add a log entry
     */
    log(category, action, details = {}, level = LogLevel.INFO) {
        const entry = new AuditEntry(category, action, {
            ...details,
            sessionId: this.sessionId
        }, level);

        this.entries.push(entry);

        // Trim if exceeding max
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
        }

        // Notify listeners
        this.listeners.forEach(listener => {
            try {
                listener(entry);
            } catch (e) {
                console.error('Audit listener error:', e);
            }
        });

        return entry;
    }

    /**
     * Log extraction action
     */
    logExtraction(action, details) {
        return this.log(ActionCategory.EXTRACTION, action, details);
    }

    /**
     * Log verification action
     */
    logVerification(action, details) {
        return this.log(ActionCategory.VERIFICATION, action, details);
    }

    /**
     * Log analysis action
     */
    logAnalysis(action, details) {
        return this.log(ActionCategory.ANALYSIS, action, details);
    }

    /**
     * Log sensitivity analysis
     */
    logSensitivity(action, details) {
        return this.log(ActionCategory.SENSITIVITY, action, details);
    }

    /**
     * Log export action
     */
    logExport(action, details) {
        return this.log(ActionCategory.EXPORT, action, details);
    }

    /**
     * Log data extraction with full details
     */
    logDataExtraction(studyId, extractedData, confidence, source) {
        return this.logExtraction('data_extracted', {
            studyId,
            fields: Object.keys(extractedData),
            confidence,
            source,
            dataHash: this.hashData(extractedData)
        });
    }

    /**
     * Log verification decision
     */
    logVerificationDecision(taskId, decision, reviewer, reason) {
        return this.logVerification('decision_made', {
            taskId,
            decision,
            reviewer,
            reason,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Log analysis parameters
     */
    logAnalysisParams(params) {
        return this.logAnalysis('parameters_set', {
            model: params.model,
            estimator: params.estimator,
            ciAdjustment: params.ciAdjustment,
            effectMeasure: params.effectMeasure,
            alpha: params.alpha || 0.05
        });
    }

    /**
     * Log analysis results
     */
    logAnalysisResults(results) {
        return this.logAnalysis('results_computed', {
            pooledEffect: results.pooledEffect,
            ci: results.ci,
            heterogeneity: {
                I2: results.heterogeneity?.I2,
                tau2: results.heterogeneity?.tau2
            },
            nStudies: results.nStudies,
            model: results.model
        });
    }

    /**
     * Log sensitivity analysis
     */
    logSensitivityAnalysis(type, originalResult, sensitivityResult) {
        return this.logSensitivity('sensitivity_performed', {
            type,
            original: {
                effect: originalResult.pooledEffect,
                ci: originalResult.ci
            },
            sensitivity: {
                effect: sensitivityResult.pooledEffect,
                ci: sensitivityResult.ci
            },
            change: this.calculateChange(originalResult, sensitivityResult)
        });
    }

    /**
     * Log GRADE assessment
     */
    logGRADEAssessment(outcomeId, assessment) {
        return this.logAnalysis('grade_assessed', {
            outcomeId,
            finalCertainty: assessment.certaintyLabel?.text,
            domains: Object.entries(assessment.domains).map(([k, v]) => ({
                domain: k,
                downgrade: v.downgrade,
                reason: v.reason
            }))
        });
    }

    /**
     * Log export operation
     */
    logExportOperation(format, options) {
        return this.logExport('data_exported', {
            format,
            options,
            entriesExported: this.entries.length
        });
    }

    /**
     * Calculate change between results
     */
    calculateChange(original, sensitivity) {
        if (!original?.pooledEffect || !sensitivity?.pooledEffect) return null;
        return {
            absoluteChange: sensitivity.pooledEffect - original.pooledEffect,
            relativeChange: ((sensitivity.pooledEffect - original.pooledEffect) / original.pooledEffect) * 100
        };
    }

    /**
     * Simple hash for data integrity
     */
    hashData(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    /**
     * Add listener for real-time logging
     */
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Get entries by category
     */
    getByCategory(category) {
        return this.entries.filter(e => e.category === category);
    }

    /**
     * Get entries by time range
     */
    getByTimeRange(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return this.entries.filter(e => {
            const entryTime = new Date(e.timestamp);
            return entryTime >= start && entryTime <= end;
        });
    }

    /**
     * Get entries by level
     */
    getByLevel(minLevel) {
        return this.entries.filter(e => e.level >= minLevel);
    }

    /**
     * Search entries
     */
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.entries.filter(e =>
            e.action.toLowerCase().includes(lowerQuery) ||
            JSON.stringify(e.details).toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Get summary statistics
     */
    getSummary() {
        const byCategory = {};
        const byLevel = {};

        this.entries.forEach(e => {
            byCategory[e.category] = (byCategory[e.category] || 0) + 1;
            byLevel[e.level] = (byLevel[e.level] || 0) + 1;
        });

        return {
            sessionId: this.sessionId,
            startTime: this.startTime.toISOString(),
            totalEntries: this.entries.length,
            byCategory,
            byLevel,
            duration: (new Date() - this.startTime) / 1000 / 60  // minutes
        };
    }

    /**
     * Export to JSON
     */
    exportJSON() {
        return JSON.stringify({
            meta: {
                sessionId: this.sessionId,
                startTime: this.startTime.toISOString(),
                exportTime: new Date().toISOString(),
                totalEntries: this.entries.length
            },
            entries: this.entries.map(e => e.toJSON())
        }, null, 2);
    }

    /**
     * Export to CSV
     */
    exportCSV() {
        const headers = ['ID', 'Timestamp', 'Category', 'Action', 'Level', 'User', 'Details'];
        const rows = this.entries.map(e => [
            e.id,
            e.timestamp,
            e.category,
            e.action,
            ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'][e.level],
            e.user,
            JSON.stringify(e.details)
        ]);

        return [
            headers.join(','),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
    }

    /**
     * Export formatted text report
     */
    exportTextReport() {
        const summary = this.getSummary();

        let report = '='.repeat(60) + '\n';
        report += 'META-ANALYSIS AUDIT LOG REPORT\n';
        report += '='.repeat(60) + '\n\n';

        report += `Session ID: ${summary.sessionId}\n`;
        report += `Session Start: ${summary.startTime}\n`;
        report += `Report Generated: ${new Date().toISOString()}\n`;
        report += `Session Duration: ${summary.duration.toFixed(1)} minutes\n`;
        report += `Total Log Entries: ${summary.totalEntries}\n\n`;

        report += '-'.repeat(40) + '\n';
        report += 'ENTRIES BY CATEGORY\n';
        report += '-'.repeat(40) + '\n';
        Object.entries(summary.byCategory).forEach(([cat, count]) => {
            report += `  ${cat}: ${count}\n`;
        });

        report += '\n' + '-'.repeat(40) + '\n';
        report += 'CHRONOLOGICAL LOG\n';
        report += '-'.repeat(40) + '\n\n';

        this.entries.forEach(e => {
            report += e.toString() + '\n';
        });

        report += '\n' + '='.repeat(60) + '\n';
        report += 'END OF AUDIT LOG\n';
        report += '='.repeat(60) + '\n';

        return report;
    }

    /**
     * Clear all entries
     */
    clear() {
        const count = this.entries.length;
        this.entries = [];
        this.log(ActionCategory.SYSTEM, 'audit_cleared', {
            clearedEntries: count
        });
    }
}

// Singleton instance
let auditLoggerInstance = null;

export function getAuditLogger(options = {}) {
    if (!auditLoggerInstance) {
        auditLoggerInstance = new AuditLogger(options);
    }
    return auditLoggerInstance;
}

/**
 * Create audit log viewer UI component
 */
export function createAuditLogViewer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const logger = getAuditLogger();

    const html = `
        <div class="audit-log-viewer">
            <div class="audit-header">
                <h4>Audit Log</h4>
                <div class="audit-controls">
                    <select id="audit-filter-category">
                        <option value="">All Categories</option>
                        <option value="extraction">Extraction</option>
                        <option value="verification">Verification</option>
                        <option value="analysis">Analysis</option>
                        <option value="sensitivity">Sensitivity</option>
                        <option value="export">Export</option>
                    </select>
                    <select id="audit-filter-level">
                        <option value="0">All Levels</option>
                        <option value="1">Info+</option>
                        <option value="2">Warn+</option>
                        <option value="3">Error+</option>
                    </select>
                    <input type="search" id="audit-search" placeholder="Search...">
                </div>
            </div>
            <div class="audit-summary" id="audit-summary"></div>
            <div class="audit-entries" id="audit-entries"></div>
            <div class="audit-actions">
                <button class="btn-secondary" id="audit-export-json">Export JSON</button>
                <button class="btn-secondary" id="audit-export-csv">Export CSV</button>
                <button class="btn-secondary" id="audit-export-report">Export Report</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Render initial state
    renderAuditSummary();
    renderAuditEntries();

    // Add event listeners
    document.getElementById('audit-filter-category').addEventListener('change', renderAuditEntries);
    document.getElementById('audit-filter-level').addEventListener('change', renderAuditEntries);
    document.getElementById('audit-search').addEventListener('input', renderAuditEntries);

    document.getElementById('audit-export-json').addEventListener('click', () => {
        downloadFile('audit-log.json', logger.exportJSON(), 'application/json');
    });

    document.getElementById('audit-export-csv').addEventListener('click', () => {
        downloadFile('audit-log.csv', logger.exportCSV(), 'text/csv');
    });

    document.getElementById('audit-export-report').addEventListener('click', () => {
        downloadFile('audit-report.txt', logger.exportTextReport(), 'text/plain');
    });

    // Add listener for real-time updates
    logger.addListener(() => {
        renderAuditSummary();
        renderAuditEntries();
    });

    function renderAuditSummary() {
        const summary = logger.getSummary();
        document.getElementById('audit-summary').innerHTML = `
            <span>Session: ${summary.sessionId.substr(0, 12)}...</span>
            <span>Entries: ${summary.totalEntries}</span>
            <span>Duration: ${summary.duration.toFixed(1)} min</span>
        `;
    }

    function renderAuditEntries() {
        const category = document.getElementById('audit-filter-category').value;
        const level = parseInt(document.getElementById('audit-filter-level').value);
        const search = document.getElementById('audit-search').value;

        let entries = logger.entries;

        if (category) {
            entries = entries.filter(e => e.category === category);
        }
        if (level > 0) {
            entries = entries.filter(e => e.level >= level);
        }
        if (search) {
            entries = logger.search(search);
        }

        const levelColors = {
            0: '#6b7280',  // DEBUG - gray
            1: '#3b82f6',  // INFO - blue
            2: '#f59e0b',  // WARN - amber
            3: '#ef4444',  // ERROR - red
            4: '#7c3aed'   // CRITICAL - purple
        };

        const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];

        document.getElementById('audit-entries').innerHTML = entries.slice(-100).reverse().map(e => `
            <div class="audit-entry" style="border-left: 3px solid ${levelColors[e.level]}">
                <div class="entry-header">
                    <span class="entry-time">${new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span class="entry-level" style="color: ${levelColors[e.level]}">${levelNames[e.level]}</span>
                    <span class="entry-category">${e.category}</span>
                </div>
                <div class="entry-action">${e.action}</div>
                <div class="entry-details">${JSON.stringify(e.details, null, 2)}</div>
            </div>
        `).join('');
    }

    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    return logger;
}

export default AuditLogger;
