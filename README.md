# Rec to NWB YAML Creator

## Introduction

The purpose of this application is to provide a guided means to generate the YML file needed for [Rec to NWB](https://github.com/LorenFrankLab/rec_to_nwb) and [trodes to NWB](https://github.com/LorenFrankLab/trodes_to_nwb). It spends up and simplifies creation of YAML files for generation of NWB files.

All users have to do is fill out the required fields and then press the generate button at the bottom. The process is straightforward. Alternately, users can upload a yml file to serve as a template.

There are placeholders in text boxes describing what input is expected; after opening the application. And the title-name by the text boxes are self-explanatory.

You can get the link for this page at - https://lorenfranklab.github.io/rec_to_nwb_yaml_creator/

## Requirements

- **Node.js `20.19.5`** — the version pinned in [`.nvmrc`](.nvmrc). Other Node majors are untested
  (see [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) for installing this version, with and
  without a version manager).

## Setup

Install dependencies from the lockfile (reproducible; preferred over `npm install` for a clean clone):

```bash
npm ci
```

## Development

```bash
npm start          # Start the dev server; a browser opens with the application
npm test           # Run the test suite in watch mode (Vitest)
npx vitest run     # Run the test suite once (CI-style)
npm run test:baseline   # Run only the golden-YAML parity baseline suite
npm run build      # Build the production bundle into build/
npm run lint       # Run ESLint with auto-fix
```

See [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) for full environment details and
troubleshooting.

## Deployment

To deploy, run the command -

```[bash]
npm run deploy
```

**This deploys the code in branch - **gh-pages**. **gh-pages** should not be deleted.**
