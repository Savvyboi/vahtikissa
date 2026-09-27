const FORMATS = {
  social: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 }
};

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function lines(context, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const result = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && context.measureText(candidate).width > maxWidth) {
      result.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) result.push(current);
  return result;
}

export async function createSocialCard(spec, format = 'social') {
  const size = FORMATS[format] || FORMATS.social;
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  const story = format === 'story';
  const margin = story ? 82 : 70;
  const accent = spec.accent || '#003873';
  context.fillStyle = '#f5f2ea';
  context.fillRect(0, 0, size.width, size.height);
  context.fillStyle = accent;
  context.fillRect(0, 0, story ? 24 : size.width, story ? size.height : 18);

  context.fillStyle = '#003873';
  context.font = `700 ${story ? 42 : 34}px "DM Sans", Arial, sans-serif`;
  context.fillText('VK', margin, story ? 130 : 86);
  context.fillStyle = '#172032';
  context.font = `700 ${story ? 42 : 34}px "DM Sans", Arial, sans-serif`;
  context.fillText(spec.brand || 'Vahtikissa', margin + (story ? 78 : 64), story ? 130 : 86);

  context.fillStyle = accent;
  context.font = `700 ${story ? 34 : 25}px "DM Sans", Arial, sans-serif`;
  context.fillText(String(spec.eyebrow || '').toLocaleUpperCase('fi'), margin, story ? 315 : 170);

  context.fillStyle = '#172032';
  context.font = `700 ${story ? 76 : 54}px Newsreader, Georgia, serif`;
  const titleLines = lines(context, spec.title, size.width - margin * 2).slice(0, story ? 5 : 3);
  const titleLineHeight = story ? 88 : 62;
  titleLines.forEach((line, index) => context.fillText(line, margin, (story ? 405 : 245) + index * titleLineHeight));

  const statsTop = story ? 920 : 395;
  const columns = story ? 1 : Math.min(4, spec.stats.length);
  const gap = story ? 28 : 18;
  const cardWidth = story ? size.width - margin * 2 : (size.width - margin * 2 - gap * (columns - 1)) / columns;
  const cardHeight = story ? 190 : 132;
  spec.stats.forEach((stat, index) => {
    const column = story ? 0 : index % columns;
    const row = story ? index : Math.floor(index / columns);
    const x = margin + column * (cardWidth + gap);
    const y = statsTop + row * (cardHeight + gap);
    context.fillStyle = '#ffffff';
    roundedRect(context, x, y, cardWidth, cardHeight, 18);
    context.fillStyle = accent;
    context.font = `700 ${story ? 60 : 42}px "DM Sans", Arial, sans-serif`;
    context.fillText(String(stat.value), x + 28, y + (story ? 78 : 58));
    context.fillStyle = '#596273';
    context.font = `600 ${story ? 29 : 20}px "DM Sans", Arial, sans-serif`;
    lines(context, stat.label, cardWidth - 56).slice(0, 2).forEach((line, lineIndex) => context.fillText(line, x + 28, y + (story ? 128 : 94) + lineIndex * (story ? 34 : 24)));
  });

  context.fillStyle = '#596273';
  context.font = `500 ${story ? 27 : 20}px "DM Sans", Arial, sans-serif`;
  context.fillText(spec.footer || 'savvyboi.github.io/vahtikissa', margin, size.height - (story ? 92 : 44));
  const encoded = canvas.toDataURL('image/png').split(',')[1];
  if (!encoded) throw new Error('Kuvakortin luonti epäonnistui');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: 'image/png' });
}

export function shareButtons(lang = 'fi') {
  return `<div class="share-tools"><span>${lang === 'sv' ? 'Dela statistiken' : 'Jaa tilasto'}</span><button type="button" data-card-action="share">${lang === 'sv' ? 'Dela bild' : 'Jaa kuva'}</button><button type="button" data-card-action="social">${lang === 'sv' ? 'Ladda ner 1200×630' : 'Lataa 1200×630'}</button><button type="button" data-card-action="story">Instagram Story</button></div><p class="share-status sr-status" data-card-status aria-live="polite"></p>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function bindShareButtons(container, getSpec, filename, lang = 'fi') {
  container.querySelectorAll('[data-card-action]').forEach(button => button.onclick = async () => {
    const status = container.querySelector('[data-card-status]');
    const action = button.dataset.cardAction;
    button.disabled = true;
    if (status) status.textContent = lang === 'sv' ? 'Skapar bild…' : 'Luodaan kuvaa…';
    try {
      const format = action === 'story' ? 'story' : 'social';
      const blob = await createSocialCard(getSpec(), format);
      const file = new File([blob], `${filename}-${format}.png`, { type: 'image/png' });
      if (action === 'share' && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: getSpec().title, text: getSpec().shareText || '' });
        if (status) status.textContent = lang === 'sv' ? 'Delningsmenyn öppnades.' : 'Jakovalikko avattiin.';
      } else {
        downloadBlob(blob, file.name);
        if (status) status.textContent = lang === 'sv' ? 'Bilden laddades ner.' : 'Kuva ladattiin.';
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && status) status.textContent = lang === 'sv' ? 'Bilden kunde inte skapas.' : 'Kuvan luonti epäonnistui.';
    } finally { button.disabled = false; }
  });
}
