import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8901';
let browser, ctx, page;
const errors = [];
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  if (!cond) console.log('  ✗', name, extra);
}

async function resetStorage() {
  // Fresh origin state once; do NOT add an init-script that clears on every
  // navigation, otherwise scope-retention across pages can't be tested.
  await page.goto(`${BASE}/index.html`);
  await page.evaluate(() => localStorage.clear());
}

async function run() {
  browser = await chromium.launch({ headless: true });
  ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // ---------------- Works: scope filtering + retention ------------------
  await resetStorage();
  await page.goto(`${BASE}/works.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.photo-card');
  const allCount = await page.locator('.photo-card').count();
  check('works shows all 14 photos', allCount === 14, `got ${allCount}`);

  // filter to the Gaze series
  await page.locator('[data-series="gaze"]').click();
  await page.waitForTimeout(120);
  let gazeCount = await page.locator('.photo-card').count();
  check('filter to Gaze gives 5', gazeCount === 5, `got ${gazeCount}`);

  // lightbox stays within scope: 5 items
  await page.locator('.photo-card .frame').first().click();
  await page.waitForSelector('.lightbox:not([hidden])');
  let counter = await page.textContent('.lightbox__counter');
  check('lightbox walks only the Gaze result set', /1 \/ 5/.test(counter), counter);
  // wrap past last stays at 5 total
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  counter = await page.textContent('.lightbox__counter');
  check('lightbox never exceeds result size', /1 \/ 5/.test(counter), counter);
  await page.keyboard.press('Escape');

  // navigate away to About, then back to Works — scope retained
  await page.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  await page.goto(`${BASE}/works.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.photo-card');
  gazeCount = await page.locator('.photo-card').count();
  check('scope retained after leaving and returning', gazeCount === 5, `got ${gazeCount}`);
  const banner = await page.textContent('#scope-banner');
  check('scope banner mentions Gaze', /Gaze/.test(banner));
  check('filter chip shows pressed', await page.locator('[data-series="gaze"][aria-pressed="true"]').count() === 1);

  // clear scope
  await page.locator('[data-clear-scope]').click();
  await page.waitForTimeout(120);
  check('clear restores 14', (await page.locator('.photo-card').count()) === 14);

  // ---------------- Series covers + order -------------------------------
  await page.goto(`${BASE}/series.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.series-card');
  check('three series cards', (await page.locator('.series-card').count()) === 3);
  const firstCoverSrc = await page.getAttribute('.series-card:first-child .cover img', 'src');
  check('Gaze cover is first selected photo (portrait-01)', /portrait-01/.test(firstCoverSrc), firstCoverSrc);

  // ---------------- Offline edits ---------------------------------------
  await page.goto(`${BASE}/works.html`, { waitUntil: 'networkidle' });
  await page.check('#edit-mode');
  // drop portrait-04
  await page.locator('[data-toggle="portrait-04"]').click();
  await page.waitForTimeout(100);
  check('drop toggles card to dropped', await page.locator('[data-photo-id="portrait-04"].is-dropped').count() === 1);
  // edit a caption via store API (title/caption field edit like the venue would)
  await page.evaluate(() => {
    // simulate field edits through the store the same way the desk does
    window.__store && window.__store.editPhoto;
  });

  // ---------------- Sync: full conflict -> candidates -> confirm --------
  await page.goto(`${BASE}/series.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#sync-host .sync-panel');

  // Build the exact venue edit scenario through the store
  await page.evaluate(async () => {
    const st = await import('/js/app/store.js');
    const p = (id) => st.getState().catalog.photos.find(x => x.id === id);
    const s = (id) => st.getState().catalog.series.find(x => x.id === id);
    st.editPhoto('portrait-01', { caption: 'VENUE EDIT: light on eyelids alone' });
    st.toggleSelect('portrait-04'); // ensure dropped (toggle twice-safe): set false directly
    if (p('portrait-04').selected) st.toggleSelect('portrait-04');
    st.editPhoto('portrait-03', { caption: 'VENUE EDIT: breath held' });
    st.editPhoto('portrait-02', { caption: 'VENUE EDIT: drawn curtain' });
    st.editPhoto('landscape-03', { caption: 'VENUE EDIT: mound fills frame' });
    st.editPhoto('pastoral-04', { caption: 'VENUE EDIT: cattle scattered like seed' });
    if (p('landscape-05').selected) st.toggleSelect('landscape-05');
    // reorder gaze locally
    const gaze = s('gaze');
    ['portrait-02','portrait-01','portrait-03','portrait-04','portrait-05'].forEach((id,i)=>p(id).order=i+1);
    gaze.photoIds = ['portrait-02','portrait-01','portrait-03','portrait-04','portrait-05'];
    // reorder highland locally
    const hp = s('highland-pastoral');
    ['pastoral-02','pastoral-03','pastoral-01','pastoral-04'].forEach((id,i)=>p(id).order=i+1);
    hp.photoIds = ['pastoral-02','pastoral-03','pastoral-01','pastoral-04'];
    // top-level order highland first
    const cat = st.getState().catalog;
    cat.series.sort((a,b)=>({'highland-pastoral':0,gaze:1,wilderness:2}[a.id]-{'highland-pastoral':0,gaze:1,wilderness:2}[b.id]));
    // persist by toggling scope through setScope (store persists catalog on setScope too)
    st.setScope({});
  });
  await page.waitForTimeout(150);

  // network is up by default in headless (navigator.onLine true)
  await page.click('[data-fetch]');
  await page.waitForTimeout(300);
  let status = await page.textContent('.status-line');
  check('station catalog fetched', /received/i.test(status), status);

  await page.click('[data-merge]');
  await page.waitForTimeout(200);
  status = await page.textContent('.status-line');
  check('merge reports candidates', /candidate/i.test(status), status);
  const conflictCards = await page.locator('.conflict').count();
  check('7 conflict cards shown', conflictCards === 7, `got ${conflictCards}`);
  const confirmDisabled = await page.isDisabled('[data-confirm]');
  check('confirm disabled until all candidates picked', confirmDisabled);

  // pick every candidate: local for captions, remote for sequences (mix)
  const choices = page.locator('.conflict');
  const n = await choices.count();
  for (let i = 0; i < n; i++) {
    const card = choices.nth(i);
    const title = await card.locator('.conflict__title').textContent();
    const side = /order/i.test(title) ? 'remote' : 'local';
    await card.locator(`[data-side="${side}"]`).click();
  }
  await page.waitForTimeout(100);
  check('confirm enabled after all picks', !(await page.isDisabled('[data-confirm]')));
  await page.click('[data-confirm]');
  await page.waitForTimeout(250);
  status = await page.textContent('.status-line');
  check('confirm message says recomputed', /recomput/i.test(status), status);

  // derived views recomputed: local caption kept, sequences from remote,
  // covers follow selected+order
  await page.goto(`${BASE}/series.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.series-card');
  // remote top-level order puts Wilderness first
  const firstSeries = await page.textContent('.series-card:first-child h3');
  check('series order recomputed to station choice', /Wilderness/.test(firstSeries), firstSeries);
  // wilderness cover must skip dropped landscape-01
  const wildCard = page.locator('.series-card', { hasText: 'Wilderness' });
  const wildCover = await wildCard.locator('.cover img').getAttribute('src');
  check('cover skips dropped landscape-01', /landscape-02/.test(wildCover), wildCover);

  await page.goto(`${BASE}/works.html?sid=gaze`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.photo-card');
  const firstGaze = await page.getAttribute('.photo-card:first-child .frame img', 'src');
  check('lightbox/grid order follows station Gaze sequence (portrait-04 first)', /portrait-04/.test(firstGaze), firstGaze);
  // venue caption preserved (local candidate)
  const bodyText = await page.textContent('#photo-grid');
  check('local caption candidate kept', /drawn curtain/i.test(bodyText));
  // station-only edit applied
  check('station-only drop of portrait-05 applied', await page.locator('[data-photo-id="portrait-05"].is-dropped').count() === 1);

  // ---------------- Failure -> rollback -> retry ------------------------
  await page.goto(`${BASE}/series.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#sync-host');
  // force fetch failure
  await page.click('[data-retry-fail]');
  await page.waitForTimeout(300);
  status = await page.textContent('.status-line');
  check('fetch failure reported, draft untouched', /retry from the baseline/i.test(status), status);
  // corrupted catalog -> merge structural rejection -> rollback
  await page.click('[data-broken]');
  await page.waitForTimeout(300);
  await page.click('[data-merge]');
  await page.waitForTimeout(300);
  status = await page.textContent('.status-line');
  check('structural merge failure reverts to draft', /reverted to the original draft/i.test(status), status);

  // retry the good fetch/merge from baseline still works
  await page.click('[data-fetch]');
  await page.waitForTimeout(300);
  await page.click('[data-merge]');
  await page.waitForTimeout(300);
  status = await page.textContent('.status-line');
  check('retry from baseline produces a merge again', /merge|candidate|ready/i.test(status), status);

  // ---------------- Contact form feedback -------------------------------
  await page.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
  await page.click('button[type=submit]');
  await page.waitForTimeout(100);
  check('empty submit shows error feedback', /fix the highlighted/i.test(await page.textContent('#form-feedback')));
  check('inline email error present', (await page.textContent('[data-err=email]')).length > 0);
  await page.fill('#f-name', 'Avery Chen');
  await page.fill('#f-email', 'not-an-email');
  await page.selectOption('#f-topic', 'Press / interview');
  await page.fill('#f-message', 'Would love to arrange a venue interview next week.');
  await page.click('button[type=submit]');
  await page.waitForTimeout(150);
  check('invalid email blocked', /fix the highlighted/i.test(await page.textContent('#form-feedback'))
    && /valid email/i.test(await page.textContent('[data-err=email]')));
  await page.fill('#f-email', 'avery@example.com');
  await page.click('button[type=submit]');
  await page.waitForTimeout(200);
  check('valid submit gives success', /sent/i.test(await page.textContent('#form-feedback')));

  // offline queue
  await page.goto(`${BASE}/series.html`, { waitUntil: 'networkidle' });
  await page.check('[data-sim-offline]');
  await page.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
  await page.fill('#f-name', 'Bo Lin');
  await page.fill('#f-email', 'bo@example.com');
  await page.selectOption('#f-topic', 'Other');
  await page.fill('#f-message', 'Queue this while the venue network is down please.');
  await page.click('button[type=submit]');
  await page.waitForTimeout(200);
  check('offline submit queues with warning', /queued/i.test(await page.textContent('#form-feedback')));
  check('queue status shows 1 waiting', /1 message waiting/.test(await page.textContent('#queue-status')));

  // ---------------- Phone: single column --------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/works.html`, { waitUntil: 'networkidle' });
  // uncheck sim offline via store to avoid sticky state confusion in layout
  await page.waitForSelector('.photo-grid');
  const cols = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.photo-grid')).gridTemplateColumns.split(' ').length);
  check('phone layout is single column', cols === 1, `got ${cols} cols`);

  // ---------------- Shared data across pages ----------------------------
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const statSel = await page.textContent('[data-stat-selected]');
  check('home reads the same merged catalog (selection reflected)', parseInt(statSel, 10) < 14, `selected=${statSel}`);

  check('no console/page errors anywhere', errors.length === 0, errors.join(' | ').slice(0, 400));
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ' — ' + r.extra}`);
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (errors.length) console.log('CONSOLE ERRORS:', errors);
  await browser.close();
  process.exit(failed ? 1 : 0);
}

run().catch(async (e) => {
  console.error('E2E crashed:', e);
  if (browser) await browser.close();
  process.exit(2);
});
