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
    makeErrorResponse,
    makeJSONResponse,
    getFileset
} from './support.js';

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
    const { path, params } = parseURL( request, url );
    // Check whether a request to a dynamic path.
    const dynamic = dynamics[path];
    if( typeof dynamic === 'function' ) {
        return dynamic.apply( origin, [ request, path, params ]);
    }
    // Read file record for requested path.
    const record = await fdbRead( origin, path );
    if( record === undefined ) {
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

export { route };

