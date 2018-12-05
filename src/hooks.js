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

/* Functions which are hooked into core service worker processes. */

// Default hook callback - pass through the value unchanged.
const NullHook = ( origin, value ) => value;

// Registered hooks.
const Hooks = {
    'fdb-update': NullHook
};

/**
 * Register a new hook callback.
 * @param name      The hook name.
 * @param callback  The callback function.
 */
function registerHook( name, callback ) {
    // Fetch the currently registered hook.
    const hook = Hooks[name];
    // Error if no hook found.
    if( hook === undefined ) {
        throw new Error(`Bad hook name: ${name}`);
    }
    // If current hook is the default hook then replace with new callback.
    if( hook === NullHook ) {
        Hooks[name] = callback;
    }
    // Else chain the new callback on the result of the existing callback.
    else Hooks[name] = async ( origin, value ) => {
        value = await hook( origin, value );
        return callback( origin, value );
    };
}

/**
 * Get a hook function.
 * @param name  The hook name.
 */
function getHook( name ) {
    // Lookup the hook.
    let hook = Hooks[name];
    // Error if hook not found.
    if( hook === undefined ) {
        throw new Error(`Bad hook name: ${name}`);
    }
    return hook;
}

export { registerHook, getHook };

