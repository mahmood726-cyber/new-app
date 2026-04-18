/**
 * Statistical Formula Documentation with Citations
 *
 * This module provides comprehensive documentation of all statistical
 * formulas used in the meta-analysis platform, with proper academic citations.
 *
 * Reference numbers correspond to the bibliography at the end of this file.
 */

export const StatisticalFormulas = {

    //==========================================================================
    // EFFECT SIZE CALCULATIONS
    //==========================================================================

    effectSizes: {
        smd: {
            name: 'Standardized Mean Difference (SMD)',
            aliases: ['Cohen\'s d', 'Hedge\'s g'],
            formula: 'd = (M₁ - M₂) / S_pooled',
            pooledSD: 'S_pooled = √[((n₁-1)S₁² + (n₂-1)S₂²) / (n₁ + n₂ - 2)]',
            hedgesCorrection: 'g = d × (1 - 3/(4(n₁+n₂) - 9))',
            hedgesCorrectionAlt: 'J = 1 - 3/(4df - 1), where df = n₁ + n₂ - 2',
            variance: 'Var(d) = (n₁+n₂)/(n₁×n₂) + d²/(2(n₁+n₂))',
            varianceHedges: 'Var(g) = J² × Var(d)',
            interpretation: {
                small: '|d| ≈ 0.2',
                medium: '|d| ≈ 0.5',
                large: '|d| ≈ 0.8'
            },
            references: [1, 2, 3]
        },

        or: {
            name: 'Odds Ratio (OR)',
            formula: 'OR = (a/b) / (c/d) = (a×d) / (b×c)',
            logOR: 'ln(OR) = ln(a) - ln(b) - ln(c) + ln(d)',
            variance: 'Var(ln(OR)) = 1/a + 1/b + 1/c + 1/d',
            continuityCorrection: 'Add 0.5 to all cells when any cell = 0',
            interpretation: {
                neutral: 'OR = 1 (no effect)',
                benefit: 'OR < 1 (reduced odds of outcome)',
                harm: 'OR > 1 (increased odds of outcome)'
            },
            references: [4, 5]
        },

        rr: {
            name: 'Risk Ratio (RR)',
            formula: 'RR = (a/(a+b)) / (c/(c+d)) = p₁/p₂',
            logRR: 'ln(RR) = ln(p₁) - ln(p₂)',
            variance: 'Var(ln(RR)) = (1-p₁)/(a+b)/p₁ + (1-p₂)/(c+d)/p₂',
            varianceAlt: 'Var(ln(RR)) = 1/a - 1/(a+b) + 1/c - 1/(c+d)',
            references: [4, 5]
        },

        hr: {
            name: 'Hazard Ratio (HR)',
            formula: 'HR = h₁(t) / h₂(t)',
            logHR: 'ln(HR) = β from Cox proportional hazards model',
            variance: 'Var(ln(HR)) = SE(β)²',
            estimationFromKM: 'ln(HR) ≈ (O₁ - E₁) / V, where O=observed, E=expected, V=variance',
            references: [6, 7]
        },

        correlation: {
            name: 'Correlation Coefficient',
            fisherZ: 'z = 0.5 × ln((1+r)/(1-r)) = arctanh(r)',
            varianceZ: 'Var(z) = 1/(n-3)',
            backTransform: 'r = (exp(2z)-1)/(exp(2z)+1) = tanh(z)',
            references: [8, 9]
        }
    },

    //==========================================================================
    // POOLING METHODS
    //==========================================================================

    poolingMethods: {
        fixedEffects: {
            name: 'Fixed Effects (Inverse Variance)',
            model: 'θᵢ = θ + εᵢ, where εᵢ ~ N(0, σᵢ²)',
            weight: 'wᵢ = 1/σᵢ²',
            pooledEstimate: 'θ̂ = Σ(wᵢ×θᵢ) / Σwᵢ',
            variance: 'Var(θ̂) = 1/Σwᵢ',
            se: 'SE(θ̂) = √(1/Σwᵢ)',
            ci: 'θ̂ ± z_{α/2} × SE(θ̂)',
            zValue: 'z = θ̂/SE(θ̂)',
            pValue: 'p = 2×(1 - Φ(|z|))',
            references: [10, 11]
        },

        randomEffects: {
            name: 'Random Effects',
            model: 'θᵢ = μ + uᵢ + εᵢ, where uᵢ ~ N(0, τ²), εᵢ ~ N(0, σᵢ²)',
            weight: 'wᵢ* = 1/(σᵢ² + τ²)',
            pooledEstimate: 'μ̂ = Σ(wᵢ*×θᵢ) / Σwᵢ*',
            variance: 'Var(μ̂) = 1/Σwᵢ*',
            predictionInterval: 'μ̂ ± t_{k-2,α/2} × √(SE²(μ̂) + τ²)',
            references: [10, 12]
        }
    },

    //==========================================================================
    // TAU² ESTIMATORS
    //==========================================================================

    tau2Estimators: {
        dl: {
            name: 'DerSimonian-Laird (DL)',
            formula: 'τ²_DL = max(0, (Q - (k-1)) / C)',
            C: 'C = Σwᵢ - Σwᵢ²/Σwᵢ',
            properties: 'Method of moments estimator; most commonly used',
            limitations: 'Can be negatively biased, especially with few studies',
            references: [13]
        },

        reml: {
            name: 'Restricted Maximum Likelihood (REML)',
            logLikelihood: 'ℓ_R(τ²) = -½[Σlog(σᵢ²+τ²) + Σ((θᵢ-μ̂)²/(σᵢ²+τ²)) + log(Σ1/(σᵢ²+τ²))]',
            estimateBy: 'Iteratively solve: ∂ℓ_R/∂τ² = 0',
            properties: 'Less biased than ML; recommended default',
            references: [14, 15]
        },

        pm: {
            name: 'Paule-Mandel (PM)',
            estimatingEquation: 'Q*(τ²) = k - 1',
            Qstar: 'Q*(τ²) = Σwᵢ*(θᵢ - μ̂)²',
            properties: 'Generalizes DL; solves for τ² that makes Q* = k-1',
            recommended: 'Often recommended for few studies',
            references: [16]
        },

        sj: {
            name: 'Sidik-Jonkman (SJ)',
            formula: 'τ²_SJ = Σwᵢ(θᵢ - θ̄_uw)² / (k-1)',
            initialEstimate: 'θ̄_uw = unweighted mean',
            properties: 'Positive-definite estimator; iterative refinement',
            references: [17]
        },

        he: {
            name: 'Hedges-Olkin (HE)',
            formula: 'τ²_HE = max(0, (Q - (k-1)) / (k-1))',
            properties: 'Simplified DL variant',
            references: [2]
        },

        hs: {
            name: 'Hunter-Schmidt (HS)',
            formula: 'τ²_HS = max(0, S²_θ - mean(σᵢ²))',
            properties: 'Method of moments approach',
            references: [18]
        }
    },

    //==========================================================================
    // HETEROGENEITY STATISTICS
    //==========================================================================

    heterogeneity: {
        Q: {
            name: 'Cochran\'s Q',
            formula: 'Q = Σwᵢ(θᵢ - θ̂)²',
            distribution: 'Q ~ χ²_{k-1} under H₀: no heterogeneity',
            pValue: 'p = P(χ²_{k-1} > Q)',
            limitation: 'Low power with few studies',
            references: [19, 20]
        },

        I2: {
            name: 'I² Statistic',
            formula: 'I² = max(0, (Q - (k-1)) / Q) × 100%',
            alternativeFormula: 'I² = τ² / (τ² + s²)',
            interpretation: {
                low: '25%',
                moderate: '50%',
                high: '75%'
            },
            meaning: 'Proportion of total variance due to between-study heterogeneity',
            qProfileCI: 'CI from Q-profile method: solve Q(τ²) = χ²_{k-1,α/2} and χ²_{k-1,1-α/2}',
            references: [21, 22]
        },

        H2: {
            name: 'H² Statistic',
            formula: 'H² = Q / (k-1)',
            relationship: 'I² = (H² - 1) / H²',
            references: [21]
        },

        tau2: {
            name: 'Between-study variance (τ²)',
            meaning: 'Variance of true effects across studies',
            ci: {
                qProfile: 'Q-profile: solve Q(τ²_L) = χ²_{k-1,1-α/2} and Q(τ²_U) = χ²_{k-1,α/2}',
                profileLikelihood: 'Profile likelihood: find τ² where -2×(ℓ(τ²) - ℓ(τ̂²)) = χ²_{1,α}'
            },
            references: [22, 23]
        }
    },

    //==========================================================================
    // CONFIDENCE INTERVAL ADJUSTMENTS
    //==========================================================================

    ciAdjustments: {
        wald: {
            name: 'Wald (Standard)',
            formula: 'CI = μ̂ ± z_{α/2} × SE(μ̂)',
            properties: 'Uses normal distribution; standard default',
            limitation: 'May have poor coverage with few studies or high heterogeneity',
            references: [10]
        },

        hksj: {
            name: 'Hartung-Knapp-Sidik-Jonkman (HKSJ)',
            formula: 'CI = μ̂ ± t_{k-1,α/2} × SE_HKSJ(μ̂)',
            adjustedSE: 'SE_HKSJ = SE × √(q/(k-1))',
            q: 'q = Σwᵢ*(θᵢ - μ̂)² with wᵢ* = 1/(σᵢ² + τ²)',
            properties: 'Uses t-distribution; wider CIs; better coverage',
            recommendation: 'Recommended for most meta-analyses, especially with few studies',
            references: [24, 25]
        },

        knapHartungMod: {
            name: 'Modified Knapp-Hartung',
            modification: 'If q < 1, set q = 1 to prevent overly narrow CIs',
            references: [26]
        }
    },

    //==========================================================================
    // PUBLICATION BIAS TESTS
    //==========================================================================

    publicationBias: {
        egger: {
            name: 'Egger\'s Regression Test',
            model: 'θᵢ/SEᵢ = α + β×(1/SEᵢ) + εᵢ',
            testStatistic: 't = β̂/SE(β̂) with df = k-2',
            interpretation: 'Significant intercept (α ≠ 0) suggests asymmetry',
            limitations: 'Low power with k < 10; sensitive to heterogeneity',
            references: [27]
        },

        begg: {
            name: 'Begg\'s Rank Correlation Test',
            formula: 'τ = (C - D) / √(k(k-1)/2)',
            kendallTau: 'Correlation between effect sizes and their variances',
            testAgainst: 'H₀: τ = 0 (no correlation)',
            properties: 'Non-parametric; less powerful than Egger\'s',
            references: [28]
        },

        trimFill: {
            name: 'Trim and Fill',
            algorithm: '1. Estimate k₀ missing studies\n2. Impute by reflection around adjusted mean\n3. Re-estimate pooled effect',
            k0Estimators: {
                L0: 'k₀ = |R₊ - R₋|',
                R0: 'k₀ = (4T₊ - k(k+1)) / (2k-1)',
                Q0: 'Variance-weighted variant'
            },
            references: [29, 30]
        },

        petPeese: {
            name: 'PET-PEESE',
            pet: {
                model: 'θᵢ = β₀ + β₁×SEᵢ + εᵢ',
                interpretation: 'β₀ estimates true effect when SE → 0'
            },
            peese: {
                model: 'θᵢ = β₀ + β₁×Varᵢ + εᵢ',
                interpretation: 'Less biased when true effect exists'
            },
            selectionRule: 'Use PEESE if PET intercept significant (p < 0.10)',
            references: [31, 32]
        },

        selectionModels: {
            name: 'Selection Models',
            veveaHedges: {
                model: 'P(selected|p-value) = ω for p > α',
                likelihood: 'Maximizes likelihood accounting for selection',
                references: [33, 34]
            }
        }
    },

    //==========================================================================
    // SENSITIVITY ANALYSES
    //==========================================================================

    sensitivityAnalyses: {
        leaveOneOut: {
            name: 'Leave-One-Out Analysis',
            method: 'Recalculate meta-analysis omitting each study',
            purpose: 'Identify influential studies',
            references: [10]
        },

        influenceDiagnostics: {
            name: 'Influence Diagnostics',
            cooksD: 'D_i = (μ̂ - μ̂_{(-i)})² / (p × MSE)',
            dfbetas: 'DFBETAS_i = (μ̂ - μ̂_{(-i)}) / SE(μ̂_{(-i)})',
            hatValue: 'h_i = w_i / Σw',
            threshold: 'Influential if |DFBETAS| > 2/√k or Cook\'s D > 4/k',
            references: [35, 36]
        },

        cumulativeMeta: {
            name: 'Cumulative Meta-Analysis',
            method: 'Add studies sequentially (by date, precision, etc.)',
            purpose: 'Assess stability of evidence over time',
            references: [37]
        }
    }
};

