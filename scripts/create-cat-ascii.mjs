import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Convert the user's two reference photographs to actual ASCII text in SVGs.
// Usage: node scripts/create-cat-ascii.mjs basket-photo.jpg face-photo.jpg
const inputs = process.argv.slice(2);
if (inputs.length !== 2) throw new Error('Provide the basket photo and face photo paths.');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
try {
  const page = await browser.newPage();
  await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
  for (let index = 0; index < inputs.length; index++) {
    const source = `data:image/jpeg;base64,${(await readFile(inputs[index])).toString('base64')}`;
    const rows = await page.evaluate(async ({ source, index }) => {
      const img = new Image(); img.src = source; await img.decode();
      const cols = index ? 48 : 100, rowCount = index ? 36 : 66;
      const crop = index ? [.325,.19,.39,.53] : [.15,.12,.56,.83];
      const canvas = document.createElement('canvas'); canvas.width = cols; canvas.height = rowCount;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, crop[0]*img.width, crop[1]*img.height, crop[2]*img.width, crop[3]*img.height, 0, 0, cols, rowCount);
      const pixels = ctx.getImageData(0,0,cols,rowCount).data;
      const polygon = index ? [[.13,.36],[.23,.01],[.36,.16],[.40,.29],[.53,.34],[.98,.25],[.97,.35],[.80,.57],[.76,.83],[.57,.98],[.27,.93],[.06,.73],[.07,.50]] : null;
      const inside = (x,y) => {
        if (!polygon) return ((x-.49)/.5)**2+((y-.54)/.48)**2 <= 1 || (y>.07&&y<.34&&x>.79-(y-.07)*.6&&x<.86+(y-.07)*.3);
        let hit=false;
        for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
          const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
          if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) hit=!hit;
        }
        return hit;
      };
      const lights=[];
      for(let y=0;y<rowCount;y++)for(let x=0;x<cols;x++)if(inside(x/cols,y/rowCount)){
        const p=(y*cols+x)*4;lights.push((pixels[p]*.299+pixels[p+1]*.587+pixels[p+2]*.114)/255);
      }
      lights.sort((a,b)=>a-b);
      const low=lights[Math.floor(lights.length*.05)],high=lights[Math.floor(lights.length*.95)];
      const ramp = '@%#*+=-:.';
      return Array.from({length:rowCount},(_,y)=>Array.from({length:cols},(_,x)=>{
        if(!inside(x/cols,y/rowCount))return {char:' ',color:'#334155'};
        const p=(y*cols+x)*4,[r,g,b]=pixels.slice(p,p+3),light=(r*.299+g*.587+b*.114)/255;
        const contrast=Math.max(0,Math.min(1,(light-low)/(high-low||1)));
        const char=ramp[Math.min(ramp.length-1,Math.floor(contrast*ramp.length))];
        const color=r>g*1.12&&r>b*1.2?(light<.3?'#542d18':'#814113'):(light<.3?'#172032':'#334155');
        return {char,color};
      }));
    }, { source, index });
    const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    const width = rows[0].length * 6, height = rows.length * 10;
    const text = rows.map((row,y)=>{
      const runs=[];
      for(const cell of row){const last=runs.at(-1);if(last?.color===cell.color)last.text+=cell.char;else runs.push({color:cell.color,text:cell.char})}
      return `<text x="0" y="${y*10+8}" xml:space="preserve" textLength="${width}" lengthAdjust="spacingAndGlyphs">${runs.map(run=>`<tspan fill="${run.color}">${escape(run.text)}</tspan>`).join('')}</text>`;
    }).join('\n');
    const title = index ? 'Vahtikissa — ASCII portrait of the orange cat' : 'Vahtikissa — ASCII cat watching from a basket';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${width+20} ${height+20}" role="img" aria-labelledby="title"><title id="title">${title}</title><rect x="-10" y="-10" width="${width+20}" height="${height+20}" rx="24" fill="#f6f3ec"/><g font-family="monospace" font-size="10">${text}</g></svg>\n`;
    await writeFile(new URL(`../assets/cat-${index?'logo':'character'}.svg`,import.meta.url),svg);
    await writeFile(new URL(`../assets/cat-${index?'logo':'character'}.txt`,import.meta.url),rows.map(row=>row.map(cell=>cell.char).join('').trimEnd()).join('\n')+'\n');
  }
} finally { await browser.close(); }
