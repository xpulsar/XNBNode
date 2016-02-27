'use strict';

let ref = require('ref');
let util = require('./util');

class BufferWriter {
    constructor(buffer) {
        this.buffer = new Buffer(buffer || 0);
    }

    get length() {
        return this.buffer.length;
    }

    concat(buffer) {
        this.position += buffer.length;
        this.buffer = Buffer.concat([this.buffer, buffer]);
        this.buffer.type = ref.types.byte;
    }

    writeAscii(text) {
        let buffer = new Buffer(text.length);
        buffer.write(text, 0, text.length, 'ascii');
        this.concat(buffer);
    }

    writeByte(number) {
        let buffer = new Buffer(1);
        buffer.writeUInt8(number, 0);
        this.concat(buffer);
    }

    writeInt32LE(number) {
        let buffer = new Buffer(4);
        buffer.writeInt32LE(number, 0);
        this.concat(buffer);
    }

    write7BitEncodedNumber(number) {
        do {
            let byte = number & 127;
            number = number >> 7;
            if(number) byte |= 128;
            this.writeByte(byte);
        } while(number);
    }
}

exports.BufferWriter = BufferWriter;

class DictionaryWriter {
    constructor(keyType, valueType) {
        this.keyType = keyType;
        this.valueType = valueType;
    }

    write(buffer, dict, writerResolver) {
        let count = Object.keys(dict).length;
        buffer.writeInt32LE(count);
        for(let key of Object.keys(dict)) {
            let value = dict[key];
            writerResolver.write(buffer, this.keyType, key);
            writerResolver.write(buffer, this.valueType, value);
        }
    }
}

class ArrayWriter {
    constructor(elementType) {
        this.elementType = elementType;
    }

    write(buffer, array, writerResolver) {
        buffer.writeInt32LE(array.length);
        for(let i = 0; i < array.length; i++) {
            writerResolver.write(buffer, this.elementType, array[i]);
        }
    }
}

class StringWriter {
    write(buffer, text, writerResolver) {
        let stringBuffer = new Buffer(text.length * 2);
        let size = stringBuffer.write(text);
        buffer.write7BitEncodedNumber(size);
        buffer.concat(stringBuffer.slice(0, size));
    }
}

exports.StringWriter = StringWriter;

class Int32Writer {
    write(buffer, number, writerResolver) {
        buffer.writeInt32LE(Number(number));
    }
}

class BooleanWriter {
    write(buffer, boolean, writerResolver) {
        buffer.writeByte(Boolean(boolean) ? 1 : 0);
    }
}

class WriterResolver {
    constructor(readers) {
        this.readerData = {};
        for(let i = 0; i < readers.length; i++) {
            let reader = readers[i].type;

            let typeInfo = getTypeData(reader);
            typeInfo.index = i;

            this.readerData[typeInfo.type] = typeInfo;
        }
    }

    write(buffer, type, value) {
        let readerData = this.readerData[type];
        if(!readerData.valueType) {
            buffer.write7BitEncodedNumber(readerData.index + 1);
        }
        readerData.writer.write(buffer, value, this);
    }
}

exports.WriterResolver = WriterResolver;

// Oversimplification assuming at most one specialization of each type.

function getTypeData(type) {
    let mainType = util.parseMainType(type);

    let isArray = mainType.endsWith('[]');
    if(isArray) {
        let arrayType = getTypeData(mainType.slice(0, -2));
        return {
            type: 'Array',
            writer: new ArrayWriter(arrayType.type),
            valueType: false
        };
    }

    switch(mainType) {
        case 'Microsoft.Xna.Framework.Content.DictionaryReader':
            let subtypes = util.parseSubtypes(type).map(getTypeData)
                .map(typeData => typeData.type);

            return {
                type: 'Dictionary',
                writer: new DictionaryWriter(subtypes[0], subtypes[1]),
                valueType: false
            };

        case 'Microsoft.Xna.Framework.Content.ArrayReader':
            let arrayType = util.parseSubtypes(type).map(getTypeData)[0];
            return {
                type: 'Array',
                writer: new ArrayWriter(arrayType.type),
                valueType: false
            };

        case 'Microsoft.Xna.Framework.Content.StringReader':
        case 'System.String':
            return {
                type: 'String',
                writer: new StringWriter(),
                valueType: false
            };

        case 'Microsoft.Xna.Framework.Content.Int32Reader':
        case 'System.Int32':
            return {
                type: 'Int32',
                writer: new Int32Writer(),
                valueType: true
            };

        case 'Microsoft.Xna.Framework.Content.BooleanReader':
        case 'System.Boolean':
            return {
                type: 'Boolean',
                writer: new BooleanWriter(),
                valueType: true
            };

        default:
            throw new util.ReadError('Non-implemented file reader for "' + type + '"');
    }
}
