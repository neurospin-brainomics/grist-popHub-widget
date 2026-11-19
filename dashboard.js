// =====================================================
// Dashboard widget, data model "Campaigns + Tasks".
// The widget is bound to the Tasks table: every task points to its campaign (campagne) and has a
// step number (etape). The campaigns themselves and the resources are read directly from their
// tables (see CAMPAIGNS and RESOURCES below), not through mapped slots.
// Slot names = real column names of Tasks (mapped in the creator panel).
// =====================================================
const SLOTS = {
    title: "titre",            // titre: text shown for each step
    campaign: "campagne",      // campagne: Reference to the Campaigns table
    step: "etape",             // etape: number of the step inside its campaign (1, 2, 3...)
    dueDate: "dateEcheance",   // dateEcheance (optional)
    attachment: "piecejointe", // piecejointe: Attachments column holding the PDF (optional)
    status: "statut"           // statut: progress of a task (see STATUS_DONE / STATUS_DOING below).
                               // Optional: no progress bar is shown until some statut is filled in.
};

// Values of the statut column, compared without case or accents ("Terminé" = "termine").
// Anything else (empty, "À faire", "todo"...) counts as "not started".
const STATUS_DONE = ["done", "termine", "terminee", "fait", "faite", "complete", "completed",
                     "clos", "close", "closed", "cloture", "fini", "finie", "finished", "ok", "oui", "yes"];
const STATUS_DOING = ["en cours", "encours", "in progress", "doing", "wip", "started", "demarre", "commence"];

// Card colours by Resources.Category (compared without case: "Imaging-Genetics" = "imaging-genetics").
//   bg = card tint, accent = left edge / progress bar / selection, ink = dark text of the badge.
// A category not listed here, or a resource without category, gets CATEGORY_DEFAULT (neutral).
const CATEGORY_COLORS = {
    "genetics":         { bg: "#FFECDF", accent: "#E0541B", ink: "#85290A" },   // orange
    "imaging":          { bg: "#FFF4C9", accent: "#DFA100", ink: "#6B4A00" },   // gold
    "imaging-genetics": { bg: "#FCE3E8", accent: "#B8173F", ink: "#7E0F2B" },   // raspberry red
    "dataset":          { bg: "#F3E9DB", accent: "#94673A", ink: "#573A1B" },   // brown
    "software":         { bg: "#F6E2EE", accent: "#A3407E", ink: "#69204F" }    // plum
};
const CATEGORY_DEFAULT = { bg: "#FFFFFF", accent: "#C9C3BA", ink: "#555555" };

