grist.ready({
    columns: [
        "Name",
        "Owner",
        "Description",
        "Category",
        "Provider",
        "PieceJointe"
    ],
    requiredAccess: "read table"
});


grist.onRecords(async function(records) {

    console.log("Records received:", records);

    const container = document.getElementById("resources");

    container.innerHTML = "";

    // Get a read-only token once for all attachments
    const tokenInfo = await grist.docApi.getAccessToken({
        readOnly: true
    });


    for (const record of records) {

        const card = document.createElement("div");
        card.className = "resource-card";


        // =========================
        // Header
        // =========================

        const header = document.createElement("div");
        header.className = "resource-header";

        const name = document.createElement("div");
        name.className = "resource-name";
        name.textContent = record.Name || "";

        const category = document.createElement("div");
        category.className = "resource-category";
        category.textContent = record.Category || "";

        header.appendChild(name);
        header.appendChild(category);

        card.appendChild(header);


        // =========================
        // Description
        // =========================

        if (record.Description) {

            const description = document.createElement("div");

            description.className = "resource-description";
            description.textContent = record.Description;

            card.appendChild(description);
        }


        // =========================
        // Metadata
        // =========================

        const meta = document.createElement("div");
        meta.className = "resource-meta";

        if (record.Provider) {

            const provider = document.createElement("div");

            provider.textContent =
                "Provider: " + record.Provider;

            meta.appendChild(provider);
        }

        if (record.Owner) {

            const owner = document.createElement("div");

            owner.textContent =
                "Owner: " + record.Owner;

            meta.appendChild(owner);
        }

        if (meta.children.length > 0) {
            card.appendChild(meta);
        }


        // =========================
        // Attachment
        // =========================

        if (
            record.PieceJointe &&
            record.PieceJointe.length > 0
        ) {

            const attachmentId = record.PieceJointe[0];

            const url =
                `${tokenInfo.baseUrl}/attachments/${attachmentId}/download?auth=${tokenInfo.token}`;

            console.log(
                "Attachment nouv URL generated for",
                record.Name
            );


            const attachment = document.createElement("div");
            attachment.className = "attachment";


            const image = document.createElement("img");

            image.src = url;
            image.alt = record.Name || "Attachment";

            image.style.width = "100%";
            image.style.maxHeight = "180px";
            image.style.objectFit = "contain";
            image.style.display = "block";
            image.style.marginTop = "10px";


            attachment.appendChild(image);
            card.appendChild(attachment);
        }


        container.appendChild(card);
    }
});
