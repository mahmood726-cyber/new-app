/**
 * IndexedDB Persistence Layer
 * Provides offline-first storage for meta-analysis projects
 */

const DB_NAME = 'MetaAnalysisPlatform';
const DB_VERSION = 1;

// Store names
const STORES = {
    PROJECTS: 'projects',
    STUDIES: 'studies',
    ANALYSES: 'analyses',
    EXPORTS: 'exports',
    SETTINGS: 'settings'
};

let db = null;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function initDatabase() {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error('Failed to open database: ' + request.error));
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Projects store - main container for meta-analyses
            if (!database.objectStoreNames.contains(STORES.PROJECTS)) {
                const projectStore = database.createObjectStore(STORES.PROJECTS, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                projectStore.createIndex('name', 'name', { unique: false });
                projectStore.createIndex('createdAt', 'createdAt', { unique: false });
                projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            // Studies store - individual studies within projects
            if (!database.objectStoreNames.contains(STORES.STUDIES)) {
                const studyStore = database.createObjectStore(STORES.STUDIES, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                studyStore.createIndex('projectId', 'projectId', { unique: false });
                studyStore.createIndex('study', 'study', { unique: false });
                studyStore.createIndex('year', 'year', { unique: false });
            }

            // Analyses store - saved analysis results
            if (!database.objectStoreNames.contains(STORES.ANALYSES)) {
                const analysisStore = database.createObjectStore(STORES.ANALYSES, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                analysisStore.createIndex('projectId', 'projectId', { unique: false });
                analysisStore.createIndex('type', 'type', { unique: false });
                analysisStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // Exports store - cached export files
            if (!database.objectStoreNames.contains(STORES.EXPORTS)) {
                const exportStore = database.createObjectStore(STORES.EXPORTS, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                exportStore.createIndex('projectId', 'projectId', { unique: false });
                exportStore.createIndex('format', 'format', { unique: false });
            }

            // Settings store - user preferences
            if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
                database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }
        };
    });
}

/**
 * Get a transaction for the specified stores
 * @param {string|string[]} storeNames - Store name(s)
 * @param {string} mode - 'readonly' or 'readwrite'
 * @returns {IDBTransaction}
 */
function getTransaction(storeNames, mode = 'readonly') {
    if (!db) throw new Error('Database not initialized');
    return db.transaction(storeNames, mode);
}

// ============================================================
// PROJECT OPERATIONS
// ============================================================

/**
 * Create a new project
 * @param {Object} project - Project data
 * @returns {Promise<number>} Project ID
 */
export async function createProject(project) {
    await initDatabase();

    const projectData = {
        ...project,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.PROJECTS, 'readwrite');
        const store = tx.objectStore(STORES.PROJECTS);
        const request = store.add(projectData);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a project by ID
 * @param {number} id - Project ID
 * @returns {Promise<Object>}
 */
export async function getProject(id) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.PROJECTS);
        const store = tx.objectStore(STORES.PROJECTS);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all projects
 * @returns {Promise<Object[]>}
 */
export async function getAllProjects() {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.PROJECTS);
        const store = tx.objectStore(STORES.PROJECTS);
        const request = store.getAll();

        request.onsuccess = () => {
            const projects = request.result.sort((a, b) =>
                new Date(b.updatedAt) - new Date(a.updatedAt)
            );
            resolve(projects);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update a project
 * @param {Object} project - Project data with id
 * @returns {Promise<void>}
 */
export async function updateProject(project) {
    await initDatabase();

    const updatedProject = {
        ...project,
        updatedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.PROJECTS, 'readwrite');
        const store = tx.objectStore(STORES.PROJECTS);
        const request = store.put(updatedProject);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a project and all associated data
 * @param {number} id - Project ID
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
    await initDatabase();

    // Delete associated studies
    const studies = await getStudiesByProject(id);
    for (const study of studies) {
        await deleteStudy(study.id);
    }

    // Delete associated analyses
    const analyses = await getAnalysesByProject(id);
    for (const analysis of analyses) {
        await deleteAnalysis(analysis.id);
    }

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.PROJECTS, 'readwrite');
        const store = tx.objectStore(STORES.PROJECTS);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================================
// STUDY OPERATIONS
// ============================================================

/**
 * Add a study to a project
 * @param {Object} study - Study data
 * @returns {Promise<number>} Study ID
 */
export async function addStudy(study) {
    await initDatabase();

    const studyData = {
        ...study,
        createdAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.STUDIES, 'readwrite');
        const store = tx.objectStore(STORES.STUDIES);
        const request = store.add(studyData);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get studies for a project
 * @param {number} projectId - Project ID
 * @returns {Promise<Object[]>}
 */
export async function getStudiesByProject(projectId) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.STUDIES);
        const store = tx.objectStore(STORES.STUDIES);
        const index = store.index('projectId');
        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update a study
 * @param {Object} study - Study data with id
 * @returns {Promise<void>}
 */
export async function updateStudy(study) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.STUDIES, 'readwrite');
        const store = tx.objectStore(STORES.STUDIES);
        const request = store.put(study);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a study
 * @param {number} id - Study ID
 * @returns {Promise<void>}
 */
export async function deleteStudy(id) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.STUDIES, 'readwrite');
        const store = tx.objectStore(STORES.STUDIES);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Bulk add studies
 * @param {Object[]} studies - Array of study objects
 * @returns {Promise<number[]>} Array of study IDs
 */
