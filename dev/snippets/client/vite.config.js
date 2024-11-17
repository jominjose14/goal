import { defineConfig } from 'vite';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '../..');
const buildDir = resolve(rootDir, 'build');
const publicDir = resolve(buildDir, 'public');
const clientDir = resolve(rootDir, 'dev/client');
const srcDir = resolve(clientDir, 'src');

export default defineConfig({
    root: srcDir,
    build: {
        outDir: publicDir,
        emptyOutDir: true,
        rollupOptions: {
            input: resolve(srcDir, 'index.html'),
        },
        minify: 'terser',
        cssMinify: true,
        assetsInlineLimit: 0, // prevent inlining of svg images
    }
});