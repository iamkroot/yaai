const path = require("path");

module.exports = {
    experiments: {
        topLevelAwait: true
    },
    entry: {
        background: "./src/background.js",
        options: "./src/options.js",
        popup: "./src/popup.js",
    },
    output: {
        path: path.resolve(__dirname, "addon"),
        filename: "[name]/index.js",
        hashFunction: "xxhash64",
        devtoolModuleFilenameTemplate: './[resource-path]'
    },
    watchOptions: {
        ignored: ['addon/**', 'node_modules/**']
    },
    devtool: 'cheap-module-source-map'
};
