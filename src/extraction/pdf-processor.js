/**
 * PDF Processor Module
 * Optimized PDF text extraction using pdf.js
 *
 * @module pdf-processor
 */

// Configure pdf.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Extract text and structure from PDF file
 * @param {ArrayBuffer|File} source - PDF file or ArrayBuffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted content with structure
 */
export async function extractPDF(source, options = {}) {
    const startTime = performance.now();

    const config = {
        preserveLayout: options.preserveLayout ?? true,
        detectColumns: options.detectColumns ?? true,
        extractImages: options.extractImages ?? false,
        maxPages: options.maxPages ?? null,
        ...options
    };

    try {
        // Load PDF document
        let arrayBuffer;
        if (source instanceof File) {
            arrayBuffer = await source.arrayBuffer();
        } else if (source instanceof ArrayBuffer) {
            arrayBuffer = source;
        } else {
            throw new Error('Invalid source: expected File or ArrayBuffer');
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = config.maxPages ? Math.min(pdf.numPages, config.maxPages) : pdf.numPages;

        const pages = [];
        const fullText = [];
        const tables = [];
        const figures = [];
        const sections = [];

        // Process each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const pageData = await extractPageContent(page, config);

            pages.push({
                number: pageNum,
                ...pageData
            });

            fullText.push(pageData.text);
            tables.push(...pageData.tables.map(t => ({ ...t, page: pageNum })));
            figures.push(...pageData.figures.map(f => ({ ...f, page: pageNum })));
        }

        // Detect document sections
        const combinedText = fullText.join('\n');
        const detectedSections = detectSections(combinedText);

        const processingTime = performance.now() - startTime;

        return {
            success: true,
            metadata: {
                numPages: pdf.numPages,
                pagesProcessed: numPages,
                processingTimeMs: Math.round(processingTime),
                extractionDate: new Date().toISOString()
            },
            content: {
                pages,
                fullText: combinedText,
                tables,
                figures,
                sections: detectedSections
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            partial_result: null
        };
    }
}

/**
 * Extract content from a single page
 * @param {Object} page - pdf.js page object
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Page content
 */
async function extractPageContent(page, config) {
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    // Get text items with positions
    const items = textContent.items.map(item => ({
        text: item.str,
        x: item.transform[4],
        y: viewport.height - item.transform[5], // Flip Y coordinate
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        fontSize: Math.abs(item.transform[0])
    }));

    // Sort by Y (top to bottom) then X (left to right)
    items.sort((a, b) => {
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) < 5) { // Same line threshold
            return a.x - b.x;
        }
        return yDiff;
    });

    // Detect columns if enabled
    let processedItems = items;
    if (config.detectColumns) {
        processedItems = processColumns(items, viewport.width);
    }

    // Group items into lines
    const lines = groupIntoLines(processedItems);

    // Reconstruct text preserving layout
    const text = lines.map(line =>
        line.items.map(item => item.text).join(' ')
    ).join('\n');

    // Detect tables
    const tables = detectTables(lines);

    // Detect figures (basic - based on image annotations)
    const figures = await detectFigures(page);

    return {
        text,
        lines,
        tables,
        figures,
        width: viewport.width,
        height: viewport.height
    };
}

/**
 * Process two-column layout
 * @param {Array} items - Text items
 * @param {number} pageWidth - Page width
 * @returns {Array} Reordered items
 */
function processColumns(items, pageWidth) {
    const midPoint = pageWidth / 2;
    const columnGap = 20; // Minimum gap between columns

    // Check if this looks like two-column layout
    const leftItems = items.filter(i => i.x < midPoint - columnGap);
    const rightItems = items.filter(i => i.x >= midPoint + columnGap);

    if (leftItems.length > 10 && rightItems.length > 10) {
        // Two-column layout detected
        // Sort left column, then right column
        leftItems.sort((a, b) => a.y - b.y || a.x - b.x);
        rightItems.sort((a, b) => a.y - b.y || a.x - b.x);

        return [...leftItems, ...rightItems];
    }

    return items;
}

/**
 * Group text items into lines
 * @param {Array} items - Text items
 * @returns {Array} Lines with items
 */
function groupIntoLines(items) {
    const lines = [];
    let currentLine = { y: null, items: [] };
    const lineThreshold = 8; // Pixels threshold for same line

    for (const item of items) {
        if (currentLine.y === null || Math.abs(item.y - currentLine.y) <= lineThreshold) {
            currentLine.items.push(item);
            if (currentLine.y === null) currentLine.y = item.y;
        } else {
            if (currentLine.items.length > 0) {
                lines.push(currentLine);
            }
            currentLine = { y: item.y, items: [item] };
        }
    }

    if (currentLine.items.length > 0) {
        lines.push(currentLine);
    }

    // Sort items within each line by X position
    lines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
    });

    return lines;
}

/**
 * Detect tables from text lines
 * @param {Array} lines - Text lines
 * @returns {Array} Detected tables
 */
