/* 
   Copyright 2019 Locomote Ltd.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/* Functions for working with the Locomote.sh file DB. */

import initQueryAPI from '@locomote.sh/query-api/lib/browser';

/**
 * Initialize the file DB API.
 * @param global    A global object with { indexedDB, IDBKeyRange } properties.
 * @return Returns a set of functions for interacting with a file DB instance.
 *         Includes all idb* functions from the idb module.
 */
function init( global ) {

    const {
        query,
        idb: {
            indexedDB,
            IDBKeyRange,
            idbConnect
        }
    } = initQueryAPI( global );

    const ObjStoreName = 'files';

    /**
     * Connect to a content origin's file DB.
     * @param origin    A content origin; must have a 'schema' property.
     */
    async function fdbConnect( origin ) {

        const { schema } = origin;

        // Connect to the object store.
        const cx = await idbConnect( schema, ObjStoreName );

        /**
         * Query the file object store.
         * @param origin    The content origin configuration.
         * @param params    The query parameters.
         */
        function fdbQuery( params ) {
            return query( schema, ObjStoreName, params );
        }

        /**
         * Iterate over file DB records.
         * @param origin    The content origin configuration.
         * @param index     The name of a file DB index.
         * @param term      An index filter term.
         * @param callback  A callback function called once for each file record that
         *                  matches the search term. The callback function may be
         *                  asynchonous, and the iterator will wait for the function
         *                  to complete before continuing to the next result.
         */
        function fdbForEach( index, term, callback ) {
            return new Promise( async ( resolve, reject ) => {
                const pending = [];
                const request = cx.openIndex( index, term );
                request.onsuccess = ( e ) => {
                    const cursor = e.target.result;
                    if( cursor ) {
                        const { value } = cursor;
                        pending.push( callback( value ) );
                        cursor.continue();
                    }
                    else Promise.all( pending ).then( resolve );
                };
                request.onerror = () => reject( request.error );
            });
        }

        cx.query   = fdbQuery;
        cx.forEach = fdbForEach;

        return cx;

    }

    return {
        indexedDB,
        IDBKeyRange,
        connect: fdbConnect
    }
}

export default init;
