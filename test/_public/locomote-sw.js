/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _support_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var _streams_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var _origin_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(3);
/* harmony import */ var _hooks_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(7);
/* harmony import */ var _idb_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4);
/* harmony import */ var _query_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(5);
/* harmony import */ var _router_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(8);
/* harmony import */ var _refresh_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(9);
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

/* Core service worker functionality. */










const { Origins } = _origin_js__WEBPACK_IMPORTED_MODULE_2__;

// Broadcast a message to all service worker clients.
async function broadcast( message ) {
    let clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach( client => client.postMessage( message ) );
}

// A list of URLs to add to the static cache.
self.staticURLs = [];

// Refresh all content origins.
async function refreshAll() {
    const { refreshOrigin } = self.refresh;
    for( let origin of Origins ) {
        await refreshOrigin( origin );
    }
}

// Perform the service worker installation.
async function install() {
    console.log('Locomote: Starting service worker installation');
    // Refresh all content origins.
    await refreshAll();
    console.log('Locomote: Refreshed %d content origin(s)', Origins.length );
    // Clear out any previously cached statics.
    await caches.delete('statics');
    let { staticURLs } = self;
    if( staticURLs.length > 0 ) {
        // Add current statics to cache.
        const cache = await caches.open('statics');
        await cache.addAll( staticURLs );
        console.log('Locomote: Pre-cached %d static URL(s)', staticURLs.length );
    }
    console.log('Locomote: Service worker installation completed');
}

// Activate the service worker.
async function activate() {
    await clients.claim();
    console.log('Locomote: Service worker activated');
}

// Sub-module export for plugin support.
self.support = _support_js__WEBPACK_IMPORTED_MODULE_0__;
self.streams = _streams_js__WEBPACK_IMPORTED_MODULE_1__;
self.origin  = _origin_js__WEBPACK_IMPORTED_MODULE_2__;
self.hooks   = _hooks_js__WEBPACK_IMPORTED_MODULE_3__;
self.idb     = _idb_js__WEBPACK_IMPORTED_MODULE_4__;
self.query   = _query_js__WEBPACK_IMPORTED_MODULE_5__["query"];
self.refresh = _refresh_js__WEBPACK_IMPORTED_MODULE_7__;

// Methods for adding origins.
self.addOrigin = _origin_js__WEBPACK_IMPORTED_MODULE_2__["addOrigin"];
self.addOrigins = _origin_js__WEBPACK_IMPORTED_MODULE_2__["addOrigins"];

// Event handling.
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil( install() );
});

self.addEventListener('activate', event => {
    event.waitUntil( activate() );
});

self.addEventListener('message', event => {
    let { name, args } = event;
    switch( name ) {
        case 'refresh':
            refreshAll();
            break;
    }
});

self.addEventListener('fetch', event => {
    event.respondWith( Object(_router_js__WEBPACK_IMPORTED_MODULE_6__["route"])( event.request, Origins ) );
});

/**
 * Add a list of URLs to the static cache.
 */
self.staticCache = function( urls ) {
    if( typeof urls == 'string' ) {
        urls = [ urls ];
    }
    else if( !Array.isArray( urls ) ) {
        throw new Error('String or array argument expected in staticCache()');
    }
    self.staticURLs = self.staticURLs.concat( urls );
}


