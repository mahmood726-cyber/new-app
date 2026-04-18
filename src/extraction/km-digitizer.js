/**
 * Kaplan-Meier Curve Digitizer
 * Extracts survival data from KM curve images
 *
 * @module km-digitizer
 */

/**
 * Default configuration for KM digitization
 */
const DEFAULT_CONFIG = {
    // Axis detection
    minAxisPoints: 5,
    axisSearchMargin: 0.1, // 10% of image

    // Curve detection
    curveColors: [
        { name: 'blue', ranges: [[180, 255], [0, 100], [0, 100]] },
        { name: 'red', ranges: [[0, 100], [0, 100], [180, 255]] },
        { name: 'green', ranges: [[0, 100], [150, 255], [0, 100]] },
        { name: 'black', ranges: [[0, 50], [0, 50], [0, 50]] },
        { name: 'orange', ranges: [[200, 255], [100, 180], [0, 80]] },
        { name: 'purple', ranges: [[100, 180], [0, 100], [150, 220]] }
    ],

    // Point detection
    minPointDistance: 3,
    smoothingWindow: 5,

    // Numbers at risk
    narSearchHeight: 0.15, // Bottom 15% for NAR table

    // Time points
    defaultTimePoints: [0, 6, 12, 18, 24, 30, 36, 48, 60],

    // Output
    outputTimeInterval: 1 // months
};

/**
 * Main KM digitization class
 */
export class KMDigitizer {
    constructor(options = {}) {
        this.config = { ...DEFAULT_CONFIG, ...options };
        this.canvas = null;
        this.ctx = null;
        this.imageData = null;
        this.calibration = null;
    }

    /**
     * Digitize a KM curve from an image
     * @param {ImageData|HTMLCanvasElement|HTMLImageElement} source - Image source
     * @param {Object} options - Digitization options
     * @returns {Promise<Object>} Digitized survival data
     */
    async digitize(source, options = {}) {
        const config = { ...this.config, ...options };
        const startTime = performance.now();

        try {
            // Step 1: Load and prepare image
            await this.loadImage(source);

            // Step 2: Detect axes
            const axes = this.detectAxes();
            if (!axes.valid) {
                return {
                    success: false,
                    error: 'Could not detect axes',
                    details: axes.errors
                };
            }

            // Step 3: Calibrate coordinate system
            this.calibration = this.calibrateAxes(axes, options.calibration);

            // Step 4: Detect curves
            const curves = this.detectCurves(config);

            // Step 5: Extract survival data
            const survivalData = this.extractSurvivalData(curves);

            // Step 6: Extract numbers at risk (if present)
            const numbersAtRisk = this.extractNumbersAtRisk();

            // Step 7: Reconstruct IPD
            const ipd = this.reconstructIPD(survivalData, numbersAtRisk);

            return {
                success: true,
                calibration: this.calibration,
                curves: survivalData,
                numbersAtRisk,
                ipd,
                metadata: {
                    imageSize: { width: this.canvas.width, height: this.canvas.height },
                    processingTime: Math.round(performance.now() - startTime),
                    curvesDetected: curves.length
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    /**
     * Load image into canvas
     */
    async loadImage(source) {
        // Create canvas if needed
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
        }

        let img;

        if (source instanceof ImageData) {
            this.canvas.width = source.width;
            this.canvas.height = source.height;
            this.ctx.putImageData(source, 0, 0);
            this.imageData = source;
            return;
        }

        if (source instanceof HTMLCanvasElement) {
            this.canvas.width = source.width;
            this.canvas.height = source.height;
            this.ctx.drawImage(source, 0, 0);
            this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        if (source instanceof HTMLImageElement) {
            img = source;
        } else if (typeof source === 'string') {
            // URL or data URL
            img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = source;
            });
        } else if (source instanceof Blob || source instanceof File) {
            const url = URL.createObjectURL(source);
            img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.onerror = reject;
                img.src = url;
            });
        }

        if (img) {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.ctx.drawImage(img, 0, 0);
            this.imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * Detect X and Y axes
     */
    detectAxes() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.imageData.data;

        const result = {
            valid: false,
            xAxis: null,
            yAxis: null,
            plotArea: null,
            errors: []
        };

        // Find dark lines that could be axes
        const horizontalLines = this.findHorizontalLines(data, width, height);
        const verticalLines = this.findVerticalLines(data, width, height);

        // X-axis: lowest horizontal line in bottom half
        const bottomHalf = horizontalLines.filter(l => l.y > height * 0.4);
        if (bottomHalf.length > 0) {
            result.xAxis = bottomHalf.reduce((a, b) => a.y > b.y ? a : b);
        }

        // Y-axis: leftmost vertical line in left half
        const leftHalf = verticalLines.filter(l => l.x < width * 0.5);
        if (leftHalf.length > 0) {
            result.yAxis = leftHalf.reduce((a, b) => a.x < b.x ? a : b);
        }

        if (result.xAxis && result.yAxis) {
            result.valid = true;
            result.plotArea = {
                left: result.yAxis.x,
                right: width - (width * 0.05),
                top: height * 0.05,
                bottom: result.xAxis.y
            };
        } else {
            if (!result.xAxis) result.errors.push('X-axis not detected');
            if (!result.yAxis) result.errors.push('Y-axis not detected');
        }

        return result;
    }

    /**
     * Find horizontal lines in image
     */
    findHorizontalLines(data, width, height) {
        const lines = [];
        const threshold = 100; // Darkness threshold
        const minLength = width * 0.3;

        for (let y = 0; y < height; y++) {
            let lineStart = null;
            let lineLength = 0;

            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

                if (brightness < threshold) {
                    if (lineStart === null) lineStart = x;
                    lineLength++;
                } else {
                    if (lineLength > minLength) {
                        lines.push({
                            y,
                            x1: lineStart,
                            x2: lineStart + lineLength,
                            length: lineLength
                        });
                    }
                    lineStart = null;
                    lineLength = 0;
                }
            }

            if (lineLength > minLength) {
                lines.push({
                    y,
                    x1: lineStart,
                    x2: lineStart + lineLength,
                    length: lineLength
                });
            }
        }

        return this.consolidateLines(lines, 'horizontal');
    }