function detectTables(lines) {
    const tables = [];
    let tableStart = -1;
    let tableLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineText = line.items.map(item => item.text).join(' ');

        // Check if line looks like table row
        // (multiple aligned columns, numbers, typical patterns)
        const isTableRow = isLikelyTableRow(line, lineText);

        if (isTableRow) {
            if (tableStart === -1) {
                tableStart = i;
            }
            tableLines.push(line);
        } else {
            if (tableLines.length >= 3) { // Minimum 3 rows for a table
                tables.push({
                    startLine: tableStart,
                    endLine: i - 1,
                    lines: tableLines,
                    raw: tableLines.map(l => l.items.map(item => item.text).join('\t')).join('\n')
                });
            }
            tableStart = -1;
            tableLines = [];
        }
    }

    // Handle table at end of page
    if (tableLines.length >= 3) {
        tables.push({
            startLine: tableStart,
            endLine: lines.length - 1,
            lines: tableLines,
            raw: tableLines.map(l => l.items.map(item => item.text).join('\t')).join('\n')
        });
    }

    return tables;
}

/**
 * Check if a line looks like a table row
 * @param {Object} line - Line object with items
 * @param {string} lineText - Full line text
 * @returns {boolean}
 */
function isLikelyTableRow(line, lineText) {
    // Multiple items with significant horizontal spacing
    if (line.items.length < 2) return false;

    // Check for consistent spacing pattern (columns)
    const gaps = [];
    for (let i = 1; i < line.items.length; i++) {
        const gap = line.items[i].x - (line.items[i-1].x + line.items[i-1].width);
        gaps.push(gap);
    }

    // Table rows typically have larger, more consistent gaps
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const hasLargeGaps = avgGap > 20;

    // Check for numeric content (common in data tables)
    const hasNumbers = /\d+\.?\d*/.test(lineText);

    // Check for table-like patterns
    const hasTablePatterns = /(\d+\s*[±\(\-]\s*\d+)|(\d+\.\d+)|(\d+%)|(\d+\/\d+)/.test(lineText);

    // Check for CI patterns
    const hasCIPattern = /\(\d+\.?\d*\s*[-–,]\s*\d+\.?\d*\)/.test(lineText);

    return (hasLargeGaps && (hasNumbers || hasTablePatterns)) || hasCIPattern;
}

/**
 * Detect figures/images in page
 * @param {Object} page - pdf.js page object
 * @returns {Promise<Array>} Detected figures
 */
async function detectFigures(page) {
    const figures = [];

    try {
        const operatorList = await page.getOperatorList();

        for (let i = 0; i < operatorList.fnArray.length; i++) {
            if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
                operatorList.fnArray[i] === pdfjsLib.OPS.paintJpegXObject) {
                figures.push({
                    type: 'image',
                    index: figures.length,
                    operatorIndex: i
                });
            }
        }
    } catch (e) {
        // Ignore errors in figure detection
    }

    return figures;
}

/**
 * Detect document sections (Abstract, Methods, Results, etc.)
 * @param {string} text - Full document text
 * @returns {Array} Detected sections
 */
function detectSections(text) {
    const sectionPatterns = [
        { name: 'abstract', patterns: [/\bABSTRACT\b/i, /\bSUMMARY\b/i] },
        { name: 'introduction', patterns: [/\bINTRODUCTION\b/i, /\bBACKGROUND\b/i] },
        { name: 'methods', patterns: [/\bMETHODS?\b/i, /\bMATERIALS?\s+AND\s+METHODS?\b/i, /\bSTUDY\s+DESIGN\b/i] },
        { name: 'results', patterns: [/\bRESULTS?\b/i, /\bFINDINGS?\b/i] },
        { name: 'discussion', patterns: [/\bDISCUSSION\b/i] },
        { name: 'conclusion', patterns: [/\bCONCLUSION\b/i] },
        { name: 'references', patterns: [/\bREFERENCES?\b/i, /\bBIBLIOGRAPHY\b/i] },
        { name: 'supplement', patterns: [/\bSUPPLEMENT/i, /\bAPPENDIX/i] }
    ];

    const sections = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        for (const section of sectionPatterns) {
            for (const pattern of section.patterns) {
                if (pattern.test(line) && line.length < 100) { // Section headers are typically short
                    sections.push({
                        name: section.name,
                        lineNumber: i,
                        text: line
                    });
                    break;
                }
            }
        }
    }

    return sections;
}

/**
 * Extract text from specific page range
 * @param {ArrayBuffer} source - PDF source
 * @param {number} startPage - Start page (1-indexed)
 * @param {number} endPage - End page (1-indexed)
 * @returns {Promise<Object>} Extracted text
 */
export async function extractPageRange(source, startPage, endPage) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: source }).promise;
        const texts = [];

        for (let i = startPage; i <= Math.min(endPage, pdf.numPages); i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            texts.push(content.items.map(item => item.str).join(' '));
        }

        return {
            success: true,
            text: texts.join('\n'),
            pages: endPage - startPage + 1
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get PDF metadata
 * @param {ArrayBuffer} source - PDF source
 * @returns {Promise<Object>} PDF metadata
 */
export async function getPDFMetadata(source) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: source }).promise;
        const metadata = await pdf.getMetadata();

        return {
            success: true,
            metadata: {
                title: metadata.info?.Title || null,
                author: metadata.info?.Author || null,
                subject: metadata.info?.Subject || null,
                creator: metadata.info?.Creator || null,
                producer: metadata.info?.Producer || null,
                creationDate: metadata.info?.CreationDate || null,
                modificationDate: metadata.info?.ModDate || null,
                numPages: pdf.numPages
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

export default {
    extractPDF,
    extractPageRange,
    getPDFMetadata
};
