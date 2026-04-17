/**
 * Scans content/ for .md files, reads HTML-comment YAML front-matter, writes ../manifest.json.
 * Run from repo: node r2sp/Documentation/scripts/build-manifest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(DOC_ROOT, "content");

function walkMd(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const name of fs.readdirSync(dir)) {
		const full = path.join(dir, name);
		const st = fs.statSync(full);
		if (st.isDirectory()) walkMd(full, out);
		else if (name.endsWith(".md")) out.push(full);
	}
	return out;
}

function parseFrontMatter(raw) {
	const m = raw.match(/^<!--\s*([\s\S]*?)\s*-->\s*/);
	if (!m) return { meta: {}, body: raw };
	const block = m[1].trim();
	if (!block.startsWith("---")) return { meta: {}, body: raw };
	const end = block.indexOf("---", 3);
	if (end === -1) return { meta: {}, body: raw };
	const yaml = block.slice(3, end).trim();
	const meta = {};
	for (const line of yaml.split("\n")) {
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
					.map((s) => s.trim().replace(/^["']|["']$/g, ""))
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

function relDocPath(abs) {
	return path.relative(DOC_ROOT, abs).replace(/\\/g, "/");
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

function main() {
	const files = walkMd(CONTENT).sort();
	const docs = [];
	for (const file of files) {
		const raw = fs.readFileSync(file, "utf8");
		const { meta } = parseFrontMatter(raw);
		const rel = relDocPath(file);
		docs.push({
			path: rel,
			title: meta.title || path.basename(file, ".md"),
			category: meta.category || "General",
			order: typeof meta.order === "number" ? meta.order : 999,
			tags: Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [],
			authors: normalizeAuthors(meta),
		});
	}
	const manifest = { generated: new Date().toISOString(), docs };
	fs.writeFileSync(path.join(DOC_ROOT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
	console.log(`Wrote manifest.json with ${docs.length} document(s).`);
}

main();