    /**
     * Find vertical lines in image
     */
    findVerticalLines(data, width, height) {
        const lines = [];
        const threshold = 100;
        const minLength = height * 0.3;

        for (let x = 0; x < width; x++) {
            let lineStart = null;
            let lineLength = 0;

            for (let y = 0; y < height; y++) {
                const idx = (y * width + x) * 4;
                const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

                if (brightness < threshold) {
                    if (lineStart === null) lineStart = y;
                    lineLength++;
                } else {
                    if (lineLength > minLength) {
                        lines.push({
                            x,
                            y1: lineStart,
                            y2: lineStart + lineLength,
                            length: lineLength
                        });
                    }
                    lineStart = null;
                    lineLength = 0;
                }
            }

            if (lineLength > minLength) {
                lines.push({
                    x,
                    y1: lineStart,
                    y2: lineStart + lineLength,
                    length: lineLength
                });
            }
        }

        return this.consolidateLines(lines, 'vertical');
    }

    /**
     * Consolidate nearby lines
     */
    consolidateLines(lines, type) {
        if (lines.length === 0) return [];

        lines.sort((a, b) => type === 'horizontal' ? a.y - b.y : a.x - b.x);

        const consolidated = [];
        let current = { ...lines[0] };

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const key = type === 'horizontal' ? 'y' : 'x';

            if (Math.abs(line[key] - current[key]) < 5) {
                // Merge
                current.length = Math.max(current.length, line.length);
            } else {
                consolidated.push(current);
                current = { ...line };
            }
        }
        consolidated.push(current);

