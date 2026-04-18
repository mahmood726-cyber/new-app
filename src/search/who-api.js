/**
 * WHO International Clinical Trials Registry Platform (ICTRP) API
 * Search across multiple trial registries worldwide
 */

const WHO_ICTRP_URL = 'https://trialsearch.who.int';

/**
 * Search WHO ICTRP for clinical trials
 * Note: WHO ICTRP doesn't have a public API, so we use web scraping approach
 * In production, consider using their data export feature or contacting WHO for API access
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function searchWHOTrials(query, options = {}) {
    const config = {
        maxResults: options.maxResults || 100,
        recruitmentStatus: options.recruitmentStatus || 'all', // recruiting, completed, all
        phase: options.phase || 'all',
        minDate: options.minDate || '',
        maxDate: options.maxDate || '',
        ...options
    };

    try {
        // WHO ICTRP web interface URL
        const searchUrl = buildWHOSearchUrl(query, config);

        // Note: Direct fetch may be blocked by CORS
        // In production, use a proxy server or backend API
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept': 'text/html'
            }
        });

        if (!response.ok) {
            throw new Error(`WHO ICTRP returned status ${response.status}`);
        }

        const html = await response.text();
        const trials = parseWHOResults(html);

        return {
            success: true,
            trials: trials,
            totalCount: trials.length,
            query: query,
            source: 'WHO-ICTRP',
            searchUrl: searchUrl
        };
    } catch (error) {
        // Return mock data for demonstration
        // In production, implement proper error handling
        return {
            success: false,
            error: `WHO ICTRP search failed: ${error.message}. Consider using the web interface directly.`,
            query: query,
            searchUrl: `${WHO_ICTRP_URL}/Trial2.aspx?TrialID=${encodeURIComponent(query)}`
        };
    }
}

/**
 * Build WHO ICTRP search URL
 */
function buildWHOSearchUrl(query, config) {
    const params = new URLSearchParams({
        SearchType: 'Basic',
        SearchTerm: query
    });

    if (config.recruitmentStatus !== 'all') {
        params.set('RecruitmentStatus', config.recruitmentStatus);
    }

    return `${WHO_ICTRP_URL}/Default.aspx?${params}`;
}

/**
 * Parse WHO ICTRP HTML results
 * @param {string} html - HTML response
 * @returns {Object[]} Parsed trials
 */
function parseWHOResults(html) {
    // This is a simplified parser
    // In production, use a proper HTML parser
    const trials = [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const trialRows = doc.querySelectorAll('.trial-row, .searchresult, tr[data-trial-id]');

        for (const row of trialRows) {
            const trial = {
                trialId: row.querySelector('.trial-id, [data-field="id"]')?.textContent?.trim() || '',
                title: row.querySelector('.trial-title, [data-field="title"]')?.textContent?.trim() || '',
                status: row.querySelector('.recruitment-status, [data-field="status"]')?.textContent?.trim() || '',
                registry: row.querySelector('.source-registry, [data-field="registry"]')?.textContent?.trim() || '',
                condition: row.querySelector('.condition, [data-field="condition"]')?.textContent?.trim() || '',
                intervention: row.querySelector('.intervention, [data-field="intervention"]')?.textContent?.trim() || '',
                country: row.querySelector('.country, [data-field="country"]')?.textContent?.trim() || ''
            };

            if (trial.trialId || trial.title) {
                trials.push(trial);
            }
        }
    } catch (e) {
        console.warn('Error parsing WHO results:', e);
    }

    return trials;
}

/**
 * Get trial details by ID
 * @param {string} trialId - Trial registration ID (any registry format)
 * @returns {Promise<Object>} Trial details
 */
export async function getWHOTrialDetails(trialId) {
    try {
        const url = `${WHO_ICTRP_URL}/Trial2.aspx?TrialID=${encodeURIComponent(trialId)}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch trial: ${response.status}`);
        }

        const html = await response.text();
        return parseTrialDetails(html, trialId);
    } catch (error) {
        return {
            success: false,
            error: error.message,
            trialId: trialId,
            url: `${WHO_ICTRP_URL}/Trial2.aspx?TrialID=${encodeURIComponent(trialId)}`
        };
    }
}

/**
 * Parse detailed trial information
 */
function parseTrialDetails(html, trialId) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const getValue = (label) => {
        const row = doc.querySelector(`tr:has(td:first-child:contains("${label}")) td:last-child`);
        return row?.textContent?.trim() || '';
    };

    return {
        success: true,
        trialId: trialId,
        title: getValue('Scientific title') || getValue('Public title'),
        primaryRegistry: getValue('Primary Registry'),
        dateRegistration: getValue('Date of registration'),
        recruitmentStatus: getValue('Recruitment status'),
        healthCondition: getValue('Health condition'),
        intervention: getValue('Intervention'),
        primaryOutcome: getValue('Primary outcome'),
        secondaryOutcomes: getValue('Secondary outcome'),
        targetSize: getValue('Target sample size'),
        studyType: getValue('Study type'),
        phase: getValue('Phase'),
        countries: getValue('Countries of recruitment'),
        contacts: getValue('Contact'),
        sponsors: getValue('Primary sponsor'),
        ethics: getValue('Ethics review'),
        url: `${WHO_ICTRP_URL}/Trial2.aspx?TrialID=${encodeURIComponent(trialId)}`
    };
}

