/* Shared VM loader for exercising the browser game's real scripts in Node. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');

function createGameContext(globals, files, setupSource = '') {
    const context = vm.createContext(globals);
    if (setupSource) vm.runInContext(setupSource, context, { filename: '<headless-setup>' });
    for (const file of files) {
        const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
        vm.runInContext(source, context, { filename: file });
    }
    return context;
}

module.exports = { ROOT, createGameContext };
