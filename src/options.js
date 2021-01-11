import { readAria2Options } from "./utils";

const form = document.getElementById("aria2-options");

const restoreOptions = async () => {
    let options = await readAria2Options();
    for (let element of form.querySelectorAll(".option.aria2")) {
        let value = options[element.name];
        if (element.name === "secure") {
            if (value == true)
                element.checked = true;
        }
        else if (element.name === "protocol") {
            if (element.id.endsWith(value))
                element.checked = true;
        }
        else
            element.value = value;
    }
    return options;
}

const saveOptions = async () => {
    let options = await readAria2Options();
    let data = new FormData(form);
    for (const entry of data) {
        options[entry[0]] = entry[1];
    }
    options["secure"] = data.get("secure") !== null;
    options.port = parseInt(options.port);
    console.log("Submit", options);
    browser.storage.local.set({ aria2_options: options })
}

document.addEventListener("DOMContentLoaded", restoreOptions);
form.addEventListener("submit", saveOptions);
