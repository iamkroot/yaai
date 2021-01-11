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
    let el = document.createElement("slot");
    el.innerHTML = text;
    document.documentElement.appendChild(el);
    return el.firstChild;
}
