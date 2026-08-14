
console.log("Grist widget loaded");

grist.ready();

grist.onRecords(function(records) {

    console.log("Records received:", records);

    const container = document.getElementById("resources");

    container.innerHTML = "";

    records.forEach(record => {

        const div = document.createElement("div");

        div.className = "resource";
        div.textContent = record.Name;

        container.appendChild(div);
    });
});
