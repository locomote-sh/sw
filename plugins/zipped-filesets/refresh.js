// Copyright 2018 Julian Goacher
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

import { openUnzipReader } from './unzipper.js';

const { getMIMEType } = self.support;

/**
 * Update a fileset's contents.
 * @param origin    A content origin configuration.
 * @param category  The category name of the fileset being updated.
 * @param since     The hash of the last received update.
 */
async function _doFilesetRefresh( origin, category, since ) {
    // Fetch zip file
    let url = `${origin.url}/filesets.api/${category}/contents`;
    if( since ) {
        url += `&since=${since}`;
    }
    const response = await fetch( url );
    // Unpack zip file and write contents to cache
    if( response.status == 200 ) {
        // Open the cache.
        const cache = await caches.open( CACHE );
        // Open a reader on the zip file
        const reader = openUnzipReader( response, self );
        // Iterate over each entry
        while( true ) {
            // Read entry
            const { done, value } = await reader.read();
            if( done ) {
                break;
            }
            // Create response for cache.
            let url = `${baseURL}/${value.filename}`;
            let request = new Request( url );
            let mimeType = getMIMEType( value.filename );
            let response = new Response( value.data, {
                status: 200,
                headers: { 'Content-Type': mimeType }
            });
            // Write response to cache
            cache.put( request, response );
        }
    }
}

self.refresh._doFilesetRefresh = _doFilesetRefresh;
