// Hand-refined ASCII contours from the owner's basket-cat photograph.
// Keep the face and draped paw readable at the site's small character size.
export function basketCatSVG(ascii) {
  const lines = ascii.trimEnd().split(/\r?\n/);
  if (lines.some(line => /[^\x20-\x7e]/.test(line))) throw new Error('The basket cat must use ASCII characters.');
  const columns = Math.max(...lines.map(line => line.length));
  const cell = 8, lineHeight = 13, padding = 12;
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const rows = lines.map((line, y) => {
    const runs = [];
    for (let x = 0; x < columns; x++) {
      const char = line[x] || ' ';
      let color = y >= 23 ? '#795333' : '#445161';
      if (char === ':' || (y < 6 && x >= 36)) color = '#a45824';
      if (char === '@') color = '#244334';
      if (y >= 9 && y <= 12 && x >= 47 && x <= 52) color = '#985c53';
      // The white paw hangs in front of the basket, rather than becoming wicker.
      if (y >= 23 && y <= 32 && x >= 47 && x <= 59) color = '#445161';
      const last = runs.at(-1);
      if (last?.color === color) last.text += char;
      else runs.push({ color, text: char });
    }
    return `<text x="${padding}" y="${padding + y * lineHeight + 11}" xml:space="preserve" textLength="${columns * cell}" lengthAdjust="spacingAndGlyphs">${runs.map(run => `<tspan fill="${run.color}">${escape(run.text)}</tspan>`).join('')}</text>`;
  });
  const width = columns * cell + padding * 2, height = lines.length * lineHeight + padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">Vahtikissa — orange-and-white ASCII cat resting in a woven basket</title><rect width="${width}" height="${height}" rx="24" fill="#f6f3ec"/><g font-family="monospace" font-size="13" font-weight="600">${rows.join('\n')}</g></svg>\n`;
}
