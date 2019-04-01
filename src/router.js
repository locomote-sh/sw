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
    log,
    parseURL,
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
    try {
        // Try to find the first origin whose url forms a prefix to the request
        // url. Note that origins are sorted by descending url length, so any 
        // origin found will be the one with the longest matching prefix.
        const origin = origins.find( origin => url.startsWith( origin.url ) );
        if( origin ) {
            return resolve( request, origin );
        }
        // No origin found, check if requesting a statically cached resource.
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
    }
    catch( e ) {
        log('error','Error routing %s:', url, e );
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

    // Read origin properties.
    const {
        url,
        dynamics,
        excluded,
        normalizeRequest,
        _test
    } = origin;

    // Always send localhost requests to the server, unless running in test mode.
    // The assumption here is that localhost requests are going to a locally
    // running dev server, so we effectively disable the service worker in this
    // setup to ensure reliable testing.
    // Test mode is defined with a { "_test": true } setting in the origin config,
    // and is intended for use by service worker maintainers when doing local
    // testing of the service worker (i.e. this) code.
    if( url.startsWith('http://localhost') && !_test ) { 
        return fetch( request );
    }
    // Normalize the request. This is necessary to ensure that requests for e.g.
    // '/xxx' and '/xxx/index.html' are mapped to the same file.
    request = normalizeRequest( request, origin );
    // Extract request path relative to base URL and query parameters.
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
    const record = await self.idb.fdbRead( origin, path );
    if( record === undefined ) {
        // Check for the latest commit record.
        const latest = await self.idb.fdbRead( origin, '.locomote/commit/$latest');
        if( latest === undefined ) {
            // No latest record indicates that the local file db isn't
            // synced - delegate the request to the server instead.
            return fetch( request );
        }
        return makeErrorResponse( path, 404 );
    }
    // Check for a deleted file - this should only happen during a content refresh.
    if( record.status === 'deleted' ) {
        return makeErrorResponse( path, 404 );
    }
    // Check whether to return the file record.
    if( params.get('format') === 'record' ) {
        return makeJSONResponse( record );
    }
    // Read the fileset configuration.
    const { fetcher, cacheName } = getFileset( origin, record.category );
    // Delegate to the fileset content fetcher function, if any.
    if( typeof fetcher === 'function' ) {
        return fetcher.apply( origin, [ request, path, params, record ]);
    }
    let response;
    // Check for a cached response.
    if( cacheName ) {
        // Try to read the request from cache.
        response = await caches.match( request );
    }
    // Cache miss or no cache.
    if( !response ) {
        // Cache miss, try fetching from network.
        response = await fetch( request );
        // Update cache.
        if( cacheName ) {
            const cache = await caches.open( cacheName );
            cache.put( request, response );
        }
    }
    return response;
}

export { route };

