grist.ready({
    columns: ["Title", "Description", "DueDate", "Assignee"],
    requiredAccess: "read table",
    allowSelectBy: true
});

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

grist.onRecords(function (records) {
    const container = document.getElementById("resources");

    if (!records || records.length === 0) {
        container.replaceChildren(el("div", "empty-state", "Aucune tâche à afficher"));
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const record of records) {
        const card = el("div", "resource-card");

        const header = el("div", "resource-header");
        header.appendChild(el("div", "resource-name", record.Title || ""));
        header.appendChild(el("div", "resource-category", record.Description || ""));
        card.appendChild(header);

        const meta = el("div", "resource-meta");
        if (record.Assignee) meta.appendChild(el("div", null, "Assigné à : " + record.Assignee));
        if (record.DueDate) {
            // Grist Date columns arrive as a Date object or a timestamp in seconds
            const d = record.DueDate instanceof Date ? record.DueDate : new Date(record.DueDate * 1000);
            meta.appendChild(el("div", null, "Échéance : " + d.toLocaleDateString("fr-FR")));
        }
        if (meta.children.length > 0) card.appendChild(meta);

        const openButton = el("button", "open-record", "Ouvrir");
        openButton.addEventListener("click", () => grist.setCursorPos({ rowId: record.id }));
        card.appendChild(openButton);

        fragment.appendChild(card);
    }

    container.replaceChildren(fragment);
});