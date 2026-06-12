module.exports = {
    extends: "react-app",
    plugins: ["jsdoc"],
    rules: {
      // A temporary hack related to IDE not resolving correct package.json
      'import/no-extraneous-dependencies': 'off',
      'import/no-unresolved': 'error',
      // Since React 17 and typescript 4.1 you can safely disable the rule
      'react/react-in-jsx-scope': 'off',

      // JSDoc rules. The build gate (CI=true) treats ESLint warnings as errors, so these must be
      // clean. We keep the DOC-PRESENCE rules (every exported function has a doc comment with its
      // params) and the CORRECTNESS rules (param names match; types are syntactically valid), but
      // turn OFF the @param/@returns TYPE-annotation rules: the codebase is migrating .js → .ts
      // (Phase 9), where these rules are already off because the types live in the signatures, so
      // requiring JSDoc type annotations on soon-to-be-typed .js files is redundant churn. (Phase 9b)
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
      // Redundant with the TypeScript migration — types belong in signatures, not @param/@returns.
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-type": "off",
      "jsdoc/check-types": "off",
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
