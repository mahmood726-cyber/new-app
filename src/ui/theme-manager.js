/**
 * Theme Manager
 * Handles dark mode toggle with system preference detection
 */

import { getSetting, setSetting } from '../storage/database.js';

const THEME_KEY = 'theme';
const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
};

let currentTheme = THEMES.SYSTEM;
let mediaQuery = null;

/**
 * Initialize theme manager
 */
export async function initTheme() {
    // Load saved preference
    const savedTheme = await getSetting(THEME_KEY, THEMES.SYSTEM);
    currentTheme = savedTheme;

    // Set up system preference listener
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Apply initial theme
    applyTheme();

    // Create theme toggle button if not exists
    createThemeToggle();

    return currentTheme;
}

/**
 * Apply the current theme to the document
 */
function applyTheme() {
    const isDark = shouldUseDarkMode();

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#1a1a2e' : '#ffffff');
    }

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: currentTheme, isDark }
    }));
}

/**
 * Determine if dark mode should be used
 */
function shouldUseDarkMode() {
    if (currentTheme === THEMES.DARK) return true;
    if (currentTheme === THEMES.LIGHT) return false;
    // System preference
    return mediaQuery?.matches ?? false;
}

/**
 * Handle system theme preference change
 */
function handleSystemThemeChange() {
    if (currentTheme === THEMES.SYSTEM) {
        applyTheme();
    }
}

/**
 * Set the theme
 * @param {string} theme - 'light', 'dark', or 'system'
 */
export async function setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
        console.warn('Invalid theme:', theme);
        return;
    }

    currentTheme = theme;
    await setSetting(THEME_KEY, theme);
    applyTheme();
    updateToggleButton();
}

/**
 * Toggle between light and dark (ignoring system)
 */
export async function toggleTheme() {
    const isDark = shouldUseDarkMode();
    await setTheme(isDark ? THEMES.LIGHT : THEMES.DARK);
}

/**
 * Cycle through themes: light -> dark -> system
 */
export async function cycleTheme() {
    const order = [THEMES.LIGHT, THEMES.DARK, THEMES.SYSTEM];
    const currentIndex = order.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % order.length;
    await setTheme(order[nextIndex]);
}

/**
 * Get current theme
 */
export function getTheme() {
    return currentTheme;
}

/**
 * Check if currently in dark mode
 */
export function isDarkMode() {
    return shouldUseDarkMode();
}

/**
 * Create theme toggle button
 */
function createThemeToggle() {
    // Check if already exists
    if (document.getElementById('theme-toggle')) return;

    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Toggle theme');
    button.setAttribute('title', 'Toggle theme (Ctrl+Shift+L)');

    button.innerHTML = getThemeIcon();

    button.addEventListener('click', cycleTheme);

    // Add to DOM
    document.body.appendChild(button);

    // Add styles
    addThemeStyles();
}

/**
 * Update toggle button icon
 */
function updateToggleButton() {
    const button = document.getElementById('theme-toggle');
    if (button) {
        button.innerHTML = getThemeIcon();
    }
}

/**
 * Get icon for current theme
 */
function getThemeIcon() {
    const icons = {
        [THEMES.LIGHT]: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>`,
        [THEMES.DARK]: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>`,
        [THEMES.SYSTEM]: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>`
    };
    return icons[currentTheme] || icons[THEMES.SYSTEM];
}

/**
 * Add theme-related CSS
 */
function addThemeStyles() {
    if (document.getElementById('theme-styles')) return;

    const style = document.createElement('style');
    style.id = 'theme-styles';
    style.textContent = `
        /* Theme Toggle Button */
        .theme-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            transition: all 0.3s ease;
            background: var(--bg-secondary, #f0f0f0);
            color: var(--text-primary, #333);
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .theme-toggle:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .theme-toggle:active {
            transform: scale(0.95);
        }

        /* CSS Custom Properties for Light Theme */
        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f5f5f5;
            --bg-tertiary: #e8e8e8;
            --text-primary: #1a1a1a;
            --text-secondary: #666666;
            --text-muted: #999999;
            --accent-primary: #2563eb;
            --accent-secondary: #3b82f6;
            --border-color: #e0e0e0;
            --shadow-color: rgba(0, 0, 0, 0.1);
            --success-color: #22c55e;
            --warning-color: #f59e0b;
            --error-color: #ef4444;
            --info-color: #3b82f6;
        }

        /* Dark Theme */
        :root.dark,
        [data-theme="dark"] {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --bg-tertiary: #0f3460;
            --text-primary: #e8e8e8;
            --text-secondary: #a0a0a0;
            --text-muted: #707070;
            --accent-primary: #60a5fa;
            --accent-secondary: #93c5fd;
            --border-color: #2d3748;
            --shadow-color: rgba(0, 0, 0, 0.3);
            --success-color: #4ade80;
            --warning-color: #fbbf24;
            --error-color: #f87171;
            --info-color: #60a5fa;
        }

        /* Apply theme colors */
        body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* Smooth transitions for all themed elements */
        *, *::before, *::after {
            transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
        }
    `;

    document.head.appendChild(style);
}

export { THEMES };

export default {
    initTheme,
    setTheme,
    toggleTheme,
    cycleTheme,
    getTheme,
    isDarkMode,
    THEMES
};
