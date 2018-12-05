// Copyright 2018 Julian Goacher
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* Functions for unzipping data. */

import { JSInflate } from './inflate.js';

const { openParserReader } = self.streams;

const Fields = {
    /**
     * A numeric zip file header field.
     * @param name  The field name.
     * @param size  The field length, in bytes.
     */
    number: function( name, size ) {
        let length = () => size;
        let read = ( entry, input, start ) => {
            let result = 0;
            let i = start + size - 1;
            while( i >= start ) {
                result = (result << 8) + input[i];
                i--;
            }
            return result;
        };
        return { name, length, read };
    },
    /**
     * A string zip file header field.
     * @param name      The field name.
     * @param length    A function for reading the field length from the
     *                  associated zip entry.
     */
    string: function( name, length ) {
        let read = ( entry, input, start ) => {
            let end = start + length( entry );
            return entry.textDecoder.decode( input.slice( start, end ) );
        };
        return { name, length, read };
    },
    /**
     * A data buffer field.
     * @param name      The field name.
     * @param length    A function for reading the field length from the
     *                  associated zip entry.
     */
    buffer: function( name, length ) {
        let read = ( entry, input, start ) => {
            let end = start + length( entry );
            return input.slice( start, end );
        }
        return { name, length, read };
    },
    /**
     * An optional field, which is only read if a specified test returns true.
     * @param test      A function to test whether to read the field.
     * @param field     The field being made optional.
     */
    optional: function( test, field ) {
        // If the specified test returns false then the field's length is
        // returned as zero, otherwise the nested field's length is returned.
        let length = entry => {
            return test( entry ) ? field.length( entry ) : 0;
        };
        let read = ( entry, input, start ) => {
            return test( entry ) ? field.read( entry, input, start ) : undefined;
        }
        let { name } = field;
        return { name, length, read };
    }
};

/**
 * A function to inflate compressed data.
 */
function inflate( data ) {
    // TODO Hacked together inflate polyfill.
    data = String.fromCharCode.apply( String, data );
    return JSInflate.inflate( data );
}

/// Magic number used to confirm presence of a zip file stream.
const MAGIC_NUMBER = 0x04034b50;

/**
 * An entry in a zip file.
 * With thanks to https://github.com/augustl/js-unzip/tree/8b8260da4d6b2189e02e1ca76592c729e1a7b307.
 */
class ZipEntry {

    constructor() {
        this.fields = [
            Fields.number('_signature', 4 ),
            Fields.number('_versionNeeded', 2 ),
            Fields.number('_bitFlag', 2 ),
            Fields.number('_compressionMethod', 2 ),
            Fields.number('_timeBlob', 4 ),
            Fields.number('_crc32', 4 ),
            Fields.number('_compressedSize', 4 ),
            Fields.number('_uncompressedSize', 4 ),
            Fields.number('_fileNameLength', 2 ),
            Fields.number('_extraFieldLength', 2 ),
            Fields.string('filename', entry => entry._fileNameLength ),
            Fields.string('_extra', entry => entry._extraFieldLength ),
            // The entry data.
            Fields.buffer('_data', entry => entry._compressedSize ),
            // Optional trailing descriptor.
            Fields.optional(
                entry => entry.isUsingBit3TrailingDataDescriptor(),
                Fields.number('_descriptor', 16 ) )
        ];
        this.fieldIdx = 0;
        this._complete = false;
        this._isZipEntry = true;
    }

    process( buffer, start, available ) {
        let consumed = 0;
        // Read header fields.
        while( this.fieldIdx < this.fields.length ) {
            let field = this.fields[this.fieldIdx++];
            let length = field.length( this );
            if( length < available ) {
                let value = field.read( this, buffer, start );
                this[field.name] = value;
                available -= length;
                consumed += length;
                start += length;
            }
            else break;
        }
        if( this.fieldIdx > 0 && this._signature !== MAGIC_NUMBER ) {
            this._complete = true;
            this._isZipEntry = false;
        }
        if( this.fieldIdx >= this.fields.length ) {
            this._complete = true;
            // Test that the entry is valid.
            if( this.isUsingZip64() ) {
                this._error = 'Unsupported Zip64 format';
            }
        }
        return consumed;
    }

    get error() {
        return this._error;
    }

    get hasError() {
        return this._error !== undefined;
    }

