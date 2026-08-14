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

    const tokenInfo = await grist.docApi.getAccessToken({
        readOnly: true
    });

    console.log("Access token received");
    console.log("Base URL:", tokenInfo.baseUrl);

    for (const record of records) {

        if (record.PieceJointe && record.PieceJointe.length > 0) {

            const attachmentId = record.PieceJointe[0];

            const url =
                `${tokenInfo.baseUrl}/attachments/${attachmentId}/download?auth=${tokenInfo.token}`;

            console.log("Attachment ID:", attachmentId);
            console.log("Attachment URL:", url);
        }
    }
});
