

// =============================================================================
// GLOBAL ERROR HANDLING
// =============================================================================

window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', { message, source, lineno, colno, error });

    // Show user-friendly message
    if (typeof showToast === 'function') {
        showToast('An error occurred. Please try again.', 'error');
    }

    // Don't suppress the error
    return false;
};

window.onunhandledrejection = function(event) {
    console.error('Unhandled promise rejection:', event.reason);

    if (typeof showToast === 'function') {
        showToast('Operation failed. Please try again.', 'error');
    }
};

// Wrap async operations with error handling
function safeAsync(fn) {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            console.error('Async error:', error);
            if (typeof showToast === 'function') {
                showToast(`Error: ${error.message}`, 'error');
            }
            throw error;
        }
    };
}



/**
 * Meta-Analysis Platform v2.0
 * Main Application Entry Point
 *
 * By Mahmood Ahmad
 * بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
 */

// Import extraction modules
import { extractPDF } from './extraction/pdf-processor.js';
import { parseTable, findBaselineTable, findOutcomesTable } from './extraction/table-parser.js';
import { mapOutcome, getStandardName } from './extraction/outcome-mapper.js';
import { extractEffect, validateEffect } from './extraction/effect-extractor.js';
import { extractFromProse, extractPrimaryOutcome, findResultsSection } from './extraction/prose-extractor.js';
import { extractSubgroups } from './extraction/subgroup-extractor.js';
import { extractBaseline } from './extraction/baseline-extractor.js';
import { extractEventCounts, calculateDerivedValues } from './extraction/event-extractor.js';
import { validateExtraction, flagForReview } from './extraction/validator.js';
import { calculateConfidence, generateReviewPriority } from './extraction/confidence-scorer.js';
import { normalizeData, validateSchema } from './extraction/output-schema.js';
import { exportToJSON, exportToCSV, exportToRevMan, exportToPRISMA, exportAndDownload } from './extraction/exporters.js';
import { KMDigitizer, digitizeKMCurve } from './extraction/km-digitizer.js';
import { SupplementHandler, processSupplement, detectSupplement } from './extraction/supplement-handler.js';
import { DataReconciler, reconcileData, mergeRegistryWithPDF } from './extraction/data-reconciler.js';
import { runExtractionPipeline, runFullExtraction, runExtractionWithRegistry } from './extraction/index.js';

// Import search module
import { searchTrials, getStudyDetails, buildPICOQuery, getPublicationLinks } from './search/clinicaltrials-api.js';

// Import analysis module
import {
    randomEffectsML,
    randomEffectsMeta,
    fixedEffectsIV,
    eggersTest,
    trimAndFill,
    outcomeToMetaFormat,
    leaveOneOut,
    cumulativeMeta,
    influenceDiagnostics,
    petPeese,
    selectionModel3PSM,
    copasSelectionModel,
    publicationBiasSensitivity
} from './analysis/meta-engine.js';

// Application State
const AppState = {
    currentTab: 'search',
    searchResults: [],
    extractionQueue: [],
    extractedData: null,
    supplementData: null,
    registryData: null,
    analysisData: [],
    analysisResults: null,
    exportFormat: 'json',
    kmDigitizer: null
};

// Initialize application


// =============================================================================
// KEYBOARD SHORTCUTS (Ctrl+/ to show all)
// =============================================================================
const KeyboardShortcuts = {
    shortcuts: {
        'Alt+1': { action: 'switchTab', param: 'search', description: 'Go to Search tab' },
        'Alt+2': { action: 'switchTab', param: 'extraction', description: 'Go to Extraction tab' },
        'Alt+3': { action: 'switchTab', param: 'analysis', description: 'Go to Analysis tab' },
        'Alt+4': { action: 'switchTab', param: 'export', description: 'Go to Export tab' },
        'Ctrl+Enter': { action: 'runAnalysis', description: 'Run meta-analysis' },
        'Ctrl+d': { action: 'loadExample', description: 'Load example dataset' },
        'Ctrl+/': { action: 'showShortcuts', description: 'Show keyboard shortcuts' },
        'Escape': { action: 'closeModal', description: 'Close modal/dialog' }
    },

    init() {
        document.addEventListener('keydown', (e) => {
            const key = this._getKeyCombo(e);
            const shortcut = this.shortcuts[key];

            if (shortcut) {
                e.preventDefault();
                this._executeAction(shortcut.action, shortcut.param);
            }
        });
    },

    _getKeyCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        parts.push(e.key);
        return parts.join('+');
    },

    _executeAction(action, param) {
        switch (action) {
            case 'switchTab':
                document.querySelector(`[data-tab="${param}"]`)?.click();
                break;
            case 'runAnalysis':
                document.getElementById('run-analysis-btn')?.click();
                break;
            case 'showShortcuts':
                this.showShortcutsModal();
                break;
            case 'closeModal':
                document.querySelector('.modal.active')?.remove();
                break;
            case 'loadExample':
                showExampleDatasetsModal();
                break;
        }
    },

    showShortcutsModal() {
        const existingModal = document.querySelector('.shortcuts-modal');
        if (existingModal) { existingModal.remove(); return; }

        const modal = document.createElement('div');
        modal.className = 'modal active shortcuts-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.innerHTML = `
            <div style="background:white;padding:24px;border-radius:12px;max-width:500px;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
                <h2 style="margin-top:0;">Keyboard Shortcuts</h2>
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:2px solid #eee;"><th style="text-align:left;padding:8px;">Shortcut</th><th style="text-align:left;padding:8px;">Action</th></tr>
                    </thead>
                    <tbody>
                        ${Object.entries(this.shortcuts).map(([key, s]) =>
                            `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;"><kbd style="background:#f5f5f5;padding:2px 8px;border-radius:4px;border:1px solid #ddd;">${key}</kbd></td><td style="padding:8px;">${s.description}</td></tr>`
                        ).join('')}
                    </tbody>
                </table>
                <button onclick="this.closest('.modal').remove()" style="margin-top:16px;padding:8px 24px;background:#1976d2;color:white;border:none;border-radius:6px;cursor:pointer;">Close</button>
            </div>
        `;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }
};

// Initialize keyboard shortcuts
KeyboardShortcuts.init();

// Example datasets modal
function showExampleDatasetsModal() {
    const existingModal = document.querySelector('.datasets-modal');
    if (existingModal) { existingModal.remove(); return; }

    const datasets = [
        { id: 'bcg', name: 'BCG Vaccine Trials', desc: '13 trials - Tuberculosis prevention (Colditz 1994)', measure: 'RR' },
        { id: 'amlodipine', name: 'Amlodipine Trials', desc: '5 trials - Blood pressure reduction', measure: 'MD' },
        { id: 'statins', name: 'Statin Trials', desc: '8 trials - Cardiovascular prevention', measure: 'OR' },
        { id: 'dementia_dta', name: 'Dementia Screening', desc: '7 studies - MMSE diagnostic accuracy', measure: 'DTA' }
    ];

    const modal = document.createElement('div');
    modal.className = 'modal active datasets-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
    modal.innerHTML = `
        <div style="background:white;padding:24px;border-radius:12px;max-width:600px;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
            <h2 style="margin-top:0;">Load Example Dataset</h2>
            <p style="color:#666;">Select a validated dataset to explore the platform's capabilities:</p>
            <div style="display:grid;gap:12px;">
                ${datasets.map(d => `
                    <div onclick="loadDataset('${d.id}')" style="padding:16px;border:1px solid #ddd;border-radius:8px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='#1976d2';this.style.background='#f5f9ff'" onmouseout="this.style.borderColor='#ddd';this.style.background='white'">
                        <strong>${d.name}</strong> <span style="background:#e3f2fd;padding:2px 8px;border-radius:12px;font-size:12px;">${d.measure}</span>
                        <div style="color:#666;font-size:14px;margin-top:4px;">${d.desc}</div>
                    </div>
                `).join('')}
            </div>
            <button onclick="this.closest('.modal').remove()" style="margin-top:16px;padding:8px 24px;background:#757575;color:white;border:none;border-radius:6px;cursor:pointer;">Cancel</button>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

// Load dataset function
async function loadDataset(id) {
    const { EXAMPLE_DATASETS } = await import('./analysis/meta-engine.js');
    const dataset = EXAMPLE_DATASETS[id];

    if (dataset) {
        window.currentStudies = dataset.studies;
        AppState.studies = dataset.studies;
        showToast(`Loaded ${dataset.name} (${dataset.studies.length} studies)`, 'success');
        document.querySelector('[data-tab="analysis"]')?.click();
        document.querySelector('.datasets-modal')?.remove();
    }
}



document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeSearch();
    initializeExtraction();
    initializeAnalysis();
    initializeExport();
    updateStatus('Ready');
});

