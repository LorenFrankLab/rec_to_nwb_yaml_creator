/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('ESLint JSDoc Configuration', () => {
  const eslintPath = join(__dirname, '../../../..', '.eslintrc.js');
  const packagePath = join(__dirname, '../../../..', 'package.json');
  const jsconfigPath = join(__dirname, '../../../..', 'jsconfig.json');

  it('should have eslint-plugin-jsdoc in devDependencies', () => {
    const content = readFileSync(packagePath, 'utf-8');
    const pkg = JSON.parse(content);
    expect(pkg.devDependencies).toHaveProperty('eslint-plugin-jsdoc');
  });

  it('should configure jsdoc plugin in .eslintrc.js', () => {
    const content = readFileSync(eslintPath, 'utf-8');
    expect(content).toContain('jsdoc');
  });

  it('should have jsconfig.json', () => {
    expect(existsSync(jsconfigPath)).toBe(true);
  });

  it('should configure path aliases in jsconfig.json', () => {
    const content = readFileSync(jsconfigPath, 'utf-8');
    const config = JSON.parse(content);
    expect(config.compilerOptions).toHaveProperty('baseUrl');
    expect(config.compilerOptions).toHaveProperty('paths');
  });
});
