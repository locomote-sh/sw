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

/* A small and simple template engine. */

// Regex for parsing templates.
// Attempts to match the following groups:
// 1. Prefix not containing a { character.
// 2. A valid reference between { and } characters.
// 3. Suffix after a } character.
const re = /^([^{]*)[{]([-a-zA-Z0-9_$.]+)[}]([\s\S]*)$/;

// Create a compiled template text node.
function text( text ) {
    // Return a function which returns the text.
    return () => text;
}

// Create a compiled template reference node.
function ref( ref ) {
    // Ref is a dotted path reference - break into an array of path components.
    ref = ref.split('.');
    // Return a function which resolves the reference against a data context.
    return ( cx ) => {
        let value = resolve( ref, cx );
        return value === undefined ? '' : value;
    };
}

// Resolve a dotted path reference against a data context.
// The reference is passed as an array of path components.
function resolve( ref, cx ) {
    for( let i = 0; i < ref.length && cx !== undefined; cx = cx[ref[i++]] );
    return cx;
}

// Parse a template string into a compiled template.
// Returns a function which can be evaluated against a data context.
function parseTemplate( t ) {
    let c = [];                 // An array of compiled template nodes (functions).
    while( t ) {                // While still a template string to parse...
        let r = re.exec( t );   // Match the template string against the parse regex.
        if( r ) {               // If match found...
            c.push( text( r[1] ) );     // Then first group is the reference prefix...
            c.push( ref( r[2] ) );      // Followed by a data reference...
            t = r[3];                   // Followed by the unparsed suffix.
        }
        else {                          // Else no match found.
            let i = t.indexOf('}');     // Check for possible invalid reference...
            if( i > -1 ) {              // ...and if found...
                c.push( text( t.substring( 0, i + 1 ) ) );  // ...then add string up to }
                t = t.substring( i + 1 );   // ...and continue parsing after the }
            }
            else {                      // No more references in the template,
                c.push( text( t ) );    // so append the rest of the template text...
                t = false;              // ...and finish parsing.
            }
        }
    }
    // Return a function to evaluate the compiled template against a data context.
    return function( ctx ) {
        let s = '';                             // The result string.
        for( let i = 0; i < c.length; i++ ) {   // Iterate over the template nodes...
            s += c[i]( ctx );                   // ...and eval against the context.
        }
        return s;                               // Return the result string.
    };
}

// Cache of previously compiled templates.
const Cache = {};

// Parse a template string.
function parse( t ) {
    let f = Cache[t];
    return f ? f : Cache[t] = parseTemplate( t );
}

// Evaluate a template string against the specified context object.
function evaluate( t, c ) {
    return parse( t )( c );
}

const TinyTemper = { parse, evaluate };

export { TinyTemper };


