/**
 * PubMed API Integration
 * Search and retrieve articles from PubMed/NCBI
 */

const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const RATE_LIMIT_DELAY = 350; // NCBI recommends max 3 requests/second

let lastRequestTime = 0;

/**
 * Rate-limited fetch to respect NCBI guidelines
 */
async function rateLimitedFetch(url) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY - timeSinceLastRequest));
    }

    lastRequestTime = Date.now();
    return fetch(url);
}

/**
 * Search PubMed for articles
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function searchPubMed(query, options = {}) {
    const config = {
        retmax: options.maxResults || 100,
        retstart: options.offset || 0,
        sort: options.sort || 'relevance',
        dateType: options.dateType || 'pdat',
        minDate: options.minDate || '',
        maxDate: options.maxDate || '',
        ...options
    };

    try {
        // Build search URL
        const searchParams = new URLSearchParams({
            db: 'pubmed',
            term: query,
            retmax: config.retmax,
            retstart: config.retstart,
            sort: config.sort,
            retmode: 'json',
            usehistory: 'y'
        });

        if (config.minDate) searchParams.set('mindate', config.minDate);
        if (config.maxDate) searchParams.set('maxdate', config.maxDate);
        if (config.dateType) searchParams.set('datetype', config.dateType);

        const searchUrl = `${PUBMED_BASE_URL}/esearch.fcgi?${searchParams}`;
        const searchResponse = await rateLimitedFetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchData.esearchresult) {
            return { success: false, error: 'Invalid response from PubMed' };
        }

        const result = searchData.esearchresult;
        const pmids = result.idlist || [];
        const totalCount = parseInt(result.count) || 0;

        if (pmids.length === 0) {
            return {
                success: true,
                articles: [],
                totalCount: 0,
                query: query
            };
        }

        // Fetch article details
        const articles = await fetchArticleDetails(pmids);

        return {
            success: true,
            articles: articles,
            totalCount: totalCount,
            returnedCount: articles.length,
            query: query,
            webenv: result.webenv,
            queryKey: result.querykey
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            query: query
        };
    }
}

/**
 * Fetch detailed article information
 * @param {string[]} pmids - PubMed IDs
 * @returns {Promise<Object[]>} Article details
 */
