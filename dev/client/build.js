import { fileURLToPath } from 'url';
import { resolve, sep as fileSeparator, dirname } from 'path';
import { promises as fs } from 'fs';
import { glob } from 'glob';
import { build } from 'esbuild';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

// Constants
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = resolve(__dirname, '../..');
const buildDir = resolve(rootDir, 'build');
const publicDir = resolve(buildDir, 'public');
const clientDir = resolve(rootDir, 'dev/client');
const srcDir = resolve(clientDir, 'src');

(async function main() {
    console.log('[INFO]', 'rootDir'.padEnd(10), rootDir);
    console.log('[INFO]', 'buildDir'.padEnd(10), buildDir);
    console.log('[INFO]', 'publicDir'.padEnd(10), publicDir);
    console.log('[INFO]', 'clientDir'.padEnd(10), clientDir);
    console.log('[INFO]', 'srcDir'.padEnd(10), srcDir);

    await clearPublicDir();
    await processMedia();
    await processJS();
    await processCSS();
    await processHTML();
})();

async function clearPublicDir() {
    try {
        await fs.access(publicDir);
        await fs.rm(publicDir, { recursive: true });
        await fs.mkdir(publicDir, { recursive: true });
    } catch(err) {
        if (err.code === 'ENOENT') {
            console.log('[INFO] Public directory not cleared since it does not exist');
        } else {
            console.error('[ERROR] Error clearing public directory:', err);
            process.exit(1);
        }
    }
}

async function processMedia() {
    // Create required directories
    await fs.mkdir(resolve(publicDir, 'audio'), { recursive: true });
    await fs.mkdir(resolve(publicDir, 'images'), { recursive: true });

    // Copy MP3 files
    const mp3Files = await glob('audio/*.mp3', {cwd: srcDir, absolute: true});

    for (const file of mp3Files) {
        const fileName = file.split(fileSeparator).pop();
        await fs.copyFile(
            resolve(srcDir, file),
            resolve(publicDir, 'audio', fileName)
        );
    }

    console.log(`[INFO] Copied ${mp3Files.length} audio files`);

    // Copy SVG files
    // const svgFiles = await glob('images/*.svg', {cwd: srcDir, absolute: true});
    //
    // for (const file of svgFiles) {
    //     const fileName = file.split(fileSeparator).pop();
    //     await fs.copyFile(
    //         resolve(srcDir, file),
    //         resolve(publicDir, 'images', fileName)
    //     );
    // }
    //
    // console.log(`[INFO] Copied ${svgFiles.length} image files`);

    // Copy images
    await fs.copyFile(resolve(srcDir, 'images/favicon.svg'), resolve(publicDir, 'images/favicon.svg'));
    await fs.copyFile(resolve(srcDir, 'images/board.svg'), resolve(publicDir, 'images/board.svg'));
    await fs.copyFile(resolve(srcDir, 'images/cursor.svg'), resolve(publicDir, 'images/cursor.svg'));
    console.log(`[INFO] Copied image files`);

    console.log('[INFO] Media processing complete');
}

async function processJS() {
    await build({
        entryPoints: [resolve(srcDir, 'index.js')],
        outfile: resolve(publicDir, 'index.min.js'),
        bundle: true,
        minify: true,
        format: 'iife',
    });

    console.log('[INFO] JavaScript processing complete');
}

async function processCSS() {
    const css = await fs.readFile(resolve(srcDir, 'style.css'), 'utf8');
    const output = await postcss([
        autoprefixer(), // enhance browser compatibility
        cssnano({ preset: 'default' }) // minify
    ]).process(css, { from: undefined });
    await fs.writeFile(resolve(publicDir, 'style.min.css'), output.css);

    console.log('[INFO] CSS processing complete');
}

async function processHTML() {
    // Copy index.html into public directory
    const srcHtmlPath = resolve(srcDir, 'index.html');
    const publicHtmlPath = resolve(publicDir, 'index.html');
    await fs.copyFile(srcHtmlPath, publicHtmlPath);

    let html = await fs.readFile(publicHtmlPath, 'utf-8');

    // Convert external css into inline css

    const cssFileName = 'style.min.css';
    const cssFile = resolve(publicDir, cssFileName);
    const cssContent = await fs.readFile(cssFile, 'utf-8');
    html = html.replace(
        `<link rel="stylesheet" href="style.css">`,
        `<style>${cssContent}</style>`
    );
    await fs.unlink(cssFile); // delete external css file
    console.log('[INFO] HTML processing: injected inline css, removed external css');

    // Update script tag to remove attribute type="module"

    html = html.replace(
        '<script type="module" src="index.js" defer></script>',
        '<script src="index.min.js" defer></script>'
    );
    console.log('[INFO] HTML processing: edited script tag');

    // Write to index.html
    await fs.writeFile(publicHtmlPath, html);
    console.log('[INFO] HTML processing complete');
}