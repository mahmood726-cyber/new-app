/**
 * ClinicalTrials.gov API Module
 * Search and retrieve clinical trial data
 *
 * @module clinicaltrials-api
 */

const API_BASE = 'https://clinicaltrials.gov/api/v2';
const DEFAULT_PAGE_SIZE = 100;

/**
 * Search ClinicalTrials.gov
 * @param {Object} query - Search parameters
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function searchTrials(query, options = {}) {
    const config = {
        pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
        maxResults: options.maxResults ?? 1000,
        includeResults: options.includeResults ?? true,
        ...options
    };

    try {
        // Build query string
        const queryParams = buildQueryParams(query, config);

        // Fetch results with pagination
        const allStudies = [];
        let pageToken = null;
        let totalCount = 0;

        do {
            const url = new URL(`${API_BASE}/studies`);
            Object.entries(queryParams).forEach(([key, value]) => {
                if (value != null) url.searchParams.append(key, value);
            });

            if (pageToken) {
                url.searchParams.set('pageToken', pageToken);
            }

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            totalCount = data.totalCount || 0;
            pageToken = data.nextPageToken || null;

            if (data.studies) {
                allStudies.push(...data.studies);
            }

            // Stop if we've reached the max
            if (allStudies.length >= config.maxResults) {
                break;
            }

        } while (pageToken);

        // Process and standardize results
        const processedStudies = allStudies.slice(0, config.maxResults).map(processStudy);

        return {
            success: true,
            totalCount,
            returnedCount: processedStudies.length,
            studies: processedStudies
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Build query parameters from PICO elements
 * @param {Object} query - Query object
 * @param {Object} config - Configuration
 * @returns {Object} Query parameters
 */
function buildQueryParams(query, config) {
    const params = {
        'format': 'json',
        'pageSize': config.pageSize,
        'fields': [
            'NCTId',
            'BriefTitle',
            'OfficialTitle',
            'OverallStatus',
            'Phase',
            'StudyType',
            'EnrollmentCount',
            'EnrollmentType',
            'StartDate',
            'CompletionDate',
            'PrimaryCompletionDate',
            'Condition',
            'Intervention',
            'InterventionName',
            'InterventionType',
            'InterventionDescription',
            'PrimaryOutcome',
            'SecondaryOutcome',
            'LeadSponsor',
            'LeadSponsorName',
            'CollaboratorName',
            'LocationCountry',
            'ResultsFirstPostDate',
            'HasResults',
            'StudyFirstPostDate',
            'LastUpdatePostDate',
            'ReferencePMID',
            'ReferenceCitation'
        ].join('|')
    };

    // Build query expression
    const queryParts = [];

    // Condition/Population
    if (query.population) {
        queryParts.push(`AREA[Condition]${query.population}`);
    }

    if (query.condition) {
        queryParts.push(`AREA[Condition]${query.condition}`);
    }

    // Intervention
    if (query.intervention) {
        queryParts.push(`AREA[InterventionName]${query.intervention}`);
    }

    // Study type filter
    if (query.studyType) {
        queryParts.push(`AREA[StudyType]${query.studyType}`);
    }

    // Status filter
    if (query.status) {
        queryParts.push(`AREA[OverallStatus]${query.status}`);
    }

    // Phase filter
    if (query.phase) {
        queryParts.push(`AREA[Phase]${query.phase}`);
    }

    // Results available
    if (query.hasResults !== undefined) {
        queryParts.push(`AREA[HasResults]${query.hasResults ? 'true' : 'false'}`);
    }

    if (queryParts.length > 0) {
        params['query.term'] = queryParts.join(' AND ');
    }

    // Free text search
    if (query.freeText) {
        params['query.term'] = query.freeText;
    }

    return params;
}

/**
 * Process raw study data into standardized format
 * @param {Object} study - Raw study data
 * @returns {Object} Processed study
 */
