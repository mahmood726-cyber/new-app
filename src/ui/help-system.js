/**
 * In-App Help System
 * Contextual tooltips, guided tours, and documentation
 */

// Help content database
const helpContent = {
    // Statistical concepts
    heterogeneity: {
        title: 'Heterogeneity',
        content: `Heterogeneity refers to variability in study results beyond what would be expected by chance alone.`,
        details: `
            <p><strong>I² (I-squared)</strong>: Percentage of variability due to heterogeneity</p>
            <ul>
                <li>0-25%: Low heterogeneity</li>
                <li>25-50%: Moderate heterogeneity</li>
                <li>50-75%: Substantial heterogeneity</li>
                <li>>75%: Considerable heterogeneity</li>
            </ul>
            <p><strong>τ² (tau-squared)</strong>: Between-study variance in the true effect sizes</p>
            <p><strong>Q statistic</strong>: Test for whether true effect sizes vary across studies</p>
        `,
        links: [
            { text: 'Higgins & Thompson (2002)', url: 'https://doi.org/10.1002/sim.1186' }
        ]
    },

    randomEffects: {
        title: 'Random Effects Model',
        content: `Assumes that studies are estimating different but related effects, drawn from a distribution of true effects.`,
        details: `
            <p>Use random effects when:</p>
            <ul>
                <li>Studies differ in populations, interventions, or settings</li>
                <li>You want to generalize beyond the included studies</li>
                <li>Heterogeneity is expected or observed (I² > 0)</li>
            </ul>
            <p><strong>Estimation methods:</strong></p>
            <ul>
                <li><strong>DL (DerSimonian-Laird)</strong>: Simple, widely used</li>
                <li><strong>REML</strong>: More accurate, especially for small samples</li>
                <li><strong>PM (Paule-Mandel)</strong>: Iterative method</li>
            </ul>
        `
    },

    hksj: {
        title: 'HKSJ Adjustment',
        content: `The Hartung-Knapp-Sidik-Jonkman adjustment provides more conservative confidence intervals.`,
        details: `
            <p>Standard random effects models often produce CI that are too narrow when:</p>
            <ul>
                <li>Number of studies is small (k < 10)</li>
                <li>Heterogeneity is present</li>
            </ul>
            <p>HKSJ adjustment uses a t-distribution instead of normal distribution, typically producing wider and more accurate CIs.</p>
            <p><strong>Recommendation:</strong> Always use HKSJ unless you have specific reasons not to.</p>
        `,
        links: [
            { text: 'IntHout et al. (2014)', url: 'https://doi.org/10.1186/1471-2288-14-25' }
        ]
    },

    eggerTest: {
        title: "Egger's Test",
        content: `Tests for small-study effects that may indicate publication bias.`,
        details: `
            <p>The test regresses standardized effects against their precision.</p>
            <ul>
                <li>p < 0.10: Evidence of asymmetry (potential bias)</li>
                <li>Requires at least 10 studies for adequate power</li>
                <li>Can be falsely positive with genuine heterogeneity</li>
            </ul>
            <p><strong>Interpretation:</strong> A significant result suggests asymmetry in the funnel plot, but not necessarily publication bias.</p>
        `,
        links: [
            { text: 'Egger et al. (1997)', url: 'https://doi.org/10.1136/bmj.315.7109.629' }
        ]
    },

    trimAndFill: {
        title: 'Trim and Fill',
        content: `Estimates the number of missing studies and provides an adjusted pooled estimate.`,
        details: `
            <p>The method:</p>
            <ol>
                <li>Identifies asymmetry in funnel plot</li>
                <li>Estimates number of "missing" studies</li>
                <li>Imputes these studies symmetrically</li>
                <li>Recalculates pooled effect</li>
            </ol>
            <p><strong>Limitations:</strong></p>
            <ul>
                <li>Assumes missing studies are symmetrically distributed</li>
                <li>May overcorrect if asymmetry isn't due to publication bias</li>
            </ul>
        `
    },

    predictionInterval: {
        title: 'Prediction Interval',
        content: `Estimates the range within which the true effect of a future study is expected to fall.`,
        details: `
            <p>Unlike confidence intervals (which describe uncertainty about the mean effect), prediction intervals account for both:</p>
            <ul>
                <li>Uncertainty in the pooled estimate</li>
                <li>Between-study heterogeneity (τ²)</li>
            </ul>
            <p>If the prediction interval includes the null effect, a new study in a different setting might show no effect or even harm.</p>
        `,
        links: [
            { text: 'IntHout et al. (2016)', url: 'https://doi.org/10.1136/bmjopen-2015-010247' }
        ]
    },

    nma: {
        title: 'Network Meta-Analysis',
        content: `Compares multiple treatments simultaneously using both direct and indirect evidence.`,
        details: `
            <p><strong>Key concepts:</strong></p>
            <ul>
                <li><strong>Direct evidence:</strong> From studies comparing treatments head-to-head</li>
                <li><strong>Indirect evidence:</strong> Inferred through common comparator</li>
                <li><strong>Consistency:</strong> Agreement between direct and indirect evidence</li>
            </ul>
            <p><strong>SUCRA (Surface Under Cumulative Ranking):</strong></p>
            <p>Probability that a treatment is the best, summarized as a percentage (0-100%). Higher is better for beneficial outcomes.</p>
        `,
        links: [
            { text: 'Rücker & Schwarzer (2015)', url: 'https://doi.org/10.1002/jrsm.1058' }
        ]
    },

    effectSize: {
        title: 'Effect Size Types',
        content: `Different effect measures are appropriate for different types of outcomes.`,
        details: `
            <p><strong>Ratio measures (multiplicative scale):</strong></p>
            <ul>
                <li><strong>OR (Odds Ratio):</strong> Odds of event in treatment vs control</li>
                <li><strong>RR (Risk Ratio):</strong> Probability of event in treatment vs control</li>
                <li><strong>HR (Hazard Ratio):</strong> Instantaneous risk ratio for time-to-event data</li>
            </ul>
            <p><strong>Difference measures (additive scale):</strong></p>
            <ul>
                <li><strong>MD (Mean Difference):</strong> For continuous outcomes on same scale</li>
                <li><strong>SMD (Standardized Mean Difference):</strong> For different scales, in SD units</li>
            </ul>
        `
    },

    forestPlot: {
        title: 'Forest Plot',
        content: `Visual display of individual study results and the pooled estimate.`,
        details: `
            <p><strong>Elements:</strong></p>
            <ul>
                <li><strong>Squares:</strong> Individual study effects (size = study weight)</li>
                <li><strong>Horizontal lines:</strong> 95% confidence intervals</li>
                <li><strong>Diamond:</strong> Pooled effect (width = CI)</li>
                <li><strong>Vertical line:</strong> Null effect (no difference)</li>
            </ul>
            <p>If a study's CI crosses the null line, that study's result is not statistically significant.</p>
        `
    },

    funnelPlot: {
        title: 'Funnel Plot',
        content: `Scatterplot of effect sizes against precision to assess publication bias.`,
        details: `
            <p><strong>Ideal (no bias):</strong> Symmetric funnel shape centered on pooled effect</p>
            <p><strong>Possible bias indicators:</strong></p>
            <ul>
                <li>Asymmetry (missing studies on one side)</li>
                <li>Gap in bottom corner (missing small negative studies)</li>
            </ul>
            <p><strong>Alternative explanations for asymmetry:</strong></p>
            <ul>
                <li>True heterogeneity</li>
                <li>Poor methodological quality in small studies</li>
                <li>Chance</li>
            </ul>
        `
    }
};