/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "parseURL", function() { return parseURL; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "makeErrorResponse", function() { return makeErrorResponse; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "makeJSONResponse", function() { return makeJSONResponse; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "makeHTMLResponse", function() { return makeHTMLResponse; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "addMIMEType", function() { return addMIMEType; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getMIMEType", function() { return getMIMEType; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getFileset", function() { return getFileset; });
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
    let body = JSON.stringify( data );
    let response = new Response( body, {
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
    let response = new Response( html, {
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
    let fileset = origin.filesets[category];
    if( !fileset ) {
        throw new Error(`Bad fileset category name ${category}`);
    }
    return fileset;
}




/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "openParserReader", function() { return openParserReader; });
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





/***/ }),
/* 3 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Origins", function() { return Origins; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "DefaultOrigin", function() { return DefaultOrigin; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "addOrigin", function() { return addOrigin; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "addOrigins", function() { return addOrigins; });
/* harmony import */ var _idb_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
/* harmony import */ var _support_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1);
/* harmony import */ var _query_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(5);
/* harmony import */ var _tinytemper_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6);
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

/* Default content origin configuration, and functions for registering configs. */









// The list of available origins. */
const Origins = [];

/* The default content origin configuration. */
const DefaultOrigin = {

    /* Dynamic request endpoints. */
    dynamics: {
        /* File query endpoint. */
        'query.api': async function( request, path, params ) {
            try {
                const result = await Object(_query_js__WEBPACK_IMPORTED_MODULE_2__["query"])( this, params );
                return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeJSONResponse"])( result );
            }
            catch( e ) {
                console.log('Locomote: Error executing query', e );
                return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeErrorResponse"])( path, 500 );
            }
        }
    },

    /* Fileset category definitions. */
    filesets: {
        'app':           fileset('app', true ),
        'app/templates': fileset('app/templates', false ),
        'assets':        fileset('assets', true ),
        'content/pages': fileset('content/pages', false, pageFetch ),
        'content/data':  fileset('content/data', false, dataFetch ),
        'files':         fileset('files', true ),
        'server':        fileset('server', false )
    },

    /* Database schema. */
    schema: {
        version: 1,
        stores: {
            'files': {
                options: {
                    keyPath: 'path'
                },
                indexes: {
                    'category': {
                        keyPath: 'category',
                        options: { unique: false }
                    },
                    'status': {
                        keyPath: 'status',
                        options: { unique: false }
                    },
                    'page-type': {
                        keyPath: 'page.type',
                        options: { unique: false }
                    }
                }
            }
        }
    },

    /* Origin configuration settings. */
    settings: {
        // Default function for evaluating page templates.
        pageTemplateEval: _tinytemper_js__WEBPACK_IMPORTED_MODULE_3__["TinyTemper"].evaluate
    }
};

/**
 * Fetch page content. The page body is stored on the file record, and if
 * a 'format' parameter is provided with the value 'body-only' then only
 * the page body is returned; otherwise, the page body is combined with
 * a page template to produce the complete HTML file content.
 * @param request   The fetch request being processed.
 * @param path      The requested file path, relative to the origin.
 * @param params    Request parameters.
 * @param record    The file record.
 */
async function pageFetch( request, path, params, record ) {
    const { page } = record;
    // Check we have a page.
    if( !page ) {
        return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeErrorResponse"])( path, 404 );
    }
    // Read the body and return just that if requested.
    const { type, body } = page;
    if( params.get('format') == 'body-only' ) {
        return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeHTMLResponse"])( body );
    }
    // Load the page template.
    const origin = this;
    const template = await loadPageTemplate( origin, type );
    if( !template ) {
        return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeHTMLResponse"])( body );
    }
    // Combine the body with page template to generate the full page.
    const html = await evalTemplate( origin, template, { type, body, page, record });
    return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeHTMLResponse"])( html );
}

/**
 * Load a page template.
 * @param origin    The content origin.
 * @param pageType  The page type.
 */
async function loadPageTemplate( origin, pageType ) {
    const path = `_templates/page-${pageType}.html`;
    const record = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbRead"])( origin, path );
    if( !record ) {
        return undefined;
    }
    let { page } = record;
    if( !page ) {
        return undefined;
    }
    return page.body;
}

/**
 * Evaluate a page template.
 * @param origin    The content origin.
 * @param template  The template text.
 * @param context   The template context.
 */
function evalTemplate( origin, template, context ) {
    // The actual template eval function is stored in the content
    // origin's settings - this allows a content origin to use
    // an alternative templating method, by replacing this function.
    return origin.settings.pageTemplateEval( template, context );
}

/**
 * Fetch data content. The data is stored on the file record and this
 * is extracted from the record and returned as a JSON document.
 * @param request   The fetch request being processed.
 * @param path      The requested file path, relative to the origin.
 * @param params    Request parameters.
 * @param record    The file record.
 */
function dataFetch( request, path, params, record ) {
    const { data } = record;
    if( !data ) {
        return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeErrorResponse"])( path, 204 );
    }
    return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeJSONResponse"])( data );
}

/**
 * Initialize a content origin configuration.
 * @param config    A content origin configuration, can be either:
 *                  - A string specifying a content origin URL; the
 *                    the default origin configuration is used.
 *                  - A complete content origin configuration.
 */
function initOrigin( config ) {
    // If configuration is a string then use this as the URL of a content
    // origin with the default configuration.
    if( typeof config == 'string' ) {
        let url = config;
        // Ensure that the content URL ends with a slash.
        if( !url.endsWith('/') ) {
            url = url+'/';
        }
        return Object.assign({ url }, DefaultOrigin );
    }
    let { url, dynamics, filesets, settings, schema } = config;
    // Ensure we have a content URL.
    if( !url ) {
        throw new Error('Content origin configuration must specify a URL');
    }
    // Ensure that the content URL ends with a slash.
    if( !url.endsWith('/') ) {
        url = url+'/';
    }
    // Following code implements a targeted merge of the custom origin's
    // configuration over the default configuration.
    // - The custom configuration URL is always copied to the result.
    // - The custom configuration's dynamic endpoints are copied over the
    //   default config's endpoints.
    // - The custom configuration's filesets are copied over the default
    //   config's filesets.
    // - The custom configuration's settings are copied over the default
    //   config's settings.
    // - The DB schemas are merged according to the method described in
    //   the mergeDBSchema() function.
    return {
        url:        url,
        dynamics:   Object.assign( {}, DefaultOrigin.dynamics, dynamics ),
        filesets:   Object.assign( {}, DefaultOrigin.filesets, filesets ),
        settings:   Object.assign( {}, DefaultOrigin.settings, settings ),
        schema:     mergeDBSchema( DefaultOrigin.schema, schema )
    };
}

/**
 * Merge two database schemas.
 * @param s1    A database schema (required).
 * @param s2    A database schema (optional).
 */
function mergeDBSchema( s1, s2 ) {
    // If only one argument then return it as the result.
    if( s2 === undefined ) {
        return s1;
    }
    // Initialize result with properties from first schema.
    let result = Object.assign( {}, s1 );
    let { version, stores } = s2;
    // Ensure second schema has required values.
    if( version === undefined ) {
        throw new Error('Database schema must specify version');
    }
    if( stores === undefined ) {
        throw new Error('Database schema must define object stores');
    }
    // Overwrite schema version with value;
    result.version = version;
    // Merge object store definitions.
    result.stores = Object.assign( {}, s1.stores, stores );
    return result;
}

/**
 * Initialize a fileset descriptor.
 * @param name      The fileset name.
 * @param cachable  A boolean specifying whether files within the fileset
 *                  are stored within the service worker's response cache.
 * @param fetcher   (Optional) a function for handling fetch requests for
 *                  files within the fileset.
 */
function fileset( name, cachable, fetcher ) {
    let cacheName = cachable ? name : undefined;
    return { name, cacheName, fetcher };
}

/**
 * Register an origin configuration.
 */
function addOrigin( origin ) {
    Origins.push( initOrigin( origin ) );
}

/**
 * Register multiple origin configurations.
 */
function addOrigins( origins ) {
    if( !Array.isArray( origins ) ) {
        origins = [ origins ];
    }
    origins.forEach( origin => addOrigin( origin ) );
}




/***/ }),
/* 4 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbOpen", function() { return idbOpen; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbOpenObjStore", function() { return idbOpenObjStore; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbRead", function() { return idbRead; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbReadAll", function() { return idbReadAll; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbWrite", function() { return idbWrite; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbDelete", function() { return idbDelete; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbOpenPK", function() { return idbOpenPK; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "idbOpenIndex", function() { return idbOpenIndex; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fdbOpenObjStore", function() { return fdbOpenObjStore; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fdbForEach", function() { return fdbForEach; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fdbRead", function() { return fdbRead; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fdbReadAll", function() { return fdbReadAll; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "fdbWrite", function() { return fdbWrite; });
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

/* Functions for working with IndexedDB databases. */

