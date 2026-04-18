/**
 * Extraction Module Index
 * Main pipeline orchestrator for RCT data extraction
 *
 * @module extraction
 */

// Re-export all modules
export * from './pdf-processor.js';
export * from './table-parser.js';
export * from './outcome-mapper.js';
export * from './effect-extractor.js';
export * from './prose-extractor.js';
export * from './subgroup-extractor.js';
export * from './baseline-extractor.js';
export * from './event-extractor.js';
export * from './validator.js';
export * from './confidence-scorer.js';
export * from './output-schema.js';
export * from './exporters.js';
export * from './km-digitizer.js';
export * from './supplement-handler.js';
export * from './data-reconciler.js';

// Import for pipeline
import { extractPDF } from './pdf-processor.js';
import { parseTable, findBaselineTable, findOutcomesTable } from './table-parser.js';
import { mapOutcome } from './outcome-mapper.js';
import { extractEffect } from './effect-extractor.js';
import { extractFromProse, findResultsSection } from './prose-extractor.js';
import { extractSubgroups } from './subgroup-extractor.js';
import { extractBaseline } from './baseline-extractor.js';
import { extractEventCounts } from './event-extractor.js';
import { validateExtraction } from './validator.js';
import { calculateConfidence } from './confidence-scorer.js';
import { normalizeData } from './output-schema.js';
import { KMDigitizer, digitizeKMCurve } from './km-digitizer.js';
import { SupplementHandler, processSupplement, detectSupplement } from './supplement-handler.js';
import { DataReconciler, reconcileData, mergeRegistryWithPDF } from './data-reconciler.js';

/**
 * Run complete extraction pipeline on a PDF
 * @param {File|ArrayBuffer} source - PDF source
 * @param {Object} options - Pipeline options
 * @returns {Promise<Object>} Complete extracted data
 */
export async function runExtractionPipeline(source, options = {}) {
    const startTime = performance.now();

    const config = {
        extractTables: options.extractTables ?? true,
        extractProse: options.extractProse ?? true,
        extractBaseline: options.extractBaseline ?? true,
        extractSubgroups: options.extractSubgroups ?? true,
        validate: options.validate ?? true,
        normalize: options.normalize ?? true,
        ...options
    };

    const result = {
        success: false,
        data: null,
        errors: [],
        warnings: [],
        timing: {}
    };

    try {
        // Step 1: Extract PDF
        const pdfStart = performance.now();
        const pdfResult = await extractPDF(source);
        result.timing.pdf_extraction = Math.round(performance.now() - pdfStart);

        if (!pdfResult.success) {
            throw new Error(`PDF extraction failed: ${pdfResult.error}`);
        }

        const content = pdfResult.content;
        const data = {
            extraction_metadata: {
                engine_version: '2.0.0',
                source_type: 'pdf',
                pages_processed: pdfResult.metadata.pagesProcessed
            }
        };

        // Step 2: Table extraction
        if (config.extractTables) {
            const tableStart = performance.now();

            // Parse all tables
            const tables = content.tables.map(t => parseTable(t));

            // Find and process specific tables
            const outcomesTable = findOutcomesTable(content.tables);
            const baselineTable = findBaselineTable(content.tables);

            data.raw_tables = tables;
            data.outcomes = [];

            // Extract outcomes from outcomes table
            if (outcomesTable) {
                const parsed = parseTable(outcomesTable);
                for (const row of parsed.data || []) {
                    if (row[0]) {
                        const outcomeName = row[0].raw || row[0];
                        const rowText = row.map(c => c.raw || c).join(' ');
                        const effect = extractEffect(rowText);
                        const mapped = mapOutcome(outcomeName);

                        if (effect.success) {
                            data.outcomes.push({
                                name: outcomeName,
                                mapped: mapped.mapped,
                                category: mapped.category,
                                ...effect,
                                source: 'table'
                            });
                        }
                    }
                }
            }

            result.timing.table_extraction = Math.round(performance.now() - tableStart);
        }

        // Step 3: Prose extraction
        if (config.extractProse) {
            const proseStart = performance.now();

            const resultsSection = findResultsSection(content.fullText);
            if (resultsSection) {
                const proseResult = extractFromProse(resultsSection);

                // Add prose outcomes (avoiding duplicates)
                for (const outcome of proseResult.outcomes) {
                    const exists = data.outcomes?.find(o =>
                        o.mapped === outcome.outcome?.mapped ||
                        o.name === outcome.outcome?.raw
                    );

                    if (!exists && outcome.effect) {
                        data.outcomes = data.outcomes || [];
                        data.outcomes.push({
                            name: outcome.outcome?.raw || 'Unknown',
                            mapped: outcome.outcome?.mapped,
                            category: outcome.outcome?.category,
                            effect: outcome.effect.value,
                            ci_lower: outcome.effect.ci_lower,
                            ci_upper: outcome.effect.ci_upper,
                            effect_type: outcome.effect.type,
                            p_value: outcome.effect.p_value,
                            source: 'prose',
                            confidence: outcome.confidence
                        });
                    }
                }

                // Add follow-up and sample size
                if (proseResult.followUp) {
                    data.followup = proseResult.followUp;
                }
                if (proseResult.sampleSize) {
                    data.population = { n_randomized: proseResult.sampleSize.total };
                }
            }

            result.timing.prose_extraction = Math.round(performance.now() - proseStart);
        }

        // Step 4: Baseline extraction
        if (config.extractBaseline) {
            const baselineStart = performance.now();

            const baselineTable = findBaselineTable(content.tables);
            if (baselineTable) {
                data.baseline = extractBaseline(baselineTable);
            }

            result.timing.baseline_extraction = Math.round(performance.now() - baselineStart);
        }

        // Step 5: Subgroup extraction
        if (config.extractSubgroups) {
            const subgroupStart = performance.now();

            const subgroupResult = extractSubgroups(content.fullText);
            data.subgroups = subgroupResult.subgroups;

            result.timing.subgroup_extraction = Math.round(performance.now() - subgroupStart);
        }

        // Step 6: Validation
        if (config.validate) {
            const validationStart = performance.now();

            const validation = validateExtraction(data);
            data.validation = validation;

            result.warnings = validation.warnings;
            if (validation.errors.length > 0) {
                result.errors = validation.errors;
            }

            result.timing.validation = Math.round(performance.now() - validationStart);
        }

        // Step 7: Confidence scoring
        const confidenceStart = performance.now();
        const confidence = calculateConfidence(data);
        data.confidence = confidence;
        data.extraction_metadata.overall_confidence = confidence.overall;
        result.timing.confidence_scoring = Math.round(performance.now() - confidenceStart);

        // Step 8: Normalize output
        if (config.normalize) {
            result.data = normalizeData(data);
        } else {
            result.data = data;
        }

        // Add timing metadata
        result.data.extraction_metadata.processing_time_ms = Math.round(performance.now() - startTime);
        result.data.extraction_metadata.timestamp = new Date().toISOString();

        result.timing.total = Math.round(performance.now() - startTime);
        result.success = true;

    } catch (error) {
        result.success = false;
        result.errors.push(error.message);
        result.data = null;
    }

    return result;
}

