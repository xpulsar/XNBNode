'use strict';

let assert = require('assert');

class ReadError extends Error { }
exports.ReadError = ReadError;

function parseSubtypes(type) {
    let subtypeString = type.split('`')[1];
    let subtypeNum = subtypeString.slice(0, 1);

    subtypeString = subtypeString.slice(2, -1);

    let subtypes = [];
    let currentLevel = 0;
    let lastStartingPos = 0;
    for(let i = 0; i < subtypeString.length; i++) {
        let currentChar = subtypeString[i];
        if(currentChar == '[') {
            if(currentLevel == 0) lastStartingPos = i + 1;
            currentLevel += 1;
        } else if(currentChar == ']') {
            currentLevel -= 1;
            if(currentLevel == 0) subtypes.push(subtypeString.slice(lastStartingPos, i));
        }
    }

    assert.equal(subtypeNum, subtypes.length);
    return subtypes;
}
exports.parseSubtypes = parseSubtypes;

function parseMainType(type) {
    return type.split(/`|,/)[0];
}
exports.parseMainType = parseMainType;