export async function bulkAddStudies(studies) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.STUDIES, 'readwrite');
        const store = tx.objectStore(STORES.STUDIES);
        const ids = [];

        tx.oncomplete = () => resolve(ids);
        tx.onerror = () => reject(tx.error);

        for (const study of studies) {
            const request = store.add({
                ...study,
                createdAt: new Date().toISOString()
            });
            request.onsuccess = () => ids.push(request.result);
        }
    });
}

// ============================================================
// ANALYSIS OPERATIONS
// ============================================================

/**
 * Save an analysis result
 * @param {Object} analysis - Analysis data
 * @returns {Promise<number>} Analysis ID
 */
export async function saveAnalysis(analysis) {
    await initDatabase();

    const analysisData = {
        ...analysis,
        createdAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.ANALYSES, 'readwrite');
        const store = tx.objectStore(STORES.ANALYSES);
        const request = store.add(analysisData);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get analyses for a project
 * @param {number} projectId - Project ID
 * @returns {Promise<Object[]>}
 */
export async function getAnalysesByProject(projectId) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.ANALYSES);
        const store = tx.objectStore(STORES.ANALYSES);
        const index = store.index('projectId');
        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete an analysis
 * @param {number} id - Analysis ID
 * @returns {Promise<void>}
 */
export async function deleteAnalysis(id) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.ANALYSES, 'readwrite');
        const store = tx.objectStore(STORES.ANALYSES);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================================
// SETTINGS OPERATIONS
// ============================================================

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>}
 */
export async function getSetting(key, defaultValue = null) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.SETTINGS);
        const store = tx.objectStore(STORES.SETTINGS);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result?.value ?? defaultValue);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.SETTINGS, 'readwrite');
        const store = tx.objectStore(STORES.SETTINGS);
        const request = store.put({ key, value });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all settings
 * @returns {Promise<Object>}
 */
export async function getAllSettings() {
    await initDatabase();

    return new Promise((resolve, reject) => {
        const tx = getTransaction(STORES.SETTINGS);
        const store = tx.objectStore(STORES.SETTINGS);
        const request = store.getAll();

        request.onsuccess = () => {
            const settings = {};
            for (const item of request.result) {
                settings[item.key] = item.value;
            }
            resolve(settings);
        };
        request.onerror = () => reject(request.error);
    });
}

// ============================================================
// IMPORT/EXPORT OPERATIONS
// ============================================================

/**
 * Export entire database to JSON
 * @returns {Promise<Object>}
 */
export async function exportDatabase() {
    await initDatabase();

    const data = {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        projects: await getAllProjects(),
        studies: [],
        analyses: [],
        settings: await getAllSettings()
    };

    // Get all studies and analyses
    for (const project of data.projects) {
        const studies = await getStudiesByProject(project.id);
        const analyses = await getAnalysesByProject(project.id);
        data.studies.push(...studies);
        data.analyses.push(...analyses);
    }

    return data;
}

/**
 * Import database from JSON
 * @param {Object} data - Exported database data
 * @param {boolean} replace - Replace existing data (default: false, merge)
 * @returns {Promise<Object>} Import summary
 */
export async function importDatabase(data, replace = false) {
    await initDatabase();

    const summary = {
        projects: 0,
        studies: 0,
        analyses: 0,
        settings: 0
    };

    if (replace) {
        // Clear all stores
        await clearDatabase();
    }

    // Import projects
    for (const project of data.projects || []) {
        const { id, ...projectData } = project;
        await createProject(projectData);
        summary.projects++;
    }

    // Import studies
    for (const study of data.studies || []) {
        const { id, ...studyData } = study;
        await addStudy(studyData);
        summary.studies++;
    }

    // Import analyses
    for (const analysis of data.analyses || []) {
        const { id, ...analysisData } = analysis;
        await saveAnalysis(analysisData);
        summary.analyses++;
    }

    // Import settings
    for (const [key, value] of Object.entries(data.settings || {})) {
        await setSetting(key, value);
        summary.settings++;
    }

    return summary;
}

/**
 * Clear all data from the database
 * @returns {Promise<void>}
 */
export async function clearDatabase() {
    await initDatabase();

    const storeNames = Object.values(STORES);

    return new Promise((resolve, reject) => {
        const tx = getTransaction(storeNames, 'readwrite');

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        for (const storeName of storeNames) {
            tx.objectStore(storeName).clear();
        }
    });
}

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
export async function getDatabaseStats() {
    await initDatabase();

    const projects = await getAllProjects();
    let totalStudies = 0;
    let totalAnalyses = 0;

    for (const project of projects) {
        const studies = await getStudiesByProject(project.id);
        const analyses = await getAnalysesByProject(project.id);
        totalStudies += studies.length;
        totalAnalyses += analyses.length;
    }

    return {
        projects: projects.length,
        studies: totalStudies,
        analyses: totalAnalyses,
        lastUpdated: projects[0]?.updatedAt || null
    };
}

// Default export
export default {
    initDatabase,
    createProject,
    getProject,
    getAllProjects,
    updateProject,
    deleteProject,
    addStudy,
    getStudiesByProject,
    updateStudy,
    deleteStudy,
    bulkAddStudies,
    saveAnalysis,
    getAnalysesByProject,
    deleteAnalysis,
    getSetting,
    setSetting,
    getAllSettings,
    exportDatabase,
    importDatabase,
    clearDatabase,
    getDatabaseStats,
    STORES
};
