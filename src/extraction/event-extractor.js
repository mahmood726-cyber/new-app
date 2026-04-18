/**
 * Event Extractor Module
 * Extracts raw event counts and person-time data
 *
 * @module event-extractor
 */

import { mapOutcome } from './outcome-mapper.js';

/**
 * Extract event counts from text or tables
 * @param {string|Object} source - Text or table data
 * @param {Object} options - Extraction options
 * @returns {Object} Extracted event data
 */
export function extractEventCounts(source, options = {}) {
    let text;
    if (typeof source === 'string') {
        text = source;
    } else if (source.raw) {
        text = source.raw;
    } else {
        return { success: false, error: 'Invalid source' };
    }

    const events = [];

    // Pattern 1: "X/N (%) vs Y/M (%)" format
    const vsPattern = /(\d+)\s*\/\s*(\d+)\s*\(\s*(\d+\.?\d*)%?\s*\)\s*(?:vs\.?|versus|compared\s+(?:to|with))\s*(\d+)\s*\/\s*(\d+)\s*\(\s*(\d+\.?\d*)%?\s*\)/gi;

    let match;
    while ((match = vsPattern.exec(text)) !== null) {
        events.push({
            treatment: {
                events: parseInt(match[1]),
                total: parseInt(match[2]),
                rate: parseFloat(match[3])
            },
            control: {
                events: parseInt(match[4]),
                total: parseInt(match[5]),
                rate: parseFloat(match[6])
            },
            source: 'text_vs_pattern',
            raw: match[0]
        });
    }

    // Pattern 2: "Events/N in treatment group and Events/N in control"
    const namedGroupPattern = /(\d+)\s*(?:\/|of)\s*(\d+)(?:\s*\(\s*(\d+\.?\d*)%?\s*\))?\s*(?:patients?\s*)?in\s*(?:the\s+)?(\w+(?:\s+\w+)?)\s+(?:group|arm)?\s*(?:and|versus|vs\.?|compared)\s*(\d+)\s*(?:\/|of)\s*(\d+)(?:\s*\(\s*(\d+\.?\d*)%?\s*\))?\s*(?:patients?\s*)?in\s*(?:the\s+)?(\w+)/gi;

    while ((match = namedGroupPattern.exec(text)) !== null) {
        const group1Name = match[4].toLowerCase();
        const group2Name = match[8].toLowerCase();

        const isGroup1Control = /placebo|control|standard/i.test(group1Name);

        events.push({
            treatment: {
                events: parseInt(isGroup1Control ? match[5] : match[1]),
                total: parseInt(isGroup1Control ? match[6] : match[2]),
                rate: parseFloat(isGroup1Control ? (match[7] || '0') : (match[3] || '0')) || null,
                groupName: isGroup1Control ? group2Name : group1Name
            },
            control: {
                events: parseInt(isGroup1Control ? match[1] : match[5]),
                total: parseInt(isGroup1Control ? match[2] : match[6]),
                rate: parseFloat(isGroup1Control ? (match[3] || '0') : (match[7] || '0')) || null,
                groupName: isGroup1Control ? group1Name : group2Name
            },
            source: 'text_named_groups',
            raw: match[0]
        });
    }

    // Pattern 3: Table row format "Outcome Events/N Events/N"
    const lines = text.split('\n');
    for (const line of lines) {
        const tableRowMatch = line.match(/^(.+?)\s+(\d+)\s*\/\s*(\d+)\s+(\d+)\s*\/\s*(\d+)/);
        if (tableRowMatch) {
            const outcomeName = tableRowMatch[1].trim();
            const mapped = mapOutcome(outcomeName);

            events.push({
                outcome: {
                    raw: outcomeName,
                    mapped: mapped.mapped,
                    category: mapped.category
                },
                treatment: {
                    events: parseInt(tableRowMatch[2]),
                    total: parseInt(tableRowMatch[3])
                },
                control: {
                    events: parseInt(tableRowMatch[4]),
                    total: parseInt(tableRowMatch[5])
                },
                source: 'table_row',
                raw: line
            });
        }
    }

    // Pattern 4: Incidence rates per person-years
    const incidencePattern = /(\d+\.?\d*)\s*(?:events?)?\s*per\s*(\d+)\s*patient[- ]?years?\s*(?:in\s+(?:the\s+)?(\w+))?\s*(?:(?:and|vs\.?|versus)\s*(\d+\.?\d*)\s*(?:events?)?\s*per\s*(\d+)\s*patient[- ]?years?\s*(?:in\s+(?:the\s+)?(\w+))?)?/gi;

    while ((match = incidencePattern.exec(text)) !== null) {
        const data = {
            group1: {
                incidence_rate: parseFloat(match[1]),
                per_person_years: parseInt(match[2]),
                groupName: match[3] || null
            },
            source: 'incidence_rate',
            raw: match[0]
        };

        if (match[4]) {
            data.group2 = {
                incidence_rate: parseFloat(match[4]),
                per_person_years: parseInt(match[5]),
                groupName: match[6] || null
            };
        }

        events.push(data);
    }

    return {
        success: true,
        events,
        count: events.length
    };
}