        return consolidated;
    }

    /**
     * Calibrate axes to real values
     */
    calibrateAxes(axes, userCalibration = {}) {
        const plotArea = axes.plotArea;

        // Default calibration (common KM plot)
        const calibration = {
            xMin: userCalibration.xMin ?? 0,
            xMax: userCalibration.xMax ?? 36,
            yMin: userCalibration.yMin ?? 0,
            yMax: userCalibration.yMax ?? 1.0,
            xUnit: userCalibration.xUnit ?? 'months',
            yUnit: userCalibration.yUnit ?? 'probability',
            plotArea
        };

        // Calculate pixel-to-value conversion
        const xRange = plotArea.right - plotArea.left;
        const yRange = plotArea.bottom - plotArea.top;

        calibration.pixelToX = (px) => {
            const ratio = (px - plotArea.left) / xRange;
            return calibration.xMin + ratio * (calibration.xMax - calibration.xMin);
        };

        calibration.pixelToY = (py) => {
            const ratio = (plotArea.bottom - py) / yRange;
            return calibration.yMin + ratio * (calibration.yMax - calibration.yMin);
        };

        calibration.xToPixel = (x) => {
            const ratio = (x - calibration.xMin) / (calibration.xMax - calibration.xMin);
            return plotArea.left + ratio * xRange;
        };

        calibration.yToPixel = (y) => {
            const ratio = (y - calibration.yMin) / (calibration.yMax - calibration.yMin);
            return plotArea.bottom - ratio * yRange;
        };

        return calibration;
    }

    /**
     * Detect curves in the image
     */
    detectCurves(config) {
        const curves = [];
        const plotArea = this.calibration.plotArea;
        const data = this.imageData.data;
        const width = this.canvas.width;

        for (const colorDef of config.curveColors) {
            const points = [];

            // Scan plot area for this color
            for (let x = Math.floor(plotArea.left); x < Math.ceil(plotArea.right); x++) {
                let foundY = null;
                let highestY = Infinity;

                for (let y = Math.floor(plotArea.top); y < Math.ceil(plotArea.bottom); y++) {
                    const idx = (y * width + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    if (this.matchesColor(r, g, b, colorDef.ranges)) {
                        // For KM curves, we want the highest (lowest Y value) point
                        if (y < highestY) {
                            highestY = y;
                            foundY = y;
                        }
                    }
                }

                if (foundY !== null) {
                    points.push({ px: x, py: foundY });
                }
            }

            if (points.length > 20) {
                curves.push({
                    color: colorDef.name,
                    points: this.smoothCurve(points, config.smoothingWindow),
                    rawPointCount: points.length
                });
            }
        }

        return curves;
    }

    /**
     * Check if RGB matches color ranges
     */
    matchesColor(r, g, b, ranges) {
        return r >= ranges[0][0] && r <= ranges[0][1] &&
               g >= ranges[1][0] && g <= ranges[1][1] &&
               b >= ranges[2][0] && b <= ranges[2][1];
    }

    /**
     * Smooth curve points
     */
    smoothCurve(points, windowSize) {
        if (points.length < windowSize) return points;

        const smoothed = [];
        const half = Math.floor(windowSize / 2);

        for (let i = 0; i < points.length; i++) {
            let sumY = 0;
            let count = 0;

            for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
                sumY += points[j].py;
                count++;
            }

            smoothed.push({
                px: points[i].px,
                py: sumY / count
            });
        }

        return smoothed;
    }

    /**
     * Extract survival data from detected curves
     */
    extractSurvivalData(curves) {
        return curves.map((curve, index) => {
            const survivalPoints = curve.points.map(pt => ({
                time: this.calibration.pixelToX(pt.px),
                survival: this.calibration.pixelToY(pt.py)
            }));

            // Remove duplicates and sort
            const uniquePoints = [];
            let lastTime = -Infinity;

            for (const pt of survivalPoints.sort((a, b) => a.time - b.time)) {
                if (pt.time > lastTime + 0.1) {
                    uniquePoints.push(pt);
                    lastTime = pt.time;
                }
            }

            // Enforce monotonic decrease (survival can only go down)
            let maxSurvival = 1.0;
            for (const pt of uniquePoints) {
                pt.survival = Math.min(pt.survival, maxSurvival);
                maxSurvival = pt.survival;
            }

            return {
                id: `curve_${index + 1}`,
                color: curve.color,
                pointCount: uniquePoints.length,
                data: uniquePoints,
                summary: this.calculateSurvivalSummary(uniquePoints)
            };
        });
    }

    /**
     * Calculate summary statistics from survival curve
     */
    calculateSurvivalSummary(points) {
        if (points.length === 0) return null;

        const summary = {
            medianSurvival: null,
            survivalAtTimepoints: {}
        };

        // Find median survival (time when survival = 0.5)
        for (let i = 1; i < points.length; i++) {
            if (points[i - 1].survival >= 0.5 && points[i].survival < 0.5) {
                // Linear interpolation
                const t1 = points[i - 1].time;
                const t2 = points[i].time;
                const s1 = points[i - 1].survival;
                const s2 = points[i].survival;
                summary.medianSurvival = t1 + (t2 - t1) * (s1 - 0.5) / (s1 - s2);
                break;
            }
        }

        // Survival at common timepoints
        const timepoints = [6, 12, 18, 24, 36, 48, 60];
        for (const t of timepoints) {
            const nearestIdx = this.findNearestTimeIndex(points, t);
            if (nearestIdx !== -1 && Math.abs(points[nearestIdx].time - t) < 1) {
                summary.survivalAtTimepoints[t] = points[nearestIdx].survival;
            }
        }

        return summary;
    }

    /**
     * Find index of nearest time point
     */
    findNearestTimeIndex(points, targetTime) {
        let nearest = -1;
        let minDist = Infinity;

        for (let i = 0; i < points.length; i++) {
            const dist = Math.abs(points[i].time - targetTime);
            if (dist < minDist) {
                minDist = dist;
                nearest = i;
            }
        }

        return nearest;
    }

    /**
     * Extract numbers at risk from below the plot
     */
    extractNumbersAtRisk() {
        // This requires OCR or text extraction from PDF
        // For now, return structure for manual input
        return {
            detected: false,
            curves: [],
            message: 'Numbers at risk extraction requires manual input or OCR'
        };
    }

    /**
     * Reconstruct Individual Patient Data (IPD) from curve and NAR
     * Uses Guyot et al. algorithm
     * @param {Array} survivalData - Digitized survival curves
     * @param {Object} numbersAtRisk - Numbers at risk data
     * @returns {Object} Reconstructed IPD
     */
    reconstructIPD(survivalData, numbersAtRisk) {
        const ipd = [];

        for (const curve of survivalData) {
            const curveIPD = this.guyotAlgorithm(curve.data, numbersAtRisk);
            ipd.push({
                curveId: curve.id,
                color: curve.color,
                patients: curveIPD.patients,
                events: curveIPD.events,
                censored: curveIPD.censored,
                totalN: curveIPD.totalN
            });
        }

        return ipd;
    }

    /**
     * Guyot et al. algorithm for IPD reconstruction
     * Reference: BMC Med Res Methodol. 2012;12:9
     */
    guyotAlgorithm(survivalPoints, numbersAtRisk) {
        if (survivalPoints.length < 2) {
            return { patients: [], events: 0, censored: 0, totalN: 0 };
        }

        // If we have NAR data, use it; otherwise estimate
        const hasNAR = numbersAtRisk?.detected && numbersAtRisk.timepoints?.length > 0;

        // Estimate initial N if not provided
        let initialN = hasNAR ? numbersAtRisk.timepoints[0]?.n : 100;

        const patients = [];
        let eventCount = 0;
        let censorCount = 0;

        // Work through survival intervals
        for (let i = 1; i < survivalPoints.length; i++) {
            const t1 = survivalPoints[i - 1].time;
            const t2 = survivalPoints[i].time;
            const s1 = survivalPoints[i - 1].survival;
            const s2 = survivalPoints[i].survival;

            if (s1 <= 0) break;

            // Number at risk at start of interval
            const nAtRisk = hasNAR
                ? this.interpolateNAR(numbersAtRisk, t1)
                : Math.round(initialN * s1);

            // Events in interval (from survival drop)
            const events = Math.round(nAtRisk * (1 - s2 / s1));

            // Add event times (spread within interval)
            for (let e = 0; e < events; e++) {
                const eventTime = t1 + (e + 0.5) * (t2 - t1) / events;
                patients.push({
                    time: eventTime,
                    event: 1
                });
                eventCount++;
            }

            // Censoring (if NAR drops more than events)
            if (hasNAR) {
                const n2 = this.interpolateNAR(numbersAtRisk, t2);
                const expectedN = nAtRisk - events;
                const censored = Math.max(0, expectedN - n2);

                for (let c = 0; c < censored; c++) {
                    const censorTime = t1 + (c + 0.5) * (t2 - t1) / Math.max(1, censored);
                    patients.push({
                        time: censorTime,
                        event: 0
                    });
                    censorCount++;
                }
            }
        }

        // Add remaining censored at end of follow-up
        const lastPoint = survivalPoints[survivalPoints.length - 1];
        const remainingN = Math.round(initialN * lastPoint.survival);
        for (let i = 0; i < remainingN - censorCount; i++) {
            patients.push({
                time: lastPoint.time,
                event: 0
            });
            censorCount++;
        }

        return {
            patients: patients.sort((a, b) => a.time - b.time),
            events: eventCount,
            censored: censorCount,
            totalN: eventCount + censorCount
        };
    }

    /**
     * Interpolate numbers at risk
     */
    interpolateNAR(numbersAtRisk, time) {
        if (!numbersAtRisk?.timepoints?.length) return null;

        const timepoints = numbersAtRisk.timepoints;

        // Find surrounding timepoints
        let lower = timepoints[0];
        let upper = timepoints[timepoints.length - 1];

        for (let i = 0; i < timepoints.length - 1; i++) {
            if (timepoints[i].time <= time && timepoints[i + 1].time > time) {
                lower = timepoints[i];
                upper = timepoints[i + 1];
                break;
            }
        }

        if (time <= lower.time) return lower.n;
        if (time >= upper.time) return upper.n;

        // Linear interpolation
        const ratio = (time - lower.time) / (upper.time - lower.time);
        return Math.round(lower.n + ratio * (upper.n - lower.n));
    }

    /**
     * Set calibration manually
     */
    setCalibration(calibration) {
        this.calibration = this.calibrateAxes(
            { plotArea: this.calibration?.plotArea || { left: 0, right: 100, top: 0, bottom: 100 } },
            calibration
        );
    }

    /**
     * Export digitized data for meta-analysis
     */
    exportForMetaAnalysis(survivalData, format = 'log_hr') {
        const exports = [];

        for (let i = 0; i < survivalData.length - 1; i++) {
            const treatment = survivalData[i];
            const control = survivalData[i + 1];

            if (!treatment.ipd || !control.ipd) continue;

            // Calculate log hazard ratio using IPD
            const tEvents = treatment.ipd.events;
            const tTotal = treatment.ipd.totalN;
            const cEvents = control.ipd.events;
            const cTotal = control.ipd.totalN;

            // Log-rank test approximation
            const o = tEvents;
            const e = (tEvents + cEvents) * tTotal / (tTotal + cTotal);

            if (e > 0) {
                const logHR = Math.log(o / e);
                const se = Math.sqrt(1 / o + 1 / (e * (1 - e / (tEvents + cEvents))));

                exports.push({
                    comparison: `${treatment.curveId} vs ${control.curveId}`,
                    yi: logHR,
                    vi: se * se,
                    hr: Math.exp(logHR),
                    ci_lower: Math.exp(logHR - 1.96 * se),
                    ci_upper: Math.exp(logHR + 1.96 * se)
                });
            }
        }

        return exports;
    }
}

