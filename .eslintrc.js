module.exports = {
    extends: "react-app",
    rules: {
      // A temporary hack related to IDE not resolving correct package.json
      'import/no-extraneous-dependencies': 'off',
      'import/no-unresolved': 'error',
      // Since React 17 and typescript 4.1 you can safely disable the rule
      'react/react-in-jsx-scope': 'off',
    },
    parserOptions: {
      ecmaVersion: 2020,
    },
    settings: {
      "import/resolver": {
        "node": {
          "extensions": [".js", ".jsx",]
        },
        "caseSensitive": false
      }
    }
};
