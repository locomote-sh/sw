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

import { fdbRead } from './idb.js';

import {
    makeErrorResponse,
    makeJSONResponse,
    makeHTMLResponse
} from './support.js';

import { query } from './query.js';

import { TinyTemper } from './tinytemper.js';

import { log } from './support.js';

// The list of available origins. */
const Origins = [];

/* The default content origin configuration. */
const DefaultOrigin = {

    /* Dynamic request endpoints. */
    dynamics: {
        /* File query endpoint. */
        'query.api': async function( request, path, params ) {
            try {
                const result = await query( this, params );
                return makeJSONResponse( result );
            }
            catch( e ) {
                log('Error executing query', e );
                return makeErrorResponse( path, 500 );
            }
        }
    },

    /* Fileset category definitions. */
    filesets: {
        'app':           fileset('app', true ),
        'app/templates': fileset('app/templates', false ),
        'assets':        fileset('assets', true ),
        'content/pages': fileset('content/pages', false, pageFetch ),
        'content/data':  fileset('content/data', false, dataFetch ),
        'files':         fileset('files', true ),
        'server':        fileset('server', false )
    },

    /* Database schema. */
    schema: {
        version: 1,
        stores: {
            'files': {
                options: {
                    keyPath: 'path'
                },
                indexes: {
                    'category': {
                        keyPath: 'category',
                        options: { unique: false }
                    },
                    'status': {
                        keyPath: 'status',
                        options: { unique: false }
                    },
                    'page-type': {
                        keyPath: 'page.type',
                        options: { unique: false }
                    }
                }
            }
        }
    },

    /* Origin configuration settings. */
    settings: {
        // Default function for evaluating page templates.
        pageTemplateEval: TinyTemper.evaluate
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
    const record = await fdbRead( origin, path );
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
 * Initialize a content origin configuration.
 * @param config    A content origin configuration, can be either:
 *                  - A string specifying a content origin URL; the
 *                    the default origin configuration is used.
 *                  - A complete content origin configuration.
 */
function initOrigin( config ) {
    // If configuration is a string then use this as the URL of a content
    // origin with the default configuration.
    if( typeof config == 'string' ) {
        const url = normOriginURL( config );
        return Object.assign({ url }, DefaultOrigin );
    }
    // Read configuration properties.
    let {
        url,
        dynamics,
        filesets,
        settings,
        schema,
        excluded = [] 
    } = config;
    // Ensure we have a content URL.
    if( !url ) {
        throw new Error('Content origin configuration must specify a URL');
    }
    url = normOriginURL( url );
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
    // - Excluded sub-paths are used as is.
    return {
        url:        url,
        dynamics:   Object.assign( {}, DefaultOrigin.dynamics, dynamics ),
        filesets:   Object.assign( {}, DefaultOrigin.filesets, filesets ),
        settings:   Object.assign( {}, DefaultOrigin.settings, settings ),
        schema:     mergeDBSchema( DefaultOrigin.schema, schema ),
        excluded
    };
}

/**
 * Merge two database schemas.
 * @param s1    A database schema (required).
 * @param s2    A database schema (optional).
 */
function mergeDBSchema( s1, s2 ) {
    // If only one argument then return it as the result.
    if( s2 === undefined ) {
        return s1;
    }
    // Initialize result with properties from first schema.
    const result = Object.assign( {}, s1 );
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
    result.stores = Object.assign( {}, s1.stores, stores );
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
    for( const idx = 0; idx < Origins.length; idx++ ) {
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

export {
    Origins,
    DefaultOrigin,
    addOrigin,
    addOrigins
};
