import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Keep every browser icon in sync with the site's existing cat portrait.
// Run with BROWSER_CHANNEL=msedge (or chrome) to use an installed browser.
const root = new URL('../', import.meta.url);
const logo = await readFile(new URL('assets/cat-logo.svg', root), 'utf8');
const artwork = logo.match(/<g\b[\s\S]*<\/g>/)?.[0];
if (!artwork) throw new Error('The cat logo does not contain SVG artwork.');
// A fine stroke keeps the original ASCII portrait legible at browser-tab sizes.
const iconArtwork = artwork.replace('<g ', '<g stroke="#814113" stroke-width="0.75" ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-46 -10 380 380" role="img" aria-labelledby="title"><title id="title">Vahtikissa</title><rect x="-46" y="-10" width="380" height="380" rx="48" fill="#f6f3ec"/>${iconArtwork}</svg>\n`;
await writeFile(new URL('favicon.svg', root), svg);

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
});
try {
  const page = await browser.newPage();
  const rasters = await page.evaluate(async source => {
    const image = new Image();
    image.src = source;
    await image.decode();
    return [16, 32, 48, 96, 180].map(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      // Touch icons need an opaque square; browser tabs retain the rounded SVG.
      context.fillStyle = '#f6f3ec';
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      return { size, png: canvas.toDataURL('image/png').split(',')[1] };
    });
  }, `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  const icons = rasters.map(({ size, png }) => ({ size, png: Buffer.from(png, 'base64') }));
  for (const { size, png } of icons) {
    const filename = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`;
    await writeFile(new URL(filename, root), png);
  }

  // An ICO directory can hold PNG-compressed frames without another dependency.
  const frames = icons.filter(({ size }) => size <= 48);
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await writeFile(new URL('favicon.ico', root), Buffer.concat([header, ...frames.map(({ png }) => png)]));
  console.log('Created cat favicon SVG, 16/32/48/96px PNGs, multi-size ICO and 180px Apple touch icon.');
} finally {
  await browser.close();
}
