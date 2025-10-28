/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Type System Migration Documentation', () => {
  const docsPath = join(__dirname, '../../../..', 'docs', 'types_migration.md');

  it('should have a types_migration.md file', () => {
    expect(existsSync(docsPath)).toBe(true);
  });

  it('should define Phase 1 with JSDoc strategy', () => {
    const content = readFileSync(docsPath, 'utf-8');
    expect(content).toContain('Phase 1');
    expect(content).toContain('JSDoc');
  });

  it('should define Phase 2 with optional TypeScript migration', () => {
    const content = readFileSync(docsPath, 'utf-8');
    expect(content).toContain('Phase 2');
    expect(content.toLowerCase()).toMatch(/typescript|ts-migrate/i);
  });

  it('should specify measurable type coverage goal', () => {
    const content = readFileSync(docsPath, 'utf-8');
    expect(content).toMatch(/\d+%/); // Should contain a percentage
    expect(content.toLowerCase()).toContain('coverage');
  });

  it('should reference ESLint configuration', () => {
    const content = readFileSync(docsPath, 'utf-8');
    expect(content.toLowerCase()).toContain('eslint');
  });

  it('should explain the rationale for choosing JSDoc first', () => {
    const content = readFileSync(docsPath, 'utf-8');
    expect(content.toLowerCase()).toContain('rationale');
  });

  it('should provide examples of JSDoc type annotations', () => {
    const content = readFileSync(docsPath, 'utf-8');
    expect(content).toMatch(/@param|@returns|@typedef/);
  });
});
