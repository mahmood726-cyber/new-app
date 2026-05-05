// Baseline probe for new-app (meta-analysis-platform v2.1.0).
//
// Runs randomEffectsMeta + fixedEffectsMeta on a fixed 5-study fixture
// and emits the headline pooled signals as JSON. All deterministic.
//
// Run: node probe.cjs

'use strict';

(async () => {
    const path = require('path');
    // Dynamic import to load the ESM engine from a CommonJS shim
    const enginePath = 'file://' + path.join(__dirname, 'src', 'analysis', 'meta-engine.js').replace(/\\/g, '/');
    const engine = await import(enginePath);

    // Fixed 5-study input — log-OR style effects with known SEs
    const studies = [
        { study: 'S1', yi: 0.30, vi: 0.0064, n: 200 },
        { study: 'S2', yi: 0.45, vi: 0.0100, n: 200 },
        { study: 'S3', yi: 0.20, vi: 0.0036, n: 300 },
        { study: 'S4', yi: 0.55, vi: 0.0144, n: 150 },
        { study: 'S5', yi: 0.35, vi: 0.0081, n: 250 },
    ];

    const re = engine.randomEffectsMeta(studies);
    const fe = engine.fixedEffectsMeta(studies);

    console.log(JSON.stringify({
        n_studies: studies.length,
        re_success: re.success,
        re_pooled: Math.round(re.pooled.effect * 1e6) / 1e6,
        re_se:     Math.round(re.pooled.se * 1e6) / 1e6,
        re_ci_low:  Math.round(re.pooled.ci_lower * 1e6) / 1e6,
        re_ci_high: Math.round(re.pooled.ci_upper * 1e6) / 1e6,
        re_q:      Math.round(re.heterogeneity.Q * 1e6) / 1e6,
        fe_pooled: Math.round(fe.pooled.effect * 1e6) / 1e6,
        fe_se:     Math.round(fe.pooled.se * 1e6) / 1e6,
    }));
})().catch(e => {
    console.error(e.stack || e.message || String(e));
    process.exit(1);
});
