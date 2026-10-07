// =====================================================
// Column slots. Rename the values on the right if the
// slot names in YOUR tasks.js differ from these.
// (Real columns: titre, type, dependDe, projet, dateEchance, piecejointe)
// =====================================================
const SLOTS = {
    title: "titre",         // titre: text shown for each task
    type: "type",           // type: "Heading" marks the start of a subchunk
    dependOn: "dependDe",   // dependDe: Reference to the predecessor row (0 = none)
    project: "projet",      // projet: tells apart subchunks with the same title
    dueDate: "dateEchance", // dateEchance
    attachment: "piecejointe" // piecejointe: Attachments column holding the PDF
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
    requiredAccess: "read table",
    allowSelectBy: true
});


function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

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
        el("div", "resource-category", heading[SLOTS.project] || "")
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

    const openButton = el("button", "open-record", "Ouvrir");
    openButton.addEventListener("click", function () {
        grist.setCursorPos({ rowId: heading.id });
    });
    card.appendChild(openButton);

    return card;
}


grist.onRecords(function (records) {

    const container = document.getElementById("resources");

    if (!records || records.length === 0) {
        container.replaceChildren(
            el("div", "empty-state", "Aucune tâche à afficher")
        );
        return;
    }

    const { subchunks, orphans } = buildSubchunks(records);

    if (subchunks.length === 0) {
        container.replaceChildren(
            el("div", "empty-state", "Aucun groupe trouvé (aucune ligne sans prédécesseur)")
        );
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const subchunk of subchunks) {
        fragment.appendChild(buildSubchunkCard(subchunk));
    }

    if (orphans.length > 0) {
        console.warn(
            orphans.length + " ligne(s) non rattachée(s) à un groupe:",
            orphans.map(r => r.id)
        );
    }

    container.replaceChildren(fragment);
});