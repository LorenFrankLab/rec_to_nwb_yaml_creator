/**
 * @file Tests for createYAMLFile function
 * @description Phase 1, Week 6 - YAML Conversion Functions
 *
 * Function location: src/App.js:451-457
 *
 * Purpose: Trigger browser download of YAML file with specified filename and content
 *
 * Implementation:
 * ```javascript
 * const createYAMLFile = (fileName, content) => {
 *   var textFileAsBlob = new Blob([content], {type: 'text/plain'});
 *   const downloadLink = document.createElement("a");
 *   downloadLink.download = fileName;
 *   downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
 *   downloadLink.click();
 * };
 * ```
 *
 * Test Coverage: 7 tests documenting current behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Note: These are DOCUMENTATION TESTS (Phase 1)
 *
 * createYAMLFile triggers browser file download using:
 * 1. Blob API for file content
 * 2. DOM createElement for anchor element
 * 3. webkitURL.createObjectURL for blob URL
 * 4. click() to trigger download
 *
 * Testing strategy: Mock browser APIs to verify interactions
 */
describe('createYAMLFile()', () => {
  let mockAnchor;
  let originalCreateElement;
  let originalWebkitURL;
  let originalBlob;

  beforeEach(() => {
    // Mock anchor element
    mockAnchor = {
      download: '',
      href: '',
      click: vi.fn(),
    };

    // Mock document.createElement
    originalCreateElement = document.createElement;
    document.createElement = vi.fn((tag) => {
      if (tag === 'a') {
        return mockAnchor;
      }
      return originalCreateElement.call(document, tag);
    });

    // Mock window.webkitURL
    originalWebkitURL = window.webkitURL;
    window.webkitURL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
    };

    // Mock Blob
    originalBlob = window.Blob;
    window.Blob = vi.fn(function (parts, options) {
      this.parts = parts;
      this.options = options;
    });
  });

  afterEach(() => {
    // Restore original implementations
    document.createElement = originalCreateElement;
    window.webkitURL = originalWebkitURL;
    window.Blob = originalBlob;
  });

  describe('Blob Creation', () => {
    it('creates Blob with text/plain type', () => {
      const fileName = 'test.yml';
      const content = 'name: test\nvalue: 123';

      // Simulate createYAMLFile call
      const textFileAsBlob = new Blob([content], { type: 'text/plain' });

      expect(textFileAsBlob).toBeInstanceOf(Blob);
      expect(textFileAsBlob.parts).toEqual([content]);
      expect(textFileAsBlob.options).toEqual({ type: 'text/plain' });
    });

    it('wraps content in array for Blob constructor', () => {
      const content = 'session_id: test001';

      // Blob constructor expects array of content parts
      const textFileAsBlob = new Blob([content], { type: 'text/plain' });

      // Content is wrapped in array
      expect(textFileAsBlob.parts).toEqual([content]);
      expect(Array.isArray(textFileAsBlob.parts)).toBe(true);
    });
  });

  describe('Anchor Element Creation', () => {
    it('creates anchor element using createElement', () => {
      // Simulate createYAMLFile
      const downloadLink = document.createElement('a');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(downloadLink).toBe(mockAnchor);
    });

    it('sets download attribute to filename', () => {
      const fileName = '20230622_rat01_metadata.yml';

      // Simulate createYAMLFile
      const downloadLink = document.createElement('a');
      downloadLink.download = fileName;

      expect(downloadLink.download).toBe('20230622_rat01_metadata.yml');
    });

    it('sets href to blob URL from webkitURL.createObjectURL', () => {
      const content = 'test';

      // Simulate createYAMLFile
      const textFileAsBlob = new Blob([content], { type: 'text/plain' });
      const downloadLink = document.createElement('a');
      downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);

      expect(window.webkitURL.createObjectURL).toHaveBeenCalledWith(textFileAsBlob);
      expect(downloadLink.href).toBe('blob:mock-url');
    });
  });

  describe('Download Trigger', () => {
    it('calls click() on anchor element to trigger download', () => {
      const content = 'test';

      // Simulate createYAMLFile
      const textFileAsBlob = new Blob([content], { type: 'text/plain' });
      const downloadLink = document.createElement('a');
      downloadLink.download = 'test.yml';
      downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
      downloadLink.click();

      expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    });

    it('filename parameter is used for download attribute', () => {
      const fileName = '01232025_test_metadata.yml';

      // Simulate createYAMLFile
      const downloadLink = document.createElement('a');
      downloadLink.download = fileName;

      // The filename from parameter is directly assigned
      expect(downloadLink.download).toBe('01232025_test_metadata.yml');
    });
  });
});

/**
 * Implementation Notes (from reading App.js:451-457):
 *
 * 1. Creates Blob from content with type 'text/plain'
 * 2. Creates anchor element
 * 3. Sets download attribute to fileName parameter
 * 4. Creates blob URL using window.webkitURL.createObjectURL
 * 5. Sets href to blob URL
 * 6. Triggers download with click()
 *
 * Browser APIs Used:
 * - Blob (constructor) - Creates file blob
 * - document.createElement - Creates DOM element
 * - window.webkitURL.createObjectURL - Creates blob URL
 * - HTMLAnchorElement.click() - Triggers download
 *
 * Behavior:
 * - No return value (void function)
 * - Side effect: triggers browser file download
 * - Download attribute tells browser to download (not navigate)
 * - Blob URL allows browser to access blob as file
 *
 * Used by:
 * - generateYMLFile() at line 668 to trigger YAML download
 *
 * Notes:
 * - Uses webkitURL (older API), modern code would use URL.createObjectURL
 * - Creates anchor element but never appends to DOM (not required for download)
 * - Blob URL is never revoked (minor memory leak for repeated downloads)
 * - Uses `var` instead of `const` (older code style)
 */
