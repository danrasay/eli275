// Static acceptance checks for the built page. Run: node build.mjs && node test/check.mjs
// Covers HANDOFF.md section 7 checks 1, 4, 7 and 8, plus data integrity and contrast.
// The click, scroll, deep link and phone checks (2, 3, 5, 6) run in a browser: test/selftest.js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const exhibits = JSON.parse(read('data/exhibits.json'));
const questions = JSON.parse(read('data/questions.json'));
const template = read('src/walkthrough.template.html');
const built = read('walkthrough/index.html');

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

// The page's own formatter, lifted out of the built file so the test cannot drift from what ships.
const fmtSrc = /\/\*fmt:start\*\/([\s\S]*?)\/\*fmt:end\*\//.exec(built)[1];
const { fmt, decimals } = vm.runInNewContext(`${fmtSrc}; ({ fmt, decimals })`);

const org = Object.fromEntries(exhibits.organizations.map((o) => [o.id, o]));
const rowOf = (ref) => org[ref.org]?.exhibits.find((x) => x.n === ref.exhibit)?.rows.find((r) => r.id === ref.row);

// Check 1: every var token resolves to a cell, and its value is the cell's value.
let refs = 0;
const missing = [];
const mismatched = [];
for (const q of questions.questions) {
  q.steps.forEach((st, si) => {
    for (const t of st.equation) {
      if (t.type !== 'var') continue;
      refs++;
      const where = `Q${q.n} step ${si + 1} "${t.text}"`;
      const row = rowOf(t.ref);
      const years = t.ref.years ?? [t.ref.year];
      if (!row || !row.values || years.some((y) => typeof row.values[y - 1] !== 'number')) {
        missing.push(where);
        continue;
      }
      const cells = years.map((y) => row.values[y - 1]);
      const given = Array.isArray(t.value) ? t.value : [t.value];
      if (cells.length !== given.length || cells.some((c, i) => c !== given[i])) mismatched.push(where);
    }
  });
}
check(`1. all ${refs} var refs resolve to a cell`, missing.length === 0, missing.join('; '));
check('1b. every token value equals its cell', mismatched.length === 0, mismatched.join('; '));
check('1c. 12 questions and a bonus', questions.questions.length === 12 && questions.bonus.answer.length === 2);

// Check 4: parentheses for negatives, decimals per organization, never a minus sign.
const cases = [
  [-17451, 0, '(17,451)'], [56711, 0, '56,711'], [0, 0, '0'], [767, 0, '767'],
  [-1045.7, 1, '(1,045.7)'], [165, 1, '165.0'], [0, 1, '0.0'], [1007.2, 1, '1,007.2'], [49471, 0, '49,471'],
];
check('4. formatter cases', cases.every(([v, d, want]) => fmt(v, d) === want),
  cases.filter(([v, d, want]) => fmt(v, d) !== want).map(([v, d, want]) => `${v}/${d} gave ${fmt(v, d)}, want ${want}`).join('; '));
const shape = { 0: /^\(?\d{1,3}(,\d{3})*\)?$/, 1: /^\(?\d{1,3}(,\d{3})*\.\d\)?$/ };
const badCells = [];
let cellCount = 0;
for (const o of exhibits.organizations) {
  for (const x of o.exhibits) {
    for (const r of x.rows) {
      if (r.kind === 'section') continue;
      if (!Array.isArray(r.values) || r.values.length !== 4) { badCells.push(`${o.id}${x.n}.${r.id} needs four values`); continue; }
      // The expected decimals come from the data, not from the function under test.
      const want = r.kind === 'memo' ? 0 : o.decimals;
      const d = decimals(o, r);
      if (d !== want) badCells.push(`${o.id}${x.n}.${r.id} uses ${d} decimals, wants ${want}`);
      for (const v of r.values) {
        cellCount++;
        const s = fmt(v, d);
        if (!shape[want].test(s) || (v < 0) !== s.startsWith('(') || s.includes('-')) badCells.push(`${o.id}${x.n}.${r.id}=${s}`);
      }
    }
  }
}
check(`4b. all ${cellCount} exhibit cells print in the right shape`, badCells.length === 0, badCells.slice(0, 5).join('; '));
check('4c. Y has no decimals, Z has one', org.Y.decimals === 0 && org.Z.decimals === 1);

// Check 7: no em or en dashes anywhere in the built file or its sources.
const dash = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
check('7. no em or en dashes in walkthrough/index.html', !dash.test(built));
check('7b. no em or en dashes in the template or the data',
  !dash.test(template) && !dash.test(read('data/exhibits.json')) && !dash.test(read('data/questions.json')));