// Tooltip state
let activeTooltip = null;

/**
 * Initialize help system
 */
export function initHelpSystem() {
    // Add global styles
    addHelpStyles();

    // Initialize help icons
    document.querySelectorAll('[data-help]').forEach(element => {
        addHelpIcon(element);
    });

    // Close tooltip on outside click
    document.addEventListener('click', (e) => {
        if (activeTooltip && !activeTooltip.contains(e.target) &&
            !e.target.closest('.help-icon')) {
            hideTooltip();
        }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeTooltip) {
            hideTooltip();
        }
    });
}

/**
 * Add help icon to an element
 */
function addHelpIcon(element) {
    const helpKey = element.dataset.help;
    if (!helpContent[helpKey]) return;

    const icon = document.createElement('span');
    icon.className = 'help-icon';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', 'Help');
    icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;

    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        showTooltip(helpKey, icon);
    });

    icon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showTooltip(helpKey, icon);
        }
    });

    element.appendChild(icon);
}

/**
 * Show tooltip for a help topic
 */
function showTooltip(helpKey, anchor) {
    hideTooltip();

    const content = helpContent[helpKey];
    if (!content) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'help-tooltip';
    tooltip.setAttribute('role', 'tooltip');

    let linksHtml = '';
    if (content.links?.length) {
        linksHtml = `<div class="help-links">
            <strong>References:</strong>
            ${content.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener">${l.text}</a>`).join(', ')}
        </div>`;
    }

    tooltip.innerHTML = `
        <div class="help-tooltip-header">
            <h4>${content.title}</h4>
            <button class="help-close" aria-label="Close">&times;</button>
        </div>
        <div class="help-tooltip-body">
            <p class="help-summary">${content.content}</p>
            ${content.details ? `<div class="help-details">${content.details}</div>` : ''}
            ${linksHtml}
        </div>
    `;

    // Position tooltip
    document.body.appendChild(tooltip);
    positionTooltip(tooltip, anchor);

    // Add close handler
    tooltip.querySelector('.help-close').addEventListener('click', hideTooltip);

    // Focus for accessibility
    tooltip.focus();

    activeTooltip = tooltip;
}

/**
 * Position tooltip near anchor
 */
function positionTooltip(tooltip, anchor) {
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let top = anchorRect.bottom + 8;
    let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;

    // Keep within viewport
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
    }

    if (top + tooltipRect.height > window.innerHeight - 10) {
        top = anchorRect.top - tooltipRect.height - 8;
    }

    tooltip.style.top = `${top + window.scrollY}px`;
    tooltip.style.left = `${left + window.scrollX}px`;
}

/**
 * Hide active tooltip
 */
function hideTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

/**
 * Get help content for a topic
 */
export function getHelpContent(topic) {
    return helpContent[topic] || null;
}

/**
 * Register custom help content
 */
export function registerHelpContent(key, content) {
    helpContent[key] = content;
}

/**
 * Show full help modal
 */
export function showHelpModal() {
    const existing = document.getElementById('help-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'help-modal';
    modal.className = 'help-modal';

    const categories = {
        'Statistical Methods': ['randomEffects', 'hksj', 'nma', 'effectSize'],
        'Heterogeneity': ['heterogeneity', 'predictionInterval'],
        'Publication Bias': ['eggerTest', 'trimAndFill', 'funnelPlot'],
        'Visualizations': ['forestPlot', 'funnelPlot']
    };

    let tabsHtml = '';
    let contentHtml = '';

    Object.entries(categories).forEach(([category, topics], index) => {
        const activeClass = index === 0 ? 'active' : '';
        tabsHtml += `<button class="help-tab ${activeClass}" data-category="${category}">${category}</button>`;

        contentHtml += `<div class="help-tab-content ${activeClass}" data-category="${category}">`;
        for (const topic of topics) {
            const content = helpContent[topic];
            if (content) {
                contentHtml += `
                    <div class="help-section">
                        <h3>${content.title}</h3>
                        <p>${content.content}</p>
                        ${content.details || ''}
                    </div>
                `;
            }
        }
        contentHtml += '</div>';
    });

    modal.innerHTML = `
        <div class="help-modal-content">
            <div class="help-modal-header">
                <h2>Meta-Analysis Help</h2>
                <button class="help-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="help-tabs">${tabsHtml}</div>
            <div class="help-modal-body">${contentHtml}</div>
        </div>
    `;

    addHelpModalStyles();

    // Tab switching
    modal.querySelectorAll('.help-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;
            modal.querySelectorAll('.help-tab, .help-tab-content').forEach(el => {
                el.classList.toggle('active', el.dataset.category === category);
            });
        });
    });

    // Close handlers
    modal.querySelector('.help-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

/**
 * Add CSS styles for help system
 */
function addHelpStyles() {
    if (document.getElementById('help-styles')) return;

    const style = document.createElement('style');
    style.id = 'help-styles';
    style.textContent = `
        .help-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            margin-left: 4px;
            cursor: pointer;
            color: var(--text-muted, #999);
            vertical-align: middle;
            transition: color 0.2s;
        }

        .help-icon:hover,
        .help-icon:focus {
            color: var(--accent-primary, #2563eb);
            outline: none;
        }

        .help-tooltip {
            position: absolute;
            z-index: 10000;
            max-width: 400px;
            background: var(--bg-primary, #fff);
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            animation: helpFadeIn 0.2s ease;
        }

        @keyframes helpFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .help-tooltip-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .help-tooltip-header h4 {
            margin: 0;
            font-size: 14px;
            color: var(--text-primary, #333);
        }

        .help-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: var(--text-muted, #999);
            padding: 0;
            line-height: 1;
        }

        .help-tooltip-body {
            padding: 12px 14px;
            font-size: 13px;
            line-height: 1.5;
            color: var(--text-secondary, #666);
        }

        .help-summary {
            margin: 0 0 10px 0;
            font-weight: 500;
            color: var(--text-primary, #333);
        }

        .help-details {
            margin-top: 10px;
        }

        .help-details ul,
        .help-details ol {
            margin: 8px 0;
            padding-left: 20px;
        }

        .help-details li {
            margin: 4px 0;
        }

        .help-links {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid var(--border-color, #eee);
            font-size: 12px;
        }

        .help-links a {
            color: var(--accent-primary, #2563eb);
            text-decoration: none;
        }

        .help-links a:hover {
            text-decoration: underline;
        }
    `;

    document.head.appendChild(style);
}

/**
 * Add modal styles
 */
function addHelpModalStyles() {
    if (document.getElementById('help-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'help-modal-styles';
    style.textContent = `
        .help-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }

        .help-modal-content {
            background: var(--bg-primary, #fff);
            border-radius: 12px;
            max-width: 700px;
            width: 90%;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .help-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .help-modal-header h2 {
            margin: 0;
            font-size: 1.25rem;
        }

        .help-modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-muted, #999);
        }

        .help-tabs {
            display: flex;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
            padding: 0 20px;
        }

        .help-tab {
            background: none;
            border: none;
            padding: 12px 16px;
            cursor: pointer;
            font-size: 14px;
            color: var(--text-secondary, #666);
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
        }

        .help-tab.active {
            color: var(--accent-primary, #2563eb);
            border-bottom-color: var(--accent-primary, #2563eb);
        }

        .help-modal-body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }

        .help-tab-content {
            display: none;
        }

        .help-tab-content.active {
            display: block;
        }

        .help-section {
            margin-bottom: 24px;
        }

        .help-section h3 {
            margin: 0 0 8px 0;
            font-size: 16px;
            color: var(--text-primary, #333);
        }

        .help-section p {
            margin: 0 0 10px 0;
            color: var(--text-secondary, #666);
        }
    `;

    document.head.appendChild(style);
}

export default {
    initHelpSystem,
    getHelpContent,
    registerHelpContent,
    showHelpModal,
    showTooltip,
    hideTooltip
};
