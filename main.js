'use strict';

var program = require('commander');
let mkdirp = require('mkdirp');
let walk = require('walk');
let path = require('path');
let fs = require('fs');
let converter = require('./converter');
let util = require('./util');

program
    .usage('<command> <input> <output>')
    .version('0.0.1');

program
    .command('extract')
    .description('extract XNB file or all files in directory')
    .arguments('<input> <output>')
    .action((input, output) => {
        applyOrRecurse(extractXnb, input, output);
    });

program
    .command('pack')
    .description('pack XNB file or all files in directory')
    .arguments('<input> <output>')
    .action((input, output) => {
        applyOrRecurse(packJson, input, output);
    });

program
    .action(() => program.help());

program.parse(process.argv);

if(!process.argv.slice(2).length) {
    program.help();
}

function extractXnb(inputFile, outputFile) {
    let inputBuffer = fs.readFileSync(inputFile);
    let json = converter.XnbToJson(inputBuffer);
    mkdirp.sync(path.dirname(outputFile));
    fs.writeFileSync(outputFile, json, 'utf8');
}

function packJson(inputFile, outputFile) {
    let inputJson = fs.readFileSync(inputFile, 'utf8');
    let xnb = converter.JsonToXnb(inputJson);
    mkdirp.sync(path.dirname(outputFile));
    fs.writeFileSync(outputFile, xnb);
}

function readErrorWrapper(fn) {
    return function() {
        try {
            fn.apply(this, arguments);
        } catch(e) {
            if(e instanceof util.ReadError) {
                return;
            } else {
                throw e;
            }
        }
    }
}

function applyOrRecurse(fn, input, output) {
    fn = readErrorWrapper(fn);

    let stats;
    try {
        stats = fs.statSync(input);
    } catch(e) {
        if(e.code === 'ENOENT') {
            return console.log(`The file or directory "${input}" was not found.`);
        } else {
            throw e;
        }
    }

    if(stats.isFile()) {
        fn(input, output);
    } else if(stats.isDirectory()) {
        let walker = walk.walk(input);
        walker.on('file', (root, fileStats, next) => {
            let ext = path.extname(fileStats.name).toLowerCase();
            if(ext != '.xnb' && ext != '.json') return next();

            let targetDir = root.replace(input, output);
            let sourceFile = path.join(root, fileStats.name);

            let targetExt = ext == '.xnb' ? '.json' : '.xnb';
            let targetFile = path.join(targetDir, path.basename(fileStats.name, ext) + targetExt);

            fn(sourceFile, targetFile);
            next();
        });
    }
}
