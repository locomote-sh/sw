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
            /*
            idbOpen,
            idbOpenObjStore,
            idbRead,
            idbReadAll,
            idbWrite,
            idbDelete,
            idbOpenPK,
            idbOpenIndex,
            idbIndexCount
            */
            idbConnect
        }
    } = initQueryAPI( global );

    const ObjStoreName = 'files';

    /**
     * Convert an idb request object to a promise.
     */
    /*
    function reqAsPromise( request ) {
        return new Promise( ( resolve, reject ) => {
            request.onsuccess = () => resolve( request.result );
            request.onerror   = () => reject( request.error );
        });
    }
    */

    async function fdbConnect( origin ) {

        const { schema } = origin;

        const cx = await idbConnect( schema, ObjStoreName );

        /**
         * Query the file object store.
         * @param origin    The content origin configuration.
         * @param params    The query parameters.
         */
        function fdbQuery( params ) {
            return query( schema, ObjStoreName, params );
        }

        cx.query = fdbQuery;

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

        cx.forEach = fdbForEach;

        return cx;

    }

    /**
     * Query the file object store.
     * @param origin    The content origin configuration.
     * @param params    The query parameters.
     */
    /*
    function fdbQuery( origin, params ) {
        const { schema } = origin;
        return query( schema, ObjStoreName, params );
    }
    */

    /**
     * Open the file object store.
     * @param origin    The content origin configuration.
     * @param mode      The transaction mode; defaults to 'readonly'.
     */
    /*
    function fdbOpenObjStore( origin, mode = 'readwrite' ) {
        const { schema } = origin;
        return idbOpenObjStore( schema, ObjStoreName, mode );
    }

    function fdbOpen( origin ) {
        const { schema } = origin;
        return idbOpen( schema );
    }
    */

    /**
     * Read a file record from the file DB.
     * @param origin    The content origin configuration.
     * @param path      A file path, relative to the content origin root.
     */
    /*
    async function fdbRead( origin, path ) {
        //const objStore = await fdbOpenObjStore( origin );
        const db = await fdbOpen( origin );
        const tx = db.transaction( ObjStoreName, 'readonly');
        const objStore = tx.objectStore( ObjStoreName );
        return idbRead( objStore, path );
    }
    */

    /**
     * Read a list of file records from the file DB.
     * @param origin    The content origin configuration.
     * @param paths     A list of file paths.
     */
    /*
    async function fdbReadAll( origin, paths ) {
        //const objStore = await fdbOpenObjStore( origin );
        const db = await fdbOpen( origin );
        const tx = db.transaction( ObjStoreName, 'readonly');
        const objStore = tx.objectStore( ObjStoreName );
        return idbReadAll( objStore, paths );
    }
    */

    /**
     * Delete a file record from the file DB.
     * @param origin    The content origin configuration.
     * @param path      The path of the file record to delete.
     */
    /*
    async function fdbDelete( origin, path ) {
        //const objStore = await fdbOpenObjStore( origin, 'readwrite');
        const db = await fdbOpen( origin );
        const tx = db.transaction( ObjStoreName, 'readwrite');
        const objStore = tx.objectStore( ObjStoreName );
        return idbDelete( objStore, path );
    }
    */

    /**
     * Write a file record to the file DB.
     * @param origin    The content origin configuration.
     * @param record    The record to write.
     */
    /*
    async function fdbWrite( origin, record ) {
        //const objStore = await fdbOpenObjStore( origin, 'readwrite');
        const db = await fdbOpen( origin );
        const tx = db.transaction( ObjStoreName, 'readwrite');
        const objStore = tx.objectStore( ObjStoreName );
        return reqAsPromise( objStore.put( record ) );
    }
    */

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
    /*
    function fdbForEach( origin, index, term, callback ) {
        return new Promise( async ( resolve, reject ) => {
        //const objStore = await fdbOpenObjStore( origin, 'readwrite');
        const db = await fdbOpen( origin );
        const tx = db.transaction( ObjStoreName, 'readwrite');
        const objStore = tx.objectStore( ObjStoreName );
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

        fdbQuery,
        fdbOpenObjStore,
        fdbForEach,
        fdbRead,
        fdbReadAll,
        fdbDelete,
        fdbWrite
    };
    */

    return {
        indexedDB,
        IDBKeyRange,
        connect: fdbConnect
    }
}

export default init;