/**
 * Map trial ID to registry source
 * @param {string} trialId - Trial registration ID
 * @returns {Object} Registry information
 */
export function identifyRegistry(trialId) {
    const patterns = {
        'NCT\\d{8}': {
            name: 'ClinicalTrials.gov',
            country: 'USA',
            url: (id) => `https://clinicaltrials.gov/ct2/show/${id}`
        },
        'ISRCTN\\d+': {
            name: 'ISRCTN',
            country: 'UK',
            url: (id) => `https://www.isrctn.com/${id}`
        },
        'EUCTR\\d+-\\d+-\\d+': {
            name: 'EU Clinical Trials Register',
            country: 'EU',
            url: (id) => `https://www.clinicaltrialsregister.eu/ctr-search/trial/${id}`
        },
        'ACTRN\\d+': {
            name: 'ANZCTR',
            country: 'Australia/NZ',
            url: (id) => `https://www.anzctr.org.au/Trial/Registration/TrialReview.aspx?id=${id.replace('ACTRN', '')}`
        },
        'ChiCTR\\d+': {
            name: 'Chinese Clinical Trial Registry',
            country: 'China',
            url: (id) => `http://www.chictr.org.cn/showproj.aspx?proj=${id}`
        },
        'CTRI/\\d+/\\d+/\\d+': {
            name: 'CTRI',
            country: 'India',
            url: (id) => `http://ctri.nic.in/Clinicaltrials/pmaindet2.php?trialid=${id}`
        },
        'DRKS\\d+': {
            name: 'DRKS',
            country: 'Germany',
            url: (id) => `https://www.drks.de/drks_web/navigate.do?navigationId=trial.HTML&TRIAL_ID=${id}`
        },
        'JPRN-\\w+': {
            name: 'JPRN',
            country: 'Japan',
            url: (id) => `https://rctportal.niph.go.jp/en/detail?trial_id=${id}`
        },
        'KCT\\d+': {
            name: 'CRIS',
            country: 'South Korea',
            url: (id) => `https://cris.nih.go.kr/cris/en/search/search_result_st01.jsp?seq=${id.replace('KCT', '')}`
        },
        'NTR\\d+': {
            name: 'NTR',
            country: 'Netherlands',
            url: (id) => `https://www.trialregister.nl/trial/${id.replace('NTR', '')}`
        },
        'PACTR\\d+': {
            name: 'PACTR',
            country: 'Africa',
            url: (id) => `https://pactr.samrc.ac.za/TrialDisplay.aspx?TrialID=${id}`
        },
        'RBR-\\w+': {
            name: 'ReBec',
            country: 'Brazil',
            url: (id) => `http://www.ensaiosclinicos.gov.br/rg/${id}/`
        },
        'SLCTR/\\d+/\\d+/\\d+': {
            name: 'SLCTR',
            country: 'Sri Lanka',
            url: (id) => `https://slctr.lk/trials/${id}`
        },
        'TCTR\\d+': {
            name: 'TCTR',
            country: 'Thailand',
            url: (id) => `https://www.thaiclinicaltrials.org/show/${id}`
        },
        'IRCT\\d+N\\d+': {
            name: 'IRCT',
            country: 'Iran',
            url: (id) => `https://www.irct.ir/trial/${id}`
        }
    };

    for (const [pattern, info] of Object.entries(patterns)) {
        const regex = new RegExp(`^${pattern}$`, 'i');
        if (regex.test(trialId)) {
            return {
                ...info,
                trialId: trialId,
                directUrl: info.url(trialId),
                whoUrl: `${WHO_ICTRP_URL}/Trial2.aspx?TrialID=${encodeURIComponent(trialId)}`
            };
        }
    }

    return {
        name: 'Unknown Registry',
        country: 'Unknown',
        trialId: trialId,
        whoUrl: `${WHO_ICTRP_URL}/Trial2.aspx?TrialID=${encodeURIComponent(trialId)}`
    };
}

/**
 * Get list of supported registries
 */
export function getSupportedRegistries() {
    return [
        { id: 'ClinicalTrials.gov', country: 'USA', prefix: 'NCT' },
        { id: 'ISRCTN', country: 'UK', prefix: 'ISRCTN' },
        { id: 'EudraCT', country: 'EU', prefix: 'EUCTR' },
        { id: 'ANZCTR', country: 'Australia/NZ', prefix: 'ACTRN' },
        { id: 'ChiCTR', country: 'China', prefix: 'ChiCTR' },
        { id: 'CTRI', country: 'India', prefix: 'CTRI' },
        { id: 'DRKS', country: 'Germany', prefix: 'DRKS' },
        { id: 'JPRN', country: 'Japan', prefix: 'JPRN' },
        { id: 'CRIS', country: 'South Korea', prefix: 'KCT' },
        { id: 'NTR', country: 'Netherlands', prefix: 'NTR' },
        { id: 'PACTR', country: 'Africa', prefix: 'PACTR' },
        { id: 'ReBec', country: 'Brazil', prefix: 'RBR' },
        { id: 'SLCTR', country: 'Sri Lanka', prefix: 'SLCTR' },
        { id: 'TCTR', country: 'Thailand', prefix: 'TCTR' },
        { id: 'IRCT', country: 'Iran', prefix: 'IRCT' }
    ];
}

export default {
    searchWHOTrials,
    getWHOTrialDetails,
    identifyRegistry,
    getSupportedRegistries
};