// ============================================
// Navigation
// ============================================

function initializeNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Update active states
            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');

            AppState.currentTab = targetTab;
        });
    });
}

// ============================================
// Search Module
// ============================================

function initializeSearch() {
    const searchBtn = document.getElementById('search-btn');

    searchBtn.addEventListener('click', async () => {
        const pico = {
            population: document.getElementById('pico-population').value,
            intervention: document.getElementById('pico-intervention').value,
            comparator: document.getElementById('pico-comparator').value,
            outcomes: document.getElementById('pico-outcomes').value
        };

        const studyType = document.getElementById('study-type').value;
        const status = document.getElementById('study-status').value;

        if (!pico.population && !pico.intervention) {
            showToast('Please enter population or intervention', 'error');
            return;
        }

        updateStatus('Searching registries...');
        showProgress(true);
        searchBtn.disabled = true;

        try {
            const query = buildPICOQuery(pico);
            if (studyType) query.studyType = studyType;
            if (status) query.status = status;

            const results = await searchTrials(query, { maxResults: 200 });

            if (results.success) {
                AppState.searchResults = results.studies;
                displaySearchResults(results);
                showToast(`Found ${results.returnedCount} trials`, 'success');
            } else {
                showToast(`Search failed: ${results.error}`, 'error');
            }
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            searchBtn.disabled = false;
            showProgress(false);
            updateStatus('Ready');
        }
    });
}

function displaySearchResults(results) {
    const panel = document.getElementById('search-results-panel');
    const container = document.getElementById('search-results');

    // Update PRISMA counts
    document.getElementById('prisma-identified').textContent = results.totalCount;
    document.getElementById('prisma-dedup').textContent = results.returnedCount;
    document.getElementById('prisma-screened').textContent = results.returnedCount;
    document.getElementById('prisma-included').textContent = results.studies.filter(s => s.has_results).length;

    // Clear and populate
    container.innerHTML = '';

    for (const study of results.studies) {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <div class="result-card-header">
                <span class="result-card-id">${study.nct_id}</span>
                <span class="result-card-status">${study.status}</span>
            </div>
            <div class="result-card-title">${study.title}</div>
            <div class="result-card-meta">
                ${study.phase || ''} | N=${study.enrollment?.count || '?'} |
                ${study.sponsor || ''}
            </div>
            <div class="result-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewStudyDetails('${study.nct_id}')">
                    View Details
                </button>
                ${study.has_results ? `
                    <button class="btn btn-primary btn-sm" onclick="extractFromRegistry('${study.nct_id}')">
                        Extract
                    </button>
                ` : ''}
            </div>
        `;
        container.appendChild(card);
    }

    panel.style.display = 'block';
}

// Global functions for button handlers
window.viewStudyDetails = async function (nctId) {
    updateStatus(`Loading ${nctId}...`);
    const result = await getStudyDetails(nctId);

    if (result.success) {
        showModal('Study Details', formatStudyDetails(result.study));
    } else {
        showToast(`Error: ${result.error}`, 'error');
    }
    updateStatus('Ready');
};

window.extractFromRegistry = async function (nctId) {
    updateStatus(`Extracting from ${nctId}...`);

    try {
        // Get study results from registry
        const { getStudyResults } = await import('./search/clinicaltrials-api.js');
        const results = await getStudyResults(nctId);

        if (results.success) {
            // Convert registry results to our format
            const extracted = convertRegistryResults(nctId, results.results);
            AppState.extractedData = extracted;
            displayExtractedData(extracted);
            showToast('Data extracted from registry', 'success');

            // Switch to extraction tab
            document.querySelector('[data-tab="extraction"]').click();
        } else {
            showToast(`No results available: ${results.error}`, 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }

    updateStatus('Ready');
};

function formatStudyDetails(study) {
    return `
        <div class="data-grid">
            <div class="data-item">
                <div class="data-item-label">NCT ID</div>
                <div class="data-item-value">${study.nct_id}</div>
            </div>
            <div class="data-item">
                <div class="data-item-label">Title</div>
                <div class="data-item-value">${study.title}</div>
            </div>
            <div class="data-item">
                <div class="data-item-label">Status</div>
                <div class="data-item-value">${study.status}</div>
            </div>
            <div class="data-item">
                <div class="data-item-label">Phase</div>
                <div class="data-item-value">${study.phase || 'N/A'}</div>
            </div>
            <div class="data-item">
                <div class="data-item-label">Enrollment</div>
                <div class="data-item-value">${study.enrollment?.count || 'N/A'}</div>
            </div>
            <div class="data-item">
                <div class="data-item-label">Sponsor</div>
                <div class="data-item-value">${study.sponsor || 'N/A'}</div>
            </div>
        </div>
        <h4 style="margin: 1rem 0 0.5rem;">Interventions</h4>
        <ul>
            ${study.interventions.map(i => `<li>${i.name} (${i.type})</li>`).join('')}
        </ul>
        <h4 style="margin: 1rem 0 0.5rem;">Primary Outcomes</h4>
        <ul>
            ${study.primary_outcomes.map(o => `<li>${o.measure}</li>`).join('')}
        </ul>
    `;
}

// ============================================
// Extraction Module
// ============================================

function initializeExtraction() {
    const dropZone = document.getElementById('pdf-drop-zone');
    const fileInput = document.getElementById('pdf-input');

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    // Data tabs
    const dataTabs = document.querySelectorAll('.data-tab');
    dataTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetSubtab = tab.dataset.subtab;

            dataTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.data-subtab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${targetSubtab}-subtab`).classList.add('active');
        });
    });
}

async function handleFiles(files) {
    for (const file of files) {
        if (file.type !== 'application/pdf') {
            showToast(`Skipping non-PDF file: ${file.name}`, 'warning');
            continue;
        }

        addToQueue(file);
        await processFile(file);
    }
}

function addToQueue(file) {
    const queue = document.getElementById('extraction-queue');

    const item = document.createElement('div');
    item.className = 'queue-item';
    item.id = `queue-${file.name.replace(/[^a-z0-9]/gi, '_')}`;
    item.innerHTML = `
        <div class="queue-item-status processing"></div>
        <div class="queue-item-name">${file.name}</div>
        <div class="queue-item-progress">Processing...</div>
    `;

    queue.appendChild(item);
}

function updateQueueItem(filename, status, message) {
    const itemId = `queue-${filename.replace(/[^a-z0-9]/gi, '_')}`;
    const item = document.getElementById(itemId);

    if (item) {
        const statusEl = item.querySelector('.queue-item-status');
        const progressEl = item.querySelector('.queue-item-progress');

        statusEl.className = `queue-item-status ${status}`;
        progressEl.textContent = message;
    }
}

