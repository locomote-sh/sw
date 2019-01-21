const Path = require('path');

const outputPath = Path.join( __dirname, '_public');

const coreConfig = {
    entry: '../src/core.js', // TODO Rename to index / add an index.js
    mode: 'none',
    optimization: { minimize: false },
    output: {
        path: outputPath,
        filename: 'locomote-sw.js'
    }
};

/*
const searchPluginConfig = {
    entry: './plugins/search.js',
    output: {
        path: outputPath,
        filename: 'locomote-search.js'
    }
};

const zippedFilesetsPluginConfig = {
    entry: './plugins/zipped-filesets/refresh.js',
    output: {
        path: outputPath,
        filename: 'locomote-zipped-filesets.js'
    }
};
*/

module.exports = [
    coreConfig/*,
    searchPluginConfig,
    zippedFilesetsPluginConfig
    */
];

