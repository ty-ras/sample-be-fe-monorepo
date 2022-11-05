const baseline = require('./.eslintrc.library.cjs');

baseline.settings['import/resolver'].node.extensions.push(".tsx");
module.exports = {
  ...baseline,
  extends: [
    ...baseline.extends,
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/strict",
  ],
  settings: {
    ...baseline.settings,
    "react": {
      version: "detect"
    }
  },
  rules: {
    ...baseline.rules,
    // The React version this project uses does not need this.
   "react/react-in-jsx-scope": "off"
  }
};
