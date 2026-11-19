// =====================================================
// Administrative players + data holders widget, data model "AdminPlayers / DataHolder + Procedures".
// The widget is bound to the Procedures table: every procedure points EITHER to an administrative
// player (adminPlayer -> table AdminPlayers) OR to a data holder (dataHolder -> table DataHolder), and
// has a step number (etape). The two tables stay separate; they are read directly (see PLAYERS and
// HOLDERS below), not through mapped slots, exactly like dashboard.js reads Campaigns. Left pane: one
// card per player / holder (same card for both) listing its procedures ordered by step (a procedure
// with a PDF opens it in a viewer). Right pane: the Description of the selected card.
// Default theme: blue (see themes.js, ?theme=...).
// Slot names = free names, mapped to the real columns of Procedures in the creator panel.
// =====================================================
const SLOTS = {
    title: "titre",              // titre: text shown for each procedure
    player: "adminPlayer",       // adminPlayer: Reference to the AdminPlayers table (optional)
    holder: "dataHolder",        // dataHolder: Reference to the DataHolder table (optional)
    step: "etape",               // etape: order of the procedure inside its player (1, 2, 3...)
    start: "dateDebut",          // dateDebut (optional)
    due: "dateEcheance",         // dateEcheance (optional)
    attachment: "piecejointe",   // piecejointe: Attachments column holding the PDF(s) (optional)
    status: "statut",            // statut: "done" -> tick, "wip" -> arrow (optional, see STATUS_* below)
    description: "description"   // description of the procedure, shown as a tooltip (optional)
};

// The AdminPlayers table is read directly by this widget (docApi.fetchTable), NOT through a mapped
// slot: use the real Grist table id and column ids (case does not matter).
const PLAYERS = {
    table: "AdminPlayers",
    name: "Name",
    description: "Description",
    role: "Role",
    country: "Country"
};

// A DataHolder row has no Role: its cards carry a "Data holder" badge instead and their own colour.
const HOLDERS = {
    table: "DataHolder",
    name: "Name",
    description: "Description",
    country: "Country",
    badge: "Data holder"
};
const HOLDER_COLORS = { bg: "#E3EFF1", accent: "#2F7F8C", ink: "#164A53" };   // teal blue

grist.ready({
    columns: [
        SLOTS.title,
        { name: SLOTS.player, optional: true },
        { name: SLOTS.holder, optional: true },
        SLOTS.step,
        { name: SLOTS.start, optional: true },
        { name: SLOTS.due, optional: true },
        { name: SLOTS.attachment, optional: true },
        { name: SLOTS.status, optional: true },
        { name: SLOTS.description, optional: true }
    ],
    // "full" is required to read OTHER tables (AdminPlayers, DataHolder) with docApi.fetchTable.
    // The widget only reads: it never writes to the document.
    requiredAccess: "full",
    allowSelectBy: true
});

const VERSION = window.APP_VERSION || "dev";
console.log("admin.js " + VERSION + " (modèle AdminPlayers / DataHolder + Procedures)");

// Where this script was loaded from: markdown-it.min.js is expected right next to it
const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;

// Values of the statut column, compared without case or accents ("Terminé" = "termine"), as in
// dashboard.js. Anything else (empty, "À faire", "todo"...) shows no mark.
const STATUS_DONE = ["done", "termine", "terminee", "fait", "faite", "complete", "completed",
                     "clos", "close", "closed", "cloture", "fini", "finie", "finished", "ok", "oui", "yes"];
const STATUS_DOING = ["en cours", "encours", "in progress", "doing", "wip", "started", "demarre", "commence"];

// Colours by role (blue family, compared without case). bg = card tint, accent = left edge / selection,
// ink = text of the badge. The first role of a player colours its card; a player without role, or with
// a role not listed here, keeps the theme's default blue. Add a line here when a new Role choice appears.
const ROLE_COLORS = {
    "broker":   { bg: "#E1EDFD", accent: "#1F6FEB", ink: "#0B3A8C" },   // royal blue
    "premise":  { bg: "#D9F0F6", accent: "#0E8FB5", ink: "#07566E" },   // cyan blue
    "provider": { bg: "#E3E5FA", accent: "#4F5BD5", ink: "#262E8F" },   // indigo
    "sso":      { bg: "#D3E0EF", accent: "#2B4C7E", ink: "#14284A" },   // navy / steel
    "irb":      { bg: "#EBF5FE", accent: "#3F86CE", ink: "#265C94" }    // sky blue
};
function roleColors(role) {
    return ROLE_COLORS[String(role || "").trim().toLowerCase()] || null;
}
function paintRole(node, role) {
    const c = roleColors(role);
    if (!c) return;
    node.style.setProperty("--card-bg", c.bg);
    node.style.setProperty("--card-accent", c.accent);
    node.style.setProperty("--card-ink", c.ink);
}

// Colours of a card / pane: a data holder has its own colour, an admin player the colour of its first role
function entityColors(entity) {
    if (!entity) return null;
    return entity.kind === "holder" ? HOLDER_COLORS : roleColors(entity.role[0]);
}
function paintEntity(node, entity) {
    const c = entityColors(entity);
    if (!c) return;
    node.style.setProperty("--card-bg", c.bg);
    node.style.setProperty("--card-accent", c.accent);
    node.style.setProperty("--card-ink", c.ink);
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

// Text / Choice / ChoiceList cell -> array of strings. A ChoiceList is an array (or ["L", ...] in raw form).
function choices(value) {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) return value.filter((v, i) => !(i === 0 && v === "L")).map(String);
    return [String(value)];
}