/**
 * Open an IndexedDB connection.
 * @param origin    The content origin configuration.
 */
async function idbOpen( origin ) {
    const { schema, url } = origin;
    const { name = url, version } = schema;
    const db = await new Promise( ( resolve, reject ) => {
        const request = indexedDB.open( name, version );
        request.onsuccess = ( e ) => {
            resolve( request.result );
        };
        request.onerror = ( e ) => {
            reject( request.error );
        };
        request.onupgradeneeded = ( e ) => {
            idbInit( schema, e.target.result );
        };
    });
    return db;
}

/**
 * Initialize an IndexedDB instance.
 * @param schema    The DB schema.
 * @param db        The DB connection.
 */
function idbInit( schema, db ) {
    const { stores } = schema;
    for( let name in stores ) {
        const { options, indexes } = stores[name];
        const objStore = db.createObjectStore( name, options );
        for( let index in indexes ) {
            const { keyPath, options } = indexes[index];
            objStore.createIndex( index, keyPath, options );
        }
    }
}

/**
 * Open a transaction on an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param mode      The transaction mode; defaults to 'readonly'.
 */
async function idbOpenObjStore( origin, store, mode = 'readonly' ) {
    const db = await idbOpen( origin );
    return db.transaction( store, mode ).objectStore( store );
}

/**
 * Read an object from an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param key       An object primary key.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbRead( origin, store, key, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.get( key );
        request.onsuccess = () => resolve( request.result );
        request.onerror   = () => reject( request.error );
    });
}

/**
 * Read a list of objects from an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param keys      A list of object primary keys.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbReadAll( origin, store, keys, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return Promise.all( keys.map( key => {
        return idbRead( origin, store, key, objStore );
    }));
}

/**
 * Write an object to an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param object    The object to write.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbWrite( origin, store, object, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.put( object );
        request.onsuccess = resolve;
        request.onerror   = reject;
    });
}

/**
 * Delete an object from an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param key       An object primary key.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbDelete( origin, store, key, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.delete( key );
        request.onsuccess = resolve;
        request.onerror   = reject;
    });
}

/**
 * Open a cursor on an object store's primary key index.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param term      An index filter term.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbOpenPK( origin, store, term, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return objStore.openCursor( term );
}

/**
 * Open a cursor on an object store index.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param index     The name of the index to open.
 * @param term      An index filter term.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbOpenIndex( origin, store, index, term, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return objStore.index( index ).openCursor( term );
}

/**
 * Open the file object store.
 * @param origin    The content origin configuration.
 * @param mode      The transaction mode; defaults to 'readonly'.
 */
function fdbOpenObjStore( origin, mode ) {
    return idbOpenObjStore( origin, 'files', mode );
}

/**
 * Iterate over file DB records.
 * @param origin    The content origin configuration.
 * @param index     The name of a file DB index.
 * @param term      An index filter term.
 * @param callback  A callback function called once for each file record that
 *                  matches the search term. The callback function may be
 *                  asynchonous, and the iterator will wait for the function
 *                  to complete before continuing to the next result.
 */
async function fdbForEach( origin, index, term, callback ) {
    const request = await idbOpenIndex( origin, 'files', index, term );
    // Supporting an async callback is tricky here - the IDB transaction
    // will close once (1) request.onsuccess callback is called and (2)
    // control then returns to the main event loop. This means that after
    // an async call to the callback function, the cursor.continue() call
    // will be to a closed transaction. As a workaround, the following
    // code first synchronously builds a list of record keys within the
    // index, and then uses this list to load each record in turn before
    // calling the async callback. This approach avoids loading the full
    // dataset into memory and so delivers some of the advantage of an
    // iterative approach.
    const keys = await new Promise( ( resolve, reject ) => {
        const keys = [];
        request.onsuccess = ( e ) => {
            const cursor = e.target.result;
            if( cursor ) {
                const { primaryKey } = cursor;
                keys.push( primaryKey );
                cursor.continue();
            }
            else resolve( keys );
        };
        request.onerror = () => reject( request.error );
    });
    // Iterate over record keys, load each record and call the callback.
    for( let key of keys ) {
        const record = await fdbRead( origin, key );
        await callback( record );
    }
}

/**
 * Read a file record from the file DB.
 * @param origin    The content origin configuration.
 * @param path      A file path, relative to the content origin root.
 */
function fdbRead( origin, path ) {
    return idbRead( origin, 'files', path );
}

