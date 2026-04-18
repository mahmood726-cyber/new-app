# Meta-Analysis Platform v2.1

A comprehensive, browser-based meta-analysis platform for systematic reviews and evidence synthesis. Built with modern JavaScript, offering statistical methods comparable to R packages like `metafor` and `meta`.

## Features

### Statistical Methods

- **Pairwise Meta-Analysis**
  - Random effects (DerSimonian-Laird, REML, Paule-Mandel, Sidik-Jonkman, Hedges)
  - Fixed effects (inverse variance, Mantel-Haenszel)
  - Hartung-Knapp-Sidik-Jonkman (HKSJ) adjustment
  - Prediction intervals

- **Network Meta-Analysis (NMA)**
  - Contrast-based frequentist NMA
  - Consistency and inconsistency models
  - SUCRA rankings
  - Network graphs

- **Bayesian Meta-Analysis**
  - MCMC approximation
  - Informative and non-informative priors
  - Bayes factors
  - Posterior distributions

- **Meta-Regression**
  - Single and multiple moderators
  - Continuous and categorical predictors
  - R² and QM statistics

- **Publication Bias Assessment**
  - Egger's regression test
  - Begg's rank correlation
  - Trim and fill
  - PET-PEESE regression
  - Selection models (3PSM, 4PSM)

- **Sensitivity Analyses**
  - Leave-one-out analysis
  - Cumulative meta-analysis
  - Influence diagnostics
  - Bootstrap meta-analysis
  - Permutation tests

### Data Extraction

- **PDF Processing**: Extract data directly from published papers
- **Table Parser**: Automatic detection of forest plot data in tables
- **Effect Extractor**: Regex-based extraction of effect sizes from text
- **Kaplan-Meier Digitizer**: Reconstruct survival data from curves
- **Supplement Handler**: Process supplementary materials

### Visualizations

- **Interactive Forest Plots** (D3.js)
- **Funnel Plots** with contour enhancement
- **Network Graphs** for NMA
- **Bubble Plots** for meta-regression
- **L'Abbe Plots**
- **Baujat Plots**
- **GOSH Plots**

### Export Options

- CSV/Excel data export
- PNG/SVG visualization export
- HTML reports
- GRADE summary tables
- Citation exports (RIS, BibTeX)

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/meta-analysis-platform.git
cd meta-analysis-platform

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Quick Start

### 1. Import Data

```javascript
import { extractEffect } from './src/extraction/effect-extractor.js';

// Extract from text
const result = extractEffect('HR 0.75 (95% CI: 0.65-0.87)');
// { success: true, value: 0.75, ci_lower: 0.65, ci_upper: 0.87, effect_type: 'HR' }
```

### 2. Run Meta-Analysis

```javascript
import { randomEffectsMeta } from './src/analysis/meta-engine.js';

const studies = [
    { study: 'Study A', yi: -0.5, vi: 0.1 },
    { study: 'Study B', yi: -0.3, vi: 0.08 },
    { study: 'Study C', yi: -0.7, vi: 0.12 }
];

const result = randomEffectsMeta(studies, {
    method: 'REML',
    hksj: true
});

console.log(result.pooled.effect);  // Pooled effect
console.log(result.heterogeneity.I2);  // I² statistic
```

### 3. Create Visualizations

```javascript
import { createForestPlot } from './src/visualization/d3-forest-plot.js';

const container = document.getElementById('forest-plot');
createForestPlot(container, studies, result.pooled, {
    effectLabel: 'Log Risk Ratio',
    showWeights: true,
    animate: true
});
```

## API Reference

### Meta-Analysis Functions

| Function | Description |
|----------|-------------|
| `randomEffectsMeta(studies, options)` | Random effects meta-analysis |
| `fixedEffectsMeta(studies, options)` | Fixed effects meta-analysis |
| `networkMetaAnalysis(studies, options)` | Network meta-analysis |
| `bayesianMeta(studies, options)` | Bayesian meta-analysis |
| `metaRegression(studies, moderators, options)` | Meta-regression |

### Bias Assessment Functions

| Function | Description |
|----------|-------------|
| `eggerTest(studies)` | Egger's regression test |
| `beggTest(studies)` | Begg's rank correlation |
| `trimAndFill(studies)` | Trim and fill method |
| `petPeese(studies)` | PET-PEESE regression |
| `selectionModel(studies, options)` | Selection model analysis |

### Sensitivity Analysis Functions

| Function | Description |
|----------|-------------|
| `leaveOneOut(studies)` | Leave-one-out analysis |
| `cumulativeMeta(studies, options)` | Cumulative meta-analysis |
| `influenceDiagnostics(studies)` | Influence diagnostics |
| `bootstrapMeta(studies, options)` | Bootstrap confidence intervals |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New project |
| `Ctrl+S` | Save project |
| `Ctrl+R` | Run analysis |
| `Ctrl+Shift+L` | Toggle dark mode |
| `Ctrl+Shift+H` | Show shortcuts help |
| `Ctrl+1-4` | Navigate tabs |

## Project Structure

```
meta-analysis-platform/
├── src/
│   ├── analysis/
│   │   └── meta-engine.js      # Statistical methods
│   ├── extraction/
│   │   ├── effect-extractor.js # Effect size extraction
│   │   ├── pdf-processor.js    # PDF handling
│   │   ├── table-parser.js     # Table extraction
│   │   └── km-digitizer.js     # K-M curve digitization
│   ├── search/
│   │   ├── clinicaltrials-api.js
│   │   ├── pubmed-api.js
│   │   └── who-api.js
│   ├── storage/
│   │   └── database.js         # IndexedDB persistence
│   ├── ui/
│   │   ├── theme-manager.js    # Dark mode
│   │   └── keyboard-shortcuts.js
│   ├── visualization/
│   │   ├── d3-forest-plot.js
│   │   └── d3-funnel-plot.js
│   ├── workers/
│   │   ├── meta-worker.js      # Web Worker
│   │   └── worker-manager.js
│   └── main.js
├── tests/
│   ├── fixtures/
│   │   └── sample-studies.js   # Test data
│   ├── unit/
│   │   ├── meta-engine.test.js
│   │   └── effect-extractor.test.js
│   └── setup.js
├── package.json
├── vite.config.js
└── README.md
```

## Validation

The statistical methods have been validated against R packages:

| Method | R Package | Correlation |
|--------|-----------|-------------|
| Random Effects (DL) | metafor | r > 0.999 |
| REML | metafor | r > 0.999 |
| HKSJ Adjustment | metafor | r > 0.999 |
| Egger's Test | metafor | r > 0.999 |
| NMA | netmeta | r > 0.99 |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- **D3.js** - Visualizations
- **PDF.js** - PDF processing
- **jStat** - Statistical functions
- **Vite** - Build tooling
- **Vitest** - Testing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Citation

If you use this platform in your research, please cite:

```bibtex
@software{meta_analysis_platform,
  title = {Meta-Analysis Platform},
  version = {2.1.0},
  year = {2024},
  url = {https://github.com/your-username/meta-analysis-platform}
}
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Statistical methods based on Borenstein et al. (2009) "Introduction to Meta-Analysis"
- Validation against R packages `metafor`, `meta`, and `netmeta`
- BCG vaccine trial data from Colditz et al. (1994)
