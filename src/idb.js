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
async function idbOpen( origin ) {
    const { schema, url } = origin;
    const { name = url, version } = schema;
    const db = await new Promise( ( resolve, reject ) => {
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
    return db;
}

/**
 * Initialize an IndexedDB instance.
 * @param schema    The DB schema.
 * @param db        The DB connection.
 */
function idbInit( schema, db ) {
    const { stores } = schema;
    for( let name in stores ) {
        const { options, indexes } = stores[name];
        const objStore = db.createObjectStore( name, options );
        for( let index in indexes ) {
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
 * Read an object from an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param key       An object primary key.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbRead( origin, store, key, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.get( key );
        request.onsuccess = () => resolve( request.result );
        request.onerror   = () => reject( request.error );
    });
}

/**
 * Read a list of objects from an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param keys      A list of object primary keys.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbReadAll( origin, store, keys, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return Promise.all( keys.map( key => {
        return idbRead( origin, store, key, objStore );
    }));
}

/**
 * Write an object to an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param object    The object to write.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbWrite( origin, store, object, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.put( object );
        request.onsuccess = resolve;
        request.onerror   = reject;
    });
}

/**
 * Delete an object from an object store.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param key       An object primary key.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbDelete( origin, store, key, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.delete( key );
        request.onsuccess = resolve;
        request.onerror   = reject;
    });
}

/**
 * Open a cursor on an object store's primary key index.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param term      An index filter term.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbOpenPK( origin, store, term, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return objStore.openCursor( term );
}

/**
 * Open a cursor on an object store index.
 * @param origin    The content origin configuration.
 * @param store     The object store name.
 * @param index     The name of the index to open.
 * @param term      An index filter term.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function idbOpenIndex( origin, store, index, term, objStore = idbOpenObjStore( origin, store ) ) {
    objStore = await objStore;
    return objStore.index( index ).openCursor( term );
}

/**
 * Open the file object store.
 * @param origin    The content origin configuration.
 * @param mode      The transaction mode; defaults to 'readonly'.
 */
function fdbOpenObjStore( origin, mode ) {
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
async function fdbForEach( origin, index, term, callback ) {
    const request = await idbOpenIndex( origin, 'files', index, term );
    // Supporting an async callback is tricky here - the IDB transaction
    // will close once (1) request.onsuccess callback is called and (2)
    // control then returns to the main event loop. This means that after
    // an async call to the callback function, the cursor.continue() call
    // will be to a closed transaction. As a workaround, the following
    // code first synchronously builds a list of record keys within the
    // index, and then uses this list to load each record in turn before
    // calling the async callback. This approach avoids loading the full
    // dataset into memory and so delivers some of the advantage of an
    // iterative approach.
    const keys = await new Promise( ( resolve, reject ) => {
        const keys = [];
        request.onsuccess = ( e ) => {
            const cursor = e.target.result;
            if( cursor ) {
                const { primaryKey } = cursor;
                keys.push( primaryKey );
                cursor.continue();
            }
            else resolve( keys );
        };
        request.onerror = () => reject( request.error );
    });
    // Iterate over record keys, load each record and call the callback.
    for( let key of keys ) {
        const record = await fdbRead( origin, key );
        await callback( record );
    }
}

/**
 * Read a file record from the file DB.
 * @param origin    The content origin configuration.
 * @param path      A file path, relative to the content origin root.
 */
function fdbRead( origin, path ) {
    return idbRead( origin, 'files', path );
}

/**
 * Read a list of file records from the file DB.
 * @param origin    The content origin configuration.
 * @param paths     A list of file paths.
 */
function fdbReadAll( origin, paths ) {
    return idbReadAll( origin, 'files', paths );
}

/**
 * Write a file record to the file DB.
 * @param origin    The content origin configuration.
 * @param record    The record to write.
 * @param objStore  (Optional) a previously opened object store transaction.
 */
async function fdbWrite( origin, record, objStore = fdbOpenObjStore( origin, 'readwrite') ) {
    objStore = await objStore;
    return new Promise( ( resolve, reject ) => {
        const request = objStore.put( record );
        request.onsuccess = resolve;
        request.onerror   = reject;
    });
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
    fdbOpenObjStore,
    fdbForEach,
    fdbRead,
    fdbReadAll,
    fdbWrite
};
