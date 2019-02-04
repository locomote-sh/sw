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

/* Functions for working with IndexedDB databases. */

/**
 * Open an IndexedDB connection.
 * @param origin    The content origin configuration.
 */
function idbOpen( origin ) {
    const { schema, url } = origin;
    const { name = url, version } = schema;
    return new Promise( ( resolve, reject ) => {
        const request = indexedDB.open( name, version );
        request.onsuccess = ( e ) => {
            resolve( request.result );
        };
        request.onerror = ( e ) => {
            reject( request.error );
        };
        request.onupgradeneeded = ( e ) => {
            idbInit( schema, e.target.result );
        };
    });
}

/**
 * Initialize an IndexedDB instance.
 * @param schema    The DB schema.
 * @param db        The DB connection.
 */
function idbInit( schema, db ) {
    const { stores } = schema;
    for( const name in stores ) {
        const { options, indexes } = stores[name];
        const objStore = db.createObjectStore( name, options );
        for( const index in indexes ) {
            const { keyPath, options } = indexes[index];
            objStore.createIndex( index, keyPath, options );
        }
    }
}

/**
 * Open a transaction on an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param mode      The transaction mode; defaults to 'readonly'.
 */
async function idbOpenObjStore( origin, store, mode = 'readonly' ) {
    const db = await idbOpen( origin );
    return db.transaction( store, mode ).objectStore( store );
}

/**
 * Convert an idb request object to a promise.
 */
function reqAsPromise( request ) {
    return new Promise( ( resolve, reject ) => {
        request.onsuccess = () => resolve( request.result );
        request.onerror   = () => reject( request.error );
    });
}

/**
 * Read an object from an object store.
 * @param key       An object primary key.
 * @param objStore  An open object store transaction.
 */
function idbRead( key, objStore ) {
    return reqAsPromise( objStore.get( key ) );
}

/**
 * Read a list of objects from an object store.
 * @param keys      A list of object primary keys.
 * @param objStore  An open object store transaction.
 */
function idbReadAll( keys, objStore ) {
    return Promise.all( keys.map( key => {
        return idbRead( key, objStore );
    }));
}

/**
 * Write an object to an object store.
 * @param object    The object to write.
 * @param objStore  An open object store transaction.
 */
function idbWrite( object, objStore ) {
    return reqAsPromise( objStore.put( object ) );
}

/**
 * Delete an object from an object store.
 * @param key       An object primary key.
 * @param objStore  An open object store transaction.
 */
function idbDelete( key, objStore ) {
    return reqAsPromise( objStore.delete( key ) );
}

/**
 * Open a cursor on an object store's primary key index.
 * @param term      An index filter term.
 * @param objStore  An open object store transaction.
 */
function idbOpenPK( term, objStore ) {
    return objStore.openCursor( term );
}

/**
 * Open a cursor on an object store index.
 * @param index     The name of the index to open.
 * @param term      An index filter term.
 * @param objStore  An open object store transaction.
 */
function idbOpenIndex( index, term, objStore ) {
    return objStore.index( index ).openCursor( term );
}

/**
 * Count the number of items in an index.
 * @param index     The name of the index to open.
 * @param term      An index filter term.
 * @param objStore  An open object store transaction.
 */
async function idbIndexCount( index, term, objStore ) {
    return reqAsPromise( objStore.index( index ).count( term ) );
}
    
/**
 * Open the file object store.
 * @param origin    The content origin configuration.
 * @param mode      The transaction mode; defaults to 'readonly'.
 */
function fdbOpenObjStore( origin, mode = 'readwrite' ) {
    return idbOpenObjStore( origin, 'files', mode );
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


export {
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
