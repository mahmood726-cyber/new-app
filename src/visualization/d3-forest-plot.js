/**
 * D3.js Forest Plot
 * Interactive forest plot visualization
 */

import * as d3 from 'd3';

const defaultConfig = {
    width: 800,
    height: null, // Auto-calculated based on studies
    margin: { top: 40, right: 150, bottom: 50, left: 250 },
    rowHeight: 28,
    effectColumn: 'yi',
    ciLowerColumn: 'ci_lower',
    ciUpperColumn: 'ci_upper',
    studyColumn: 'study',
    weightColumn: 'weight',
    nullEffect: 0,
    effectLabel: 'Effect Size',
    showWeights: true,
    showPooled: true,
    animate: true,
    colors: {
        study: 'var(--accent-primary, #2563eb)',
        pooled: '#16a34a',
        null: '#9ca3af',
        ci: 'currentColor',
        diamond: '#16a34a'
    }
};

/**
 * Create an interactive forest plot
 * @param {HTMLElement} container - Container element
 * @param {Object[]} studies - Study data
 * @param {Object} pooled - Pooled effect estimate
 * @param {Object} options - Configuration options
 */
export function createForestPlot(container, studies, pooled = null, options = {}) {
    const config = { ...defaultConfig, ...options };

    // Clear container
    d3.select(container).selectAll('*').remove();

    // Calculate dimensions
    const nStudies = studies.length;
    const nRows = nStudies + (pooled ? 2 : 0);
    const height = config.height || (nRows * config.rowHeight + config.margin.top + config.margin.bottom);
    const width = config.width;
    const innerWidth = width - config.margin.left - config.margin.right;
    const innerHeight = height - config.margin.top - config.margin.bottom;

    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('class', 'forest-plot')
        .attr('role', 'img')
        .attr('aria-label', 'Forest plot showing effect sizes and confidence intervals');

    // Add defs for gradients/patterns
    const defs = svg.append('defs');

    // Diamond pattern for pooled
    defs.append('pattern')
        .attr('id', 'diamond-pattern')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 4)
        .attr('height', 4)
        .append('path')
        .attr('d', 'M0,2 L2,0 L4,2 L2,4 Z')
        .attr('fill', config.colors.diamond);

    // Main group
    const g = svg.append('g')
        .attr('transform', `translate(${config.margin.left}, ${config.margin.top})`);

    // Calculate scales
    const allEffects = studies.map(s => [
        s[config.effectColumn],
        s[config.ciLowerColumn],
        s[config.ciUpperColumn]
    ]).flat().filter(v => isFinite(v));

    if (pooled) {
        allEffects.push(pooled.effect, pooled.ci_lower, pooled.ci_upper);
    }

    const effectExtent = d3.extent(allEffects);
    const padding = (effectExtent[1] - effectExtent[0]) * 0.1;

    const xScale = d3.scaleLinear()
        .domain([effectExtent[0] - padding, effectExtent[1] + padding])
        .range([0, innerWidth])
        .nice();

    const yScale = d3.scaleBand()
        .domain(studies.map(s => s[config.studyColumn]))
        .range([0, nStudies * config.rowHeight])
        .padding(0.3);

    // X-axis
    const xAxis = g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(7).tickFormat(d3.format('.2f')));

    xAxis.append('text')
        .attr('class', 'axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', 35)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'middle')
        .text(config.effectLabel);

    // Null effect line
    const nullLine = xScale(config.nullEffect);
    g.append('line')
        .attr('class', 'null-line')
        .attr('x1', nullLine)
        .attr('x2', nullLine)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', config.colors.null)
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1);

    // Study rows
    const studyGroups = g.selectAll('.study-row')
        .data(studies)
        .enter()
        .append('g')
        .attr('class', 'study-row')
        .attr('transform', (d, i) => `translate(0, ${yScale(d[config.studyColumn]) + yScale.bandwidth() / 2})`);

    // Study labels (left side)
    studyGroups.append('text')
        .attr('class', 'study-label')
        .attr('x', -10)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'currentColor')
        .text(d => d[config.studyColumn]);

    // Confidence interval lines
    studyGroups.append('line')
        .attr('class', 'ci-line')
        .attr('x1', d => config.animate ? xScale(config.nullEffect) : xScale(d[config.ciLowerColumn]))
        .attr('x2', d => config.animate ? xScale(config.nullEffect) : xScale(d[config.ciUpperColumn]))
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke', config.colors.ci)
        .attr('stroke-width', 1.5)
        .transition()
        .duration(config.animate ? 500 : 0)
        .delay((d, i) => config.animate ? i * 50 : 0)
        .attr('x1', d => xScale(d[config.ciLowerColumn]))
        .attr('x2', d => xScale(d[config.ciUpperColumn]));

    // CI whiskers
    studyGroups.each(function(d) {
        const group = d3.select(this);
        const ciLower = xScale(d[config.ciLowerColumn]);
        const ciUpper = xScale(d[config.ciUpperColumn]);

        // Lower whisker
        group.append('line')
            .attr('class', 'whisker')
            .attr('x1', ciLower)
            .attr('x2', ciLower)
            .attr('y1', -4)
            .attr('y2', 4)
            .attr('stroke', config.colors.ci)
            .attr('stroke-width', 1.5);

        // Upper whisker
        group.append('line')
            .attr('class', 'whisker')
            .attr('x1', ciUpper)
            .attr('x2', ciUpper)
            .attr('y1', -4)
            .attr('y2', 4)
            .attr('stroke', config.colors.ci)
            .attr('stroke-width', 1.5);
    });

    // Effect size squares (sized by weight)
    const maxWeight = d3.max(studies, d => d[config.weightColumn] || 1);
    const sizeScale = d3.scaleSqrt()
        .domain([0, maxWeight])
        .range([4, 12]);

    studyGroups.append('rect')
        .attr('class', 'effect-point')
        .attr('x', d => {
            const size = sizeScale(d[config.weightColumn] || 1);
            return config.animate ? xScale(config.nullEffect) - size / 2 : xScale(d[config.effectColumn]) - size / 2;
        })
        .attr('y', d => -sizeScale(d[config.weightColumn] || 1) / 2)
        .attr('width', d => sizeScale(d[config.weightColumn] || 1))
        .attr('height', d => sizeScale(d[config.weightColumn] || 1))
        .attr('fill', config.colors.study)
        .style('cursor', 'pointer')
        .transition()
        .duration(config.animate ? 500 : 0)
        .delay((d, i) => config.animate ? i * 50 : 0)
        .attr('x', d => xScale(d[config.effectColumn]) - sizeScale(d[config.weightColumn] || 1) / 2);

    // Effect size text (right side)
    if (config.showWeights) {
        studyGroups.append('text')
            .attr('class', 'effect-text')
            .attr('x', innerWidth + 10)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'currentColor')
            .attr('font-size', '11px')
            .text(d => {
                const effect = d[config.effectColumn].toFixed(2);
                const ci = `[${d[config.ciLowerColumn].toFixed(2)}, ${d[config.ciUpperColumn].toFixed(2)}]`;
                return `${effect} ${ci}`;
            });
    }

    // Pooled effect (diamond)
    if (pooled && config.showPooled) {
        const pooledY = nStudies * config.rowHeight + config.rowHeight;

        // Separator line
        g.append('line')
            .attr('class', 'separator')
            .attr('x1', -config.margin.left + 10)
            .attr('x2', innerWidth + config.margin.right - 10)
            .attr('y1', pooledY - config.rowHeight / 2)
            .attr('y2', pooledY - config.rowHeight / 2)
            .attr('stroke', 'var(--border-color, #e0e0e0)')
            .attr('stroke-width', 1);

        // Pooled label
        g.append('text')
            .attr('class', 'pooled-label')
            .attr('x', -10)
            .attr('y', pooledY)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'currentColor')
            .attr('font-weight', 'bold')
            .text('Pooled Effect');

        // Diamond for pooled
        const diamondWidth = xScale(pooled.ci_upper) - xScale(pooled.ci_lower);
        const diamondHeight = 12;
        const diamondX = xScale(pooled.effect);

        const diamond = g.append('polygon')
            .attr('class', 'pooled-diamond')
            .attr('points', config.animate ?
                `${diamondX},${pooledY - diamondHeight / 2} ${diamondX},${pooledY + diamondHeight / 2} ${diamondX},${pooledY + diamondHeight / 2} ${diamondX},${pooledY - diamondHeight / 2}` :
                `${xScale(pooled.ci_lower)},${pooledY} ${diamondX},${pooledY - diamondHeight / 2} ${xScale(pooled.ci_upper)},${pooledY} ${diamondX},${pooledY + diamondHeight / 2}`
            )
            .attr('fill', config.colors.diamond)
            .transition()
            .duration(config.animate ? 700 : 0)
            .delay(config.animate ? nStudies * 50 + 200 : 0)
            .attr('points', `${xScale(pooled.ci_lower)},${pooledY} ${diamondX},${pooledY - diamondHeight / 2} ${xScale(pooled.ci_upper)},${pooledY} ${diamondX},${pooledY + diamondHeight / 2}`);

        // Pooled effect text
        g.append('text')
            .attr('class', 'pooled-text')
            .attr('x', innerWidth + 10)
            .attr('y', pooledY)
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'currentColor')
            .attr('font-weight', 'bold')
            .attr('font-size', '11px')
            .text(`${pooled.effect.toFixed(2)} [${pooled.ci_lower.toFixed(2)}, ${pooled.ci_upper.toFixed(2)}]`);
    }

    // Add tooltips
    addTooltips(studyGroups, config);

    // Add interactivity
    addInteractivity(svg, studyGroups, config);

    return svg.node();
}

