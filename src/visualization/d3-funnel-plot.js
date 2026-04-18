/**
 * D3.js Funnel Plot
 * Interactive funnel plot for publication bias assessment
 */

import * as d3 from 'd3';

const defaultConfig = {
    width: 600,
    height: 500,
    margin: { top: 40, right: 40, bottom: 60, left: 70 },
    effectColumn: 'yi',
    seColumn: 'se',
    studyColumn: 'study',
    pooledEffect: null,
    ciLevels: [0.90, 0.95, 0.99],
    showContours: true,
    showPooledLine: true,
    showNullLine: true,
    nullEffect: 0,
    invertY: true,
    animate: true,
    xLabel: 'Effect Size',
    yLabel: 'Standard Error',
    colors: {
        point: 'var(--accent-primary, #2563eb)',
        pooled: '#16a34a',
        null: '#9ca3af',
        contour90: 'rgba(37, 99, 235, 0.1)',
        contour95: 'rgba(37, 99, 235, 0.05)',
        contour99: 'rgba(37, 99, 235, 0.025)'
    }
};

/**
 * Create an interactive funnel plot
 * @param {HTMLElement} container - Container element
 * @param {Object[]} studies - Study data with effect sizes and standard errors
 * @param {Object} options - Configuration options
 */
export function createFunnelPlot(container, studies, options = {}) {
    const config = { ...defaultConfig, ...options };

    // Clear container
    d3.select(container).selectAll('*').remove();

    const width = config.width;
    const height = config.height;
    const innerWidth = width - config.margin.left - config.margin.right;
    const innerHeight = height - config.margin.top - config.margin.bottom;

    // Create SVG
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('class', 'funnel-plot')
        .attr('role', 'img')
        .attr('aria-label', 'Funnel plot for assessing publication bias');

    // Main group
    const g = svg.append('g')
        .attr('transform', `translate(${config.margin.left}, ${config.margin.top})`);

    // Extract data
    const effects = studies.map(s => s[config.effectColumn]);
    const ses = studies.map(s => s[config.seColumn] || Math.sqrt(s.vi));

    // Calculate pooled effect if not provided
    const pooledEffect = config.pooledEffect ?? d3.mean(effects);

    // Calculate scales
    const effectExtent = d3.extent(effects);
    const seMax = d3.max(ses);
    const padding = (effectExtent[1] - effectExtent[0]) * 0.2;

    // Expand x range to show full contours
    const xRange = Math.max(
        Math.abs(effectExtent[0] - pooledEffect),
        Math.abs(effectExtent[1] - pooledEffect)
    ) + 2 * seMax * 1.96;

    const xScale = d3.scaleLinear()
        .domain([pooledEffect - xRange, pooledEffect + xRange])
        .range([0, innerWidth])
        .nice();

    const yScale = d3.scaleLinear()
        .domain(config.invertY ? [0, seMax * 1.1] : [seMax * 1.1, 0])
        .range([0, innerHeight]);

    // X-axis
    g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(7).tickFormat(d3.format('.2f')))
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', 45)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'middle')
        .text(config.xLabel);

    // Y-axis
    g.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale).ticks(6).tickFormat(d3.format('.3f')))
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -50)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'middle')
        .text(config.yLabel);

    // Draw confidence contours (funnel shape)
    if (config.showContours) {
        drawContours(g, xScale, yScale, pooledEffect, seMax, innerHeight, config);
    }

    // Null effect line
    if (config.showNullLine) {
        const nullX = xScale(config.nullEffect);
        g.append('line')
            .attr('class', 'null-line')
            .attr('x1', nullX)
            .attr('x2', nullX)
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .attr('stroke', config.colors.null)
            .attr('stroke-dasharray', '4,4')
            .attr('stroke-width', 1);
    }

    // Pooled effect line
    if (config.showPooledLine) {
        const pooledX = xScale(pooledEffect);
        g.append('line')
            .attr('class', 'pooled-line')
            .attr('x1', pooledX)
            .attr('x2', pooledX)
            .attr('y1', 0)
            .attr('y2', innerHeight)
            .attr('stroke', config.colors.pooled)
            .attr('stroke-width', 2);
    }

    // Study points
    const points = g.selectAll('.study-point')
        .data(studies)
        .enter()
        .append('circle')
        .attr('class', 'study-point')
        .attr('cx', d => config.animate ? xScale(pooledEffect) : xScale(d[config.effectColumn]))
        .attr('cy', d => config.animate ? yScale(0) : yScale(d[config.seColumn] || Math.sqrt(d.vi)))
        .attr('r', 0)
        .attr('fill', config.colors.point)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .transition()
        .duration(config.animate ? 500 : 0)
        .delay((d, i) => config.animate ? i * 30 : 0)
        .attr('cx', d => xScale(d[config.effectColumn]))
        .attr('cy', d => yScale(d[config.seColumn] || Math.sqrt(d.vi)))
        .attr('r', 6);

    // Add tooltips
    addTooltips(g.selectAll('.study-point'), config);

    // Add interactivity
    addInteractivity(svg, g.selectAll('.study-point'), config);

    // Add legend
    addLegend(g, innerWidth, config);

    return svg.node();
}

/**
 * Draw confidence contours
 */
