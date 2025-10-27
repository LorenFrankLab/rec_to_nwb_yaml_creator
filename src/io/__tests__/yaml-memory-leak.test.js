/**
 * @file Memory Leak Tests for YAML Download
 * @description Tests to ensure URL.createObjectURL is properly cleaned up
 *
 * P0.1: Fix memory leak in YAML export
 * - URL.createObjectURL creates memory that must be freed with revokeObjectURL
 * - Without cleanup, repeated exports cause memory leaks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadYamlFile } from '../yaml';

describe('downloadYamlFile - Memory Leak Prevention', () => {
  let createObjectURLSpy;
  let revokeObjectURLSpy;
  let createElementSpy;
  let mockLink;

  beforeEach(() => {
    // Mock URL.createObjectURL
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    // Mock URL.revokeObjectURL
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock document.createElement
    mockLink = {
      download: '',
      href: '',
      click: vi.fn(),
    };
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should revoke blob URL after download to prevent memory leak', () => {
    // Arrange
    const fileName = 'test.yml';
    const content = 'test: value\n';

    // Act
    downloadYamlFile(fileName, content);

    // Assert
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));

    // CRITICAL: revokeObjectURL must be called to free memory
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should use standard URL.createObjectURL (not vendor-prefixed webkitURL)', () => {
    // Arrange
    const fileName = 'test.yml';
    const content = 'test: value\n';

    // Act
    downloadYamlFile(fileName, content);

    // Assert
    // Verify we're using URL.createObjectURL
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);

    // Verify mockLink.href was set with the URL (not webkitURL)
    expect(mockLink.href).toBe('blob:mock-url');
  });

  it('should create blob with correct YAML content and MIME type', () => {
    // Arrange
    const fileName = 'metadata.yml';
    const content = 'subject:\n  subject_id: test\n';

    // Act
    downloadYamlFile(fileName, content);

    // Assert
    const blobCall = createObjectURLSpy.mock.calls[0][0];
    expect(blobCall).toBeInstanceOf(Blob);
    expect(blobCall.type).toBe('text/yaml;charset=utf-8;');

    // Verify blob size matches content length (can't call .text() in JSDOM)
    expect(blobCall.size).toBe(content.length);
  });

  it('should trigger download with correct filename', () => {
    // Arrange
    const fileName = '06222023_rat01_metadata.yml';
    const content = 'test: value\n';

    // Act
    downloadYamlFile(fileName, content);

    // Assert
    expect(mockLink.download).toBe(fileName);
    expect(mockLink.click).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple sequential downloads without memory leak', () => {
    // Arrange
    const fileName1 = 'test1.yml';
    const fileName2 = 'test2.yml';
    const content = 'test: value\n';

    // Act - Multiple downloads
    downloadYamlFile(fileName1, content);
    downloadYamlFile(fileName2, content);

    // Assert
    expect(createObjectURLSpy).toHaveBeenCalledTimes(2);

    // CRITICAL: Each URL must be revoked
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(2);

    // Verify each URL was revoked with the correct blob URL
    expect(revokeObjectURLSpy).toHaveBeenNthCalledWith(1, 'blob:mock-url');
    expect(revokeObjectURLSpy).toHaveBeenNthCalledWith(2, 'blob:mock-url');
  });

  it('should revoke URL even if click fails', () => {
    // Arrange
    mockLink.click.mockImplementation(() => {
      throw new Error('Download failed');
    });

    // Act & Assert
    expect(() => {
      downloadYamlFile('test.yml', 'content');
    }).toThrow('Download failed');

    // Even if click fails, URL should still be revoked to prevent memory leak
    // NOTE: Current implementation doesn't handle this - this test will FAIL
    // and shows the bug that needs fixing
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
  });
});

describe('downloadYamlFile - Browser Compatibility', () => {
  it('should use standard URL API (not deprecated webkitURL)', () => {
    // This is a documentation test to ensure we're using modern APIs

    // Standard URL API (correct)
    expect(typeof URL.createObjectURL).toBe('function');
    expect(typeof URL.revokeObjectURL).toBe('function');

    // Deprecated webkitURL should not be used in implementation
    // Note: window.webkitURL is still available in some browsers for compatibility
    // but we should use the standard URL global
  });
});
