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

/* Utilities for working with streams. */

/**
 * A parser transformer. Takes input from a stream and passes it through
 * a parser; the parser result is then written to an output stream.
 * The parser must implement onValue / onClose / onError event handlers.
 * Instances of this class can be used by the Body.pipeThrough method.
 */
class ParserTransformer {

    constructor( parser ) {

        // Initialize the output stream.
        this.readable = new ReadableStream({
            start( controller ) {
                parser.onValue = obj => controller.enqueue( obj );
                parser.onClose = ()  => controller.close();
                parser.onError = err => controller.error( err );
            }
        });

        // Initialize the input stream.
        this.writable = new WritableStream({
            write( data ) {
                parser.addData( data );
            },
            close() {
                parser.close();
            },
            abort( err ) {
                parser.abort( err );
            }
        });

    }

}

/**
 * A readable stream polyfill for platforms where streams aren't
 * available. Accepts data from a Response object, passes it to
 * a parser instance, and makes the result available to through
 * a Reader compatible interface.
 */
class ReaderPolyfill {

    constructor( parser ) {

        this.values = [];
        this.clients = [];
        this.done = false;

        this.parser = parser;
        this.parser.onValue = ( value ) => {
            // Check for a waiting clients.
            if( this.clients.length > 0 ) {
                let { resolve } = this.clients.shift();
                resolve({ done: false, value });
            }
            else {
                // Else queue the value.
                this.values.push( value );
            }
        };
        this.parser.onClose = ()  => this.done = true;
        this.parser.onError = err => {
            // Check for a waiting clients.
            if( this.clients.length > 0 ) {
                let { reject } = this.clients.shift();
                reject( err );
            }
            else {
                // Else keep error until next read call.
                this.error = err;
            }
        }
    }

    setData( data ) {
        this.parser.addData( data );
        this.parser.close();
    }

    read() {
        return new Promise( ( resolve, reject ) => {
            if( this.error ) {
                reject( this.error );
                delete this.error;
            }
            else if( this.values.length > 0 ) {
                let value = this.values.shift();
                resolve({ done: false, value });
            }
            else if( this.done ) {
                resolve({ done: true });
            }
            else this.clients.push({ resolve, reject });
        });
    }

}

/**
 * Pass response data through a parser and return a reader stream on the result.
 * If the code platform supports the ReadableStream and WritableStream APIs then
 * these are used to create a transformer stream, and the code will run in full
 * streaming mode.
 * If the stream APIs aren't available then a polyfill is used in its place;
 * however, the code will be unable to run in full streaming mode, with consequent
 * impacts on memory performance, particularly with large input data sizes.
 * @param response  A fetch response.
 * @param parser    A parser to apply to the response data.
 * @param global    (Optional) The global object - defaults to 'window'.
 */
function openParserReader( response, parser, global = window ) {
    // If readable and writable streams API available the use transformer.
    if( global.ReadableStream && global.WritableStream ) {
        const transformer = new ParserTransformer( parser );
        const stream = response.body.pipeThrough( transformer );
        return stream.getReader();
    }
    // Otherwise use a reader polyfill that works with all data in single buffer.
    const reader = new ReaderPolyfill( parser );
    // Set the data within a timeout - this is so that the reader client code is
    // in place before parsing begins, allowing processing to continue asap.
    setTimeout( async () => {
        try {
            const buffer = await response.arrayBuffer();
            const data = new Int8Array( buffer );
            reader.setData( data );
            console.log('Reader data set');
        }
        catch( e ) {
            console.error('Reading response data', e );
        }
    }, 1 );
    return reader;
}

export { openParserReader };

