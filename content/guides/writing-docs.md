<!--
---
title: Writing documentation
category: Guides
order: 10
tags: ["authoring", "markdown"]
authors: ["Retr0gr4d3"]
last_edited: 2026-04-20
prev: content/core/architecture.md
---
-->

# Writing documentation

## Front-matter

Place a **HTML comment** at the very top of each `.md` file. Inside it, use a YAML document between `---` lines:

```markdown
<!--
---
title: Page title
category: Guides
order: 10
tags: ["one", "two"]
authors: ["Ada Lovelace", "Grace Hopper"]
last_edited: 2026-04-17
prev: content/core/architecture.md
---
-->

# Page title

Body starts here.
```

- **title** — shown in the sidebar and as the main heading.
- **category** — groups sidebar sections (e.g. Core, Guides).
- **order** — numeric sort order within the category (lower first).
- **tags** — JSON array of strings, shown as pills under the title.
- **authors** — JSON array of names (or a single **`author: Name`** string for one person). Shown under the title with an “Author:” or “Authors:” label. Included in `manifest.json` when you rebuild.
- **last_edited** — optional. Shown at the top right of the article next to the breadcrumb (`Category · Title`). Use an ISO date (`YYYY-MM-DD`) for a localized “Last edited …” line, or any short string (shown as-is).

### Adjacent page buttons (`prev` / `next`)

Optional keys, paths relative to the `Documentation` folder (same as in `manifest.json`):

- **`prev`** — path to the previous page (omit if there is no previous link to show).
- **`next`** — path to the next page (omit if there is no next link to show).
- **`prev_label`** / **`next_label`** — optional; override the link subtitle (defaults to the other page’s `title` from the manifest).

Use **`none`** as the value if you want to be explicit that a side is unused (same as omitting the key).

Example (two-way chain):

```yaml
prev: content/core/getting-started.md
next: content/core/architecture.md
prev_label: Back to Getting Started
```

This page only sets **`prev`** (to Architecture), so there is no **`next`** in the footer.

## Callouts

Callouts are blockquotes that start with a **marker** on the first line. The viewer turns them into a titled aside (Note, Tip, Important, Warning, or Caution) with a colored left rail and icon. Regular blockquotes are unchanged.

### Syntax

- Use `>` on the first line with **only** a marker (case-insensitive), then add the body on further lines, each starting with `>`:

```markdown
> [!NOTE]
> First line of body.
> Second line of body.
```

- For a **list** inside the callout, keep using `>` on each line:

```markdown
> [!TIP]
> - First item
> - Second item
```

### Supported markers

| Marker | Label |
|--------|--------|
| `[!NOTE]` | Note |
| `[!TIP]` | Tip |
| `[!IMPORTANT]` | Important |
| `[!WARNING]` | Warning |
| `[!CAUTION]` | Caution |

### Other blockquotes

- If the first line is not exactly a supported marker (for example `[!CUSTOM]`), the block stays a **normal blockquote** and readers see the marker text as written.
- Any blockquote that does not use this pattern behaves like a standard quoted paragraph.

## Rebuild the manifest

From the repository root (where `doc-app.js` is):

```bash
node scripts/build-manifest.mjs
```

Commit the updated `manifest.json` so static hosting picks up new pages.
