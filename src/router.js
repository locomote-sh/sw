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

import {
    fdbRead
} from './idb.js';

import {
    parseURL,
    extname,
    joinPath,
    makeErrorResponse,
    makeJSONResponse,
    getFileset
} from './support.js';

/**
 * Route a request to the appropriate content origin.
 * @param request       A fetch request.
 * @param origins       A list of available content origins.
 * @param staticURLs    A list of statically cached URLs.
 */
async function route( request, origins, staticURLs ) {
    const { url } = request;
    // Try to find the first origin whose url forms a prefix to the request
    // url. Note that origins are sorted by url length, so the origin which
    // provides the longest matching prefix will be the one found.
    const origin = origins.find( origin => url.startsWith( origin.url ) );
    if( origin ) {
        return resolve( request, origin );
    }
    // Check if requesting a statically cached resource.
    if( staticURLs.includes( url ) ) {
        const cache = await caches.open('statics');
        let response = await cache.match( request );
        if( !response ) {
            // Cache miss - fetch from network and add to cache.
            response = await fetch( request );
            cache.put( request, response );
        }
        return response;
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
    const { url, dynamics, excluded } = origin;
    const { path, params } = parseURL( request, url );
    // Check whether the path is under a sub-path excluded from the origin.
    if( excluded.some( subPath => path.startsWith( subPath ) ) ) {
        // Delegate request to network.
        return fetch( request );
    }
    // Check whether a request to a dynamic path.
    const dynamic = dynamics[path];
    if( typeof dynamic === 'function' ) {
        return dynamic.apply( origin, [ request, path, params ]);
    }
    // Read file record for requested path.
    const key = getFDBKey( request, origin, path );
    const record = await fdbRead( origin, key );
    if( record === undefined ) {
        // Check for the latest commit record.
        const latest = await fdbRead( origin, '.locomote/commit/$latest');
        if( latest === undefined ) {
            // No latest record indicates that the local file db isn't
            // synced - delegate the request to the server instead.
            return fetch( request );
        }
        return makeErrorResponse( path, 404 );
    }
    if( record.status == 'deleted' ) {
        return makeErrorResponse( path, 404 );
    }
    // Check whether to return the file record.
    if( params.get('format') == 'record' ) {
        return makeJSONResponse( record );
    }
    // Read the fileset configuration.
    const { fetcher, cacheName } = getFileset( origin, record.category );
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

/**
 * Return the file db record key for a request.
 * This implementation simply appends 'index.html' to the path if
 * the request path doesn't have a file extension; this allows
 * request like 'docs/' to be resolved to a file like 'docs/index.html'. 
 * Future implementations may support more complex content negotation
 * logic.
 * @param request   A file request.
 * @param origin    The content origin the file belongs to.
 * @param path      The file path presented in the request.
 */
function getFDBKey( request, origin, path ) {
    if( extname( path ) ) {
        return path;
    }
    return joinPath( path, 'index.html');
}

export { route };

