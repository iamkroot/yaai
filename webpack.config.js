const path = require("path");

module.exports = {
    entry: {
        background: "./src/background.js",
        options: "./src/options.js",
        popup: "./src/popup.js",
    },
    output: {
        path: path.resolve(__dirname, "addon"),
        filename: "[name]/index.js"
    },
    watchOptions: {
        ignored: ['addon/**', 'node_modules/**']
    },
    devtool: 'cheap-module-source-map'
};
