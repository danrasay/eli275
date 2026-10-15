// Builds the two pages of this folder from src/ and data/:
//   index.html              the animated tour, the folder's landing page   (src/tour.template.html)
//   walkthrough/index.html  the solution walkthrough itself                (src/walkthrough.template.html)
// The JSON files stay the source of truth. Run: node build.mjs
// For the claude.ai artifact copy of the tour, add: --artifact <file>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const write = (url, s) => {
  mkdirSync(new URL('.', url), { recursive: true });
  writeFileSync(url, s);
  console.log(`${url.pathname.split('/yz-walkthrough/').pop()} written, ${Buffer.byteLength(s)} bytes`);
};

// Minify, and keep the payload inert inside a <script> element.
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');
const inline = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c').replace(LS, '\\u2028').replace(PS, '\\u2029');

const exhibits = JSON.parse(read('data/exhibits.json'));
const questions = JSON.parse(read('data/questions.json'));

// Function replacers throughout: the data contains "$1.00", which a string replacer would mangle.
const walkthrough = read('src/walkthrough.template.html')
  .replace('__EXHIBITS_JSON__', () => inline(exhibits))
  .replace('__QUESTIONS_JSON__', () => inline(questions));
write(new URL('walkthrough/index.html', root), walkthrough);

// The tour never shows the reveal, so it carries the bonus title but not the answers.
const tourData = { questions: questions.questions, bonus: { part: questions.bonus.part, title: questions.bonus.title } };
const tour = (href, target) => read('src/tour.template.html')
  .replace('__EXHIBITS_JSON__', () => inline({ organizations: exhibits.organizations }))
  .replace('__QUESTIONS_JSON__', () => inline(tourData))
  .replaceAll('__WALK_HREF__', () => href)
  .replaceAll('__WALK_TARGET__', () => target);

// On the course site the tour is a full page that links to the walkthrough beside it.
const parts = tour('walkthrough/', '').split('<!--BODY-->');
if (parts.length !== 2) throw new Error('src/tour.template.html needs exactly one <!--BODY--> marker');
const site = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<script>
// Links made before the tour took this address (#q9s3, #bonus) still open that step of the walkthrough.
(function () { var h = location.hash; if (/^#(q\\d+(s\\d+)?|bonus)$/i.test(h)) location.replace('walkthrough/' + h); })();
</script>
${parts[0].trim()}
</head>
<body>
${parts[1].trim()}
</body>
</html>
`;
write(new URL('index.html', root), site);

// The claude.ai artifact host supplies the document shell and opens other sites in a new tab.
const at = process.argv.indexOf('--artifact');
if (at > -1) {
  const file = process.argv[at + 1];
  if (!file) throw new Error('--artifact needs a file path');
  const artifact = tour('https://danrasay.github.io/eli275/yz-walkthrough/walkthrough/', ' target="_blank" rel="noopener"').replace('<!--BODY-->\n', '');
  write(new URL(`file://${file.startsWith('/') ? file : process.cwd() + '/' + file}`), artifact);
}
