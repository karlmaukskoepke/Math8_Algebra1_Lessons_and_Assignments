# Mr. Mauks - class sites

Static site (no build step). Hosted on GitHub Pages.

| File | What it is |
|---|---|
| `index.html` | Landing page: pick Algebra 1 or Math 8 |
| `algebra1.html`, `math8.html` | The two class pages (identical except for `data-class` and the names) |
| `css/site.css` | All colors, fonts, and layout. Class accent colors live under "CLASS ACCENTS" |
| `js/app.js` | Loads the feeds and draws the page |
| `js/config.js` | **Paste the Apps Script web app URL here** |
| `js/sample-data.js` | Made-up lessons used only while `WEB_APP_URL` is blank. Safe to delete once live |

## Connect it to real lessons
1. Open `js/config.js` and paste the web app URL (ends in `/exec`, and must NOT contain `/u/1/`).
2. Commit. The site now reads `?class=algebra1` and `?class=algebra1&part=links` from the backend.

## Publish on GitHub Pages
Repo -> Settings -> Pages -> Deploy from a branch -> `main` / root. The site appears at
`https://<username>.github.io/<repo-name>/`.

## Notes
- Answer-key timing, weekend hiding, and Teacher Notes are all enforced by the Apps Script backend, not by this site.
- Each browser keeps its last good copy of the lessons, so a slow or failed request never leaves a blank page.
- Adding a class later: copy `algebra1.html`, change `data-class`, the names, and add a color block in `site.css`, plus an entry in the backend `CLASSES`.