function processStudy(study) {
    const protocol = study.protocolSection || {};
    const identification = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const design = protocol.designModule || {};
    const conditions = protocol.conditionsModule || {};
    const interventions = protocol.armsInterventionsModule || {};
    const outcomes = protocol.outcomesModule || {};
    const sponsor = protocol.sponsorCollaboratorsModule || {};
    const references = protocol.referencesModule || {};

    // Extract interventions
    const interventionList = (interventions.interventions || []).map(i => ({
        name: i.interventionName,
        type: i.interventionType,
        description: i.description
    }));

    // Extract outcomes
    const primaryOutcomes = (outcomes.primaryOutcomes || []).map(o => ({
        measure: o.measure,
        timeFrame: o.timeFrame,
        description: o.description
    }));

    const secondaryOutcomes = (outcomes.secondaryOutcomes || []).map(o => ({
        measure: o.measure,
        timeFrame: o.timeFrame,
        description: o.description
    }));

    // Extract publications
    const publications = (references.references || [])
        .filter(r => r.pmid || r.citation)
        .map(r => ({
            pmid: r.pmid,
            citation: r.citation,
            type: r.type
        }));

    return {
        nct_id: identification.nctId,
        title: identification.briefTitle,
        official_title: identification.officialTitle,
        status: status.overallStatus,
        phase: design.phases?.join(', ') || null,
        study_type: design.studyType,
        enrollment: {
            count: design.enrollmentInfo?.count || null,
            type: design.enrollmentInfo?.type || null
        },
        dates: {
            start: status.startDateStruct?.date || null,
            completion: status.completionDateStruct?.date || null,
            primary_completion: status.primaryCompletionDateStruct?.date || null,
            first_posted: status.studyFirstPostDateStruct?.date || null,
            last_updated: status.lastUpdatePostDateStruct?.date || null,
            results_posted: status.resultsFirstPostDateStruct?.date || null
        },
        conditions: conditions.conditions || [],
        interventions: interventionList,
        primary_outcomes: primaryOutcomes,
        secondary_outcomes: secondaryOutcomes,
        sponsor: sponsor.leadSponsor?.name || null,
        collaborators: (sponsor.collaborators || []).map(c => c.name),
        has_results: status.resultsDateStruct != null,
        publications
    };
}

/**
 * Get study details by NCT ID
 * @param {string} nctId - NCT identifier
 * @returns {Promise<Object>} Study details
 */
