/**
 * Shared Test Hooks and Utilities
 *
 * Phase 1.5: Test Quality Improvements - Task 1.5.6
 *
 * This file provides reusable test setup, teardown, and helper functions
 * to eliminate ~1,500 LOC of duplication across 24+ test files.
 *
 * Usage:
 * ```javascript
 * import { useBrowserMocks, useWindowAlertMock, queryByName } from '../helpers/test-hooks';
 *
 * describe('MyTest', () => {
 *   const mocks = useBrowserMocks();
 *
 *   it('does something', () => {
 *     // mocks.alert, mocks.confirm, mocks.blob, etc. are available
 *   });
 * });
 * ```
 */

import { vi } from 'vitest';

/**
 * Hook: useWindowAlertMock
 *
 * Sets up window.alert mock in beforeEach, restores in afterEach
 *
 * @param {Function} beforeEachFn - Vitest beforeEach function
 * @param {Function} afterEachFn - Vitest afterEach function
 * @returns {Object} Mock functions object
 *
 * @example
 * const mocks = useWindowAlertMock(beforeEach, afterEach);
 * // In test: mocks.alert.mockClear();
 */
export function useWindowAlertMock(beforeEachFn, afterEachFn) {
  const mocks = { alert: null };

  beforeEachFn(() => {
    mocks.alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEachFn(() => {
    vi.restoreAllMocks();
  });

  return mocks;
}

/**
 * Hook: useWindowConfirmMock
 *
 * Sets up window.confirm mock in beforeEach, restores in afterEach
 *
 * @param {Function} beforeEachFn - Vitest beforeEach function
 * @param {Function} afterEachFn - Vitest afterEach function
 * @param {boolean} defaultReturn - Default return value (true/false)
 * @returns {Object} Mock functions object
 *
 * @example
 * const mocks = useWindowConfirmMock(beforeEach, afterEach, true);
 * // In test: mocks.confirm.mockReturnValueOnce(false);
 */
export function useWindowConfirmMock(beforeEachFn, afterEachFn, defaultReturn = true) {
  const mocks = { confirm: null };

  beforeEachFn(() => {
    mocks.confirm = vi.spyOn(window, 'confirm').mockReturnValue(defaultReturn);
  });

  afterEachFn(() => {
    vi.restoreAllMocks();
  });

  return mocks;
}

/**
 * Hook: useBlobMock
 *
 * Sets up Blob constructor mock in beforeEach, restores in afterEach
 *
 * @param {Function} beforeEachFn - Vitest beforeEach function
 * @param {Function} afterEachFn - Vitest afterEach function
 * @returns {Object} Mock objects
 *
 * @example
 * const mocks = useBlobMock(beforeEach, afterEach);
 * // In test: expect(mocks.blob).toHaveBeenCalledWith([content], { type: 'text/plain' });
 */
export function useBlobMock(beforeEachFn, afterEachFn) {
  const mocks = {
    blob: null,
    originalBlob: null,
  };

  beforeEachFn(() => {
    mocks.originalBlob = window.Blob;
    mocks.blob = vi.fn(function (parts, options) {
      this.parts = parts;
      this.options = options;
    });
    window.Blob = mocks.blob;
  });

  afterEachFn(() => {
    window.Blob = mocks.originalBlob;
  });

  return mocks;
}

/**
 * Hook: useCreateElementMock
 *
 * Sets up document.createElement mock for anchor elements
 *
 * @param {Function} beforeEachFn - Vitest beforeEach function
 * @param {Function} afterEachFn - Vitest afterEach function
 * @returns {Object} Mock objects with mockAnchor
 *
 * @example
 * const mocks = useCreateElementMock(beforeEach, afterEach);
 * // In test: expect(mocks.mockAnchor.click).toHaveBeenCalled();
 */
export function useCreateElementMock(beforeEachFn, afterEachFn) {
  const mocks = {
    mockAnchor: null,
    createElement: null,
    originalCreateElement: null,
  };

  beforeEachFn(() => {
    mocks.mockAnchor = {
      download: '',
      href: '',
      click: vi.fn(),
    };

    mocks.originalCreateElement = document.createElement;
    mocks.createElement = vi.fn((tag) => {
      if (tag === 'a') {
        return mocks.mockAnchor;
      }
      return mocks.originalCreateElement.call(document, tag);
    });
    document.createElement = mocks.createElement;
  });

  afterEachFn(() => {
    document.createElement = mocks.originalCreateElement;
  });

  return mocks;
}

/**
 * Hook: useURLMock
 *
 * Sets up URL.createObjectURL and URL.revokeObjectURL mocks (standard API)
 *
 * NOTE: Previously named useWebkitURLMock - renamed to use standard URL API
 * instead of vendor-prefixed webkitURL (P0.1 memory leak fix)
 *
 * @param {Function} beforeEachFn - Vitest beforeEach function
 * @param {Function} afterEachFn - Vitest afterEach function
 * @param {string} mockURL - Mock URL to return (default: 'blob:mock-url')
 * @returns {Object} Mock objects
 *
 * @example
 * const mocks = useURLMock(beforeEach, afterEach);
 * // In test: expect(mocks.createObjectURL).toHaveBeenCalled();
 */
export function useURLMock(beforeEachFn, afterEachFn, mockURL = 'blob:mock-url') {
  const mocks = {
    createObjectURL: null,
    revokeObjectURL: null,
  };

  beforeEachFn(() => {
    mocks.createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockURL);
    mocks.revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEachFn(() => {
    vi.restoreAllMocks();
  });

  return mocks;
}

/**
 * Hook: useWebkitURLMock
 * @deprecated Use useURLMock instead (standard URL API)
 * Kept for backward compatibility with existing tests
 */
export function useWebkitURLMock(beforeEachFn, afterEachFn, mockURL = 'blob:mock-url') {
  console.warn('useWebkitURLMock is deprecated, use useURLMock instead');
  return useURLMock(beforeEachFn, afterEachFn, mockURL);
}

/**
 * Hook: useFileDownloadMocks
 *
 * Combines all mocks needed for file download testing (Blob + createElement + URL)
 *
 * Updated: Now uses standard URL API instead of vendor-prefixed webkitURL
 *
 * @param {Function} beforeEachFn - Vitest beforeEach function
 * @param {Function} afterEachFn - Vitest afterEach function
 * @returns {Object} Combined mock objects
 *
 * @example
 * const mocks = useFileDownloadMocks(beforeEach, afterEach);
 * // In test: expect(mocks.mockAnchor.click).toHaveBeenCalled();
 */
export function useFileDownloadMocks(beforeEachFn, afterEachFn) {
  const blobMocks = useBlobMock(beforeEachFn, afterEachFn);
  const elementMocks = useCreateElementMock(beforeEachFn, afterEachFn);
  const urlMocks = useURLMock(beforeEachFn, afterEachFn);

  return {
    ...blobMocks,
    ...elementMocks,
    ...urlMocks,
  };
}

/**
 * Hook: useFileReaderMock
 *
 * Sets up FileReader mock for file upload testing
 *
 * @param {Function} beforeEachFn - Vitest beforeEach function
 * @param {Function} afterEachFn - Vitest afterEach function
 * @returns {Object} Mock objects
 *
 * @example
 * const mocks = useFileReaderMock(beforeEach, afterEach);
 * // In test: mocks.triggerLoad('file content');
 */
export function useFileReaderMock(beforeEachFn, afterEachFn) {
  const mocks = {
    mockReader: null,
    originalFileReader: null,
    triggerLoad: null,
    triggerError: null,
  };

  beforeEachFn(() => {
    mocks.originalFileReader = global.FileReader;

    mocks.mockReader = {
      readAsText: vi.fn(),
      onload: null,
      onerror: null,
      result: '',
    };

    mocks.triggerLoad = (content) => {
      mocks.mockReader.result = content;
      if (mocks.mockReader.onload) {
        mocks.mockReader.onload();
      }
    };

    mocks.triggerError = (error) => {
      if (mocks.mockReader.onerror) {
        mocks.mockReader.onerror(error);
      }
    };

    global.FileReader = vi.fn(() => mocks.mockReader);
  });

  afterEachFn(() => {
    global.FileReader = mocks.originalFileReader;
  });

  return mocks;
}

/**
 * DOM Query Helpers
 *
 * These functions provide consistent ways to query DOM elements
 * across test files, reducing duplication and improving maintainability.
 */

/**
 * Query element by name attribute
 *
 * @param {HTMLElement} container - Container to query within
 * @param {string} name - Name attribute value
 * @returns {HTMLElement|null} Element or null
 *
 * @example
 * const input = queryByName(container, 'lab');
 */
export function queryByName(container, name) {
  return container.querySelector(`[name="${name}"]`);
}

/**
 * Query all elements by name attribute
 *
 * @param {HTMLElement} container - Container to query within
 * @param {string} name - Name attribute value
 * @returns {NodeList} NodeList of matching elements
 *
 * @example
 * const inputs = queryAllByName(container, 'experimenter_name');
 */
export function queryAllByName(container, name) {
  return container.querySelectorAll(`[name="${name}"]`);
}

/**
 * Query electrode group container by index
 *
 * @param {HTMLElement} container - Container to query within
 * @param {number} index - Electrode group index (0-based)
 * @returns {HTMLElement|null} Electrode group container or null
 *
 * @example
 * const egContainer = queryElectrodeGroup(container, 0);
 */
export function queryElectrodeGroup(container, index) {
  const electrodeGroups = container.querySelectorAll('.array-item__controls');
  return electrodeGroups[index]?.parentElement || null;
}

/**
 * Count array items by class selector
 *
 * @param {HTMLElement} container - Container to query within
 * @param {string} selector - CSS class selector (default: '.array-item__controls')
 * @returns {number} Count of matching elements
 *
 * @example
 * const count = countArrayItems(container, '.array-item__controls');
 */
export function countArrayItems(container, selector = '.array-item__controls') {
  return container.querySelectorAll(selector).length;
}

/**
 * Count ntrode maps in container
 *
 * @param {HTMLElement} container - Container to query within
 * @returns {number} Count of ntrode map fieldsets
 *
 * @example
 * const ntrodeCount = countNtrodeMaps(container);
 */
export function countNtrodeMaps(container) {
  return container.querySelectorAll('input[name="ntrode_id"]').length;
}

/**
 * Get remove button for array item
 *
 * @param {HTMLElement} container - Container to query within
 * @param {number} index - Array item index (0-based)
 * @returns {HTMLElement|null} Remove button or null
 *
 * @example
 * const removeBtn = getRemoveButton(container, 0);
 */
export function getRemoveButton(container, index) {
  const controls = container.querySelectorAll('.array-item__controls');
  if (controls[index]) {
    return controls[index].querySelector('button.button-danger');
  }
  return null;
}

/**
 * Get duplicate button for array item
 *
 * @param {HTMLElement} container - Container to query within
 * @param {number} index - Array item index (0-based)
 * @returns {HTMLElement|null} Duplicate button or null
 *
 * @example
 * const dupBtn = getDuplicateButton(container, 0);
 */
export function getDuplicateButton(container, index) {
  const controls = container.querySelectorAll('.array-item__controls');
  if (controls[index]) {
    const buttons = controls[index].querySelectorAll('button');
    // Duplicate is the first button (not danger class)
    return Array.from(buttons).find(btn => !btn.classList.contains('button-danger')) || null;
  }
  return null;
}

/**
 * Wait Helpers
 *
 * Async waiting utilities for test assertions
 */

/**
 * Wait for element count to match expected value
 *
 * @param {Function} queryFn - Function that returns element count
 * @param {number} expectedCount - Expected count
 * @param {number} timeout - Timeout in ms (default: 1000)
 * @returns {Promise<void>}
 *
 * @example
 * await waitForCount(() => countArrayItems(container), 2);
 */
export async function waitForCount(queryFn, expectedCount, timeout = 1000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (queryFn() === expectedCount) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw new Error(
    `Timeout waiting for count ${expectedCount}, got ${queryFn()}`
  );
}

/**
 * Wait for element to exist
 *
 * @param {Function} queryFn - Function that returns element
 * @param {number} timeout - Timeout in ms (default: 1000)
 * @returns {Promise<HTMLElement>}
 *
 * @example
 * const element = await waitForElement(() => queryByName(container, 'lab'));
 */
export async function waitForElement(queryFn, timeout = 1000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = queryFn();
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw new Error('Timeout waiting for element');
}

/**
 * Form Interaction Helpers
 *
 * Common patterns for interacting with App component forms
 */

/**
 * Click "Add" button for array sections
 *
 * Reduces duplication in unit tests that add array items repeatedly.
 * Found in 69 locations across App-duplicateElectrodeGroupItem, App-nTrodeMapSelected,
 * and App-removeElectrodeGroupItem tests.
 *
 * @param {Object} user - userEvent instance
 * @param {HTMLElement} container - Container with the add button
 * @param {string} title - Button title attribute (e.g., "Add electrode_groups")
 * @param {number} count - Number of times to click (default: 1)
 * @returns {Promise<void>}
 *
 * @example
 * await clickAddButton(user, container, "Add electrode_groups", 3);
 */
export async function clickAddButton(user, container, title, count = 1) {
  const addButton = container.querySelector(`button[title="${title}"]`);
  if (!addButton) {
    throw new Error(`Add button with title "${title}" not found`);
  }

  for (let i = 0; i < count; i++) {
    await user.click(addButton);
  }
}

/**
 * Get device type select for electrode group
 *
 * @param {HTMLElement} container - Container to query within
 * @param {number} egIndex - Electrode group index (0-based)
 * @returns {HTMLElement|null} Device type select or null
 *
 * @example
 * const select = getDeviceTypeSelect(container, 0);
 */
export function getDeviceTypeSelect(container, egIndex) {
  const electrodeGroup = queryElectrodeGroup(container, egIndex);
  if (!electrodeGroup) return null;

  return electrodeGroup.querySelector('select[name="device_type"]');
}

/**
 * Set device type for electrode group
 *
 * @param {HTMLElement} container - Container to query within
 * @param {number} egIndex - Electrode group index (0-based)
 * @param {string} deviceType - Device type value (e.g., 'tetrode_12.5')
 * @returns {Promise<void>}
 *
 * @example
 * await setDeviceType(container, 0, 'tetrode_12.5');
 */
export async function setDeviceType(container, egIndex, deviceType) {
  const select = getDeviceTypeSelect(container, egIndex);
  if (!select) {
    throw new Error(`Device type select not found for electrode group ${egIndex}`);
  }

  const { fireEvent } = await import('@testing-library/react');
  fireEvent.change(select, { target: { value: deviceType } });

  // Wait for ntrode generation
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Verification Helpers
 *
 * Common assertion patterns
 */

/**
 * Verify form data immutability
 *
 * @param {Object} before - State before update
 * @param {Object} after - State after update
 * @param {string} path - Path to verify (e.g., 'cameras[0]')
 * @returns {boolean} True if immutable
 *
 * @example
 * const immutable = verifyImmutability(beforeState, afterState, 'cameras');
 */
export function verifyImmutability(before, after, path = '') {
  if (!path) {
    return before !== after;
  }

  // Parse path like 'cameras[0].id' → ['cameras', '0', 'id']
  const parts = path.split(/[[\].]+/).filter(Boolean);

  let beforeValue = before;
  let afterValue = after;

  for (const part of parts) {
    beforeValue = beforeValue?.[part];
    afterValue = afterValue?.[part];
  }

  return beforeValue !== afterValue;
}

/**
 * Assert array contains items with expected properties
 *
 * @param {Array} array - Array to verify
 * @param {Object} expectedProps - Expected properties object
 * @returns {boolean} True if all items match
 *
 * @example
 * assertArrayItems(cameras, { id: expect.any(Number), meter_per_pixel: 0 });
 */
export function assertArrayItems(array, expectedProps) {
  return array.every(item => {
    return Object.keys(expectedProps).every(key => {
      const expected = expectedProps[key];
      const actual = item[key];

      if (typeof expected === 'object' && expected.asymmetricMatch) {
        // Handle expect.any(), expect.stringContaining(), etc.
        return expected.asymmetricMatch(actual);
      }

      return actual === expected;
    });
  });
}
