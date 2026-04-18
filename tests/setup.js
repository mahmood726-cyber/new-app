/**
 * Test Setup File
 * Global configuration for Vitest
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Mock browser APIs not available in jsdom
global.performance = global.performance || {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn()
};

// Mock localStorage
const localStorageMock = {
    store: {},
    getItem: vi.fn((key) => localStorageMock.store[key] || null),
    setItem: vi.fn((key, value) => { localStorageMock.store[key] = value; }),
    removeItem: vi.fn((key) => { delete localStorageMock.store[key]; }),
    clear: vi.fn(() => { localStorageMock.store = {}; })
};
global.localStorage = localStorageMock;

// Mock fetch for API tests
global.fetch = vi.fn();

// Mock canvas for visualization tests
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: [] })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => []),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn()
}));

// Reset mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
});

// Cleanup after all tests
afterAll(() => {
    vi.restoreAllMocks();
});

// Console error/warn tracking
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    console.error = vi.fn((...args) => {
        originalConsoleError(...args);
    });
    console.warn = vi.fn((...args) => {
        originalConsoleWarn(...args);
    });
});

afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});
