'use strict';

let util = require('./util');
let fs = require('fs');
let PNG = require('pngjs').PNG;
let path = require('path');


function objectWalk(object, path, cb) {
    if(!object || typeof object != 'object') return;
    if(!cb) {
        cb = path;
        path = '';
    }

    if(util.isTypeObject(object)) {
        cb(object, path);
        objectWalk(object['data'], path, cb);
    } else {
        if(path) path += '.';
        for(let key in object) {
            objectWalk(object[key], path + key);
        }
    }
}

function onPresave(outputFile, data) {
    let images = [];

    objectWalk(data.content, (object, path) => {
        if(object.type == 'Texture2D') images.push(extractImage(object, path, outputFile));
    });

    if(images.length) {
        data.extractedImages = images;
    }

    return data;
}

exports.onPresave = onPresave;

function onPostload(inputFile, data) {
    let images = data.extractedImages || [];

    for(let i = 0; i < images.length; i++) {
        loadImage(images[i], inputFile, data);
    }

    return data;
}

exports.onPostload = onPostload;

function traversePath(object, path) {
    if(util.isTypeObject(object)) return traversePath(object['data'], path);
    if(!path) return object;
    let parts = path.split('.');
    return traversePath(object[parts[0]], parts.slice(1).join('.'));
}

function getImageName(baseFile, contentPath) {
    let ext = path.extname(baseFile);
    return path.join(path.dirname(baseFile), path.basename(baseFile, ext) + '.' + contentPath + '.png');
}

function extractImage(object, path, outputFile) {
    let png = new PNG({
        width: object.data.width,
        height: object.data.height,
        inputHasAlpha: true
    });

    png.data = object.data.data;

    let filename = getImageName(outputFile, path);
    let buffer = PNG.sync.write(png);
    fs.writeFileSync(filename, buffer);

    delete object.data.data;
    delete object.data.width;
    delete object.data.height;

    return {
        path: path
    }
}

function loadImage(image, inputFile, data) {
    let filename = getImageName(inputFile, image.path);
    let pngBuffer = fs.readFileSync(filename);
    let png = PNG.sync.read(pngBuffer);

    let container = traversePath(data.content, image.path);

    container.data = png.data;
    container.width = png.width;
    container.height = png.height;
}

