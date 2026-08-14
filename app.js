
console.log("Grist widget loaded");


grist.ready();

grist.onRecords(function(records) {

    console.log("Records received:", records);

    const status = document.getElementById("status");

    status.innerHTML = "";

    records.forEach(record => {

        const div = document.createElement("div");

        div.textContent = record.Name;

        status.appendChild(div);
    });
});