/**
 * Read a list of file records from the file DB.
 * @param origin    The content origin configuration.
 * @param paths     A list of file paths.
 */
function fdbReadAll( origin, paths ) {
    return idbReadAll( origin, 'files', paths );
}

/**
 * Write a file record to the file DB.
 * @param origin    The content origin configuration.
 * @param record    The record to write.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function fdbWrite( origin, record, objStore = fdbOpenObjStore( origin, 'readwrite') ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.put( record );
        request.onsuccess = resolve;
        request.onerror   = reject;
    });
}





/***/ }),
/* 5 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "query", function() { return query; });
/* harmony import */ var _idb_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
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

/* A standard API for querying the file DB. */

function init(
    { indexedDB, IDBKeyRange },
    { idbOpenObjStore, idbOpenPK, idbOpenIndex, fdbReadAll }) {

    /**
     * Execute a query on an object store.
     * @param idb       IndexedDB functions.
     * @param origin    The content origin configuration.
     * @param params    The query parameters.
     */
    async function query( origin, params ) {

        // Convert URLSearchParam to plain JS object.
        if( params instanceof URLSearchParams ) {
            let _params = {};
            for( let key of params.keys() ) {
                _params[key] = params.get( key );
            }
            params = _params;
        }

        // Open the files object store.
        const objStore = await idbOpenObjStore( origin, 'files');

        // Run the query.
        const results = await new Promise( ( resolve, reject ) => {

            // Result list - an array of matching primary keys.
            const results = [];
            // Initialize index cursors using query parameters.
            const cursors = new QueryCursors( objStore, params );
            
            // Check for null result.
            if( cursors.isNull() ) {
                return resolve( results );
            }

            let match;      // A primary key which matches the query terms.
            let prevKey;    // The previously matched primary key.
            let count = 0;  // The number of matches found.
            // The number of cursors we're still waiting for a result from.
            let pending = cursors.count;

            // Query parameters.
            const { $join = 'and', $from, $to, $limit } = params;

            // Cursor onsuccess event handler.
            const onsuccess = () => {
                try {
                    pending--;
                    // If no pending cursors then process current result.
                    if( pending == 0 ) {
                        // Increment cursor state.
                        let { expect, match } = cursors.increment( $join );
                        // Test if we have a match and if it is different
                        // from the previous match.
                        if( match && match != prevKey ) {
                            // Add the match to the results list if no 'from'
                            // range limit, or if we are past the 'from' limit.
                            if( !$from || count >= $from ) {
                                results.push( match );
                            }
                            // Increment number of matches.
                            count++;
                            prevKey = match;
                        }
                        if( expect == 0 ) {
                            // No more results available.
                            resolve( results );
                        }
                        if( $to && count > $to ) {
                            // Past the end of the 'to' range.
                            resolve( results );
                        }
                        if( $limit && results.length == limit ) {
                            // At end of result limit.
                            resolve( results );
                        }
                        pending = expect;
                    }
                }
                catch( e ) {
                    reject( e );
                }
            };

            // Open the index cursors.
            cursors.open( onsuccess, reject );
        });

        // Format query results.
        // First read query formatting parameters.
        const { $format, $orderBy } = params;
        // If result format is 'keys' then return result as is.
        if( $format == 'keys' ) {
            return results;
        }

        // Read object for each key in the result.
        const objects = await fdbReadAll( origin, results );
        // If returning a lookup then generate a key -> object map
        // from the list of keys and list of objects.
        if( $format == 'lookup' ) {
            const lookup = {};
            results.forEach( ( key, idx ) => {
                lookup[key] = objects[idx];
            });
            return lookup;
        }

        // Returning the list of objects.
        // Sort the list if an orderBy clause specified.
        if( $orderBy ) {
            objects.sort( comparator( $orderBy ) );
        }
        return objects;
    }

    /**
     * A function to create a function for comparing objects based on a value
     * at a property of each object on a specified path.
     */
    function comparator( path ) {
        // Break the path into an array of keys;
        const keys = path.split('.');
        // A function for resolving the path on an object.
        const resolve = function resolve( obj ) {
            // Iterate over each key in the path.
            for( let key of keys ) {
                if( !obj ) break;   // Break-out if no value.
                obj = obj[key];     // Lookup next value.
            }
            return obj;
        }
        // Return a function for comparing two objects by looking
        // up the property path value on each object.
        return function( o1, o2 ) {
            const v1 = resolve( o1 );
            const v2 = resolve( o2 );
            if( v1 < v2 ) {
                return -1;
            }
            if( v1 > v2 ) {
                return 1;
            }
            return 0;
        }
    }

    /**
     * A set of index cursors querying an object store.
     */
    class QueryCursors {

        /**
         * Initialize one or more cursors on the object store indecies.
         * @param objStore  A transaction opened on the object store being queried.
         * @param params    Query parameters.
         */
        constructor( objStore, params ) {
            // A map of paired test names which can be used to define query ranges.
            const testPairs = { 'to': 'from', 'from': 'to' };
            const queries = [];
            // Rewrite the set of parameters into a list of query descriptors.
            for( let key in params ) {
                // Skip query top-level params.
                if( key[0] == '$' ) {
                    continue;
                }
                // Split key into index name and test operation.
                let [ index, test ] = key.split('$');
                if( !test ) {
                    test = 'value';
                }
                // Read the test value.
                let value = params[key];
                // Check if this is a paired test.
                let pair = testPairs[test];
                if( pair ) {
                    // See if a query has already been created for the matching
                    // test pair.
                    let query = queries.find( query => {
                        return query.index === index
                            && query[pair] !== undefined
                            && query[test] === undefined;
                    });
                    // If query found then merge the current test into it.
                    if( query ) {
                        query[test] = value;
                        continue;
                    }
                }
                queries.push( new IndexQuery( objStore, index, test, value ) );
            }
            this.queries = queries;
        }

        /**
         * The number of cursors in the query.
         */
        get count() {
            return this.queries.length;
        }

        /**
         * Test if the query is a null query (i.e. no parameters / no results).
         */
        isNull() {
            return this.queries.length == 0;
        }

        /**
         * Open the query's cursors.
         */
        open( onsuccess, onerror ) {
            this.queries.forEach( query => query.openCursor( onsuccess, onerror ) );
        }

        /**
         * Increment the cursors state, check for matches and indicate what
         * cursors to continue for next iteration.
         * @param $join The join condition for multiple cursors; 'and' or 'or'.
         */
        increment( $join ) {
            // Get list of active cursors.
            this.cursors = this.queries.filter( query => !query.isComplete() );
            // Sort active cursors by primary key of matched record.
            this.cursors.sort( ( c1, c2 ) => c1.cmp( c2 ) );
            // Initialize results.
            let match, expect = 0;
            // Process cursors.
            switch( $join ) {
                case 'or':
                    if( this.allComplete() ) {
                        // All cursors completed => query is completed.
                        expect = 0;
                    }
                    else {
                        // Match and iterate lowest cursor.
                        match = this.lowestPrimaryKey();
                        expect = this.continueLowest();
                    }
                    break;
                case 'and':
                    if( this.anyComplete() ) {
                        // Any cursor completed => query is completed.
                        expect = 0;
                    }
                    else if( this.allKeysMatch() ) {
                        // If all cursor keys are the same then we have a match.
                        match = this.lowestPrimaryKey();
                        expect = this.continueAll();
                    }
                    else {
                        // No match, iterate the lowest cursor.
                        expect = this.continueLowest();
                    }
                    break;
                default:
                    throw new Error(`Bad query join: '${$join}'`);
            }

            return { match, expect };
        }

        /**
         * Test if all cursors have completed.
         */
        allComplete() {
            // All cursors are complete if no active cursors remain.
            return this.cursors.length == 0;
        }

        /**
         * Test if any cursor has completed.
         */
        anyComplete() {
            // Some cursor has completed if active count is less than query count.
            return this.cursors.length < this.queries.length;
        }

        /**
         * Test if all cursors are matching the same primary key.
         */
        allKeysMatch() {
            let { cursors } = this;
            // Note that result is true if only one cursor, so start comparison
            // from second position.
            for( let i = 1; i < cursors.length; i++ ) {
                if( cursors[i].primaryKey != cursors[i - 1].primaryKey ) {
                    return false;
                }
            }
            return true;
        }

        /**
         * Return the lowest primary key of all active cursors.
         */
        lowestPrimaryKey() {
            return this.cursors[0].primaryKey;
        }
        
        /**
         * Continue the cursor with the lowest primary key.
         */
        continueLowest() {
            this.cursors[0].continue();
            return 1;
        }

        /**
         * Continue all cursors.
         */
        continueAll() {
            this.cursors.forEach( cursor => cursor.continue() );
            return this.cursors.length;
        }

    }

    /**
     * A query on an object store index. Instances of this class
     * encapsulate one or more constraints used when iterating
     * over the index.
     */
    class IndexQuery {

        /**
         * Create a new query on the named index.
         * @param objStore  A transaction opened on the object store being queried.
         * @param index     An object store index name.
         * @param test      A test operation.
         * @param value     A test value.
         */
        constructor( objStore, index, test, value ) {
            this.objStore = objStore;
            this.index = index;
            this[test] = value;
        }

        /**
         * Open a cursor using the query's constraints.
         * @param onsuccess An onsuccess callback handler to attach to the cursor.
         * @param onerror   An error callback.
         */
        openCursor( onsuccess, onerror ) {
            // Make index search term from query constraints.
            let term;
            let { from, to, prefix, value } = this;
            if( from && to ) {
                this.mode = 'range';
                term = IDBKeyRange.bound( from, to, true );
            }
            else if( from ) {
                this.mode = 'range';
                term = IDBKeyRange.lowerBound( from, true );
            }
            else if( to ) {
                this.mode = 'range';
                term = IDBKeyRange.upperBound( to, true );
            }
            else if( prefix ) {
                this.mode = 'prefix';
                term = IDBKeyRange.lowerBound( prefix, true );
            }
            else if( value ) {
                this.mode = 'value';
                term = value;
            }
            let { index } = this;
            // Open a cursor.
            let pending = index == 'path'
                // Open cursor on primary key index.
                ? idbOpenPK( null, null, term, this.objStore )
                // Open cursor on named index.
                : idbOpenIndex( null, null, index, term, this.objStore );
            // Wait for async call to complete and then attach cursor.
            pending
                .then( cursor => {
                    cursor.onsuccess = onsuccess;
                    this.cursor = cursor;
                })
                .catch( onerror );
        }

        /**
         * Get the primary key currently referenced by the query's cursor.
         */
        get primaryKey() {
            return this.cursor.result.primaryKey;
        }

        /**
         * Test if the query's cursor has completed.
         * A cursor has completed if it has gone past the last record in its range.
         */
        isComplete() {
            let { mode, cursor: { result }, prefix } = this;
            switch( mode ) {
                case 'prefix':
                    return result == null || !result.key.startsWith( prefix );
                case 'value':
                case 'range':
                default:
                    return result == null;
            }
        }

        /**
         * Continue the query cursor.
         */
        continue() {
            this.cursor.result.continue();
        }

        /**
         * Compare this query's primary key with that of another query.
         */
        cmp( query ) {
            let pk0 = this.cursor.result.primaryKey;
            let pk1 = query.cursor.result.primaryKey;
            return indexedDB.cmp( pk0, pk1 );
        }
    }

    return query;
}

