/**
 * Table Parser Module
 * Advanced table extraction with merged cell detection
 *
 * @module table-parser
 */

/**
 * Parse table from raw text/lines
 * @param {Object} tableData - Raw table data from PDF processor
 * @param {Object} options - Parsing options
 * @returns {Object} Structured table
 */
export function parseTable(tableData, options = {}) {
    const config = {
        detectMergedCells: options.detectMergedCells ?? true,
        detectHeaders: options.detectHeaders ?? true,
        normalizeNumbers: options.normalizeNumbers ?? true,
        ...options
    };

    try {
        // Extract cells with positions
        const cells = extractCells(tableData);

        // Detect merged cells
        let processedCells = cells;
        if (config.detectMergedCells) {
            processedCells = detectAndExpandMergedCells(cells);
        }

        // Build row/column structure
        const grid = buildGrid(processedCells);

        // Detect header rows
        let headerRows = 0;
        if (config.detectHeaders) {
            headerRows = detectHeaderRows(grid);
        }

        // Split headers and data
        const headers = grid.slice(0, headerRows);
        const dataRows = grid.slice(headerRows);

        // Normalize values if requested
        let finalDataRows = dataRows;
        if (config.normalizeNumbers) {
            finalDataRows = dataRows.map(row =>
                row.map(cell => normalizeValue(cell))
            );
        }

        return {
            success: true,
            headers: headers,
            headerRowCount: headerRows,
            data: finalDataRows,
            rowCount: finalDataRows.length,
            columnCount: grid[0]?.length || 0,
            raw: tableData.raw || ''
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            partial_result: {
                raw: tableData.raw || ''
            }
        };
    }
}

/**
 * Extract cells from table data
 * @param {Object} tableData - Table data
 * @returns {Array} Cell objects with positions
 */
function extractCells(tableData) {
    const cells = [];

    if (tableData.lines) {
        // Process from lines with position data
        for (let rowIdx = 0; rowIdx < tableData.lines.length; rowIdx++) {
            const line = tableData.lines[rowIdx];

            for (const item of line.items) {
                cells.push({
                    text: item.text.trim(),
                    x: item.x,
                    y: line.y,
                    width: item.width || 0,
                    row: rowIdx,
                    column: -1 // Will be determined by grid building
                });
            }
        }
    } else if (tableData.raw) {
        // Process from raw tab/space separated text
        const lines = tableData.raw.split('\n');
        for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
            const parts = lines[rowIdx].split(/\t+|\s{2,}/);
            for (let colIdx = 0; colIdx < parts.length; colIdx++) {
                if (parts[colIdx].trim()) {
                    cells.push({
                        text: parts[colIdx].trim(),
                        row: rowIdx,
                        column: colIdx,
                        x: colIdx * 100, // Approximate for grid building
                        y: rowIdx * 20
                    });
                }
            }
        }
    }

    return cells;
}

/**
 * Detect and expand merged cells
 * @param {Array} cells - Cell objects
 * @returns {Array} Cells with merged cells expanded
 */
function detectAndExpandMergedCells(cells) {
    if (cells.length === 0) return cells;

    // Find column boundaries based on X positions
    const xPositions = [...new Set(cells.map(c => Math.round(c.x / 10) * 10))].sort((a, b) => a - b);
    const columnBoundaries = findColumnBoundaries(xPositions);

    // Assign columns to cells
    cells.forEach(cell => {
        cell.column = findColumnIndex(cell.x, columnBoundaries);
    });

    // Detect row spans (cells that span multiple rows)
    const rowGroups = groupBy(cells, 'row');
    const rows = Object.keys(rowGroups).map(Number).sort((a, b) => a - b);

    // Check for cells that appear to span rows
    const expandedCells = [...cells];

    for (const cell of cells) {
        // Check if this cell might span multiple rows
        // (large height or specific patterns like "Total" spanning down)
        if (isLikelyMergedVertical(cell, cells, rows)) {
            const spannedRows = findVerticalSpan(cell, cells, rows);
            for (const spannedRow of spannedRows) {
                if (spannedRow !== cell.row) {
                    expandedCells.push({
                        ...cell,
                        row: spannedRow,
                        isMerged: true,
                        originalRow: cell.row
                    });
                }
            }
        }
    }

    // Detect horizontal spans (multi-column headers)
    for (const cell of cells) {
        if (isLikelyMergedHorizontal(cell, cells, columnBoundaries)) {
            const spannedCols = findHorizontalSpan(cell, columnBoundaries);
            for (const spannedCol of spannedCols) {
                if (spannedCol !== cell.column) {
                    expandedCells.push({
                        ...cell,
                        column: spannedCol,
                        isMerged: true,
                        originalColumn: cell.column
                    });
                }
            }
        }
    }

    return expandedCells;
}

