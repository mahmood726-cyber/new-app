/**
 * Keyboard Shortcuts Manager
 * Global hotkeys for common actions
 */

import { toggleTheme } from './theme-manager.js';

// Registered shortcuts
const shortcuts = new Map();

// Default shortcuts configuration
const defaultShortcuts = [
    // File operations
    { keys: 'Ctrl+N', action: 'newProject', description: 'Create new project' },
    { keys: 'Ctrl+O', action: 'openProject', description: 'Open project' },
    { keys: 'Ctrl+S', action: 'saveProject', description: 'Save project' },
    { keys: 'Ctrl+Shift+S', action: 'exportProject', description: 'Export project' },

    // Analysis
    { keys: 'Ctrl+R', action: 'runAnalysis', description: 'Run meta-analysis' },
    { keys: 'Ctrl+Shift+R', action: 'runAllAnalyses', description: 'Run all analyses' },

    // Navigation
    { keys: 'Ctrl+1', action: 'goToData', description: 'Go to Data tab' },
    { keys: 'Ctrl+2', action: 'goToAnalysis', description: 'Go to Analysis tab' },
    { keys: 'Ctrl+3', action: 'goToPlots', description: 'Go to Plots tab' },
    { keys: 'Ctrl+4', action: 'goToExport', description: 'Go to Export tab' },

    // View
    { keys: 'Ctrl+Shift+L', action: 'toggleTheme', description: 'Toggle dark mode' },
    { keys: 'F11', action: 'toggleFullscreen', description: 'Toggle fullscreen' },
    { keys: 'Ctrl+Shift+H', action: 'toggleHelp', description: 'Show keyboard shortcuts' },

    // Data
    { keys: 'Ctrl+I', action: 'importData', description: 'Import data' },
    { keys: 'Ctrl+Shift+I', action: 'importPDF', description: 'Import from PDF' },
    { keys: 'Delete', action: 'deleteSelected', description: 'Delete selected studies' },

    // Editing
    { keys: 'Ctrl+Z', action: 'undo', description: 'Undo' },
    { keys: 'Ctrl+Shift+Z', action: 'redo', description: 'Redo' },
    { keys: 'Ctrl+A', action: 'selectAll', description: 'Select all studies' },
    { keys: 'Escape', action: 'clearSelection', description: 'Clear selection/Close modal' }
];

// Action handlers
const actionHandlers = new Map();

/**
 * Initialize keyboard shortcuts
 */
export function initKeyboardShortcuts() {
    // Register default handlers
    registerDefaultHandlers();

    // Parse and register shortcuts
    for (const shortcut of defaultShortcuts) {
        registerShortcut(shortcut.keys, shortcut.action, shortcut.description);
    }

    // Add global event listener
    document.addEventListener('keydown', handleKeyDown);

    console.log('Keyboard shortcuts initialized');
}

/**
 * Register default action handlers
 */
function registerDefaultHandlers() {
    // Theme
    registerAction('toggleTheme', () => toggleTheme());

    // Fullscreen
    registerAction('toggleFullscreen', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    });

    // Help
    registerAction('toggleHelp', () => showShortcutsHelp());

    // Clear selection / Close modal
    registerAction('clearSelection', () => {
        // Close any open modal
        const modal = document.querySelector('.modal.open, .modal.show, [data-modal-open]');
        if (modal) {
            modal.classList.remove('open', 'show');
            modal.removeAttribute('data-modal-open');
            return;
        }

        // Clear text selection
        window.getSelection()?.removeAllRanges();

        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('clearSelection'));
    });

    // Undo/Redo (dispatch events for history manager)
    registerAction('undo', () => window.dispatchEvent(new CustomEvent('undo')));
    registerAction('redo', () => window.dispatchEvent(new CustomEvent('redo')));

    // Navigation (dispatch events for tab manager)
    registerAction('goToData', () => navigateToTab('data'));
    registerAction('goToAnalysis', () => navigateToTab('analysis'));
    registerAction('goToPlots', () => navigateToTab('plots'));
    registerAction('goToExport', () => navigateToTab('export'));

    // File operations (dispatch events)
    registerAction('newProject', () => window.dispatchEvent(new CustomEvent('newProject')));
    registerAction('openProject', () => window.dispatchEvent(new CustomEvent('openProject')));
    registerAction('saveProject', () => window.dispatchEvent(new CustomEvent('saveProject')));
    registerAction('exportProject', () => window.dispatchEvent(new CustomEvent('exportProject')));

    // Analysis
    registerAction('runAnalysis', () => window.dispatchEvent(new CustomEvent('runAnalysis')));
    registerAction('runAllAnalyses', () => window.dispatchEvent(new CustomEvent('runAllAnalyses')));

    // Data operations
    registerAction('importData', () => window.dispatchEvent(new CustomEvent('importData')));
    registerAction('importPDF', () => window.dispatchEvent(new CustomEvent('importPDF')));
    registerAction('deleteSelected', () => window.dispatchEvent(new CustomEvent('deleteSelected')));
    registerAction('selectAll', () => window.dispatchEvent(new CustomEvent('selectAll')));
}