// -- ES6 import/export.



const query = init( self, _idb_js__WEBPACK_IMPORTED_MODULE_0__ );





/***/ }),
/* 6 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "TinyTemper", function() { return TinyTemper; });
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

/* A small and simple template engine. */

// Regex for parsing templates.
// Attempts to match the following groups:
// 1. Prefix not containing a { character.
// 2. A valid reference between { and } characters.
// 3. Suffix after a } character.
const re = /^([^{]*)[{]([-a-zA-Z0-9_$.]+)[}]([\s\S]*)$/;

// Create a compiled template text node.
function text( text ) {
    // Return a function which returns the text.
    return () => text;
}

// Create a compiled template reference node.
function ref( ref ) {
    // Ref is a dotted path reference - break into an array of path components.
    ref = ref.split('.');
    // Return a function which resolves the reference against a data context.
    return ( cx ) => {
        let value = resolve( ref, cx );
        return value === undefined ? '' : value;
    };
}

// Resolve a dotted path reference against a data context.
// The reference is passed as an array of path components.
function resolve( ref, cx ) {
    for( let i = 0; i < ref.length && cx !== undefined; cx = cx[ref[i++]] );
    return cx;
}

// Parse a template string into a compiled template.
// Returns a function which can be evaluated against a data context.
function parseTemplate( t ) {
    let c = [];                 // An array of compiled template nodes (functions).
    while( t ) {                // While still a template string to parse...
        let r = re.exec( t );   // Match the template string against the parse regex.
        if( r ) {               // If match found...
            c.push( text( r[1] ) );     // Then first group is the reference prefix...
            c.push( ref( r[2] ) );      // Followed by a data reference...
            t = r[3];                   // Followed by the unparsed suffix.
        }
        else {                          // Else no match found.
            let i = t.indexOf('}');     // Check for possible invalid reference...
            if( i > -1 ) {              // ...and if found...
                c.push( text( t.substring( 0, i + 1 ) ) );  // ...then add string up to }
                t = t.substring( i + 1 );   // ...and continue parsing after the }
            }
            else {                      // No more references in the template,
                c.push( text( t ) );    // so append the rest of the template text...
                t = false;              // ...and finish parsing.
            }
        }
    }
    // Return a function to evaluate the compiled template against a data context.
    return function( ctx ) {
        let s = '';                             // The result string.
        for( let i = 0; i < c.length; i++ ) {   // Iterate over the template nodes...
            s += c[i]( ctx );                   // ...and eval against the context.
        }
        return s;                               // Return the result string.
    };
}

// Cache of previously compiled templates.
const Cache = {};

// Parse a template string.
function parse( t ) {
    let f = Cache[t];
    return f ? f : Cache[t] = parseTemplate( t );
}

// Evaluate a template string against the specified context object.
function evaluate( t, c ) {
    return parse( t )( c );
}

const TinyTemper = { parse, evaluate };






/***/ }),
/* 7 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "registerHook", function() { return registerHook; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getHook", function() { return getHook; });
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

/* Functions which are hooked into core service worker processes. */

