/**
 * GRADE Evidence Table Exporter
 * Generate GRADE Summary of Findings tables
 */

/**
 * GRADE certainty levels
 */
const GRADE_LEVELS = {
    HIGH: { label: 'High', symbol: '⊕⊕⊕⊕', color: '#22c55e' },
    MODERATE: { label: 'Moderate', symbol: '⊕⊕⊕◯', color: '#84cc16' },
    LOW: { label: 'Low', symbol: '⊕⊕◯◯', color: '#f59e0b' },
    VERY_LOW: { label: 'Very Low', symbol: '⊕◯◯◯', color: '#ef4444' }
};

/**
 * GRADE downgrade reasons
 */
const DOWNGRADE_REASONS = {
    RISK_OF_BIAS: 'Risk of bias',
    INCONSISTENCY: 'Inconsistency',
    INDIRECTNESS: 'Indirectness',
    IMPRECISION: 'Imprecision',
    PUBLICATION_BIAS: 'Publication bias'
};

/**
 * GRADE upgrade reasons (for observational studies)
 */
const UPGRADE_REASONS = {
    LARGE_EFFECT: 'Large effect',
    DOSE_RESPONSE: 'Dose-response gradient',
    CONFOUNDING: 'Residual confounding'
};

/**
 * Calculate GRADE certainty based on assessment
 * @param {Object} assessment - GRADE domain assessments
 * @returns {Object} GRADE certainty result
 */
export function calculateGRADE(assessment) {
    const {
        studyDesign = 'RCT', // 'RCT' or 'observational'
        riskOfBias = 'not serious',
        inconsistency = 'not serious',
        indirectness = 'not serious',
        imprecision = 'not serious',
        publicationBias = 'undetected',
        largeEffect = false,
        doseResponse = false,
        residualConfounding = false
    } = assessment;

    // Start with initial rating
    let rating = studyDesign === 'RCT' ? 4 : 2;
    const downgrades = [];
    const upgrades = [];

    // Downgrade assessments
    if (riskOfBias === 'serious') {
        rating--;
        downgrades.push({ reason: DOWNGRADE_REASONS.RISK_OF_BIAS, severity: 1 });
    } else if (riskOfBias === 'very serious') {
        rating -= 2;
        downgrades.push({ reason: DOWNGRADE_REASONS.RISK_OF_BIAS, severity: 2 });
    }

    if (inconsistency === 'serious') {
        rating--;
        downgrades.push({ reason: DOWNGRADE_REASONS.INCONSISTENCY, severity: 1 });
    } else if (inconsistency === 'very serious') {
        rating -= 2;
        downgrades.push({ reason: DOWNGRADE_REASONS.INCONSISTENCY, severity: 2 });
    }

    if (indirectness === 'serious') {
        rating--;
        downgrades.push({ reason: DOWNGRADE_REASONS.INDIRECTNESS, severity: 1 });
    } else if (indirectness === 'very serious') {
        rating -= 2;
        downgrades.push({ reason: DOWNGRADE_REASONS.INDIRECTNESS, severity: 2 });
    }

    if (imprecision === 'serious') {
        rating--;
        downgrades.push({ reason: DOWNGRADE_REASONS.IMPRECISION, severity: 1 });
    } else if (imprecision === 'very serious') {
        rating -= 2;
        downgrades.push({ reason: DOWNGRADE_REASONS.IMPRECISION, severity: 2 });
    }

    if (publicationBias === 'strongly suspected') {
        rating--;
        downgrades.push({ reason: DOWNGRADE_REASONS.PUBLICATION_BIAS, severity: 1 });
    }

    // Upgrade assessments (mainly for observational)
    if (largeEffect) {
        rating++;
        upgrades.push({ reason: UPGRADE_REASONS.LARGE_EFFECT });
    }

    if (doseResponse) {
        rating++;
        upgrades.push({ reason: UPGRADE_REASONS.DOSE_RESPONSE });
    }

    if (residualConfounding) {
        rating++;
        upgrades.push({ reason: UPGRADE_REASONS.CONFOUNDING });
    }

    // Clamp to valid range
    rating = Math.max(1, Math.min(4, rating));

    const levels = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH'];
    const level = levels[rating - 1];

    return {
        level: level,
        ...GRADE_LEVELS[level],
        rating: rating,
        studyDesign: studyDesign,
        downgrades: downgrades,
        upgrades: upgrades,
        footnotes: generateFootnotes(downgrades, upgrades)
    };
}

/**
 * Generate footnotes explaining GRADE assessment
 */
function generateFootnotes(downgrades, upgrades) {
    const footnotes = [];
    let index = 1;

    for (const d of downgrades) {
        const severity = d.severity === 2 ? 'Downgraded 2 levels' : 'Downgraded 1 level';
        footnotes.push({
            index: index++,
            text: `${severity} for ${d.reason.toLowerCase()}`
        });
    }

    for (const u of upgrades) {
        footnotes.push({
            index: index++,
            text: `Upgraded 1 level for ${u.reason.toLowerCase()}`
        });
    }

    return footnotes;
}

