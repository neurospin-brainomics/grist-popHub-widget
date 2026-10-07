// =====================================================
// Column slots. Rename the values on the right if the
// slot names in YOUR tasks.js differ from these.
// (Real columns: titre, type, dependDe, projet, dateEchance)
// =====================================================
const SLOTS = {
    title: "titre",         // titre: text shown for each task
    type: "type",           // type: "Heading" marks the start of a subchunk
    dependOn: "dependDe",   // dependDe: Reference to the predecessor row (0 = none)
    project: "projet",     // projet: tells apart subchunks with the same title
    dueDate: "dateEchance"  // dateEchance
};

grist.ready({
    columns: [
        SLOTS.title,
        SLOTS.type,
        SLOTS.dependOn,
        { name: SLOTS.project, optional: true },
        { name: SLOTS.dueDate, optional: true }
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

// function isHeading(record) {
//     return String(record[SLOTS.type] || "").trim().toLowerCase() === "heading";
// }

// A Reference cell arrives as a row id; 0, null or "" means "no predecessor"
function predecessorId(record) {
    const value = record[SLOTS.dependOn];
    return value ? Number(value) : 0;
}

// Grist Date cells arrive as seconds since epoch (or as a Date object)
function formatDate(value) {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(Number(value) * 1000);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}


// Group the rows into subchunks.
// A subchunk starts at a Heading row (type = "Heading", no predecessor)
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
    //const headings = records.filter(r => isHeading(r) && !predecessorId(r));

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

    // Rows not reachable from any heading (broken chain, missing heading...)
    const orphans = records.filter(r => !visited.has(r.id));

    return { subchunks, orphans };
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

    // Metadata: start date and number of tasks
    const meta = el("div", "resource-meta");
    const start = formatDate(heading[SLOTS.dueDate]);
    if (start) meta.appendChild(el("div", null, "Début : " + start));
    meta.appendChild(el("div", null, subchunk.tasks.length + " tâche(s)"));
    card.appendChild(meta);

    // List of the task titles, in chain order
    if (subchunk.tasks.length > 0) {
        const list = el("ul", "chunk-list");
        for (const task of subchunk.tasks) {
            list.appendChild(el("li", null, task[SLOTS.title] || "(sans titre)"));
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

    console.table(records.map(r => ({
    id: r.id,
    dependDe: r[SLOTS.dependOn],
    type_de_dependDe: typeof r[SLOTS.dependOn]
})));
    
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
            el("div", "empty-state", "Aucun groupe (type = Heading) trouvé")
        );
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const subchunk of subchunks) {
        fragment.appendChild(buildSubchunkCard(subchunk));
    }

    if (orphans.length > 0) {
        console.warn(
            orphans.length + " ligne(s) non rattachée(s) à un Heading:",
            orphans.map(r => r.id)
        );
    }

    container.replaceChildren(fragment);
});
