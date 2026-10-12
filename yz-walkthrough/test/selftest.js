// Browser half of the acceptance checks (HANDOFF.md section 7: checks 2, 3, 5, 6, 7, 8).
// Serve the folder, open index.html, then in the console run:
//   const { run } = await import('./test/selftest.js'); console.table((await run()).failures)
// It drives the real page: sets the hash, clicks every chip, and reads the DOM back.

const tick = () => new Promise((r) => setTimeout(r, 0));
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

async function goto(hash) {
  if (location.hash !== hash) {
    location.hash = hash;
    await tick();
    await tick();
  }
}

export async function run() {
  const EX = JSON.parse($('#data-exhibits').textContent);
  const QD = JSON.parse($('#data-questions').textContent);
  const org = Object.fromEntries(EX.organizations.map((o) => [o.id, o]));
  const failures = [];
  let chips = 0, cells = 0, crossOrg = 0, crossExhibit = 0;
  const fail = (where, what) => failures.push({ where, what });
  const startHash = location.hash;
  const wrap = $('#wrap');

  for (const q of QD.questions) {
    const N = q.steps.length;
    await goto(`#q${q.n}s${N}`);
    if ($$('.step:not([hidden])').length !== N) fail(`Q${q.n}`, `expected ${N} steps shown`);
    if ($('#answer').hidden) fail(`Q${q.n}`, 'answer hidden with all steps shown');
    const seen = new Set();
    for (const [si, st] of q.steps.entries()) {
      for (const [ti, t] of st.equation.entries()) {
        if (t.type !== 'var') continue;
        chips++;
        const where = `Q${q.n} step ${si + 1} "${t.text}"`;
        const chip = $(`.chip[data-s="${si}"][data-t="${ti}"]`);
        if (!chip) { fail(where, 'chip not rendered'); continue; }
        chip.click();
        await tick();
        const o = org[t.ref.org];
        const x = o.exhibits.find((e) => e.n === t.ref.exhibit);
        const row = x.rows.find((r) => r.id === t.ref.row);
        const years = t.ref.years ?? [t.ref.year];
        seen.add(`${t.ref.org}${t.ref.exhibit}`);

        // The chip is the active one, and the only one.
        const active = $$('.chip.active');
        if (active.length !== 1 || active[0] !== chip || chip.getAttribute('aria-pressed') !== 'true') fail(where, 'chip not marked active');
        if (!chip.getAttribute('aria-label').startsWith(`${t.text}, ${o.name}, `)) fail(where, `aria-label is "${chip.getAttribute('aria-label')}"`);

        // The pane shows the right organization and exhibit.
        if ($('#orgSwitch [aria-pressed="true"]')?.dataset.org !== t.ref.org) fail(where, 'wrong organization shown');
        if (+$('#exSwitch [aria-pressed="true"]')?.dataset.ex !== t.ref.exhibit) fail(where, 'wrong exhibit shown');
        if ($('#exTitle').textContent !== x.title) fail(where, `exhibit title is "${$('#exTitle').textContent}"`);
        if ($('#exUnits').textContent !== o.units) fail(where, 'units line wrong');

        // Exactly the referenced cells are lit, in the right row, with the printed values.
        const lit = $$('td[aria-current="true"]', wrap);
        if (lit.length !== years.length || $$('td.hl', wrap).length !== years.length) fail(where, `${lit.length} cells lit, expected ${years.length}`);
        const printed = $$('.chip-v span', chip).map((s) => s.textContent);
        const wr = wrap.getBoundingClientRect();
        // Measure a header cell, not the thead: the cells are sticky, the thead scrolls away.
        const headBottom = $('thead th', wrap).getBoundingClientRect().bottom;
        lit.forEach((td, i) => {
          cells++;
          const tr = td.closest('tr');
          if (tr.dataset.row !== t.ref.row) fail(where, `lit row is ${tr.dataset.row}`);
          if (+td.dataset.y !== years[i]) fail(where, `lit year is ${td.dataset.y}`);
          if (td.textContent !== printed[i]) fail(where, `cell prints ${td.textContent}, chip prints ${printed[i]}`);
          if (/-/.test(td.textContent) || (row.values[years[i] - 1] < 0) !== td.textContent.startsWith('(')) fail(where, `negative not in parentheses: ${td.textContent}`);
          if (getComputedStyle(td).fontWeight < 700) fail(where, 'lit cell is not bold');
          if ($('th', tr).textContent !== row.label) fail(where, 'row label missing');
          // Scrolled into view, clear of the sticky header and the pane edges.
          const r = td.getBoundingClientRect();
          if (r.top < headBottom - 1 || r.bottom > wr.bottom + 1) fail(where, 'lit cell is not in view vertically');
          if (years.length === 1 && (r.left < wr.left - 1 || r.right > wr.left + wrap.clientWidth + 1)) fail(where, 'lit cell is not in view horizontally');
          // Roughly the middle of the pane, unless the table cannot scroll that far.
          const mid = (headBottom + wr.bottom) / 2, c = (r.top + r.bottom) / 2;
          const atEdge = wrap.scrollTop < 2 || wrap.scrollTop + wrap.clientHeight > wrap.scrollHeight - 2;
          if (!atEdge && Math.abs(c - mid) > 24) fail(where, `lit row is ${Math.round(c - mid)}px off the middle`);
        });
      }
    }
    if (new Set([...seen].map((k) => k[0])).size > 1) crossOrg++;
    if (new Set([...seen].map((k) => k.slice(1))).size > 1) crossExhibit++;
  }

  // Check 3: Q7 chips light four cells in one row.
  await goto('#q7s3');
  for (const chip of $$('.chip')) {
    chip.click();
    await tick();
    const lit = $$('td.hl', wrap);
    if (lit.length !== 4 || new Set(lit.map((td) => td.closest('tr'))).size !== 1) fail('Q7', `multi-year chip lit ${lit.length} cells`);
  }

  // Arrival: step 1 with its first variable already selected, pane never empty.
  for (const q of QD.questions) {
    await goto(`#q${q.n}s1`);
    const first = q.steps[0].equation.find((t) => t.type === 'var');
    if ($$('.step:not([hidden])').length !== 1) fail(`Q${q.n} arrival`, 'more than step 1 shown');
    if (first && $$('td.hl', wrap).length === 0) fail(`Q${q.n} arrival`, 'no cell selected on arrival');
    if (!$('table', wrap)) fail(`Q${q.n} arrival`, 'statement pane is empty');
  }

  // Check 5: deep links.
  await goto('#q9s3');
  if (!$('#qtitle').textContent.startsWith('Question 9:')) fail('#q9s3', 'wrong question');
  if ($$('.step:not([hidden])').length !== 3 || !$('#step3').classList.contains('current')) fail('#q9s3', 'not at step 3');
  if ($('#rail [aria-current="page"]')?.dataset.q !== '9') fail('#q9s3', 'strip does not mark question 9');
  await goto('#bonus');
  if ($('#qtitle').textContent !== QD.bonus.title) fail('#bonus', 'bonus screen not shown');

  // Check 8: the bonus screen matches bonus.answer word for word.
  const cards = $$('.org-card');
  if (cards.length !== QD.bonus.answer.length) fail('bonus', `${cards.length} cards`);
  QD.bonus.answer.forEach((a, i) => {
    const card = cards[i];
    if (!card) return;
    if ($('h3', card).textContent !== a.name) fail('bonus', `name ${i}`);
    if ($('.place', card).textContent !== a.place) fail('bonus', `place ${i}`);
    if ($('.outcome', card).textContent !== a.outcome) fail('bonus', `outcome ${i}`);
    if ($('.org-tag', card).textContent !== org[a.org].name) fail('bonus', `org tag ${i}`);
  });
  if ($('.tone').textContent !== QD.bonus.tone) fail('bonus', 'tone line');
  if ($$('img, svg, picture').length) fail('bonus', 'an image is present');

  // Step reveal and keyboard.
  await goto('#q1s1');
  const key = (k, shift = false) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true, cancelable: true }));
  $('#btnNext').click();
  if (location.hash !== '#q1s2' || $$('.step:not([hidden])').length !== 2) fail('Next step', `hash ${location.hash}`);
  key('ArrowRight');
  if (location.hash !== '#q1s3') fail('Right arrow', `hash ${location.hash}`);
  key('ArrowLeft');
  if (location.hash !== '#q1s2') fail('Left arrow', `hash ${location.hash}`);
  $('#btnAll').click();
  if (location.hash !== '#q1s6' || $('#answer').hidden || !$('#btnNext').disabled) fail('Show all', `hash ${location.hash}`);
  $('#btnReset').click();
  if (location.hash !== '#q1s1' || $$('.step:not([hidden])').length !== 1 || !$('#btnReset').disabled) fail('Reset', `hash ${location.hash}`);
  key('ArrowRight', true);
  if (location.hash !== '#q2s1') fail('Shift+Right', `hash ${location.hash}`);
  key('ArrowLeft', true);
  if (location.hash !== '#q1s1') fail('Shift+Left', `hash ${location.hash}`);
  $('#btnNextQ').click();
  if (location.hash !== '#q2s1') fail('Next question', `hash ${location.hash}`);
  $('#btnPrevQ').click();
  if (location.hash !== '#q1s1' || !$('#btnPrevQ').disabled) fail('Previous question', `hash ${location.hash}`);

  // Checks 6 and 7 on every screen: no sideways page scroll, no em or en dashes, footer present.
  const footer = "Prepared for ELI 275 Entrepreneurial Finance, Lewis & Clark College, Fall 2026. Figures from the organizations' audited statements, relabelled for the course. Built with help from Claude (Anthropic).";
  for (const hash of [...QD.questions.map((q) => `#q${q.n}s${q.steps.length}`), '#bonus']) {
    await goto(hash);
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) fail(hash, `page scrolls sideways: ${de.scrollWidth} > ${de.clientWidth}`);
    if (new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']').test(document.body.innerText)) fail(hash, 'em or en dash in rendered text');
    if ($('footer').textContent !== footer) fail(hash, 'footer text');
  }

  await goto(startHash || '#q1s1');
  return {
    ok: failures.length === 0,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    fonts: ['Lato', 'Raleway'].map((f) => `${f}: ${document.fonts.check(`700 16px "${f}"`) ? 'loaded' : 'fallback'}`).join(', '),
    chips, cells, crossOrg, crossExhibit, failures,
  };
}
