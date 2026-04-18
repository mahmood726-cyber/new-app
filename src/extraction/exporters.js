/**
 * Exporters Module
 * Export extracted data to various formats
 *
 * @module exporters
 */

import { normalizeData, toMetaEngineFormat } from './output-schema.js';

/**
 * Export to JSON format
 * @param {Object} data - Extracted data
 * @param {Object} options - Export options
 * @returns {string} JSON string
 */
export function exportToJSON(data, options = {}) {
    const normalized = normalizeData(data);

    const output = {
        ...normalized,
        _export_info: {
            format: 'json',
            version: '2.0',
            exported_at: new Date().toISOString(),
            ...options.exportInfo
        }
    };

    return JSON.stringify(output, null, options.pretty ? 2 : 0);
}

/**
 * Export to CSV format
 * @param {Object} data - Extracted data
 * @param {Object} options - Export options
 * @returns {string} CSV string
 */
export function exportToCSV(data, options = {}) {
    const normalized = normalizeData(data);
    const lines = [];

    // Trial information sheet
    const trialInfo = [
        ['Field', 'Value'],
        ['Trial ID', normalized.trial_id || ''],
        ['Trial Name', normalized.trial_name || ''],
        ['DOI', normalized.publication?.doi || ''],
        ['PMID', normalized.publication?.pmid || ''],
        ['Year', normalized.publication?.year || ''],
        ['Intervention', normalized.intervention?.name || ''],
        ['Dose', normalized.intervention?.dose || ''],
        ['Comparator', normalized.comparator || ''],
        ['N Randomized', normalized.population?.n_randomized || ''],
        ['N Treatment', normalized.population?.n_treatment || ''],
        ['N Control', normalized.population?.n_control || ''],
        ['Median Follow-up (months)', normalized.followup?.median_months || ''],
        ['Overall Confidence', normalized.extraction_metadata?.overall_confidence || '']
    ];

    lines.push('=== TRIAL INFORMATION ===');
    lines.push(...trialInfo.map(row => row.map(escapeCSV).join(',')));
    lines.push('');

    // Outcomes sheet
    const outcomeHeaders = [
        'Outcome',
        'Mapped Name',
        'Category',
        'Is Primary',
        'Effect Type',
        'Effect',
        'CI Lower',
        'CI Upper',
        'P-value',
        'Events (Treatment)',
        'Events (Control)',
        'N (Treatment)',
        'N (Control)',
        'Confidence',
        'Source'
    ];

    lines.push('=== OUTCOMES ===');
    lines.push(outcomeHeaders.map(escapeCSV).join(','));

    for (const outcome of normalized.outcomes) {
        const row = [
            outcome.name,
            outcome.mapped_name || '',
            outcome.category || '',
            outcome.is_primary ? 'Yes' : 'No',
            outcome.effect_type || 'HR',
            outcome.effect,
            outcome.ci_lower,
            outcome.ci_upper,
            outcome.p_value || '',
            outcome.events_treatment || '',
            outcome.events_control || '',
            outcome.n_treatment || '',
            outcome.n_control || '',
            outcome.confidence || '',
            outcome.source || ''
        ];
        lines.push(row.map(escapeCSV).join(','));
    }

    lines.push('');

    // Baseline characteristics sheet
    if (normalized.baseline?.characteristics?.length > 0) {
        const baselineHeaders = ['Characteristic', 'Type', 'Unit', 'Treatment', 'Control'];

        lines.push('=== BASELINE CHARACTERISTICS ===');
        lines.push(baselineHeaders.map(escapeCSV).join(','));

        for (const char of normalized.baseline.characteristics) {
            const treatmentVal = formatBaselineValue(char.treatment);
            const controlVal = formatBaselineValue(char.control);

            const row = [
                char.label,
                char.type || '',
                char.unit || '',
                treatmentVal,
                controlVal
            ];
            lines.push(row.map(escapeCSV).join(','));
        }

        lines.push('');
    }

    // Subgroups sheet
    if (normalized.subgroups?.length > 0) {
        lines.push('=== SUBGROUP ANALYSES ===');
        lines.push(['Variable', 'Category', 'Effect', 'CI Lower', 'CI Upper', 'Interaction P'].map(escapeCSV).join(','));

        for (const sg of normalized.subgroups) {
            for (const cat of sg.categories || []) {
                const row = [
                    sg.variable_label || sg.variable,
                    cat.label,
                    cat.effect?.value || cat.effect || '',
                    cat.effect?.ci_lower || cat.ci_lower || '',
                    cat.effect?.ci_upper || cat.ci_upper || '',
                    sg.interaction_p || ''
                ];
                lines.push(row.map(escapeCSV).join(','));
            }
        }
    }

    return lines.join('\n');
}