async function processFile(file) {
    const startTime = performance.now();
    updateStatus(`Processing ${file.name}...`);
    showProgress(true);

    try {
        // Extract PDF content
        updateQueueItem(file.name, 'processing', 'Extracting text...');
        const pdfResult = await extractPDF(file, {
            detectColumns: true,
            preserveLayout: true
        });

        if (!pdfResult.success) {
            throw new Error(pdfResult.error);
        }

        const content = pdfResult.content;

        // Process tables
        updateQueueItem(file.name, 'processing', 'Parsing tables...');
        const tables = content.tables.map(t => parseTable(t));

        // Extract outcomes from tables
        updateQueueItem(file.name, 'processing', 'Extracting outcomes...');
        const outcomesTable = findOutcomesTable(content.tables);
        const outcomes = [];

        if (outcomesTable) {
            for (const row of outcomesTable.data || []) {
                if (row[0]) {
                    const outcomeName = row[0].raw || row[0];
                    const mapped = mapOutcome(outcomeName);

                    // Try to extract effect from row
                    const rowText = row.map(c => c.raw || c).join(' ');
                    const effect = extractEffect(rowText);

                    if (effect.success) {
                        outcomes.push({
                            name: outcomeName,
                            mapped: mapped.mapped,
                            category: mapped.category,
                            effect: effect.value,
                            ci_lower: effect.ci_lower,
                            ci_upper: effect.ci_upper,
                            effect_type: effect.effect_type,
                            p_value: effect.p_value,
                            source: 'table',
                            confidence: effect.confidence
                        });
                    }
                }
            }
        }

        // Extract from prose
        updateQueueItem(file.name, 'processing', 'Processing text...');
        const resultsSection = findResultsSection(content.fullText);
        if (resultsSection) {
            const proseResults = extractFromProse(resultsSection);

            for (const proseOutcome of proseResults.outcomes) {
                // Avoid duplicates
                const exists = outcomes.find(o =>
                    o.mapped === proseOutcome.outcome?.mapped ||
                    o.name === proseOutcome.outcome?.raw
                );

                if (!exists && proseOutcome.effect) {
                    outcomes.push({
                        name: proseOutcome.outcome?.raw || 'Unknown',
                        mapped: proseOutcome.outcome?.mapped,
                        category: proseOutcome.outcome?.category,
                        effect: proseOutcome.effect.value,
                        ci_lower: proseOutcome.effect.ci_lower,
                        ci_upper: proseOutcome.effect.ci_upper,
                        effect_type: proseOutcome.effect.type,
                        p_value: proseOutcome.effect.p_value,
                        source: 'prose',
                        confidence: proseOutcome.confidence
                    });
                }
            }
        }

        // Extract baseline
        updateQueueItem(file.name, 'processing', 'Extracting baseline...');
        const baselineTable = findBaselineTable(content.tables);
        const baseline = baselineTable ? extractBaseline(baselineTable) : null;

        // Extract subgroups
        const subgroupResult = extractSubgroups(content.fullText);

        // Build extracted data object
        const extractedData = {
            trial_id: file.name.replace('.pdf', ''),
            trial_name: file.name.replace('.pdf', ''),
            outcomes,
            baseline: baseline?.success ? baseline : null,
            subgroups: subgroupResult.subgroups,
            raw_tables: tables,
            extraction_metadata: {
                timestamp: new Date().toISOString(),
                engine_version: '2.0.0',
                processing_time_ms: Math.round(performance.now() - startTime),
                source_type: 'pdf',
                pages_processed: pdfResult.metadata.pagesProcessed
            }
        };

        // Validate
        const validation = validateExtraction(extractedData);
        extractedData.validation = validation;

        // Calculate confidence
        const confidence = calculateConfidence(extractedData);
        extractedData.extraction_metadata.overall_confidence = confidence.overall;
        extractedData.confidence = confidence;

        // Store and display
        AppState.extractedData = extractedData;
        displayExtractedData(extractedData);

        updateQueueItem(file.name, 'complete', `Done (${Math.round(confidence.overall * 100)}% confidence)`);
        showToast(`Extracted ${outcomes.length} outcomes from ${file.name}`, 'success');

    } catch (error) {
        console.error('Extraction error:', error);
        updateQueueItem(file.name, 'error', `Error: ${error.message}`);
        showToast(`Failed to process ${file.name}: ${error.message}`, 'error');
    } finally {
        showProgress(false);
        updateStatus('Ready');
    }
}