/**
 * Find column boundaries from X positions
 * @param {Array} xPositions - Sorted X positions
 * @returns {Array} Column boundary positions
 */
function findColumnBoundaries(xPositions) {
    const boundaries = [];
    let prevX = xPositions[0];
    boundaries.push(prevX);

    for (const x of xPositions) {
        if (x - prevX > 30) { // Minimum column gap
            boundaries.push(x);
        }
        prevX = x;
    }

    return boundaries;
}

/**
 * Find column index for X position
 * @param {number} x - X position
 * @param {Array} boundaries - Column boundaries
 * @returns {number} Column index
 */
function findColumnIndex(x, boundaries) {
    for (let i = boundaries.length - 1; i >= 0; i--) {
        if (x >= boundaries[i] - 15) {
            return i;
        }
    }
    return 0;
}

/**
 * Check if cell likely spans multiple rows
 * @param {Object} cell - Cell to check
 * @param {Array} allCells - All cells
 * @param {Array} rows - Row indices
 * @returns {boolean}
 */
function isLikelyMergedVertical(cell, allCells, rows) {
    // Check if there's a gap in this column for subsequent rows
    const cellsInColumn = allCells.filter(c => c.column === cell.column);
    const rowsInColumn = cellsInColumn.map(c => c.row);

    // If this cell is in a row where subsequent rows in same column are empty
    const cellRowIndex = rows.indexOf(cell.row);
    if (cellRowIndex < rows.length - 1) {
        const nextRow = rows[cellRowIndex + 1];
        const hasNextCell = rowsInColumn.includes(nextRow);

        // Also check for header-like patterns that span
        const isHeader = /^(characteristic|variable|outcome|total|overall)/i.test(cell.text);

        return !hasNextCell && isHeader;
    }

    return false;
}

/**
 * Find rows spanned by a cell
 * @param {Object} cell - Cell to check
 * @param {Array} allCells - All cells
 * @param {Array} rows - Row indices
 * @returns {Array} Spanned row indices
 */
function findVerticalSpan(cell, allCells, rows) {
    const spanned = [cell.row];
    const cellRowIndex = rows.indexOf(cell.row);

    const cellsInColumn = allCells.filter(c => c.column === cell.column);
    const rowsInColumn = new Set(cellsInColumn.map(c => c.row));

    for (let i = cellRowIndex + 1; i < rows.length; i++) {
        if (!rowsInColumn.has(rows[i])) {
            spanned.push(rows[i]);
        } else {
            break;
        }
    }

    return spanned;
}

/**
 * Check if cell likely spans multiple columns
 * @param {Object} cell - Cell to check
 * @param {Array} allCells - All cells
 * @param {Array} boundaries - Column boundaries
 * @returns {boolean}
 */
function isLikelyMergedHorizontal(cell, allCells, boundaries) {
    // Wide cells relative to column width
    const colWidth = boundaries[1] - boundaries[0];
    if (cell.width && cell.width > colWidth * 1.5) {
        return true;
    }

    // Common merged header patterns
    const mergedPatterns = [
        /treatment\s+(arm|group)/i,
        /control\s+(arm|group)/i,
        /intervention/i,
        /placebo/i,
        /events?\s*\/\s*n/i,
        /\d+\s*mg/i
    ];

    return mergedPatterns.some(p => p.test(cell.text));
}