/**
 * Export to RevMan format (Cochrane Review Manager)
 * @param {Object} data - Extracted data
 * @param {Object} options - Export options
 * @returns {string} RevMan-compatible XML
 */
export function exportToRevMan(data, options = {}) {
    const normalized = normalizeData(data);

    const xml = [];
    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push('<COCHRANE_REVIEW>');
    xml.push('  <INCLUDED_STUDIES>');

    // Study entry
    xml.push('    <STUDY>');
    xml.push(`      <ID>${escapeXML(normalized.trial_id || '')}</ID>`);
    xml.push(`      <NAME>${escapeXML(normalized.trial_name || '')}</NAME>`);
    xml.push(`      <YEAR>${normalized.publication?.year || ''}</YEAR>`);

    // Reference
    xml.push('      <REFERENCES>');
    xml.push('        <REFERENCE>');
    xml.push(`          <PMID>${normalized.publication?.pmid || ''}</PMID>`);
    xml.push(`          <DOI>${escapeXML(normalized.publication?.doi || '')}</DOI>`);
    xml.push('        </REFERENCE>');
    xml.push('      </REFERENCES>');

    // Participants
    xml.push('      <PARTICIPANTS>');
    xml.push(`        <TOTAL>${normalized.population?.n_randomized || ''}</TOTAL>`);
    xml.push(`        <INTERVENTION>${normalized.population?.n_treatment || ''}</INTERVENTION>`);
    xml.push(`        <CONTROL>${normalized.population?.n_control || ''}</CONTROL>`);
    xml.push('      </PARTICIPANTS>');

    // Interventions
    xml.push('      <INTERVENTIONS>');
    xml.push(`        <INTERVENTION_NAME>${escapeXML(normalized.intervention?.name || '')}</INTERVENTION_NAME>`);
    xml.push(`        <INTERVENTION_DOSE>${escapeXML(normalized.intervention?.dose || '')}</INTERVENTION_DOSE>`);
    xml.push(`        <CONTROL_NAME>${escapeXML(normalized.comparator || '')}</CONTROL_NAME>`);
    xml.push('      </INTERVENTIONS>');

    xml.push('    </STUDY>');
    xml.push('  </INCLUDED_STUDIES>');

    // Outcomes
    xml.push('  <ANALYSES>');

    for (const outcome of normalized.outcomes) {
        xml.push('    <ANALYSIS>');
        xml.push(`      <NAME>${escapeXML(outcome.name)}</NAME>`);
        xml.push(`      <EFFECT_TYPE>${outcome.effect_type || 'HR'}</EFFECT_TYPE>`);
        xml.push('      <DATA>');
        xml.push(`        <EVENTS_INT>${outcome.events_treatment || ''}</EVENTS_INT>`);
        xml.push(`        <TOTAL_INT>${outcome.n_treatment || ''}</TOTAL_INT>`);
        xml.push(`        <EVENTS_CONT>${outcome.events_control || ''}</EVENTS_CONT>`);
        xml.push(`        <TOTAL_CONT>${outcome.n_control || ''}</TOTAL_CONT>`);
        xml.push(`        <EFFECT>${outcome.effect || ''}</EFFECT>`);
        xml.push(`        <CI_LOWER>${outcome.ci_lower || ''}</CI_LOWER>`);
        xml.push(`        <CI_UPPER>${outcome.ci_upper || ''}</CI_UPPER>`);
        xml.push('      </DATA>');
        xml.push('    </ANALYSIS>');
    }

    xml.push('  </ANALYSES>');
    xml.push('</COCHRANE_REVIEW>');

    return xml.join('\n');
}

/**
 * Export to PRISMA data extraction form
 * @param {Object} data - Extracted data
 * @param {Object} options - Export options
 * @returns {Object} PRISMA form data
 */
