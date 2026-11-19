// =====================================================
// Storage and compute widget, data model "Storage_Compute + Implementations".
// The widget is bound to Storage_Compute (one card per platform). A platform can host several
// resources; for each of them the table Implementations keeps the practical implementation and
// operation details (one row per platform x resource pair). Implementations and Resources are
// read directly (docApi.fetchTable), not through mapped slots, like admin.js / dashboard.js do.
// Left pane: the platform cards, each listing the resources it hosts (a click on a resource opens
// its details). Right pane: the platform description, then one foldable block per hosted resource.
// Default theme: green (see themes.js, ?theme=...). Card colour = one green per Country.
// Slot names are free: map them to the real columns of Storage_Compute in the creator panel.
// =====================================================
const SLOTS = { name: "Name", description: "Description", country: "Country", extra: "Extraterritoriality",
                accessHowTo: "AccessHowTo", accessFiles: "AccessHowToAttachment" };

// The Implementations table (real table id and column ids, case does not matter)
const IMPL = {
    table: "Implementations",
    platform: "Platform",            // Reference to Storage_Compute
    resource: "Resource",            // Reference to Resources
    status: "Status",                // Choice: Planned / In progress / Operational / Retired
    location: "Location",            // where the resource sits on the platform (path, bucket, project...)
    size: "SizeTB",                  // volume in TB (Numeric)
    implementation: "Implementation",// practical implementation (Markdown)
    operation: "Operation",          // operation: who does what, how (Markdown)
    responsible: "Responsible",
    review: "LastReview",            // Date
    attachment: "PieceJointe"        // Attachments (runbooks, PDF...)
};
// The Resources table, only for the name and the category of a resource
const RESOURCES = { table: "Resources", name: "Name", category: "Category" };

grist.ready({
    columns: [
        SLOTS.name,
        { name: SLOTS.description, optional: true },
        { name: SLOTS.country, optional: true },
        { name: SLOTS.extra, optional: true, title: "Extraterritoriality" },
        { name: SLOTS.accessHowTo, optional: true, title: "AccessHowTo (Markdown text)" },
        { name: SLOTS.accessFiles, optional: true, title: "AccessHowToAttachment (Attachments)" }
    ],
    // "full" is required to read OTHER tables (Implementations, Resources) with docApi.fetchTable.
    // The widget only reads: it never writes to the document.
    requiredAccess: "full",
    allowSelectBy: true
});

const VERSION = window.APP_VERSION || "dev";
console.log("compute.js " + VERSION + " (Storage_Compute + Implementations)");

// Colours by Country (green family, compared without case). bg = card tint, accent = left edge /
// selection / badge, ink = dark text. A country not listed here gets one of COUNTRY_FALLBACK,
// always the same for the same name. A row without country keeps the theme's default green.
const COUNTRY_COLORS = {
    "fr": { bg: "#DDEFD8", accent: "#2F7D3B", ink: "#164A20" },   // forest green
    "eu": { bg: "#D6F0E4", accent: "#13966A", ink: "#0A573B" },   // emerald
    "us": { bg: "#E9F0CD", accent: "#76981C", ink: "#43560B" }    // olive / lime
};
const COUNTRY_FALLBACK = [
    { bg: "#D8EDEA", accent: "#2A8C82", ink: "#0F514B" },         // teal green
    { bg: "#EFF2D4", accent: "#98A61F", ink: "#575F0B" },         // pistachio
    { bg: "#DEEBDF", accent: "#5B8C5A", ink: "#2C4F2B" },         // sage
    { bg: "#E2F3D2", accent: "#4E9A2E", ink: "#245414" }          // fresh green
];
function countryColors(country) {
    const key = String(country || "").trim().toLowerCase();
    if (!key) return null;
    if (COUNTRY_COLORS[key]) return COUNTRY_COLORS[key];
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COUNTRY_FALLBACK[h % COUNTRY_FALLBACK.length];
}
function paintCountry(node, country) {
    const c = countryColors(country);
    if (!c) return;
    node.style.setProperty("--card-bg", c.bg);
    node.style.setProperty("--card-accent", c.accent);
    node.style.setProperty("--card-ink", c.ink);
}

