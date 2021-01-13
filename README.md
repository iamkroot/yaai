# YAAI - Yet Another Aria2 Integrator

YAAI is a Firefox addon to intercept downloads and send them to [Aria2](https://aria2.github.io) using the RPC mechanism.

Currently, this is a very barebones extension only intended for my personal use. I cannot guarantee that I can continue working on more features, hence I am not publishing it to the Firefox store.

## Installation
Here are the steps to manually install YAAI:
1. Switch to Firefox Developer Edition (to allow installing unsigned extensions).
2. Open `about:config` and toggle `xpinstall.signatures.required` to `false` and `dom.dialog_element.enabled` to `true`.
3. Run `npm install` after cloning this repo.
4. Run `npm run build:prod`. This will invoke Webpack to bundle up all the JS deps for files from [`src/`](src).
5. Open the [`addon`](addon) directory and zip up all the contents. Ensure the archive does *not* have a `addon` folder, otherwise firefox will reject it. The `manifest.json` should be directly present in the archive root.
6. Open `about:addons` and drag-and-drop the zip to this page.
7. After installation, open the extension preferences and add your [`RPC Token`](https://aria2.github.io/manual/en/html/aria2c.html#rpc-authorization-secret-token) for Aria2 there.

## Acknowledgements
YAAI is mostly a rewrite of the download interception logic from [Aria2-Integration](https://github.com/RossWang/Aria2-Integration/) in ES7. I've found it to be the best in terms of actually intercepting valid downloads and forwarding them to Aria2.

The problem is that for user confirmation of the download, that extension creates a new browser window in the dimensions of a dialog box, without actually marking the window as a "Dialog". This means, whenever the download panel pops up, my Window Manager remembers those dimensions for the entire Firefox class, and the next time I open my browser, it starts as a small sized box, which is obviously very irritating.

Instead, YAAI injects a [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) into the webpage to ask for user confirmation, which is much better in terms of performance too (creating a new window is very expensive for a browser).
