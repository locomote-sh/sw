// TODO: Move this to its own repo.
window.locomote = {
    sw: {
        /**
         * Register a service worker.
         */
        register: function( url = 'sw.js' ) {
            // TODO Review this and use case around it.
            window.onload = () => {
                if( 'serviceWorker' in navigator ) {
                    navigator.serviceWorker.register( url )
                    .then( r => console.log('Service worker registered', r ) )
                    .catch( e => console.error('Failed to register service worker', e ) );
                }
                else console.log('navigator.serviceWorker not found');
            }
        },
        /**
         * List all registered service workers.
         */
        list: async function( info = 'scopes' ) {
            let registrations = await navigator.serviceWorker.getRegistrations()
            switch( info ) {
                case 'full':
                    break;
                case 'scopes':
                default:
                    registrations = registrations.map( reg => reg.scope );
            }
            console.log( registrations );
        },
        /**
         * Unregister a service worker.
         */
        unregister: async function( ...scopes ) {
            let count = 0;
            // See https://stackoverflow.com/a/33705250/8085849
            let registrations = await navigator.serviceWorker.getRegistrations()
            for( let registration of registrations ) {
                if( !scopes || scopes.some( scope => scope == registration.scope ) ) {
                    registration.unregister()
                    count++;
                }
            }
            console.log(`Unregistered ${count} service worker${count ? 's' : ''}`);
        },
        // TODO Add an isInstalled function
        /**
         * Post a message to all registered service workers.
         */
        post: function( message ) {
            navigator.serviceWorker.controller.postMessage( message );
        },
        /**
         * Refresh a content origin.
         * @param origin    The origin path.
         * @param interval  A refresh interval, in seconds. If specified then the
         *                  origin is automatically refreshed after the specified
         *                  interval. It not provided then the origin is refreshed
         *                  once, immediately.
         * TODO Split this into refresh and scheduleRefresh variants; make origin
         * optional and derive from page URL if not present.
         */
        refresh: function( origin, interval ) {
            const refresh = () => {
                this.post({ name: 'refresh', args: origin });
            };
            if( interval ) {
                window.setInterval( refresh, interval * 1000 );
            }
            else refresh();
        }
    }
}
