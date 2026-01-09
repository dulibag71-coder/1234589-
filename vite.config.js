import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        host: true,
        port: 3000
    },
    optimizeDeps: {
        exclude: ['ammo.js']
    },
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                game: 'game.html',
                settings: 'settings.html',
                history: 'history.html'
            }
        }
    }
});