// Dot colour of a resource by Resources.Category (same families as dashboard.js)
const CATEGORY_DOT = {
    "genetics": "#E0541B", "imaging": "#DFA100", "imaging-genetics": "#B8173F",
    "dataset": "#94673A", "software": "#A3407E"
};
function categoryDot(category) {
    return CATEGORY_DOT[String(category || "").trim().toLowerCase().replace(/[\s_]+/g, "-")] || "#9aa59a";
}

// Status of an implementation, compared without case or accents -> css class
const STATUS_CLASS = {
    ok: ["operational", "operationnel", "operationnelle", "live", "production", "in production", "en production", "done", "ok"],
    doing: ["in progress", "en cours", "deploying", "wip", "setup", "migrating"],
    planned: ["planned", "prevu", "prevue", "todo", "a faire", "requested"],
    retired: ["retired", "decommissioned", "arrete", "archive", "archived", "closed"]
};
function normalise(text) {
    return String(text == null ? "" : text).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}
function statusClass(status) {
    const t = normalise(status);
    if (!t) return "";
    for (const cls of Object.keys(STATUS_CLASS)) if (STATUS_CLASS[cls].includes(t)) return cls;
    return "other";
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

// Text / Choice / ChoiceList cell -> array of strings (a ChoiceList is an array, or ["L", ...] in raw form).
function choices(value) {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) return value.filter((v, i) => !(i === 0 && v === "L")).map(String);
    return [String(value)];
}

// Extraterritoriality: "No" is calm, "Possibly" a warning, "Yes" an alert (compared without case).
function extraLevel(text) {
    const t = String(text || "").trim().toLowerCase();
    if (!t) return "";
    if (["no", "non", "false"].includes(t)) return "no";
    if (["yes", "oui", "true"].includes(t)) return "yes";
    return "maybe";
}