// Default hook callback - pass through the value unchanged.
const NullHook = ( origin, value ) => value;

// Registered hooks.
const Hooks = {
    'fdb-update': NullHook
};

/**
 * Register a new hook callback.
 * @param name      The hook name.
 * @param callback  The callback function.
 */
function registerHook( name, callback ) {
    // Fetch the currently registered hook.
    const hook = Hooks[name];
    // Error if no hook found.
    if( hook === undefined ) {
        throw new Error(`Bad hook name: ${name}`);
    }
    // If current hook is the default hook then replace with new callback.
    if( hook === NullHook ) {
        Hooks[name] = callback;
    }
    // Else chain the new callback on the result of the existing callback.
    else Hooks[name] = async ( origin, value ) => {
        value = await hook( origin, value );
        return callback( origin, value );
    };
}

/**
 * Get a hook function.
 * @param name  The hook name.
 */
function getHook( name ) {
    // Lookup the hook.
    let hook = Hooks[name];
    // Error if hook not found.
    if( hook === undefined ) {
        throw new Error(`Bad hook name: ${name}`);
    }
    return hook;
}





/***/ }),
/* 8 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "route", function() { return route; });
/* harmony import */ var _idb_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
/* harmony import */ var _support_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1);
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

/* Functions for routing and resolving fetch requests against content origins. */





/**
 * Route a request to the appropriate content origin.
 * @param request   A fetch request.
 * @param origins   A list of available content origins.
 */
function route( request, origins ) {
    let { url } = request;
    // Find the longest sub-path of the key that is
    // bound to an origin.
    for( let i = url.length - 1, first = true; i > 0; i--, first = false ) {
        if( first || url.charCodeAt( i ) == 0x2f ) {
            let key = url.substring( 0, i );
            let origin = origins.find( origin => origin.url.startsWith( key ) );
            if( origin ) {
                return resolve( request, origin );
            }
        }
    }
    // If failed to route then delegate to network.
    return fetch( request );
}

/**
 * Resolve a fetch request against a content origin.
 * @param request   A fetch request.
 * @param origin    A content origin.
 */