/**
 * Navigate to a tab
 */
function navigateToTab(tabId) {
    const tab = document.querySelector(`[data-tab="${tabId}"], #${tabId}-tab, .tab-${tabId}`);
    if (tab) {
        tab.click();
    }
    window.dispatchEvent(new CustomEvent('navigateTab', { detail: { tab: tabId } }));
}

/**
 * Parse key combination string
 */
function parseKeys(keyString) {
    const parts = keyString.split('+').map(p => p.trim().toLowerCase());
    return {
        ctrl: parts.includes('ctrl') || parts.includes('control'),
        alt: parts.includes('alt'),
        shift: parts.includes('shift'),
        meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
        key: parts.filter(p => !['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd', 'command'].includes(p))[0]
    };
}

/**
 * Register a keyboard shortcut
 */
export function registerShortcut(keys, action, description = '') {
    const parsed = parseKeys(keys);
    const id = `${parsed.ctrl ? 'ctrl+' : ''}${parsed.alt ? 'alt+' : ''}${parsed.shift ? 'shift+' : ''}${parsed.meta ? 'meta+' : ''}${parsed.key}`;

    shortcuts.set(id, {
        keys,
        parsed,
        action,
        description
    });
}

/**
 * Register an action handler
 */
export function registerAction(action, handler) {
    actionHandlers.set(action, handler);
}

/**
 * Handle keydown events
 */
function handleKeyDown(event) {
    // Ignore if user is typing in an input
    if (isInputFocused() && !event.key.startsWith('F') && event.key !== 'Escape') {
        return;
    }

    // Build key ID
    const key = event.key.toLowerCase();
    const id = `${event.ctrlKey ? 'ctrl+' : ''}${event.altKey ? 'alt+' : ''}${event.shiftKey ? 'shift+' : ''}${event.metaKey ? 'meta+' : ''}${key}`;

    const shortcut = shortcuts.get(id);
    if (!shortcut) return;

    // Get handler
    const handler = actionHandlers.get(shortcut.action);
    if (!handler) return;

    // Prevent default for our shortcuts
    event.preventDefault();
    event.stopPropagation();

    // Execute handler
    try {
        handler(event);
    } catch (error) {
        console.error(`Error executing shortcut ${shortcut.keys}:`, error);
    }
}

/**
 * Check if an input element is focused
 */
function isInputFocused() {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const tagName = activeElement.tagName.toLowerCase();
    return tagName === 'input' ||
           tagName === 'textarea' ||
           tagName === 'select' ||
           activeElement.isContentEditable;
}

/**
 * Get all registered shortcuts
 */
export function getShortcuts() {
    return Array.from(shortcuts.values()).map(s => ({
        keys: s.keys,
        action: s.action,
        description: s.description
    }));
}

/**
 * Show shortcuts help modal
 */
export function showShortcutsHelp() {
    // Remove existing modal
    const existing = document.getElementById('shortcuts-help-modal');
    if (existing) existing.remove();

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'shortcuts-help-modal';
    modal.className = 'shortcuts-modal';
    modal.innerHTML = `
        <div class="shortcuts-modal-content">
            <div class="shortcuts-modal-header">
                <h2>Keyboard Shortcuts</h2>
                <button class="close-btn" aria-label="Close">&times;</button>
            </div>
            <div class="shortcuts-modal-body">
                ${generateShortcutsHTML()}
            </div>
            <div class="shortcuts-modal-footer">
                <p>Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> or <kbd>Escape</kbd> to close</p>
            </div>
        </div>
    `;

    // Add styles if not already present
    addShortcutsStyles();

    // Add event listeners
    modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);

    // Focus for accessibility
    modal.focus();
}