/**
 * Extract total person-time at risk
 * @param {string} text - Text to search
 * @returns {Object|null} Person-time data
 */
export function extractPersonTime(text) {
    const patterns = [
        // Total person-years
        {
            pattern: /(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:total\s+)?patient[- ]?years?\s*(?:of\s+)?(?:follow[- ]?up|observation)/i,
            type: 'total'
        },
        // Per-group person-years
        {
            pattern: /(\d+(?:,\d+)?(?:\.\d+)?)\s*patient[- ]?years?\s*(?:in\s+(?:the\s+)?(\w+(?:\s+\w+)?))(?:\s*(?:and|vs\.?)\s*(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:in\s+(?:the\s+)?(\w+(?:\s+\w+)?))?)?/i,
            type: 'per_group'
        },
        // Follow-up in person-years
        {
            pattern: /(?:median|mean|total)\s+follow[- ]?up\s*(?:was\s+)?(\d+(?:,\d+)?(?:\.\d+)?)\s*patient[- ]?years?/i,
            type: 'total'
        }
    ];

    for (const { pattern, type } of patterns) {
        const match = text.match(pattern);
        if (match) {
            const parseNum = (s) => s ? parseFloat(s.replace(/,/g, '')) : null;

            if (type === 'total') {
                return {
                    total: parseNum(match[1]),
                    type: 'patient_years',
                    raw: match[0]
                };
            } else {
                return {
                    group1: {
                        value: parseNum(match[1]),
                        name: match[2] || null
                    },
                    group2: match[3] ? {
                        value: parseNum(match[3]),
                        name: match[4] || null
                    } : null,
                    type: 'patient_years',
                    raw: match[0]
                };
            }
        }
    }

    return null;
}

/**
 * Calculate derived values from event counts
 * @param {Object} eventData - Event data with treatment/control
 * @returns {Object} Event data with derived values
 */
export function calculateDerivedValues(eventData) {
    const result = { ...eventData };

    if (eventData.treatment && eventData.control) {
        const { treatment, control } = eventData;

        // Calculate rates if not present
        if (treatment.events != null && treatment.total != null && treatment.rate == null) {
            treatment.rate = (treatment.events / treatment.total) * 100;
        }
        if (control.events != null && control.total != null && control.rate == null) {
            control.rate = (control.events / control.total) * 100;
        }

        // Risk difference (absolute risk reduction)
        if (treatment.rate != null && control.rate != null) {
            result.risk_difference = control.rate - treatment.rate; // ARR
            result.rrr = control.rate > 0 ? (result.risk_difference / control.rate) * 100 : null; // RRR %

            // NNT
            if (result.risk_difference > 0) {
                result.nnt = Math.round(100 / result.risk_difference);
            } else if (result.risk_difference < 0) {
                result.nnh = Math.round(100 / Math.abs(result.risk_difference)); // NNH
            }
        }

        // Risk ratio
        if (treatment.rate != null && control.rate != null && control.rate > 0) {
            result.risk_ratio = treatment.rate / control.rate;
        }

        // Odds ratio
        if (treatment.events != null && treatment.total != null &&
            control.events != null && control.total != null) {
            const a = treatment.events;
            const b = treatment.total - treatment.events;
            const c = control.events;
            const d = control.total - control.events;

            if (b > 0 && c > 0) {
                result.odds_ratio = (a * d) / (b * c);
            }
        }
    }

    return result;
}

/**
 * Extract events from an outcomes table
 * @param {Object} table - Parsed table
 * @param {Object} options - Options
 * @returns {Array} Array of extracted events
 */
export function extractFromOutcomesTable(table, options = {}) {
    const events = [];

    if (!table.data || table.data.length === 0) {
        return events;
    }

    // Try to identify column roles
    const headers = table.headers?.[table.headers.length - 1] || [];
    const columns = identifyColumnRoles(headers);

    for (const row of table.data) {
        if (!row || row.length === 0) continue;

        const outcomeName = row[0]?.raw || row[0]?.toString() || '';
        if (!outcomeName || outcomeName.length < 3) continue;

        const mapped = mapOutcome(outcomeName);

        const eventData = {
            outcome: {
                raw: outcomeName,
                mapped: mapped.mapped,
                category: mapped.category
            },
            treatment: {},
            control: {}
        };

        // Extract values based on column roles
        for (const col of columns) {
            if (col.index >= row.length) continue;

            const cellText = row[col.index]?.raw || row[col.index]?.toString() || '';
            const value = parseEventCell(cellText);

            if (value) {
                if (col.role === 'treatment') {
                    Object.assign(eventData.treatment, value);
                } else if (col.role === 'control') {
                    Object.assign(eventData.control, value);
                }
            }
        }

        // Only add if we have some data
        if (Object.keys(eventData.treatment).length > 0 ||
            Object.keys(eventData.control).length > 0) {
            events.push(calculateDerivedValues(eventData));
        }
    }

    return events;
}

