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

import {
    fdbRead,
    fdbReadAll,
    fdbForEach,
    fdbWrite,
    fdbOpenObjStore
} from './idb.js';

import { openJSONLReader } from './jsonl.js';

import { getHook } from './hooks.js';

import { getFileset } from './support.js';

/**
 * Refresh the file DB contents against its remote origin.
 * @param origin    A content origin configuration.
 */
async function refreshOrigin( origin ) {
    // The hash of the last received update.
    let since;
    // First check for a latest commit record.
    let latest = await fdbRead( origin, '.locomote/commit/$latest');
    if( latest ) {
        since = latest.commit;
    }
    // Check for an ACM group change.
    if( since ) {
        const [ group, fingerprint ] = await fdbReadAll( origin, [
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
    let fingerprint = await fdbRead( origin, '.locomote/acm/group');
    if( fingerprint ) {
        fingerprint = Object.assign( fingerprint, {
            path:       '.locomote/fingerprint/acm/group',
            category:   '$fingerprint'
        });
        await fdbWrite( origin, fingerprint );
    }
    // Check for fileset downloads.
    await fdbForEach( origin, 'category', '$category', async ( record, objStore ) => {
        const { commit, name } = record;
        const path = '.locomote/fingerprint/'+name;
        let fingerprint = await fdbRead( origin, path, objStore );
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
                await fdbWrite( origin, fingerprint, objStore );
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
        const updateHook = getHook('fdb-update');
        // Start to write to the file DB.
        const fileObjStore = fdbOpenObjStore( origin, 'readwrite');
        // Open a reader on multi-line JSON.
        const reader = openJSONLReader( response, self );
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
            await fdbWrite( origin, value, fileObjStore );
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
    let { cacheName } = getFileset( origin, category );
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
        const reader = openJSONLReader( response, self );
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
    const fileObjStore = await fdbOpenObjStore( origin, 'readwrite');
    // Iterate over deleted records, build lists of items to delete by category.
    const deleted = {};
    await fdbForEach('status','deleted', async ( result ) => {
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
        let { cacheName } = getFileset( category );
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

export {
    refreshOrigin,
    cleanOrigin,
    _doRefresh,
    _doFilesetRefresh
};
