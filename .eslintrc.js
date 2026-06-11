module.exports = {
    extends: "react-app",
    plugins: ["jsdoc"],
    rules: {
      // A temporary hack related to IDE not resolving correct package.json
      'import/no-extraneous-dependencies': 'off',
      'import/no-unresolved': 'error',
      // Since React 17 and typescript 4.1 you can safely disable the rule
      'react/react-in-jsx-scope': 'off',

      // JSDoc rules (warnings initially, errors in Phase 2)
      "jsdoc/require-jsdoc": ["warn", {
        "require": {
          "FunctionDeclaration": true,
          "MethodDefinition": false,
          "ClassDeclaration": false,
          "ArrowFunctionExpression": false,
          "FunctionExpression": false
        },
        "contexts": [
          "ExportNamedDeclaration > FunctionDeclaration",
          "ExportDefaultDeclaration > FunctionDeclaration"
        ]
      }],
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-type": "warn",
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-type": "warn",
      "jsdoc/check-types": "warn",
      "jsdoc/check-param-names": "error",
      "jsdoc/valid-types": "error"
    },
    parserOptions: {
      ecmaVersion: 2020,
    },
    // TypeScript files are parsed with @typescript-eslint/parser so converted
    // modules (.ts/.tsx) lint without "Parsing error" on type syntax. JSDoc rules
    // (which expect JS doc-comments) are disabled for typed files, where the types
    // live in the signatures rather than in @param/@returns annotations.
    overrides: [
      {
        files: ["*.ts", "*.tsx"],
        parser: "@typescript-eslint/parser",
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: "module",
        },
        rules: {
          "jsdoc/require-jsdoc": "off",
          "jsdoc/require-param": "off",
          "jsdoc/require-param-type": "off",
          "jsdoc/require-returns": "off",
          "jsdoc/require-returns-type": "off",
        }
      }
    ],
    settings: {
      "import/resolver": {
        "node": {
          "extensions": [".js", ".jsx", ".ts", ".tsx"]
        },
        "caseSensitive": false
      }
    }
};
