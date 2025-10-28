/**
 * @file YAML Export Utilities
 * @description Utilities for converting JavaScript objects to YAML and creating downloadable YAML files
 *
 * Extracted from App.js during Phase 3 refactoring to improve modularity and testability.
 */

import YAML from 'yaml';

/**
 * Converts an object to YAML string format
 *
 * @param {object} content - JavaScript object to convert to YAML
 * @returns {string} YAML representation of the input object
 *
 * @example
 * const data = { name: 'test', value: 123 };
 * const yamlString = convertObjectToYAMLString(data);
 * // Returns: "name: test\nvalue: 123\n"
 */
export const convertObjectToYAMLString = (content) => {
  const doc = new YAML.Document();
  doc.contents = content || {};

  return doc.toString();
};

/**
 * Creates and triggers download of a YAML file
 *
 * @param {string} fileName - Name for the downloaded file (e.g., "metadata.yml")
 * @param {string} content - YAML content as a string
 *
 * @example
 * const yamlContent = convertObjectToYAMLString({ key: 'value' });
 * createYAMLFile('config.yml', yamlContent);
 * // Triggers browser download of config.yml
 */
export const createYAMLFile = (fileName, content) => {
  var textFileAsBlob = new Blob([content], {type: 'text/yaml;charset=utf-8;'});
  const downloadLink = document.createElement("a");
  downloadLink.download = fileName;
  downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
  downloadLink.click();
};