export async function fetchArticleDetails(pmids) {
    if (!pmids || pmids.length === 0) return [];

    try {
        const fetchUrl = `${PUBMED_BASE_URL}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
        const response = await rateLimitedFetch(fetchUrl);
        const xmlText = await response.text();

        return parseArticleXML(xmlText);
    } catch (error) {
        console.error('Error fetching article details:', error);
        return [];
    }
}

/**
 * Parse PubMed XML response
 * @param {string} xmlText - XML response text
 * @returns {Object[]} Parsed articles
 */
function parseArticleXML(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const articles = doc.querySelectorAll('PubmedArticle');

    return Array.from(articles).map(article => {
        const medlineCitation = article.querySelector('MedlineCitation');
        const pubmedData = article.querySelector('PubmedData');

        // Basic info
        const pmid = medlineCitation?.querySelector('PMID')?.textContent || '';
        const articleNode = medlineCitation?.querySelector('Article');

        // Title
        const title = articleNode?.querySelector('ArticleTitle')?.textContent || '';

        // Abstract
        const abstractTexts = articleNode?.querySelectorAll('AbstractText') || [];
        const abstract = Array.from(abstractTexts)
            .map(node => {
                const label = node.getAttribute('Label');
                const text = node.textContent;
                return label ? `${label}: ${text}` : text;
            })
            .join('\n\n');

        // Authors
        const authorList = articleNode?.querySelectorAll('AuthorList Author') || [];
        const authors = Array.from(authorList).map(author => {
            const lastName = author.querySelector('LastName')?.textContent || '';
            const foreName = author.querySelector('ForeName')?.textContent || '';
            const initials = author.querySelector('Initials')?.textContent || '';
            return {
                lastName,
                foreName,
                initials,
                fullName: `${lastName} ${initials}`.trim()
            };
        });

        // Journal info
        const journal = articleNode?.querySelector('Journal');
        const journalTitle = journal?.querySelector('Title')?.textContent ||
                           journal?.querySelector('ISOAbbreviation')?.textContent || '';
        const journalIssue = journal?.querySelector('JournalIssue');
        const volume = journalIssue?.querySelector('Volume')?.textContent || '';
        const issue = journalIssue?.querySelector('Issue')?.textContent || '';

        // Date
        const pubDate = journalIssue?.querySelector('PubDate');
        const year = pubDate?.querySelector('Year')?.textContent || '';
        const month = pubDate?.querySelector('Month')?.textContent || '';

        // Pagination
        const pagination = articleNode?.querySelector('Pagination MedlinePgn')?.textContent || '';

        // DOI
        const articleIds = pubmedData?.querySelectorAll('ArticleIdList ArticleId') || [];
        let doi = '';
        let pmc = '';
        for (const id of articleIds) {
            if (id.getAttribute('IdType') === 'doi') doi = id.textContent;
            if (id.getAttribute('IdType') === 'pmc') pmc = id.textContent;
        }

        // MeSH terms
        const meshHeadings = medlineCitation?.querySelectorAll('MeshHeadingList MeshHeading') || [];
        const meshTerms = Array.from(meshHeadings).map(heading => {
            const descriptor = heading.querySelector('DescriptorName')?.textContent || '';
            const qualifiers = Array.from(heading.querySelectorAll('QualifierName'))
                .map(q => q.textContent);
            return { descriptor, qualifiers };
        });

        // Publication types
        const pubTypes = articleNode?.querySelectorAll('PublicationTypeList PublicationType') || [];
        const publicationTypes = Array.from(pubTypes).map(pt => pt.textContent);

        // Keywords
        const keywordList = medlineCitation?.querySelectorAll('KeywordList Keyword') || [];
        const keywords = Array.from(keywordList).map(kw => kw.textContent);

        return {
            pmid,
            title,
            abstract,
            authors,
            authorString: authors.map(a => a.fullName).join(', '),
            journal: journalTitle,
            year,
            month,
            volume,
            issue,
            pages: pagination,
            doi,
            pmc,
            meshTerms,
            publicationTypes,
            keywords,
            isRCT: publicationTypes.some(pt =>
                pt.toLowerCase().includes('randomized controlled trial') ||
                pt.toLowerCase().includes('clinical trial')
            ),
            isMetaAnalysis: publicationTypes.some(pt =>
                pt.toLowerCase().includes('meta-analysis') ||
                pt.toLowerCase().includes('systematic review')
            ),
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            citation: formatCitation(title, authors, journalTitle, year, volume, issue, pagination)
        };
    });
}

/**
 * Format citation string
 */
function formatCitation(title, authors, journal, year, volume, issue, pages) {
    const authorStr = authors.length > 3
        ? `${authors[0].fullName} et al.`
        : authors.map(a => a.fullName).join(', ');

    let citation = `${authorStr}. ${title}. ${journal}. ${year}`;
    if (volume) citation += `;${volume}`;
    if (issue) citation += `(${issue})`;
    if (pages) citation += `:${pages}`;
    citation += '.';

    return citation;
}

/**
 * Get article by PMID
 * @param {string} pmid - PubMed ID
 * @returns {Promise<Object>} Article details
 */
export async function getArticleByPMID(pmid) {
    const articles = await fetchArticleDetails([pmid]);
    return articles[0] || null;
}

/**
 * Search for clinical trials
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results filtered to trials
 */
export async function searchClinicalTrials(query, options = {}) {
    const trialQuery = `(${query}) AND (randomized controlled trial[pt] OR clinical trial[pt])`;
    return searchPubMed(trialQuery, options);
}

/**
 * Search for systematic reviews and meta-analyses
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results filtered to reviews
 */
export async function searchSystematicReviews(query, options = {}) {
    const reviewQuery = `(${query}) AND (systematic review[pt] OR meta-analysis[pt])`;
    return searchPubMed(reviewQuery, options);
}

/**
 * Get related articles
 * @param {string} pmid - Source PubMed ID
 * @param {Object} options - Options
 * @returns {Promise<Object>} Related articles
 */
export async function getRelatedArticles(pmid, options = {}) {
    const maxResults = options.maxResults || 20;

    try {
        const url = `${PUBMED_BASE_URL}/elink.fcgi?dbfrom=pubmed&db=pubmed&id=${pmid}&cmd=neighbor_score&retmode=json`;
        const response = await rateLimitedFetch(url);
        const data = await response.json();

        const linksets = data.linksets?.[0]?.linksetdbs || [];
        const relatedSet = linksets.find(ls => ls.linkname === 'pubmed_pubmed');

        if (!relatedSet || !relatedSet.links) {
            return { success: true, articles: [], sourcePmid: pmid };
        }

        const relatedPmids = relatedSet.links.slice(0, maxResults);
        const articles = await fetchArticleDetails(relatedPmids);

        return {
            success: true,
            articles: articles,
            sourcePmid: pmid,
            totalRelated: relatedSet.links.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            sourcePmid: pmid
        };
    }
}

/**
 * Export articles to RIS format
 * @param {Object[]} articles - Articles to export
 * @returns {string} RIS formatted string
 */
export function exportToRIS(articles) {
    return articles.map(article => {
        let ris = 'TY  - JOUR\n';
        ris += `TI  - ${article.title}\n`;
        ris += `JO  - ${article.journal}\n`;
        ris += `PY  - ${article.year}\n`;
        ris += `VL  - ${article.volume}\n`;
        ris += `IS  - ${article.issue}\n`;
        ris += `SP  - ${article.pages}\n`;
        ris += `AN  - ${article.pmid}\n`;
        if (article.doi) ris += `DO  - ${article.doi}\n`;
        if (article.abstract) ris += `AB  - ${article.abstract}\n`;

        for (const author of article.authors) {
            ris += `AU  - ${author.lastName}, ${author.foreName}\n`;
        }

        for (const kw of article.keywords || []) {
            ris += `KW  - ${kw}\n`;
        }

        ris += 'ER  - \n\n';
        return ris;
    }).join('');
}

/**
 * Export articles to BibTeX format
 * @param {Object[]} articles - Articles to export
 * @returns {string} BibTeX formatted string
 */
export function exportToBibTeX(articles) {
    return articles.map(article => {
        const key = `${article.authors[0]?.lastName || 'Unknown'}${article.year}`;
        const authors = article.authors.map(a => `${a.lastName}, ${a.foreName}`).join(' and ');

        let bibtex = `@article{${key},\n`;
        bibtex += `  title = {${article.title}},\n`;
        bibtex += `  author = {${authors}},\n`;
        bibtex += `  journal = {${article.journal}},\n`;
        bibtex += `  year = {${article.year}},\n`;
        if (article.volume) bibtex += `  volume = {${article.volume}},\n`;
        if (article.issue) bibtex += `  number = {${article.issue}},\n`;
        if (article.pages) bibtex += `  pages = {${article.pages}},\n`;
        if (article.doi) bibtex += `  doi = {${article.doi}},\n`;
        bibtex += `  pmid = {${article.pmid}}\n`;
        bibtex += '}\n\n';

        return bibtex;
    }).join('');
}

export default {
    searchPubMed,
    fetchArticleDetails,
    getArticleByPMID,
    searchClinicalTrials,
    searchSystematicReviews,
    getRelatedArticles,
    exportToRIS,
    exportToBibTeX
};