(function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
body { background: var(--page-bg, #f5f6f8); }
h1 { color: var(--theme-title, inherit); }
.master-detail { display: grid; grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr); gap: 16px; align-items: stretch; }
.pane { border-radius: 14px; padding: 16px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05); }
.pane-list { background: var(--pane-list-bg, #dce8f5); }
.pane-detail { background: var(--pane-detail-bg, #cddbf0); }
#players { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.player-card, .player-detail { background: var(--card-bg, var(--theme-card, #fff)); border-left: 6px solid var(--card-accent, var(--theme-accent, #2f6fdb));
    border-radius: 10px; padding: 14px 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.player-card { cursor: pointer; }
.player-card.selected { outline: 2px solid var(--card-accent, var(--theme-accent, #2f6fdb)); }
.player-name { font-size: 17px; font-weight: 600; color: var(--card-ink, var(--theme-ink, #222)); }
.badges { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.badge { font-size: 12px; padding: 3px 9px; border-radius: 12px; background: rgba(255,255,255,.75);
    color: var(--card-ink, var(--theme-ink, #222)); box-shadow: inset 0 0 0 1px var(--card-accent, var(--theme-accent, #2f6fdb)); white-space: nowrap; }
.badge.role { background: var(--card-accent, var(--theme-accent, #2f6fdb)); color: #fff; box-shadow: none; }
.badge.country { box-shadow: none; background: var(--theme-accent, #2f6fdb); color: #fff; }
.proc-list { list-style: none; margin: 10px 0 0; padding: 0; }
.proc-list li { display: flex; gap: 6px; padding: 3px 0; font-size: 14px; }
.proc-list.tracked li.done, .proc-list.tracked li.done .proc-link, .proc-list.tracked li.done .proc-title { color: #8a8f98; }
.proc-list.tracked li.doing .proc-title, .proc-list.tracked li.doing .proc-link { font-weight: 700; }
.proc-mark { flex: 0 0 14px; text-align: center; }
li.done .proc-mark { color: #2f9e6b; }
li.doing .proc-mark { color: var(--card-accent, #2f6fdb); font-weight: 700; }
.proc-text { min-width: 0; }
.proc-title { font-weight: 500; color: #222; }
.proc-link { font: inherit; font-weight: 500; cursor: pointer; border: 0; background: none; padding: 0;
    color: var(--card-ink, #1f5fcf); text-decoration: underline; text-align: left; }
.proc-date { color: #6b7280; font-size: 12px; margin-left: 6px; white-space: nowrap; }
.proc-diagnostic { margin-top: 10px; font-size: 11px; color: #8a1c13; word-break: break-word; }
.proc-info { flex: 0 0 auto; font: inherit; font-size: 12px; line-height: 1; cursor: pointer; margin-left: 6px; padding: 1px 6px;
    border: 1px solid rgba(0,0,0,.25); border-radius: 10px; background: rgba(255,255,255,.8); color: #1f5fcf; }
.proc-info:hover, .proc-info.active { background: #1f5fcf; color: #fff; border-color: #1f5fcf; }
.note-pop { position: fixed; z-index: 40; width: min(420px, calc(100vw - 24px)); max-height: min(60vh, calc(100vh - 24px));
    display: flex; flex-direction: column; background: #fff; color: #222; border-radius: 10px;
    border-left: 6px solid var(--card-accent, #2f6fdb); box-shadow: 0 8px 28px rgba(0,0,0,.28); user-select: text; cursor: auto; }
.note-pop[hidden] { display: none; }
.note-head { display: flex; align-items: flex-start; gap: 8px; padding: 10px 10px 8px 12px; border-bottom: 1px solid rgba(0,0,0,.1); cursor: move; user-select: none; }
.note-title { flex: 1; min-width: 0; font-weight: 600; color: var(--card-ink, #222); }
.note-meta { font-size: 12px; font-weight: 400; color: #666; margin-top: 2px; }
.note-close { flex: 0 0 auto; font: inherit; font-size: 16px; line-height: 1; cursor: pointer; border: 0; border-radius: 6px; background: none; color: #555; padding: 2px 7px; }
.note-close:hover { background: rgba(0,0,0,.08); color: #000; }
.note-body { padding: 4px 14px 12px; overflow: auto; user-select: text; cursor: text; }
.note-body .player-desc { margin-top: 8px; }
.proc-empty { margin-top: 10px; font-size: 13px; color: #777; font-style: italic; }
.player-detail { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow: auto; }
.player-detail h2 { margin: 0; font-size: 20px; color: var(--card-ink, var(--theme-ink, #222)); }
.player-detail .label { margin-top: 14px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #777; }
.player-desc { margin-top: 8px; color: #444; line-height: 1.45; white-space: pre-line; }
.player-desc.md { white-space: normal; }
.player-desc.md > :first-child { margin-top: 0; }
.player-desc.md > :last-child { margin-bottom: 0; }
.player-desc.md p { margin: 8px 0; }
.player-desc.md h1, .player-desc.md h2, .player-desc.md h3, .player-desc.md h4, .player-desc.md h5, .player-desc.md h6 { font-size: 15px; margin: 14px 0 6px; }
.player-desc.md ul, .player-desc.md ol { margin: 8px 0; padding-left: 22px; }
.player-desc.md blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #ddd; color: #666; }
.player-desc.md code { background: rgba(0,0,0,.06); padding: 1px 4px; border-radius: 4px; font-size: 90%; }
.player-desc.md pre { background: rgba(0,0,0,.06); padding: 10px; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
.player-desc.md pre code { background: none; padding: 0; }
.player-desc.md table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.player-desc.md th, .player-desc.md td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
.player-desc.md a { color: #1f5fcf; text-decoration: underline; }
.md-details { margin: 8px 0; border: 1px solid rgba(0,0,0,.12); border-radius: 6px; background: rgba(255,255,255,.55); }
.md-details > summary { cursor: pointer; padding: 6px 10px; font-weight: 600; }
.md-details > summary:hover { background: rgba(0,0,0,.04); }
.md-details[open] > summary { border-bottom: 1px solid rgba(0,0,0,.12); }
.md-details-body { padding: 2px 12px 6px; }
.version-stamp { margin-top: 14px; font-size: 11px; color: #999; }
.empty-state { color: #666; font-style: italic; }
.fatal-error { margin: 12px 0; padding: 10px 14px; border-radius: 8px; background: #fdecea; color: #8a1c13; font-size: 13px; }
.pdf-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
.pdf-overlay[hidden] { display: none; }
.pdf-panel { background: #fff; border-radius: 10px; width: min(960px, 100%); height: min(92vh, 100%); display: flex; flex-direction: column; overflow: hidden; }
.pdf-bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #ddd; }
.pdf-title { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-actions { display: flex; gap: 10px; align-items: center; font-size: 13px; }
.pdf-actions button.current { font-weight: 700; }
.pdf-status { padding: 10px 14px; color: #555; font-size: 14px; }
.pdf-status[hidden] { display: none; }
.pdf-frame { flex: 1; border: 0; width: 100%; }
@media (max-width: 760px) { .master-detail { grid-template-columns: 1fr; } .player-detail { position: static; } }
`;
    document.head.appendChild(style);
})();

// Any uncaught error is also shown on the page (not only in the console)
function showFatal(message) {
    console.error("admin.js " + VERSION + ":", message);
    document.body.appendChild(el("div", "fatal-error", "Erreur du widget (" + VERSION + ") : " + message));
}
window.addEventListener("error", function (event) { showFatal(event.message); });
window.addEventListener("unhandledrejection", function (event) {
    showFatal(String((event.reason && event.reason.message) || event.reason));
});

// =====================================================
// AdminPlayers and DataHolder tables (read directly, cached in memory)
// Both kinds are "entities" shown as cards. Row ids of the two tables can be equal, so an entity is
// identified by its key: "admin:3" or "holder:3".
// =====================================================
let players = [];                 // all entities: the admin players first, then the data holders
let playersByKey = new Map();     // key -> entity
let adminById = new Map(), adminByName = new Map();
let holderById = new Map(), holderByName = new Map();
let playersError = null;          // message shown instead of the cards if NO table could be read
let tableWarnings = [];           // a table that failed while the other one is readable

// Actual key of a column in a fetched table, ignoring case ("name" finds "Name")
function columnKey(data, wanted) {
    const target = String(wanted).toLowerCase();
    return Object.keys(data).find(k => k.toLowerCase() === target) || null;
}

// Reads one table into entities of the given kind ("admin" | "holder"). Throws on failure.
async function readEntities(config, kind) {
    // docApi.fetchTable returns RAW cell values: a ChoiceList looks like ["L", "Broker"]
    const data = await grist.docApi.fetchTable(config.table);
    const keys = {};
    for (const field of Object.keys(config)) {
        if (field !== "table" && field !== "badge") keys[field] = columnKey(data, config[field]);
    }
    if (!data.id || !keys.name) {
        throw new Error("colonne '" + config.name + "' introuvable dans '" + config.table + "'");
    }
    const orderKey = columnKey(data, "manualSort");
    const list = [];
    for (let i = 0; i < data.id.length; i++) {
        const get = field => (keys[field] ? data[keys[field]][i] : undefined);
        list.push({
            id: data.id[i],
            kind: kind,
            key: kind + ":" + data.id[i],
            name: get("name") == null ? "" : String(get("name")),
            description: get("description") == null ? "" : String(get("description")),
            role: kind === "admin" ? choices(get("role")) : [],
            country: choices(get("country")),
            order: orderKey && Number.isFinite(Number(data[orderKey][i])) ? Number(data[orderKey][i]) : i
        });
    }
    list.sort((a, b) => (a.order - b.order) || (a.id - b.id));
    return list;
}

async function loadPlayers() {
    const results = await Promise.all([
        readEntities(PLAYERS, "admin").then(v => ({ ok: true, v }), e => ({ ok: false, e })),
        readEntities(HOLDERS, "holder").then(v => ({ ok: true, v }), e => ({ ok: false, e }))
    ]);
    const [admins, holders] = results;
    const message = r => String((r.e && r.e.message) || r.e);
    tableWarnings = [];
    if (!admins.ok) { console.error("Could not read the AdminPlayers table:", admins.e); tableWarnings.push("« " + PLAYERS.table + " » : " + message(admins)); }
    if (!holders.ok) { console.error("Could not read the DataHolder table:", holders.e); tableWarnings.push("« " + HOLDERS.table + " » : " + message(holders)); }

    if (!admins.ok && !holders.ok) {
        playersError = tableWarnings.join(" ; ");
        return;   // keep the previous data in memory
    }
    playersError = null;

    const adminList = admins.ok ? admins.v : [];
    const holderList = holders.ok ? holders.v : [];
    players = adminList.concat(holderList);
    playersByKey = new Map(players.map(p => [p.key, p]));
    adminById = new Map(adminList.map(p => [p.id, p]));
    adminByName = new Map(adminList.filter(p => p.name).map(p => [p.name.toLowerCase(), p]));
    holderById = new Map(holderList.map(p => [p.id, p]));
    holderByName = new Map(holderList.filter(p => p.name).map(p => [p.name.toLowerCase(), p]));
}

// Row id of a referenced row. Depending on the options, a Reference cell arrives
// as a number, as a Reference object ({ tableId, rowId }) or as its display text.
// Also accepted: the raw form ["R", "AdminPlayers", 3] and objects holding rowId / id / row_id.
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

// Text of a Reference cell that arrived as display text (or as an object holding it)
function referenceText(value) {
    if (typeof value === "string") return value;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        for (const key of ["display", "text", "name", "Name", "value"]) {
            if (typeof value[key] === "string") return value[key];
        }
    }
    return "";
}

// The player / holder a procedure points to: adminPlayer or dataHolder (by row id, or by Name when the
// cell arrives as text). A procedure should have only ONE of them; if both are filled, the admin
// player wins and a warning is written in the console.
function lookupEntity(byId, byName, value) {
    const hit = byId.get(referenceRowId(value));
    if (hit) return hit;
    const text = referenceText(value).trim().toLowerCase();
    return text ? (byName.get(text) || null) : null;
}
const warnedBoth = new Set();
function playerOfRecord(record) {
    const admin = lookupEntity(adminById, adminByName, record[SLOTS.player]);
    const holder = lookupEntity(holderById, holderByName, record[SLOTS.holder]);
    if (admin && holder && !warnedBoth.has(record.id)) {
        warnedBoth.add(record.id);
        console.warn("Procédure " + record.id + " : « " + SLOTS.player + " » et « " + SLOTS.holder +
            " » sont tous deux remplis, « " + SLOTS.player + " » est utilisé.");
    }
    return admin || holder || null;
}

// Grist Date cells arrive as seconds since epoch (or as a Date object).
// Returns milliseconds, or NaN when the cell is empty / unreadable.
function toMillis(value) {
    if (!value) return NaN;
    if (value instanceof Date) return value.getTime();
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    return n < 1e11 ? n * 1000 : n;   // seconds (normal case) or already milliseconds
}
function formatDate(value) {
    const ms = toMillis(value);
    if (isNaN(ms)) return "";
    return new Date(ms).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

// Date text of a procedure: "start", "→ due", or "start → due"
function procedureDate(record) {
    const start = formatDate(record[SLOTS.start]);
    const due = formatDate(record[SLOTS.due]);
    if (start && due && start !== due) return start + " → " + due;
    return start || due;
}

// Group the procedures (the records of this widget) by player, in step order.
// One group per player of the AdminPlayers table (even without procedure), in the order of that
// table; procedures pointing to no player (or an unknown one) are gathered in a last group.
function buildGroups(records) {
    const byPlayer = new Map();
    const loose = [];
    for (const record of records) {
        const player = playerOfRecord(record);
        if (player) {
            if (!byPlayer.has(player.key)) byPlayer.set(player.key, []);
            byPlayer.get(player.key).push(record);
        } else {
            loose.push(record);
        }
    }

    // Steps are sorted by etape (a step without number goes last), then by row id
    const stepOf = r => {
        const raw = r[SLOTS.step];
        const n = (raw === null || raw === undefined || raw === "") ? NaN : Number(raw);
        return Number.isFinite(n) ? n : Infinity;
    };
    const sortSteps = list => list.sort((a, b) => {
        const sa = stepOf(a), sb = stepOf(b);
        return (sa === sb ? 0 : sa - sb) || (a.id - b.id);
    });

    const groups = players.map(p => ({ player: p, procedures: sortSteps(byPlayer.get(p.key) || []) }));

    if (loose.length > 0) {
        // Shows what the widget actually received, to understand why the link was not recognised
        const show = v => { try { return JSON.stringify(v); } catch (e) { return String(v); } };
        const diagnostic = "Valeurs reçues (1re ligne) : « " + SLOTS.player + " » = " + show(loose[0][SLOTS.player]) +
            ", « " + SLOTS.holder + " » = " + show(loose[0][SLOTS.holder]) + " ; rattachements lus : " +
            players.map(p => p.key + "=" + p.name).join(", ");
        console.warn(loose.length + " procédure(s) sans rattachement valide. " + diagnostic, loose.map(r => r.id));
        groups.push({
            player: { id: 0, key: "none", kind: "none", name: "Sans rattachement", description: "", role: [], country: [] },
            procedures: sortSteps(loose),
            diagnostic: diagnostic
        });
    }
    return groups;
}


// =====================================================
// PDF viewer (one overlay, created on first use and kept
// in <body>, so re-rendering the cards never destroys it)
// =====================================================
let viewer = null;
let currentBlobUrl = null;
let viewRequest = 0;   // guards against out-of-order async results

// Attachments cell (decoded by onRecords) -> array of attachment ids
function attachmentIds(record) {
    const value = record[SLOTS.attachment];
    return Array.isArray(value) ? value.filter(x => typeof x === "number") : [];
}
function hasAttachment(record) {
    return attachmentIds(record).length > 0;
}

function releaseBlob() {
    if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
    }
}

function closeViewer() {
    viewRequest++;                       // cancel any pending load
    if (!viewer) return;
    viewer.overlay.hidden = true;
    viewer.frame.src = "about:blank";
    releaseBlob();
}

function ensureViewer() {
    if (viewer) return viewer;

    const overlay = el("div", "pdf-overlay");
    overlay.hidden = true;

    const panel = el("div", "pdf-panel");
    const bar = el("div", "pdf-bar");
    const title = el("div", "pdf-title");
    const actions = el("div", "pdf-actions");
    const closeButton = el("button", "pdf-close", "Fermer");
    closeButton.type = "button";
    const status = el("div", "pdf-status");
    const frame = document.createElement("iframe");
    frame.className = "pdf-frame";
    frame.title = "Pièce jointe PDF";

    bar.appendChild(title);
    bar.appendChild(actions);
    bar.appendChild(closeButton);
    panel.appendChild(bar);
    panel.appendChild(status);
    panel.appendChild(frame);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    closeButton.addEventListener("click", closeViewer);
    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) closeViewer();   // click on the backdrop
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeViewer();
    });

    viewer = { overlay, title, actions, status, frame };
    return viewer;
}

function addViewerLink(v, label, href) {
    const link = el("a", "pdf-link", label);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    v.actions.appendChild(link);
}

// Opens attachment number `index` (default: the first one) of a procedure
async function openPdf(record, index) {
    const ids = attachmentIds(record);
    if (ids.length === 0) return;
    const i = (index == null || index < 0 || index >= ids.length) ? 0 : index;

    const myRequest = ++viewRequest;
    const v = ensureViewer();

    releaseBlob();
    v.title.textContent = (record[SLOTS.title] || "Pièce jointe") +
        (ids.length > 1 ? " (" + (i + 1) + "/" + ids.length + ")" : "");
    v.actions.replaceChildren();
    if (ids.length > 1) {
        ids.forEach(function (_, n) {
            const b = el("button", n === i ? "current" : "", "PDF " + (n + 1));
            b.type = "button";
            b.addEventListener("click", function () { openPdf(record, n); });
            v.actions.appendChild(b);
        });
    }
    v.status.textContent = "Chargement du PDF…";
    v.status.hidden = false;
    v.frame.src = "about:blank";
    v.overlay.hidden = false;

    let directUrl = null;

    try {
        // A fresh token on every click: tokens expire, so never reuse an old one
        const tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
        directUrl = `${tokenInfo.baseUrl}/attachments/${ids[i]}/download?auth=${tokenInfo.token}`;

        const response = await fetch(directUrl);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.arrayBuffer();

        if (myRequest !== viewRequest) return;   // closed or replaced meanwhile

        // Grist serves attachments with a restrictive "sandbox" security header,
        // which can stop the browser's PDF viewer. A local blob URL has no such header.
        currentBlobUrl = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
        v.frame.src = currentBlobUrl;
        v.status.hidden = true;
        addViewerLink(v, "Ouvrir dans un onglet", currentBlobUrl);

    } catch (err) {
        if (myRequest !== viewRequest) return;
        console.error("Could not load the PDF:", err);
        v.status.textContent = "Impossible d'afficher le PDF ici.";
    }

    // Always offer a plain download link (needs no fetch, so no CORS involved)
    if (directUrl && myRequest === viewRequest) {
        addViewerLink(v, "Télécharger", directUrl);
    }
}


// =====================================================
// Description note: a floating card opened with the ⓘ button of a procedure. It stays open
// (read it, select and copy its text) until its cross is clicked, Escape is pressed, or ⓘ is
// clicked again; the header can be dragged. Only one note at a time.
// =====================================================
let note = null;   // { box, title, meta, body, recordId, anchor } once created

function ensureNote() {
    if (note) return note;
    const box = el("div", "note-pop");
    box.hidden = true;
    box.setAttribute("role", "dialog");
    const head = el("div", "note-head");
    const titles = el("div", "note-title");
    const title = el("div", "");
    const meta = el("div", "note-meta");
    titles.append(title, meta);
    const close = el("button", "note-close", "✕");
    close.type = "button";
    close.title = "Fermer (Échap)";
    close.setAttribute("aria-label", "Fermer la description");
    head.append(titles, close);
    const body = el("div", "note-body");
    box.append(head, body);
    document.body.appendChild(box);

    close.addEventListener("click", closeNote);
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeNote(); });

    // Drag by the header (the cross keeps working)
    let drag = null;
    head.addEventListener("pointerdown", function (event) {
        if (event.target === close) return;
        const r = box.getBoundingClientRect();
        drag = { dx: event.clientX - r.left, dy: event.clientY - r.top };
        head.setPointerCapture(event.pointerId);
    });
    head.addEventListener("pointermove", function (event) {
        if (!drag) return;
        const r = box.getBoundingClientRect();
        box.style.left = Math.max(0, Math.min(event.clientX - drag.dx, window.innerWidth - r.width)) + "px";
        box.style.top = Math.max(0, Math.min(event.clientY - drag.dy, window.innerHeight - 40)) + "px";
    });
    head.addEventListener("pointerup", function () { drag = null; });

    note = { box, title, meta, body, recordId: null, anchor: null };
    return note;
}

function closeNote() {
    if (!note) return;
    note.box.hidden = true;
    note.recordId = null;
    note.anchor = null;
    document.querySelectorAll(".proc-info.active").forEach(b => b.classList.remove("active"));
}

// Puts the procedure into the note (title, dates, description rendered as Markdown)
async function fillNote(record) {
    const n = ensureNote();
    n.title.textContent = record[SLOTS.title] || "(sans titre)";
    const bits = [procedureDate(record)];
    if (procedureState(record) === "done") bits.push("terminé");
    if (procedureState(record) === "doing") bits.push("en cours");
    n.meta.textContent = bits.filter(Boolean).join(" · ");
    n.meta.hidden = !n.meta.textContent;
    const text = String(record[SLOTS.description] || "");
    const description = el("div", "player-desc");
    const md = text ? await loadMarkdown() : null;
    if (n.recordId !== record.id) return;   // closed or replaced meanwhile
    fillDescription(description, text, md);
    n.body.replaceChildren(description);
}

// Places the note beside the list, over the right pane, at the height of the ⓘ button: the other ⓘ
// buttons of the cards stay reachable. In a narrow (single column) layout it goes under the button.
function placeNote(anchor) {
    const n = ensureNote();
    const r = anchor.getBoundingClientRect();
    const w = n.box.offsetWidth, h = n.box.offsetHeight;
    const pane = document.querySelector(".pane-detail");
    const p = pane ? pane.getBoundingClientRect() : null;
    let left, top;
    if (p && p.left > r.right + 20) {
        left = p.left + 8;
        top = r.top - 10;
    } else {
        left = r.left;
        top = r.bottom + 6;
        if (top + h > window.innerHeight - 8) top = r.top - h - 6;
    }
    left = Math.max(0, Math.min(left, window.innerWidth - w - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    n.box.style.left = left + "px";
    n.box.style.top = top + "px";
}

async function toggleNote(record, anchor) {
    const n = ensureNote();
    if (!n.box.hidden && n.recordId === record.id) { closeNote(); return; }
    document.querySelectorAll(".proc-info.active").forEach(b => b.classList.remove("active"));
    n.recordId = record.id;
    n.anchor = anchor;
    anchor.classList.add("active");
    // The card colour follows the player of the procedure
    const player = playerOfRecord(record);
    ["--card-accent", "--card-ink"].forEach(p => n.box.style.removeProperty(p));
    const colors = entityColors(player);
    if (colors) {
        n.box.style.setProperty("--card-accent", colors.accent);
        n.box.style.setProperty("--card-ink", colors.ink);
    }
    n.box.hidden = false;
    await fillNote(record);
    if (n.recordId === record.id) placeNote(anchor);
}

// After the cards are redrawn: keep the note open with fresh content, or close it if the row is gone
function refreshNote(groups) {
    if (!note || note.box.hidden || note.recordId === null) return;
    let found = null;
    for (const g of groups) for (const r of g.procedures) if (r.id === note.recordId) found = r;
    if (!found || !String(found[SLOTS.description] || "").trim()) { closeNote(); return; }
    fillNote(found);
    const again = document.querySelector('.proc-info[data-record-id="' + found.id + '"]');
    if (again) again.classList.add("active");
}


// =====================================================
// Cards (left pane)
// =====================================================
function badges(values, className) {
    const box = el("div", "badges");
    values.forEach(v => {
        const b = el("span", "badge " + className, v);
        if (className === "role") paintRole(b, v);      // each role badge in its own blue
        box.appendChild(b);
    });
    return box;
}

// Normalised text of a procedure's statut ("Terminé " -> "termine"); "" when empty or not mapped
function statusText(record) {
    let value = record ? record[SLOTS.status] : null;
    if (Array.isArray(value)) value = value.filter(x => x !== "L").join(" ");
    if (value === null || value === undefined) return "";
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
// "done" | "doing" | "" (no mark)
function procedureState(record) {
    const text = statusText(record);
    if (STATUS_DONE.includes(text)) return "done";
    if (STATUS_DOING.includes(text)) return "doing";
    return "";
}
// True as soon as one procedure has a statut: only then is the mark column reserved
let statusInUse = false;

function buildProcedureItem(record) {
    const li = document.createElement("li");
    const state = procedureState(record);
    if (state) li.classList.add(state);
    if (statusInUse) li.appendChild(el("span", "proc-mark", state === "done" ? "✓" : (state === "doing" ? "→" : "")));

    const text = el("span", "proc-text");
    const label = record[SLOTS.title] || "(sans titre)";
    if (hasAttachment(record)) {
        const button = el("button", "proc-link", label);
        button.type = "button";
        button.title = "Afficher la pièce jointe";
        button.addEventListener("click", function () { openPdf(record); });
        text.appendChild(button);
    } else {
        text.appendChild(el("span", "proc-title", label));
    }
    const date = procedureDate(record);
    if (date) text.appendChild(el("span", "proc-date", "· " + date));
    const description = record[SLOTS.description];
    if (description && String(description).trim()) {
        const info = el("button", "proc-info", "ⓘ");
        info.type = "button";
        info.title = "Afficher la description";
        info.setAttribute("aria-label", "Afficher la description de la procédure");
        info.dataset.recordId = String(record.id);
        info.addEventListener("click", function (event) {
            event.stopPropagation();   // does not select the card / move the cursor
            toggleNote(record, info);
        });
        if (note && note.recordId === record.id) info.classList.add("active");
        text.appendChild(info);
    }
    li.appendChild(text);
    return li;
}

// One card per player: { player, procedures } (see buildGroups)
function buildPlayerCard(group) {
    const player = group.player;
    const card = el("div", "player-card");
    paintEntity(card, player);

    card.appendChild(el("div", "player-name", player.name || "(sans nom)"));
    if (player.role.length) card.appendChild(badges(player.role, "role"));
    if (player.kind === "holder") card.appendChild(badges([HOLDERS.badge], "role"));

    if (group.procedures.length > 0) {
        const list = el("ul", statusInUse ? "proc-list tracked" : "proc-list");
        group.procedures.forEach(r => list.appendChild(buildProcedureItem(r)));
        card.appendChild(list);
    } else {
        card.appendChild(el("div", "proc-empty", "Aucune procédure"));
    }

    if (player.country.length) card.appendChild(badges(player.country, "country"));
    if (group.diagnostic) card.appendChild(el("div", "proc-diagnostic", group.diagnostic));

    // Clicking the card selects this player: the description pane follows at once, and the real Grist
    // cursor is moved too (first procedure), so a widget linked by "Select By" follows as well.
    card.addEventListener("click", function () {
        selectPlayer(group);
        // Re-read AdminPlayers so that a recent edit of the description shows up
        loadPlayers().then(renderDetail);
    });
    return card;
}


// =====================================================
// Layout: the cards stay in #players (left pane); the description card of the selected player is
// built in the right pane. Created here, so admin.html does not need to change.
// =====================================================
let detailBody = null;   // the part of the right pane that is re-rendered

function ensureLayout() {
    if (detailBody) return detailBody;
    const host = document.getElementById("players");
    const wrapper = el("div", "master-detail");
    const listPane = el("div", "pane pane-list");
    const detailPane = el("div", "pane pane-detail");
    detailBody = el("div", "player-detail-host");
    detailPane.appendChild(detailBody);
    host.parentNode.insertBefore(wrapper, host);
    listPane.appendChild(host);
    wrapper.appendChild(listPane);
    wrapper.appendChild(detailPane);
    return detailBody;
}

// =====================================================
// Markdown rendering of AdminPlayers.Description
// The text comes from the Grist document, and this widget has FULL access, so rendering
// must never be able to run code. Three layers:
//  1. markdown-it with html:false (raw HTML in the text is escaped, javascript: links refused);
//  2. the result is parsed in an inert document and REBUILT with DOM calls from an allow-list
//     of tags (no innerHTML on the page, no images, no attributes except a validated href);
//  3. if the library is missing, the plain text is shown (line breaks kept by CSS).
// Same code as dashboard.js (links, lists, foldable <details> blocks...).
// =====================================================
const MARKDOWN_FILE = "markdown-it.min.js";   // markdown-it 14.1.0 (MIT), next to admin.js

let markdownPromise = null;
function loadMarkdown() {
    if (markdownPromise) return markdownPromise;
    markdownPromise = new Promise(function (resolve) {
        function ready() {
            // breaks:true keeps old plain-text descriptions readable (a newline stays a line break)
            resolve(window.markdownit
                ? window.markdownit({ html: false, breaks: true, linkify: true })
                : null);
        }
        if (window.markdownit) return ready();
        const script = document.createElement("script");
        script.src = new URL(MARKDOWN_FILE, SCRIPT_URL).href;
        script.onload = ready;
        script.onerror = function () {
            console.warn(MARKDOWN_FILE + " not found next to admin.js: descriptions shown as plain text.");
            resolve(null);
        };
        document.head.appendChild(script);
    });
    return markdownPromise;
}

const MD_TAGS = new Set([
    "P", "BR", "STRONG", "EM", "B", "I", "DEL", "S", "CODE", "PRE", "BLOCKQUOTE", "HR",
    "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "A",
    "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"
]);
const MD_DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "IMG", "SVG", "MATH", "FORM", "INPUT", "TEXTAREA", "SELECT", "BUTTON", "LINK", "META", "BASE"]);

function safeHref(href) {
    return /^(https?:|mailto:)/i.test(String(href || "").trim()) ? String(href).trim() : null;
}

// Rebuilds a clean copy of the parsed markdown output: only allowed tags, no attributes
// except a checked href on links. Disallowed tags are unwrapped (their text is kept),
// dangerous ones are dropped with their content.
function cleanNode(source, target) {
    for (const child of Array.from(source.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            target.appendChild(document.createTextNode(child.textContent));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName.toUpperCase();
            if (MD_DROP.has(tag)) continue;
            if (!MD_TAGS.has(tag)) { cleanNode(child, target); continue; }   // unwrap
            const copy = document.createElement(tag.toLowerCase());
            if (tag === "A") {
                const href = safeHref(child.getAttribute("href"));
                if (!href) { cleanNode(child, target); continue; }           // unsafe link -> plain text
                copy.setAttribute("href", href);
                copy.setAttribute("target", "_blank");
                copy.setAttribute("rel", "noopener noreferrer");
            }
            cleanNode(child, copy);
            target.appendChild(copy);
        }
    }
}

// ---- Foldable blocks -------------------------------------------------------------
// A description may contain blocks that the reader can fold / unfold:
//
//     <details><summary>Recruitment</summary>
//     - first point
//     - second point
//     </details>
//
// (also accepted: <details open> for a block shown unfolded, <summary> on the line after
// <details>, nested blocks, Markdown inside the block, any indentation).
// Only these LINES are recognised. The widget does NOT switch markdown-it to html:true: the
// block is rebuilt here with createElement, and the title and the content still go through
// markdown-it (html:false) and the allow-list above, so no HTML typed in a description is
// ever interpreted. A <details> without its </details>, or inside a ``` code fence, stays plain text.
const DETAILS_OPEN = /^\s*<details(\s+open)?\s*>\s*(?:<summary>(.*?)<\/summary>\s*)?$/i;
const DETAILS_CLOSE = /^\s*<\/details>\s*$/i;
const SUMMARY_LINE = /^\s*<summary>(.*?)<\/summary>\s*$/i;
const CODE_FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const DETAILS_MAX_DEPTH = 5;

// Plain markdown (no foldable block) appended to `target`
function appendMarkdown(target, text, md) {
    const parsed = new DOMParser().parseFromString(md.render(text), "text/html");
    cleanNode(parsed.body, target);
}

// Removes the indentation shared by all non-empty lines
function dedent(lines) {
    let min = Infinity;
    for (const line of lines) {
        if (line.trim() === "") continue;
        min = Math.min(min, /^[ \t]*/.exec(line)[0].length);
    }
    if (!Number.isFinite(min) || min === 0) return lines;
    return lines.map(line => line.slice(Math.min(min, /^[ \t]*/.exec(line)[0].length)));
}

// Index of the </details> line closing the block opened at lines[start], or -1
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

// Markdown with foldable blocks appended to `target`
function appendRichText(target, text, md, depth) {
    const lines = String(text).split(/\r?\n/);
    let plain = [];
    let fence = null;
    const flush = function () {
        if (plain.length > 0) appendMarkdown(target, plain.join("\n"), md);
        plain = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const f = CODE_FENCE.exec(line);
        if (fence) {
            if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
            plain.push(line);
            continue;
        }
        if (f) { fence = f[1]; plain.push(line); continue; }

        const open = depth < DETAILS_MAX_DEPTH ? DETAILS_OPEN.exec(line) : null;
        const end = open ? findDetailsEnd(lines, i) : -1;
        if (!open || end === -1) { plain.push(line); continue; }

        // Block found: lines i+1 .. end-1 are its content
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

        const content = el("div", "md-details-body");
        appendRichText(content, dedent(body).join("\n"), md, depth + 1);
        details.appendChild(content);

        target.appendChild(details);
        i = end;
    }
    flush();
}

// Puts the description into `node`: rendered markdown, or plain text as a fallback
function fillDescription(node, text, md) {
    if (!md) { node.textContent = text; return; }
    try {
        const clean = document.createDocumentFragment();
        appendRichText(clean, text, md, 0);
        node.classList.add("md");
        node.replaceChildren(clean);
    } catch (err) {
        console.error("Markdown rendering failed:", err);
        node.classList.remove("md");
        node.textContent = text;
    }
}


// =====================================================
// Description card (right pane) for the selected player
// =====================================================
let detailRequest = 0;   // guards against out-of-order async results

async function renderDetail() {
    const host = ensureLayout();
    const myRequest = ++detailRequest;

    if (playersError) {
        host.replaceChildren(el(
            "div", "empty-state",
            "Impossible de lire les tables (accès complet requis ? identifiants de table ?) : " + playersError
        ));
        return;
    }

    const card = currentCard();
    if (!card) {
        host.replaceChildren(el("div", "empty-state", "Sélectionnez un acteur dans la liste."));
        return;
    }

    // The group's player, with the freshest description (players are re-read on a click)
    const player = playersByKey.get(card.group.player.key) || card.group.player;

    // Markdown library (loaded once, only when a description has to be shown)
    let md = null;
    if (player.description) {
        md = await loadMarkdown();
        if (myRequest !== detailRequest) return;   // a newer render has started
    }

    const box = el("div", "player-detail");
    paintEntity(box, player);
    box.appendChild(el("h2", "", player.name || "(sans nom)"));
    if (player.kind === "holder") { box.appendChild(el("div", "label", "Type")); box.appendChild(badges([HOLDERS.badge], "role")); }
    if (player.role.length) { box.appendChild(el("div", "label", "Rôle")); box.appendChild(badges(player.role, "role")); }
    if (player.country.length) { box.appendChild(el("div", "label", "Pays")); box.appendChild(badges(player.country, "country")); }
    box.appendChild(el("div", "label", "Description"));
    if (player.description) {
        const description = el("div", "player-desc");
        fillDescription(description, player.description, md);
        box.appendChild(description);
    } else {
        box.appendChild(el("div", "empty-state", "Pas de description."));
    }
    box.appendChild(el("div", "version-stamp", "admin.js " + VERSION));
    host.replaceChildren(box);
}


// =====================================================
// Selection = the player picked by clicking its card, or else the player holding the Grist cursor
// row (onRecord), e.g. when a procedure is clicked in a linked widget.
// It drives both the highlight of the card and the description card.
// =====================================================
let cursorId = null;         // row id of the Procedures row holding the Grist cursor
let pickedPlayer = null;     // key of the player / holder chosen by clicking a card (works without procedures too)
let renderedCards = [];      // [{ node, group, playerKey, ids: Set of the procedure row ids of that card }]

function currentCard() {
    if (pickedPlayer !== null) {
        const picked = renderedCards.find(c => c.playerKey === pickedPlayer);
        if (picked) return picked;
    }
    return renderedCards.find(c => c.ids.has(cursorId)) || renderedCards[0] || null;
}

function updateSelection() {
    const current = currentCard();
    for (const card of renderedCards) {
        card.node.classList.toggle("selected", card === current);
    }
    renderDetail();
}

function selectPlayer(group) {
    pickedPlayer = group.player.key;
    updateSelection();
    // The real Grist cursor follows (first procedure), so a widget linked by "Select By" follows too
    if (group.procedures.length > 0) grist.setCursorPos({ rowId: group.procedures[0].id });
}

grist.onRecord(function (record) {
    cursorId = record ? record.id : null;
    pickedPlayer = null;   // the cursor moved elsewhere: it takes over
    updateSelection();
});


let renderRequest = 0;   // guards against out-of-order async updates

grist.onRecords(async function (records) {

    const myRequest = ++renderRequest;
    const container = document.getElementById("players");
    ensureLayout();

    records = records || [];   // players are shown even when no procedure is visible

    // Apply the column mapping chosen in the creator panel: rows come in with the REAL column ids
    // (e.g. "adminPLayer") and are renamed to the slot names used below (e.g. "adminPlayer").
    // null = a required slot is not mapped yet.
    if (records.length > 0) {
        const mapped = grist.mapColumnNames(records);
        if (!mapped) {
            renderedCards = [];
            container.replaceChildren(el(
                "div", "empty-state",
                "Associez les colonnes du widget dans le panneau de création (titre, etape, et adminPlayer et/ou dataHolder)."
            ));
            updateSelection();
            return;
        }
        records = mapped;
    }

    statusInUse = records.some(r => statusText(r) !== "");

    // AdminPlayers is read BEFORE touching the DOM (names, badges, colours), so
    // overlapping updates cannot interleave and duplicate cards
    await loadPlayers();
    if (myRequest !== renderRequest) return;   // a newer update has arrived

    if (playersError) {
        renderedCards = [];
        container.replaceChildren(el(
            "div", "fatal-error",
            "Impossible de lire les tables (accès complet requis ? identifiants de table ?) : " + playersError
        ));
        updateSelection();
        return;
    }

    const groups = buildGroups(records);

    if (groups.length === 0) {
        renderedCards = [];
        container.replaceChildren(el("div", "empty-state", "Aucun acteur à afficher."));
        updateSelection();
        return;
    }

    const fragment = document.createDocumentFragment();
    const cards = [];

    for (const group of groups) {
        const node = buildPlayerCard(group);
        const ids = new Set(group.procedures.map(r => r.id));
        cards.push({ node, group, playerKey: group.player.key, ids });
        fragment.appendChild(node);
    }
    renderedCards = cards;

    // A table that could not be read (while the other one can) is reported above the cards
    tableWarnings.forEach(w => fragment.insertBefore(el("div", "fatal-error", "Table illisible : " + w), fragment.firstChild));
    container.replaceChildren(fragment);
    updateSelection();
    refreshNote(groups);
}, { expandRefs: false });   // adminPlayer / dataHolder arrive as row ids, not as display text
