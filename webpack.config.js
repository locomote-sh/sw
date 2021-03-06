const Path = require('path');

const { version } = require('./package.json');

const outputPath = Path.join( __dirname, 'dist', 'sw', version );

const coreConfig = {
    mode: 'production',
    entry: './src/core.js', // TODO Rename to index / add an index.js
    output: {
        path: outputPath,
        filename: 'locomote-sw.js'
    }
};

const searchPluginConfig = {
    mode: 'production',
    entry: './plugins/search.js',
    output: {
        path: outputPath,
        filename: 'locomote-search.js'
    }
};

const zippedFilesetsPluginConfig = {
    mode: 'production',
    entry: './plugins/zipped-filesets/refresh.js',
    output: {
        path: outputPath,
        filename: 'locomote-zipped-filesets.js'
    }
};

module.exports = [
    coreConfig,
    searchPluginConfig,
    zippedFilesetsPluginConfig
];

