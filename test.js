'use strict';

let fs = require('fs');
let mkdirp = require('mkdirp');
let walk = require('walk');
let path = require('path');
let assert = require('assert');
let converter = require('./converter');
let util = require('./util');

let inputDir = '.\\content';
// let outputDir = '.\\out';

let walker = walk.walk(inputDir);
walker.on('file', function(root, fileStats, next) {
    let ext = path.extname(fileStats.name);
    if(ext.toLowerCase() == '.xnb') {
        // let targetDir = root.replace(inputDir, outputDir);

        let sourceFile = path.join(root, fileStats.name);
        // let targetFile = path.join(targetDir, path.basename(fileStats.name, ext) + '.json');

        // mkdirp.sync(targetDir);
        console.log(sourceFile);

        let originalBuffer = fs.readFileSync(sourceFile);
        let result;

        try {
            result = converter.XnbToJson(originalBuffer);
        } catch(e) {
            if(e instanceof util.ReadError) {
                console.log(e.message);
                return next();
            } else {
                throw e;
            }
        }

        let finalBuffer = converter.JsonToXnb(result);
        if(!originalBuffer.equals(finalBuffer)) {
            console.log('First Fail');
            let secondResult = converter.XnbToJson(finalBuffer);
            assert.equal(result, secondResult);
        }

    } else {
        console.log('~' + path.join(root, fileStats.name));
    }
    next();
});
