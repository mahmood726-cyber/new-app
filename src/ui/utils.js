/**
 * UI Utilities
 * Loading spinners, copy to clipboard, auto-save, and notifications
 */

import { updateProject, getProject } from '../storage/database.js';

// ============================================================
// LOADING SPINNERS
// ============================================================

/**
 * Create a loading spinner element
 * @param {Object} options - Spinner options
 * @returns {HTMLElement} Spinner element
 */
export function createSpinner(options = {}) {
    const {
        size = 'medium', // small, medium, large
        color = 'var(--accent-primary, #2563eb)',
        text = '',
        overlay = false
    } = options;

    const sizes = {
        small: 20,
        medium: 40,
        large: 60
    };

    const spinnerSize = sizes[size] || sizes.medium;

    const container = document.createElement('div');
    container.className = `spinner-container ${overlay ? 'spinner-overlay' : ''}`;

    container.innerHTML = `
        <div class="spinner" style="width: ${spinnerSize}px; height: ${spinnerSize}px;">
            <svg viewBox="0 0 50 50" class="spinner-svg">
                <circle cx="25" cy="25" r="20" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
            </svg>
        </div>
        ${text ? `<p class="spinner-text">${text}</p>` : ''}
    `;

    addSpinnerStyles();
    return container;
}

/**
 * Show loading spinner on an element
 * @param {HTMLElement} element - Target element
 * @param {Object} options - Spinner options
 * @returns {Function} Remove function
 */
export function showSpinner(element, options = {}) {
    const spinner = createSpinner({ ...options, overlay: true });
    element.style.position = 'relative';
    element.appendChild(spinner);

    return () => spinner.remove();
}

/**
 * Show global loading overlay
 * @param {string} text - Loading text
 * @returns {Function} Remove function
 */
export function showGlobalSpinner(text = 'Loading...') {
    const existing = document.getElementById('global-spinner');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'global-spinner';
    overlay.className = 'global-spinner-overlay';

    overlay.innerHTML = `
        <div class="global-spinner-content">
            <div class="spinner" style="width: 60px; height: 60px;">
                <svg viewBox="0 0 50 50" class="spinner-svg">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="var(--accent-primary, #2563eb)" stroke-width="4" stroke-linecap="round"/>
                </svg>
            </div>
            <p class="spinner-text">${text}</p>
        </div>
    `;

    addSpinnerStyles();
    document.body.appendChild(overlay);

    return () => overlay.remove();
}

/**
 * Add spinner CSS styles
 */
function addSpinnerStyles() {
    if (document.getElementById('spinner-styles')) return;

    const style = document.createElement('style');
    style.id = 'spinner-styles';
    style.textContent = `
        .spinner-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }

        .spinner-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            z-index: 100;
        }

        :root.dark .spinner-overlay {
            background: rgba(26, 26, 46, 0.8);
        }

        .global-spinner-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }

        .global-spinner-content {
            background: var(--bg-primary, #fff);
            padding: 30px 50px;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .spinner {
            animation: spin 1s linear infinite;
        }

        .spinner-svg circle {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: 0;
            animation: dash 1.5s ease-in-out infinite;
        }

        @keyframes spin {
            100% { transform: rotate(360deg); }
        }

        @keyframes dash {
            0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
            50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
            100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
        }

        .spinner-text {
            margin: 0;
            color: var(--text-secondary, #666);
            font-size: 14px;
        }
    `;

    document.head.appendChild(style);
}

// ============================================================
// COPY TO CLIPBOARD
// ============================================================

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @param {Object} options - Options
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text, options = {}) {
    const { showNotification = true, successMessage = 'Copied to clipboard' } = options;

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }

        if (showNotification) {
            showToast(successMessage, 'success');
        }

        return true;
    } catch (error) {
        console.error('Copy failed:', error);
        if (showNotification) {
            showToast('Failed to copy', 'error');
        }
        return false;
    }
}

/**
 * Copy table data as TSV (for pasting into Excel)
 * @param {Object[][]} data - 2D array of table data
 * @param {string[]} headers - Column headers
 * @returns {Promise<boolean>} Success status
 */