/**
 * Generate GRADE Summary of Findings table
 * @param {Object[]} outcomes - Array of outcome data
 * @param {Object} options - Table options
 * @returns {Object} Table data and HTML
 */
export function generateGRADETable(outcomes, options = {}) {
    const {
        title = 'Summary of Findings',
        population = '',
        intervention = '',
        comparison = '',
        baselineRisk = null
    } = options;

    const rows = outcomes.map(outcome => {
        const grade = calculateGRADE(outcome.assessment || {});

        // Calculate absolute effects if baseline provided
        let absoluteEffect = null;
        if (baselineRisk && outcome.effect) {
            if (outcome.effectType === 'RR' || outcome.effectType === 'OR') {
                const riskWith = baselineRisk * outcome.effect;
                const difference = riskWith - baselineRisk;
                absoluteEffect = {
                    baseline: `${(baselineRisk * 1000).toFixed(0)} per 1,000`,
                    withIntervention: `${(riskWith * 1000).toFixed(0)} per 1,000`,
                    difference: `${difference > 0 ? '+' : ''}${(difference * 1000).toFixed(0)} per 1,000`
                };
            }
        }

        return {
            outcome: outcome.name,
            nStudies: outcome.nStudies,
            nParticipants: outcome.nParticipants,
            relativeEffect: formatRelativeEffect(outcome),
            absoluteEffect: absoluteEffect,
            certainty: grade,
            comments: outcome.comments || ''
        };
    });

    return {
        title,
        population,
        intervention,
        comparison,
        rows,
        html: generateTableHTML(rows, options),
        csv: generateTableCSV(rows)
    };
}

/**
 * Format relative effect for display
 */
function formatRelativeEffect(outcome) {
    if (!outcome.effect) return 'Not estimable';

    const effect = outcome.effect.toFixed(2);
    const ciLower = outcome.ciLower?.toFixed(2) || '?';
    const ciUpper = outcome.ciUpper?.toFixed(2) || '?';
    const type = outcome.effectType || 'Effect';

    return `${type} ${effect} (95% CI ${ciLower} to ${ciUpper})`;
}

/**
 * Generate HTML table
 */