/**
 * Quick digitize function
 * @param {*} source - Image source
 * @param {Object} options - Options
 * @returns {Promise<Object>} Digitized data
 */
export async function digitizeKMCurve(source, options = {}) {
    const digitizer = new KMDigitizer(options);
    return digitizer.digitize(source, options);
}

/**
 * Calculate hazard ratio from two survival curves
 * @param {Array} treatmentCurve - Treatment survival data
 * @param {Array} controlCurve - Control survival data
 * @returns {Object} Hazard ratio estimate
 */
export function calculateHRFromCurves(treatmentCurve, controlCurve) {
    // Use restricted mean survival time (RMST) difference as approximation
    const maxTime = Math.min(
        treatmentCurve[treatmentCurve.length - 1]?.time || 0,
        controlCurve[controlCurve.length - 1]?.time || 0
    );

    if (maxTime <= 0) {
        return { success: false, error: 'Invalid time range' };
    }

    const rmstTreatment = calculateRMST(treatmentCurve, maxTime);
    const rmstControl = calculateRMST(controlCurve, maxTime);

    // Approximate HR from median survival if available
    const medianT = findMedianSurvival(treatmentCurve);
    const medianC = findMedianSurvival(controlCurve);

    let hr = null;
    if (medianT && medianC) {
        // HR approximation: HR ≈ log(0.5) / log(S_c(m_t)) where m_t is treatment median
        // Simpler: HR ≈ median_control / median_treatment for exponential survival
        hr = medianC / medianT;
    }

    return {
        success: true,
        rmstDifference: rmstTreatment - rmstControl,
        rmstRatio: rmstTreatment / rmstControl,
        medianTreatment: medianT,
        medianControl: medianC,
        hr: hr,
        maxTime
    };
}

/**
 * Calculate Restricted Mean Survival Time
 */
function calculateRMST(curve, maxTime) {
    let rmst = 0;

    for (let i = 1; i < curve.length; i++) {
        if (curve[i].time > maxTime) break;

        const dt = curve[i].time - curve[i - 1].time;
        const avgSurvival = (curve[i].survival + curve[i - 1].survival) / 2;
        rmst += dt * avgSurvival;
    }

    return rmst;
}

/**
 * Find median survival time
 */
function findMedianSurvival(curve) {
    for (let i = 1; i < curve.length; i++) {
        if (curve[i - 1].survival >= 0.5 && curve[i].survival < 0.5) {
            const t1 = curve[i - 1].time;
            const t2 = curve[i].time;
            const s1 = curve[i - 1].survival;
            const s2 = curve[i].survival;
            return t1 + (t2 - t1) * (s1 - 0.5) / (s1 - s2);
        }
    }
    return null; // Median not reached
}

export default {
    KMDigitizer,
    digitizeKMCurve,
    calculateHRFromCurves
};
