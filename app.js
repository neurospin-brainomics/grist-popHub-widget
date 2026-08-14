
console.log("Grist widget loaded");

grist.ready();

grist.onRecords(function(records) {

    console.log("Records received:", records);

    const container = document.getElementById("resources");

    container.innerHTML = "";

    records.forEach(record => {

        const card = document.createElement("div");
        card.className = "resource-card";

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

        const description = document.createElement("div");
        description.className = "resource-description";
        description.textContent = record.Description || "";

        const meta = document.createElement("div");
        meta.className = "resource-meta";

        const provider = document.createElement("div");
        provider.textContent = "Provider: " + (record.Provider || "");

        const owner = document.createElement("div");
        owner.textContent = "Owner: " + (record.Owner || "");

        meta.appendChild(provider);
        meta.appendChild(owner);

        card.appendChild(header);
        card.appendChild(description);
        card.appendChild(meta);

        if (record.PieceJointe) {

            const attachment = document.createElement("div");
            attachment.className = "attachment";

            attachment.textContent = "📎 Pièce jointe";

            card.appendChild(attachment);
        }

        container.appendChild(card);
    });
});
