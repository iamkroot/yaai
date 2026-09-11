const DIALOG_HTML = `
<dialog id="yaai-dialog" style="max-height: 40%; z-index: 2147483647; margin: auto; position: fixed;">
    <form method="dialog" class="pure-form pure-form-stacked">
        <fieldset>
            <legend>Intercepted download</legend>
            <label for="yaai-url">URL</label>
            <input class="pure-input-1" type="text" name="yaai-url" id="yaai-url" readonly="">
            <label for="yaai-filename">Name</label>
            <input class="pure-input-1" type="text" name="yaai-filename" id="yaai-filename">
            <label for="yaai-dir">Location</label>
            <input class="pure-input-1" type="text" name="yaai-dir" id="yaai-dir">
        </fieldset>
        <button type="submit" value="aria2" class="pure-button pure-button-primary">Aria2</button>
        <button type="submit" value="firefox" class="pure-button">Firefox</button>
        <button type="submit" value="halt" class="pure-button">Don&apos;t Download</button>
    </form>
</dialog>
`;

/**
 * Get or create the dialog box
 */
const insertDialog = () => {
    let dialog = document.getElementById("yaai-dialog");
    if (dialog !== null) {
        return dialog;
    }
    document.body.insertAdjacentHTML("beforeend", DIALOG_HTML);
    return document.getElementById("yaai-dialog");
};

/**
 * Add values to the dialog fields
 * @param {any} params 
 * @param {HTMLDialogElement} dialog 
 */
const populateDialog = (params, dialog) => {
    for (const param of ["url", "filename", "dir"]) {
        const el = document.getElementById("yaai-" + param);
        if (el) {
            el.value = params[param] || "";
        }
    }
    dialog.returnValue = "";
    dialog.removeAttribute("open");
};

const DEFAULT_METHOD = "firefox";

/**
 * Retrieve the form values and user selection from dialog
 * @param {HTMLDialogElement} dialog 
 */
const getUserInput = (dialog) => new Promise((resolve) => {
    dialog.addEventListener("close", () => {
        let params = {};
        for (const param of ["url", "filename", "dir"]) {
            const el = document.getElementById("yaai-" + param);
            params[param] = el ? el.value : "";
        }
        const val = dialog.returnValue || DEFAULT_METHOD;
        populateDialog({}, dialog); // clear the dialog for future use.
        resolve({ params, downloadMethod: val });
    }, { once: true });
});

/**
 * Show a popup and get user's confirmation
 * @param {any} params The details of the intercepted download
 */
const confirmDownload = async (params) => {
    const dialog = insertDialog();
    populateDialog(params, dialog);
    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        dialog.setAttribute("open", "");
    }
    return await getUserInput(dialog);
};

browser.runtime.onMessage.addListener((data) => {
    if (data && data.action === "confirmDownload") {
        return confirmDownload(data.params);
    }
});