// Check 8 (static half): the inlined data is the source data, bonus included.
const inlined = (id) => JSON.parse(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(built)[1]);
check('8. inlined questions equal data/questions.json', JSON.stringify(inlined('data-questions')) === JSON.stringify(questions));
check('8b. inlined exhibits equal data/exhibits.json', JSON.stringify(inlined('data-exhibits')) === JSON.stringify(exhibits));
check('8c. no build placeholders left', !/__(EXHIBITS|QUESTIONS)_JSON__/.test(built));

// Footer text, as specified.
const footer = "Prepared for ELI 275 Entrepreneurial Finance, Lewis &amp; Clark College, Fall 2026. Figures from the organizations' audited statements, relabelled for the course. Built with help from Claude (Anthropic).";
check('footer text', built.includes(`<footer>${footer}</footer>`));

// The page names both organizations, so it asks search engines to leave it out.
check('robots noindex tag', built.includes('<meta name="robots" content="noindex">'));

// Design system: flat, square, no emoji, no images.
const css = /<style>([\s\S]*?)<\/style>/.exec(built)[1];
check('no shadows or gradients', !/box-shadow|text-shadow|gradient\(/.test(css));
check('zero corner radius', !/border-radius:(?!0)/.test(css));
check('no images', !/<img|<svg|<picture|url\(/.test(built.replace(/<script type="application\/json"[\s\S]*?<\/script>/g, '')));
check('no emoji', !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(built));

// Contrast, WCAG 2.x. Text pairs need 4.5; edges and outlines need 3.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// Read the colours from the page's own tokens, so a changed token is a re-run check.
const tok = Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map(([, k, v]) => [k, v]));
const C = { orange: tok.orange, hover: tok['orange-hover'], burnt: tok.burnt, teal: tok.teal, tint: tok['teal-tint'], ink: tok.ink, body: tok.body, muted: tok.muted, white: tok.white, cream: tok.cream };
check('colour tokens found in the page', Object.values(C).every((v) => /^#[0-9A-Fa-f]{6}$/.test(v ?? '')), JSON.stringify(C));
const pairs = [
  ['ink on white', C.ink, C.white, 4.5], ['ink on cream', C.ink, C.cream, 4.5],
  ['body on white', C.body, C.white, 4.5], ['body on cream', C.body, C.cream, 4.5],
  ['muted on white', C.muted, C.white, 4.5], ['muted on cream', C.muted, C.cream, 4.5],
  ['burnt label on white card', C.burnt, C.white, 4.5],
  ['ink on orange button', C.ink, C.orange, 4.5], ['ink on hover orange', C.ink, C.hover, 4.5],
  ['white on pressed burnt', C.white, C.burnt, 4.5],
  ['ink on teal tint', C.ink, C.tint, 4.5], ['body on teal tint', C.body, C.tint, 4.5],
  ['teal outline on white', C.teal, C.white, 3], ['teal outline on cream', C.teal, C.cream, 3],
  ['chip edge on white', C.muted, C.white, 3], ['focus ring on cream', C.burnt, C.cream, 3],
];
for (const [name, fg, bg, need] of pairs) {
  const r = ratio(fg, bg);
  check(`contrast ${name}`, r >= need, `${r.toFixed(2)} (needs ${need})`);
}

// The tour, the landing page at index.html.
const tourSrc = read('src/tour.template.html');
const tour = read('index.html');
check('tour: no em or en dashes', !dash.test(tour) && !dash.test(tourSrc));
check('tour: robots noindex tag', tour.includes('<meta name="robots" content="noindex">'));
check('tour: no build placeholders left', !/__[A-Z_]+__|<!--BODY-->/.test(tour));
check('tour: names neither organization', !/Hampshire|Arizona|Amherst|Tucson/.test(tour));
check('tour: opens the walkthrough beside it', tour.includes('<a class="btn" href="walkthrough/">Open the walkthrough</a>'));
check('tour: old step links forward to the walkthrough', tour.includes("location.replace('walkthrough/' + h)"));
const tourJson = (id) => JSON.parse(new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)</script>`).exec(tour)[1]);
check('tour: inlined questions equal the source, without the bonus answers',
  JSON.stringify(tourJson('tour-questions').questions) === JSON.stringify(questions.questions) && !('answer' in tourJson('tour-questions').bonus));
check('tour: inlined exhibits equal the source', JSON.stringify(tourJson('tour-exhibits').organizations) === JSON.stringify(exhibits.organizations));
const scripts = [...tour.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parses = true;
try { scripts.forEach((code) => new vm.Script(code)); } catch (e) { parses = false; console.log(e.message); }
check(`tour: its ${scripts.length} scripts parse`, parses && scripts.length === 2);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll static checks passed');
process.exit(failed ? 1 : 0);
