/**
 * Documentation viewer: loads manifest.json, sidebar by category, fetches .md and renders with marked + DOMPurify.
 * Expects page at Documentation/main/index.html with data-doc-base="../"
 */
(function () {
	const script = document.currentScript;
	const BASE = (script && script.dataset.docBase) || "../";

	let closeSidebarMobile = function () {};

	function parseFrontMatter(raw) {
		const m = raw.match(/^<!--\s*([\s\S]*?)\s*-->\s*/);
		if (!m) return { meta: {}, body: raw };
		const block = m[1].trim();
		if (!block.startsWith("---")) return { meta: {}, body: raw };
		const end = block.indexOf("---", 3);
		if (end === -1) return { meta: {}, body: raw };
		const yaml = block.slice(3, end).trim();
		const meta = {};
		for (const line of yaml.split(/\r?\n/)) {
			const kv = line.match(/^(\w+)\s*:\s*(.*)$/);
			if (!kv) continue;
			const key = kv[1];
			let val = kv[2].trim();
			if (val === "") continue;
			if (val.startsWith("[") && val.endsWith("]")) {
				try {
					meta[key] = JSON.parse(val.replace(/'/g, '"'));
				} catch {
					meta[key] = val
						.slice(1, -1)
						.split(",")
						.map(function (s) {
							return s.trim().replace(/^["']|["']$/g, "");
						})
						.filter(Boolean);
				}
			} else if (/^-?\d+(\.\d+)?$/.test(val)) {
				meta[key] = Number(val);
			} else {
				meta[key] = val.replace(/^["']|["']$/g, "");
			}
		}
		return { meta, body: raw.slice(m[0].length) };
	}

	function readingOrderSorted(docs) {
		return docs.slice().sort(function (a, b) {
			const c = (a.category || "").localeCompare(b.category || "");
			if (c !== 0) return c;
			const o = (a.order || 999) - (b.order || 999);
			if (o !== 0) return o;
			return a.title.localeCompare(b.title);
		});
	}

	function groupByCategory(docs) {
		const map = new Map();
		for (const d of docs) {
			const cat = d.category || "General";
			if (!map.has(cat)) map.set(cat, []);
			map.get(cat).push(d);
		}
		for (const arr of map.values()) {
			arr.sort(function (a, b) {
				return (a.order || 999) - (b.order || 999) || a.title.localeCompare(b.title);
			});
		}
		return Array.from(map.entries()).sort(function (a, b) {
			return a[0].localeCompare(b[0]);
		});
	}

	function hashPath() {
		const h = window.location.hash.replace(/^#\/?/, "");
		return h || null;
	}

	function setHash(relPath) {
		window.location.hash = "/" + relPath;
	}

	function renderSidebar(groups, activePath) {
		const nav = document.getElementById("doc-sidebar-nav");
		if (!nav) return;
		nav.innerHTML = "";
		for (const [category, items] of groups) {
			const section = document.createElement("section");
			section.className = "doc-sidebar-section";
			const h = document.createElement("h2");
			h.className = "doc-sidebar-heading";
			h.textContent = category;
			section.appendChild(h);
			const ul = document.createElement("ul");
			ul.className = "doc-sidebar-list";
			for (const item of items) {
				const li = document.createElement("li");
				const a = document.createElement("a");
				a.href = "#/" + item.path;
				a.textContent = item.title;
				if (item.path === activePath) {
					a.classList.add("is-active");
					a.setAttribute("aria-current", "page");
				}
				a.addEventListener("click", function (e) {
					e.preventDefault();
					setHash(item.path);
					closeSidebarMobile();
				});
				li.appendChild(a);
				ul.appendChild(li);
			}
			section.appendChild(ul);
			nav.appendChild(section);
		}
	}

	function normalizeNavPath(v) {
		if (v == null) return "";
		const s = String(v).trim();
		if (s === "") return "";
		const lower = s.toLowerCase();
		if (lower === "none" || lower === "null" || lower === "false") return "";
		return s.replace(/^\.\//, "").replace(/\\/g, "/");
	}

	function titleForNavPath(navPath) {
		if (!navPath) return "";
		const d = manifestDocs.find(function (x) {
			return x.path === navPath;
		});
		if (d) return d.title;
		const base = navPath.replace(/^.*\//, "");
		return base.replace(/\.md$/i, "").replace(/-/g, " ");
	}

	function renderAdjacentNav(relPath, meta) {
		const container = document.getElementById("doc-adjacent-nav");
		if (!container) return;
		container.innerHTML = "";
		const prevPath = normalizeNavPath(meta.prev);
		const nextPath = normalizeNavPath(meta.next);
		const prevLabel =
			(typeof meta.prev_label === "string" && meta.prev_label.trim()) ||
			titleForNavPath(prevPath);
		const nextLabel =
			(typeof meta.next_label === "string" && meta.next_label.trim()) ||
			titleForNavPath(nextPath);

		if (!prevPath && !nextPath) {
			container.hidden = true;
			return;
		}

		container.hidden = false;

		const grid = document.createElement("div");
		if (prevPath && nextPath) {
			grid.className = "doc-nav-adjacent-grid doc-nav-adjacent-grid--both";
		} else if (prevPath) {
			grid.className = "doc-nav-adjacent-grid doc-nav-adjacent-grid--prev-only";
		} else {
			grid.className = "doc-nav-adjacent-grid doc-nav-adjacent-grid--next-only";
		}

		function link(isPrev, path, label) {
			const a = document.createElement("a");
			a.className = "doc-nav-adjacent-link";
			a.href = "#/" + path;
			const dir = document.createElement("span");
			dir.className = "doc-nav-adjacent-dir";
			dir.textContent = isPrev ? "← Previous" : "Next →";
			const title = document.createElement("span");
			title.className = "doc-nav-adjacent-title";
			title.textContent = label || titleForNavPath(path);
			a.appendChild(dir);
			a.appendChild(title);
			return a;
		}

		if (prevPath) grid.appendChild(link(true, prevPath, prevLabel));
		if (nextPath) grid.appendChild(link(false, nextPath, nextLabel));
		container.appendChild(grid);
	}

	function formatLastEdited(raw) {
		if (raw == null) return "";
		const s = String(raw).trim();
		if (!s) return "";
		const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[Tt ].*)?$/);
		if (iso) {
			const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
			if (!isNaN(d.getTime())) {
				return d.toLocaleDateString(undefined, {
					year: "numeric",
					month: "short",
					day: "numeric",
				});
			}
		}
		return s;
	}

	function pathCrumbElement() {
		return (
			document.getElementById("doc-breadcrumb") ||
			document.getElementById("doc-path-dir") ||
			document.querySelector(".doc-crumb-row > .doc-crumb")
		);
	}

	function normalizeAuthors(meta) {
		if (Array.isArray(meta.authors)) {
			return meta.authors.map(String).filter(Boolean);
		}
		if (Array.isArray(meta.author)) {
			return meta.author.map(String).filter(Boolean);
		}
		if (typeof meta.author === "string" && meta.author.trim()) {
			return [meta.author.trim()];
		}
		return [];
	}

	function renderDoc(meta, bodyHtml) {
		const crumbEl = pathCrumbElement();
		const lastEditedEl = document.getElementById("doc-last-edited");
		const titleEl = document.getElementById("doc-title");
		const tagsEl = document.getElementById("doc-tags");
		const authorsEl = document.getElementById("doc-authors");
		const bodyEl = document.getElementById("doc-body");
		if (crumbEl) {
			crumbEl.textContent =
				(meta.category || "Docs") + " · " + (meta.title || "Untitled");
			crumbEl.setAttribute("aria-label", "Breadcrumb");
		}
		if (lastEditedEl) {
			const le = meta.last_edited;
			const formatted =
				typeof le === "string" || typeof le === "number"
					? formatLastEdited(le)
					: "";
			if (formatted) {
				lastEditedEl.hidden = false;
				lastEditedEl.textContent = "Last edited " + formatted;
			} else {
				lastEditedEl.hidden = true;
				lastEditedEl.textContent = "";
			}
		}
		if (titleEl) titleEl.textContent = meta.title || "Untitled";
		if (authorsEl) {
			authorsEl.innerHTML = "";
			const authors = normalizeAuthors(meta);
			if (authors.length === 0) {
				authorsEl.style.display = "none";
			} else {
				authorsEl.style.display = "";
				const label = document.createElement("span");
				label.className = "doc-authors-label";
				label.textContent = authors.length === 1 ? "Author:" : "Authors:";
				authorsEl.appendChild(label);
				for (const a of authors) {
					const pill = document.createElement("span");
					pill.className = "doc-author";
					pill.textContent = a;
					authorsEl.appendChild(pill);
				}
			}
		}
		if (tagsEl) {
			tagsEl.innerHTML = "";
			const tags = Array.isArray(meta.tags) ? meta.tags : [];
			if (tags.length === 0) {
				tagsEl.style.display = "none";
			} else {
				tagsEl.style.display = "";
				const label = document.createElement("span");
				label.className = "doc-tags-label";
				label.textContent = "Tags:";
				tagsEl.appendChild(label);
				for (const t of tags) {
					const pill = document.createElement("span");
					pill.className = "doc-tag";
					pill.textContent = t;
					tagsEl.appendChild(pill);
				}
			}
		}
		if (bodyEl) bodyEl.innerHTML = bodyHtml;
		document.title = (meta.title || "Documentation") + " — Retrograde";
		const err = document.getElementById("doc-error");
		if (err) err.hidden = true;
	}

	function showError(msg) {
		const err = document.getElementById("doc-error");
		const bodyEl = document.getElementById("doc-body");
		const tagsEl = document.getElementById("doc-tags");
		const authorsEl = document.getElementById("doc-authors");
		const adj = document.getElementById("doc-adjacent-nav");
		if (err) {
			err.hidden = false;
			err.textContent = msg;
		}
		if (bodyEl) bodyEl.innerHTML = "";
		if (tagsEl) {
			tagsEl.innerHTML = "";
			tagsEl.style.display = "none";
		}
		if (authorsEl) {
			authorsEl.innerHTML = "";
			authorsEl.style.display = "none";
		}
		const crumbEl = pathCrumbElement();
		const lastEditedEl = document.getElementById("doc-last-edited");
		if (crumbEl) crumbEl.textContent = "";
		if (lastEditedEl) {
			lastEditedEl.hidden = true;
			lastEditedEl.textContent = "";
		}
		if (adj) {
			adj.innerHTML = "";
			adj.hidden = true;
		}
	}

	let manifestDocs = [];

	function loadDocument(relPath) {
		const url = BASE + relPath;
		return fetch(url)
			.then(function (r) {
				if (!r.ok) throw new Error("Could not load " + relPath + " (" + r.status + ")");
				return r.text();
			})
			.then(function (raw) {
				const { meta, body } = parseFrontMatter(raw);
				if (typeof marked !== "undefined" && typeof marked.setOptions === "function") {
					marked.setOptions({ gfm: true });
				}
				const html = DOMPurify.sanitize(marked.parse(body));
				renderDoc(meta, html);
				renderSidebar(groupByCategory(manifestDocs), relPath);
				renderAdjacentNav(relPath, meta);
			})
			.catch(function (e) {
				console.error(e);
				showError(e.message || String(e));
			});
	}

	function pickDefaultDoc(docs) {
		const sorted = readingOrderSorted(docs);
		return sorted.length ? sorted[0].path : null;
	}

	function initSidebarToggle() {
		const toggle = document.getElementById("doc-sidebar-toggle");
		const sidebar = document.getElementById("doc-sidebar");
		const backdrop = document.getElementById("doc-sidebar-backdrop");
		if (!toggle || !sidebar) return;

		const mq = window.matchMedia("(max-width: 880px)");

		function close() {
			sidebar.classList.remove("is-open");
			if (backdrop) backdrop.hidden = true;
			document.body.classList.remove("doc-sidebar-open");
			toggle.setAttribute("aria-expanded", "false");
			toggle.setAttribute("aria-label", "Open documentation menu");
		}

		function open() {
			sidebar.classList.add("is-open");
			if (backdrop) backdrop.hidden = false;
			document.body.classList.add("doc-sidebar-open");
			toggle.setAttribute("aria-expanded", "true");
			toggle.setAttribute("aria-label", "Close documentation menu");
		}

		closeSidebarMobile = function () {
			if (mq.matches) close();
		};

		toggle.addEventListener("click", function () {
			if (!mq.matches) return;
			if (sidebar.classList.contains("is-open")) close();
			else open();
		});

		if (backdrop) {
			backdrop.addEventListener("click", close);
		}

		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape" && mq.matches) close();
		});

		window.addEventListener("resize", function () {
			if (!mq.matches) close();
		});
	}

	const DESKTOP_SIDEBAR_STORAGE_KEY = "r2sp-doc-sidebar-collapsed";

	function initDesktopSidebarCollapse() {
		const layout = document.getElementById("doc-layout");
		const sidebar = document.getElementById("doc-sidebar");
		const btn = document.getElementById("doc-sidebar-desktop-toggle");
		if (!layout || !sidebar || !btn) return;

		const mqDesktop = window.matchMedia("(min-width: 881px)");

		function updateDesktopToggleButton() {
			const collapsed = layout.classList.contains("doc-layout--sidebar-collapsed");
			btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
			const text = btn.querySelector(".doc-sidebar-desktop-toggle-text");
			if (text) {
				text.textContent = collapsed ? "Show sidebar" : "Hide sidebar";
			}
			btn.setAttribute(
				"aria-label",
				collapsed ? "Show documentation sidebar" : "Hide documentation sidebar"
			);
		}

		function applyDesktopSidebarState() {
			if (!mqDesktop.matches) {
				layout.classList.remove("doc-layout--sidebar-collapsed");
				sidebar.removeAttribute("aria-hidden");
				updateDesktopToggleButton();
				return;
			}
			const collapsed = localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY) === "1";
			if (collapsed) {
				layout.classList.add("doc-layout--sidebar-collapsed");
				sidebar.setAttribute("aria-hidden", "true");
			} else {
				layout.classList.remove("doc-layout--sidebar-collapsed");
				sidebar.setAttribute("aria-hidden", "false");
			}
			updateDesktopToggleButton();
		}

		btn.addEventListener("click", function () {
			if (!mqDesktop.matches) return;
			layout.classList.toggle("doc-layout--sidebar-collapsed");
			const collapsed = layout.classList.contains("doc-layout--sidebar-collapsed");
			localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
			sidebar.setAttribute("aria-hidden", collapsed ? "true" : "false");
			updateDesktopToggleButton();
		});

		applyDesktopSidebarState();
		if (typeof mqDesktop.addEventListener === "function") {
			mqDesktop.addEventListener("change", applyDesktopSidebarState);
		} else {
			mqDesktop.addListener(applyDesktopSidebarState);
		}
	}

	function init() {
		if (typeof marked === "undefined" || typeof DOMPurify === "undefined") {
			showError("Markdown libraries failed to load (marked or DOMPurify). Check the network or CDN.");
			return;
		}
		initSidebarToggle();
		initDesktopSidebarCollapse();
		fetch(BASE + "manifest.json")
			.then(function (r) {
				if (!r.ok) throw new Error("Missing manifest.json — run: node scripts/build-manifest.mjs");
				return r.json();
			})
			.then(function (manifest) {
				manifestDocs = manifest.docs || [];
				if (!manifestDocs.length) {
					showError("No documents in manifest. Add .md files under content/ and rebuild the manifest.");
					renderSidebar([], null);
					return;
				}
				const groups = groupByCategory(manifestDocs);
				let path = hashPath();
				if (!path || !manifestDocs.some(function (d) { return d.path === path; })) {
					path = pickDefaultDoc(manifestDocs);
					history.replaceState(null, "", "#/" + path);
				}
				renderSidebar(groups, path);
				return loadDocument(path);
			})
			.catch(function (e) {
				console.error(e);
				showError(e.message || String(e));
			});

		window.addEventListener("hashchange", function () {
			const path = hashPath();
			if (path && manifestDocs.some(function (d) { return d.path === path; })) {
				loadDocument(path);
			}
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