export async function copyTableAsExcel(data, headers = []) {
    let tsv = '';

    if (headers.length > 0) {
        tsv += headers.join('\t') + '\n';
    }

    for (const row of data) {
        tsv += row.join('\t') + '\n';
    }

    return copyToClipboard(tsv, {
        successMessage: 'Table copied (paste into Excel)'
    });
}

/**
 * Add copy button to an element
 * @param {HTMLElement} element - Target element
 * @param {Function} getContent - Function to get content to copy
 * @param {Object} options - Button options
 */
export function addCopyButton(element, getContent, options = {}) {
    const { position = 'top-right', label = 'Copy' } = options;

    const button = document.createElement('button');
    button.className = `copy-button copy-button-${position}`;
    button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <span>${label}</span>
    `;

    button.addEventListener('click', async () => {
        const content = typeof getContent === 'function' ? await getContent() : getContent;
        const success = await copyToClipboard(content);

        if (success) {
            button.classList.add('copied');
            button.querySelector('span').textContent = 'Copied!';
            setTimeout(() => {
                button.classList.remove('copied');
                button.querySelector('span').textContent = label;
            }, 2000);
        }
    });

    element.style.position = 'relative';
    element.appendChild(button);

    addCopyButtonStyles();
}

/**
 * Add copy button styles
 */
function addCopyButtonStyles() {
    if (document.getElementById('copy-button-styles')) return;

    const style = document.createElement('style');
    style.id = 'copy-button-styles';
    style.textContent = `
        .copy-button {
            position: absolute;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: var(--bg-secondary, #f5f5f5);
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s, background 0.2s;
        }

        .copy-button:hover {
            opacity: 1;
            background: var(--bg-tertiary, #e8e8e8);
        }

        .copy-button.copied {
            background: var(--success-color, #22c55e);
            color: white;
            border-color: var(--success-color, #22c55e);
        }

        .copy-button-top-right { top: 8px; right: 8px; }
        .copy-button-top-left { top: 8px; left: 8px; }
        .copy-button-bottom-right { bottom: 8px; right: 8px; }
        .copy-button-bottom-left { bottom: 8px; left: 8px; }
    `;

    document.head.appendChild(style);
}

// ============================================================
// AUTO-SAVE
// ============================================================

let autoSaveTimer = null;
let autoSaveEnabled = true;
let autoSaveDelay = 3000; // 3 seconds
let pendingChanges = null;

/**
 * Initialize auto-save functionality
 * @param {Object} options - Auto-save options
 */
export function initAutoSave(options = {}) {
    autoSaveEnabled = options.enabled !== false;
    autoSaveDelay = options.delay || 3000;

    // Listen for project changes
    window.addEventListener('projectChange', handleProjectChange);

    // Save before unload
    window.addEventListener('beforeunload', (e) => {
        if (pendingChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes.';
        }
    });
}

/**
 * Handle project change event
 */
function handleProjectChange(event) {
    if (!autoSaveEnabled) return;

    pendingChanges = event.detail;

    // Debounce save
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(async () => {
        await performAutoSave();
    }, autoSaveDelay);

    // Show unsaved indicator
    showUnsavedIndicator();
}

/**
 * Perform auto-save
 */
async function performAutoSave() {
    if (!pendingChanges) return;

    try {
        showAutoSaveStatus('saving');

        await updateProject(pendingChanges);

        pendingChanges = null;
        showAutoSaveStatus('saved');

        // Hide indicator after 2 seconds
        setTimeout(() => {
            hideAutoSaveStatus();
        }, 2000);
    } catch (error) {
        console.error('Auto-save failed:', error);
        showAutoSaveStatus('error');
    }
}

/**
 * Manually trigger save
 */
export async function saveNow() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    await performAutoSave();
}

/**
 * Show unsaved changes indicator
 */
function showUnsavedIndicator() {
    let indicator = document.getElementById('autosave-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autosave-indicator';
        document.body.appendChild(indicator);
        addAutoSaveStyles();
    }

    indicator.className = 'autosave-indicator unsaved';
    indicator.innerHTML = `
        <span class="indicator-dot"></span>
        <span>Unsaved changes</span>
    `;
}

/**
 * Show auto-save status
 */
function showAutoSaveStatus(status) {
    let indicator = document.getElementById('autosave-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autosave-indicator';
        document.body.appendChild(indicator);
        addAutoSaveStyles();
    }

    const messages = {
        saving: '<span class="spinner-small"></span><span>Saving...</span>',
        saved: '<span class="check-icon">✓</span><span>Saved</span>',
        error: '<span class="error-icon">✗</span><span>Save failed</span>'
    };

    indicator.className = `autosave-indicator ${status}`;
    indicator.innerHTML = messages[status];
}

/**
 * Hide auto-save status
 */
function hideAutoSaveStatus() {
    const indicator = document.getElementById('autosave-indicator');
    if (indicator) {
        indicator.classList.add('hidden');
    }
}

/**
 * Add auto-save styles
 */
function addAutoSaveStyles() {
    if (document.getElementById('autosave-styles')) return;

    const style = document.createElement('style');
    style.id = 'autosave-styles';
    style.textContent = `
        .autosave-indicator {
            position: fixed;
            bottom: 20px;
            left: 20px;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: var(--bg-secondary, #f5f5f5);
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 6px;
            font-size: 12px;
            color: var(--text-secondary, #666);
            z-index: 1000;
            transition: opacity 0.3s, transform 0.3s;
        }

        .autosave-indicator.hidden {
            opacity: 0;
            transform: translateY(10px);
            pointer-events: none;
        }

        .autosave-indicator .indicator-dot {
            width: 8px;
            height: 8px;
            background: var(--warning-color, #f59e0b);
            border-radius: 50%;
        }

        .autosave-indicator.saved {
            color: var(--success-color, #22c55e);
        }

        .autosave-indicator.error {
            color: var(--error-color, #ef4444);
        }

        .autosave-indicator .spinner-small {
            width: 12px;
            height: 12px;
            border: 2px solid var(--border-color, #e0e0e0);
            border-top-color: var(--accent-primary, #2563eb);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        .autosave-indicator .check-icon {
            color: var(--success-color, #22c55e);
            font-weight: bold;
        }

        .autosave-indicator .error-icon {
            color: var(--error-color, #ef4444);
            font-weight: bold;
        }
    `;

    document.head.appendChild(style);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

/**
 * Show a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Type: success, error, warning, info
 * @param {number} duration - Duration in ms (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
        addToastStyles();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

/**
 * Add toast styles
 */
function addToastStyles() {
    if (document.getElementById('toast-styles')) return;

    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        #toast-container {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 10001;
            pointer-events: none;
        }

        .toast {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: var(--bg-primary, #fff);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            pointer-events: all;
            animation: slideIn 0.3s ease;
            max-width: 350px;
        }

        .toast.hiding {
            animation: slideOut 0.3s ease forwards;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }

        .toast-icon {
            font-size: 16px;
            font-weight: bold;
        }

        .toast-success .toast-icon { color: var(--success-color, #22c55e); }
        .toast-error .toast-icon { color: var(--error-color, #ef4444); }
        .toast-warning .toast-icon { color: var(--warning-color, #f59e0b); }
        .toast-info .toast-icon { color: var(--info-color, #3b82f6); }

        .toast-message {
            flex: 1;
            font-size: 14px;
            color: var(--text-primary, #333);
        }

        .toast-close {
            background: none;
            border: none;
            font-size: 18px;
            color: var(--text-muted, #999);
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }

        .toast-close:hover {
            color: var(--text-primary, #333);
        }
    `;

    document.head.appendChild(style);
}

export default {
    createSpinner,
    showSpinner,
    showGlobalSpinner,
    copyToClipboard,
    copyTableAsExcel,
    addCopyButton,
    initAutoSave,
    saveNow,
    showToast
};
