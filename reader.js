'use strict';

let assert = require('assert');
let util = require('./util');

class BufferConsumer {
    constructor(buffer) {
        this.buffer = buffer;
        this.position = 0;
    }

    get length() {
        return this.buffer.length;
    }

    consume(amount) {
        let slice = this.buffer.slice(0, amount);
        this.buffer = this.buffer.slice(amount);
        this.position += amount;
        return slice;
    }

    consume7BitEncodedNumber() {
        let number = 0;
        let byte = 0;
        let bitsRead = 0;

        do {
            byte = this.consume(1).readUInt8(0);
            number += (byte & ~128) << bitsRead;
            bitsRead += 7;
        } while(byte & 128);

        return number;
    }
}

exports.BufferConsumer = BufferConsumer;

class Reader {
    isValueType() {
        return true;
    }
}

class DictionaryReader extends Reader {
    constructor(keyReader, valueReader) {
        super();
        this.keyReader = keyReader;
        this.valueReader = valueReader;
    }

    consume(buffer, readerResolver) {
        let dict = {};

        let count = buffer.consume(4).readUInt32LE(0);
        for(let i = 0; i < count; i++) {
            let key = this.keyReader ? this.keyReader.consume(buffer, readerResolver) : readerResolver.consume(buffer);
            let value = this.valueReader ? this.valueReader.consume(buffer, readerResolver) : readerResolver.consume(buffer);
            dict[key] = value;
        }

        return dict;
    }

    isValueType() {
        return false;
    }
}

class ArrayReader extends Reader {
    constructor(elementReader) {
        super();
        this.elementReader = elementReader;
    }

    consume(buffer, readerResolver) {
        let array = [];

        let count = buffer.consume(4).readUInt32LE(0);
        for(let i = 0; i < count; i++) {
            let element = this.elementReader ? this.elementReader.consume(buffer, readerResolver) : readerResolver.consume(buffer);
            array.push(element);
        }

        return array;
    }

    isValueType() {
        return false;
    }
}

class StringReader extends Reader {
    consume(buffer, readerResolver) {
        let size = buffer.consume7BitEncodedNumber();
        let string = buffer.consume(size).toString('utf8');
        return string;
    }

    isValueType() {
        return false;
    }
}

exports.StringReader = StringReader;

class Int32Reader extends Reader {
    consume(buffer, readerResolver) {
        return buffer.consume(4).readInt32LE(0);
    }
}

class BooleanReader extends Reader {
    consume(buffer, readerResolver) {
        return Boolean(buffer.consume(1).readUInt8(0));
    }
}

class ReaderResolver {
    constructor(readers) {
        this.readers = readers;
    }

    consume(buffer) {
        let index = buffer.consume7BitEncodedNumber() - 1;
        return this.readers[index].consume(buffer, this);
    }
}

exports.ReaderResolver = ReaderResolver;

function getReader(type) {
    let mainType = util.parseMainType(type);

    let isArray = mainType.endsWith('[]');
    if(isArray) {
        let arrayType = getReader(mainType.slice(0, -2));
        return new ArrayReader(arrayType.isValueType() ? arrayType : null);
    }

    switch(mainType) {
        case 'Microsoft.Xna.Framework.Content.DictionaryReader':
            let subtypes = util.parseSubtypes(type).map(getReader);
            let keyReader, valueReader;

            if(subtypes[0].isValueType()) keyReader = subtypes[0];
            if(subtypes[1].isValueType()) valueReader = subtypes[1];

            return new DictionaryReader(keyReader, valueReader);

        case 'Microsoft.Xna.Framework.Content.ArrayReader':
            let arrayType = util.parseSubtypes(type).map(getReader)[0];
            return new ArrayReader(arrayType.isValueType() ? arrayType : null);

        case 'Microsoft.Xna.Framework.Content.StringReader':
        case 'System.String':
            return new StringReader();

        case 'Microsoft.Xna.Framework.Content.Int32Reader':
        case 'System.Int32':
            return new Int32Reader();

        case 'Microsoft.Xna.Framework.Content.BooleanReader':
        case 'System.Boolean':
            return new BooleanReader();

        default:
            throw new util.ReadError('Non-implemented file reader for "' + type + '"');
    }
}

exports.getReader = getReader;
