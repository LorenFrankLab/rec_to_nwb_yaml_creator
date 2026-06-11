/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('ESLint JSDoc Configuration', () => {
  const eslintPath = join(__dirname, '../../../..', '.eslintrc.js');
  const packagePath = join(__dirname, '../../../..', 'package.json');
  const tsconfigPath = join(__dirname, '../../../..', 'tsconfig.json');
  const vitestConfigPath = join(__dirname, '../../../..', 'vitest.config.js');

  it('should have eslint-plugin-jsdoc in devDependencies', () => {
    const content = readFileSync(packagePath, 'utf-8');
    const pkg = JSON.parse(content);
    expect(pkg.devDependencies).toHaveProperty('eslint-plugin-jsdoc');
  });

  it('should configure jsdoc plugin in .eslintrc.js', () => {
    const content = readFileSync(eslintPath, 'utf-8');
    expect(content).toContain('jsdoc');
  });

  it('should have tsconfig.json (replacing jsconfig.json)', () => {
    expect(existsSync(tsconfigPath)).toBe(true);
  });

  it('should set baseUrl in tsconfig.json and resolve the "@/" alias for tests via vitest.config.js', () => {
    // tsconfig.json is JSONC (it carries explanatory comments), so assert on its
    // text rather than JSON.parse.
    const tsconfig = readFileSync(tsconfigPath, 'utf-8');
    expect(tsconfig).toContain('"baseUrl"');
    // react-scripts forbids compilerOptions.paths, so the "@/" -> "src" alias is
    // configured in vitest.config.js's resolve.alias instead of in tsconfig.
    const vitestConfig = readFileSync(vitestConfigPath, 'utf-8');
    expect(vitestConfig).toContain("'@'");
    expect(vitestConfig).toContain('./src');
  });
});