/**
 * Add tooltips to study points
 */
function addTooltips(studyGroups, config) {
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'forest-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'var(--bg-secondary, #f5f5f5)')
        .style('border', '1px solid var(--border-color, #e0e0e0)')
        .style('border-radius', '4px')
        .style('padding', '8px 12px')
        .style('font-size', '12px')
        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.15)')
        .style('pointer-events', 'none')
        .style('z-index', '10000');

    studyGroups.select('.effect-point')
        .on('mouseover', function(event, d) {
            const weight = d[config.weightColumn] ? `${d[config.weightColumn].toFixed(1)}%` : 'N/A';
            tooltip
                .style('visibility', 'visible')
                .html(`
                    <strong>${d[config.studyColumn]}</strong><br/>
                    Effect: ${d[config.effectColumn].toFixed(3)}<br/>
                    95% CI: [${d[config.ciLowerColumn].toFixed(3)}, ${d[config.ciUpperColumn].toFixed(3)}]<br/>
                    Weight: ${weight}
                `);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('top', (event.pageY - 10) + 'px')
                .style('left', (event.pageX + 10) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
        });
}

/**
 * Add interactivity (hover effects, click handlers)
 */
function addInteractivity(svg, studyGroups, config) {
    studyGroups
        .on('mouseenter', function() {
            d3.select(this).select('.effect-point')
                .transition()
                .duration(150)
                .attr('fill-opacity', 0.8)
                .attr('transform', 'scale(1.2)');
        })
        .on('mouseleave', function() {
            d3.select(this).select('.effect-point')
                .transition()
                .duration(150)
                .attr('fill-opacity', 1)
                .attr('transform', 'scale(1)');
        })
        .on('click', function(event, d) {
            // Dispatch custom event for study selection
            svg.node().dispatchEvent(new CustomEvent('studyclick', {
                detail: d,
                bubbles: true
            }));
        });
}

/**
 * Update forest plot with new data
 */
export function updateForestPlot(container, studies, pooled, options = {}) {
    // Simply recreate the plot for now
    // Could implement transitions for data updates
    return createForestPlot(container, studies, pooled, { ...options, animate: true });
}

/**
 * Export forest plot as SVG
 */
export function exportForestPlotSVG(container) {
    const svg = container.querySelector('svg');
    if (!svg) return null;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    // Add namespace
    if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
        source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return source;
}

/**
 * Export forest plot as PNG
 */
export async function exportForestPlotPNG(container, scale = 2) {
    const svgSource = exportForestPlotSVG(container);
    if (!svgSource) return null;

    const svg = container.querySelector('svg');
    const width = svg.getAttribute('width') * scale;
    const height = svg.getAttribute('height') * scale;

    return new Promise((resolve) => {
        const img = new Image();
        const blob = new Blob([svgSource], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };

        img.src = url;
    });
}

export default {
    createForestPlot,
    updateForestPlot,
    exportForestPlotSVG,
    exportForestPlotPNG
};
