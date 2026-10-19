import { escapeHTML as e, fetchJSONWithTimeout } from './app-utils.js';
import { emptyInsights, insightTags, currentInsight, matchesAITags, sameSource, validateRecordResult } from './ai-insights.js';

let index = emptyInsights(), pending, loadFailed = false;
const detailRequests = new Map();
const L = (lang, fi, sv, en) => lang === 'sv' ? sv : lang === 'en' ? en : fi;
const text = (value, lang) => value?.[lang] || value?.fi || '';
const safeURL = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
export async function loadAIInsights() {
  if (!pending) pending = fetchJSONWithTimeout('./data/ai-insights.json', { cache: 'no-cache' }).then(value => {
    if (value.version !== 1 || !value.programmes || !value.records?.votes || !value.records?.legislation) throw new Error('Invalid AI index');
    index = value; loadFailed = false;
  }).catch(() => { loadFailed = true; pending = null; });
  await pending;
  return index;
}
export function followedTags() {
  try {
    const value = JSON.parse(localStorage.getItem('vahtikissa-ai-tags') || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch { return []; }
}
export function selectedAITag() { return new URLSearchParams(location.hash.split('?')[1] || '').get('tag') || 'all'; }
export function filterAIItems(kind, items) {
  const selected = selectedAITag(), followed = followedTags();
  if (selected === 'all') return items;
  return items.filter(item => matchesAITags(currentInsight(index, kind, item), selected, followed));
}
const tagLink = (kind, id) => '#/' + kind + '?tag=' + encodeURIComponent(id);
export function aiTagBadges(kind, item, lang) {
  const entry = currentInsight(index, kind, item);
  if (!entry?.tags?.length) return '';
  const tags = new Map(insightTags(index).map(tag => [tag.id, tag]));
  return '<div class="ai-tags">' + entry.tags.filter(id => tags.has(id)).map(id =>
    '<a class="ai-tag" href="' + e(tagLink(kind, id)) + '">' + e(text(tags.get(id).label, lang)) + '</a>').join('') + '</div>';
}
export function programmeAITags(id, lang) {
  const programme = index.programmes[id];
  if (!programme) return '';
  return '<details class="ai-programme-tags"><summary>' + L(lang, 'AI: teemat ja lupaukset', 'AI: teman och löften', 'AI: themes and promises') + '</summary><p>' +
    L(lang, 'AI voi erehtyä. Teemayhteys ei osoita lupauksen toteutumista.', 'AI kan göra fel. Ett gemensamt tema visar inte att ett löfte har uppfyllts.', 'AI can make mistakes. A shared theme does not establish that a promise was kept.') +
    '</p>' + programme.tags.map(tag => '<div class="ai-programme-theme"><strong>' + e(text(tag.label, lang)) + '</strong><p>' +
      L(lang, tag.promise ? 'Ohjelman lupaus' : 'Ohjelman teema', tag.promise ? 'Löfte i programmet' : 'Tema i programmet', tag.promise ? 'Programme promise' : 'Programme theme') +
      '</p><blockquote>' + e(tag.quote) + '</blockquote><a href="' + e(tagLink('legislation', tag.id)) + '">' + L(lang, 'Ehdotukset', 'Förslag', 'Proposals') +
      '</a> · <a href="' + e(tagLink('votes', tag.id)) + '">' + L(lang, 'Äänestykset', 'Omröstningar', 'Votes') +
      '</a> ' + followButton(tag.id, lang) + '</div>').join('') + '</details>';
}
function followButton(id, lang) {
  const following = followedTags().includes(id);
  return '<button type="button" class="ai-follow" data-ai-follow="' + e(id) + '" aria-pressed="' + following + '">' +
    L(lang, following ? 'Seurataan' : 'Seuraa teemaa', following ? 'Följer' : 'Följ temat', following ? 'Following' : 'Follow theme') + '</button>';
}
function notice(lang) {
  return L(lang, 'AI:n tuottama yhteenveto ja tunnisteet voivat sisältää virheitä. Tarkista tiedot alkuperäisestä lähteestä. Teemayhteys ei tarkoita puolueen tukea tai lupauksen toteutumista.',
    'AI-genererade sammanfattningar och taggar kan innehålla fel. Kontrollera originalkällan. Ett gemensamt tema innebär inte partiets stöd eller att ett löfte har uppfyllts.',
    'AI-generated briefs and tags can contain mistakes. Check the original source. A shared theme does not establish party support or fulfilment of a promise.');
}
function briefPanel(kind, item, lang) {
  return '<details class="ai-brief" data-ai-brief><summary><strong>' + L(lang, 'AI-lyhennelmä', 'AI-sammanfattning', 'AI brief') +
    '</strong><span>' + L(lang, 'AI voi erehtyä – tarkista lähde', 'AI kan göra fel – kontrollera källan', 'AI can make mistakes — check the source') +
    '</span></summary><div class="ai-brief-body"><div data-ai-brief-content role="status"></div><p class="ai-brief-scope" data-ai-scope>' +
    L(lang, 'Vain metatiedot: ehdotuksen varsinaiset muutokset eivät sisälly tähän lyhennelmään.', 'Endast metadata: förslagets konkreta ändringar ingår inte i denna sammanfattning.', 'Metadata only: this brief does not describe the proposal’s substantive changes.') +
    '</p><details class="ai-brief-method"><summary>' + L(lang,'Lähteet ja rajaukset','Källor och avgränsningar','Sources and limits') +
    '</summary><p class="ai-notice">' + notice(lang) + '</p><div data-ai-evidence></div><p class="ai-provenance"></p><a href="' + e(safeURL(item.resultUrl || item.url || item.documentUrl)) + '" target="_blank" rel="noreferrer">' +
    L(lang, 'Alkuperäinen lähde', 'Originalkälla', 'Original source') + ' ↗</a></details></div></details>';
}
function mountBrief(holder, kind, item, lang) {
  holder.innerHTML = briefPanel(kind, item, lang);
  const details = holder.querySelector('details'), content = holder.querySelector('[data-ai-brief-content]');
  let loaded = false;
  details.addEventListener('toggle', async () => {
    if (!details.open || loaded) return;
    loaded = true;
    const entry = currentInsight(index, kind, item);
    if (!entry || !/^[a-f0-9]{64}\.json$/.test(entry.file || '')) {
      content.textContent = L(lang, 'AI-lyhennelmää ei ole vielä saatavilla tälle tietueelle.', 'Ingen AI-sammanfattning finns ännu för denna post.', 'An AI brief is not yet available for this record.');
      return;
    }
    const load = async () => {
      content.textContent = L(lang, 'Ladataan lyhennelmää…', 'Sammanfattningen laddas…', 'Loading brief…');
      try {
        if (!detailRequests.has(entry.file)) detailRequests.set(entry.file, fetchJSONWithTimeout('./data/ai/' + entry.file).catch(error => { detailRequests.delete(entry.file); throw error; }));
        const result = await detailRequests.get(entry.file);
        if (result.kind !== kind || result.id !== item.id || !sameSource(kind, item, result.source)) throw new Error('Stale AI brief');
        const validated = validateRecordResult(result, new Set(insightTags(index).map(tag => tag.id)));
        if (!holder.isConnected) return;
        const uid = 'ai-' + kind + '-' + String(item.id).replace(/[^a-z0-9-]/gi, '-');
        content.removeAttribute('role');
        content.innerHTML = '<div class="ai-language-tabs" role="tablist" aria-label="' + L(lang, 'Lyhennelmän kieli', 'Sammanfattningens språk', 'Brief language') + '">' +
          [['fi','Suomi'],['sv','Svenska'],['en','English']].map(([key, name]) => '<button type="button" role="tab" id="' + uid + '-tab-' + key + '" data-ai-language="' + key + '" aria-controls="' + uid + '-panel" aria-selected="' + (key === lang) + '" tabindex="' + (key === lang ? '0' : '-1') + '">' + name + '</button>').join('') +
          '</div><div role="tabpanel" id="' + uid + '-panel" aria-labelledby="' + uid + '-tab-' + lang + '" lang="' + lang + '" tabindex="0"><p data-ai-brief-text></p></div>';
        const panel = content.querySelector('[role="tabpanel"]'), paragraph = content.querySelector('[data-ai-brief-text]');
        paragraph.textContent = validated.brief[lang];
        holder.querySelector('.ai-provenance').textContent = result.model + ' · ' + L(lang, 'Luotu', 'Skapad', 'Generated') + ' ' + new Date(result.generatedAt).toLocaleDateString(lang);
        if (result.briefBasis === 'document-excerpt' && result.evidence?.length) {
          holder.querySelector('[data-ai-scope]').textContent = L(lang,'Perustuu alkuperäisasiakirjan otteisiin. Ehdotuksen kuvaus ei yksin selitä kaikkia äänestysvaihtoehtoja.','Bygger på utdrag ur originaldokumentet. Beskrivningen av förslaget förklarar inte ensam alla omröstningsalternativ.','Based on original-document excerpts. The proposal description does not by itself explain every voting alternative.');
          const evidence = holder.querySelector('[data-ai-evidence]');
          for (const passage of result.evidence) {
            if (!safeURL(passage.url) || typeof passage.quote !== 'string') continue;
            const block = document.createElement('blockquote'), link = document.createElement('a');
            block.textContent = passage.quote; link.href = safeURL(passage.url); link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = passage.document || L(lang,'Asiakirja','Dokument','Document');
            evidence.append(link,block);
          }
        }
        const buttons = [...content.querySelectorAll('[role="tab"]')];
        const select = button => {
          buttons.forEach(tab => { tab.setAttribute('aria-selected', String(tab === button)); tab.tabIndex = tab === button ? 0 : -1; });
          panel.lang = button.dataset.aiLanguage;
          panel.setAttribute('aria-labelledby', button.id);
          paragraph.textContent = validated.brief[button.dataset.aiLanguage];
        };
        buttons.forEach((button, i) => {
          button.onclick = () => select(button);
          button.onkeydown = event => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : event.key === 'ArrowRight' ? (i + 1) % 3 : event.key === 'ArrowLeft' ? (i + 2) % 3 : null;
            if (next === null) return;
            event.preventDefault(); select(buttons[next]); buttons[next].focus();
          };
        });
      } catch {
        if (!holder.isConnected) return;
        content.innerHTML = '<p>' + L(lang, 'Lyhennelmää ei voitu ladata.', 'Sammanfattningen kunde inte laddas.', 'The brief could not be loaded.') + '</p><button type="button" data-ai-retry>' + L(lang, 'Yritä uudelleen', 'Försök igen', 'Try again') + '</button>';
        content.querySelector('button').onclick = load;
      }
    };
    await load();
  });
}
export function decorateAI(root, { route, data, lang, rerender }) {
  const page = root.querySelector('.page,.easy-page');
  if (!page) return;
  if (['votes','legislation'].includes(route.page)) {
    const kind = route.page;
    if (route.id) {
      const item = data[kind]?.find(item => item.id === route.id);
      if (item) {
        const holder = document.createElement('section');
        holder.className = 'ai-insights';
        const anchor = kind === 'votes' ? page.querySelector('.result-block,.easy-vote-context + .easy-section') : page.querySelector('.matter-summary,.easy-callout,.legislation-process');
        if (anchor) anchor.after(holder); else page.append(holder);
        mountBrief(holder, kind, item, lang);
        const tags = document.createElement('div'); tags.innerHTML = aiTagBadges(kind, item, lang);
        holder.prepend(tags);
      }
    } else {
      const section = document.createElement('details'); section.className = 'ai-monitor';
      const tags = insightTags(index), selected = selectedAITag(), followed = followedTags();
      section.innerHTML = '<summary>' + L(lang, 'Seuraa ohjelmateemoja', 'Följ programteman', 'Follow programme themes') + ' · <span data-ai-follow-count>' + followed.length + '</span></summary><div class="ai-monitor-body"><p>' + notice(lang) +
        '</p><p>' + L(lang, 'Seuratut teemat tallennetaan tähän selaimeen. Tarkastele päivityksiä valitsemalla seuratut teemat. Mukana ovat vain AI:n jo analysoimat tietueet.',
          'Följda teman sparas i denna webbläsare. Se uppdateringar genom att välja följda teman. Endast poster som AI redan analyserat ingår.',
          'Followed themes are saved in this browser. Select followed themes to review updates. Only records already analysed by AI are included.') +
        '</p><label>' + L(lang, 'Ohjelmateema', 'Programtema', 'Programme theme') + '<select data-ai-tag-filter>' +
        [['all', L(lang, 'Kaikki tietueet', 'Alla poster', 'All records')], ['followed', L(lang, 'Seuratut teemat', 'Följda teman', 'Followed themes')], ...tags.map(tag => [tag.id, text(tag.label, lang)])].map(([id, label]) => '<option value="' + e(id) + '" ' + (selected === id ? 'selected' : '') + '>' + e(label) + '</option>').join('') +
        '</select></label><p>' + (loadFailed ? L(lang, 'AI-tietoja ei voitu ladata.', 'AI-data kunde inte laddas.', 'AI data could not be loaded.') :
          Object.keys(index.records[kind]).length + ' ' + L(lang, 'analysoitua tietuetta', 'analyserade poster', 'analysed records')) +
        (loadFailed ? ' <button type="button" data-ai-index-retry>' + L(lang, 'Yritä uudelleen', 'Försök igen', 'Try again') + '</button>' : '') + '</p>' +
        (!tags.length ? '<p>' + L(lang, 'Ohjelmateemat tulevat näkyviin, kun AI-analyysi on valmis.', 'Programteman visas när AI-analysen är klar.', 'Programme themes will appear as AI analysis becomes available.') + '</p>' : '') +
        '<div class="ai-theme-list">' + tags.map(tag => '<details><summary>' + e(text(tag.label, lang)) + '</summary>' + followButton(tag.id, lang) +
          tag.references.map(ref => '<p><a href="' + e(safeURL(ref.url)) + '" target="_blank" rel="noreferrer">' + e(ref.party.toUpperCase() + ' · ' + ref.title + ' · ' + ref.year) +
            ' ↗</a> · ' + L(lang, ref.promise ? 'Lupaus' : 'Teema', ref.promise ? 'Löfte' : 'Tema', ref.promise ? 'Promise' : 'Theme') + '</p><blockquote>' + e(ref.quote) + '</blockquote>').join('') + '</details>').join('') + '</div><p data-ai-storage-status role="status"></p></div>';
      if (selected !== 'all') section.open = true;
      const anchor = page.querySelector('.page-head,.easy-hero');
      if (anchor) anchor.after(section); else page.prepend(section);
      section.querySelector('select').onchange = event => {
        const params = new URLSearchParams(location.hash.split('?')[1] || '');
        if (event.target.value === 'all') params.delete('tag'); else params.set('tag', event.target.value);
        location.hash = '#/' + kind + (params.size ? '?' + params : '');
      };
      section.querySelector('[data-ai-index-retry]')?.addEventListener('click', async () => { await loadAIInsights(); rerender(); });
    }
  }
  root.querySelectorAll('[data-ai-follow]').forEach(button => {
    button.onclick = () => {
      const set = new Set(followedTags()), id = button.dataset.aiFollow;
      if (set.has(id)) set.delete(id); else set.add(id);
      try { localStorage.setItem('vahtikissa-ai-tags', JSON.stringify([...set])); }
      catch {
        const message = L(lang, 'Seurantaa ei voitu tallentaa: selaimen tallennustila ei ole käytettävissä.', 'Följningen kunde inte sparas: webbläsarlagring är inte tillgänglig.', 'Following could not be saved: browser storage is unavailable.');
        const status = root.querySelector('[data-ai-storage-status]');
        if (status) status.textContent = message; else button.insertAdjacentText('afterend', message);
        return;
      }
      root.querySelectorAll('[data-ai-follow]').forEach(control => {
        const pressed = set.has(control.dataset.aiFollow); control.setAttribute('aria-pressed', String(pressed));
        control.textContent = L(lang, pressed ? 'Seurataan' : 'Seuraa teemaa', pressed ? 'Följer' : 'Följ temat', pressed ? 'Following' : 'Follow theme');
      });
      root.querySelectorAll('[data-ai-follow-count]').forEach(count => { count.textContent = String(set.size); });
      if (selectedAITag() === 'followed') rerender();
    };
  });
}
