# Rec to NWB YAML Creator

## Introduction

The purpose of this application is to provide a guided means to generate the YML file needed for [Rec to NWB](https://github.com/LorenFrankLab/rec_to_nwb) and [trodes to NWB](https://github.com/LorenFrankLab/trodes_to_nwb). It spends up and simplifies creation of YAML files for generation of NWB files.

All users have to do is fill out the required fields and then press the generate button at the bottom. The process is straightforward. Alternately, users can upload a yml file to serve as a template.

There are placeholders in text boxes describing what input is expected; after opening the application. And the title-name by the text boxes are self-explanatory.

You can get the link for this page at - https://lorenfranklab.github.io/rec_to_nwb_yaml_creator/

## Importing existing YAML files

If you already have `{mmddYYYY}_{subject}_metadata.yml` files (for example, from previous recording
sessions), you can bring them straight into the workspace instead of re-entering them by hand. Use
the **Import YAML…** button on the Animal Workspace (it appears beside **+ New Animal**, and beside
**Create Animal** in the empty state).

What it does:

- **Each file becomes a recording day, grouped into animals by subject id.** The recording date is
  read from the file name (`{mmddYYYY}_{subject}_metadata.yml`), or from the `session_id` if the file
  name doesn't carry it.
- **Configuration differences across dates become hardware-configuration versions.** If a subject's
  files describe different electrode configurations on different dates, the import creates a numbered
  configuration version for each distinct configuration (version 1 = earliest), and pins each day to
  the version it used.
- **Disagreements and conflicts are shown for review before anything is written.** The preview flags
  *divergences* (for example, files that disagree on cameras, experimenters, or subject details — the
  import unions catalogs and takes the latest-dated value for scalars, but tells you it did so), and
  flags any animal that **already exists** in the workspace so you can choose to **add** the imported
  days to it, **skip** it, or **replace** it. Files that can't be imported (unparseable, missing a
  subject id or date, or failing validation) are listed with the reason — nothing fails silently.
- **Nothing is written until you press Confirm.** The preview is read-only; **Cancel** writes nothing.
  After importing, edit the animals and days in the normal editors as usual.

> Note: when you **add** imported days to an animal that already exists, the existing animal's shared
> catalogs (cameras, recording systems) are left untouched. If an imported day references a camera or
> device the existing animal doesn't have, that gap is surfaced later as an export check, so you can
> reconcile the catalogs first.

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