/**
 * Identify column roles from headers
 * @param {Array} headers - Header row
 * @returns {Array} Column role definitions
 */
function identifyColumnRoles(headers) {
    const columns = [];

    for (let i = 0; i < headers.length; i++) {
        const text = headers[i]?.raw || headers[i]?.toString() || '';
        const lower = text.toLowerCase();

        let role = null;
        let type = null;

        // Identify treatment vs control
        if (/placebo|control|standard|usual\s*care/i.test(lower)) {
            role = 'control';
        } else if (/treatment|intervention|active|drug\s*name/i.test(lower) ||
            /dapagliflozin|empagliflozin|canagliflozin|ertugliflozin/i.test(lower)) {
            role = 'treatment';
        }

        // Identify value type
        if (/events?.*\/.*n|n.*events?/i.test(lower) || /events?\s*\(/i.test(lower)) {
            type = 'events_n';
        } else if (/events?|n\s*\(/i.test(lower)) {
            type = 'events';
        } else if (/total|n\b/i.test(lower)) {
            type = 'total';
        } else if (/%|rate|incidence/i.test(lower)) {
            type = 'rate';
        }

        if (role || type) {
            columns.push({ index: i, role, type, header: text });
        }
    }

    // If no roles identified, assume standard layout
    if (columns.filter(c => c.role).length === 0 && headers.length >= 3) {
        columns.push({ index: 1, role: 'treatment', type: 'events_n' });
        columns.push({ index: 2, role: 'control', type: 'events_n' });
    }

    return columns;
}

/**
 * Parse event cell content
 * @param {string} text - Cell text
 * @returns {Object|null} Parsed values
 */
function parseEventCell(text) {
    if (!text || /^(NR|NA|—|-|–)$/i.test(text.trim())) {
        return null;
    }

    // Pattern: events/total (%)
    const fullPattern = /(\d+)\s*\/\s*(\d+)\s*\(\s*(\d+\.?\d*)%?\s*\)/;
    const fullMatch = text.match(fullPattern);
    if (fullMatch) {
        return {
            events: parseInt(fullMatch[1]),
            total: parseInt(fullMatch[2]),
            rate: parseFloat(fullMatch[3])
        };
    }

    // Pattern: events/total
    const eventsNPattern = /(\d+)\s*\/\s*(\d+)/;
    const eventsNMatch = text.match(eventsNPattern);
    if (eventsNMatch) {
        return {
            events: parseInt(eventsNMatch[1]),
            total: parseInt(eventsNMatch[2])
        };
    }

    // Pattern: n (%)
    const nPctPattern = /(\d+)\s*\(\s*(\d+\.?\d*)%?\s*\)/;
    const nPctMatch = text.match(nPctPattern);
    if (nPctMatch) {
        return {
            events: parseInt(nPctMatch[1]),
            rate: parseFloat(nPctMatch[2])
        };
    }

    // Pattern: just a number (events)
    const numPattern = /^(\d+)$/;
    const numMatch = text.trim().match(numPattern);
    if (numMatch) {
        return { events: parseInt(numMatch[1]) };
    }

    // Pattern: percentage
    const pctPattern = /(\d+\.?\d*)\s*%/;
    const pctMatch = text.match(pctPattern);
    if (pctMatch) {
        return { rate: parseFloat(pctMatch[1]) };
    }

    return null;
}

/**
 * Validate event count consistency
 * @param {Object} eventData - Event data to validate
 * @returns {Object} Validation result
 */
export function validateEventData(eventData) {
    const issues = [];

    if (eventData.treatment) {
        const { events, total, rate } = eventData.treatment;

        if (events != null && total != null) {
            if (events > total) {
                issues.push('Treatment: events exceed total');
            }

            if (rate != null) {
                const expectedRate = (events / total) * 100;
                if (Math.abs(rate - expectedRate) > 1) {
                    issues.push(`Treatment: rate (${rate}%) inconsistent with events/total (${expectedRate.toFixed(1)}%)`);
                }
            }
        }
    }

    if (eventData.control) {
        const { events, total, rate } = eventData.control;

        if (events != null && total != null) {
            if (events > total) {
                issues.push('Control: events exceed total');
            }

            if (rate != null) {
                const expectedRate = (events / total) * 100;
                if (Math.abs(rate - expectedRate) > 1) {
                    issues.push(`Control: rate (${rate}%) inconsistent with events/total (${expectedRate.toFixed(1)}%)`);
                }
            }
        }
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

export default {
    extractEventCounts,
    extractPersonTime,
    calculateDerivedValues,
    extractFromOutcomesTable,
    validateEventData
};