/**
 * Quick extraction for a single outcome
 * @param {string} text - Text containing outcome data
 * @returns {Object} Extracted outcome
 */
export function quickExtract(text) {
    const effect = extractEffect(text);

    if (!effect.success) {
        return { success: false, error: 'No effect estimate found' };
    }

    // Try to identify outcome name from text
    const outcomePatterns = [
        /(?:primary|secondary)\s+(?:outcome|endpoint)\s*[:\-]?\s*([^,\.]+)/i,
        /(?:the\s+)?(\w+(?:\s+\w+){0,3})\s+(?:was|occurred)/i
    ];

    let outcomeName = 'Unknown outcome';
    for (const pattern of outcomePatterns) {
        const match = text.match(pattern);
        if (match) {
            outcomeName = match[1].trim();
            break;
        }
    }

    const mapped = mapOutcome(outcomeName);

    return {
        success: true,
        outcome: {
            name: outcomeName,
            mapped: mapped.mapped,
            category: mapped.category,
            effect: effect.value,
            ci_lower: effect.ci_lower,
            ci_upper: effect.ci_upper,
            effect_type: effect.effect_type,
            p_value: effect.p_value,
            confidence: effect.confidence
        }
    };
}

/**
 * Run complete extraction with supplement support
 * @param {File|ArrayBuffer} mainSource - Main PDF
 * @param {File|ArrayBuffer} supplementSource - Supplement PDF (optional)
 * @param {Object} options - Options
 * @returns {Promise<Object>} Complete extracted data
 */
export async function runFullExtraction(mainSource, supplementSource = null, options = {}) {
    // Extract main PDF
    const mainResult = await runExtractionPipeline(mainSource, options);

    if (!mainResult.success) {
        return mainResult;
    }

    // Process supplement if provided
    if (supplementSource) {
        const supplementHandler = new SupplementHandler(options);
        const supplementResult = await supplementHandler.processSupplement(supplementSource);

        if (supplementResult.success) {
            // Merge supplement data
            mainResult.data = supplementHandler.mergeWithMainExtraction(
                mainResult.data,
                supplementResult
            );
            mainResult.supplementProcessed = true;
        }
    }

    return mainResult;
}

/**
 * Run extraction with registry data reconciliation
 * @param {File|ArrayBuffer} source - PDF source
 * @param {Object} registryData - Data from ClinicalTrials.gov
 * @param {Object} options - Options
 * @returns {Promise<Object>} Reconciled data
 */
export async function runExtractionWithRegistry(source, registryData, options = {}) {
    const pdfResult = await runExtractionPipeline(source, options);

    if (!pdfResult.success) {
        return pdfResult;
    }

    // Reconcile with registry data
    const reconciled = mergeRegistryWithPDF(registryData, pdfResult.data);

    return {
        ...pdfResult,
        data: reconciled.data,
        reconciliation: {
            conflicts: reconciled.conflicts,
            confidence: reconciled.confidence,
            sourceContributions: reconciled.sourceContributions
        }
    };
}

export default {
    runExtractionPipeline,
    runFullExtraction,
    runExtractionWithRegistry,
    quickExtract,
    // Digitization
    KMDigitizer,
    digitizeKMCurve,
    // Supplement handling
    SupplementHandler,
    processSupplement,
    detectSupplement,
    // Data reconciliation
    DataReconciler,
    reconcileData,
    mergeRegistryWithPDF
};
