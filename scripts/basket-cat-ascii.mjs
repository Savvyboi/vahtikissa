// Deterministic photograph-to-ASCII conversion. Every glyph and colour is
// sampled from DSC_0001.jpg; no outlines or facial features are drawn by hand.
export async function basketPhotoASCII(page, source) {
  const sampled = await page.evaluate(async source => {
    const image = new Image(); image.src = source; await image.decode();
    // A rectangular crop keeps the complete basket, toys, original pose and paw.
    const crop = [.14, .10, .57, .87], columns = 240;
    const rows = Math.round(columns * .6 * (image.height * crop[3]) / (image.width * crop[2]));
    const canvas = document.createElement('canvas'); canvas.width = columns; canvas.height = rows;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, crop[0]*image.width, crop[1]*image.height, crop[2]*image.width, crop[3]*image.height, 0, 0, columns, rows);
    const pixels = context.getImageData(0, 0, columns, rows).data;
    const luminances = Array.from({length:columns*rows},(_,index)=>{
      const p=index*4;return (pixels[p]*.2126+pixels[p+1]*.7152+pixels[p+2]*.0722)/255;
    });
    const sorted = [...luminances].sort((a,b)=>a-b);
    const low = sorted[Math.floor(sorted.length*.01)], high = sorted[Math.floor(sorted.length*.99)];
    const ramp = ' .,:;irsXA253hMHGS#9B&@';
    return Array.from({length:rows},(_,y)=>Array.from({length:columns},(_,x)=>{
      const index=y*columns+x,p=index*4;
      const light=Math.max(0,Math.min(1,(luminances[index]-low)/(high-low)));
      const char=ramp[Math.min(ramp.length-1,Math.floor(light**.65*ramp.length))];
      const rgb=[pixels[p],pixels[p+1],pixels[p+2]].map(value=>Math.min(255,Math.round(255*(value/255)**.7*1.25/8)*8));
      return {char,color:`#${rgb.map(value=>value.toString(16).padStart(2,'0')).join('')}`};
    }));
  },source);
  const width=sampled[0].length*6,height=sampled.length*10;
  const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const text=sampled.map((row,y)=>{
    const runs=[];
    for(const cell of row){const last=runs.at(-1);if(last?.color===cell.color)last.text+=cell.char;else runs.push({color:cell.color,text:cell.char})}
    return `<text x="0" y="${y*10+8}" xml:space="preserve" textLength="${width}" lengthAdjust="spacingAndGlyphs">${runs.map(run=>`<tspan fill="${run.color}">${escape(run.text)}</tspan>`).join('')}</text>`;
  }).join('\n');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">Vahtikissa — detailed ASCII conversion of DSC_0001.jpg</title><rect width="${width}" height="${height}" fill="#14130f"/><g font-family="monospace" font-size="10" font-weight="700">${text}</g></svg>\n`;
  // Rasterize the ASCII itself at full resolution before downsampling. This
  // avoids thin-row aliasing when thousands of text glyphs fit in a thumbnail.
  const preview=await page.evaluate(async ({svg,width,height})=>{
    const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;await image.decode();
    const full=document.createElement('canvas');full.width=width;full.height=height;
    full.getContext('2d').drawImage(image,0,0,width,height);
    const thumbnail=document.createElement('canvas');thumbnail.width=600;thumbnail.height=Math.round(600*height/width);
    const context=thumbnail.getContext('2d');context.imageSmoothingQuality='high';
    context.drawImage(full,0,0,thumbnail.width,thumbnail.height);
    return thumbnail.toDataURL('image/webp',.95).split(',')[1];
  },{svg,width,height});
  return {svg,preview,ascii:sampled.map(row=>row.map(cell=>cell.char).join('')).join('\n')+'\n'};
}
