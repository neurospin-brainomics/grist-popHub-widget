grist.ready({
    columns: [
        "Name",
        "Owner",
        "Description",
        "Category",
        "Provider",
        "PieceJointe"
    ],
    requiredAccess: "read table",
    allowSelectBy: true
});


// Small helper: create an element with a class and optional text
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}


// Build the attachment block (image, with a download link as fallback
// for non-image files such as PDF or docx)
function buildAttachment(record, tokenInfo) {
    const attachmentId = record.PieceJointe[0];
    const url =
        `${tokenInfo.baseUrl}/attachments/${attachmentId}/download?auth=${tokenInfo.token}`;

    const attachment = el("div", "attachment");

    const image = document.createElement("img");
    image.src = url;
    image.alt = record.Name || "Pièce jointe";
    image.style.width = "100%";
    image.style.maxHeight = "180px";
    image.style.objectFit = "contain";
    image.style.display = "block";
    image.style.marginTop = "10px";

    // If the file is not an image, replace the broken <img> by a link
    image.addEventListener("error", function () {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Télécharger la pièce jointe";
        image.replaceWith(link);
    });

    attachment.appendChild(image);
    return attachment;
}


// Build one card for one record
function buildCard(record, tokenInfo) {
    const card = el("div", "resource-card");

    // Header
    const header = el("div", "resource-header");
    header.appendChild(el("div", "resource-name", record.Name || ""));
    header.appendChild(el("div", "resource-category", record.Category || ""));
    card.appendChild(header);

    // Description
    if (record.Description) {
        card.appendChild(
            el("div", "resource-description", record.Description)
        );
    }

    // Metadata
    const meta = el("div", "resource-meta");

    if (record.Provider) {
        meta.appendChild(el("div", null, "Provider: " + record.Provider));
    }
    if (record.Owner) {
        meta.appendChild(el("div", null, "Owner: " + record.Owner));
    }
    if (meta.children.length > 0) {
        card.appendChild(meta);
    }

    // Attachment
    if (
        tokenInfo &&
        Array.isArray(record.PieceJointe) &&
        record.PieceJointe.length > 0
    ) {
        card.appendChild(buildAttachment(record, tokenInfo));
    }

    // Open record button
    const openButton = el("button", "open-record", "Ouvrir");
    openButton.addEventListener("click", async function () {
        await grist.setCursorPos({ rowId: record.id });
    });
    card.appendChild(openButton);

    return card;
}


grist.onRecords(async function (records) {

    const container = document.getElementById("resources");

    // Empty state (no rows, or columns not mapped yet)
    if (!records || records.length === 0) {
        container.replaceChildren(
            el("div", "empty-state", "Aucune ressource à afficher")
        );
        return;
    }

    // Only request a token if at least one record has an attachment
    const needsToken = records.some(
        r => Array.isArray(r.PieceJointe) && r.PieceJointe.length > 0
    );

    let tokenInfo = null;
    if (needsToken) {
        try {
            // Awaited BEFORE touching the DOM, so overlapping calls
            // cannot interleave and duplicate cards
            tokenInfo = await grist.docApi.getAccessToken({ readOnly: true });
        } catch (err) {
            console.error("Could not get attachment token:", err);
        }
    }

    // Build everything off-DOM, then swap in a single operation
    const fragment = document.createDocumentFragment();
    for (const record of records) {
        fragment.appendChild(buildCard(record, tokenInfo));
    }
    container.replaceChildren(fragment);
});
