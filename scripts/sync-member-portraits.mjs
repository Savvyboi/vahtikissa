import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// The same official image endpoint used by eduskunta.fi's member cards.
// Keep a local copy so portraits also work without a third-party request.
const data = JSON.parse(await readFile(new URL('../data/parliament.json', import.meta.url), 'utf8'));
const out = new URL('../assets/members/', import.meta.url);
await mkdir(out, { recursive: true });
const members = [...data.members];
if (!process.argv.includes('--refresh')) {
  for (let index = members.length - 1; index >= 0; index--) {
    try { await access(new URL(`${members[index].id}.webp`, out)); members.splice(index, 1); } catch {}
  }
}
const requested = members.length;
if (!requested) { console.log('All member portraits are already present.'); process.exit(0); }
const failures = [];
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
try { await Promise.all(Array.from({ length: 4 }, async () => {
  const page = await browser.newPage();
  for (let member; (member = members.shift());) {
    const url = `https://www.eduskunta.fi/api/memberImages/${encodeURIComponent(member.id)}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new Error('Expected an official PNG portrait');
      const encoded = await page.evaluate(async source => {
        const image = new Image(); image.src = source; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = Math.round(image.height * 240 / image.width);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/webp', .84).split(',')[1];
      }, `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`);
      await writeFile(new URL(`${member.id}.webp`, out), Buffer.from(encoded, 'base64'));
    } catch (error) {
      failures.push(`${member.id} ${member.firstName} ${member.lastName}: ${error.message}`);
    }
  }
  await page.close();
})); } finally { await browser.close(); }
console.log(`Official portraits: ${requested - failures.length}/${requested}`);
if (failures.length) throw new Error(failures.join('\n'));
