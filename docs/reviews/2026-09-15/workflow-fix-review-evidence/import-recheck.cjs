const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { chromium, expect } = require('@playwright/test');
const inputs = require('../workflow-review-evidence/synthetic-inputs.json');
const origin = 'http://127.0.0.1:3018';
const results = {};
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    async function capture(name) {
      await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) { try { a.finish(); } catch {} } });
      await page.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: true });
      fs.writeFileSync(path.join(__dirname, `${name}.txt`), await page.locator('body').innerText());
    }
    async function upload(files) {
      await page.getByLabel(/Choose a metadata YAML file/i).setInputFiles(files.map(input => ({ name: input.sourceName, mimeType: 'application/yaml', buffer: Buffer.from(YAML.stringify(input.flatModel)) })));
    }
    async function exports() {
      return page.evaluate(async () => {
        const { mergeDayMetadata } = await import('/src/state/workspaceUtils.ts');
        const workspace = JSON.parse(localStorage.getItem('rec_to_nwb_workspace_v1') || '{"workspace":{"days":{},"animals":{}}}').workspace;
        return Object.values(workspace.days).map(day => ({ date: day.date, cameras: mergeDayMetadata(workspace.animals[day.animalId], day).cameras }));
      });
    }
    await page.goto(`${origin}/#/import`);
    await upload(inputs);
    await page.getByRole('button', { name: 'Review 2 ready files', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirm import', exact: true })).toBeVisible();
    await capture('20-camera-batch-preview');
    await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Import complete', exact: true })).toBeVisible();
    await expect.poll(() => exports().then(days => days.length)).toBe(2);
    results.batchExports = await exports();
    await capture('21-camera-batch-result');
    await page.getByRole('button', { name: 'Import more files', exact: true }).click();
    await upload([inputs[1]]);
    await expect(page.getByRole('button', { name: 'Add recording day', exact: true })).toBeVisible();
    results.reimport = { addDisabled: await page.getByRole('button', { name: 'Add recording day', exact: true }).isDisabled(), text: await page.locator('body').innerText() };
    await capture('22-camera-reimport-repair');
    await page.getByRole('button', { name: 'Choose different files', exact: true }).click();
    const third = structuredClone(inputs[1]);
    third.sourceName = '20230624_remy_metadata.yml';
    third.flatModel.session_id = 'remy_20230624';
    third.flatModel.cameras[0].meters_per_pixel = 0.003;
    await upload([third]);
    await expect(page.getByRole('button', { name: 'Add recording day', exact: true })).toBeVisible();
    results.nextCalibration = { addDisabled: await page.getByRole('button', { name: 'Add recording day', exact: true }).isDisabled(), text: await page.locator('body').innerText() };
    await capture('23-camera-next-calibration');
  } finally {
    fs.writeFileSync(path.join(__dirname, 'import-recheck.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
