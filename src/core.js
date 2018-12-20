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

import * as support from './support.js';
import * as streams from './streams.js';
import * as origin from './origin.js';
import * as hooks from './hooks.js';
import * as idb from './idb.js';
import { query } from './query.js';
import { route } from './router.js';
import { refresh } from './refresh.js';

const { Origins } = origin;

// Broadcast a message to all service worker clients.
async function broadcast( message ) {
    let clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach( client => client.postMessage( message ) );
}

// A list of URLs to add to the static cache.
self.staticURLs = [];

async function install() {
    // Clear out and previously cached statics.
    await caches.delete('statics');
    let { staticURLs } = self;
    if( staticURLs.length > 0 ) {
        // Add current statics to cache.
        const cache = await caches.open('statics');
        await cache.addAll( staticURLs );
    }
}

async function activate() {
    await clients.claim();
}

// Sub-module export for plugin support.
self.support = support;
self.streams = streams;
self.origin  = origin;
self.hooks   = hooks;
self.idb     = idb;
self.query   = query;
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
    let { name, args } = event;
    switch( name ) {
        case 'refresh':
            const { sync } = self.refresh;
            Origins.forEach( origin => sync( origin ) );
            break;
    }
});

self.addEventListener('fetch', event => {
    event.respondWith( route( event.request, Origins ) );
});

/**
 * Add a list of URLs to the static cache.
 */
self.staticCache = function( urls ) {
    self.staticURLs = self.staticURLs.concat( urls );
}