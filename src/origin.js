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

/* Default content origin configuration, and functions for registering configs. */

import {
    log,
    extname,
    joinPath,
    makeErrorResponse,
    makeJSONResponse,
    makeHTMLResponse
} from './support.js';

import { eval as pageTemplateEval } from '@locomote.sh/tinytemper';

// The list of available origins. */
const Origins = [];

// The default file DB schema.
import { Schema } from '@locomote.sh/query-api/lib/locomote/schema';

/* The default content origin configuration. */
const DefaultOrigin = {

    /* Dynamic request endpoints. */
    dynamics: {
        /* File query endpoint. */
        'query.api': async function( request, path, params ) {
            try {
                /*
                const result = await self.fdb.fdbQuery( this, params );
                */
                const result = this.fdb.query( params );
                return makeJSONResponse( result );
            }
            catch( e ) {
                log('Error executing query', e );
                return makeErrorResponse( path, 500 );
            }
        },
        /* Updates API endpoint - always delegate to network. */
        'updates.api': function( request, path, params ) {
            return fetch( request );
        }
    },

    /* Fileset category definitions. */
    filesets: {
        'app':          fileset('app', false ),
        'server':       fileset('server', false ),
        'pages':        fileset('pages', true ),
        'json':         fileset('json', false, dataFetch ),
        'files':        fileset('files', true )
    },

    /* Normalize a request. This is necessary to ensure proper caching
     * and retrieval of files. Detects directory requests (as any
     * request path without a file extension) and modifies the request
     * by appending index.html to the path.
     */
    normalizeRequest( request, origin ) {
        let { url } = request;
        if( !extname( url ) ) {
            const { settings: { indexFileName } } = origin;
            url = joinPath( url, indexFileName );
            // Create a copy of the request with the modified path.
            // Note that we only copy the request method, body and headers here.
            const { method, body, headers } = request;
            request = new Request( url, { method, body, headers });
        }
        return request;
    },

    /* Origin configuration settings. */
    settings: {
        // Default filename for index files.
        indexFileName: 'index.html',
        // Default function for evaluating page templates.
        // (The TinyTemper eval function).
        pageTemplateEval
    },

    /* Excluded sub-paths. */
    excluded: []
};

/**
 * Fetch page content. The page body is stored on the file record, and if
 * a 'format' parameter is provided with the value 'body-only' then only
 * the page body is returned; otherwise, the page body is combined with
 * a page template to produce the complete HTML file content.
 * @param request   The fetch request being processed.
 * @param path      The requested file path, relative to the origin.
 * @param params    Request parameters.
 * @param record    The file record.
 * @deprecated Review of client-rendered pages is needed.
 */
async function pageFetch( request, path, params, record ) {
    const { page } = record;
    // Check we have a page.
    if( !page ) {
        return makeErrorResponse( path, 404 );
    }
    // Read the body and return just that if requested.
    const { type, body } = page;
    if( params.get('format') == 'body-only' ) {
        return makeHTMLResponse( body );
    }
    // Load the page template.
    const origin = this;
    const template = await loadPageTemplate( origin, type );
    if( !template ) {
        return makeHTMLResponse( body );
    }
    // Combine the body with page template to generate the full page.
    const html = await evalTemplate( origin, template, { type, body, page, record });
    return makeHTMLResponse( html );
}

/**
 * Load a page template.
 * @param origin    The content origin.
 * @param pageType  The page type.
 */
async function loadPageTemplate( origin, pageType ) {
    const path = `_templates/page-${pageType}.html`;
    /*
    const record = await self.fdb.fdbRead( origin, path );
    */
    const record = await origin.fdb.read( path );
    if( !record ) {
        return undefined;
    }
    const { page } = record;
    if( !page ) {
        return undefined;
    }
    return page.body;
}

/**
 * Evaluate a page template.
 * @param origin    The content origin.
 * @param template  The template text.
 * @param context   The template context.
 */
function evalTemplate( origin, template, context ) {
    // The actual template eval function is stored in the content
    // origin's settings - this allows a content origin to use
    // an alternative templating method, by replacing this function.
    return origin.settings.pageTemplateEval( template, context );
}

/**
 * Fetch data content. The data is stored on the file record and this
 * is extracted from the record and returned as a JSON document.
 * @param request   The fetch request being processed.
 * @param path      The requested file path, relative to the origin.
 * @param params    Request parameters.
 * @param record    The file record.
 */
function dataFetch( request, path, params, record ) {
    const { data } = record;
    if( !data ) {
        return makeErrorResponse( path, 204 );
    }
    return makeJSONResponse( data );
}

/**
 * Normalize a content origin URL.
 */
function normOriginURL( url ) {
    // Convert dot to the service worker's scope URL.
    if( url == '.' ) {
        url = self.registration.scope;
    }
    // Ensure that the content URL ends with a slash.
    if( !url.endsWith('/') ) {
        url = url+'/';
    }
    return url;
}

/**
 * Initialize an origin from a content origin URL.
 */
