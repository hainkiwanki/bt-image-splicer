import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import path from 'path';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
    plugins: [vue(), vuetify({ autoImport: true })],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: resolve(__dirname, 'dist'),
    },
});