function displayExtractedData(data) {
    const panel = document.getElementById('extracted-data-panel');
    panel.style.display = 'block';

    // Update confidence badge
    const confidenceEl = document.getElementById('overall-confidence');
    const confidence = data.extraction_metadata?.overall_confidence || data.confidence?.overall || 0;
    confidenceEl.textContent = Math.round(confidence * 100);

    // Trial info
    const infoGrid = document.getElementById('trial-info-grid');
    infoGrid.innerHTML = `
        <div class="data-item">
            <div class="data-item-label">Trial ID</div>
            <div class="data-item-value">${data.trial_id || 'Unknown'}</div>
        </div>
        <div class="data-item">
            <div class="data-item-label">Trial Name</div>
            <div class="data-item-value">${data.trial_name || 'Unknown'}</div>
        </div>
        <div class="data-item">
            <div class="data-item-label">Outcomes Extracted</div>
            <div class="data-item-value">${data.outcomes?.length || 0}</div>
        </div>
        <div class="data-item">
            <div class="data-item-label">Processing Time</div>
            <div class="data-item-value">${data.extraction_metadata?.processing_time_ms || 0}ms</div>
        </div>
    `;

    // Outcomes table
    const outcomesBody = document.querySelector('#outcomes-table tbody');
    outcomesBody.innerHTML = '';

    for (const outcome of data.outcomes || []) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${outcome.name}</td>
            <td>${outcome.events_treatment || '-'}</td>
            <td>${outcome.events_control || '-'}</td>
            <td>${outcome.effect?.toFixed(2) || '-'}</td>
            <td>${outcome.ci_lower?.toFixed(2) || '-'} - ${outcome.ci_upper?.toFixed(2) || '-'}</td>
            <td>${outcome.p_value || '-'}</td>
            <td>${outcome.confidence ? Math.round(outcome.confidence * 100) + '%' : '-'}</td>
        `;
        outcomesBody.appendChild(row);
    }

    // Baseline table
    if (data.baseline?.characteristics) {
        const baselineBody = document.querySelector('#baseline-table tbody');
        baselineBody.innerHTML = '';

        for (const char of data.baseline.characteristics) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${char.label}</td>
                <td>${formatValue(char.treatment)}</td>
                <td>${formatValue(char.control)}</td>
            `;
            baselineBody.appendChild(row);
        }
    }

    // Subgroups
    const subgroupsContainer = document.getElementById('subgroups-container');
    if (data.subgroups?.length > 0) {
        subgroupsContainer.innerHTML = data.subgroups.map(sg => `
            <div class="subgroup-analysis">
                <h4>${sg.variable_label || sg.variable}</h4>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Effect</th>
                            <th>95% CI</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sg.categories.map(cat => `
                            <tr>
                                <td>${cat.label}</td>
                                <td>${cat.effect?.value?.toFixed(2) || '-'}</td>
                                <td>${cat.effect?.ci_lower?.toFixed(2) || '-'} - ${cat.effect?.ci_upper?.toFixed(2) || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${sg.interaction_p ? `<p>P for interaction: ${sg.interaction_p.value}</p>` : ''}
            </div>
        `).join('');
    } else {
        subgroupsContainer.innerHTML = '<p>No subgroup analyses extracted</p>';
    }

    // Raw tables
    const rawTablesContainer = document.getElementById('raw-tables-container');
    if (data.raw_tables?.length > 0) {
        rawTablesContainer.innerHTML = data.raw_tables.map((table, i) => `
            <div class="raw-table">
                <h4>Table ${i + 1}</h4>
                <pre style="font-size: 0.75rem; overflow-x: auto;">${table.raw || JSON.stringify(table, null, 2)}</pre>
            </div>
        `).join('');
    }
}

function formatValue(val) {
    if (!val) return '-';
    if (val.mean != null && val.sd != null) return `${val.mean} ± ${val.sd}`;
    if (val.n != null && val.percentage != null) return `${val.n} (${val.percentage}%)`;
    if (val.percentage != null) return `${val.percentage}%`;
    return JSON.stringify(val);
}

function convertRegistryResults(nctId, results) {
    const outcomes = [];

    if (results.outcomes) {
        for (const outcome of results.outcomes) {
            const mapped = mapOutcome(outcome.title);

            outcomes.push({
                name: outcome.title,
                mapped: mapped.mapped,
                category: mapped.category,
                is_primary: outcome.type === 'PRIMARY',
                definition: outcome.description,
                source: 'registry'
            });
        }
    }

    return {
        trial_id: nctId,
        outcomes,
        baseline: results.baseline,
        extraction_metadata: {
            timestamp: new Date().toISOString(),
            source_type: 'registry',
            engine_version: '2.0.0'
        }
    };
}

// ============================================
// Analysis Module
// ============================================

function initializeAnalysis() {
    const runBtn = document.getElementById('run-analysis-btn');

    runBtn.addEventListener('click', () => {
        if (!AppState.extractedData || !AppState.extractedData.outcomes?.length) {
            showToast('No outcome data available. Extract data first.', 'error');
            return;
        }

        runMetaAnalysis();
    });

    // CI Method guidance toggle
    const ciMethodSelect = document.getElementById('ci-method');
    if (ciMethodSelect) {
        ciMethodSelect.addEventListener('change', (e) => {
            const method = e.target.value;
            const hksjGuidance = document.getElementById('hksj-guidance');
            const waldGuidance = document.getElementById('wald-guidance');

            if (method === 'hksj') {
                hksjGuidance.style.display = 'block';
                waldGuidance.style.display = 'none';
                hksjGuidance.classList.add('selected');
                waldGuidance.classList.remove('selected');
            } else {
                hksjGuidance.style.display = 'none';
                waldGuidance.style.display = 'block';
                waldGuidance.classList.add('selected');
                hksjGuidance.classList.remove('selected');
            }
        });
    }

    // Sensitivity analysis buttons
    const looBtn = document.getElementById('run-loo-btn');
    const cumulativeBtn = document.getElementById('run-cumulative-btn');
    const influenceBtn = document.getElementById('run-influence-btn');

    if (looBtn) {
        looBtn.addEventListener('click', () => runLeaveOneOut());
    }
    if (cumulativeBtn) {
        cumulativeBtn.addEventListener('click', () => runCumulativeAnalysis());
    }
    if (influenceBtn) {
        influenceBtn.addEventListener('click', () => runInfluenceAnalysis());
    }

    // Copas Selection Model button
    const copasBtn = document.getElementById('run-copas-btn');
    if (copasBtn) {
        copasBtn.addEventListener('click', () => runCopasAnalysis());
    }
}

/**
 * Run Copas selection model sensitivity analysis
 * Reference: Copas J, Shi JQ. Meta-analysis, funnel plots and sensitivity analysis.
 * Biostatistics. 2000;1(3):247-262.
 */
function runCopasAnalysis() {
    if (!AppState.analysisResults || !AppState.analysisResults.studies) {
        showToast('Run meta-analysis first', 'warning');
        return;
    }

    const studies = AppState.analysisResults.studies;
    if (studies.length < 5) {
        showToast('Copas model requires at least 5 studies', 'warning');
        return;
    }

    updateStatus('Running Copas selection model...');
    
    try {
        const result = copasSelectionModel(studies);
        
        // Update the Copas result display
        const copasResult = document.getElementById('copas-result');
        if (copasResult && result.adjusted) {
            const change = ((result.adjusted - result.unadjusted) / Math.abs(result.unadjusted) * 100).toFixed(1);
            copasResult.textContent = change + '% adj';
            copasResult.title = 'Adjusted: ' + result.adjusted.toFixed(3) + 
                               ' (Unadjusted: ' + result.unadjusted.toFixed(3) + ')';
        }
        
        // Display detailed results
        displayCopasResults(result);
        showToast('Copas analysis complete', 'success');
    } catch (error) {
        console.error('Copas analysis error:', error);
        showToast('Copas analysis failed: ' + error.message, 'error');
    }
    
    updateStatus('Ready');
}

function displayCopasResults(result) {
    const container = document.getElementById('sensitivity-results') || 
                      document.querySelector('.sensitivity-results');
    if (!container) return;
    
    container.style.display = 'block';
    
    const summary = document.getElementById('sensitivity-summary');
    if (summary) {
        summary.innerHTML = '<div class="copas-results">' +
            '<h4>Copas Selection Model Results</h4>' +
            '<p class="reference">Copas & Shi (2000) Biostatistics 1(3):247-262</p>' +
            '<table class="results-table">' +
            '<tr><td>Unadjusted Effect:</td><td>' + (result.unadjusted?.toFixed(4) || 'N/A') + '</td></tr>' +
            '<tr><td>Adjusted Effect:</td><td>' + (result.adjusted?.toFixed(4) || 'N/A') + '</td></tr>' +
            '<tr><td>Selection Parameters:</td><td>rho=' + (result.rho?.toFixed(3) || 'N/A') + '</td></tr>' +
            '</table>' +
            '<p class="interpretation">' + (result.interpretation || 
                'The Copas model adjusts for potential publication bias by modeling the selection process.') + '</p>' +
            '</div>';
    }
}

function runLeaveOneOut() {
    if (!AppState.analysisResults || !AppState.analysisResults.studies) {
        showToast('Run meta-analysis first', 'warning');
        return;
    }

    updateStatus('Running leave-one-out analysis...');
    const studies = AppState.analysisResults.studies;
    const result = leaveOneOut(studies, { method: 'REML' });

    if (result.success) {
        displaySensitivityResults('Leave-One-Out Analysis', result);
        showToast('Leave-one-out analysis complete', 'success');
    } else {
        showToast(`Analysis failed: ${result.error}`, 'error');
    }
    updateStatus('Ready');
}

function runCumulativeAnalysis() {
    if (!AppState.analysisResults || !AppState.analysisResults.studies) {
        showToast('Run meta-analysis first', 'warning');
        return;
    }

    updateStatus('Running cumulative meta-analysis...');
    const studies = AppState.analysisResults.studies;
    const result = cumulativeMeta(studies, { sortBy: 'year' });

    if (result.success) {
        displaySensitivityResults('Cumulative Meta-Analysis', result);
        showToast('Cumulative analysis complete', 'success');
    } else {
        showToast(`Analysis failed: ${result.error}`, 'error');
    }
    updateStatus('Ready');
}

function runInfluenceAnalysis() {
    if (!AppState.analysisResults || !AppState.analysisResults.studies) {
        showToast('Run meta-analysis first', 'warning');
        return;
    }

    updateStatus('Running influence diagnostics...');
    const studies = AppState.analysisResults.studies;
    const result = influenceDiagnostics(studies, { method: 'REML' });

    if (result.success) {
        displaySensitivityResults('Influence Diagnostics', result);
        showToast('Influence analysis complete', 'success');
    } else {
        showToast(`Analysis failed: ${result.error}`, 'error');
    }
    updateStatus('Ready');
}

function displaySensitivityResults(title, result) {
    const container = document.getElementById('sensitivity-results');
    const summary = document.getElementById('sensitivity-summary');
    const canvas = document.getElementById('sensitivity-plot');

    container.style.display = 'block';

    // Build summary HTML
    let html = `<h4>${title}</h4>`;

    if (result.results) {
        // Leave-one-out results
        const influential = result.results.filter(r => r.influential);
        if (influential.length > 0) {
            html += `<p class="warning">Influential studies: ${influential.map(r => r.study).join(', ')}</p>`;
        } else {
            html += `<p class="highlight">No single study substantially changes the pooled estimate</p>`;
        }
    } else if (result.cumulative) {
        // Cumulative results
        const first = result.cumulative[0];
        const last = result.cumulative[result.cumulative.length - 1];
        html += `<p>Effect evolved from <span class="highlight">${first.effect.toFixed(3)}</span> to <span class="highlight">${last.effect.toFixed(3)}</span></p>`;
    } else if (result.diagnostics) {
        // Influence diagnostics
        const outliers = result.diagnostics.filter(d => d.is_outlier || d.is_influential);
        if (outliers.length > 0) {
            html += `<p class="warning">Potential outliers/influential: ${outliers.map(d => d.study).join(', ')}</p>`;
        } else {
            html += `<p class="highlight">No outliers or influential studies detected</p>`;
        }
    }

    if (result.interpretation) {
        html += `<p>${result.interpretation}</p>`;
    }

    summary.innerHTML = html;

    // Draw sensitivity plot if we have data
    if (canvas && (result.results || result.cumulative || result.diagnostics)) {
        drawSensitivityPlot(canvas, result);
    }
}

function runMetaAnalysis() {
    const outcomes = AppState.extractedData.outcomes;
    const model = document.getElementById('meta-model').value;
    const effectMeasure = document.getElementById('effect-measure').value;
    const ciMethod = document.getElementById('ci-method')?.value || 'hksj';

    // For demonstration, show the data in the results panel
    const resultsPanel = document.getElementById('analysis-results-panel');
    resultsPanel.style.display = 'block';

    // Convert outcomes to meta-analysis format
    const studies = outcomes
        .filter(o => o.effect != null && o.ci_lower != null && o.ci_upper != null)
        .map(o => outcomeToMetaFormat(o));

    if (studies.length > 0) {
        let result;
        const useHKSJ = ciMethod === 'hksj';

        // Run appropriate meta-analysis model
        if (model === 'random' || model === 'random-reml') {
            const method = model === 'random-reml' ? 'REML' : 'DL';
            result = randomEffectsMeta(studies, { method, hksj: useHKSJ });
        } else {
            result = fixedEffectsIV(studies);
        }

        // Add CI method info to results
        if (result.success) {
            result.ciMethod = ciMethod;
            result.ciMethodLabel = useHKSJ ? 'HKSJ (t-distribution)' : 'Wald (z-distribution)';
        }

        if (result.success) {
            // Store results
            AppState.analysisResults = result;

            // Update display
            document.getElementById('pooled-effect').textContent = result.pooledEffect.toFixed(3);
            document.getElementById('pooled-ci').textContent =
                `95% CI: ${result.ci_lower.toFixed(3)} - ${result.ci_upper.toFixed(3)}`;
            document.getElementById('pooled-pvalue').textContent = result.p_value?.toFixed(4) || 'N/A';
            document.getElementById('i-squared').textContent = `${(result.heterogeneity.I2 * 100).toFixed(1)}%`;

            // Prediction interval for random effects
            if (model === 'random' && result.predictionInterval) {
                document.getElementById('prediction-interval').textContent =
                    `${result.predictionInterval.lower.toFixed(3)} - ${result.predictionInterval.upper.toFixed(3)}`;
            } else {
                document.getElementById('prediction-interval').textContent = 'N/A';
            }

            // Run Egger's test for publication bias
            const eggerResult = eggersTest(studies);
            if (eggerResult.success) {
                const biasIndicator = eggerResult.p_value < 0.1 ? 'Potential bias detected' : 'No significant bias';
                showToast(`Egger's test: ${biasIndicator} (p=${eggerResult.p_value.toFixed(3)})`, 'info');
            }

            // Draw plots
            drawForestPlot(outcomes, result);
            drawFunnelPlot(outcomes, result);
        } else {
            showToast(`Analysis failed: ${result.error}`, 'error');
        }
    } else {
        showToast('Insufficient data for meta-analysis', 'error');
    }

    showToast('Analysis completed', 'success');
}

