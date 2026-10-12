# Organizations Y and Z solution walkthrough

A single-page review companion for the ELI 275 team challenge. It is built to a handoff spec (`HANDOFF.md`) that is kept out of this repository.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The built page. Self-contained: this one file is what you deploy. |
| `src/index.template.html` | The page source (HTML, CSS and JavaScript). Edit this, not `index.html`. |
| `data/exhibits.json`, `data/questions.json` | The source of truth for every figure, question and step. |
| `build.mjs` | Inlines the two JSON files into the template and writes `index.html`. |
| `test/check.mjs` | Static acceptance checks: every reference resolves, number formats, no em or en dashes, inlined data equals the source, contrast. |
| `test/selftest.js` | Browser acceptance checks: clicks every chip and reads the page back. |

## Build and check

Needs Node 18 or later. No packages to install.

```bash
node build.mjs && node test/check.mjs
```

For the browser checks, serve this folder, open the page, and run this in the console. Repeat at a phone width.

```js
const { run } = await import('./test/selftest.js'); const r = await run(); console.log(r.ok, r.failures)
```

## Deploy

The page is published with GitHub Pages from the `main` branch of this repository, so a push deploys it:
https://danrasay.github.io/eli275/yz-walkthrough/

Rebuild and commit `index.html` before you push; Pages serves the committed file as is. The page loads Raleway and Lato from Google Fonts and falls back to system fonts offline. It carries a `noindex` tag, so search engines leave it out of results.

Deep links: `#q4s2` opens Question 4 at step 2; `#bonus` opens the reveal.