(function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
body { background: var(--page-bg, #f5f6f8); }
h1 { color: var(--theme-title, inherit); }
.master-detail { display: grid; grid-template-columns: minmax(0, 3fr) minmax(300px, 2fr); gap: 16px; align-items: stretch; }
.pane { border-radius: 14px; padding: 16px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05); }
.pane-list { background: var(--pane-list-bg, #dcebd9); }
.pane-detail { background: var(--pane-detail-bg, #cbe1c6); }
#platforms { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(230px, calc((100% - 14px) / 2)), 1fr)); gap: 14px; }
.platform-card, .platform-detail { background: var(--card-bg, var(--theme-card, #fff)); border-left: 6px solid var(--card-accent, var(--theme-accent, #3b8a4a));
    border-radius: 10px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.platform-card { cursor: pointer; }
.access-box { margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(0,0,0,.2); font-size: 13px; }
.access-box .access-title { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #666; margin-bottom: 3px; }
.access-box .access-text { color: #333; line-height: 1.4; white-space: pre-line; max-height: 180px; overflow: auto; }
.access-box .access-text.md { white-space: normal; }
.access-box a { color: #1f5fcf; }
.access-files { margin-top: 6px; }
.access-files a { display: inline-block; margin-right: 12px; }
.platform-card.selected { outline: 2px solid var(--card-accent, var(--theme-accent, #3b8a4a)); }
.platform-name { font-size: 17px; font-weight: 600; color: var(--card-ink, var(--theme-ink, #222)); }
.platform-desc { margin-top: 8px; color: #555; line-height: 1.4; white-space: pre-line; }
.platform-card .platform-desc { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.platform-desc.md { white-space: normal; }
.badges { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.badge { font-size: 12px; padding: 3px 9px; border-radius: 12px; white-space: nowrap; }
.badge.country { background: var(--card-accent, var(--theme-accent, #3b8a4a)); color: #fff; }
.badge.extra { background: rgba(255,255,255,.75); color: #444; box-shadow: inset 0 0 0 1px #9aa59a; }
.badge.extra.maybe { color: #7a4b00; box-shadow: inset 0 0 0 1px #d49a1a; background: #fff6df; }
.badge.extra.yes { color: #7a1020; box-shadow: inset 0 0 0 1px #c23a4e; background: #fdeaed; }
.impl-list { list-style: none; margin: 10px 0 0; padding: 0; }
.impl-list li { display: flex; align-items: baseline; gap: 6px; padding: 2px 0; font-size: 14px; }
.impl-dot { flex: 0 0 9px; width: 9px; height: 9px; border-radius: 50%; margin-top: 3px; align-self: flex-start; }
.impl-link { font: inherit; cursor: pointer; border: 0; background: none; padding: 0; text-align: left;
    color: var(--card-ink, #1f5f2f); text-decoration: underline; }
.impl-name-plain { color: #222; }
.impl-state { font-size: 11px; color: #666; margin-left: 4px; }
.impl-empty { margin-top: 10px; font-size: 13px; color: #777; font-style: italic; }
.platform-detail { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow: auto; }
.platform-detail h2 { margin: 0; font-size: 20px; color: var(--card-ink, var(--theme-ink, #222)); }
.platform-detail h3 { margin: 18px 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
.platform-detail .label { margin-top: 14px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #777; }
.platform-detail .platform-desc { color: #444; }
.impl-block { margin: 8px 0; border: 1px solid rgba(0,0,0,.14); border-radius: 8px; background: rgba(255,255,255,.7); }
.impl-block > summary { cursor: pointer; padding: 8px 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; }
.impl-block > summary:hover { background: rgba(0,0,0,.04); }
.impl-block[open] > summary { border-bottom: 1px solid rgba(0,0,0,.12); }
.impl-block.focus { box-shadow: 0 0 0 2px var(--card-accent, #3b8a4a); }
.impl-cat { font-size: 12px; font-weight: 400; color: #666; }
.impl-status { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 10px; background: #eee; color: #444; margin-left: auto; }
.impl-status.ok { background: #dff3e4; color: #14663a; }
.impl-status.doing { background: #fff1cf; color: #7a4b00; }
.impl-status.planned { background: #e7ecf3; color: #3b4a60; }
.impl-status.retired { background: #eceaea; color: #777; text-decoration: line-through; }
.impl-body { padding: 4px 12px 12px; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 8px 0 4px; font-size: 13px; }
.facts dt { color: #777; }
.facts dd { margin: 0; color: #222; word-break: break-word; }
.impl-body h4 { margin: 12px 0 4px; font-size: 13px; color: var(--card-ink, #164a20); }
.impl-text { color: #333; line-height: 1.45; white-space: pre-line; }
.impl-text.md { white-space: normal; }
.impl-attach { margin-top: 10px; font-size: 13px; }
.impl-attach a { margin-right: 12px; color: #1f5fcf; }
.version-stamp { margin-top: 14px; font-size: 11px; color: #999; }
.empty-state { color: #666; font-style: italic; }
.fatal-error { margin: 12px 0; padding: 10px 14px; border-radius: 8px; background: #fdecea; color: #8a1c13; font-size: 13px; }
@media (max-width: 760px) { .master-detail { grid-template-columns: 1fr; } .platform-detail { position: static; } }
`;
    document.head.appendChild(style);
})();

window.addEventListener("error", function (event) { showFatal(event.message); });
window.addEventListener("unhandledrejection", function (event) {
    showFatal(String((event.reason && event.reason.message) || event.reason));
});
function showFatal(message) {
    console.error("compute.js " + VERSION + ":", message);
    document.body.appendChild(el("div", "fatal-error", "Erreur du widget (" + VERSION + ") : " + message));
}

// Shared Markdown renderer: markdown.js (v2) and markdown-it.min.js must sit next to this file.
// Until it is loaded, or if it cannot be, texts are shown as plain text.
const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;
let md = null;
function mdPlain(text) { return window.HubMarkdown ? window.HubMarkdown.plain(text) : text; }
function mdFill(node, text) {
    if (window.HubMarkdown) window.HubMarkdown.fill(node, text, md); else node.textContent = text;
}
(function loadMarkdown() {
    const script = document.createElement("script");
    script.src = new URL("markdown.js", SCRIPT_URL).href;
    script.onload = function () {
        window.HubMarkdown.load().then(function (instance) {
            md = instance;
            render();             // cards: plain-text version of the description
            updateSelection();    // detail pane: rendered Markdown
        });
    };
    script.onerror = function () { console.warn("markdown.js not found next to this script: texts shown as plain text."); };
    document.head.appendChild(script);
})();


// =====================================================
// Implementations + Resources (read directly, cached in memory)
// fetchTable returns RAW cell values: a Reference is a row id, an Attachments cell is ["L", id, ...] or null.
// =====================================================
let implByPlatform = new Map();   // Storage_Compute row id -> implementations (table order)
let implError = null;             // message shown in the detail pane if the read failed
let implMissing = null;           // essential columns of Implementations that were not found (message), or null
let resourcesError = null;

function columnKey(data, wanted) {
    const target = String(wanted).toLowerCase();
    return Object.keys(data).find(k => k.toLowerCase() === target) || null;
}
function referenceRowId(value) {
    let raw = value;
    if (Array.isArray(value)) {
        const numbers = value.filter(x => typeof x === "number");
        raw = numbers.length ? numbers[numbers.length - 1] : 0;
    } else if (value !== null && typeof value === "object") {
        raw = value.rowId !== undefined ? value.rowId : (value.id !== undefined ? value.id : value.row_id);
    }
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : 0;
}
function attachmentIds(value) {
    return Array.isArray(value) ? value.filter(x => typeof x === "number") : [];
}
function toMillis(value) {
    if (!value) return NaN;
    if (value instanceof Date) return value.getTime();
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    return n < 1e11 ? n * 1000 : n;
}
function formatDate(value) {
    const ms = toMillis(value);
    return isNaN(ms) ? "" : new Date(ms).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

async function readTable(name) {
    try { return { ok: true, data: await grist.docApi.fetchTable(name) }; }
    catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
}

async function loadDetails() {
    const [implRes, resRes] = await Promise.all([readTable(IMPL.table), readTable(RESOURCES.table)]);

    // Resources: row id -> { name, category }
    const resourcesById = new Map();
    resourcesError = null;
    if (resRes.ok && resRes.data.id) {
        const nk = columnKey(resRes.data, RESOURCES.name), ck = columnKey(resRes.data, RESOURCES.category);
        for (let i = 0; i < resRes.data.id.length; i++) {
            resourcesById.set(resRes.data.id[i], {
                name: nk && resRes.data[nk][i] != null ? String(resRes.data[nk][i]) : "",
                category: ck && resRes.data[ck][i] != null ? String(resRes.data[ck][i]) : ""
            });
        }
    } else if (!resRes.ok) {
        resourcesError = resRes.error;
        console.error("Could not read the Resources table:", resRes.error);
    }

    if (!implRes.ok) {
        implError = implRes.error;
        implMissing = null;
        implByPlatform = new Map();
        console.error("Could not read the Implementations table:", implRes.error);
        return;
    }
    const data = implRes.data;
    const k = {};
    for (const f of Object.keys(IMPL)) if (f !== "table") k[f] = columnKey(data, IMPL[f]);
    if (!data.id || !k.platform) {
        implError = "colonne '" + IMPL.platform + "' introuvable dans '" + IMPL.table + "'";
        implByPlatform = new Map();
        return;
    }
    implError = null;
    // Only the essential columns are reported; Status, Location, SizeTB, Responsible, LastReview and the
    // attachments column are optional and silently ignored when absent.
    const missing = ["platform", "resource", "implementation", "operation"].filter(f => !k[f]).map(f => IMPL[f]);
    implMissing = missing.length
        ? "Colonne(s) introuvable(s) dans « " + IMPL.table + " » : " + missing.join(", ") +
          ". Colonnes présentes : " + Object.keys(data).filter(c => c !== "id" && c !== "manualSort" && !c.startsWith("gristHelper_")).join(", ") + "."
        : null;
    const orderKey = columnKey(data, "manualSort");
    const text = v => (v == null ? "" : String(v));
    const rows = [];
    for (let i = 0; i < data.id.length; i++) {
        const get = f => (k[f] ? data[k[f]][i] : undefined);
        const platformId = referenceRowId(get("platform"));
        if (!platformId) continue;
        const resourceId = referenceRowId(get("resource"));
        const resource = resourcesById.get(resourceId);
        const rawSize = get("size");
        rows.push({
            id: data.id[i],
            platformId: platformId,
            resourceName: resource && resource.name ? resource.name
                : (typeof get("resource") === "string" && get("resource") ? get("resource")
                    : (resourceId ? "Ressource n°" + resourceId : "(ressource non renseignée)")),
            category: resource ? resource.category : "",
            status: text(get("status")).trim(),
            location: text(get("location")).trim(),
            size: rawSize === null || rawSize === undefined || rawSize === "" || !Number.isFinite(Number(rawSize)) ? null : Number(rawSize),
            implementation: text(get("implementation")),
            operation: text(get("operation")),
            responsible: text(get("responsible")).trim(),
            review: get("review"),
            attachments: attachmentIds(get("attachment")),
            order: orderKey && Number.isFinite(Number(data[orderKey][i])) ? Number(data[orderKey][i]) : i
        });
    }
    rows.sort((a, b) => (a.order - b.order) || (a.id - b.id));
    const byPlatform = new Map();
    for (const r of rows) {
        if (!byPlatform.has(r.platformId)) byPlatform.set(r.platformId, []);
        byPlatform.get(r.platformId).push(r);
    }
    implByPlatform = byPlatform;
}


// =====================================================
// Cards (left pane)
// =====================================================
let platforms = [];
let accessToken = null;           // { baseUrl, token } for the AccessHowTo attachments, or null
let selectedId = null;        // Storage_Compute row id of the selected platform
let focusImpl = null;         // implementation id to open in the detail pane (click on a resource)
let cards = new Map();
let detailBody = null;

function countryBadges(values) {
    const box = el("div", "badges");
    values.forEach(v => box.appendChild(el("span", "badge country", v)));
    return box;
}
function extraBadge(text) {
    const box = el("div", "badges");
    box.appendChild(el("span", "badge extra " + extraLevel(text), "Extraterritorialité : " + text));
    return box;
}

// "How to access" block of a platform card (text in Markdown + attachments). A click on a link
// must not select the card, hence the stopPropagation.
function buildAccessBox(p) {
    const hasFiles = p.accessFiles.length > 0;
    if (!p.accessHowTo.trim() && !hasFiles) return null;
    const box = el("div", "access-box");
    box.appendChild(el("div", "access-title", "Comment accéder"));
    if (p.accessHowTo.trim()) {
        const t = el("div", "access-text"); mdFill(t, p.accessHowTo); box.appendChild(t);
    }
    if (hasFiles) {
        const files = el("div", "access-files");
        if (accessToken) {
            p.accessFiles.forEach((id, n) => {
                const a = el("a", "", "Pièce jointe" + (p.accessFiles.length > 1 ? " " + (n + 1) : ""));
                a.href = `${accessToken.baseUrl}/attachments/${id}/download?auth=${accessToken.token}`;
                a.target = "_blank";
                a.rel = "noopener";
                files.appendChild(a);
            });
        } else {
            files.appendChild(el("span", "empty-state", "Pièce jointe indisponible (jeton non obtenu)."));
        }
        box.appendChild(files);
    }
    box.addEventListener("click", function (event) { if (event.target.closest("a")) event.stopPropagation(); });
    return box;
}

function buildImplList(platform) {
    if (implError) return null;   // the reason is shown in the detail pane
    const impls = implByPlatform.get(platform.id) || [];
    if (!impls.length) return el("div", "impl-empty", "Aucune ressource hébergée");
    const list = el("ul", "impl-list");
    impls.forEach(impl => {
        const li = document.createElement("li");
        const dot = el("span", "impl-dot");
        dot.style.background = categoryDot(impl.category);
        dot.title = impl.category || "";
        li.appendChild(dot);
        const button = el("button", "impl-link", impl.resourceName);
        button.type = "button";
        button.title = "Afficher les détails d'implémentation et d'exploitation";
        button.addEventListener("click", function (event) {
            event.stopPropagation();
            selectedId = platform.id;
            focusImpl = impl.id;
            updateSelection();
            grist.setCursorPos({ rowId: platform.id });
            loadDetails().then(function () { render(); updateSelection(); });
        });
        li.appendChild(button);
        const cls = statusClass(impl.status);
        if (impl.status && cls) li.appendChild(el("span", "impl-state", "· " + impl.status));
        list.appendChild(li);
    });
    return list;
}

function render() {
    const host = document.getElementById("platforms");
    if (!platforms.length) { host.replaceChildren(el("div", "empty-state", "Aucune plateforme à afficher.")); return; }
    const fresh = new Map();
    const nodes = platforms.map(p => {
        const card = el("div", "platform-card");
        paintCountry(card, p.country[0]);
        card.appendChild(el("div", "platform-name", p.name));
        if (p.country.length) card.appendChild(countryBadges(p.country));
        if (p.description) card.appendChild(el("div", "platform-desc", mdPlain(p.description)));
        if (p.extra) card.appendChild(extraBadge(p.extra));
        const access = buildAccessBox(p);
        if (access) card.appendChild(access);
        const impls = buildImplList(p);
        if (impls) card.appendChild(impls);
        card.addEventListener("click", () => {
            selectedId = p.id;
            focusImpl = null;
            updateSelection();
            grist.setCursorPos({ rowId: p.id });
            // Re-read the details so that a recent edit shows up
            loadDetails().then(() => { render(); updateSelection(); });
        });
        fresh.set(p.id, card);
        return card;
    });
    cards = fresh;
    host.replaceChildren(...nodes);
}


// =====================================================
// Detail pane (right): platform, then one foldable block per hosted resource
// =====================================================
let detailRequest = 0;

function fact(list, label, value) {
    if (value === "" || value === null || value === undefined) return;
    list.appendChild(el("dt", "", label));
    list.appendChild(el("dd", "", String(value)));
}

function buildImplBlock(impl, open, tokenInfo) {
    const block = document.createElement("details");
    block.className = "impl-block" + (impl.id === focusImpl ? " focus" : "");
    block.dataset.implId = String(impl.id);
    block.open = open;

    const summary = document.createElement("summary");
    const dot = el("span", "impl-dot");
    dot.style.background = categoryDot(impl.category);
    summary.appendChild(dot);
    summary.appendChild(document.createTextNode(impl.resourceName));
    if (impl.category) summary.appendChild(el("span", "impl-cat", impl.category));
    if (impl.status) summary.appendChild(el("span", "impl-status " + statusClass(impl.status), impl.status));
    block.appendChild(summary);

    const body = el("div", "impl-body");
    const facts = el("dl", "facts");
    fact(facts, "Emplacement", impl.location);
    fact(facts, "Volume", impl.size === null ? "" : impl.size + " To");
    fact(facts, "Responsable", impl.responsible);
    fact(facts, "Dernière revue", formatDate(impl.review));
    if (facts.children.length) body.appendChild(facts);

    body.appendChild(el("h4", "", "Mise en œuvre"));
    if (impl.implementation.trim()) {
        const t = el("div", "impl-text"); mdFill(t, impl.implementation); body.appendChild(t);
    } else {
        body.appendChild(el("div", "empty-state", "Non renseignée."));
    }
    body.appendChild(el("h4", "", "Exploitation"));
    if (impl.operation.trim()) {
        const t = el("div", "impl-text"); mdFill(t, impl.operation); body.appendChild(t);
    } else {
        body.appendChild(el("div", "empty-state", "Non renseignée."));
    }
    if (tokenInfo && impl.attachments.length) {
        const attach = el("div", "impl-attach");
        impl.attachments.forEach((id, n) => {
            const a = el("a", "", "Pièce jointe" + (impl.attachments.length > 1 ? " " + (n + 1) : ""));
            a.href = `${tokenInfo.baseUrl}/attachments/${id}/download?auth=${tokenInfo.token}`;
            a.target = "_blank";
            a.rel = "noopener";
            attach.appendChild(a);
        });
        body.appendChild(attach);
    }
    block.appendChild(body);
    return block;
}

async function renderDetail() {
    const myRequest = ++detailRequest;
    detailBody.replaceChildren();
    const p = platforms.find(x => x.id === selectedId);
    if (!p) { detailBody.appendChild(el("div", "empty-state", "Sélectionnez une plateforme dans la liste.")); return; }

    const impls = implByPlatform.get(p.id) || [];
    // Token only when some implementation has an attachment
    let tokenInfo = null;
    if (impls.some(i => i.attachments.length)) {
        try { tokenInfo = await grist.docApi.getAccessToken({ readOnly: true }); }
        catch (err) { console.error("Could not get attachment token:", err); }
        if (myRequest !== detailRequest) return;   // a newer render has started
    }

    const box = el("div", "platform-detail");
    paintCountry(box, p.country[0]);
    box.appendChild(el("h2", "", p.name));
    if (p.country.length) { box.appendChild(el("div", "label", "Pays")); box.appendChild(countryBadges(p.country)); }
    if (p.extra) { box.appendChild(el("div", "label", "Extraterritorialité")); box.appendChild(extraBadge(p.extra)); }
    if (p.description) {
        box.appendChild(el("div", "label", "Description"));
        const d = el("div", "platform-desc"); mdFill(d, p.description); box.appendChild(d);
    }

    if (implError) {
        box.appendChild(el("div", "fatal-error",
            "Impossible de lire la table « " + IMPL.table + " » (accès complet requis ? nom de table ou de colonne ?) : " + implError));
    } else {
        box.appendChild(el("h3", "", "Ressources hébergées" + (impls.length ? " (" + impls.length + ")" : "")));
        if (implMissing) box.appendChild(el("div", "fatal-error", implMissing));
        if (resourcesError) box.appendChild(el("div", "fatal-error", "Table « " + RESOURCES.table + " » illisible : " + resourcesError));
        if (!impls.length) box.appendChild(el("div", "empty-state", "Aucune ressource hébergée sur cette plateforme."));
        impls.forEach(impl => {
            box.appendChild(buildImplBlock(impl, true, tokenInfo));   // all blocks unfolded: the texts are visible at once
        });
    }
    box.appendChild(el("div", "version-stamp", "compute.js " + VERSION));
    detailBody.replaceChildren(box);

    const focused = box.querySelector(".impl-block.focus");
    if (focused && focused.scrollIntoView) focused.scrollIntoView({ block: "nearest" });
}

function updateSelection() {
    cards.forEach((node, id) => node.classList.toggle("selected", id === selectedId));
    renderDetail();
}

// Two panes, built once: the page's #platforms grid goes into the left one.
(function layout() {
    const host = document.getElementById("platforms");
    const wrap = el("div", "master-detail");
    const left = el("div", "pane pane-list");
    const right = el("div", "pane pane-detail");
    detailBody = el("div", "detail-host");
    right.appendChild(detailBody);
    host.parentNode.insertBefore(wrap, host);
    left.appendChild(host);
    wrap.append(left, right);
})();

let recordsRequest = 0;   // guards against overlapping updates
grist.onRecords(async function (records) {
    const myRequest = ++recordsRequest;
    try {
        const mapped = grist.mapColumnNames(records);
        if (!mapped) {
            document.getElementById("platforms").replaceChildren(el("div", "empty-state", "Associez les colonnes du widget dans le panneau de création."));
            return;
        }
        const text = v => (v == null ? "" : String(v));
        platforms = mapped.map(r => ({
            id: r.id,
            name: text(r[SLOTS.name]),
            description: text(r[SLOTS.description]),
            country: choices(r[SLOTS.country]),
            extra: text(r[SLOTS.extra]).trim(),
            accessHowTo: text(r[SLOTS.accessHowTo]),
            accessFiles: attachmentIds(r[SLOTS.accessFiles])
        }));
        // Token only when some platform has an access attachment
        accessToken = null;
        if (platforms.some(p => p.accessFiles.length)) {
            try { accessToken = await grist.docApi.getAccessToken({ readOnly: true }); }
            catch (err) { console.error("Could not get attachment token:", err); }
            if (myRequest !== recordsRequest) return;
        }
        await loadDetails();
        if (myRequest !== recordsRequest) return;   // a newer update has arrived
        if (selectedId == null || !platforms.some(p => p.id === selectedId)) {
            selectedId = platforms.length ? platforms[0].id : null;
            focusImpl = null;
        }
        render();
        updateSelection();
    } catch (e) {
        console.error("compute.js " + VERSION + ":", e);
        document.body.appendChild(el("div", "fatal-error", "Erreur du widget (" + VERSION + ") : " + e.message));
    }
});

grist.onRecord(function (record) {
    if (record && record.id != null && record.id !== selectedId && cards.has(record.id)) {
        selectedId = record.id;
        focusImpl = null;
        updateSelection();
    }
});
