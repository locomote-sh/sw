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

/* Utility and support functions. */

//const LogPrefix = '[locomote] ';
const LogPrefix = '\u{1f682} '; // https://emojipedia.org/steam-locomotive/

// const DebugPrefix = '* ';
const DebugPrefix = '\u{1f41e} '; // https://emojipedia.org/lady-beetle/

/**
 * Log function.
 * @level   The log level; optional, can be 'error' or 'debug'; used as
 *          the log message otherwise.
 * @msg     The log message, when a log level is supplied; otherwise used
 *          as the first log message argument.
 * @args    Log message arguments.
 */
function log( level, msg, ...args ) {
    switch( level ) {
        case 'error':
            break;
        case 'debug':
            level = 'log';
            msg = DebugPrefix+msg;
            break;
        default:
            // No log level supplied - move the msg arg, if any, to the
            // list of message arguments, and use the level arg as the
            // log message.
            if( msg !== undefined ) {
                args.unshift( msg );
            }
            msg = level;
            level = 'log';
    }
    args.unshift( LogPrefix+msg );
    console[level].apply( console, args );
}

/**
 * Parse a request URL to extract request parameters and the
 * portion of the request path relative to the content origin
 * root.
 * @param request   A fetch request.
 * @param url       A content origin URL.
 */
function parseURL( request, url ) {
    let path = request.url.substring( url.length );
    let i = path.indexOf('?');
    let params;
    if( i > 0 ) {
        let query = path.substring( i + 1 );
        params = new URLSearchParams( query );
        path = path.substring( 0, i );
    }
    else {
        params = new URLSearchParams('');
    }
    return { path, params };
}

/**
 * Extract the file extension from a path.
 * Returns the file extension, including the '.' prefix,
 * or null if the path doesn't have a file extension.
 */
function extname( path ) {
    for( let i = path.length - 1; i >= 0; i-- ) {
        switch( path.charCodeAt( i ) ) {
            case 0x2E: // .
                return path.substring( i );
            case 0x2F: // forward slash
                return null;
        }
    }
    return null;
}

/**
 * Join one or more subpaths to a path.
 */
function joinPath( path, ...subpaths ) {
    for( const subpath of subpaths ) {
        const trailing = path.charCodeAt( path.length - 1 ) == 0x2F;
        const leading = subpath.charCodeAt( 0 ) == 0x2F;
        if( trailing && leading ) {
            path += subpath.substring( 1 );
        }
        else if( trailing || leading ) {
            path += subpath;
        }
        else if( path.length > 0 ) {
            path += '/'+subpath;
        }
        else path = subpath;
    }
    return path;
}

/**
 * Make an error response to a fetch request.
 * @param path      A request path.
 * @param status    An error status.
 */
function makeErrorResponse( path, status ) {
    return new Response('', { status });
}

/**
 * Make a JSON response to a fetch request.
 * @param data  The JSON data.
 */
function makeJSONResponse( data ) {
    const body = JSON.stringify( data );
    const response = new Response( body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
    return response;
}

/**
 * Make a HTML response to a fetch request.
 * @param path  A request path.
 * @param html  The HTML body.
 */
function makeHTMLResponse( path, html ) {
    const response = new Response( html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
    });
    return response;
}

// Standard MIME types by file extension.
const MIMETypes = {
    'txt':  'text/plain',
    'html': 'text/html',
    'xml':  'application/xml',
    'js':   'application/javascript',
    'json': 'application/json',
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'png':  'image/png',
    'gif':  'image/gif',
    'svg':  'image/svg+xml'
}

/**
 * Add a MIME type mapping.
 */
function addMIMEType( ext, type ) {
    MIMETypes[ext] = type;
}

/**
 * Return the MIME type of a file.
 */
function getMIMEType( filename ) {
    let type;
    let idx = filename.lastIndexOf('.');
    if( idx > 0 ) {
        let ext = filename.substring( idx + 1 );
        type = MIMETypes[ext];
    }
    return type || 'application/octet-stream';
}

/**
 * Get a fileset configuration from an origin configuration.
 */
function getFileset( origin, category ) {
    const fileset = origin.filesets[category];
    if( !fileset ) {
        throw new Error(`Bad fileset category name '${category}'`);
    }
    return fileset;
}

export {
    log,
    parseURL,
    extname,
    joinPath,
    makeErrorResponse,
    makeJSONResponse,
    makeHTMLResponse,
    addMIMEType,
    getMIMEType,
    getFileset
};
