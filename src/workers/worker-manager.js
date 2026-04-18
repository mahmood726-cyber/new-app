/**
 * Web Worker Manager
 * Provides promise-based interface to the meta-analysis worker
 */

let worker = null;
let pendingRequests = new Map();
let requestId = 0;

/**
 * Initialize the worker
 * @returns {Worker}
 */
function getWorker() {
    if (!worker) {
        worker = new Worker(new URL('./meta-worker.js', import.meta.url), { type: 'module' });

        worker.onmessage = (event) => {
            const { id, success, result, error } = event.data;
            const pending = pendingRequests.get(id);

            if (pending) {
                pendingRequests.delete(id);
                if (success) {
                    pending.resolve(result);
                } else {
                    pending.reject(new Error(error));
                }
            }
        };

        worker.onerror = (error) => {
            console.error('Worker error:', error);
            // Reject all pending requests
            for (const [id, pending] of pendingRequests) {
                pending.reject(new Error('Worker error: ' + error.message));
                pendingRequests.delete(id);
            }
        };
    }
    return worker;
}

/**
 * Run a computation in the worker
 * @param {string} type - Computation type
 * @param {Object} payload - Data for computation
 * @param {number} timeout - Timeout in ms (default: 60000)
 * @returns {Promise<Object>}
 */
export function runInWorker(type, payload, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const id = ++requestId;
        const w = getWorker();

        // Set timeout
        const timeoutId = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Computation timed out after ${timeout}ms`));
        }, timeout);

        pendingRequests.set(id, {
            resolve: (result) => {
                clearTimeout(timeoutId);
                resolve(result);
            },
            reject: (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        });

        w.postMessage({ id, type, payload });
    });
}

/**
 * Run random effects meta-analysis in worker
 */
export function workerRandomEffects(studies, options = {}) {
    return runInWorker('randomEffectsMeta', { studies, options });
}

/**
 * Run fixed effects meta-analysis in worker
 */
export function workerFixedEffects(studies, options = {}) {
    return runInWorker('fixedEffectsMeta', { studies, options });
}

/**
 * Run bootstrap meta-analysis in worker
 */
export function workerBootstrap(studies, options = {}) {
    return runInWorker('bootstrapMeta', { studies, options }, 120000); // Longer timeout
}

/**
 * Run leave-one-out analysis in worker
 */
export function workerLeaveOneOut(studies, options = {}) {
    return runInWorker('leaveOneOut', { studies, options });
}

/**
 * Run cumulative meta-analysis in worker
 */
export function workerCumulative(studies, options = {}) {
    return runInWorker('cumulativeMeta', { studies, options });
}

/**
 * Terminate the worker
 */
export function terminateWorker() {
    if (worker) {
        worker.terminate();
        worker = null;
        pendingRequests.clear();
    }
}

/**
 * Check if Web Workers are supported
 */
export function isWorkerSupported() {
    return typeof Worker !== 'undefined';
}

/**
 * Run computation with automatic fallback to main thread
 * @param {Function} workerFn - Worker function to try first
 * @param {Function} mainThreadFn - Main thread fallback
 * @param {Array} args - Arguments for both functions
 * @returns {Promise<Object>}
 */
export async function runWithFallback(workerFn, mainThreadFn, ...args) {
    if (!isWorkerSupported()) {
        return mainThreadFn(...args);
    }

    try {
        return await workerFn(...args);
    } catch (error) {
        console.warn('Worker failed, falling back to main thread:', error.message);
        return mainThreadFn(...args);
    }
}

export default {
    runInWorker,
    workerRandomEffects,
    workerFixedEffects,
    workerBootstrap,
    workerLeaveOneOut,
    workerCumulative,
    terminateWorker,
    isWorkerSupported,
    runWithFallback
};
