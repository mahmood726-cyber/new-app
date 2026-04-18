/**
 * Supplement Handler Module
 * Handles detection and extraction from supplementary materials and appendices
 *
 * @module supplement-handler
 */

import { extractPDF } from './pdf-processor.js';
import { parseTable, findOutcomesTable, findBaselineTable } from './table-parser.js';
import { extractEffect } from './effect-extractor.js';
import { extractSubgroups } from './subgroup-extractor.js';

/**
 * Supplement content types
 */
export const SUPPLEMENT_TYPES = {
    SUBGROUP_FOREST: 'subgroup_forest_plot',
    SENSITIVITY_ANALYSIS: 'sensitivity_analysis',
    EXTENDED_TABLES: 'extended_tables',
    ADDITIONAL_OUTCOMES: 'additional_outcomes',
    PROTOCOL: 'protocol',
    SAP: 'statistical_analysis_plan',
    CONSORT_FLOW: 'consort_flow',
    BASELINE_EXTENDED: 'baseline_extended',
    ADVERSE_EVENTS: 'adverse_events',
    KM_CURVES: 'kaplan_meier_curves',
    NUMBERS_AT_RISK: 'numbers_at_risk',
    IPD_DATA: 'individual_patient_data'
};

/**
 * Patterns for identifying supplement content
 */
const SUPPLEMENT_PATTERNS = {
    subgroupTable: [
        /table\s*s?\d*\.?\s*subgroup/i,
        /supplementary\s+table\s*\d*\.?\s*subgroup/i,
        /forest\s+plot/i,
        /subgroup\s+analyses?/i
    ],
    sensitivityTable: [
        /sensitivity\s+analys[ei]s/i,
        /table\s*s?\d*\.?\s*sensitivity/i,
        /per[\-\s]protocol\s+analysis/i,
        /as[\-\s]treated\s+analysis/i
    ],
    additionalOutcomes: [
        /secondary\s+outcomes?/i,
        /exploratory\s+outcomes?/i,
        /additional\s+endpoints?/i,
        /table\s*s?\d*\.?\s*secondary/i
    ],
    baselineExtended: [
        /table\s*s?\d*\.?\s*baseline/i,
        /supplementary\s+baseline/i,
        /extended\s+baseline/i,
        /additional\s+baseline/i
    ],
    adverseEvents: [
        /adverse\s+events?/i,
        /safety\s+outcomes?/i,
        /serious\s+adverse/i,
        /table\s*s?\d*\.?\s*adverse/i,
        /table\s*s?\d*\.?\s*safety/i
    ],
    kmCurves: [
        /kaplan[\-\s]meier/i,
        /survival\s+curve/i,
        /figure\s*s?\d*\.?\s*survival/i,
        /time[\-\s]to[\-\s]event/i
    ],
    numbersAtRisk: [
        /number[s]?\s+at\s+risk/i,
        /patients?\s+at\s+risk/i,
        /n\s+at\s+risk/i
    ],
    protocol: [
        /study\s+protocol/i,
        /trial\s+protocol/i,
        /protocol\s+amendment/i
    ],
    sap: [
        /statistical\s+analysis\s+plan/i,
        /analysis\s+plan/i,
        /SAP\b/
    ]
};

/**
 * Main supplement handler class
 */
export class SupplementHandler {
    constructor(options = {}) {
        this.options = {
            extractTables: options.extractTables ?? true,
            extractFigures: options.extractFigures ?? true,
            detectContentType: options.detectContentType ?? true,
            ...options
        };
        this.supplements = [];
        this.extractedData = {};
    }

    /**
     * Process a supplement PDF
     * @param {File|ArrayBuffer} source - PDF source
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed supplement data
     */
    async processSupplement(source, options = {}) {
        const config = { ...this.options, ...options };
        const result = {
            success: false,
            contentTypes: [],
            tables: [],
            figures: [],
            extractedData: {},
            warnings: []
        };

        try {
            // Extract PDF content
            const pdfResult = await extractPDF(source, {
                extractTables: true,
                extractFigures: true
            });

            if (!pdfResult.success) {
                throw new Error(`PDF extraction failed: ${pdfResult.error}`);
            }

            const content = pdfResult.content;

            // Detect content types
            if (config.detectContentType) {
                result.contentTypes = this.detectContentTypes(content.fullText, content.tables);
            }

            // Process tables
            if (config.extractTables && content.tables?.length > 0) {
                result.tables = await this.processTables(content.tables, result.contentTypes);
            }

            // Process figures (placeholder for future OCR/image processing)
            if (config.extractFigures && content.figures?.length > 0) {
                result.figures = this.processFigures(content.figures, result.contentTypes);
            }

            // Extract data based on content types
            result.extractedData = await this.extractByContentType(content, result.contentTypes);

            result.success = true;

        } catch (error) {
            result.success = false;
            result.error = error.message;
        }

        return result;
    }

