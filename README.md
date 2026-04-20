# Docutron - retrograde's easy documentation suite.

> [!NOTE]
> Version 1.2 is here. Grab the [complete 1.2 package from releases](https://github.com/retr0gr4d3/docutron/releases/tag/1.2).

This folder is a **standalone, static documentation viewer**: Markdown sources, a generated manifest, and a single-page app that renders docs in the browser with [marked](https://marked.js.org/) and [DOMPurify](https://github.com/cure53/DOMPurify). You can copy this tree into its **own repository** and host it on any static file host.

There is **no server-side rendering**. You **do** need to regenerate `manifest.json` whenever you add, remove, or rename `.md` files under `content/` (or change manifest-driven fields such as **category order** in `category-order.json`), so the sidebar stays in sync.

---

Check out the base project live over at my site, [retrograde.org.uk](https://retrograde.org.uk/docutron-example/).

Or, if you fancy seeing it in action, this project has already been used in the wild by OfficiallySp for his API documentation for ChatStats.live - If you would like to see this projects capabilities in a production setting, check out [ChatStats.live](https://chatstats.live/docs/main/#/content/site/documentation-hub.md) and while you're at it, check out their awesome project too!

---

## Table of contents

1. [Requirements](#requirements)
2. [Directory layout](#directory-layout)
3. [Quick start](#quick-start)
4. [How it works](#how-it-works)
5. [Front matter reference](#front-matter-reference)
6. [The manifest](#the-manifest)
7. [Authoring Markdown](#authoring-markdown)
8. [Routing and URLs](#routing-and-urls)
9. [UI behavior](#ui-behavior)
10. [Announcement bar](#announcement-bar)
11. [Local development](#local-development)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)
14. [File reference](#file-reference)

---

## Requirements

| Need | Why |
|------|-----|
| **HTTP server** | Browsers block `fetch()` for `manifest.json` and `.md` files from `file://`. Use any static host or a one-line local server. |
| **Node.js** (optional but recommended) | To run `scripts/build-manifest.mjs` and refresh `manifest.json`. |
| **Network** (first visit) | `main/index.html` loads **marked** and **DOMPurify** from jsDelivr CDN. |

---

## Directory layout

Everything the viewer needs lives **inside this folder** (no dependency on paths outside it):

```
Documentation/
├── README.md                 ← this file
├── index.html                ← optional landing page (site home)
├── category-order.json       ← optional; ordered list of sidebar category names
├── manifest.json             ← generated; lists all docs for the sidebar
├── doc-app.js                ← client app: manifest, sidebar, MD render, nav
├── src/
│   ├── images/               ← e.g. R.png for favicon and header logos
│   ├── announcement-banner.js ← dismiss + versioned localStorage for the site banner
│   └── styles.css            ← shared styles for `index.html` and `main/index.html`
├── content/                  ← all documentation Markdown
│   ├── core/
│   ├── guides/
│   └── experiments/
├── main/
│   └── index.html            ← documentation viewer entry
└── scripts/
    └── build-manifest.mjs    ← scans content/ and writes manifest.json
```

Paths in front matter (e.g. `prev`, `next`) are relative to this **Documentation** root, same as entries in `manifest.json` (for example `content/guides/writing-docs.md`).

---

## Quick start

1. **Add or edit** Markdown under `content/` using the [front matter](#front-matter-reference) format.

2. **Optional:** edit **`category-order.json`** to control the **order of categories** in the sidebar (see [The manifest](#the-manifest)). Skip this file if alphabetical category order is fine.

3. **Regenerate the manifest** from inside this folder:

   ```bash
   cd Documentation
   node scripts/build-manifest.mjs
   ```

   Or from a parent repo path:

   ```bash
   node path/to/Documentation/scripts/build-manifest.mjs
   ```

4. **Commit** `manifest.json` (and `category-order.json` if you use it) if you use Git.

5. **Open the viewer** over HTTP. If the server root is the `Documentation` folder:

   ```text
   http://localhost:PORT/main/index.html
   ```

   If the server root is a parent directory, include the path segment (for example `http://localhost:PORT/Documentation/main/index.html`).

---

## How it works

1. **`main/index.html`** loads `doc-app.js` with `data-doc-base="../"` so requests resolve to `manifest.json` and `content/...` next to `main/`.

2. **`doc-app.js`** fetches `manifest.json`, groups documents by **category**, orders categories using **`categoryOrder`** from the manifest when present (otherwise **A–Z**), sorts within each group by **order** then **title**, and renders the left sidebar.

3. **Navigation** uses the URL **hash**: `#/content/core/getting-started.md`. The default document is the first entry in [reading order](#routing-and-urls) if the hash is missing or invalid.

4. For the **active page**, the app fetches the raw `.md` file, parses the HTML-comment front matter, strips it from the body, runs the body through **marked** (GFM), then **DOMPurify**, and injects the result into the article panel.

5. **Authors**, **tags**, and **previous/next** controls are driven by front matter on the **current** page.

**Assets:** `main/index.html` uses `../src/images/` for icons and the header logo. Keep those images in `src/images/` when you copy this repo.

---

## Front matter reference

Place a **single HTML comment** at the **very top** of each `.md` file. Inside it, put a YAML block between `---` lines:

```markdown
<!--
---
title: Page title
category: Core
order: 10
tags: ["tag-one", "tag-two"]
authors: ["Author Name"]
author: Single Author
last_edited: YYYY-MM-DD
prev: content/<folder>/<title>.md
next: content/<folder>/<title>.md
prev_label: Optional override
next_label: Optional override
---
-->

# Page title

Body starts here.
```

### Core fields (sidebar & manifest)

| Field | Required | Description |
|--------|----------|-------------|
| **title** | Recommended | Page title; shown as the main `<h1>` and in the sidebar. |
| **category** | Recommended | Groups the page in the sidebar (e.g. `Core`, `Guides`). Defaults to `General` if omitted. |
| **order** | Recommended | Number used to sort pages **within** a category (lower first). Non-numeric values fall back to a default ordering. |
| **tags** | Optional | JSON-like array string, e.g. `["docs", "setup"]`. Shown as pills **below** authors. Included in `manifest.json`. |
| **authors** | Optional | Array of author names, e.g. `["Ada", "Bob"]`. Shown **above** tags. Included in `manifest.json`. |
| **author** | Optional | Single author string; shorthand for one author. You can use **either** `authors` or `author`, not both for the same intent. |
| **last_edited** | Optional | ISO date (`YYYY-MM-DD`) or free text; shown at the top right next to the breadcrumb in the doc viewer (not in `manifest.json`). |

### Previous / next (footer buttons)

These are **optional** and **per page**. Omit a key when there is no sensible link (e.g. do not force “next” into an unrelated section).

| Field | Description |
|--------|-------------|
| **prev** | Path to the previous page, e.g. `content/core/getting-started.md`. |
| **next** | Path to the next page. |
| **prev_label** | Optional subtitle on the Previous button (defaults to the linked page’s **title** from the manifest). |
| **next_label** | Optional subtitle on the Next button. |

To explicitly disable a side in tooling or docs, you may use the value **`none`** (case-insensitive); it is treated as “no link.”

If **both** `prev` and `next` are absent (or effectively empty), the footer nav is **hidden**—no placeholder buttons.

### Parser limitations

- One **line per key** in the YAML block (no multi-line YAML values).
- Line endings may be **LF** or **CRLF** (Windows); both are split correctly when parsing keys.
- Keys match `^\w+` (letters, numbers, underscore).
- Empty values after `:` are skipped.
- Arrays are written on one line as `[...]` with JSON-style strings preferred.

---

## The manifest

`manifest.json` is **generated**; do not hand-edit it except in emergencies.

Each **document** entry typically includes:

- `path` — path relative to the Documentation root
- `title`, `category`, `order`
- `tags` — array
- `authors` — array (normalized from `authors` / `author` in front matter)

The client uses the manifest for the **sidebar** and for **default titles** on prev/next links. It does not need to list `prev`/`next`; those are read from each file when it loads.

### Category order

Sidebar **sections** are ordered by category. To control that order explicitly, add **`category-order.json`** at the same level as `manifest.json`: a JSON **array of strings** matching your front-matter **`category`** values, in the order you want (example: `["Core", "Guides", "Breakdown"]`).

- **`scripts/build-manifest.mjs`** reads this file when it exists and writes a top-level **`categoryOrder`** array into `manifest.json`.
- **`doc-app.js`** sorts categories using `categoryOrder`; any category **not** named in the list appears **after** all listed ones, sorted **A–Z**.
- If **`category-order.json`** is **absent** (or invalid), categories sort **A–Z** and `categoryOrder` is omitted from the manifest.

After changing `category-order.json`, run the manifest script again and deploy the new `manifest.json`.

---

## Authoring Markdown

- Use normal Markdown; GFM features (tables, task lists where supported) follow **marked** options (`gfm: true`).
- **Internal links** to other doc pages can use hash URLs, for example:

  ```markdown
  See [Writing documentation](#/content/guides/writing-docs.md).
  ```

- **Callouts** — highlighted asides with a colored rail and icon. Start a blockquote with a marker line, then continue the body with `>` on each line (the Markdown parser may merge those into one paragraph; that is fine):

  ```markdown
  > [!NOTE]
  > Highlights information readers should notice even when skimming.
  ```

  Supported markers (case-insensitive): `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`. The marker must be the first line of the blockquote (only the marker on that line). Lists and other block content can follow on further `>` lines. Any other blockquote, or an unknown marker such as `[!CUSTOM]`, stays a normal quote so the raw marker remains visible.

  For examples and edge cases, see the **Callouts** section in [`content/guides/writing-docs.md`](content/guides/writing-docs.md).

- After adding or renaming files, always **run the manifest script** and commit `manifest.json`.

---

## Routing and URLs

- **Hash format:** `#/content/path/to/file.md` (leading `#/` is normalized by the app).
- **Default page** when the hash is missing or unknown: first document in **reading order** — sort by **category** (using `categoryOrder` from the manifest when present, otherwise A–Z), then **order**, then **title**.

---

## UI behavior

### Sidebar

- Lists categories and pages from `manifest.json`. Category order follows **`categoryOrder`** in the manifest when the build included it; see [Category order](#category-order) under *The manifest*.
- On **wide** viewports the sidebar is a **scrollable** column with a max height so it does not stretch to match the full article height.
- **Desktop (≥881px):** **Hide sidebar** / **Show sidebar** toggles collapse; state is stored in `localStorage` under `r2sp-doc-sidebar-collapsed` (`1` = collapsed).
- **Mobile (≤880px):** **Menu** opens a **drawer**; **backdrop** tap or **Escape** closes it. Choosing a sidebar link closes the drawer.

### Article chrome

- **Breadcrumb:** category · title (from front matter).
- **Authors** (if any), then **tags** (if any).
- **Previous / Next** (if `prev` and/or `next` are set in front matter).
- **Body:** rendered Markdown.

### Accessibility

- Collapsed sidebar uses `aria-hidden` on the aside where appropriate; buttons expose `aria-expanded` / `aria-controls` where implemented.

---

## Announcement bar

The landing page (`index.html`) and the docs shell (`main/index.html`) share a thin **announcement strip** above the main content. It includes a short message and a **dismiss** control (×).

**Behavior**

- **`src/announcement-banner.js`** runs on both pages. When a visitor dismisses the bar, the choice is stored in **`localStorage`** under the key `docutron.announcement.dismissedVersion`, together with the current **version string** (not the message text).
- On later visits, if the stored version **matches** `data-announcement-version` on the banner element, the bar stays hidden. If **`localStorage` is unavailable** (or throws), the bar still works; dismissal simply is not remembered for that session or browser.

**Changing the message and showing the bar again**

1. Edit the copy inside `<section id="site-announcement">` on **`index.html`** and **`main/index.html`** as needed.
2. **Increment `data-announcement-version`** on **both** sections (for example from `"1"` to `"2"`). Anyone who had dismissed the previous version will see the new announcement; the new dismissal is stored under the new version.

Keep the two `data-announcement-version` values **in sync** so the home page and documentation agree on whether the bar is considered “already dismissed.”

---

## Local development

Serve the **Documentation** directory (or its parent, adjusting URLs):

```bash
cd Documentation
python -m http.server 8080
```

Then open:

`http://127.0.0.1:8080/main/index.html`

Regenerate the manifest after content changes:

```bash
node scripts/build-manifest.mjs
```

---

## Deployment

- Upload or deploy **this entire folder** (or the whole repo if it only contains this tool).
- Ensure `main/index.html`, `doc-app.js`, `manifest.json`, `content/**/*.md`, and `src/` (images, **`announcement-banner.js`**, styles, etc.) are all present at the paths expected by the HTML.
- **HTTPS** or **HTTP** consistently; CDN scripts (jsDelivr) use HTTPS.
- Re-run the manifest script in CI before deploy if Markdown changes.

**cPanel / static hosts:** place the contents under `public_html` or a subdomain folder; the URL to the viewer will be `https://yourdomain.com/main/index.html` (plus any subdirectory prefix).

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| Blank error about `manifest.json` | File missing or wrong `BASE` path | Run `build-manifest.mjs`; check server root and `data-doc-base` on the script tag. |
| New page missing from sidebar | Manifest stale | Regenerate and deploy `manifest.json`. |
| `fetch` failed / CORS | Opening `index.html` via `file://` | Serve over HTTP. |
| Prev/next wrong or missing | Front matter on **that** page | Edit `prev` / `next` (and optional labels) in the `.md` file. |
| Sidebar always collapsed on desktop | Stored preference | Clear `localStorage` key `r2sp-doc-sidebar-collapsed` or click **Show sidebar**. |
| Announcement bar will not stay dismissed | Private mode / blocked storage | Dismissal needs `localStorage`; if it is blocked, the bar returns on each load. |
| Old visitors do not see a new announcement | Version not bumped | Increase `data-announcement-version` on both `index.html` and `main/index.html` when you change the message. |
| Broken images in header | Missing `src/images/` | Add `R.png` (or your assets) under `src/images/` and keep paths in `main/index.html` in sync. |

---

## File reference

| File | Role |
|------|------|
| `index.html` | Optional landing page; links can point to `main/index.html`. |
| `main/index.html` | Documentation viewer shell: header, layout, article, scripts (marked, DOMPurify, `doc-app.js`). |
| `src/styles.css` | Layout, theme, sidebar, article, prev/next, responsive rules (loaded by `index.html` and `main/index.html`). |
| `doc-app.js` | Fetches manifest and Markdown; parses front matter; renders UI; hash routing; sidebar mobile + desktop behavior. |
| `scripts/build-manifest.mjs` | Walks `content/**/*.md`, parses front matter; merges optional `category-order.json`; writes `manifest.json`. |
| `category-order.json` | Optional ordered list of category names; drives `categoryOrder` in the manifest. |
| `manifest.json` | Index of docs for the sidebar and metadata snapshot. |
| `content/**/*.md` | Source documentation. |
| `src/announcement-banner.js` | Versioned dismiss for `#site-announcement`; loaded from `index.html` and `main/index.html`. |
| `src/images/` | Static images referenced by `index.html` and `main/index.html`. |

---

## License and credits

Markdown rendering relies on **marked** and **DOMPurify** (see `main/index.html` for versions and URLs). Optional branding and outbound links in the HTML are yours to customize for your project.

## Closing note

If you're still here after reading all of this and you're interested in my solo project, thank you for considering it. And thank you for supporting me if you do end up downloading this. `Made with 💖 by Retrograde`
