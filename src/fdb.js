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

import idb from '@locomote.sh/idb';

/**
 * Initialize the file DB API.
 * @param global    A global object with { indexedDB, IDBKeyRange } properties.
 * @return Returns a set of functions for interacting with a file DB instance.
 *         Includes all idb* functions from the idb module.
 */
function init( global ) {

    const {
        indexedDB,
        IDBKeyRange,
        idbOpen,
        idbOpenObjStore,
        idbRead,
        idbReadAll,
        idbWrite,
        idbDelete,
        idbOpenPK,
        idbOpenIndex,
        idbIndexCount
    } = idb( global );

    /**
     * Open the file object store.
     * @param origin    The content origin configuration.
     * @param mode      The transaction mode; defaults to 'readonly'.
     */
    function fdbOpenObjStore( origin, mode = 'readwrite' ) {
        const { schema } = origin;
        return idbOpenObjStore( schema, 'files', mode );
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
    function fdbForEach( origin, index, term, callback ) {
        return new Promise( async ( resolve, reject ) => {
            const objStore = await fdbOpenObjStore( origin, 'readwrite');
            const pending = [];
            const request = objStore.index( index ).openCursor( term );
            request.onsuccess = ( e ) => {
                const cursor = e.target.result;
                if( cursor ) {
                    const { value } = cursor;
                    pending.push( callback( value, objStore ) );
                    cursor.continue();
                }
                else Promise.all( pending ).then( resolve );
            };
            request.onerror = () => reject( request.error );
        });
    }

    /**
     * Read a file record from the file DB.
     * @param origin    The content origin configuration.
     * @param path      A file path, relative to the content origin root.
     */
    async function fdbRead( origin, path ) {
        const objStore = await fdbOpenObjStore( origin );
        return idbRead( path, objStore );
    }

    /**
     * Read a list of file records from the file DB.
     * @param origin    The content origin configuration.
     * @param paths     A list of file paths.
     */
    async function fdbReadAll( origin, paths ) {
        const objStore = await fdbOpenObjStore( origin );
        return idbReadAll( paths, objStore );
    }

    /**
     * Delete a file record from the file DB.
     * @param origin    The content origin configuration.
     * @param path      The path of the file record to delete.
     */
    async function fdbDelete( origin, path ) {
        const objStore = await fdbOpenObjStore( origin, 'readwrite');
        return idbDelete( path, objStore );
    }

    /**
     * Write a file record to the file DB.
     * @param origin    The content origin configuration.
     * @param record    The record to write.
     */
    async function fdbWrite( origin, record ) {
        const objStore = await fdbOpenObjStore( origin, 'readwrite');
        return reqAsPromise( objStore.put( record ) );
    }

    return {
        indexedDB,
        IDBKeyRange,
        idbOpen,
        idbOpenObjStore,
        idbRead,
        idbReadAll,
        idbWrite,
        idbDelete,
        idbOpenPK,
        idbOpenIndex,
        idbIndexCount,
        fdbOpenObjStore,
        fdbForEach,
        fdbRead,
        fdbReadAll,
        fdbDelete,
        fdbWrite
    };
}

export default init;
