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

    for (const record of records) {

        if (record.PieceJointe && record.PieceJointe.length > 0) {

            const attachmentId = record.PieceJointe[0];

            console.log(
                "Attachment ID:",
                attachmentId
            );
        }
    }
});
