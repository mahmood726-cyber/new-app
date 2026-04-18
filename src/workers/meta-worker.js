/**
 * Meta-Analysis Web Worker
 * Offloads heavy statistical computations to a separate thread
 */

// Import will be bundled by Vite
// In worker context, we need to include the necessary functions

/**
 * Message handler for the worker
 */
self.onmessage = async function(event) {
    const { id, type, payload } = event.data;

    try {
        let result;

        switch (type) {
            case 'randomEffectsMeta':
                result = randomEffectsMeta(payload.studies, payload.options);
                break;

            case 'fixedEffectsMeta':
                result = fixedEffectsMeta(payload.studies, payload.options);
                break;

            case 'networkMetaAnalysis':
                result = networkMetaAnalysis(payload.studies, payload.options);
                break;

            case 'bayesianMeta':
                result = bayesianMeta(payload.studies, payload.options);
                break;

            case 'metaRegression':
                result = metaRegression(payload.studies, payload.moderators, payload.options);
                break;

            case 'bootstrapMeta':
                result = bootstrapMeta(payload.studies, payload.options);
                break;

            case 'permutationMeta':
                result = permutationMeta(payload.studies, payload.options);
                break;

            case 'leaveOneOut':
                result = leaveOneOut(payload.studies, payload.options);
                break;

            case 'trimAndFill':
                result = trimAndFill(payload.studies, payload.options);
                break;

            case 'petPeese':
                result = petPeese(payload.studies, payload.options);
                break;

            case 'selectionModel':
                result = selectionModel(payload.studies, payload.options);
                break;

            case 'cumulativeMeta':
                result = cumulativeMeta(payload.studies, payload.options);
                break;

            case 'influenceDiagnostics':
                result = influenceDiagnostics(payload.studies, payload.options);
                break;

            default:
                throw new Error(`Unknown computation type: ${type}`);
        }

        self.postMessage({ id, success: true, result });
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};

// ============================================================
// STATISTICAL FUNCTIONS (Minimal implementation for worker)
// These are simplified versions - full versions are in meta-engine.js
// ============================================================

/**
 * Random Effects Meta-Analysis (DerSimonian-Laird)
 */
function randomEffectsMeta(studies, options = {}) {
    const config = {
        method: options.method || 'DL',
        hksj: options.hksj !== false,
        ...options
    };

    if (!studies || studies.length < 2) {
        return { success: false, error: 'Need at least 2 studies' };
    }

    const n = studies.length;
    const yi = studies.map(s => s.yi);
    const vi = studies.map(s => s.vi);
    const wi = vi.map(v => 1 / v);

    // Fixed effect estimate
    const sumW = wi.reduce((a, b) => a + b, 0);
    const sumWY = yi.reduce((sum, y, i) => sum + wi[i] * y, 0);
    const muFixed = sumWY / sumW;

    // Q statistic
    const Q = yi.reduce((sum, y, i) => sum + wi[i] * Math.pow(y - muFixed, 2), 0);
    const df = n - 1;

    // DL tau2 estimate
    const C = sumW - yi.reduce((sum, _, i) => sum + wi[i] * wi[i], 0) / sumW;
    let tau2 = Math.max(0, (Q - df) / C);

    // Random effects weights
    const wiStar = vi.map(v => 1 / (v + tau2));
    const sumWStar = wiStar.reduce((a, b) => a + b, 0);
    const sumWStarY = yi.reduce((sum, y, i) => sum + wiStar[i] * y, 0);
    const muRandom = sumWStarY / sumWStar;

    // Standard error
    let se = Math.sqrt(1 / sumWStar);

    // HKSJ adjustment
    if (config.hksj && n > 2) {
        const qAdj = yi.reduce((sum, y, i) => sum + wiStar[i] * Math.pow(y - muRandom, 2), 0);
        const hksjFactor = Math.sqrt(qAdj / df);
        se = se * Math.max(1, hksjFactor);
    }

    // I-squared
    const I2 = Math.max(0, (Q - df) / Q * 100);

    // Confidence interval
    const tCrit = config.hksj ? tQuantile(0.975, df) : 1.96;
    const ciLower = muRandom - tCrit * se;
    const ciUpper = muRandom + tCrit * se;

    // P-value
    const z = Math.abs(muRandom / se);
    const pValue = 2 * (1 - normalCDF(z));

    // Weights as percentages
    const totalWeight = wiStar.reduce((a, b) => a + b, 0);
    const weights = studies.map((s, i) => ({
        study: s.study,
        weight: (wiStar[i] / totalWeight) * 100
    }));

    // Prediction interval
    const piSe = Math.sqrt(se * se + tau2);
    const piLower = muRandom - tQuantile(0.975, Math.max(1, n - 2)) * piSe;
    const piUpper = muRandom + tQuantile(0.975, Math.max(1, n - 2)) * piSe;

    return {
        success: true,
        model: 'random',
        k: n,
        pooled: {
            effect: muRandom,
            se: se,
            ci_lower: ciLower,
            ci_upper: ciUpper,
            z: z,
            p_value: pValue
        },
        heterogeneity: {
            tau2: tau2,
            tau: Math.sqrt(tau2),
            Q: Q,
            df: df,
            p_value: 1 - chiSquareCDF(Q, df),
            I2: I2,
            H2: Q / df
        },
        prediction_interval: {
            lower: piLower,
            upper: piUpper
        },
        weights: weights,
        settings: config
    };
}

/**
 * Fixed Effects Meta-Analysis
 */
function fixedEffectsMeta(studies, options = {}) {
    if (!studies || studies.length < 2) {
        return { success: false, error: 'Need at least 2 studies' };
    }

    const n = studies.length;
    const yi = studies.map(s => s.yi);
    const vi = studies.map(s => s.vi);
    const wi = vi.map(v => 1 / v);

    const sumW = wi.reduce((a, b) => a + b, 0);
    const sumWY = yi.reduce((sum, y, i) => sum + wi[i] * y, 0);
    const mu = sumWY / sumW;

    const se = Math.sqrt(1 / sumW);
    const ciLower = mu - 1.96 * se;
    const ciUpper = mu + 1.96 * se;

    const z = Math.abs(mu / se);
    const pValue = 2 * (1 - normalCDF(z));

    // Q statistic
    const Q = yi.reduce((sum, y, i) => sum + wi[i] * Math.pow(y - mu, 2), 0);
    const df = n - 1;
    const I2 = Math.max(0, (Q - df) / Q * 100);

    return {
        success: true,
        model: 'fixed',
        k: n,
        pooled: {
            effect: mu,
            se: se,
            ci_lower: ciLower,
            ci_upper: ciUpper,
            z: z,
            p_value: pValue
        },
        heterogeneity: {
            Q: Q,
            df: df,
            p_value: 1 - chiSquareCDF(Q, df),
            I2: I2
        }
    };
}

/**
 * Bootstrap Meta-Analysis
 */
function bootstrapMeta(studies, options = {}) {
    const nBoot = options.nBoot || 1000;
    const n = studies.length;
    const bootEffects = [];

    for (let b = 0; b < nBoot; b++) {
        // Resample with replacement
        const bootStudies = [];
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * n);
            bootStudies.push(studies[idx]);
        }

        const result = randomEffectsMeta(bootStudies, { hksj: false });
        if (result.success) {
            bootEffects.push(result.pooled.effect);
        }
    }

    bootEffects.sort((a, b) => a - b);

    const mean = bootEffects.reduce((a, b) => a + b, 0) / bootEffects.length;
    const ci025 = bootEffects[Math.floor(bootEffects.length * 0.025)];
    const ci975 = bootEffects[Math.floor(bootEffects.length * 0.975)];

    return {
        success: true,
        method: 'bootstrap',
        n_boot: nBoot,
        pooled: {
            effect: mean,
            ci_lower: ci025,
            ci_upper: ci975
        },
        distribution: bootEffects
    };
}

