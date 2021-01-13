/**
 * Get or create the dialog box
 */
const insertDialog = async () => {
    let dialog = document.getElementById("yaai-dialog");
    if (dialog !== null) {
        // already inserted
        return dialog;
    }
    const url = browser.runtime.getURL("popup/dialog.html");
    const html = await fetch(url);
    const text = await html.text();
    document.body.insertAdjacentHTML("beforeend", text);
    return document.getElementById("yaai-dialog");
}

/**
 * Add values to the dialog fields
 * @param {any} params 
 * @param {HTMLDialogElement} dialog 
 */
const populateDialog = (params, dialog) => {
    for (const param of ["url", "filename", "dir"]) {
        document.getElementById("yaai-" + param).value = params[param] || "";
    }
    dialog.returnValue = "";
    dialog.removeAttribute("open");
}

const DEFAULT_METHOD = "firefox";

/**
 * Retrieve the form values and user selection from dialog
 * @param {HTMLDialogElement} dialog 
 */
const getUserInput = (dialog) => new Promise((resolve) => {
    dialog.addEventListener("close", () => {
        let params = {};
        for (const param of ["url", "filename", "dir"]) {
            params[param] = document.getElementById("yaai-" + param).value || "";
        }
        const val = dialog.returnValue || DEFAULT_METHOD;
        populateDialog({}, dialog); // clear the dialog for future use.
        resolve({ params, downloadMethod: val });
    }, { once: true });
})

/**
 * Show a popup and get user's confirmation
 * @param {any} params The details of the intercepted download
 */
const confirmDownload = async (params) => {
    const dialog = await insertDialog();
    populateDialog(params, dialog);
    dialog.showModal();
    return await getUserInput(dialog);
}

browser.runtime.onMessage.addListener((data) => {
    if (data.action === "confirmDownload") {
        return confirmDownload(data.params);
    }
})
