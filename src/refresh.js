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
    idbRead,
    idbWrite,
    idbDelete,
    idbIndexCount,
    fdbOpenObjStore,
    fdbRead,
    fdbReadAll,
    fdbForEach,
    fdbWrite,
    fdbDelete
} from './idb.js';

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

    log('Refresh: %s', origin.url );
    // The hash of the last received update.
    let since;
    // First check for a latest commit record.
    const latest = await fdbRead( origin, '.locomote/commit/$latest');
    if( latest ) {
        since = latest.commit;
        log('debug','Refresh: Latest commit=%s', since );
    }
    else {
        log('debug','Refresh: No latest, marking commits...');
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
        await fdbForEach( origin, 'category', '$commit', async ( record, objStore ) => {
            record._stale = true;
            await idbWrite( record, objStore );
        });
    }
    // Check for an ACM group change.
    if( since ) {
        log('debug','Refresh: Checking ACM fingerprint...');
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
        log('debug','Refresh: Downloading updates...');
        await _doRefresh( origin, since );
    }
    catch( e ) {
        log('debug','Error doing refresh', e );
        return;
    }
    // Update the ACM group fingerprint.
    let objStore = await fdbOpenObjStore( origin );
    let fingerprint = await idbRead('.locomote/acm/group', objStore );
    if( fingerprint ) {
        log('debug','Refresh: Updating ACM fingerprint...');
        fingerprint = Object.assign( fingerprint, {
            path:       '.locomote/fingerprint/acm/group',
            category:   '$fingerprint'
        });
        await idbWrite( fingerprint, objStore );
    }
    // Check for stale commits, and delete any files in those commits.
    // (See comment above for background).
    log('debug','Refresh: Checking for stale commits...');
    await fdbForEach( origin, 'category', '$commit', async ( record ) => {
        const { _stale, commit } = record;
        if( _stale ) {
            log('debug','Refresh: Deleting files in %s...', commit );
            // Iterate over each file in the stale commit and change its status to deleted.
            // The post-refresh cleanup will then delete the record and remove its associated
            // file from the cache.
            await fdbForEach( origin, 'commit', commit, ( record, objStore ) => {
                record.status = 'deleted';
                return idbWrite( record, objStore );
            });
        }
    });
    // Check for fileset downloads.
    log('debug','Refresh: Checking for fileset downloads...');
    await fdbForEach( origin, 'category', '$category', async ( record ) => {
        const { commit, name } = record;
        const path = '.locomote/fingerprint/'+name;
        let fingerprint = await fdbRead( origin, path );
        if( !fingerprint ) {
            // Fingerprint record not found so create a new one.
            fingerprint = { path, name, category: '$fingerprint' };
        }
        if( fingerprint.commit != commit ) {
            // Download fileset update.
            try {
                log('debug','Refresh: Downloading updates for fileset %s...', name );
                await _doFilesetRefresh( origin, name, fingerprint.commit );
                // Update fingerprint.
                fingerprint.commit = commit;
                await fdbWrite( origin, fingerprint );
            }
            catch( e ) {
                log('debug','Error doing fileset refresh', e );
            }
        }
    });
    // Tidy-up.
    log('debug','Refresh: Tidy up');
    await cleanOrigin( origin );
    log('debug','Refresh: Done');
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
            await fdbWrite( origin, value );
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
    await fdbForEach( origin, 'status','deleted', record => {
        // Read values from the record.
        const { primaryKey, path, category } = record;
        // Construct a request URL.
        const url = origin.url+path;
        // Construct an deletion item.
        const item = { primaryKey, url };
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
        log('debug','Refresh: Deleting %d files from fileset %s...', items.length, category );
        // Iterate over the deleted items.
        for( const { url, primaryKey } of items ) {
            const request = new Request( url );
            // Delete from the cache.
            cache.delete( request );
            // Delete the object store record.
            await fdbDelete( origin, primaryKey );
        }
    }
    // Prune commit records - delete any commit record with no active file records.
    await fdbForEach( origin, 'category', '$commit', async ( record, objStore ) => {
        const { path, commit } = record;
        const count = await idbIndexCount('commit', commit, objStore );
        // Note that the commit record itself will appear in the index.
        if( count <= 1 ) {
            log('debug','Refresh: Deleting commit record for %s...', commit );
            await idbDelete( path, objStore );
        }
    });
}

export {
    refreshOrigin,
    cleanOrigin,
    _doRefresh,
    _doFilesetRefresh
};