/**
 * Find columns spanned by a cell
 * @param {Object} cell - Cell
 * @param {Array} boundaries - Column boundaries
 * @returns {Array} Spanned column indices
 */
function findHorizontalSpan(cell, boundaries) {
    const spanned = [cell.column];

    if (cell.width) {
        const cellEnd = cell.x + cell.width;
        for (let i = cell.column + 1; i < boundaries.length; i++) {
            if (cellEnd > boundaries[i]) {
                spanned.push(i);
            } else {
                break;
            }
        }
    }

    return spanned;
}

/**
 * Build grid from cells
 * @param {Array} cells - Cell objects
 * @returns {Array} 2D grid
 */
function buildGrid(cells) {
    if (cells.length === 0) return [];

    const rowIndices = [...new Set(cells.map(c => c.row))].sort((a, b) => a - b);
    const colIndices = [...new Set(cells.map(c => c.column))].sort((a, b) => a - b);

    const grid = [];

    for (const rowIdx of rowIndices) {
        const row = [];
        const rowCells = cells.filter(c => c.row === rowIdx);

        for (const colIdx of colIndices) {
            const cell = rowCells.find(c => c.column === colIdx);
            row.push(cell ? cell.text : '');
        }

        grid.push(row);
    }

    return grid;
}

/**
 * Detect number of header rows
 * @param {Array} grid - Table grid
 * @returns {number} Number of header rows
 */
function detectHeaderRows(grid) {
    if (grid.length < 2) return 0;

    let headerRows = 0;
    const headerPatterns = [
        /^(characteristic|variable|parameter|measure)/i,
        /^(treatment|intervention|drug|placebo|control)/i,
        /^(outcome|endpoint|event)/i,
        /^n\s*[=%\(]?/i,
        /^(age|sex|male|female|bmi)/i,
        /^(hr|or|rr|ci|se|sd)/i,
        /^mean|^median/i,
        /^\d+\s*mg/i,
        /^p[\s\-]?value/i
    ];

    for (let i = 0; i < Math.min(3, grid.length); i++) {
        const row = grid[i];
        let isHeader = false;

        // Check if row contains header patterns
        const rowText = row.join(' ').toLowerCase();
        if (headerPatterns.some(p => p.test(rowText))) {
            isHeader = true;
        }

        // Check if row has mostly text (not numbers)
        const numericCells = row.filter(cell =>
            /^\d+\.?\d*$/.test(cell.trim())
        ).length;

        if (numericCells < row.length / 2) {
            isHeader = true;
        }

        // First row after empty or short first cell is often header
        if (i === 0 && row[0] && row[0].length < 30) {
            isHeader = true;
        }

        if (isHeader) {
            headerRows = i + 1;
        } else {
            break;
        }
    }

    return Math.max(1, headerRows); // At least 1 header row
}

/**
 * Normalize cell value
 * @param {string} value - Raw cell value
 * @returns {Object} Normalized value with type
 */
function normalizeValue(value) {
    if (!value || typeof value !== 'string') {
        return { raw: value, value: value, type: 'empty' };
    }

    const trimmed = value.trim();

    // Handle special values
    if (/^(NR|NA|ND|NE|–|-|—)$/i.test(trimmed)) {
        return { raw: trimmed, value: null, type: 'missing' };
    }

    // Percentage
    const pctMatch = trimmed.match(/^(\d+\.?\d*)\s*%$/);
    if (pctMatch) {
        return {
            raw: trimmed,
            value: parseFloat(pctMatch[1]),
            type: 'percentage'
        };
    }

    // Count with percentage: "123 (45.6%)"
    const countPctMatch = trimmed.match(/^(\d+)\s*\((\d+\.?\d*)%?\)/);
    if (countPctMatch) {
        return {
            raw: trimmed,
            count: parseInt(countPctMatch[1]),
            percentage: parseFloat(countPctMatch[2]),
            type: 'count_percentage'
        };
    }

    // Mean ± SD: "45.6 ± 12.3"
    const meanSDMatch = trimmed.match(/^(\d+\.?\d*)\s*[±+\-]\s*(\d+\.?\d*)$/);
    if (meanSDMatch) {
        return {
            raw: trimmed,
            mean: parseFloat(meanSDMatch[1]),
            sd: parseFloat(meanSDMatch[2]),
            type: 'mean_sd'
        };
    }

    // Median with IQR: "45.6 (30.2-60.1)" or "45.6 [30.2, 60.1]"
    const medianIQRMatch = trimmed.match(/^(\d+\.?\d*)\s*[\(\[](\d+\.?\d*)\s*[-–,]\s*(\d+\.?\d*)[\)\]]$/);
    if (medianIQRMatch) {
        return {
            raw: trimmed,
            median: parseFloat(medianIQRMatch[1]),
            q1: parseFloat(medianIQRMatch[2]),
            q3: parseFloat(medianIQRMatch[3]),
            type: 'median_iqr'
        };
    }

    // Plain number
    const numMatch = trimmed.match(/^-?\d+\.?\d*$/);
    if (numMatch) {
        return {
            raw: trimmed,
            value: parseFloat(trimmed),
            type: 'number'
        };
    }

    // Fraction: "123/456"
    const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fractionMatch) {
        return {
            raw: trimmed,
            numerator: parseInt(fractionMatch[1]),
            denominator: parseInt(fractionMatch[2]),
            type: 'fraction'
        };
    }

    // Text
    return { raw: trimmed, value: trimmed, type: 'text' };
}

