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

import { version } from '../package.json';

/* Core service worker functionality. */

import * as support from './support.js';
import * as streams from './streams.js';
import * as origin  from './origin.js';
import * as hooks   from './hooks.js';
import { route }    from './router.js';
import * as refresh from './refresh.js';
import fdb          from './fdb.js';

const { Origins } = origin;

const { log } = support;

// Broadcast a message to all service worker clients.
async function broadcast( message ) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach( client => client.postMessage( message ) );
}

// A list of URLs to add to the static cache.
self.staticURLs = [];

/**
 * Refresh content origins.
 * @param scope A content origin URL; or '*' to refresh all origins.
 */
async function refreshContent( scope = '*' ) {
    const { refreshOrigin } = self.refresh;
    for( const origin of Origins ) {
        if( scope == '*' || origin.url == scope ) {
            await refreshOrigin( origin );
        }
    }
    log('debug','Refreshed %d content origin(s)', Origins.length );
}

/**
 * Refresh static content.
 */
async function refreshStatics() {
    let { staticURLs } = self;
    if( staticURLs.length > 0 ) {
        // Add current statics to cache.
        const cache = await caches.open('statics');
        await cache.addAll( staticURLs );
        log('debug','Pre-cached %d static URL(s)', staticURLs.length );
    }
}

/**
 * Perform the service worker installation.
 */
async function install() {
    try {
        log('Installing version %s...', version );
        // Refresh all content origins.
        await refreshContent();
        // Clear out any previously cached statics.
        await caches.delete('statics');
        // Cache static content.
        await refreshStatics();
        log('Installation completed');
    }
    catch( e ) {
        log('error','Installation error', e );
    }
}

/**
 * Activate the service worker.
 */
async function activate() {
    // Connect to page clients.
    await clients.claim();
    log('Choo choo! Running version %s', version );
}

self.version = version;

// Sub-module export for plugin support.
self.support = support;
self.streams = streams;
self.origin  = origin;
self.hooks   = hooks;
self.fdb     = fdb( global );
self.refresh = refresh;

// Methods for adding origins.
self.addOrigin = origin.addOrigin;
self.addOrigins = origin.addOrigins;

// Event handling.
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil( install() );
});

self.addEventListener('activate', event => {
    event.waitUntil( activate() );
});

self.addEventListener('message', event => {
    const { data: { name, args } } = event;
    switch( name ) {
        case 'refresh':
            refreshContent( args );
            break;
        case 'refresh-statics':
            refreshStatics();
            break;
    }
});

self.addEventListener('fetch', event => {
    log('> Fetch', event.request.url );
    event.respondWith( route( event.request, Origins, self.staticURLs ) );
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
