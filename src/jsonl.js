// Copyright 2018 Locomote Limited
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

/* Code for parsing multi-line JSON streams. */

import { openParserReader } from './streams.js';

const NEWLINE = 0x0A;

/**
 * A JSON lines parser. Breaks input data down into separate lines, where each
 * line is separated by the newline character, and then parses each line as a
 * JSON string.
 */
class JSONLParser {

    constructor() {
        // Buffer start offset.
        this.bufferStart = 0;
        // Abort flag.
        this.aborted = false;
        // An object for converting char arrays to strings.
        this.textDecoder = new TextDecoder('utf-8');
        // Event handlers.
        this.onValue = () => {};   // Called when a JSON line is parsed.
        this.onClose = () => {};   // Called at end of data.
        this.onError = () => {};   // Called if error.
    }

    /**
     * Add data to the parser buffer.
     * @param data  A Uint8Array of character data.
     */
    addData( data ) {
        if( this.buffer ) {
            // Resize the buffer and add the new data to the end.
            let buffer = new Uint8Array( this.buffer.length + data.length );
            buffer.set( this.buffer, 0 );
            buffer.set( data, this.buffer.length );
            this.buffer = buffer;
        }
        else {
            this.buffer = data;
            this.bufferStart = 0;
        }
        // Parse buffer contents.
        this._parseBuffer( false );
    }

    /**
     * End parsing.
     */
    close() {
        this._parseBuffer( true );
        this.onClose();
    }

    /**
     * Abort parsing with error.
     */
    abort( err ) {
        this.aborted = true;
        this.onError( err );
        this.close();
    }

    /**
     * Parse the internal data buffer.
     * @param complete  A flag indicating whether we're at end of data.
     */
    _parseBuffer( complete ) {
        if( this.aborted ) return;
        try {
            // Fetch local vars.
            const { buffer, textDecoder, onValue, onError, onClose } = this;
            // Iterate over the available data.
            let i, j, end = buffer.length - 1;
            for( i = this.bufferStart, j = i; j < buffer.length; j++ ) {
                // Check for newline or end of buffer if data is complete.
                // (In case the final line isn't terminated with a newline).
                if( buffer[j] == NEWLINE || (complete && j == end) ) {
                    // Extract the line data and convert to string.
                    let line = buffer.slice( i, j );
                    let json = textDecoder.decode( line );
                    if( json.length > 0 ) {
                        // Parse the line JSON and call the callback.
                        let obj = JSON.parse( json );
                        onValue( obj );
                    }
                    // Move to end of current line.
                    i = j;
                }
            }
            if( i != this.bufferStart ) {
                // Reset buffer to any non-parsed data at end of buffer.
                this.buffer = buffer.slice( i );
                this.bufferStart = 0;
            }
        }
        catch( e ) {
            // Notify error.
            this.abort( e );
        }
    }

}

/**
 * Create a reader on JSON lines input.
 * @param response  A fetch response object containing JSON lines content.
 * @param global    The global object.
 */
function openJSONLReader( response, global ) {
    // Check the response MIME type.
    let contentType = response.headers['Content-Type'];
    if( contentType && !contentType.startsWith('application/x-jsonlines') ) {
        throw new Error('Expected application/x-jsonlines MIME type');
    }
    const parser = new JSONLParser();
    return openParserReader( response, parser, global );
}

export { openJSONLReader };

