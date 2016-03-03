'use strict';

var program = require('commander');
let mkdirp = require('mkdirp');
let walk = require('walk');
let path = require('path');
let fs = require('fs');
let PNG = require('pngjs').PNG;
let converter = require('./converter');
let util = require('./util');
let typeyaml = require('./typeyaml');

program
    .option('-q, --quiet', 'don\'t output files being processed')
    .version('0.1.1');

program
    .command('extract <input> <output>')
    .description('extract XNB file or all files in directory')
    .action(function(input, output) {
        applyOrRecurse(extractXnb, input, output);
    });

program
    .command('pack <input> <output>')
    .description('pack XNB file or all files in directory')
    .action((input, output) => {
        applyOrRecurse(packXnb, input, output);
    });

program
    .action(() => program.help());

program.parse(process.argv);

if(!process.argv.slice(2).length) {
    program.help();
}

function extractXnb(inputFile, outputFile) {
    let inputBuffer = fs.readFileSync(inputFile);
    let data = converter.XnbToObject(inputBuffer);
    mkdirp.sync(path.dirname(outputFile));
    data = onPresave(outputFile, data);
    fs.writeFileSync(outputFile, typeyaml.stringify(data, 4), 'utf8');
}

function packXnb(inputFile, outputFile) {
    let inputYaml = fs.readFileSync(inputFile, 'utf8');
    let data = typeyaml.parse(inputYaml);
    data = onPostload(inputFile, data);
    let xnb = converter.ObjectToXnb(data);
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
            if(ext != '.xnb' && ext != '.yaml') return next();

            let targetDir = root.replace(input, output);
            let sourceFile = path.join(root, fileStats.name);
            if(!program.quiet) console.log(sourceFile);

            let targetExt = ext == '.xnb' ? '.yaml' : '.xnb';
            let targetFile = path.join(targetDir, path.basename(fileStats.name, ext) + targetExt);

            fn(sourceFile, targetFile);
            next();
        });
    }
}

function getImageName(baseFile, contentPath) {
    let ext = path.extname(baseFile);
    return path.join(path.dirname(baseFile), path.basename(baseFile, ext) + '.' + contentPath + '.png');
}

function onPresave(outputFile, data) {
    let images = extractImages(data.content);

    for(let i = 0; i < images.length; i++) {
        let image = images[i];
        let filename = getImageName(outputFile, image.path);

        let png = new PNG({
            width: image.width,
            height: image.height,
            inputHasAlpha: true
        });

        png.data = image.data;
        var buffer = PNG.sync.write(png);

        fs.writeFileSync(filename, buffer);

        delete image.data;
        delete image.width;
        delete image.height;
    }

    if(images.length) {
        data.extractedImages = images;
    }

    return data;
}

function extractImages(object, path) {
    if(!object || typeof object != 'object') return [];
    if(!path) path = '';

    let images = [];

    if(typeyaml.isTypeObject(object) && object.type == 'Texture2D') {
        images.push({
            data: object.data.data,
            width: object.data.width,
            height: object.data.height,
            path: path
        });

        delete object.data.data;
        delete object.data.width;
        delete object.data.height;
    } else if(Array.isArray(object)) {
        if(path) path += '.';
        for(let i = 0; i < object.length; i++) {
            images = images.concat(extractImages(object[i], path + i));
        }
    } else if(typeyaml.isTypeObject(object)) {
        images = images.concat(extractImages(object['data'], path));
    } else {
        if(path) path += '.';
        for(let key in object) {
            images = images.concat(extractImages(object[key], path + key));
        }
    }

    return images;
}

function objectWalk(object, path) {
    if(typeyaml.isTypeObject(object)) return objectWalk(object['data'], path);
    if(!path) return object;
    let parts = path.split('.');
    return objectWalk(object[parts[0]], parts.slice(1).join('.'));
}

function onPostload(inputFile, data) {
    let images = data.extractedImages;
    if(!images) return data;

    for(let i = 0; i< images.length; i++) {
        let image = images[i];

        let filename = getImageName(inputFile, image.path);
        let pngBuffer = fs.readFileSync(filename);
        let png = PNG.sync.read(pngBuffer);

        let container = objectWalk(data.content, image.path);
        container.data = png.data;
        container.width = png.width;
        container.height = png.height;
    }

    return data;
}