function generateTableHTML(rows, options) {
    const { title, population, intervention, comparison } = options;

    let html = `
    <div class="grade-table-container">
        <h3 class="grade-title">${title}</h3>
        <div class="grade-header">
            <p><strong>Population:</strong> ${population}</p>
            <p><strong>Intervention:</strong> ${intervention}</p>
            <p><strong>Comparison:</strong> ${comparison}</p>
        </div>
        <table class="grade-table">
            <thead>
                <tr>
                    <th>Outcome</th>
                    <th>Studies (n)</th>
                    <th>Relative Effect (95% CI)</th>
                    <th>Anticipated Absolute Effects</th>
                    <th>Certainty</th>
                    <th>Comments</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const row of rows) {
        const absoluteCell = row.absoluteEffect
            ? `<div class="absolute-effect">
                <div>Without: ${row.absoluteEffect.baseline}</div>
                <div>With: ${row.absoluteEffect.withIntervention}</div>
                <div class="difference">${row.absoluteEffect.difference}</div>
               </div>`
            : '—';

        const footnoteRefs = row.certainty.footnotes
            .map(f => `<sup>${f.index}</sup>`)
            .join('');

        html += `
            <tr>
                <td class="outcome-name">${row.outcome}</td>
                <td class="n-studies">${row.nStudies} (${row.nParticipants})</td>
                <td class="relative-effect">${row.relativeEffect}</td>
                <td class="absolute-effect">${absoluteCell}</td>
                <td class="certainty">
                    <span class="grade-symbol" style="color: ${row.certainty.color}">
                        ${row.certainty.symbol}
                    </span>
                    <br>
                    <span class="grade-label">${row.certainty.label}</span>
                    ${footnoteRefs}
                </td>
                <td class="comments">${row.comments}</td>
            </tr>
        `;
    }

    html += `
            </tbody>
        </table>
    `;

    // Add footnotes
    const allFootnotes = rows.flatMap(r => r.certainty.footnotes);
    if (allFootnotes.length > 0) {
        html += `<div class="grade-footnotes"><p><strong>Explanations:</strong></p><ul>`;
        const uniqueFootnotes = [...new Map(allFootnotes.map(f => [f.index, f])).values()];
        for (const fn of uniqueFootnotes) {
            html += `<li><sup>${fn.index}</sup> ${fn.text}</li>`;
        }
        html += `</ul></div>`;
    }

    html += `
        <div class="grade-legend">
            <p><strong>GRADE certainty ratings:</strong></p>
            <ul>
                <li><span style="color: ${GRADE_LEVELS.HIGH.color}">${GRADE_LEVELS.HIGH.symbol}</span> High</li>
                <li><span style="color: ${GRADE_LEVELS.MODERATE.color}">${GRADE_LEVELS.MODERATE.symbol}</span> Moderate</li>
                <li><span style="color: ${GRADE_LEVELS.LOW.color}">${GRADE_LEVELS.LOW.symbol}</span> Low</li>
                <li><span style="color: ${GRADE_LEVELS.VERY_LOW.color}">${GRADE_LEVELS.VERY_LOW.symbol}</span> Very Low</li>
            </ul>
        </div>
    </div>
    `;

    return html;
}

/**
 * Generate CSV export
 */
function generateTableCSV(rows) {
    const headers = [
        'Outcome',
        'Number of Studies',
        'Number of Participants',
        'Relative Effect',
        'Certainty Level',
        'Certainty Symbol',
        'Comments'
    ];

    let csv = headers.join(',') + '\n';

    for (const row of rows) {
        const values = [
            `"${row.outcome}"`,
            row.nStudies,
            row.nParticipants,
            `"${row.relativeEffect}"`,
            row.certainty.label,
            `"${row.certainty.symbol}"`,
            `"${row.comments}"`
        ];
        csv += values.join(',') + '\n';
    }

    return csv;
}

/**
 * Generate GRADE assessment form data
 */
export function getGRADEAssessmentTemplate() {
    return {
        studyDesign: {
            label: 'Study Design',
            options: ['RCT', 'observational'],
            default: 'RCT'
        },
        riskOfBias: {
            label: 'Risk of Bias',
            options: ['not serious', 'serious', 'very serious'],
            default: 'not serious'
        },
        inconsistency: {
            label: 'Inconsistency',
            options: ['not serious', 'serious', 'very serious'],
            default: 'not serious',
            help: 'Based on I², prediction intervals, and visual inspection'
        },
        indirectness: {
            label: 'Indirectness',
            options: ['not serious', 'serious', 'very serious'],
            default: 'not serious',
            help: 'Differences in population, intervention, comparator, or outcomes'
        },
        imprecision: {
            label: 'Imprecision',
            options: ['not serious', 'serious', 'very serious'],
            default: 'not serious',
            help: 'Wide CI crossing clinically important thresholds'
        },
        publicationBias: {
            label: 'Publication Bias',
            options: ['undetected', 'strongly suspected'],
            default: 'undetected',
            help: 'Based on funnel plot, Egger test, and study characteristics'
        },
        largeEffect: {
            label: 'Large Effect',
            type: 'boolean',
            default: false,
            help: 'RR > 2 or < 0.5 from observational studies'
        },
        doseResponse: {
            label: 'Dose-Response',
            type: 'boolean',
            default: false
        },
        residualConfounding: {
            label: 'All Confounding Would Reduce Effect',
            type: 'boolean',
            default: false
        }
    };
}

/**
 * Add GRADE table styles
 */
export function addGRADEStyles() {
    if (document.getElementById('grade-styles')) return;

    const style = document.createElement('style');
    style.id = 'grade-styles';
    style.textContent = `
        .grade-table-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 20px auto;
        }

        .grade-title {
            margin: 0 0 10px 0;
            font-size: 1.25rem;
        }

        .grade-header {
            margin-bottom: 15px;
            padding: 10px;
            background: var(--bg-secondary, #f5f5f5);
            border-radius: 6px;
        }

        .grade-header p {
            margin: 4px 0;
        }

        .grade-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
        }

        .grade-table th,
        .grade-table td {
            padding: 10px 12px;
            border: 1px solid var(--border-color, #e0e0e0);
            text-align: left;
            vertical-align: top;
        }

        .grade-table th {
            background: var(--bg-tertiary, #e8e8e8);
            font-weight: 600;
        }

        .grade-table .outcome-name {
            font-weight: 500;
        }

        .grade-table .certainty {
            text-align: center;
        }

        .grade-symbol {
            font-size: 1.25rem;
            letter-spacing: -2px;
        }

        .grade-label {
            font-size: 0.75rem;
            display: block;
            margin-top: 4px;
        }

        .absolute-effect .difference {
            font-weight: 600;
            color: var(--accent-primary, #2563eb);
        }

        .grade-footnotes {
            margin-top: 15px;
            font-size: 0.8rem;
            color: var(--text-secondary, #666);
        }

        .grade-footnotes ul {
            margin: 5px 0;
            padding-left: 20px;
        }

        .grade-legend {
            margin-top: 15px;
            font-size: 0.8rem;
        }

        .grade-legend ul {
            list-style: none;
            padding: 0;
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        .grade-legend li {
            display: flex;
            align-items: center;
            gap: 6px;
        }
    `;

    document.head.appendChild(style);
}

export default {
    calculateGRADE,
    generateGRADETable,
    getGRADEAssessmentTemplate,
    addGRADEStyles,
    GRADE_LEVELS,
    DOWNGRADE_REASONS,
    UPGRADE_REASONS
};
