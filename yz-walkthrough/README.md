# Organizations Y and Z solution walkthrough

A review companion for the ELI 275 team challenge, in two pages: an animated tour that shows students how to use it, and the solution walkthrough itself. The walkthrough is built to a handoff spec (`HANDOFF.md`) that is kept out of this repository.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The built tour, the folder's landing page. Self-contained. |
| `walkthrough/index.html` | The built walkthrough. Self-contained. |
| `src/tour.template.html` | The tour source. It plays ten scenes on a live miniature of the walkthrough. |
| `src/walkthrough.template.html` | The walkthrough source (HTML, CSS and JavaScript). The Organization W walkthrough is built from this same template, from a private folder. |
| `data/exhibits.json`, `data/questions.json` | The source of truth for every figure, question and step, in both pages. |
| `build.mjs` | Inlines the two JSON files into both templates and writes both pages. Edit the templates, never the built pages. |
| `test/check.mjs` | Static acceptance checks: every reference resolves, number formats, no em or en dashes, inlined data equals the source, contrast, and the tour's links and data. |
| `test/selftest.js` | Browser acceptance checks: clicks every chip and reads the page back. |

## Build and check

Needs Node 18 or later. No packages to install.

```bash
node build.mjs && node test/check.mjs
```

For the browser checks, serve this folder, open `walkthrough/`, and run this in the console. Repeat at a phone width.

```js
const { run } = await import('../test/selftest.js'); const r = await run(); console.log(r.ok, r.failures)
```

## Deploy

Both pages are published with GitHub Pages from the `main` branch of this repository, so a push deploys them:

- Tour: https://danrasay.github.io/eli275/yz-walkthrough/
- Walkthrough: https://danrasay.github.io/eli275/yz-walkthrough/walkthrough/

Rebuild and commit both built pages before you push; Pages serves the committed files as they are. Both load Raleway and Lato from Google Fonts and fall back to system fonts offline. Both carry a `noindex` tag, so search engines leave them out of results.

Deep links: `walkthrough/#q4s2` opens Question 4 at step 2; `walkthrough/#bonus` opens the reveal. Links made before the tour took the folder's address (`yz-walkthrough/#q4s2`) are forwarded to the walkthrough.

The tour also lives as a private claude.ai artifact. To rebuild that copy: `node build.mjs --artifact <file>`, then publish the file to the same artifact.