async function resolve( request, origin ) {
    // Extract request path relative to base URL and query parameters.
    const { url, dynamics } = origin;
    const { path, params } = Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["parseURL"])( request, url );
    // Check whether a request to a dynamic path.
    const dynamic = dynamics[path];
    if( typeof dynamic === 'function' ) {
        return dynamic.apply( origin, [ request, path, params ]);
    }
    // Read file record for requested path.
    const record = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbRead"])( origin, path );
    if( record === undefined ) {
        // Check for the latest commit record.
        const latest = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbRead"])( origin, '.locomote/commit/$latest');
        if( latest === undefined ) {
            // No latest record indicates that the local file db isn't
            // synced - delegate the request to the server instead.
            return fetch( request );
        }
        return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeErrorResponse"])( path, 404 );
    }
    if( record.status == 'deleted' ) {
        return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeErrorResponse"])( path, 404 );
    }
    // Check whether to return the file record.
    if( params.get('format') == 'record' ) {
        return Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["makeJSONResponse"])( record );
    }
    // Read the fileset configuration.
    const { fetcher, cacheName } = Object(_support_js__WEBPACK_IMPORTED_MODULE_1__["getFileset"])( origin, record.category );
    // Delegate to the fileset content fetcher function, if any.
    if( typeof fetcher === 'function' ) {
        return fetcher.apply( origin, [ request, path, params, record ]);
    }
    // Check for a cached response.
    if( cacheName ) {
        // Try to read the request from cache.
        const response = await caches.match( request );
        if( response ) {
            return response;
        }
    }
    // Cache miss, try fetching from network.
    response = await fetch( request );
    // Update cache.
    if( cacheName ) {
        const cache = await caches.open( cacheName );
        cache.put( request, response );
    }
    return response;
}





/***/ }),
/* 9 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "refreshOrigin", function() { return refreshOrigin; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "cleanOrigin", function() { return cleanOrigin; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "_doRefresh", function() { return _doRefresh; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "_doFilesetRefresh", function() { return _doFilesetRefresh; });
/* harmony import */ var _idb_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);
/* harmony import */ var _jsonl_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(10);
/* harmony import */ var _hooks_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(7);
/* harmony import */ var _support_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(1);
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

/* Category records are stored in the file db as follows:
 * - record: {
 *      category: '$category',
 *      name: `${category}`,
 *      path: `.locomote/category/${category}`
 *   }
 * - the file commit indicates the *latest available* commit for files in that fileset, as
 *   reported in the last previous sync
 * The $group category is a special non-fileset category that represents the acm group
 * - record: {
 *      category: '$category',
 *      name: '$group',
 *      path: `.locomote/category/$group`
 *   }
 * Fingerprint records are stored in the file db as follows:
 * - there is a corresponding fingerprint record for each category
 * - file category: $fingerprint
 * - file path: .locomote/fingerprint/<name>
 * - the file commit indicates the commit of the last downloaded fileset zip
 * When the commit on a fingerprint record doesn't match the commit on the corresponding
 * category record then this indicates that a fileset download (possibly) needs to be done.
 * - note that the category configuration affects whether a download should take place
 * - i.e. the cache setting on the category, although these possibly need to be revisited
 * - should be something like:
 *   - filedb - i.e. content is in the file db
 *   - cache  - i.e. download content and put in cache
 *   - server or none - don't cache in app
 * The fileset download process is:
 * - detect fingerprints not matching their corresponding category record
 * - download and unpack zip
 * - update fingerprint record with category commit
 * There is still a non-understood issue around large downloads, both of the updates feed and
 * fileset downloads:
 * - the updates feed is implemented below as a multi-line json feed
 * - this is good for both streaming, and for chunking (by line) of the response
 * - but not known what the performance characteristics of a large number of updates is
 * - issue is really whether an app would ever fail to update completely because of large change sets
 * - any problem will be more pronounced for fileset downloads
 * - e.g. image filesets have potential to be very large
 * - but ultimately, depends on size of content repo
 * Finally, syncing may also be done against multiple repo backends, so all sync requests need to
 * be queued.
 *
 * Commits:
 * - Stored in the file db
 * - file path: .locomote/commit/<hash>
 * - commit property on the file record it also the commit hash
 * - subject and date properties also on the record
 * - a special commit record indicates the latest commit .locomote/commit/$latest
 */









/**
 * Refresh the file DB contents against its remote origin.
 * @param origin    A content origin configuration.
 */
async function refreshOrigin( origin ) {
    // The hash of the last received update.
    let since;
    // First check for a latest commit record.
    let latest = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbRead"])( origin, '.locomote/commit/$latest');
    if( latest ) {
        since = latest.commit;
    }
    // Check for an ACM group change.
    if( since ) {
        const [ group, fingerprint ] = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbReadAll"])( origin, [
            '.locomote/acm/group',
            '.locomote/fingerprint/acm/group'
        ]);
        if( !group || !fingerprint || group.commit != fingerprint.commit ) {
            since = undefined;
        }
    }
    // Read refresh implementations from the service worker instance -
    // see core.js for this mapping.
    const { _doRefresh, _doFilesetRefresh } = self.refresh;
    // Refresh the file db.
    try {
        await _doRefresh( origin, since );
    }
    catch( e ) {
        console.log('Locomote: Error doing refresh', e );
        return;
    }
    // Update the ACM group fingerprint.
    let fingerprint = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbRead"])( origin, '.locomote/acm/group');
    if( fingerprint ) {
        fingerprint = Object.assign( fingerprint, {
            path:       '.locomote/fingerprint/acm/group',
            category:   '$fingerprint'
        });
        await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbWrite"])( origin, fingerprint );
    }
    // Check for fileset downloads.
    await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbForEach"])( origin, 'category', '$category', async ( record, objStore ) => {
        const { commit, name } = record;
        const path = '.locomote/fingerprint/'+name;
        let fingerprint = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbRead"])( origin, path, objStore );
        if( !fingerprint ) {
            // Fingerprint record not found so create a new one.
            fingerprint = { path, name, category: '$fingerprint' };
        }
        if( fingerprint.commit != commit ) {
            // Download fileset update.
            try {
                await _doFilesetRefresh( origin, name, fingerprint.commit );
                // Update fingerprint.
                fingerprint.commit = commit;
                await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbWrite"])( origin, fingerprint, objStore );
            }
            catch( e ) {
                console.log('Locomote: Error doing fileset refresh', e );
            }
        }
    });
}