/**
 * Group array by key
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const value = item[key];
        groups[value] = groups[value] || [];
        groups[value].push(item);
        return groups;
    }, {});
}

/**
 * Extract specific table by title/caption
 * @param {Array} tables - Array of tables
 * @param {string|RegExp} pattern - Pattern to match title
 * @returns {Object|null} Matched table
 */
export function findTableByTitle(tables, pattern) {
    for (const table of tables) {
        const searchText = table.raw || '';
        if (typeof pattern === 'string') {
            if (searchText.toLowerCase().includes(pattern.toLowerCase())) {
                return table;
            }
        } else if (pattern instanceof RegExp) {
            if (pattern.test(searchText)) {
                return table;
            }
        }
    }
    return null;
}

/**
 * Extract Table 1 (baseline characteristics)
 * @param {Array} tables - Array of tables
 * @returns {Object|null} Baseline table
 */
export function findBaselineTable(tables) {
    const patterns = [
        /table\s*1\b/i,
        /baseline\s*(characteristics?|demographics?)/i,
        /patient\s*(characteristics?|demographics?)/i,
        /characteristics?\s+of\s+(the\s+)?patients?/i
    ];

    for (const table of tables) {
        const searchText = table.raw || '';
        for (const pattern of patterns) {
            if (pattern.test(searchText)) {
                return parseTable(table);
            }
        }
    }

    return null;
}

/**
 * Extract efficacy/outcomes table
 * @param {Array} tables - Array of tables
 * @returns {Object|null} Outcomes table
 */
export function findOutcomesTable(tables) {
    const patterns = [
        /table\s*2\b/i,
        /primary\s*(outcome|endpoint|efficacy)/i,
        /efficacy\s*(outcome|endpoint|result)/i,
        /clinical\s*(outcome|endpoint)/i,
        /hazard\s+ratio/i,
        /\bhr\b.*\bci\b/i
    ];

    for (const table of tables) {
        const searchText = table.raw || '';
        for (const pattern of patterns) {
            if (pattern.test(searchText)) {
                return parseTable(table);
            }
        }
    }

    return null;
}

export default {
    parseTable,
    findTableByTitle,
    findBaselineTable,
    findOutcomesTable
};