function categoryColors(category) {
    const key = String(category || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    return CATEGORY_COLORS[key] || CATEGORY_DEFAULT;
}

// The Resources table is read directly by this widget (docApi.fetchTable), NOT through
// a mapped slot: use the real Grist table id and column ids (case does not matter).
const RESOURCES = {
    table: "Resources",
    name: "Name",
    category: "Category",
    description: "Description",
    owner: "Owner",
    provider: "Provider",
    attachment: "PieceJointe"
};

// The Campaigns table, read the same way (docApi.fetchTable). Column ids, case does not matter.
const CAMPAIGNS = {
    table: "Campaigns",
    name: "Name",              // campaign title, e.g. "2018 Campaign"
    resource: "Resource",      // Reference to Resources
    description: "Description",
    start: "Start",
    due: "Due"                 // optional: otherwise the latest dateEcheance of its steps is shown
};

grist.ready({
    columns: [
        SLOTS.title,
        SLOTS.campaign,
        SLOTS.step,
        { name: SLOTS.dueDate, optional: true },
        { name: SLOTS.attachment, optional: true },
        { name: SLOTS.status, optional: true }
    ],
    // "full" is required to read OTHER tables (Campaigns, Resources) with docApi.fetchTable.
    // The widget only reads: it never writes to the document.
    requiredAccess: "full",
    allowSelectBy: true    // lets other widgets of the page be linked to this one
});


function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

// Shown in the detail panel and in the console: tells at a glance which dashboard.js is running
// (a browser can keep serving an old copy for a while after a new push to GitHub Pages).
const VERSION = window.APP_VERSION || "dev";
console.log("dashboard.js " + VERSION + " (modèle Campaigns + Tasks : cartes par campagne, panneau Ressources, Markdown, avancement)");

// Where this script was loaded from: markdown-it.min.js is expected right next to it
const SCRIPT_URL = document.currentScript ? document.currentScript.src : location.href;

// Layout styles travel with the script, so the panel works even if style.css is old,
// cached or not updated. Rules in style.css with the same selectors are harmless.
(function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
:root { --pane-list-bg: #e6ecf3; --pane-detail-bg: #e4e0ee; }   /* overridden by themes.js */
body { background: var(--page-bg, #f5f6f8); }
h1 { color: var(--theme-title, inherit); }
.master-detail { display: grid; grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
                 gap: 16px; align-items: stretch; }
.pane { border-radius: 14px; padding: 16px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.05); }
.pane-list { background: var(--pane-list-bg); }
.pane-detail { background: var(--pane-detail-bg); }
.master-detail #resources { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.resource-detail { position: sticky; top: 12px; background: #fff; border-radius: 10px;
                   padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
                   max-height: calc(100vh - 24px); overflow: auto; }
.resource-detail .resource-description { white-space: pre-line; }
.resource-detail .resource-description.md { white-space: normal; }
.resource-description.md > :first-child { margin-top: 0; }
.resource-description.md > :last-child { margin-bottom: 0; }
.resource-description.md p { margin: 8px 0; }
.resource-description.md h1, .resource-description.md h2, .resource-description.md h3,
.resource-description.md h4, .resource-description.md h5, .resource-description.md h6
    { font-size: 15px; margin: 14px 0 6px; }
.resource-description.md ul, .resource-description.md ol { margin: 8px 0; padding-left: 22px; }
.resource-description.md blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #ddd; color: #666; }
.resource-description.md code { background: #f0f2f5; padding: 1px 4px; border-radius: 4px; font-size: 90%; }
.resource-description.md pre { background: #f0f2f5; padding: 10px; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
.resource-description.md pre code { background: none; padding: 0; }
.resource-description.md table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.resource-description.md th, .resource-description.md td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
.resource-description.md a { color: #2f6fdb; }
.md-details { margin: 8px 0; border: 1px solid rgba(0,0,0,.12); border-radius: 6px; background: rgba(255,255,255,.55); }
.md-details > summary { cursor: pointer; padding: 6px 10px; font-weight: 600; }
.md-details > summary:hover { background: rgba(0,0,0,.04); }
.md-details[open] > summary { border-bottom: 1px solid rgba(0,0,0,.12); }
.md-details-body { padding: 2px 12px 6px; }
.resource-detail .version-stamp { margin-top: 14px; font-size: 11px; color: #999; }
.resource-card, .resource-detail { background: var(--card-bg, #fff); border-left: 6px solid var(--card-accent, #c9c3ba); }
.resource-card.selected { outline: 2px solid var(--card-accent, #2f6fdb); }
.resource-titles { min-width: 0; }
.resource-subtitle { margin-top: 2px; font-size: 14px; color: #5b5750; }
.resource-card .resource-category, .resource-detail .resource-category {
    background: #fff; color: var(--card-ink, #333);
    border: 1px solid var(--card-accent, #c9c3ba); font-weight: 600; }
.empty-state { color: #666; font-style: italic; }
.chunk-list.tracked { list-style: none; padding-left: 0; }
.chunk-list.tracked li { display: flex; gap: 6px; margin-top: 3px; }
.chunk-list li.done, .chunk-list li.done .task-link { color: #8a8f98; }
.chunk-list li.next { color: #1f2328; font-weight: 600; }
.task-mark { flex: 0 0 14px; text-align: center; }
.task-date { color: #8a8f98; font-size: 12px; margin-left: 6px; white-space: nowrap; }
.overdue, .task-date.overdue { color: #b3261e; font-weight: 600; }
.progress { margin-top: 12px; }
.progress-track { height: 6px; border-radius: 3px; background: rgba(0,0,0,.08); overflow: hidden; }
.progress-fill { height: 100%; background: var(--card-accent, #2f6fdb); }
.progress.complete .progress-fill { background: #2f9e6b; }
.progress-label { margin-top: 4px; font-size: 12px; color: #666; }
.next-step { margin-top: 8px; font-size: 13px; color: #444; }
.open-record { margin-top: 14px; }
.fatal-error { margin: 12px 0; padding: 10px 14px; border-radius: 8px;
               background: #fdecea; color: #8a1c13; font-size: 13px; }
@media (max-width: 760px) {
  .master-detail { grid-template-columns: 1fr; }
  .resource-detail { position: static; }
}`;
    document.head.appendChild(style);
})();

// Any uncaught error is also shown on the page (not only in the console)
function showFatal(message) {
    console.error("dashboard.js " + VERSION + ":", message);
    document.body.appendChild(el("div", "fatal-error", "Erreur du widget (" + VERSION + ") : " + message));
}
window.addEventListener("error", function (event) { showFatal(event.message); });
window.addEventListener("unhandledrejection", function (event) {
    showFatal(String((event.reason && event.reason.message) || event.reason));
});

// =====================================================
// Resources table (read directly, cached in memory)
// =====================================================
let resourcesById = new Map();    // row id -> resource
let resourcesByName = new Map();  // lower-case Name -> resource (fallback only)
let resourcesError = null;        // message shown in the detail panel if the read failed

// Actual key of a column in a fetched table, ignoring case ("name" finds "Name")
function columnKey(data, wanted) {
    const target = String(wanted).toLowerCase();
    return Object.keys(data).find(k => k.toLowerCase() === target) || null;
}

// docApi.fetchTable returns RAW cell values (it is not decoded like onRecords is):
// an Attachments cell looks like ["L", 12, 13] (or null when empty).
function attachmentIds(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(x => typeof x === "number");
}

async function loadResources() {
    try {
        const data = await grist.docApi.fetchTable(RESOURCES.table);
        const keys = {};
        for (const field of Object.keys(RESOURCES)) {
            if (field !== "table") keys[field] = columnKey(data, RESOURCES[field]);
        }
        if (!data.id || !keys.name) {
            throw new Error("colonne '" + RESOURCES.name + "' introuvable dans '" + RESOURCES.table + "'");
        }

        const byId = new Map();
        const byName = new Map();
        for (let i = 0; i < data.id.length; i++) {
            const get = field => (keys[field] ? data[keys[field]][i] : undefined);
            const resource = {
                id: data.id[i],
                name: get("name") == null ? "" : String(get("name")),
                category: get("category") == null ? "" : String(get("category")),
                description: get("description") == null ? "" : String(get("description")),
                owner: get("owner") == null ? "" : String(get("owner")),
                provider: get("provider") == null ? "" : String(get("provider")),
                attachments: attachmentIds(get("attachment"))
            };
            byId.set(resource.id, resource);
            if (resource.name) byName.set(resource.name.toLowerCase(), resource);
        }
        resourcesById = byId;
        resourcesByName = byName;
        resourcesError = null;
    } catch (err) {
        console.error("Could not read the Resources table:", err);
        resourcesError = String((err && err.message) || err);
    }
}

// Row id of a referenced row. Depending on the options, a Reference cell arrives
// as a number, as a Reference object ({ tableId, rowId }) or as its display text.
function referenceRowId(value) {
    const raw = (value !== null && typeof value === "object") ? value.rowId : value;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : 0;
}

// The Resources row a campaign points to, through Campaigns.Resource
function resourceOf(group) {
    const campaign = group ? group.campaign : null;
    return campaign ? (resourcesById.get(campaign.resourceId) || null) : null;
}

// =====================================================
// Campaigns table (read directly, same way as Resources)
// =====================================================
let campaigns = [];                // campaigns in the order of the table
let campaignsById = new Map();     // row id -> campaign
let campaignsError = null;         // message shown instead of the cards if the read failed

async function loadCampaigns() {
    try {
        const data = await grist.docApi.fetchTable(CAMPAIGNS.table);
        const keys = {};
        for (const field of Object.keys(CAMPAIGNS)) {
            if (field !== "table") keys[field] = columnKey(data, CAMPAIGNS[field]);
        }
        if (!data.id || !keys.name) {
            throw new Error("colonne '" + CAMPAIGNS.name + "' introuvable dans '" + CAMPAIGNS.table + "'");
        }
        const orderKey = columnKey(data, "manualSort");

        const list = [];
        for (let i = 0; i < data.id.length; i++) {
            const get = field => (keys[field] ? data[keys[field]][i] : undefined);
            list.push({
                id: data.id[i],
                name: get("name") == null ? "" : String(get("name")),
                resourceId: referenceRowId(get("resource")),
                description: get("description") == null ? "" : String(get("description")),
                start: get("start"),
                due: get("due"),
                order: orderKey && Number.isFinite(Number(data[orderKey][i])) ? Number(data[orderKey][i]) : i
            });
        }
        list.sort((a, b) => (a.order - b.order) || (a.id - b.id));
        campaigns = list;
        campaignsById = new Map(list.map(c => [c.id, c]));
        campaignsError = null;
    } catch (err) {
        console.error("Could not read the Campaigns table:", err);
        campaignsError = String((err && err.message) || err);
    }
}

// Both reference tables, in parallel (neither throws: errors are kept in resourcesError / campaignsError)
function loadReferences() {
    return Promise.all([loadResources(), loadCampaigns()]);
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

// A date is "late" once its day (UTC, like the Grist Date cells) is over
function isLate(value) {
    const ms = toMillis(value);
    if (isNaN(ms)) return false;
    const now = new Date();
    return ms < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Normalised text of a task's statut ("Terminé " -> "termine"); "" when empty or not mapped
function statusText(record) {
    let value = record ? record[SLOTS.status] : null;
    if (Array.isArray(value)) value = value.filter(x => x !== "L").join(" ");
    if (value === null || value === undefined) return "";
    return String(value).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

// "done" | "doing" | "todo"
function taskState(record) {
    const text = statusText(record);
    if (STATUS_DONE.includes(text)) return "done";
    if (STATUS_DOING.includes(text)) return "doing";
    return "todo";
}

// True as soon as at least one task has a statut: only then are progress bars shown,
// so that a table without statuses is not displayed as "0 done" everywhere.
let statusInUse = false;


// Group the tasks (the records of this widget) by campaign, in step order.
// One group per campaign of the Campaigns table (even without visible tasks), in the order of
// that table; tasks pointing to no campaign (or an unknown one) are gathered in a last group.
function buildGroups(records) {
    const byCampaign = new Map();
    const loose = [];
    for (const record of records) {
        const id = referenceRowId(record[SLOTS.campaign]);
        if (id && campaignsById.has(id)) {
            if (!byCampaign.has(id)) byCampaign.set(id, []);
            byCampaign.get(id).push(record);
        } else {
            loose.push(record);
        }
    }

    // Steps are sorted by etape (a step without number goes last), then by row id
    const stepOf = r => { const n = Number(r[SLOTS.step]); return Number.isFinite(n) ? n : Infinity; };
    const sortSteps = list => list.sort((a, b) => (stepOf(a) - stepOf(b)) || (a.id - b.id));

    const groups = campaigns.map(c => ({ campaign: c, tasks: sortSteps(byCampaign.get(c.id) || []) }));

    if (loose.length > 0) {
        console.warn(loose.length + " tâche(s) sans campagne valide:", loose.map(r => r.id));
        groups.push({
            campaign: { id: 0, name: "Sans campagne", resourceId: 0, description: "", start: null, due: null },
            tasks: sortSteps(loose)
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

function hasAttachment(record) {
    const value = record[SLOTS.attachment];
    return Array.isArray(value) && value.length > 0;
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

async function openPdf(task) {
    if (!hasAttachment(task)) return;

    const myRequest = ++viewRequest;
    const v = ensureViewer();

    releaseBlob();
    v.title.textContent = task[SLOTS.title] || "Pièce jointe";
    v.actions.replaceChildren();
    v.status.textContent = "Chargement du PDF…";
    v.status.hidden = false;
    v.frame.src = "about:blank";
    v.overlay.hidden = false;

    let directUrl = null;

    try {
        // A fresh token on every click: tokens expire, so never reuse an old one
        const tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
        directUrl =
            `${tokenInfo.baseUrl}/attachments/${task[SLOTS.attachment][0]}/download?auth=${tokenInfo.token}`;

        const response = await fetch(directUrl);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.arrayBuffer();

        if (myRequest !== viewRequest) return;   // closed or replaced meanwhile

        // Grist serves attachments with a restrictive "sandbox" security header,
        // which can stop the browser's PDF viewer. A local blob URL has no such header.
        currentBlobUrl = URL.createObjectURL(
            new Blob([data], { type: "application/pdf" })
        );
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

// state: "done" | "doing" | "todo" | null (null = no progress tracking);
// isNext: this is the first step not yet done
function buildTaskItem(task, state, isNext) {
    const li = document.createElement("li");
    const label = task[SLOTS.title] || "(sans titre)";

    if (state) {
        li.classList.add(state);
        if (isNext) li.classList.add("next");
        li.appendChild(el("span", "task-mark", state === "done" ? "✓" : (isNext ? "→" : "○")));
    }

    const text = el("span", "task-text");
    if (hasAttachment(task)) {
        const button = el("button", "task-link", label);
        button.type = "button";
        button.title = "Afficher la pièce jointe";
        button.addEventListener("click", function () {
            openPdf(task);
        });
        text.appendChild(button);
    } else {
        text.textContent = label;
    }

    const due = formatDate(task[SLOTS.dueDate]);
    if (due) {
        const late = state !== "done" && state !== null && isLate(task[SLOTS.dueDate]);
        text.appendChild(el("span", late ? "task-date overdue" : "task-date", "· " + due));
    }

    li.appendChild(text);
    return li;
}


// One card per campaign: { campaign, tasks } (see buildGroups)
function buildGroupCard(group) {
    const card = el("div", "resource-card");
    const campaignRow = group.campaign;

    // Header: the Resource name is the title, the campaign the subtitle,
    // and the Resource category is shown as a badge. The card is coloured by category.
    const resource = resourceOf(group);
    const resourceName = resource ? resource.name : "";
    const campaign = campaignRow.name || "(sans titre)";
    const category = resource ? resource.category : "";
    const colors = categoryColors(category);
    card.style.setProperty("--card-bg", colors.bg);
    card.style.setProperty("--card-accent", colors.accent);
    card.style.setProperty("--card-ink", colors.ink);

    const header = el("div", "resource-header");
    const titles = el("div", "resource-titles");
    titles.appendChild(el("div", "resource-name", resourceName || campaign));
    if (resourceName) titles.appendChild(el("div", "resource-subtitle", campaign));
    header.appendChild(titles);
    if (category) header.appendChild(el("div", "resource-category", category));
    card.appendChild(header);

    const tasks = group.tasks;

    // Progress (only when statuses are in use): done / total, and the first step not done yet
    const states = statusInUse ? tasks.map(taskState) : null;
    const nextIndex = states ? states.findIndex(s => s !== "done") : -1;
    const complete = !!states && tasks.length > 0 && nextIndex === -1;

    // Due date of the campaign: its own date (Campaigns.Due), otherwise the latest date found on its
    // steps (the step is named, so the reader sees where the date comes from)
    let dueValue = campaignRow.due;
    let dueFrom = "";
    if (isNaN(toMillis(dueValue))) {
        dueValue = null;
        let best = NaN;
        for (const task of tasks) {
            const ms = toMillis(task[SLOTS.dueDate]);
            if (!isNaN(ms) && (isNaN(best) || ms >= best)) {
                best = ms;
                dueValue = task[SLOTS.dueDate];
                dueFrom = task[SLOTS.title] || "";
            }
        }
    }

    // Metadata: due date and number of actions
    const meta = el("div", "resource-meta");
    const due = formatDate(dueValue);
    if (due) {
        const late = !!states && !complete && isLate(dueValue);
        const line = el("div", late ? "overdue" : null,
            "Échéance : " + due + (dueFrom ? " (" + dueFrom + ")" : "") + (late ? " · en retard" : ""));
        meta.appendChild(line);
    }
    if (!states) {
        meta.appendChild(el("div", null, tasks.length + " action" + (tasks.length > 1 ? "s" : "")));
    }
    card.appendChild(meta);

    if (states && tasks.length > 0) {
        const doneCount = states.filter(s => s === "done").length;
        const progress = el("div", complete ? "progress complete" : "progress");
        const track = el("div", "progress-track");
        const fill = el("div", "progress-fill");
        fill.style.width = Math.round(100 * doneCount / tasks.length) + "%";
        track.appendChild(fill);
        progress.appendChild(track);
        progress.appendChild(el("div", "progress-label",
            complete ? "Terminé ✓ (" + doneCount + "/" + tasks.length + ")"
                     : doneCount + "/" + tasks.length + " terminée(s)"));
        card.appendChild(progress);

        if (!complete) {
            const next = tasks[nextIndex];
            const nextDue = formatDate(next[SLOTS.dueDate]);
            const nextLate = isLate(next[SLOTS.dueDate]);
            card.appendChild(el("div", nextLate ? "next-step overdue" : "next-step",
                "Prochaine étape : " + (next[SLOTS.title] || "(sans titre)") +
                (nextDue ? " — " + nextDue : "") + (nextLate ? " · en retard" : "")));
        }
    }

    // List of the task titles, in chain order
    if (tasks.length > 0) {
        const list = el("ul", states ? "chunk-list tracked" : "chunk-list");
        tasks.forEach(function (task, i) {
            list.appendChild(buildTaskItem(task, states ? states[i] : null, i === nextIndex));
        });
        card.appendChild(list);
    }

    // Selects this campaign: the detail panel (Resources) follows at once, and the real Grist
    // cursor is moved too, so any widget linked to this one by "Select By" follows as well.
    const openButton = el("button", "open-record", "Ouvrir");
    openButton.title = "Afficher la ressource liée";
    openButton.addEventListener("click", function () {
        selectCampaign(group);
        // Re-read Campaigns and Resources so that a recent edit shows up
        loadReferences().then(renderDetail);
    });
    card.appendChild(openButton);

    return card;
}


// =====================================================
// Layout: the cards stay in #resources; a detail panel for the linked
// Resources row is added next to them. It is created here, so dashboard.html
// does not need to change.
// =====================================================
let detailBody = null;   // the part of the panel that is re-rendered

function ensureLayout() {
    if (detailBody) return detailBody;
    const cards = document.getElementById("resources");
    const wrapper = el("div", "master-detail");
    const panel = el("aside", "resource-detail");
    detailBody = el("div", "resource-detail-body");
    panel.appendChild(detailBody);
    panel.appendChild(el("div", "version-stamp", "dashboard.js " + VERSION));
    // Two sub-panels with their own background: the list of all the cards on the left,
    // the detail of the selected one on the right (colours: --pane-list-bg / --pane-detail-bg)
    const listPane = el("div", "pane pane-list");
    const detailPane = el("div", "pane pane-detail");
    cards.parentNode.insertBefore(wrapper, cards);
    listPane.appendChild(cards);
    detailPane.appendChild(panel);
    wrapper.appendChild(listPane);
    wrapper.appendChild(detailPane);
    return detailBody;
}

// =====================================================
// Markdown rendering of Resources.Description
// The text comes from the Grist document, and this widget has FULL access, so rendering
// must never be able to run code. Three layers:
//  1. markdown-it with html:false (raw HTML in the text is escaped, javascript: links refused);
//  2. the result is parsed in an inert document and REBUILT with DOM calls from an allow-list
//     of tags (no innerHTML on the page, no images, no attributes except a validated href);
//  3. if the library is missing, the plain text is shown (line breaks kept by CSS).
// =====================================================
const MARKDOWN_FILE = "markdown-it.min.js";   // markdown-it 14.1.0 (MIT), next to dashboard.js

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
            console.warn(MARKDOWN_FILE + " not found next to dashboard.js: descriptions shown as plain text.");
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

function buildResourceAttachments(resource, tokenInfo) {
    const block = el("div", "attachment");

    resource.attachments.forEach(function (attachmentId, index) {
        const url =
            `${tokenInfo.baseUrl}/attachments/${attachmentId}/download?auth=${tokenInfo.token}`;

        const image = document.createElement("img");
        image.src = url;
        image.alt = resource.name || "Pièce jointe";
        image.style.width = "100%";
        image.style.maxHeight = "180px";
        image.style.objectFit = "contain";
        image.style.display = "block";
        image.style.marginTop = "10px";

        // Not an image (PDF, docx...): replace the broken <img> by a download link
        image.addEventListener("error", function () {
            const suffix = resource.attachments.length > 1 ? " " + (index + 1) : "";
            const link = el("a", "pdf-link", "Télécharger la pièce jointe" + suffix);
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener";
            link.style.display = "block";
            link.style.marginTop = "10px";
            image.replaceWith(link);
        });

        block.appendChild(image);
    });
    return block;
}

let detailRequest = 0;   // guards against out-of-order async results

// Colours the detail panel like the cards: the tint, edge and badge of the resource's category.
// With no resource (placeholder, error, nothing linked) the neutral style is restored.
function paintPanel(resource) {
    const aside = detailBody ? detailBody.parentNode : null;
    if (!aside) return;
    const names = { "--card-bg": "bg", "--card-accent": "accent", "--card-ink": "ink" };
    const colors = resource ? categoryColors(resource.category) : null;
    for (const prop of Object.keys(names)) {
        if (colors) aside.style.setProperty(prop, colors[names[prop]]);
        else aside.style.removeProperty(prop);
    }
}

// Fills the detail panel for the group holding the cursor
async function renderDetail() {
    const panel = ensureLayout();
    const myRequest = ++detailRequest;

    const card = currentCard();
    if (!card) {
        paintPanel(null);
        panel.replaceChildren(
            el("div", "empty-state", "Cliquez sur « Ouvrir » pour afficher la ressource liée")
        );
        return;
    }

    if (resourcesError) {
        paintPanel(null);
        panel.replaceChildren(el(
            "div", "empty-state",
            "Impossible de lire la table « " + RESOURCES.table + " » " +
            "(accès complet requis ? identifiant de table ?) : " + resourcesError
        ));
        return;
    }

    const resource = resourceOf(card.group);
    if (!resource) {
        paintPanel(null);
        panel.replaceChildren(
            el("div", "empty-state", "Aucune ressource liée à ce groupe")
        );
        return;
    }

    // Token only when the resource has attachments
    let tokenInfo = null;
    if (resource.attachments.length > 0) {
        try {
            tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
        } catch (err) {
            console.error("Could not get attachment token:", err);
        }
        if (myRequest !== detailRequest) return;   // a newer render has started
    }

    // Markdown library (loaded once, only when a description has to be shown)
    let md = null;
    if (resource.description) {
        md = await loadMarkdown();
        if (myRequest !== detailRequest) return;   // a newer render has started
    }

    const content = el("div", "resource-detail-content");

    const header = el("div", "resource-header");
    header.appendChild(el("div", "resource-name", resource.name || "(sans nom)"));
    header.appendChild(el("div", "resource-category", resource.category));
    content.appendChild(header);

    if (resource.description) {
        const description = el("div", "resource-description");
        fillDescription(description, resource.description, md);
        content.appendChild(description);
    }

    const meta = el("div", "resource-meta");
    if (resource.provider) meta.appendChild(el("div", null, "Provider: " + resource.provider));
    if (resource.owner) meta.appendChild(el("div", null, "Owner: " + resource.owner));
    if (meta.children.length > 0) content.appendChild(meta);

    if (tokenInfo && resource.attachments.length > 0) {
        content.appendChild(buildResourceAttachments(resource, tokenInfo));
    }

    paintPanel(resource);
    panel.replaceChildren(content);
}


// =====================================================
// Selection = the campaign picked with its "Ouvrir" button, or else the campaign holding
// the Grist cursor row (onRecord), e.g. when a task is clicked in a linked widget.
// It drives both the highlight of the card and the detail panel.
// =====================================================
let cursorId = null;         // row id of the Tasks row holding the Grist cursor
let pickedCampaign = null;   // campaign id chosen with "Ouvrir" (works for a campaign without tasks too)
let renderedCards = [];      // [{ node, group, campaignId, ids: Set of the task row ids of that card }]

function currentCard() {
    if (pickedCampaign !== null) {
        const picked = renderedCards.find(c => c.campaignId === pickedCampaign);
        if (picked) return picked;
    }
    return renderedCards.find(c => c.ids.has(cursorId)) || null;
}

function updateSelection() {
    const current = currentCard();
    for (const card of renderedCards) {
        card.node.classList.toggle("selected", card === current);
    }
    renderDetail();
}

function selectCampaign(group) {
    pickedCampaign = group.campaign.id;
    updateSelection();
    // The real Grist cursor follows (first step), so a widget linked by "Select By" follows too
    if (group.tasks.length > 0) grist.setCursorPos({ rowId: group.tasks[0].id });
}

grist.onRecord(function (record) {
    cursorId = record ? record.id : null;
    pickedCampaign = null;   // the cursor moved elsewhere: it takes over
    updateSelection();
});


let renderRequest = 0;   // guards against out-of-order async updates

grist.onRecords(async function (records) {

    const myRequest = ++renderRequest;
    const container = document.getElementById("resources");
    ensureLayout();

    records = records || [];   // campaigns are shown even when no task is visible

    // Apply the column mapping chosen in the creator panel: rows come in with the REAL column ids and
    // are renamed to the slot names used below. Until now this only worked because the slot names
    // were identical to the column ids. If a required slot is not mapped (null), the raw rows are
    // kept, as before.
    if (records.length > 0) {
        const mapped = grist.mapColumnNames(records);
        if (mapped) records = mapped;
        else console.warn("dashboard.js: colonnes du widget non associées, lecture directe des noms de colonnes.");
    }

    statusInUse = records.some(r => statusText(r) !== "");

    // Campaigns and Resources are read BEFORE touching the DOM (titles, badges, colours), so
    // overlapping updates cannot interleave and duplicate cards
    await loadReferences();
    if (myRequest !== renderRequest) return;   // a newer update has arrived

    if (campaignsError) {
        renderedCards = [];
        container.replaceChildren(el(
            "div", "fatal-error",
            "Impossible de lire la table « " + CAMPAIGNS.table + " » " +
            "(accès complet requis ? identifiant de table ?) : " + campaignsError
        ));
        updateSelection();
        return;
    }

    const groups = buildGroups(records);

    if (groups.length === 0) {
        renderedCards = [];
        container.replaceChildren(
            el("div", "empty-state", "Aucune campagne à afficher")
        );
        updateSelection();
        return;
    }

    const fragment = document.createDocumentFragment();
    const cards = [];

    for (const group of groups) {
        const node = buildGroupCard(group);
        const ids = new Set(group.tasks.map(t => t.id));
        cards.push({ node, group, campaignId: group.campaign.id, ids });
        fragment.appendChild(node);
    }
    renderedCards = cards;

    container.replaceChildren(fragment);
    updateSelection();
}, { expandRefs: false });   // campagne arrives as a row id, not as display text