//==============================================================================
// BIBLIOGRAPHY
//==============================================================================

export const Bibliography = {
    1: {
        authors: 'Cohen J',
        title: 'Statistical Power Analysis for the Behavioral Sciences',
        journal: 'Lawrence Erlbaum Associates',
        year: 1988,
        edition: '2nd ed',
        type: 'book'
    },
    2: {
        authors: 'Hedges LV, Olkin I',
        title: 'Statistical Methods for Meta-Analysis',
        journal: 'Academic Press',
        year: 1985,
        type: 'book'
    },
    3: {
        authors: 'Hedges LV',
        title: 'Distribution theory for Glass\'s estimator of effect size and related estimators',
        journal: 'J Educ Stat',
        year: 1981,
        volume: 6,
        pages: '107-128',
        doi: '10.3102/10769986006002107'
    },
    4: {
        authors: 'Fleiss JL',
        title: 'The statistical basis of meta-analysis',
        journal: 'Stat Methods Med Res',
        year: 1993,
        volume: 2,
        pages: '121-145',
        doi: '10.1177/096228029300200202'
    },
    5: {
        authors: 'Deeks JJ, Higgins JPT, Altman DG',
        title: 'Analysing data and undertaking meta-analyses',
        journal: 'Cochrane Handbook for Systematic Reviews of Interventions',
        year: 2022,
        chapter: 10,
        type: 'chapter'
    },
    6: {
        authors: 'Parmar MKB, Torri V, Stewart L',
        title: 'Extracting summary statistics to perform meta-analyses of the published literature for survival endpoints',
        journal: 'Stat Med',
        year: 1998,
        volume: 17,
        pages: '2815-2834',
        doi: '10.1002/(SICI)1097-0258(19981230)17:24<2815::AID-SIM110>3.0.CO;2-8'
    },
    7: {
        authors: 'Tierney JF, Stewart LA, Ghersi D, et al.',
        title: 'Practical methods for incorporating summary time-to-event data into meta-analysis',
        journal: 'Trials',
        year: 2007,
        volume: 8,
        pages: '16',
        doi: '10.1186/1745-6215-8-16'
    },
    8: {
        authors: 'Fisher RA',
        title: 'Frequency distribution of the values of the correlation coefficient in samples of an indefinitely large population',
        journal: 'Biometrika',
        year: 1915,
        volume: 10,
        pages: '507-521',
        doi: '10.2307/2331838'
    },
    9: {
        authors: 'Hunter JE, Schmidt FL',
        title: 'Methods of Meta-Analysis: Correcting Error and Bias in Research Findings',
        journal: 'SAGE Publications',
        year: 2004,
        edition: '2nd ed',
        type: 'book'
    },
    10: {
        authors: 'Borenstein M, Hedges LV, Higgins JPT, Rothstein HR',
        title: 'Introduction to Meta-Analysis',
        journal: 'Wiley',
        year: 2009,
        type: 'book',
        doi: '10.1002/9780470743386'
    },
    11: {
        authors: 'Mantel N, Haenszel W',
        title: 'Statistical aspects of the analysis of data from retrospective studies of disease',
        journal: 'J Natl Cancer Inst',
        year: 1959,
        volume: 22,
        pages: '719-748'
    },
    12: {
        authors: 'Riley RD, Higgins JPT, Deeks JJ',
        title: 'Interpretation of random effects meta-analyses',
        journal: 'BMJ',
        year: 2011,
        volume: 342,
        pages: 'd549',
        doi: '10.1136/bmj.d549'
    },
    13: {
        authors: 'DerSimonian R, Laird N',
        title: 'Meta-analysis in clinical trials',
        journal: 'Control Clin Trials',
        year: 1986,
        volume: 7,
        pages: '177-188',
        doi: '10.1016/0197-2456(86)90046-2'
    },
    14: {
        authors: 'Viechtbauer W',
        title: 'Conducting meta-analyses in R with the metafor package',
        journal: 'J Stat Softw',
        year: 2010,
        volume: 36,
        issue: 3,
        pages: '1-48',
        doi: '10.18637/jss.v036.i03'
    },
    15: {
        authors: 'Thompson SG, Sharp SJ',
        title: 'Explaining heterogeneity in meta-analysis: a comparison of methods',
        journal: 'Stat Med',
        year: 1999,
        volume: 18,
        pages: '2693-2708',
        doi: '10.1002/(SICI)1097-0258(19991030)18:20<2693::AID-SIM235>3.0.CO;2-V'
    },
    16: {
        authors: 'Paule RC, Mandel J',
        title: 'Consensus values and weighting factors',
        journal: 'J Res Natl Bur Stand',
        year: 1982,
        volume: 87,
        pages: '377-385',
        doi: '10.6028/jres.087.022'
    },
    17: {
        authors: 'Sidik K, Jonkman JN',
        title: 'A simple confidence interval for meta-analysis',
        journal: 'Stat Med',
        year: 2002,
        volume: 21,
        pages: '3153-3159',
        doi: '10.1002/sim.1262'
    },
    18: {
        authors: 'Schmidt FL, Hunter JE',
        title: 'Methods of Meta-Analysis: Correcting Error and Bias in Research Findings',
        journal: 'SAGE Publications',
        year: 2015,
        edition: '3rd ed',
        type: 'book'
    },
    19: {
        authors: 'Cochran WG',
        title: 'The combination of estimates from different experiments',
        journal: 'Biometrics',
        year: 1954,
        volume: 10,
        pages: '101-129',
        doi: '10.2307/3001666'
    },
    20: {
        authors: 'Higgins JPT, Thompson SG, Deeks JJ, Altman DG',
        title: 'Measuring inconsistency in meta-analyses',
        journal: 'BMJ',
        year: 2003,
        volume: 327,
        pages: '557-560',
        doi: '10.1136/bmj.327.7414.557'
    },
    21: {
        authors: 'Higgins JPT, Thompson SG',
        title: 'Quantifying heterogeneity in a meta-analysis',
        journal: 'Stat Med',
        year: 2002,
        volume: 21,
        pages: '1539-1558',
        doi: '10.1002/sim.1186'
    },
    22: {
        authors: 'Viechtbauer W',
        title: 'Confidence intervals for the amount of heterogeneity in meta-analysis',
        journal: 'Stat Med',
        year: 2007,
        volume: 26,
        pages: '37-52',
        doi: '10.1002/sim.2514'
    },
    23: {
        authors: 'Jackson D, White IR, Thompson SG',
        title: 'Extending DerSimonian and Laird\'s methodology to perform multivariate random effects meta-analyses',
        journal: 'Stat Med',
        year: 2010,
        volume: 29,
        pages: '1282-1297',
        doi: '10.1002/sim.3602'
    },
    24: {
        authors: 'Hartung J, Knapp G',
        title: 'A refined method for the meta-analysis of controlled clinical trials with binary outcome',
        journal: 'Stat Med',
        year: 2001,
        volume: 20,
        pages: '3875-3889',
        doi: '10.1002/sim.1009'
    },
    25: {
        authors: 'Sidik K, Jonkman JN',
        title: 'Robust variance estimation for random effects meta-analysis',
        journal: 'Comput Stat Data Anal',
        year: 2006,
        volume: 50,
        pages: '3681-3701',
        doi: '10.1016/j.csda.2005.07.019'
    },
    26: {
        authors: 'IntHout J, Ioannidis JP, Borm GF',
        title: 'The Hartung-Knapp-Sidik-Jonkman method for random effects meta-analysis is straightforward and considerably outperforms the standard DerSimonian-Laird method',
        journal: 'BMC Med Res Methodol',
        year: 2014,
        volume: 14,
        pages: '25',
        doi: '10.1186/1471-2288-14-25'
    },
    27: {
        authors: 'Egger M, Davey Smith G, Schneider M, Minder C',
        title: 'Bias in meta-analysis detected by a simple, graphical test',
        journal: 'BMJ',
        year: 1997,
        volume: 315,
        pages: '629-634',
        doi: '10.1136/bmj.315.7109.629'
    },
    28: {
        authors: 'Begg CB, Mazumdar M',
        title: 'Operating characteristics of a rank correlation test for publication bias',
        journal: 'Biometrics',
        year: 1994,
        volume: 50,
        pages: '1088-1101',
        doi: '10.2307/2533446'
    },
    29: {
        authors: 'Duval S, Tweedie R',
        title: 'A nonparametric "trim and fill" method of accounting for publication bias in meta-analysis',
        journal: 'J Am Stat Assoc',
        year: 2000,
        volume: 95,
        pages: '89-98',
        doi: '10.1080/01621459.2000.10473905'
    },
    30: {
        authors: 'Duval S, Tweedie R',
        title: 'Trim and fill: a simple funnel-plot-based method of testing and adjusting for publication bias in meta-analysis',
        journal: 'Biometrics',
        year: 2000,
        volume: 56,
        pages: '455-463',
        doi: '10.1111/j.0006-341X.2000.00455.x'
    },
    31: {
        authors: 'Stanley TD, Doucouliagos H',
        title: 'Meta-regression approximations to reduce publication selection bias',
        journal: 'Res Synth Methods',
        year: 2014,
        volume: 5,
        pages: '60-78',
        doi: '10.1002/jrsm.1095'
    },
    32: {
        authors: 'Stanley TD',
        title: 'Limitations of PET-PEESE and other meta-analysis methods: Comment on Carter and McCullough (2014)',
        journal: 'Soc Psychol Personal Sci',
        year: 2017,
        volume: 8,
        pages: '581-591',
        doi: '10.1177/1948550617693062'
    },
    33: {
        authors: 'Vevea JL, Hedges LV',
        title: 'A general linear model for estimating effect size in the presence of publication bias',
        journal: 'Psychometrika',
        year: 1995,
        volume: 60,
        pages: '419-435',
        doi: '10.1007/BF02294384'
    },
    34: {
        authors: 'Hedges LV, Vevea JL',
        title: 'Estimating effect size under publication bias: Small sample properties and robustness of a random effects selection model',
        journal: 'J Educ Behav Stat',
        year: 1996,
        volume: 21,
        pages: '299-332',
        doi: '10.3102/10769986021004299'
    },
    35: {
        authors: 'Viechtbauer W, Cheung MWL',
        title: 'Outlier and influence diagnostics for meta-analysis',
        journal: 'Res Synth Methods',
        year: 2010,
        volume: 1,
        pages: '112-125',
        doi: '10.1002/jrsm.11'
    },
    36: {
        authors: 'Cook RD',
        title: 'Detection of influential observations in linear regression',
        journal: 'Technometrics',
        year: 1977,
        volume: 19,
        pages: '15-18',
        doi: '10.2307/1268249'
    },
    37: {
        authors: 'Lau J, Antman EM, Jimenez-Silva J, et al.',
        title: 'Cumulative meta-analysis of therapeutic trials for myocardial infarction',
        journal: 'N Engl J Med',
        year: 1992,
        volume: 327,
        pages: '248-254',
        doi: '10.1056/NEJM199207233270406'
    }
};