/**
 * Generate HTML for shortcuts list
 */
function generateShortcutsHTML() {
    const categories = {
        'File': ['newProject', 'openProject', 'saveProject', 'exportProject'],
        'Analysis': ['runAnalysis', 'runAllAnalyses'],
        'Navigation': ['goToData', 'goToAnalysis', 'goToPlots', 'goToExport'],
        'View': ['toggleTheme', 'toggleFullscreen', 'toggleHelp'],
        'Data': ['importData', 'importPDF', 'deleteSelected', 'selectAll'],
        'Editing': ['undo', 'redo', 'clearSelection']
    };

    let html = '';

    for (const [category, actions] of Object.entries(categories)) {
        const categoryShortcuts = Array.from(shortcuts.values())
            .filter(s => actions.includes(s.action));

        if (categoryShortcuts.length === 0) continue;

        html += `<div class="shortcuts-category">
            <h3>${category}</h3>
            <div class="shortcuts-list">
                ${categoryShortcuts.map(s => `
                    <div class="shortcut-item">
                        <span class="shortcut-description">${s.description}</span>
                        <span class="shortcut-keys">${formatKeys(s.keys)}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    return html;
}

/**
 * Format key combination for display
 */
function formatKeys(keys) {
    return keys.split('+')
        .map(k => `<kbd>${k.trim()}</kbd>`)
        .join(' + ');
}

/**
 * Add CSS styles for shortcuts modal
 */
function addShortcutsStyles() {
    if (document.getElementById('shortcuts-styles')) return;

    const style = document.createElement('style');
    style.id = 'shortcuts-styles';
    style.textContent = `
        .shortcuts-modal {
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
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .shortcuts-modal-content {
            background: var(--bg-primary, #fff);
            border-radius: 12px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .shortcuts-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .shortcuts-modal-header h2 {
            margin: 0;
            font-size: 1.25rem;
            color: var(--text-primary, #333);
        }

        .shortcuts-modal-header .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary, #666);
            padding: 0;
            line-height: 1;
        }

        .shortcuts-modal-header .close-btn:hover {
            color: var(--text-primary, #333);
        }

        .shortcuts-modal-body {
            padding: 20px;
            overflow-y: auto;
            max-height: calc(80vh - 140px);
        }

        .shortcuts-category {
            margin-bottom: 20px;
        }

        .shortcuts-category:last-child {
            margin-bottom: 0;
        }

        .shortcuts-category h3 {
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted, #999);
            margin: 0 0 10px 0;
        }

        .shortcuts-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .shortcut-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: var(--bg-secondary, #f5f5f5);
            border-radius: 6px;
        }

        .shortcut-description {
            color: var(--text-primary, #333);
        }

        .shortcut-keys {
            display: flex;
            gap: 4px;
            align-items: center;
        }

        .shortcut-keys kbd {
            display: inline-block;
            padding: 3px 8px;
            font-family: inherit;
            font-size: 0.75rem;
            background: var(--bg-tertiary, #e8e8e8);
            border: 1px solid var(--border-color, #ddd);
            border-radius: 4px;
            color: var(--text-primary, #333);
        }

        .shortcuts-modal-footer {
            padding: 12px 20px;
            border-top: 1px solid var(--border-color, #e0e0e0);
            text-align: center;
        }

        .shortcuts-modal-footer p {
            margin: 0;
            font-size: 0.875rem;
            color: var(--text-muted, #999);
        }

        .shortcuts-modal-footer kbd {
            display: inline-block;
            padding: 2px 6px;
            font-family: inherit;
            font-size: 0.75rem;
            background: var(--bg-secondary, #f5f5f5);
            border: 1px solid var(--border-color, #ddd);
            border-radius: 3px;
        }
    `;

    document.head.appendChild(style);
}

/**
 * Cleanup keyboard shortcuts
 */
export function destroyKeyboardShortcuts() {
    document.removeEventListener('keydown', handleKeyDown);
    shortcuts.clear();
    actionHandlers.clear();
}

export default {
    initKeyboardShortcuts,
    registerShortcut,
    registerAction,
    getShortcuts,
    showShortcutsHelp,
    destroyKeyboardShortcuts
};
