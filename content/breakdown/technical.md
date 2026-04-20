<!--
---
title: Technical Writeup
category: Breakdown
order: 999
tags: ["technical", "analysis"]
authors: ["Retr0gr4d3"]
last_edited: 2026-04-20
---
-->

This page is an **implementation-focused** breakdown of Docutron: how the static viewer is structured, what runs in the browser, and how content becomes navigation and HTML. For setup, authoring tables, callout syntax examples, and deployment checklists, use the project [README.md](https://github.com/retr0gr4d3/docutron/blob/main/README.md) (or the repo root `README.md` in a full checkout).

## System shape

Docutron is a **client-only** documentation shell: no build step is required to *run* the viewer beyond serving files over HTTP. The only generated artifact the app depends on at runtime is **`manifest.json`**, produced by a small Node script so the sidebar does not need to crawl the filesystem in the browser.

| Layer | Responsibility |
|--------|----------------|
| **`main/index.html`** | Shell markup: header, announcement strip, sidebar container, article panel, footer. Loads CDN **marked** and **DOMPurify**, then `doc-app.js` with a **base path** for fetches. |
| **`doc-app.js`** | Single IIFE: fetch manifest → hash routing → fetch Markdown → parse front matter → render Markdown → sanitize → post-process callouts → bind sidebar and responsive chrome. |
| **`scripts/build-manifest.mjs`** | Node ESM: recursive scan of `content/**/*.md`, same front-matter parser as the client (by design), writes `manifest.json` with a `generated` timestamp. |
| **`src/styles.css`** | Layout, typography, sidebar/drawer, article, callouts, prev/next grid. |
| **`src/announcement-banner.js`** | Version-keyed dismiss stored in `localStorage`. |

**CDN dependencies (docs viewer):** `marked@12.0.2` and `dompurify@3.1.6` from jsDelivr, as referenced in `main/index.html`. If either global is missing, `doc-app.js` aborts `init()` with a user-visible error.

## Bootstrap and base URL resolution

The script tag that loads `doc-app.js` carries **`data-doc-base`**, read as `document.currentScript.dataset.docBase` with a fallback of `"../"`. That string is prefixed to:

- `manifest.json`
- every Markdown path (e.g. `content/core/getting-started.md`)

So the viewer can live under different server roots as long as the relative base still reaches the repo’s “documentation root” (the folder that contains `manifest.json`, `content/`, and `doc-app.js`). Wrong `data-doc-base` is the primary cause of “missing manifest” errors when the app is nested in a subdirectory.

## Manifest contract

`build-manifest.mjs` writes JSON of the form:

```json
{
  "generated": "<ISO-8601 instant>",
  "docs": [ /* ... */ ]
}
```

Each **doc** entry includes:

| Field | Source / rules |
|--------|----------------|
| `path` | POSIX-style path relative to the documentation root, e.g. `content/guides/writing-docs.md`. |
| `title` | Front matter `title`, else the file’s basename without `.md`. |
| `category` | Front matter `category`, else `"General"`. |
| `order` | Numeric `order` from front matter, else **999** (build script default for sorting). |
| `tags` | Array from front matter; non-array `tags` is wrapped as a one-element array. |
| `authors` | Normalized from `authors` array, `author` array, or single `author` string—same normalization idea as the client’s `normalizeAuthors` for display. |

**Not** embedded in the manifest: `prev`, `next`, `prev_label`, `next_label`, `last_edited`. Those are read from the **currently loaded** `.md` file every time so navigation and “last edited” stay accurate without rebuilding the index.

## Front matter: shared parser semantics

Both `build-manifest.mjs` and `doc-app.js` implement the same rules:

1. The file may start with **one** HTML comment; inside it, a YAML-ish block between `---` lines.
2. **One key per line**: `^(\w+)\s*:\s*(.*)$`. Keys are word characters only.
3. Empty values after `:` are skipped.
4. Values in `[...]` are parsed as JSON after replacing single quotes with double quotes; on failure, split on commas and strip quotes—so lightweight arrays work without strict JSON.
5. Purely numeric strings become JavaScript numbers (affects `order` in the manifest).

**Runtime-only nuance:** when rendering a page, the client may still show `order` from **live** front matter for consistency with the body, but the **sidebar ordering** comes from `manifest.json` entries (rebuild the manifest if you change `order` and expect the nav to update).

## Routing and default document selection

- The hash is normalized with `location.hash.replace(/^#\/?/, "")`, so both `#/content/foo.md` and `#content/foo.md` (after stripping the leading `#`) are treated consistently; the app sets hashes as `#/` + path via `setHash`.
- On first load, if the hash is empty or does not match any `manifest.docs[].path`, the app picks the **first document in reading order**: sort by `category` (localeCompare), then `order` (default 999 when comparing), then `title`. It then **`history.replaceState`** to `#/<that path>` so the URL is canonical.
- **`hashchange`** reloads the document when the new hash matches a known manifest path; invalid hashes do not trigger a load (the last good page remains).

This is a deliberate **SPA-lite** model: no path-based router on the server, only static files and fragment identifiers—ideal for GitHub Pages–style hosting.

## Document load pipeline

For a resolved `relPath`:

1. **`fetch(BASE + relPath)`** — non-OK responses surface as `showError` with status text.
2. **`parseFrontMatter`** — splits `meta` and Markdown **body** (comment stripped).
3. **`marked.setOptions({ gfm: true })`** then **`marked.parse(body)`** — GitHub-flavored Markdown.
4. **`transformCalloutBlockquotes(html)`** — see below.
5. **`DOMPurify.sanitize(..., { ADD_TAGS: ['aside'] })`** — default sanitizer config plus `aside` for callout markup.
6. **`renderDoc`** — fills breadcrumb, optional last-edited line, title, author pills, tag pills, body `innerHTML`, sets `document.title` to `"{title} — Retrograde"`, hides error panel.
7. **`renderSidebar`** — rebuilds the nav for the active path (active link gets `is-active` and `aria-current="page"`).
8. **`renderAdjacentNav`** — prev/next footer from **current** meta.

## Callout post-processor

GFM blockquotes that start with GitHub-style markers (`[!NOTE]`, `[!TIP]`, etc.) are turned into **`<aside class="doc-callout doc-callout--{kind}">`** with a header (icon + label) and a body wrapper. Implementation details:

- Parsing uses **`DOMParser`** on a wrapper div, then walks **`blockquote`** elements.
- The first child must be a `<p>`. The marker can be alone on the first line or followed by text in the same paragraph; unknown kinds leave the quote unchanged so authors see the raw marker.
- Allowed kinds are a fixed set: `note`, `tip`, `important`, `warning`, `caution` (case-insensitive in the marker).
- Each callout gets **`role="note"`** for accessibility.

Because `aside` is not in DOMPurify’s default allow-list, **`ADD_TAGS: ['aside']`** is required or callouts would be stripped after transformation.

## Previous / next footer

`prev` and `next` front-matter values are passed through **`normalizeNavPath`**: trim, map `none` / `null` / `false` (case-insensitive) to “no link”, strip a leading `./`, normalize backslashes to `/`. Labels default to the manifest title for that path, or a crude title from the filename if the path is not in the manifest.

If **both** sides resolve empty, the adjacent nav container is **`hidden`** and empty—no ghost buttons.

## Responsive sidebar and persistence

| Viewport | Behavior |
|-----------|-----------|
| **`max-width: 880px`** | “Menu” toggles a **drawer** (`is-open` on `#doc-sidebar`), backdrop click and **Escape** close it; resize above breakpoint forces close. |
| **`min-width: 881px`** | Separate **“Hide sidebar” / “Show sidebar”** control toggles `doc-layout--sidebar-collapsed` on `#doc-layout`. |

**`localStorage` key:** `r2sp-doc-sidebar-collapsed` stores `"1"` when collapsed on desktop. When the viewport is mobile, desktop collapse class is cleared and `aria-hidden` on the sidebar is managed so assistive tech matches visibility.

## Announcement banner

`#site-announcement` carries **`data-announcement-id`** (scopes dismissal per page) and **`data-announcement-version`** (bump when that page’s message changes). On load, `announcement-banner.js` compares the version to `localStorage['docutron.announcement.dismissedVersion.' + id]`; a match **hides** the banner. The dismiss button sets that key to the current version. Storage failures are swallowed so the UI still works in locked-down profiles.

Different entry points should use **different `data-announcement-id` values** so the same version string on two pages does not tie dismissal together.

## DOM contract (viewer shell)

`doc-app.js` expects these IDs (or a small fallback for the breadcrumb):

- `doc-sidebar-nav`, `doc-sidebar`, `doc-sidebar-toggle`, `doc-sidebar-backdrop`, `doc-layout`, `doc-sidebar-desktop-toggle`
- `doc-breadcrumb`, `doc-last-edited`, `doc-title`, `doc-authors`, `doc-tags`, `doc-error`, `doc-body`, `doc-adjacent-nav`

Renaming these in HTML without updating the script will break rendering or accessibility hooks.

## Security and trust model

- All rendered HTML passes through **DOMPurify** after Markdown conversion.
- The only intentional extra tag is **`aside`** for callouts; authors should not rely on arbitrary HTML in Markdown for privileged behavior—treat the pipeline as **untrusted input → sanitized output**.
- Scripts in Markdown are not a supported feature; CDN scripts are static includes from the shell only.

## Operational constraints

- **HTTP(S) required:** `fetch` of `manifest.json` and `.md` files fails from `file://` in normal browser security models.
- **Manifest drift:** new, moved, or removed files under `content/` are invisible to the sidebar until `node scripts/build-manifest.mjs` is run and the new `manifest.json` is deployed.
- **Ordering:** sidebar category order comes from **`category-order.json`** (copied into `manifest.json` as `categoryOrder`). Categories not listed there sort **after** listed ones, alphabetically. Within a category, sort is by `order` then `title`. Omit `category-order.json` to fall back to **alphabetical** category order.

## File map (technical roles)

| Path | Role |
|------|------|
| `doc-app.js` | Entire viewer controller: parsing, Markdown, sanitization, callouts, routing, UI binding. |
| `scripts/build-manifest.mjs` | Content index builder; keeps parser aligned with the client. |
| `manifest.json` | Runtime sidebar index + stable paths for title lookup on prev/next. |
| `main/index.html` | Loads globals (`marked`, `DOMPurify`), instantiates the doc shell. |
| `src/styles.css` | Presentation for shell, article, callouts, breakpoints. |
| `src/announcement-banner.js` | Versioned dismiss for `#site-announcement`. |

---

**Credits:** Rendering uses [marked](https://marked.js.org/) and [DOMPurify](https://github.com/cure53/DOMPurify); versions are pinned in `main/index.html`.