/**
 * Format a citation in academic style
 * @param {number} refNum - Reference number
 * @returns {string} Formatted citation
 */
export function formatCitation(refNum) {
    const ref = Bibliography[refNum];
    if (!ref) return '';

    if (ref.type === 'book') {
        return `${ref.authors}. ${ref.title}. ${ref.journal}; ${ref.year}${ref.edition ? ` (${ref.edition})` : ''}.`;
    } else if (ref.type === 'chapter') {
        return `${ref.authors}. ${ref.title}. In: ${ref.journal}. Chapter ${ref.chapter}; ${ref.year}.`;
    } else {
        return `${ref.authors}. ${ref.title}. ${ref.journal}. ${ref.year};${ref.volume}${ref.issue ? `(${ref.issue})` : ''}:${ref.pages}.${ref.doi ? ` doi:${ref.doi}` : ''}`;
    }
}

/**
 * Get all citations for a formula
 * @param {string} category - Formula category (e.g., 'effectSizes.smd')
 * @returns {Array} Array of formatted citations
 */
export function getCitationsFor(category) {
    const parts = category.split('.');
    let formula = StatisticalFormulas;
    for (const part of parts) {
        formula = formula?.[part];
    }
    if (!formula?.references) return [];
    return formula.references.map(refNum => ({
        number: refNum,
        citation: formatCitation(refNum)
    }));
}

/**
 * Generate LaTeX formula documentation
 */
export function generateLaTeXDoc() {
    let latex = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{hyperref}
\\title{Statistical Formulas for Meta-Analysis}
\\author{Generated by Meta-Analysis Platform}
\\begin{document}
\\maketitle

`;

    // Add sections
    latex += `\\section{Effect Size Calculations}\n\n`;

    for (const [key, formula] of Object.entries(StatisticalFormulas.effectSizes)) {
        latex += `\\subsection{${formula.name}}\n`;
        latex += `Formula: $${formula.formula}$\n\n`;
        if (formula.variance) {
            latex += `Variance: $${formula.variance}$\n\n`;
        }
    }

    latex += `\\end{document}`;
    return latex;
}

export default StatisticalFormulas;
