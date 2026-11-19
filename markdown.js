// =====================================================
// markdown.js (v2, adds foldable <details> blocks): shared, SAFE Markdown rendering for the Grist widgets (admin.js, compute.js...).
// Exposes window.HubMarkdown = { load(), fill(node, text, md), plain(text) }.
//
// Needs markdown-it.min.js (markdown-it 14.1.0, MIT) in the SAME folder as this file.
// The text comes from the Grist document, so rendering must never be able to run code:
//  1. markdown-it with html:false (raw HTML is escaped, javascript: links refused);
//  2. the result is parsed in an inert document and REBUILT with DOM calls from an allow-list
//     of tags (no innerHTML on the page, no images, no attributes except a validated href);
//  3. if the library is missing, the plain text is shown (line breaks kept by the widget CSS).
// =====================================================
(function () {
    "use strict";

    const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
    const MARKDOWN_FILE = "markdown-it.min.js";

    // Styles for any element carrying the class "md" (inserted once)
    const style = document.createElement("style");
    style.textContent = `
.md { white-space: normal; }
.md > :first-child { margin-top: 0; }
.md > :last-child { margin-bottom: 0; }
.md p { margin: 8px 0; }
.md h1, .md h2, .md h3, .md h4, .md h5, .md h6 { font-size: 15px; margin: 14px 0 6px; }
.md ul, .md ol { margin: 8px 0; padding-left: 22px; }
.md blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #ddd; color: #666; }
.md code { background: rgba(0,0,0,.06); padding: 1px 4px; border-radius: 4px; font-size: 90%; }
.md pre { background: rgba(0,0,0,.06); padding: 10px; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
.md pre code { background: none; padding: 0; }
.md table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.md th, .md td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
.md a { color: #1f5fcf; text-decoration: underline; }
.md-details { margin: 8px 0; border: 1px solid rgba(0,0,0,.12); border-radius: 6px; background: rgba(255,255,255,.55); }
.md-details > summary { cursor: pointer; padding: 6px 10px; font-weight: 600; }
.md-details > summary:hover { background: rgba(0,0,0,.04); }
.md-details[open] > summary { border-bottom: 1px solid rgba(0,0,0,.12); }
.md-details-body { padding: 2px 12px 6px; }`;
    document.head.appendChild(style);

    let promise = null;
    // Resolves to a markdown-it instance, or to null if the library cannot be loaded
    function load() {
        if (promise) return promise;
        promise = new Promise(function (resolve) {
            function ready() {
                // breaks:true keeps plain-text descriptions readable (a newline stays a line break)
                resolve(window.markdownit
                    ? window.markdownit({ html: false, breaks: true, linkify: true })
                    : null);
            }
            if (window.markdownit) return ready();
            const script = document.createElement("script");
            script.src = new URL(MARKDOWN_FILE, SCRIPT_URL).href;
            script.onload = ready;
            script.onerror = function () {
                console.warn(MARKDOWN_FILE + " not found next to markdown.js: descriptions shown as plain text.");
                resolve(null);
            };
            document.head.appendChild(script);
        });
        return promise;
    }

    const TAGS = new Set([
        "P", "BR", "STRONG", "EM", "B", "I", "DEL", "S", "CODE", "PRE", "BLOCKQUOTE", "HR",
        "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "A",
        "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"
    ]);
    const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "IMG", "SVG", "MATH", "FORM",
        "INPUT", "TEXTAREA", "SELECT", "BUTTON", "LINK", "META", "BASE"]);

    function safeHref(href) {
        return /^(https?:|mailto:)/i.test(String(href || "").trim()) ? String(href).trim() : null;
    }

    // Rebuilds a clean copy: allowed tags only, no attribute except a checked href on links.
    // Disallowed tags are unwrapped (text kept), dangerous ones dropped with their content.
    function cleanNode(source, target) {
        for (const child of Array.from(source.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                target.appendChild(document.createTextNode(child.textContent));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toUpperCase();
                if (DROP.has(tag)) continue;
                if (!TAGS.has(tag)) { cleanNode(child, target); continue; }
                const copy = document.createElement(tag.toLowerCase());
                if (tag === "A") {
                    const href = safeHref(child.getAttribute("href"));
                    if (!href) { cleanNode(child, target); continue; }
                    copy.setAttribute("href", href);
                    copy.setAttribute("target", "_blank");
                    copy.setAttribute("rel", "noopener noreferrer");
                }
                cleanNode(child, copy);
                target.appendChild(copy);
            }
        }
    }

    // ---- Foldable blocks: lines "<details><summary>Title</summary>" ... "</details>" (nesting, <details open>,
    // Markdown inside). Only these LINES are recognised and the block is rebuilt with createElement: raw
    // HTML typed in a text is never interpreted. A <details> without </details>, or inside a ``` fence,
    // stays plain text.
    const DETAILS_OPEN = /^\s*<details(\s+open)?\s*>\s*(?:<summary>(.*?)<\/summary>\s*)?$/i;
    const DETAILS_CLOSE = /^\s*<\/details>\s*$/i;
    const SUMMARY_LINE = /^\s*<summary>(.*?)<\/summary>\s*$/i;
    const CODE_FENCE = /^\s{0,3}(`{3,}|~{3,})/;
    const DETAILS_MAX_DEPTH = 5;

    function appendMarkdown(target, text, md) {
        const parsed = new DOMParser().parseFromString(md.render(text), "text/html");
        cleanNode(parsed.body, target);
    }
    function dedent(lines) {
        let min = Infinity;
        for (const line of lines) {
            if (line.trim() === "") continue;
            min = Math.min(min, /^[ \t]*/.exec(line)[0].length);
        }
        if (!Number.isFinite(min) || min === 0) return lines;
        return lines.map(line => line.slice(Math.min(min, /^[ \t]*/.exec(line)[0].length)));
    }
    function findDetailsEnd(lines, start) {
        let depth = 1;
        let fence = null;
        for (let j = start + 1; j < lines.length; j++) {
            const f = CODE_FENCE.exec(lines[j]);
            if (fence) {
                if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
                continue;
            }
            if (f) { fence = f[1]; continue; }
            if (DETAILS_OPEN.test(lines[j])) depth++;
            else if (DETAILS_CLOSE.test(lines[j]) && --depth === 0) return j;
        }
        return -1;
    }
    function appendRichText(target, text, md, depth) {
        const lines = String(text).split(/\r?\n/);
        let plainLines = [];
        let fence = null;
        const flush = function () {
            if (plainLines.length > 0) appendMarkdown(target, plainLines.join("\n"), md);
            plainLines = [];
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const f = CODE_FENCE.exec(line);
            if (fence) {
                if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
                plainLines.push(line);
                continue;
            }
            if (f) { fence = f[1]; plainLines.push(line); continue; }
            const open = depth < DETAILS_MAX_DEPTH ? DETAILS_OPEN.exec(line) : null;
            const end = open ? findDetailsEnd(lines, i) : -1;
            if (!open || end === -1) { plainLines.push(line); continue; }

            flush();
            let body = lines.slice(i + 1, end);
            let title = open[2];
            if (title === undefined) {
                const first = body.findIndex(l => l.trim() !== "");
                const m = first === -1 ? null : SUMMARY_LINE.exec(body[first]);
                if (m) { title = m[1]; body = body.slice(first + 1); }
            }
            const details = document.createElement("details");
            details.className = "md-details";
            if (open[1]) details.open = true;
            const summary = document.createElement("summary");
            if (title && title.trim()) {
                cleanNode(new DOMParser().parseFromString(md.renderInline(title.trim()), "text/html").body, summary);
            } else {
                summary.textContent = "Détails";
            }
            details.appendChild(summary);
            const content = document.createElement("div");
            content.className = "md-details-body";
            appendRichText(content, dedent(body).join("\n"), md, depth + 1);
            details.appendChild(content);
            target.appendChild(details);
            i = end;
        }
        flush();
    }

    // Puts the text into `node`: rendered Markdown (with foldable blocks), or plain text as a fallback
    function fill(node, text, md) {
        node.classList.remove("md");
        if (!md) { node.textContent = text; return; }
        try {
            const clean = document.createDocumentFragment();
            appendRichText(clean, text, md, 0);
            node.classList.add("md");
            node.replaceChildren(clean);
        } catch (err) {
            console.error("Markdown rendering failed:", err);
            node.textContent = text;
        }
    }

    // Short plain-text version for the small cards (no links to click inside a clickable card):
    // [label](url) -> label, then the most common markup symbols are removed.
    function plain(text) {
        return String(text || "")
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
            .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
            .replace(/(\*\*|__|~~|`)/g, "")
            .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|$|[.,;:!?])/g, "$1$2");
    }

    window.HubMarkdown = { load: load, fill: fill, plain: plain };
})();
