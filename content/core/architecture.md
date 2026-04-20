<!--
---
title: Architecture
category: Core
order: 20
tags: ["overview", "structure"]
authors: ["Retr0gr4d3"]
last_edited: 2026-04-20
prev: content/core/getting-started.md
---
-->

# Architecture

This experimental documentation system has three goals:

1. **Static-friendly** — works on any host that serves files; no server-side rendering required.
2. **Discoverable** — a small Node script walks `content/` and emits `manifest.json` for the browser.
3. **Consistent** — front-matter in each file drives titles, categories, ordering, and tags.

The main article area renders Markdown to HTML in the browser using [marked](https://marked.js.org/), runs a small HTML pass to turn **callout** blockquotes (lines like `[!NOTE]` at the start of a quote) into `<aside>` elements with stable class names, then sanitizes output with [DOMPurify](https://github.com/cure53/DOMPurify). Styling for callouts lives in the shared stylesheet. Author-facing details are in [Writing documentation](#/content/guides/writing-docs.md) under **Callouts**.

This page sets **`prev`** only (back to Getting Started). There is **no `next`** here so the UI does not suggest a follow-on page into another category (for example Experiments) where the narrative does not continue.

The sidebar scrolls inside a fixed max height; on small screens it lives in a slide-out drawer opened with **Menu**.

When you are ready, move on to [Writing documentation](#/content/guides/writing-docs.md).