function _initOriginFromURL( _url ) {
    const url = normOriginURL( _url );
    const schema = Object.assign({ name: url }, Schema );
    return Object.assign({ url, schema }, DefaultOrigin );
}

/**
 * Initialize an origin from an origin configuration object.
 */
function _initOriginFromConfig( config ) {
    // Ensure we have a content URL.
    if( !config.url ) {
        throw new Error('Content origin configuration must specify a URL');
    }
    // Normalize the origin URL.
    const url = normOriginURL( config.url );
    // Merge schema config in with defaults.
    const schema = mergeDBSchema( Schema, config.schema, url );
    // Read other configuration properties.
    const {
        dynamics,
        filesets,
        settings,
        normalizeRequest = DefaultOrigin.normalizeRequest,
        excluded         = [],
        _test            = false
    } = config;
    // Following code implements a targeted merge of the custom origin's
    // configuration over the default configuration.
    // - The custom configuration URL is always copied to the result.
    // - The custom configuration's dynamic endpoints are copied over the
    //   default config's endpoints.
    // - The custom configuration's filesets are copied over the default
    //   config's filesets.
    // - The custom configuration's settings are copied over the default
    //   config's settings.
    // - The DB schemas are merged according to the method described in
    //   the mergeDBSchema() function.
    // - A function for normalizing requests can be supplied which overrides
    //   the default.
    // - Excluded sub-paths are used as is.
    // - A flag indicating whether to run the origin in test mode can be
    //   supplied.
    return {
        url,
        fdb,
        dynamics:   Object.assign( {}, DefaultOrigin.dynamics, dynamics ),
        filesets:   Object.assign( {}, DefaultOrigin.filesets, filesets ),
        settings:   Object.assign( {}, DefaultOrigin.settings, settings ),
        schema:     mergeDBSchema( Schema, schema, url ),
        normalizeRequest,
        excluded,
        _test
    };
}

/**
 * Initialize a content origin configuration.
 * @param config    A content origin configuration, can be either:
 *                  - A string specifying a content origin URL; the
 *                    the default origin configuration is used.
 *                  - A complete content origin configuration.
 */
function initOrigin( config ) {
    const origin = typeof config == 'string'
        ? _initOriginFromURL( config )
        : _initOriginFromConfig( config );
    // Connect to the origin's file DB.
    origin._connected = self.fdb.connect( origin ).then( fdb => origin.fdb = fdb );
    return origin;
}

/**
 * Merge two database schemas.
 * @param s1    A database schema (required).
 * @param s2    A database schema (optional).
 * @param name  The database name.
 */
function mergeDBSchema( s1, s2, name ) {
    // If only one argument then return a copy of it with the name
    // property.
    if( s2 === undefined ) {
        return Object.assign({ name }, s1 );
    }
    // Initialize result with properties from first schema.
    // Note database name added to the schema here.
    const result = Object.assign({ name }, s1 );
    const { version, stores } = s2;
    // Ensure second schema has required values.
    if( version === undefined ) {
        throw new Error('Database schema must specify version');
    }
    if( stores === undefined ) {
        throw new Error('Database schema must define object stores');
    }
    // Overwrite schema version with value;
    result.version = version;
    // Merge object store definitions.
    result.stores = Object.assign({}, s1.stores, stores );
    return result;
}

/**
 * Initialize a fileset descriptor.
 * @param name      The fileset name.
 * @param cachable  A boolean specifying whether files within the fileset
 *                  are stored within the service worker's response cache.
 * @param fetcher   (Optional) a function for handling fetch requests for
 *                  files within the fileset.
 */
function fileset( name, cachable, fetcher ) {
    const cacheName = cachable ? name : undefined;
    return { name, cacheName, fetcher };
}

/**
 * Register an origin configuration.
 * Origins can't share the same content URL, so if a previously added origin
 * has the same URL as the one being added then it is replaced with the new
 * origin.
 */
function addOrigin( origin ) {
    origin = initOrigin( origin );
    // Check if any previously added origin has the same URL...
    const newURL = origin.url;
    // Add the new origin to the list of origins. Origins are sorted by
    // length of origin url, longest to shortest; this is done so that
    // the router finds more specific origins first.
    for( let idx = 0; idx < Origins.length; idx++ ) {
        const { url } = Origins[idx];
        // If current item has same url as origin being added then
        // replace with the new origin.
        if( url == newURL ) {
            Origins[idx] = origin;
            return;
        }
        // If current item has a shorter url than the origin being
        // added then insert new origin before it.
        if( url.length < newURL.length ) {
            Origins.splice( idx, 0, origin );
            return;
        }
    }
    // New origin belongs at end of list.
    Origins.push( origin );
}

/**
 * Register multiple origin configurations.
 */
function addOrigins( origins ) {
    if( !Array.isArray( origins ) ) {
        addOrigin( origins );
        return;
    }
    origins.forEach( addOrigin );
}

/**
 * Wait until all origins are connected and ready to handle requests.
 */
function ready() {
    return Promise.all( Origins.map( o => o._connected ) );
}

export {
    Origins,
    DefaultOrigin,
    addOrigin,
    addOrigins,
    ready 
};