function drawForestPlot(outcomes, metaResult = null) {
    const canvas = document.getElementById('forest-plot');
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Enhanced layout with weight column
    const padding = { left: 160, right: 180, top: 60, bottom: 80 };
    const plotWidth = canvas.width - padding.left - padding.right;
    const rowHeight = 32;
    const headerHeight = 30;
    const totalRows = outcomes.length + (metaResult ? 3 : 0); // +3 for space, pooled, and stats

    // Calculate study weights (inverse variance)
    const weights = outcomes.map(o => {
        if (o.ci_lower && o.ci_upper && o.effect) {
            const se = (Math.log(o.ci_upper) - Math.log(o.ci_lower)) / 3.92;
            return 1 / (se * se);
        }
        return 1;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => (w / totalWeight) * 100);

    // Find effect range
    const allValues = outcomes.flatMap(o => [o.effect, o.ci_lower, o.ci_upper]).filter(v => v != null);
    if (metaResult) {
        allValues.push(metaResult.pooledEffect, metaResult.ci_lower, metaResult.ci_upper);
    }
    const minVal = Math.min(...allValues, 0.5);
    const maxVal = Math.max(...allValues, 2);

    const xScale = (val) => padding.left + ((Math.log(val) - Math.log(minVal)) / (Math.log(maxVal) - Math.log(minVal))) * plotWidth;
    const nullLine = xScale(1);

    // Draw header row
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'left';
    ctx.fillText('Study', 10, padding.top - 15);
    ctx.textAlign = 'center';
    ctx.fillText('Weight', padding.left + plotWidth + 25, padding.top - 15);
    ctx.fillText('Effect [95% CI]', canvas.width - 60, padding.top - 15);

    // Header underline
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(5, padding.top - 5);
    ctx.lineTo(canvas.width - 5, padding.top - 5);
    ctx.stroke();

    // Draw null line (reference line at 1)
    ctx.strokeStyle = '#6b7280';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nullLine, padding.top);
    ctx.lineTo(nullLine, padding.top + (outcomes.length + 1) * rowHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw each study with weight-proportional squares
    ctx.font = '11px sans-serif';
    const maxSquareSize = 14;
    const minSquareSize = 4;

    outcomes.forEach((outcome, i) => {
        const y = padding.top + i * rowHeight + rowHeight / 2;
        const weight = normalizedWeights[i];

        // Study name (truncate if needed)
        ctx.fillStyle = '#1f2937';
        ctx.textAlign = 'left';
        const displayName = outcome.name.length > 22 ? outcome.name.substring(0, 20) + '...' : outcome.name;
        ctx.fillText(displayName, 10, y + 4);

        // Weight column
        ctx.textAlign = 'center';
        ctx.fillStyle = '#4b5563';
        ctx.fillText(`${weight.toFixed(1)}%`, padding.left + plotWidth + 25, y + 4);

        if (outcome.effect != null && outcome.ci_lower != null && outcome.ci_upper != null) {
            const x = xScale(outcome.effect);
            const xLower = xScale(outcome.ci_lower);
            const xUpper = xScale(outcome.ci_upper);

            // CI line with caps
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(xLower, y);
            ctx.lineTo(xUpper, y);
            ctx.stroke();

            // CI caps
            ctx.beginPath();
            ctx.moveTo(xLower, y - 4);
            ctx.lineTo(xLower, y + 4);
            ctx.moveTo(xUpper, y - 4);
            ctx.lineTo(xUpper, y + 4);
            ctx.stroke();

            // Weight-proportional square
            const squareSize = minSquareSize + (weight / 100) * (maxSquareSize - minSquareSize) * 3;
            const clampedSize = Math.max(minSquareSize, Math.min(maxSquareSize, squareSize));
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(x - clampedSize / 2, y - clampedSize / 2, clampedSize, clampedSize);

            // Effect text with CI
            ctx.fillStyle = '#1f2937';
            ctx.textAlign = 'right';
            ctx.fillText(`${outcome.effect.toFixed(2)} [${outcome.ci_lower.toFixed(2)}, ${outcome.ci_upper.toFixed(2)}]`,
                canvas.width - 10, y + 4);
        }
    });

    // Draw pooled effect (diamond) and heterogeneity stats
    if (metaResult && metaResult.success) {
        const pooledY = padding.top + (outcomes.length + 1) * rowHeight + rowHeight / 2;

        // Separator line
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(5, pooledY - rowHeight + 5);
        ctx.lineTo(canvas.width - 5, pooledY - rowHeight + 5);
        ctx.stroke();

        // Model label
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        const modelType = metaResult.model || 'Random Effects';
        ctx.fillText(`${modelType} Model`, 10, pooledY + 4);
        ctx.font = '11px sans-serif';

        // Weight column for pooled (100%)
        ctx.textAlign = 'center';
        ctx.fillStyle = '#4b5563';
        ctx.fillText('100%', padding.left + plotWidth + 25, pooledY + 4);

        const pooledX = xScale(metaResult.pooledEffect);
        const pooledLower = xScale(metaResult.ci_lower);
        const pooledUpper = xScale(metaResult.ci_upper);

        // Draw diamond for pooled effect
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(pooledLower, pooledY);
        ctx.lineTo(pooledX, pooledY - 10);
        ctx.lineTo(pooledUpper, pooledY);
        ctx.lineTo(pooledX, pooledY + 10);
        ctx.closePath();
        ctx.fill();

        // Pooled effect text
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${metaResult.pooledEffect.toFixed(2)} [${metaResult.ci_lower.toFixed(2)}, ${metaResult.ci_upper.toFixed(2)}]`,
            canvas.width - 10, pooledY + 4);

        // Heterogeneity statistics box
        if (metaResult.heterogeneity) {
            const hetY = pooledY + rowHeight + 15;
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#4b5563';
            ctx.textAlign = 'left';

            const het = metaResult.heterogeneity;
            const I2 = typeof het.I2 === 'number' ? het.I2 : (het.I2 * 100);
            const I2Display = I2 > 1 ? I2 : I2 * 100; // Handle both 0-1 and 0-100 scales

            // Format I² with CI if available
            let i2Text = `I² = ${I2Display.toFixed(1)}%`;
            if (het.I2_ci) {
                i2Text += ` [${het.I2_ci.lower.toFixed(1)}%, ${het.I2_ci.upper.toFixed(1)}%]`;
            }

            // Heterogeneity interpretation
            let hetInterpret = '';
            if (I2Display < 25) hetInterpret = '(low)';
            else if (I2Display < 50) hetInterpret = '(moderate)';
            else if (I2Display < 75) hetInterpret = '(substantial)';
            else hetInterpret = '(considerable)';

            ctx.fillText(`Heterogeneity: ${i2Text} ${hetInterpret}`, 10, hetY);

            // τ² and Q statistic
            let hetLine2 = '';
            if (het.tau2 !== undefined) {
                hetLine2 += `τ² = ${het.tau2.toFixed(4)}`;
            }
            if (het.Q !== undefined && het.Q_pvalue !== undefined) {
                hetLine2 += `; Q = ${het.Q.toFixed(2)}, df = ${outcomes.length - 1}, p ${het.Q_pvalue < 0.001 ? '< 0.001' : '= ' + het.Q_pvalue.toFixed(3)}`;
            }
            if (hetLine2) {
                ctx.fillText(hetLine2, 10, hetY + 14);
            }

            // Prediction interval if available
            if (metaResult.predictionInterval) {
                const pi = metaResult.predictionInterval;
                ctx.fillText(`Prediction interval: [${pi.lower.toFixed(2)}, ${pi.upper.toFixed(2)}]`, 10, hetY + 28);
            }
        }
    }

    // X-axis
    const axisY = padding.top + (outcomes.length + 1) * rowHeight + 10;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, axisY);
    ctx.lineTo(padding.left + plotWidth, axisY);
    ctx.stroke();

    // Tick marks with better spacing
    const tickValues = [0.2, 0.5, 0.7, 1, 1.5, 2, 3, 5];
    ctx.textAlign = 'center';
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#4b5563';
    for (const val of tickValues) {
        if (val >= minVal && val <= maxVal) {
            const x = xScale(val);
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + 5);
            ctx.stroke();
            ctx.fillText(val.toString(), x, axisY + 18);
        }
    }

    // Axis label
    ctx.textAlign = 'center';
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#1f2937';
    const effectType = outcomes[0]?.effect_type || 'Hazard Ratio';
    ctx.fillText(effectType, padding.left + plotWidth / 2, axisY + 35);

    // Favors labels with arrows
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText('← Favors Treatment', padding.left + plotWidth * 0.2, axisY + 50);
    ctx.fillStyle = '#dc2626';
    ctx.fillText('Favors Control →', padding.left + plotWidth * 0.8, axisY + 50);
}

function drawFunnelPlot(outcomes, metaResult = null) {
    const canvas = document.getElementById('funnel-plot');
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = { left: 70, right: 50, top: 50, bottom: 70 };
    const plotWidth = canvas.width - padding.left - padding.right;
    const plotHeight = canvas.height - padding.top - padding.bottom;

    // Calculate SE from CI if available
    const dataPoints = outcomes
        .filter(o => o.effect != null && o.ci_lower != null && o.ci_upper != null)
        .map(o => {
            const logEffect = Math.log(o.effect);
            const se = (Math.log(o.ci_upper) - Math.log(o.ci_lower)) / (2 * 1.96);
            return { logEffect, se, name: o.name, effect: o.effect };
        });

    if (dataPoints.length === 0) {
        ctx.fillStyle = '#4b5563';
        ctx.textAlign = 'center';
        ctx.font = '12px sans-serif';
        ctx.fillText('Insufficient data for funnel plot', canvas.width / 2, canvas.height / 2);
        return;
    }

    const effectRange = dataPoints.map(d => d.logEffect);
    const seRange = dataPoints.map(d => d.se);

    const minEffect = Math.min(...effectRange, -1) - 0.3;
    const maxEffect = Math.max(...effectRange, 1) + 0.3;
    const maxSE = Math.max(...seRange) * 1.3;

    const xScale = (val) => padding.left + ((val - minEffect) / (maxEffect - minEffect)) * plotWidth;
    const yScale = (val) => padding.top + (val / maxSE) * plotHeight;

    // Use pooled effect from meta-analysis if available
    const pooledLogEffect = metaResult?.success
        ? Math.log(metaResult.pooledEffect)
        : effectRange.reduce((a, b) => a + b, 0) / effectRange.length;

    // ==========================================
    // CONTOUR-ENHANCED FUNNEL PLOT
    // Shows regions of statistical significance
    // Reference: Peters JL et al. BMJ 2008;336:369-71
    // ==========================================

    // Significance contours at different alpha levels
    const contours = [
        { alpha: 0.01, z: 2.576, color: 'rgba(220, 38, 38, 0.08)', label: 'p < 0.01' },
        { alpha: 0.05, z: 1.96, color: 'rgba(245, 158, 11, 0.12)', label: 'p < 0.05' },
        { alpha: 0.10, z: 1.645, color: 'rgba(34, 197, 94, 0.12)', label: 'p < 0.10' }
    ];

    // Draw contour regions (from most to least significant)
    // These show where studies would need to fall to achieve significance
    // when testing against the null hypothesis (effect = 0, logEffect = 0)
    contours.forEach((contour, idx) => {
        // Left significance region (effect < 0)
        ctx.fillStyle = contour.color;
        ctx.beginPath();
        ctx.moveTo(xScale(-contour.z * 0.001), padding.top);  // Start near 0 SE
        for (let se = 0.001; se <= maxSE; se += maxSE / 50) {
            const threshold = -contour.z * se;
            ctx.lineTo(xScale(threshold), yScale(se));
        }
        ctx.lineTo(xScale(minEffect), yScale(maxSE));
        ctx.lineTo(xScale(minEffect), padding.top);
        ctx.closePath();
        ctx.fill();

        // Right significance region (effect > 0)
        ctx.beginPath();
        ctx.moveTo(xScale(contour.z * 0.001), padding.top);
        for (let se = 0.001; se <= maxSE; se += maxSE / 50) {
            const threshold = contour.z * se;
            ctx.lineTo(xScale(threshold), yScale(se));
        }
        ctx.lineTo(xScale(maxEffect), yScale(maxSE));
        ctx.lineTo(xScale(maxEffect), padding.top);
        ctx.closePath();
        ctx.fill();
    });

    // Draw contour boundary lines
    ctx.lineWidth = 1;
    contours.forEach((contour, idx) => {
        const colors = ['#dc2626', '#f59e0b', '#22c55e'];
        ctx.strokeStyle = colors[idx];
        ctx.setLineDash([3, 3]);

        // Left boundary
        ctx.beginPath();
        for (let se = 0.001; se <= maxSE; se += maxSE / 50) {
            const threshold = -contour.z * se;
            if (se === 0.001) ctx.moveTo(xScale(threshold), yScale(se));
            else ctx.lineTo(xScale(threshold), yScale(se));
        }
        ctx.stroke();

        // Right boundary
        ctx.beginPath();
        for (let se = 0.001; se <= maxSE; se += maxSE / 50) {
            const threshold = contour.z * se;
            if (se === 0.001) ctx.moveTo(xScale(threshold), yScale(se));
            else ctx.lineTo(xScale(threshold), yScale(se));
        }
        ctx.stroke();
    });
    ctx.setLineDash([]);

    // Draw 95% pseudo-confidence funnel around pooled effect
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.beginPath();
    ctx.moveTo(xScale(pooledLogEffect), padding.top);
    ctx.lineTo(xScale(pooledLogEffect - 1.96 * maxSE), yScale(maxSE));
    ctx.lineTo(xScale(pooledLogEffect + 1.96 * maxSE), yScale(maxSE));
    ctx.closePath();
    ctx.fill();

    // Draw funnel outline
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xScale(pooledLogEffect), padding.top);
    ctx.lineTo(xScale(pooledLogEffect - 1.96 * maxSE), yScale(maxSE));
    ctx.moveTo(xScale(pooledLogEffect), padding.top);
    ctx.lineTo(xScale(pooledLogEffect + 1.96 * maxSE), yScale(maxSE));
    ctx.stroke();

    // Draw vertical line at pooled effect
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(xScale(pooledLogEffect), padding.top);
    ctx.lineTo(xScale(pooledLogEffect), yScale(maxSE));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw null effect line (at log(1) = 0)
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(xScale(0), padding.top);
    ctx.lineTo(xScale(0), yScale(maxSE));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw data points with hover info
    dataPoints.forEach((point, i) => {
        // Determine if point is in significance region
        const zScore = Math.abs(point.logEffect) / point.se;
        let pointColor = '#6b7280';  // Non-significant (gray)
        if (zScore >= 2.576) pointColor = '#dc2626';      // p < 0.01 (red)
        else if (zScore >= 1.96) pointColor = '#f59e0b';  // p < 0.05 (amber)
        else if (zScore >= 1.645) pointColor = '#22c55e'; // p < 0.10 (green)

        ctx.fillStyle = pointColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(xScale(point.logEffect), yScale(point.se), 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1.5;

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, yScale(maxSE));
    ctx.lineTo(canvas.width - padding.right, yScale(maxSE));
    ctx.stroke();

    // Y-axis (inverted - 0 at top, max SE at bottom)
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, yScale(maxSE));
    ctx.stroke();

    // Y-axis ticks and labels
    ctx.fillStyle = '#4b5563';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const seSteps = [0, maxSE * 0.25, maxSE * 0.5, maxSE * 0.75, maxSE];
    seSteps.forEach(se => {
        const y = yScale(se);
        ctx.beginPath();
        ctx.moveTo(padding.left - 5, y);
        ctx.lineTo(padding.left, y);
        ctx.stroke();
        ctx.fillText(se.toFixed(2), padding.left - 8, y + 3);
    });

    // X-axis ticks
    ctx.textAlign = 'center';
    const effectSteps = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5];
    effectSteps.forEach(eff => {
        if (eff >= minEffect && eff <= maxEffect) {
            const x = xScale(eff);
            ctx.beginPath();
            ctx.moveTo(x, yScale(maxSE));
            ctx.lineTo(x, yScale(maxSE) + 5);
            ctx.stroke();
            // Show both log and original scale
            ctx.fillText(eff.toFixed(1), x, yScale(maxSE) + 16);
            ctx.font = '9px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.fillText(`(${Math.exp(eff).toFixed(2)})`, x, yScale(maxSE) + 28);
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#4b5563';
        }
    });

    // Axis labels
    ctx.fillStyle = '#1f2937';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Log Effect Size (original scale in parentheses)', canvas.width / 2, canvas.height - 8);

    ctx.save();
    ctx.translate(15, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Standard Error', 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Contour-Enhanced Funnel Plot', canvas.width / 2, 18);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`n = ${dataPoints.length} studies | Pooled effect = ${metaResult?.pooledEffect?.toFixed(2) || 'N/A'}`, canvas.width / 2, 32);

    // Legend
    const legendX = canvas.width - padding.right - 90;
    const legendY = padding.top + 10;
    ctx.font = '9px sans-serif';

    const legendItems = [
        { color: '#dc2626', label: 'p < 0.01' },
        { color: '#f59e0b', label: 'p < 0.05' },
        { color: '#22c55e', label: 'p < 0.10' },
        { color: '#6b7280', label: 'p ≥ 0.10' }
    ];

    legendItems.forEach((item, i) => {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX, legendY + i * 14, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4b5563';
        ctx.textAlign = 'left';
        ctx.fillText(item.label, legendX + 10, legendY + i * 14 + 3);
    });

    // Egger's test result if available
    if (metaResult?.eggersTest) {
        const egger = metaResult.eggersTest;
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#4b5563';
        ctx.textAlign = 'left';
        const eggerText = `Egger's test: p = ${egger.pValue?.toFixed(3) || 'N/A'}`;
        ctx.fillText(eggerText, padding.left + 5, padding.top + 10);
        if (egger.pValue < 0.10) {
            ctx.fillStyle = '#dc2626';
            ctx.fillText('(asymmetry detected)', padding.left + 5, padding.top + 22);
        }
    }
}

function drawSensitivityPlot(canvas, result) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 40, right: 50, bottom: 40, left: 150 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    let data = [];
    let pooledEffect = null;

    if (result.results) {
        // Leave-one-out
        data = result.results.map(r => ({
            label: r.study || r.omitted,
            effect: r.effect || r.pooled_effect,
            lower: r.ci_lower,
            upper: r.ci_upper
        }));
        pooledEffect = result.pooled?.effect;
    } else if (result.cumulative) {
        // Cumulative
        data = result.cumulative.map(c => ({
            label: c.study || `Study ${c.k}`,
            effect: c.effect,
            lower: c.ci_lower,
            upper: c.ci_upper
        }));
    } else if (result.diagnostics) {
        // Influence diagnostics - show Cook's D or similar
        data = result.diagnostics.map(d => ({
            label: d.study,
            effect: d.cooks_d || d.dfbetas || 0,
            lower: 0,
            upper: d.cooks_d || d.dfbetas || 0
        }));
    }

    if (data.length === 0) return;

    // Calculate scales
    const allEffects = data.flatMap(d => [d.effect, d.lower, d.upper]).filter(e => e != null && isFinite(e));
    const minEffect = Math.min(...allEffects);
    const maxEffect = Math.max(...allEffects);
    const effectRange = maxEffect - minEffect || 1;
    const effectPadding = effectRange * 0.1;

    const xScale = (e) => padding.left + ((e - minEffect + effectPadding) / (effectRange + 2 * effectPadding)) * plotWidth;
    const rowHeight = plotHeight / data.length;

    // Draw null line at 0 or 1 (depending on scale)
    const nullValue = minEffect < 0 && maxEffect > 0 ? 0 : 1;
    if (nullValue >= minEffect - effectPadding && nullValue <= maxEffect + effectPadding) {
        ctx.strokeStyle = '#999';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xScale(nullValue), padding.top);
        ctx.lineTo(xScale(nullValue), padding.top + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw pooled effect line if available
    if (pooledEffect != null) {
        ctx.strokeStyle = '#dc2626';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(xScale(pooledEffect), padding.top);
        ctx.lineTo(xScale(pooledEffect), padding.top + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw each row
    data.forEach((d, i) => {
        const y = padding.top + (i + 0.5) * rowHeight;

        // Draw CI line if we have bounds
        if (d.lower != null && d.upper != null && d.lower !== d.upper) {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xScale(d.lower), y);
            ctx.lineTo(xScale(d.upper), y);
            ctx.stroke();
        }

        // Draw point
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(xScale(d.effect), y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw label
        ctx.fillStyle = '#333';
        ctx.textAlign = 'right';
        ctx.font = '10px sans-serif';
        ctx.fillText(d.label.substring(0, 20), padding.left - 10, y + 4);
    });

    // X-axis
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotHeight);
    ctx.lineTo(width - padding.right, padding.top + plotHeight);
    ctx.stroke();

    // X-axis ticks
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.font = '10px sans-serif';
    const numTicks = 5;
    for (let i = 0; i <= numTicks; i++) {
        const val = minEffect - effectPadding + (i / numTicks) * (effectRange + 2 * effectPadding);
        ctx.fillText(val.toFixed(2), xScale(val), padding.top + plotHeight + 15);
    }

    // Title
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    const title = result.results ? 'Leave-One-Out Analysis' :
                  result.cumulative ? 'Cumulative Meta-Analysis' :
                  'Influence Diagnostics';
    ctx.fillText(title, width / 2, 20);
}

// ============================================
// Export Module
// ============================================

function initializeExport() {
    const exportCards = document.querySelectorAll('.export-card');
    const previewEl = document.getElementById('export-preview');
    const downloadBtn = document.getElementById('download-export-btn');

    exportCards.forEach(card => {
        card.addEventListener('click', () => {
            exportCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const format = card.dataset.format;
            AppState.exportFormat = format;

            if (AppState.extractedData) {
                updateExportPreview(format);
            } else {
                previewEl.textContent = 'No data to export. Extract data first.';
            }
        });
    });

    downloadBtn.addEventListener('click', () => {
        if (!AppState.extractedData) {
            showToast('No data to export', 'error');
            return;
        }

        const filename = `${AppState.extractedData.trial_id || 'extraction'}_${new Date().toISOString().split('T')[0]}`;
        exportAndDownload(AppState.extractedData, AppState.exportFormat, filename);
        showToast('File downloaded', 'success');
    });

    // Select JSON by default
    exportCards[0].click();
}

function updateExportPreview(format) {
    const previewEl = document.getElementById('export-preview');
    let content;

    switch (format) {
        case 'json':
            content = exportToJSON(AppState.extractedData, { pretty: true });
            break;
        case 'csv':
            content = exportToCSV(AppState.extractedData);
            break;
        case 'revman':
            content = exportToRevMan(AppState.extractedData);
            break;
        case 'prisma':
            content = JSON.stringify(exportToPRISMA(AppState.extractedData), null, 2);
            break;
        case 'grade':
            content = generateGRADEPreview();
            break;
        case 'pdf':
            content = 'PDF report will be generated with all analysis results and plots.\nClick Download to generate.';
            break;
        case 'excel':
            content = 'Excel workbook with multiple sheets:\n- Study Data\n- Outcomes\n- Analysis Results\n- Forest Plot Data\nClick Download to generate.';
            break;
        default:
            content = 'Unknown format';
    }

    previewEl.textContent = content.substring(0, 5000) + (content.length > 5000 ? '\n...(truncated)' : '');
}

function generateGRADEPreview() {
    const data = AppState.extractedData;
    const results = AppState.analysisResults;

    let content = '=== GRADE Summary of Findings ===\n\n';

    content += `Population: ${data?.population || 'Not specified'}\n`;
    content += `Intervention: ${data?.intervention || 'Not specified'}\n`;
    content += `Comparison: ${data?.comparator || 'Standard care'}\n\n`;

    content += '--- Outcomes ---\n';

    if (data?.outcomes?.length) {
        data.outcomes.forEach((outcome, i) => {
            content += `\n${i + 1}. ${outcome.name || 'Outcome'}\n`;
            content += `   Effect: ${outcome.effect_type || 'HR'} ${outcome.effect?.toFixed(2) || 'N/A'}`;
            if (outcome.ci_lower && outcome.ci_upper) {
                content += ` (95% CI: ${outcome.ci_lower.toFixed(2)} - ${outcome.ci_upper.toFixed(2)})`;
            }
            content += '\n';
            content += `   Certainty: ${assessGRADECertainty(outcome)}\n`;
        });
    } else {
        content += 'No outcomes extracted yet.\n';
    }

    if (results?.heterogeneity) {
        content += '\n--- Heterogeneity ---\n';
        content += `I²: ${(results.heterogeneity.I2 * 100).toFixed(1)}%\n`;
        content += `τ²: ${results.heterogeneity.tau2?.toFixed(4) || 'N/A'}\n`;
    }

    content += '\n--- GRADE Certainty Legend ---\n';
    content += '⊕⊕⊕⊕ High\n';
    content += '⊕⊕⊕◯ Moderate\n';
    content += '⊕⊕◯◯ Low\n';
    content += '⊕◯◯◯ Very Low\n';

    return content;
}

function assessGRADECertainty(outcome) {
    // Simple GRADE assessment based on available data
    let rating = 4; // Start at high for RCTs
    const reasons = [];

    // Check for wide confidence interval (imprecision)
    if (outcome.ci_lower && outcome.ci_upper) {
        const ciWidth = Math.abs(outcome.ci_upper - outcome.ci_lower);
        if (ciWidth > 1.0) {
            rating--;
            reasons.push('imprecision');
        }
    }

    // Check for potential bias indicators
    if (outcome.p_value && outcome.p_value > 0.05) {
        rating--;
        reasons.push('borderline significance');
    }

    rating = Math.max(1, Math.min(4, rating));

    const levels = ['⊕◯◯◯ Very Low', '⊕⊕◯◯ Low', '⊕⊕⊕◯ Moderate', '⊕⊕⊕⊕ High'];
    let result = levels[rating - 1];

    if (reasons.length > 0) {
        result += ` (downgraded for: ${reasons.join(', ')})`;
    }

    return result;
}

// ============================================
// UI Utilities
// ============================================

function updateStatus(message) {
    document.getElementById('status-message').textContent = message;
}

function showProgress(show, progress = 0) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.display = show ? 'block' : 'none';

    if (show && progress > 0) {
        progressBar.querySelector('.progress-fill').style.width = `${progress}%`;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showModal(title, content) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;

    modal.classList.add('show');

    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    const confirmBtn = modal.querySelector('.modal-confirm');

    const closeModal = () => modal.classList.remove('show');

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = closeModal;

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

// Export for global access
window.AppState = AppState;
window.showToast = showToast;

// Export extraction functions for advanced usage
window.runExtractionPipeline = runExtractionPipeline;
window.runFullExtraction = runFullExtraction;
window.runExtractionWithRegistry = runExtractionWithRegistry;

// Export KM digitizer
window.KMDigitizer = KMDigitizer;
window.digitizeKMCurve = digitizeKMCurve;

// Export supplement handler
window.processSupplement = processSupplement;
window.detectSupplement = detectSupplement;

// Export data reconciler
window.reconcileData = reconcileData;
window.mergeRegistryWithPDF = mergeRegistryWithPDF;

// Export meta-analysis functions
window.randomEffectsML = randomEffectsML;
window.fixedEffectsIV = fixedEffectsIV;
window.eggersTest = eggersTest;
window.trimAndFill = trimAndFill;

// Export for module usage
export {
    AppState,
    runExtractionPipeline,
    runFullExtraction,
    runExtractionWithRegistry,
    KMDigitizer,
    digitizeKMCurve,
    processSupplement,
    detectSupplement,
    reconcileData,
    mergeRegistryWithPDF,
    randomEffectsML,
    fixedEffectsIV,
    eggersTest,
    trimAndFill
};
