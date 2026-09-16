const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const out = __dirname;
const origin = 'http://127.0.0.1:3017';
const observations = [];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  async function capture(name, axe = true) {
    await page.locator('#main-content').first().waitFor();
    await page.evaluate(async () => { await document.fonts.ready; for (const a of document.getAnimations()) { try { a.finish(); } catch {} } });
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    const text = await page.locator('body').innerText();
    fs.writeFileSync(path.join(out, `${name}.txt`), text);
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    const violations = axe ? (await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) : [];
    observations.push({ name, url: page.url(), dimensions, violations });
    fs.writeFileSync(path.join(out, 'screens.json'), JSON.stringify({ observations, errors }, null, 2));
    console.log(name, dimensions, violations.map(v => v.id));
  }
  await page.goto(origin);
  await capture('01-default-legacy');
  await page.goto(`${origin}/#/workspace`);
  await capture('02-empty-workspace');
  await page.getByRole('button', { name: 'Create Animal', exact: true }).click();
  await capture('03-create-identity');
  await page.goto(`${origin}/#/import`);
  await capture('04-import-empty');
  const seed = await page.evaluate(async () => {
    const {buildCatalogWorkspace} = await import('/src/__tests__/fixtures/workspaceBuilders.js');
    const {animal,day} = buildCatalogWorkspace();
    Object.assign(animal.devices, structuredClone(animal.configurationHistory[0].devices));
    return {animalId: animal.id, dayId: day.id, workspace: {version:'1.0.0', lastModified:'2026-09-15T12:00:00Z', animals:{[animal.id]:animal}, days:{[day.id]:day}, settings:{}}};
  });
  fs.writeFileSync(path.join(out, 'seed.json'), JSON.stringify(seed, null, 2));
  await page.evaluate(seed => localStorage.setItem('rec_to_nwb_workspace_v1', JSON.stringify({ schemaVersion: 4, workspace: seed.workspace })), seed);
  await page.goto(`${origin}/#/workspace`);
  await page.reload();
  await capture('05-workspace');
  for (const tab of ['days','electrode-groups','recording-system','cameras','task-types','optogenetics','export']) {
    await page.goto(`${origin}/#/animal/${seed.animalId}/${tab}`);
    await capture(`06-animal-${tab}`);
  }
  await page.goto(`${origin}/#/copy-from-animal`);
  await capture('07-copy-animal');
  await page.goto(`${origin}/#/day/${seed.dayId}`);
  await capture('08-day-overview');
  const sections = await page.getByRole('navigation', {name: 'Day editor sections'}).getByRole('button').evaluateAll(nodes => nodes.map(n => ({label: n.getAttribute('aria-label'), tabIndex: n.tabIndex, text: n.textContent})));
  fs.writeFileSync(path.join(out, 'day-navigation.json'), JSON.stringify(sections, null, 2));
  for (let i = 1; i < sections.length; i++) {
    await page.getByRole('button', {name: sections[i].label, exact:true}).click();
    await capture(`09-day-section-${i}`);
  }
  await page.goto(`${origin}/#/validation`);
  await capture('10-workspace-validation');
  await page.setViewportSize({width: 390, height: 844});
  for (const [name, route] of [['11-phone-days',`animal/${seed.animalId}/days`], ['12-phone-day',`day/${seed.dayId}`], ['13-phone-cameras',`animal/${seed.animalId}/cameras`], ['14-phone-export',`animal/${seed.animalId}/export`]]) {
    await page.goto(`${origin}/#/${route}`);
    await capture(name);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