export function exportToPRISMA(data, options = {}) {
    const normalized = normalizeData(data);

    return {
        study_identification: {
            study_id: normalized.trial_id,
            study_name: normalized.trial_name,
            first_author: normalized.publication?.authors?.[0] || null,
            year: normalized.publication?.year,
            journal: normalized.publication?.journal,
            doi: normalized.publication?.doi,
            pmid: normalized.publication?.pmid
        },

        methods: {
            study_design: 'Randomized Controlled Trial',
            setting: null,
            countries: null,
            recruitment_period: null,
            follow_up_duration: normalized.followup?.median_months ?
                `${normalized.followup.median_months} months` : null
        },

        participants: {
            total_randomized: normalized.population?.n_randomized,
            intervention_n: normalized.population?.n_treatment,
            control_n: normalized.population?.n_control,
            inclusion_criteria: normalized.population?.inclusion_criteria,
            exclusion_criteria: normalized.population?.exclusion_criteria,
            age: getBaselineValue(normalized, 'age'),
            sex_male_percent: getBaselineValue(normalized, 'sex_male'),
            baseline_characteristics: normalized.baseline?.characteristics?.map(c => ({
                characteristic: c.label,
                intervention: formatBaselineValue(c.treatment),
                control: formatBaselineValue(c.control)
            }))
        },

        interventions: {
            intervention_name: normalized.intervention?.name,
            intervention_dose: normalized.intervention?.dose,
            intervention_description: normalized.intervention?.description,
            control_name: normalized.comparator,
            control_description: null
        },

        outcomes: normalized.outcomes.map(o => ({
            outcome_name: o.name,
            outcome_definition: o.definition,
            time_point: null,
            effect_measure: o.effect_type,
            effect_estimate: o.effect,
            confidence_interval: o.ci_lower && o.ci_upper ?
                `${o.ci_lower} to ${o.ci_upper}` : null,
            p_value: o.p_value,
            events_intervention: o.events_treatment,
            events_control: o.events_control
        })),

        risk_of_bias: {
            randomization: null,
            allocation_concealment: null,
            blinding_participants: null,
            blinding_outcome: null,
            incomplete_outcome: null,
            selective_reporting: null,
            other_bias: null
        },

        notes: {
            funding: null,
            conflicts_of_interest: null,
            other_notes: null
        },

        extraction_info: {
            extractor: 'Meta-Analysis Platform v2.0',
            date: new Date().toISOString(),
            confidence: normalized.extraction_metadata?.overall_confidence
        }
    };
}

/**
 * Export to MetaEngine format
 * @param {Object} data - Extracted data
 * @returns {Object} MetaEngine format
 */
export { toMetaEngineFormat };

/**
 * Escape string for CSV
 */
function escapeCSV(value) {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Escape string for XML
 */
function escapeXML(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Format baseline value for display
 */
function formatBaselineValue(value) {
    if (!value) return '';

    if (value.mean != null && value.sd != null) {
        return `${value.mean} ± ${value.sd}`;
    }
    if (value.median != null && value.q1 != null && value.q3 != null) {
        return `${value.median} (${value.q1}-${value.q3})`;
    }
    if (value.n != null && value.percentage != null) {
        return `${value.n} (${value.percentage}%)`;
    }
    if (value.percentage != null) {
        return `${value.percentage}%`;
    }
    if (value.value != null) {
        return String(value.value);
    }

    return JSON.stringify(value);
}

/**
 * Get baseline value by key
 */
function getBaselineValue(data, key) {
    const char = data.baseline?.characteristics?.find(c => c.key === key);
    if (!char) return null;

    const treatment = char.treatment;
    if (treatment?.mean != null) return treatment.mean;
    if (treatment?.percentage != null) return treatment.percentage;
    return null;
}

/**
 * Generate downloadable file
 * @param {string} content - File content
 * @param {string} filename - Filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * Export and download
 * @param {Object} data - Data to export
 * @param {string} format - Export format
 * @param {string} filename - Base filename
 */
export function exportAndDownload(data, format, filename) {
    let content, mimeType, extension;

    switch (format.toLowerCase()) {
        case 'json':
            content = exportToJSON(data, { pretty: true });
            mimeType = 'application/json';
            extension = 'json';
            break;

        case 'csv':
            content = exportToCSV(data);
            mimeType = 'text/csv';
            extension = 'csv';
            break;

        case 'revman':
            content = exportToRevMan(data);
            mimeType = 'application/xml';
            extension = 'rm5';
            break;

        case 'prisma':
            content = JSON.stringify(exportToPRISMA(data), null, 2);
            mimeType = 'application/json';
            extension = 'prisma.json';
            break;

        default:
            throw new Error(`Unknown export format: ${format}`);
    }

    const fullFilename = filename.includes('.') ? filename : `${filename}.${extension}`;
    downloadFile(content, fullFilename, mimeType);
}

export default {
    exportToJSON,
    exportToCSV,
    exportToRevMan,
    exportToPRISMA,
    toMetaEngineFormat,
    downloadFile,
    exportAndDownload
};