/**
 * Download updates from a content origin and write to the file DB.
 * @param origin    A content origin configuration.
 * @param since     The hash of the last received update.
 */
async function _doRefresh( origin, since ) {

    // The download URL.
    let url = `${origin.url}updates.api`;
    if( since ) {
        url += `?since=${since}`;
    }

    // Fetch updates.
    const response = await fetch( url, {
        method: 'GET',
        headers: {}
    });

    if( response.status == 200 ) {
        // Read the update hook.
        const updateHook = Object(_hooks_js__WEBPACK_IMPORTED_MODULE_2__["getHook"])('fdb-update');
        // Start to write to the file DB.
        const fileObjStore = Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbOpenObjStore"])( origin, 'readwrite');
        // Open a reader on multi-line JSON.
        const reader = Object(_jsonl_js__WEBPACK_IMPORTED_MODULE_1__["openJSONLReader"])( response, self );
        // Write results to file db.
        while( true ) {
            // Read next update.
            let { done, value } = await reader.read();
            if( done ) {
                break;
            }
            // Call the update hook.
            value = await updateHook( origin, value );
            // Write to file DB.
            await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbWrite"])( origin, value, fileObjStore );
        }
    }
}

/**
 * Update a fileset's contents. This function implements a fileset contents
 * download using the filesets.api/{category}/list endpoint. The Endpoint
 * returns a list of the file paths within the fileset (or a list of just
 * the updated file paths in the fileset, if a since parameter is used).
 * The function then uses this list to add each file individually to the
 * app cache.
 *
 * @param origin    A content origin configuration.
 * @param category  The category name of the fileset being updated.
 * @param since     The hash of the last received update.
 */
async function _doFilesetRefresh( origin, category, since ) {
    // Read the fileset cache name.
    let { cacheName } = Object(_support_js__WEBPACK_IMPORTED_MODULE_3__["getFileset"])( origin, category );
    if( cacheName ) {
        // Fileset is cacheable, built a URL to fetch a list of
        // files that need to be cached.
        let url = `${origin.url}filesets.api/${category}/list`;
        if( since ) {
            url += `?since=${since}`;
        }
        // Open the cache.
        const cache = await caches.open( cacheName );
        // Fetch the file list.
        const response = await fetch( url, {
            method: 'GET',
            headers: {}
        });
        // Read response and add file URLs to cache.
        const reader = Object(_jsonl_js__WEBPACK_IMPORTED_MODULE_1__["openJSONLReader"])( response, self );
        // Write results to file db.
        while( true ) {
            // Read next file path.
            const { done, value } = await reader.read();
            if( done ) {
                break;
            }
            // Make the full file URL.
            const fileURL = origin.url+value;
            // Add the file URL to the cache.
            try {
                await cache.add( fileURL );
            }
            catch( e ) {
                console.log('Locomote: Failed to cache file', fileURL );
            }
        }
    }
}

/**
 * Clean a content origin by removing all deleted records from the file DB
 * and removing any deleted files from the response cache.
 * @param origin    A content origin configuration.
 */
async function cleanOrigin( origin ) {
    // Open the file object store.
    const fileObjStore = await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbOpenObjStore"])( origin, 'readwrite');
    // Iterate over deleted records, build lists of items to delete by category.
    const deleted = {};
    await Object(_idb_js__WEBPACK_IMPORTED_MODULE_0__["fdbForEach"])('status','deleted', async ( result ) => {
        // Construct a request object.
        let { primaryKey, path, category } = result.value;
        let url = origin.url+path;
        let item = { url, primaryKey };
        let list = deleted[category];
        if( list ) {
            list.push( item );
        }
        else {
            deleted[category] = [ item ];
        }
    });
    // Iterate over each fileset category and remove deleted files from its cache.
    for( let category in deleted ) {
        // Get the fileset cache name..
        let { cacheName } = Object(_support_js__WEBPACK_IMPORTED_MODULE_3__["getFileset"])( category );
        // Open the cache.
        let cache = await caches.open( cacheName );
        // Get the list of deleted items.
        let items = deleted[category];
        // Iterate over the deleted items.
        for( let { url, primaryKey } of urls ) {
            let request = new Request( url );
            // Delete from the cache.
            cache.delete( request );
            // Delete the object store record.
            await idbDelete( null, null, primaryKey, fileObjStore );
        }
    }
    // TODO Prune commit records - needs an index.
}




/***/ }),
/* 10 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "openJSONLReader", function() { return openJSONLReader; });
/* harmony import */ var _streams_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
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
                    // Move to after end of current line.
                    i = j + 1;
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
    return Object(_streams_js__WEBPACK_IMPORTED_MODULE_0__["openParserReader"])( response, parser, global );
}





/***/ })
/******/ ]);