    get isZipEntry() {
        return this._isZipEntry;
    }

    get complete() {
        return this._complete;
    }

    get textDecoder() {
        return new TextDecoder();
    }

    get data() {
        if( this.isEncrypted() ) {
            return inflate( this._data );
        }
        return this._data;
    }

    get text() {
        // HACKY
        let text = this.data;
        if( text instanceof Uint8Array ) {
            text = new TextDecoder().decode( this.data );
        }
        return text;
    }

    isEncrypted() {
        return true;
        //console.log(this._bitFlag,this._bitFlag & 0x01);
        //return (this._bitFlag & 0x01) === 0x01;
    }

    isUsingUtf8() {
        return (this._bitFlag & 0x0800) === 0x0800;
    }

    isUsingBit3TrailingDataDescriptor() {
        return (this._bitFlag & 0x0008) === 0x0008;
    }

    isUsingZip64() {
        this._compressedSize === 0xFFFFFFFF || this._uncompressedSize === 0xFFFFFFFF;
    }
}

/**
 * A class for unzipping a stream of data.
 * Accepts chunks of data as input and generates zip file entries from them.
 */
class Unzipper {

    constructor() {
        // The internal buffer; starts at 4k size, is increased as needed.
        this.buffer = new Uint8Array( 4096 );
        // Boundaries of currently unprocessed data in the buffer.
        this.bufferStart = 0;
        this.bufferEnd = 0;
        // Unzipper status.
        this.done = false;
        // Callbacks.
        this.onValue = () => {};    // Notify that a complete zip file entry is available.
        this.onClose = () => {};    // Notify that the stream has been closed.
        this.onError = () => {};    // Notify of an error.
    }

    /**
     * Add data to the unzippers internal buffer.
     */
    addData( data ) {
        // Read buffer bounds and available space.
        let { bufferStart, bufferEnd } = this;
        let bufferSize = this.buffer.length;
        let appendFree = bufferSize - bufferEnd;
        let totalFree = appendFree + bufferStart;
        // Work out how to add the data to the buffer.
        if( data.length <= appendFree ) {
            // Space at end of buffer for new data.
            buffer.set( data, ++bufferEnd );
            this.bufferEnd = bufferEnd;
        }
        else if( data.length <= totalFree ) {
            // Space within buffer for new data, but needs to be reorganized.
            this.buffer.copyWithin( 0, bufferStart, bufferEnd );
            this.buffer.set( data, ++bufferEnd );
            this.bufferStart = 0;
            this.bufferEnd = bufferEnd + data.length;
        }
        else {
            // Data is larger than free space in buffer, so resize buffer.
            let newSize = (bufferSize - totalFree) + data.length;
            let buffer = new Uint8Array( newSize );
            buffer.set( this.buffer.slice( bufferStart, bufferEnd ), 0 );
            buffer.set( data, bufferEnd );
            this.buffer = buffer;
            this.bufferStart = 0;
            this.bufferEnd = bufferEnd + data.length;
        }
        this._processBuffer();
    }

    /// Process the buffer contents.
    _processBuffer() {
        // Read local vars.
        let { entry } = this;
        while( true ) {
            // Calculate number of available bytes on the buffer.
            let available = this.bufferEnd - this.bufferStart;
            if( available <= 0 ) {
                break;
            }
            // If no current entry then create a new one.
            if( !entry ) {
                entry = this.entry = new ZipEntry();
            }
            // Delegate processing to the entry; this will read as much data as it
            // can from the buffer.
            this.bufferStart += entry.process( this.buffer, this.bufferStart, available );
            // If the entry is now complete...
            if( entry.complete ) {
                console.log(entry.filename, entry._uncompressedSize);
                // ... then notify listeners and then delete the current entry.
                if( !entry.isZipEntry ) {
                    this.close();
                    break;
                }
                if( entry.hasError ) {
                    this.onError( entry.error );
                    break;
                }
                this.onValue( entry );
                entry = this.entry = null;
            }
            // If entry incomplete then need more data - break until it arrives.
            else break;
        }
    }

    close() {
        if( !this.done ) {
            this.done = true;
            this.onClose();
        }
    }

    abort( err ) {
        this.onError( err );
        this.close();
    }

}

function openUnzipReader( response, global ) {
    const unzipper = new Unzipper();
    return openParserReader( response, unzipper, global );
}

export { openUnzipReader };

