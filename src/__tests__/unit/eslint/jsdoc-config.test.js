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
  // The build + test config consolidated into vite.config.ts (was vitest.config.js) in the
  // CRA→Vite migration; the `@/` resolve.alias moved there with it.
  const viteConfigPath = join(__dirname, '../../../..', 'vite.config.ts');

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

  it('should set baseUrl in tsconfig.json and resolve the "@/" alias via vite.config.ts', () => {
    // tsconfig.json is JSONC (it carries explanatory comments), so assert on its
    // text rather than JSON.parse.
    const tsconfig = readFileSync(tsconfigPath, 'utf-8');
    expect(tsconfig).toContain('"baseUrl"');
    // The "@/" -> "src" alias is configured in vite.config.ts's resolve.alias (the shared
    // build + test config), so it resolves for both the app build and the test lane.
    const viteConfig = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfig).toContain("'@'");
    expect(viteConfig).toContain('./src');
  });
});