function drawContours(g, xScale, yScale, pooledEffect, seMax, innerHeight, config) {
    const contourColors = {
        0.90: config.colors.contour90,
        0.95: config.colors.contour95,
        0.99: config.colors.contour99
    };

    const zValues = {
        0.90: 1.645,
        0.95: 1.96,
        0.99: 2.576
    };

    // Draw from widest to narrowest
    for (const level of [...config.ciLevels].sort().reverse()) {
        const z = zValues[level];
        const color = contourColors[level];

        // Calculate funnel boundaries
        const nPoints = 50;
        const leftPoints = [];
        const rightPoints = [];

        for (let i = 0; i <= nPoints; i++) {
            const se = (seMax * 1.1) * i / nPoints;
            const y = yScale(se);
            const leftX = xScale(pooledEffect - z * se);
            const rightX = xScale(pooledEffect + z * se);

            leftPoints.push([leftX, y]);
            rightPoints.push([rightX, y]);
        }

        // Create path
        const topY = yScale(0);
        const centerX = xScale(pooledEffect);

        const pathData = d3.line()(
            [[centerX, topY], ...leftPoints, ...rightPoints.reverse(), [centerX, topY]]
        );

        g.append('path')
            .attr('class', `contour-${Math.round(level * 100)}`)
            .attr('d', pathData)
            .attr('fill', color)
            .attr('stroke', 'none');
    }

    // Add contour lines
    for (const level of config.ciLevels) {
        const z = zValues[level];

        // Left boundary
        g.append('line')
            .attr('class', `contour-line-${Math.round(level * 100)}`)
            .attr('x1', xScale(pooledEffect))
            .attr('y1', yScale(0))
            .attr('x2', xScale(pooledEffect - z * seMax * 1.1))
            .attr('y2', yScale(seMax * 1.1))
            .attr('stroke', 'var(--border-color, #ccc)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', level === 0.95 ? 'none' : '2,2');

        // Right boundary
        g.append('line')
            .attr('class', `contour-line-${Math.round(level * 100)}`)
            .attr('x1', xScale(pooledEffect))
            .attr('y1', yScale(0))
            .attr('x2', xScale(pooledEffect + z * seMax * 1.1))
            .attr('y2', yScale(seMax * 1.1))
            .attr('stroke', 'var(--border-color, #ccc)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', level === 0.95 ? 'none' : '2,2');
    }
}

/**
 * Add legend
 */
function addLegend(g, innerWidth, config) {
    const legend = g.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${innerWidth - 100}, 10)`);

    const items = [
        { label: '95% CI', color: config.colors.contour95 },
        { label: 'Pooled', color: config.colors.pooled },
        { label: 'Null', color: config.colors.null }
    ];

    items.forEach((item, i) => {
        const row = legend.append('g')
            .attr('transform', `translate(0, ${i * 18})`);

        row.append('rect')
            .attr('width', 12)
            .attr('height', 12)
            .attr('fill', item.color)
            .attr('rx', 2);

        row.append('text')
            .attr('x', 18)
            .attr('y', 10)
            .attr('font-size', '11px')
            .attr('fill', 'currentColor')
            .text(item.label);
    });
}

/**
 * Add tooltips to points
 */
function addTooltips(points, config) {
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'funnel-tooltip')
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

    points
        .on('mouseover', function(event, d) {
            const se = d[config.seColumn] || Math.sqrt(d.vi);
            tooltip
                .style('visibility', 'visible')
                .html(`
                    <strong>${d[config.studyColumn]}</strong><br/>
                    Effect: ${d[config.effectColumn].toFixed(3)}<br/>
                    SE: ${se.toFixed(3)}
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
 * Add interactivity
 */
function addInteractivity(svg, points, config) {
    points
        .on('mouseenter', function() {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('r', 8)
                .attr('fill-opacity', 0.8);
        })
        .on('mouseleave', function() {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('r', 6)
                .attr('fill-opacity', 1);
        })
        .on('click', function(event, d) {
            svg.node().dispatchEvent(new CustomEvent('studyclick', {
                detail: d,
                bubbles: true
            }));
        });
}

/**
 * Create contour-enhanced funnel plot
 */
export function createContourFunnelPlot(container, studies, options = {}) {
    return createFunnelPlot(container, studies, {
        ...options,
        showContours: true,
        ciLevels: [0.90, 0.95, 0.99]
    });
}

/**
 * Create precision funnel plot (1/SE on y-axis)
 */
export function createPrecisionFunnelPlot(container, studies, options = {}) {
    const config = { ...defaultConfig, ...options };

    // Transform data to use precision
    const transformedStudies = studies.map(s => ({
        ...s,
        precision: 1 / (s[config.seColumn] || Math.sqrt(s.vi))
    }));

    return createFunnelPlot(container, transformedStudies, {
        ...config,
        seColumn: 'precision',
        yLabel: 'Precision (1/SE)',
        invertY: false
    });
}

/**
 * Export funnel plot as SVG
 */
export function exportFunnelPlotSVG(container) {
    const svg = container.querySelector('svg');
    if (!svg) return null;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
        source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    return source;
}

/**
 * Export funnel plot as PNG
 */
export async function exportFunnelPlotPNG(container, scale = 2) {
    const svgSource = exportFunnelPlotSVG(container);
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
    createFunnelPlot,
    createContourFunnelPlot,
    createPrecisionFunnelPlot,
    exportFunnelPlotSVG,
    exportFunnelPlotPNG
};