export async function getStudyDetails(nctId) {
    try {
        const url = `${API_BASE}/studies/${nctId}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Study not found: ${nctId}`);
        }

        const data = await response.json();
        return {
            success: true,
            study: processStudy(data)
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get study results by NCT ID
 * @param {string} nctId - NCT identifier
 * @returns {Promise<Object>} Study results
 */
export async function getStudyResults(nctId) {
    try {
        const url = `${API_BASE}/studies/${nctId}?fields=ResultsSection`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Results not found: ${nctId}`);
        }

        const data = await response.json();
        const results = data.resultsSection;

        if (!results) {
            return {
                success: false,
                error: 'No results available for this study'
            };
        }

        // Process results
        const processedResults = {
            participant_flow: processParticipantFlow(results.participantFlowModule),
            baseline: processBaselineModule(results.baselineCharacteristicsModule),
            outcomes: processOutcomeMeasures(results.outcomeMeasuresModule),
            adverse_events: processAdverseEvents(results.adverseEventsModule)
        };

        return {
            success: true,
            results: processedResults
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Process participant flow module
 */
function processParticipantFlow(module) {
    if (!module) return null;

    return {
        groups: (module.groups || []).map(g => ({
            id: g.id,
            title: g.title,
            description: g.description
        })),
        periods: (module.periods || []).map(p => ({
            title: p.title,
            milestones: (p.milestones || []).map(m => ({
                type: m.type,
                counts: (m.achievements || []).map(a => ({
                    group: a.groupId,
                    count: a.numSubjects
                }))
            }))
        }))
    };
}

/**
 * Process baseline characteristics module
 */
function processBaselineModule(module) {
    if (!module) return null;

    return {
        groups: (module.groups || []).map(g => ({
            id: g.id,
            title: g.title,
            description: g.description
        })),
        measures: (module.measures || []).map(m => ({
            title: m.title,
            type: m.paramType,
            unit: m.unitOfMeasure,
            classes: (m.classes || []).map(c => ({
                title: c.title,
                categories: (c.categories || []).map(cat => ({
                    title: cat.title,
                    measurements: (cat.measurements || []).map(meas => ({
                        group: meas.groupId,
                        value: meas.value,
                        spread: meas.spread,
                        lowerLimit: meas.lowerLimit,
                        upperLimit: meas.upperLimit
                    }))
                }))
            }))
        }))
    };
}

/**
 * Process outcome measures module
 */
function processOutcomeMeasures(module) {
    if (!module) return null;

    return (module.outcomeMeasures || []).map(m => ({
        type: m.type,
        title: m.title,
        description: m.description,
        timeFrame: m.timeFrame,
        population: m.populationDescription,
        unit: m.unitOfMeasure,
        groups: (m.groups || []).map(g => ({
            id: g.id,
            title: g.title,
            description: g.description
        })),
        classes: (m.classes || []).map(c => ({
            title: c.title,
            categories: (c.categories || []).map(cat => ({
                title: cat.title,
                measurements: (cat.measurements || []).map(meas => ({
                    group: meas.groupId,
                    value: meas.value,
                    spread: meas.spread,
                    lowerLimit: meas.lowerLimit,
                    upperLimit: meas.upperLimit
                }))
            }))
        })),
        analyses: (m.analyses || []).map(a => ({
            groups: a.groupIds,
            method: a.statisticalMethod,
            type: a.paramType,
            value: a.paramValue,
            ci: {
                level: a.ciPctValue,
                lower: a.ciNumSides === '2-Sided' ? a.ciLowerLimit : null,
                upper: a.ciUpperLimit
            },
            pValue: a.pValue
        }))
    }));
}

/**
 * Process adverse events module
 */
function processAdverseEvents(module) {
    if (!module) return null;

    return {
        frequency_threshold: module.frequencyThreshold,
        time_frame: module.timeFrame,
        description: module.description,
        groups: (module.eventGroups || []).map(g => ({
            id: g.id,
            title: g.title,
            description: g.description,
            serious_events: g.seriousNumAffected,
            other_events: g.otherNumAffected,
            deaths: g.deathsNumAffected
        })),
        serious: (module.seriousEvents || []).map(e => ({
            term: e.term,
            organ: e.organSystem,
            stats: (e.stats || []).map(s => ({
                group: s.groupId,
                events: s.numEvents,
                affected: s.numAffected,
                at_risk: s.numAtRisk
            }))
        })),
        other: (module.otherEvents || []).map(e => ({
            term: e.term,
            organ: e.organSystem,
            stats: (e.stats || []).map(s => ({
                group: s.groupId,
                events: s.numEvents,
                affected: s.numAffected,
                at_risk: s.numAtRisk
            }))
        }))
    };
}

/**
 * Build PICO query from natural language
 * @param {Object} pico - PICO elements
 * @returns {Object} Structured query
 */
export function buildPICOQuery(pico) {
    const query = {
        studyType: 'INTERVENTIONAL',
        hasResults: true
    };

    // Population → Condition
    if (pico.population) {
        query.condition = pico.population;
    }

    // Intervention
    if (pico.intervention) {
        query.intervention = pico.intervention;
    }

    // Comparator (usually placebo for RCTs)
    // This is implicit in the study design

    // Outcomes - used for screening
    query.outcomes = pico.outcomes;

    return query;
}

/**
 * Batch search for multiple queries
 * @param {Array} queries - Array of query objects
 * @returns {Promise<Array>} Array of results
 */
export async function batchSearch(queries) {
    const results = await Promise.all(
        queries.map(q => searchTrials(q, { maxResults: 100 }))
    );

    return results;
}

/**
 * Get publication links for a study
 * @param {string} nctId - NCT ID
 * @returns {Promise<Object>} Publication data
 */
export async function getPublicationLinks(nctId) {
    const details = await getStudyDetails(nctId);

    if (!details.success) {
        return details;
    }

    const publications = details.study.publications;

    // Enhance with DOIs using CrossRef (if PMIDs available)
    const enhanced = await Promise.all(
        publications.map(async (pub) => {
            if (pub.pmid) {
                const doi = await fetchDOIFromPMID(pub.pmid);
                return { ...pub, doi };
            }
            return pub;
        })
    );

    return {
        success: true,
        nct_id: nctId,
        publications: enhanced
    };
}

/**
 * Fetch DOI from PMID using NCBI E-utilities
 * @param {string} pmid - PubMed ID
 * @returns {Promise<string|null>} DOI
 */
async function fetchDOIFromPMID(pmid) {
    try {
        const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
        const response = await fetch(url);
        const data = await response.json();

        const result = data?.result?.[pmid];
        if (result?.articleids) {
            const doiEntry = result.articleids.find(a => a.idtype === 'doi');
            return doiEntry?.value || null;
        }

        return null;
    } catch (e) {
        return null;
    }
}

export default {
    searchTrials,
    getStudyDetails,
    getStudyResults,
    buildPICOQuery,
    batchSearch,
    getPublicationLinks
};