/**
 * Leave-One-Out Analysis
 */
function leaveOneOut(studies, options = {}) {
    const results = [];

    for (let i = 0; i < studies.length; i++) {
        const subset = studies.filter((_, j) => j !== i);
        const meta = randomEffectsMeta(subset, options);

        if (meta.success) {
            results.push({
                excluded: studies[i].study,
                effect: meta.pooled.effect,
                ci_lower: meta.pooled.ci_lower,
                ci_upper: meta.pooled.ci_upper,
                I2: meta.heterogeneity.I2
            });
        }
    }

    return {
        success: true,
        results: results
    };
}

/**
 * Cumulative Meta-Analysis
 */
function cumulativeMeta(studies, options = {}) {
    const sortBy = options.sortBy || 'year';
    const sorted = [...studies].sort((a, b) => (a[sortBy] || 0) - (b[sortBy] || 0));

    const results = [];
    for (let i = 1; i < sorted.length; i++) {
        const subset = sorted.slice(0, i + 1);
        const meta = randomEffectsMeta(subset, options);

        if (meta.success) {
            results.push({
                added: sorted[i].study,
                k: i + 1,
                effect: meta.pooled.effect,
                ci_lower: meta.pooled.ci_lower,
                ci_upper: meta.pooled.ci_upper
            });
        }
    }

    return {
        success: true,
        results: results
    };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

function chiSquareCDF(x, df) {
    if (x <= 0) return 0;
    return gammaCDF(x / 2, df / 2);
}

function gammaCDF(x, a) {
    if (x <= 0) return 0;
    if (a <= 0) return 0;

    const EPSILON = 1e-14;
    const MAX_ITER = 200;

    // Use series expansion for small x
    if (x < a + 1) {
        let sum = 1 / a;
        let term = sum;
        for (let n = 1; n < MAX_ITER; n++) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < EPSILON * Math.abs(sum)) break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    }

    // Use continued fraction for large x
    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;

    for (let i = 1; i < MAX_ITER; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = b + an / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPSILON) break;
    }

    return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(x) {
    const c = [
        76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
    ];

    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;

    for (let j = 0; j < 6; j++) {
        ser += c[j] / ++y;
    }

    return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function tQuantile(p, df) {
    if (df <= 0) return NaN;
    if (p <= 0 || p >= 1) return NaN;

    // Newton-Raphson iteration
    let x = normalQuantile(p);

    for (let i = 0; i < 10; i++) {
        const fx = tCDF(x, df) - p;
        const fpx = tPDF(x, df);
        if (Math.abs(fpx) < 1e-14) break;
        const dx = fx / fpx;
        x -= dx;
        if (Math.abs(dx) < 1e-10) break;
    }

    return x;
}

function normalQuantile(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    const a = [
        -3.969683028665376e+01, 2.209460984245205e+02,
        -2.759285104469687e+02, 1.383577518672690e+02,
        -3.066479806614716e+01, 2.506628277459239e+00
    ];
    const b = [
        -5.447609879822406e+01, 1.615858368580409e+02,
        -1.556989798598866e+02, 6.680131188771972e+01,
        -1.328068155288572e+01
    ];
    const c = [
        -7.784894002430293e-03, -3.223964580411365e-01,
        -2.400758277161838e+00, -2.549732539343734e+00,
        4.374664141464968e+00, 2.938163982698783e+00
    ];
    const d = [
        7.784695709041462e-03, 3.224671290700398e-01,
        2.445134137142996e+00, 3.754408661907416e+00
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q, r;

    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
            (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
}

function tCDF(t, df) {
    const x = df / (df + t * t);
    return 1 - 0.5 * betaCDF(x, df / 2, 0.5);
}

function tPDF(t, df) {
    const c = Math.exp(logGamma((df + 1) / 2) - logGamma(df / 2));
    return c / (Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, (df + 1) / 2));
}

function betaCDF(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    const bt = Math.exp(
        logGamma(a + b) - logGamma(a) - logGamma(b) +
        a * Math.log(x) + b * Math.log(1 - x)
    );

    if (x < (a + 1) / (a + b + 2)) {
        return bt * betaCF(x, a, b) / a;
    } else {
        return 1 - bt * betaCF(1 - x, b, a) / b;
    }
}

function betaCF(x, a, b) {
    const EPSILON = 1e-14;
    const MAX_ITER = 200;

    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;

    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= MAX_ITER; m++) {
        const m2 = 2 * m;

        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        h *= d * c;

        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = 1 + aa / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const del = d * c;
        h *= del;

        if (Math.abs(del - 1) < EPSILON) break;
    }

    return h;
}

// Stub functions - full implementations would be in main thread
function networkMetaAnalysis() {
    return { success: false, error: 'Use main thread for NMA' };
}

function bayesianMeta() {
    return { success: false, error: 'Use main thread for Bayesian' };
}

function metaRegression() {
    return { success: false, error: 'Use main thread for regression' };
}

function permutationMeta() {
    return { success: false, error: 'Use main thread for permutation' };
}

function trimAndFill() {
    return { success: false, error: 'Use main thread for trim-fill' };
}

function petPeese() {
    return { success: false, error: 'Use main thread for PET-PEESE' };
}

function selectionModel() {
    return { success: false, error: 'Use main thread for selection model' };
}

function influenceDiagnostics() {
    return { success: false, error: 'Use main thread for diagnostics' };
}
