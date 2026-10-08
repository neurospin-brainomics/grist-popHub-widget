// =====================================================
// Column slots. Rename the values on the right if the
// slot names in YOUR tasks.js differ from these.
// (Real columns: titre, type, dependDe, projet, dateEchance, piecejointe)
// =====================================================
const SLOTS = {
    title: "titre",         // titre: text shown for each task
    type: "type",           // type: "Heading" marks the start of a subchunk
    dependOn: "dependDe",   // dependDe: Reference to the predecessor row (0 = none)
    project: "projet",      // projet: Reference to the Resources table (Name)
    dueDate: "dateEchance", // dateEchance
    attachment: "piecejointe" // piecejointe: Attachments column holding the PDF
};

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

grist.ready({
    columns: [
        SLOTS.title,
        SLOTS.type,
        SLOTS.dependOn,
        { name: SLOTS.project, optional: true },
        { name: SLOTS.dueDate, optional: true },
        { name: SLOTS.attachment, optional: true }
    ],
    // "full" is required to read ANOTHER table (Resources) with docApi.fetchTable.
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

// Shown in the detail panel and in the console: tells at a glance which tasks.js is running
// (a browser can keep serving an old copy for a while after a new push to GitHub Pages).
const VERSION = "v4";
console.log("tasks.js " + VERSION + " (cartes + panneau Ressources)");

// Layout styles travel with the script, so the panel works even if style.css is old,
// cached or not updated. Rules in style.css with the same selectors are harmless.
(function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
.master-detail { display: grid; grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
                 gap: 20px; align-items: start; }
.master-detail #resources { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.resource-detail { position: sticky; top: 12px; background: #fff; border-radius: 10px;
                   padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
                   max-height: calc(100vh - 24px); overflow: auto; }
.resource-detail .resource-description { white-space: pre-line; }
.resource-detail .version-stamp { margin-top: 14px; font-size: 11px; color: #999; }
.resource-card.selected { outline: 2px solid #2f6fdb; }
.empty-state { color: #666; font-style: italic; }
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
    console.error("tasks.js " + VERSION + ":", message);
    document.body.appendChild(el("div", "fatal-error", "Erreur du widget (" + VERSION + ") : " + message));
}
window.addEventListener("error", function (event) { showFatal(event.message); });
window.addEventListener("unhandledrejection", function (event) {
    showFatal(String((event.reason && event.reason.message) || event.reason));
});

// The grist plugin API decodes a Reference cell into a Reference object
// ({ tableId, rowId }), not a plain number. An empty reference has rowId 0.
// Plain numbers / numeric text are accepted too.
// Anything unreadable gives 0 ("no predecessor").
function predecessorId(record) {
    const value = record[SLOTS.dependOn];
    const raw = (value !== null && typeof value === "object") ? value.rowId : value;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

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

// Row id of the referenced Resources row. Depending on the options, a Reference cell arrives
// as a number, as a Reference object ({ tableId, rowId }) or as its display text.
function referenceRowId(value) {
    const raw = (value !== null && typeof value === "object") ? value.rowId : value;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : 0;
}

// The Resources row a heading points to, through projet (by row id, or by Name as a fallback)
function resourceOf(record) {
    const value = record ? record[SLOTS.project] : null;
    const byId = resourcesById.get(referenceRowId(value));
    if (byId) return byId;
    if (typeof value === "string") return resourcesByName.get(value.trim().toLowerCase()) || null;
    return null;
}

// Text of the project badge on a card
function projectLabel(record) {
    const resource = resourceOf(record);
    if (resource) return resource.name;
    const value = record ? record[SLOTS.project] : null;
    return typeof value === "string" ? value : "";
}

// Grist Date cells arrive as seconds since epoch (or as a Date object)
function formatDate(value) {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(Number(value) * 1000);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}


// Group the rows into subchunks.
// A subchunk starts at a row with no predecessor (dependDe empty)
// and contains every row reachable by following the chain forward
// (a row whose dependDe points to a row already in the subchunk).
function buildSubchunks(records) {

    // predecessor id -> rows that depend on it
    const successors = new Map();
    for (const record of records) {
        const pred = predecessorId(record);
        if (pred) {
            if (!successors.has(pred)) successors.set(pred, []);
            successors.get(pred).push(record);
        }
    }

    const visited = new Set();
    const subchunks = [];

    const headings = records.filter(r => !predecessorId(r));

    for (const heading of headings) {

        const members = [];
        const queue = [heading];
        visited.add(heading.id);

        // Walk the chain forward; the visited set protects against cycles
        while (queue.length > 0) {
            const current = queue.shift();
            members.push(current);

            for (const next of successors.get(current.id) || []) {
                if (!visited.has(next.id)) {
                    visited.add(next.id);
                    queue.push(next);
                }
            }
        }

        subchunks.push({ heading, tasks: members.slice(1) });
    }

    // Rows not reachable from any chain start (e.g. a cycle with no root)
    const orphans = records.filter(r => !visited.has(r.id));

    return { subchunks, orphans };
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

function buildTaskItem(task) {
    const li = document.createElement("li");
    const label = task[SLOTS.title] || "(sans titre)";

    if (hasAttachment(task)) {
        const button = el("button", "task-link", label);
        button.type = "button";
        button.title = "Afficher la pièce jointe";
        button.addEventListener("click", function () {
            openPdf(task);
        });
        li.appendChild(button);
    } else {
        li.textContent = label;
    }
    return li;
}


function buildSubchunkCard(subchunk) {
    const card = el("div", "resource-card");
    const heading = subchunk.heading;

    // Header: heading title + project badge
    const header = el("div", "resource-header");
    header.appendChild(
        el("div", "resource-name", heading[SLOTS.title] || "(sans titre)")
    );
    header.appendChild(
        el("div", "resource-category", projectLabel(heading))
    );
    card.appendChild(header);

    // Metadata: due date and number of actions
    const meta = el("div", "resource-meta");
    const due = formatDate(heading[SLOTS.dueDate]);
    if (due) meta.appendChild(el("div", null, "Échéance : " + due));
    meta.appendChild(el("div", null, subchunk.tasks.length + " actions(s)"));
    card.appendChild(meta);

    // List of the task titles, in chain order
    if (subchunk.tasks.length > 0) {
        const list = el("ul", "chunk-list");
        for (const task of subchunk.tasks) {
            list.appendChild(buildTaskItem(task));
        }
        card.appendChild(list);
    }

    // Selects this group: the detail panel (Resources) follows at once, and the real Grist
    // cursor is moved too, so any widget linked to this one by "Select By" follows as well.
    const openButton = el("button", "open-record", "Ouvrir");
    openButton.title = "Afficher la ressource liée";
    openButton.addEventListener("click", function () {
        selectRow(heading.id);
        grist.setCursorPos({ rowId: heading.id });
        // Re-read Resources so that a recent edit of the resource shows up
        loadResources().then(renderDetail);
    });
    card.appendChild(openButton);

    return card;
}


// =====================================================
// Layout: the cards stay in #resources; a detail panel for the linked
// Resources row is added next to them. It is created here, so tasks.html
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
    panel.appendChild(el("div", "version-stamp", "tasks.js " + VERSION));
    cards.parentNode.insertBefore(wrapper, cards);
    wrapper.appendChild(cards);
    wrapper.appendChild(panel);
    return detailBody;
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

// Fills the detail panel for the group holding the cursor
async function renderDetail() {
    const panel = ensureLayout();
    const myRequest = ++detailRequest;

    const card = renderedCards.find(c => c.ids.has(cursorId));
    if (!card) {
        panel.replaceChildren(
            el("div", "empty-state", "Cliquez sur « Ouvrir » pour afficher la ressource liée")
        );
        return;
    }

    if (resourcesError) {
        panel.replaceChildren(el(
            "div", "empty-state",
            "Impossible de lire la table « " + RESOURCES.table + " » " +
            "(accès complet requis ? identifiant de table ?) : " + resourcesError
        ));
        return;
    }

    const resource = resourceOf(card.heading);
    if (!resource) {
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

    const content = el("div", "resource-detail-content");

    const header = el("div", "resource-header");
    header.appendChild(el("div", "resource-name", resource.name || "(sans nom)"));
    header.appendChild(el("div", "resource-category", resource.category));
    content.appendChild(header);

    if (resource.description) {
        content.appendChild(el("div", "resource-description", resource.description));
    }

    const meta = el("div", "resource-meta");
    if (resource.provider) meta.appendChild(el("div", null, "Provider: " + resource.provider));
    if (resource.owner) meta.appendChild(el("div", null, "Owner: " + resource.owner));
    if (meta.children.length > 0) content.appendChild(meta);

    if (tokenInfo && resource.attachments.length > 0) {
        content.appendChild(buildResourceAttachments(resource, tokenInfo));
    }

    panel.replaceChildren(content);
}


// =====================================================
// Selection = the group holding the cursor row. It is set by the "Ouvrir" button
// and by the real Grist cursor (onRecord), e.g. when a row is clicked elsewhere.
// It drives both the highlight of the card and the detail panel.
// =====================================================
let cursorId = null;
let renderedCards = [];   // [{ node, heading, ids: Set of row ids in that card }]

function updateSelection() {
    for (const card of renderedCards) {
        card.node.classList.toggle("selected", card.ids.has(cursorId));
    }
    renderDetail();
}

function selectRow(rowId) {
    cursorId = rowId;
    updateSelection();
}

grist.onRecord(function (record) {
    selectRow(record ? record.id : null);
});


let renderRequest = 0;   // guards against out-of-order async updates

grist.onRecords(async function (records) {

    const myRequest = ++renderRequest;
    const container = document.getElementById("resources");
    ensureLayout();

    if (!records || records.length === 0) {
        renderedCards = [];
        container.replaceChildren(
            el("div", "empty-state", "Aucune tâche à afficher")
        );
        updateSelection();
        return;
    }

    const { subchunks, orphans } = buildSubchunks(records);

    if (subchunks.length === 0) {
        renderedCards = [];
        container.replaceChildren(
            el("div", "empty-state", "Aucun groupe trouvé (aucune ligne sans prédécesseur)")
        );
        updateSelection();
        return;
    }

    // Resources are read BEFORE touching the DOM (badge text), so overlapping
    // updates cannot interleave and duplicate cards
    await loadResources();
    if (myRequest !== renderRequest) return;   // a newer update has arrived

    const fragment = document.createDocumentFragment();
    const cards = [];

    for (const subchunk of subchunks) {
        const node = buildSubchunkCard(subchunk);
        const ids = new Set([subchunk.heading.id, ...subchunk.tasks.map(t => t.id)]);
        cards.push({ node, heading: subchunk.heading, ids });
        fragment.appendChild(node);
    }
    renderedCards = cards;

    if (orphans.length > 0) {
        console.warn(
            orphans.length + " ligne(s) non rattachée(s) à un groupe:",
            orphans.map(r => r.id)
        );
    }

    container.replaceChildren(fragment);
    updateSelection();
}, { expandRefs: false });   // projet / dependDe arrive as row ids, not as display text
