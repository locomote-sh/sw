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

import { openJSONLReader } from './jsonl.js';

import { getHook } from './hooks.js';

import {
    log,
    getFileset
} from './support.js';

/**
 * Refresh the file DB contents against its remote origin.
 * @param origin    A content origin configuration.
 */
async function refreshOrigin( origin ) {

    log('\u27f3 %s', origin.url );
    // The hash of the last received update.
    let since;
    // First check for a latest commit record.
    const latest = await self.idb.fdbRead( origin, '.locomote/commit/$latest');
    if( latest ) {
        since = latest.commit;
        // Check for an ACM group change.
        log('debug','\u27f3 Checking ACM fingerprint...');
        const [ group, fingerprint ] = await self.idb.fdbReadAll( origin, [
            '.locomote/acm/group',
            '.locomote/fingerprint/acm/group'
        ]);
        if( !group || !fingerprint || group.commit != fingerprint.commit ) {
            since = undefined;
            log('debug','\u27f3 ACM group fingerprint change, forcing full refresh');
        }
        else log('debug','\u27f3 Latest commit=%s', since );
    }
    if( !since ) {
        log('debug','\u27f3 Doing full refresh, staleing commits...');
        // If no latest commit record then it can indicate one of a few sitations:
        // - this is the first refresh and the file db is empty;
        // - the previous refresh failed to complete;
        // - the latest commit record has been deleted somehow;
        // In either of the last two cases, deleted files may be left on the client.
        // This happens because given a commit history with two commits, A and B;
        // and if the client previously synced with commit A, looses the latest
        // record, and then refreshes against commit B; and if files in A where
        // deleted in B; then those files won't be included in the refresh against
        // B, and will remain in the local copy of the filedb.
        //
        // Mark each commit record as stale; this is done so that we can detect
        // any obsolete commits after the record, and delete any files belonging
        // to those commits.
        await self.idb.fdbForEach( origin, 'category', '$commit', async ( record, objStore ) => {
            record._stale = true;
            await self.idb.idbWrite( record, objStore );
        });
    }
    // Read refresh implementations from the service worker instance -
    // see core.js for this mapping.
    const { _doRefresh, _doFilesetRefresh } = self.refresh;
    // Refresh the file db.
    try {
        log('debug','\u27f3 Downloading updates...');
        await _doRefresh( origin, since );
    }
    catch( e ) {
        log('debug','Error doing refresh', e );
        return;
    }
    // Update the ACM group fingerprint.
    const objStore = await self.idb.fdbOpenObjStore( origin );
    let fingerprint = await self.idb.idbRead('.locomote/acm/group', objStore );
    if( fingerprint ) {
        log('debug','\u270e Updating ACM fingerprint...');
        fingerprint = Object.assign( fingerprint, {
            path:       '.locomote/fingerprint/acm/group',
            category:   '$fingerprint'
        });
        await self.idb.idbWrite( fingerprint, objStore );
    }
    // Check for stale commits, and delete any files in those commits.
    // (See comment above for background).
    log('debug','\u27f3 Checking for stale commits...');
    await self.idb.fdbForEach( origin, 'category', '$commit', async ( record ) => {
        const { _stale, info: { commit } } = record;
        if( _stale ) {
            log('debug','\u2704 Deleting files in stale commit %s...', commit );
            // Iterate over each file in the stale commit and change its status to deleted.
            // The post-refresh cleanup will then delete the record and remove its associated
            // file from the cache.
            await self.idb.fdbForEach( origin, 'commit', commit, ( record, objStore ) => {
                record.status = 'deleted';
                return self.idb.idbWrite( record, objStore );
            });
        }
    });
    // Check for fileset downloads.
    log('debug','\u27f3 Checking for fileset downloads...');
    await self.idb.fdbForEach( origin, 'category', '$category', async ( record ) => {
        const { commit, name } = record;
        const path = '.locomote/fingerprint/'+name;
        let fingerprint = await self.idb.fdbRead( origin, path );
        if( !fingerprint ) {
            // Fingerprint record not found so create a new one.
            fingerprint = { path, name, category: '$fingerprint' };
        }
        if( fingerprint.commit != commit ) {
            // Download fileset update.
            try {
                log('debug','\u27f3 Downloading updates for fileset %s...', name );
                await _doFilesetRefresh( origin, name, fingerprint.commit );
                // Update fingerprint.
                fingerprint.commit = commit;
                await self.idb.fdbWrite( origin, fingerprint );
            }
            catch( e ) {
                log('error','Error doing fileset refresh', e );
            }
        }
    });
    // Tidy-up.
    log('debug','\u27f3 Tidy up');
    await cleanOrigin( origin );
    log('debug','\u27f3 Done');
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
            await self.idb.fdbWrite( origin, value );
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
    const { cacheName } = getFileset( origin, category );
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
                log('error','Failed to cache file', fileURL );
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
    // Iterate over deleted records, build lists of items to delete by category.
    const deleted = {};
    await self.idb.fdbForEach( origin, 'status','deleted', record => {
        // Read values from the record.
        const { path, category } = record;
        // Construct a request URL.
        const url = origin.url+path;
        // Construct an deletion item.
        const item = { path, url };
        // Record the fileset category.
        const list = deleted[category];
        if( list ) {
            list.push( item );
        }
        else {
            deleted[category] = [ item ];
        }
    });
    // Iterate over each fileset category and remove deleted files from its cache.
    for( const category in deleted ) {
        // Get the fileset cache name..
        const { cacheName } = getFileset( origin, category );
        // Open the cache.
        const cache = await caches.open( cacheName );
        // Get the list of deleted items.
        const items = deleted[category];
        log('debug','\u2704 Deleting %d files from fileset %s...', items.length, category );
        // Iterate over the deleted items.
        for( const { path, url } of items ) {
            const request = new Request( url );
            // Delete from the cache.
            cache.delete( request );
            // Delete the object store record.
            await self.idb.fdbDelete( origin, path );
        }
    }
    // Prune commit records - delete any commit record with no active file records.
    await self.idb.fdbForEach( origin, 'category', '$commit', async ( record, objStore ) => {
        const { path, info: { commit } } = record;
        const count = await self.idb.idbIndexCount('commit', commit, objStore );
        log('debug','commit %s count %d', commit, count );
        if( count == 0 ) {
            log('debug','\u2704 Deleting commit record for %s...', commit );
            await self.idb.idbDelete( path, objStore );
        }
    });
}

export {
    refreshOrigin,
    cleanOrigin,
    _doRefresh,
    _doFilesetRefresh
};