    /**
     * Detect what types of content are in the supplement
     */
    detectContentTypes(text, tables) {
        const types = new Set();

        // Check text patterns
        for (const [type, patterns] of Object.entries(SUPPLEMENT_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    types.add(type);
                    break;
                }
            }
        }

        // Check table headers
        for (const table of tables || []) {
            const headerText = this.getTableHeaderText(table);

            if (/subgroup/i.test(headerText)) types.add('subgroupTable');
            if (/sensitivity/i.test(headerText)) types.add('sensitivityTable');
            if (/baseline/i.test(headerText)) types.add('baselineExtended');
            if (/adverse|safety/i.test(headerText)) types.add('adverseEvents');
            if (/secondary|exploratory/i.test(headerText)) types.add('additionalOutcomes');
        }

        return Array.from(types);
    }

    /**
     * Get text from table headers
     */
    getTableHeaderText(table) {
        if (typeof table === 'string') return table.slice(0, 200);
        if (table.caption) return table.caption;
        if (table.headers) return table.headers.join(' ');
        if (table.rows?.[0]) return table.rows[0].join(' ');
        return '';
    }

    /**
     * Process tables based on detected content types
     */
    async processTables(tables, contentTypes) {
        const processed = [];

        for (const table of tables) {
            const parsed = parseTable(table);
            const tableType = this.classifyTable(parsed, contentTypes);

            processed.push({
                type: tableType,
                parsed,
                extraction: await this.extractFromTable(parsed, tableType)
            });
        }

        return processed;
    }

    /**
     * Classify a table based on its content
     */
    classifyTable(parsedTable, contentTypes) {
        const headerText = (parsedTable.headers || []).join(' ').toLowerCase();
        const allText = JSON.stringify(parsedTable).toLowerCase();

        // Check specific patterns
        if (/subgroup|forest/i.test(headerText)) return SUPPLEMENT_TYPES.SUBGROUP_FOREST;
        if (/sensitivity|per[\-\s]protocol/i.test(headerText)) return SUPPLEMENT_TYPES.SENSITIVITY_ANALYSIS;
        if (/adverse|safety|side effect/i.test(headerText)) return SUPPLEMENT_TYPES.ADVERSE_EVENTS;
        if (/baseline|demographic/i.test(headerText)) return SUPPLEMENT_TYPES.BASELINE_EXTENDED;
        if (/secondary|exploratory/i.test(headerText)) return SUPPLEMENT_TYPES.ADDITIONAL_OUTCOMES;

        // Check data patterns
        if (/hr|hazard ratio|risk ratio|odds ratio/i.test(allText) &&
            /\d+\.\d+\s*[\(\[]\d+\.\d+/i.test(allText)) {
            return SUPPLEMENT_TYPES.ADDITIONAL_OUTCOMES;
        }

        return 'unknown';
    }

    /**
     * Extract data from a specific table type
     */
    async extractFromTable(parsedTable, tableType) {
        switch (tableType) {
            case SUPPLEMENT_TYPES.SUBGROUP_FOREST:
                return this.extractSubgroupTable(parsedTable);

            case SUPPLEMENT_TYPES.SENSITIVITY_ANALYSIS:
                return this.extractSensitivityTable(parsedTable);

            case SUPPLEMENT_TYPES.ADVERSE_EVENTS:
                return this.extractAdverseEventsTable(parsedTable);

            case SUPPLEMENT_TYPES.BASELINE_EXTENDED:
                return this.extractBaselineTable(parsedTable);

            case SUPPLEMENT_TYPES.ADDITIONAL_OUTCOMES:
                return this.extractOutcomesTable(parsedTable);

            default:
                return { type: 'unknown', rawData: parsedTable };
        }
    }

    /**
     * Extract subgroup analysis data
     */
    extractSubgroupTable(parsedTable) {
        const subgroups = [];
        const data = parsedTable.data || [];

        let currentVariable = null;

        for (const row of data) {
            const rowText = row.map(c => c.raw || c).join(' ');

            // Detect if this is a variable header row
            const isHeader = /^(age|sex|gender|diabetes|lvef|egfr|region|race|bmi|nyha)/i.test(rowText);

            if (isHeader) {
                if (currentVariable && currentVariable.categories.length > 0) {
                    subgroups.push(currentVariable);
                }
                currentVariable = {
                    variable: this.normalizeVariableName(row[0]?.raw || row[0]),
                    categories: [],
                    interactionP: null
                };
            } else if (currentVariable) {
                // Extract category data
                const effect = extractEffect(rowText);

                if (effect.success) {
                    currentVariable.categories.push({
                        label: row[0]?.raw || row[0],
                        effect: effect.value,
                        ci_lower: effect.ci_lower,
                        ci_upper: effect.ci_upper,
                        effect_type: effect.effect_type
                    });
                }

                // Check for interaction p-value
                const interactionMatch = rowText.match(/p\s*(?:for\s+)?interaction[:\s]*([<>=]?\s*\d*\.?\d+)/i);
                if (interactionMatch) {
                    currentVariable.interactionP = parseFloat(interactionMatch[1].replace(/[<>=\s]/g, ''));
                }
            }
        }

        if (currentVariable && currentVariable.categories.length > 0) {
            subgroups.push(currentVariable);
        }

        return {
            type: 'subgroup_analysis',
            subgroups
        };
    }

    /**
     * Extract sensitivity analysis data
     */
    extractSensitivityTable(parsedTable) {
        const analyses = [];
        const data = parsedTable.data || [];

        for (const row of data) {
            const rowText = row.map(c => c.raw || c).join(' ');
            const effect = extractEffect(rowText);

            if (effect.success) {
                analyses.push({
                    analysis: row[0]?.raw || row[0],
                    effect: effect.value,
                    ci_lower: effect.ci_lower,
                    ci_upper: effect.ci_upper,
                    effect_type: effect.effect_type,
                    p_value: effect.p_value
                });
            }
        }

        return {
            type: 'sensitivity_analysis',
            analyses
        };
    }

    /**
     * Extract adverse events data
     */
    extractAdverseEventsTable(parsedTable) {
        const events = [];
        const data = parsedTable.data || [];
        const headers = parsedTable.headers || [];

        // Find treatment and control columns
        const treatmentCol = headers.findIndex(h =>
            /treatment|intervention|active|drug/i.test(h)
        );
        const controlCol = headers.findIndex(h =>
            /control|placebo|comparator/i.test(h)
        );

        for (const row of data) {
            if (!row[0]) continue;

            const eventName = row[0]?.raw || row[0];
            const event = {
                name: eventName,
                treatment: null,
                control: null
            };

            // Extract counts/percentages
            if (treatmentCol >= 0 && row[treatmentCol]) {
                event.treatment = this.parseEventCount(row[treatmentCol]?.raw || row[treatmentCol]);
            }
            if (controlCol >= 0 && row[controlCol]) {
                event.control = this.parseEventCount(row[controlCol]?.raw || row[controlCol]);
            }

            if (event.treatment || event.control) {
                events.push(event);
            }
        }

        return {
            type: 'adverse_events',
            events
        };
    }

    /**
     * Parse event count string
     */
    parseEventCount(text) {
        if (!text) return null;

        const str = String(text);

        // Pattern: "123 (45.6%)" or "123/456 (45.6%)"
        const match = str.match(/(\d+)(?:\s*\/\s*(\d+))?\s*(?:\((\d+\.?\d*)%?\))?/);

        if (match) {
            return {
                n: parseInt(match[1]),
                total: match[2] ? parseInt(match[2]) : null,
                percentage: match[3] ? parseFloat(match[3]) : null
            };
        }

        return null;
    }

    /**
     * Extract extended baseline data
     */
    extractBaselineTable(parsedTable) {
        // Use existing baseline extractor
        const { extractBaseline } = require('./baseline-extractor.js');
        return extractBaseline(parsedTable);
    }

    /**
     * Extract outcomes data
     */
    extractOutcomesTable(parsedTable) {
        const outcomes = [];
        const data = parsedTable.data || [];

        for (const row of data) {
            const rowText = row.map(c => c.raw || c).join(' ');
            const effect = extractEffect(rowText);

            if (effect.success) {
                outcomes.push({
                    name: row[0]?.raw || row[0],
                    effect: effect.value,
                    ci_lower: effect.ci_lower,
                    ci_upper: effect.ci_upper,
                    effect_type: effect.effect_type,
                    p_value: effect.p_value,
                    source: 'supplement'
                });
            }
        }

        return {
            type: 'additional_outcomes',
            outcomes
        };
    }

    /**
     * Process figures
     */
    processFigures(figures, contentTypes) {
        return figures.map((fig, idx) => ({
            index: idx,
            type: this.classifyFigure(fig, contentTypes),
            needsDigitization: this.needsDigitization(fig),
            metadata: fig.metadata || {}
        }));
    }

    /**
     * Classify a figure
     */
    classifyFigure(figure, contentTypes) {
        const caption = figure.caption || '';

        if (/kaplan[\-\s]meier|survival/i.test(caption)) return SUPPLEMENT_TYPES.KM_CURVES;
        if (/forest\s+plot|subgroup/i.test(caption)) return SUPPLEMENT_TYPES.SUBGROUP_FOREST;
        if (/consort|flow/i.test(caption)) return SUPPLEMENT_TYPES.CONSORT_FLOW;

        return 'unknown';
    }

    /**
     * Check if figure needs digitization
     */
    needsDigitization(figure) {
        const caption = figure.caption || '';
        return /kaplan[\-\s]meier|survival|forest\s+plot/i.test(caption);
    }

    /**
     * Extract data based on detected content types
     */
    async extractByContentType(content, contentTypes) {
        const extracted = {};

        if (contentTypes.includes('subgroupTable')) {
            const subgroupResult = extractSubgroups(content.fullText);
            extracted.subgroups = subgroupResult.subgroups;
        }

        if (contentTypes.includes('additionalOutcomes')) {
            extracted.additionalOutcomes = this.extractAdditionalOutcomes(content.fullText);
        }

        if (contentTypes.includes('adverseEvents')) {
            extracted.adverseEvents = this.extractAdverseEventsFromText(content.fullText);
        }

        if (contentTypes.includes('numbersAtRisk')) {
            extracted.numbersAtRisk = this.extractNumbersAtRisk(content.fullText);
        }

        return extracted;
    }

    /**
     * Extract additional outcomes from prose
     */
    extractAdditionalOutcomes(text) {
        const outcomes = [];

        // Pattern for outcome statements
        const patterns = [
            /(\w+(?:\s+\w+){0,4})\s+(?:occurred\s+in|was\s+observed\s+in)[^.]*(?:HR|RR|OR)\s*[=:]?\s*(\d+\.?\d*)\s*[\(\[]\s*(?:95%\s*CI[,:]?\s*)?(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)/gi,
            /(?:secondary|exploratory)\s+(?:outcome|endpoint)[:\s]+([^,]+),?\s+(?:HR|RR|OR)\s*[=:]?\s*(\d+\.?\d*)\s*[\(\[]\s*(?:95%\s*CI[,:]?\s*)?(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)/gi
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                outcomes.push({
                    name: match[1].trim(),
                    effect: parseFloat(match[2]),
                    ci_lower: parseFloat(match[3]),
                    ci_upper: parseFloat(match[4]),
                    source: 'supplement_prose'
                });
            }
        }

        return outcomes;
    }

    /**
     * Extract adverse events from prose
     */
    extractAdverseEventsFromText(text) {
        const events = [];

        // Pattern: "adverse event occurred in X (Y%) vs Z (W%)"
        const pattern = /(\w+(?:\s+\w+){0,4})\s+(?:occurred|reported|observed)\s+in\s+(\d+)\s*[\(\[]?\s*(\d+\.?\d*)%?\s*[\)\]]?\s*(?:vs\.?|versus|compared\s+(?:to|with))\s*(\d+)\s*[\(\[]?\s*(\d+\.?\d*)%?\s*[\)\]]?/gi;

        let match;
        while ((match = pattern.exec(text)) !== null) {
            events.push({
                name: match[1].trim(),
                treatment: {
                    n: parseInt(match[2]),
                    percentage: parseFloat(match[3])
                },
                control: {
                    n: parseInt(match[4]),
                    percentage: parseFloat(match[5])
                }
            });
        }

        return events;
    }

    /**
     * Extract numbers at risk table
     */
    extractNumbersAtRisk(text) {
        const narData = {
            detected: false,
            curves: []
        };

        // Look for NAR patterns
        const narPattern = /(?:number[s]?\s+at\s+risk|n\s+at\s+risk)[:\s]*([\d\s,]+)/gi;
        const matches = text.match(narPattern);

        if (matches) {
            narData.detected = true;

            for (const match of matches) {
                const numbers = match.match(/\d+/g);
                if (numbers) {
                    narData.curves.push(numbers.map(n => parseInt(n)));
                }
            }
        }

        return narData;
    }

    /**
     * Normalize variable name
     */
    normalizeVariableName(name) {
        const normalized = String(name).toLowerCase().trim();

        const mappings = {
            'age': 'age',
            'sex': 'sex',
            'gender': 'sex',
            'male': 'sex',
            'female': 'sex',
            'diabetes': 'diabetes',
            'diabetic': 'diabetes',
            'dm': 'diabetes',
            'lvef': 'lvef',
            'ejection fraction': 'lvef',
            'ef': 'lvef',
            'egfr': 'egfr',
            'gfr': 'egfr',
            'renal': 'egfr',
            'region': 'region',
            'geographic': 'region',
            'country': 'region',
            'race': 'race',
            'ethnicity': 'race',
            'bmi': 'bmi',
            'body mass': 'bmi',
            'nyha': 'nyha',
            'functional class': 'nyha'
        };

        for (const [key, value] of Object.entries(mappings)) {
            if (normalized.includes(key)) return value;
        }

        return normalized;
    }

    /**
     * Merge supplement data with main extraction
     */
    mergeWithMainExtraction(mainData, supplementData) {
        const merged = { ...mainData };

        // Merge subgroups
        if (supplementData.extractedData?.subgroups?.length > 0) {
            merged.subgroups = merged.subgroups || [];
            for (const sg of supplementData.extractedData.subgroups) {
                const exists = merged.subgroups.find(s => s.variable === sg.variable);
                if (!exists) {
                    merged.subgroups.push({ ...sg, source: 'supplement' });
                }
            }
        }

        // Merge additional outcomes
        if (supplementData.extractedData?.additionalOutcomes?.length > 0) {
            merged.outcomes = merged.outcomes || [];
            for (const outcome of supplementData.extractedData.additionalOutcomes) {
                const exists = merged.outcomes.find(o =>
                    o.name?.toLowerCase() === outcome.name?.toLowerCase()
                );
                if (!exists) {
                    merged.outcomes.push({ ...outcome, source: 'supplement' });
                }
            }
        }

        // Add adverse events
        if (supplementData.extractedData?.adverseEvents?.length > 0) {
            merged.adverseEvents = supplementData.extractedData.adverseEvents;
        }

        // Add sensitivity analyses from tables
        const sensitivityTables = supplementData.tables?.filter(t =>
            t.type === SUPPLEMENT_TYPES.SENSITIVITY_ANALYSIS
        );
        if (sensitivityTables?.length > 0) {
            merged.sensitivityAnalyses = sensitivityTables.flatMap(t =>
                t.extraction?.analyses || []
            );
        }

        // Flag as having supplement data
        merged.extraction_metadata = merged.extraction_metadata || {};
        merged.extraction_metadata.hasSupplementData = true;
        merged.extraction_metadata.supplementContentTypes = supplementData.contentTypes;

        return merged;
    }
}

/**
 * Process supplement file
 * @param {File|ArrayBuffer} source - Supplement PDF
 * @param {Object} options - Options
 * @returns {Promise<Object>} Processed data
 */
export async function processSupplement(source, options = {}) {
    const handler = new SupplementHandler(options);
    return handler.processSupplement(source, options);
}

/**
 * Detect if a PDF is a supplement
 * @param {Object} pdfContent - Extracted PDF content
 * @returns {Object} Detection result
 */
export function detectSupplement(pdfContent) {
    const text = pdfContent.fullText || '';

    const indicators = {
        isSupplementary: false,
        confidence: 0,
        reasons: []
    };

    // Check for explicit supplement indicators
    const supplementPatterns = [
        /supplementary\s+(?:material|appendix|data|information|table|figure)/i,
        /online\s+supplement/i,
        /appendix\s+[a-z0-9]/i,
        /table\s+s\d/i,
        /figure\s+s\d/i,
        /extended\s+data/i
    ];

    for (const pattern of supplementPatterns) {
        if (pattern.test(text)) {
            indicators.isSupplementary = true;
            indicators.confidence += 0.2;
            indicators.reasons.push(`Matched pattern: ${pattern.source}`);
        }
    }

    // Check for lack of standard paper structure
    const hasAbstract = /\babstract\b/i.test(text);
    const hasMethods = /\bmethods?\b.*\bresults?\b/i.test(text);
    const hasDiscussion = /\bdiscussion\b/i.test(text);

    if (!hasAbstract && !hasDiscussion) {
        indicators.confidence += 0.2;
        indicators.reasons.push('Missing standard paper sections');
    }

    indicators.confidence = Math.min(indicators.confidence, 1);

    return indicators;
}

export default {
    SupplementHandler,
    processSupplement,
    detectSupplement,
    SUPPLEMENT_TYPES
};
