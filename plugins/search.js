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

/* Full-text search functionality for file DBs. */

// Module dependencies are resolved on the service worker instance.
const { query, hooks, origin, support } = self;

const { DefaultOrigin } = origin;

// Dynamic endpoint for handling search requests.
DefaultOrigin.dynamics['search.api'] = async function( request, path, params ) {
    const term = params.get('term');
    const mode = params.get('mode');
    const result = await search( this, term, mode );
    return support.makeJSONResponse( result );
}

// Additional file DB index used when searching.
DefaultOrigin.schema.stores.files.indexes.fts = {
    // TODO: Review these.
    keyPath: 'page.tokens',
    options: { unique: false }
}

// File DB update hook.
hooks.registerHook('fdb-update', ( origin, record ) => {
    // TODO Generate word tokens from page content.
    return record;
});

/**
 * Execute a full text search on the db.
 * @param origin    The content origin configuration.
 * @param term      The search term, i.e. a string with the words to search for.
 * @param mode      The search mode; one of the following:
 *                  any:    Search for any of the words in the search term
 *                  all:    Search for all of the words in the search term.
 *                  exact:  Search for the exact search term.
 */
async function search( origin, term, mode ) {
    
    // Search modes and the associated query join mode are:
    // - any: OR
    // - all: AND
    // - exact: AND with post-filter to extract exact matches.
    let $join = mode == 'any' ? 'or' : 'and';

    // Search for each token in search term.
    let fts$value = term.split(/\s+/g);

    let params = { $join, fts$value };
    let result = await query( origin, params );

    // If in exact mode then further filter the result list to
    // only include objects with the exact text.
    if( mode == 'exact' ) {
        // Create a regex to match the search term, as each search
        // token separated by a match for one or more whitespace tokens.
        let re = new RegExp( term.join('\\s+') );
        // Filter the results.
        result = result.filter( item => {
            // Extract text from the page content by replacing
            // HTML elements with whitespace.
            // NOTE that this assumes db & content structure.
            let text = item.page.content.replace(/<[^>]*>/g,' ');
            // Test if the search term matches the text.
            return re.test( text );
        });
    }

    // TODO Generate excerpts with highlighting.

    return result;
}

