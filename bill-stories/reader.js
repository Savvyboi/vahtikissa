import { escapeHTML as e } from '../app-utils.js';
import { stories, structure } from './structure.js';

const content = {
  fi: () => import('./content-fi.js'),
  sv: () => import('./content-sv.js'),
  en: () => import('./content-en.js')
};

const chrome = {
  fi: {
    title: 'Lait lyhyesti', choose: 'Valitse juttu', chapters: 'Jutun osat',
    stage: 'Jutun sisältö', back: 'Takaisin', next: 'Seuraava', nextBill: 'Seuraava juttu',
    more: 'Lue lisää', less: 'Näytä vähemmän', sources: 'Lähteet', terms: 'Sanasto ja lyhenteet',
    docket: 'Avaa lakiasian tiedot', frame: 'Osa',
    help: 'Siirry osasta toiseen nuolinäppäimillä tai pyyhkäisemällä sivulle.',
    news: 'Uutisjutut'
  },
  sv: {
    title: 'Lagar i korthet', choose: 'Välj ett lagärende', chapters: 'Avsnitt',
    stage: 'Berättelsens innehåll', back: 'Tillbaka', next: 'Nästa', nextBill: 'Nästa lag',
    more: 'Läs mer', less: 'Visa mindre', sources: 'Källor', terms: 'Ordlista och förkortningar',
    docket: 'Öppna lagärendet', frame: 'Avsnitt',
    help: 'Bläddra mellan avsnitten med piltangenterna eller genom att svepa i sidled.',
    news: 'Nyhetsartiklar'
  },
  en: {
    title: 'Bills in brief', choose: 'Choose a bill', chapters: 'Story frames',
    stage: 'Story content', back: 'Back', next: 'Next', nextBill: 'Next bill',
    more: 'Read more', less: 'Read less', sources: 'Sources', terms: 'Terms and abbreviations',
    docket: 'Open the bill record', frame: 'Frame',
    help: 'Use the arrow keys or swipe sideways to change frames.',
    news: 'News coverage'
  }
};

const storyPath = (story, frame = story.frames[0]) => `#/stories/${story.id}/${frame}`;
const proposalLabel = (story, lang) => lang === 'sv' ? story.proposal.replace('HE ', 'RP ').replace(' vp', ' rd') : story.proposal;

function icon(name) {
  if (name === 'waves' || name === 'border') return `<span class="icon topic-mark ${name}-mark" aria-hidden="true"></span>`;
  return name === 'lottery'
    ? '<span class="icon lottery-mark" aria-hidden="true"></span>'
    : `<svg class="icon" aria-hidden="true"><use href="./bill-stories/icons.svg#icon-${e(name)}"></use></svg>`;
}

const caption = value => value ? `<figcaption class="chart-label">${e(value)}</figcaption>` : '';
const time = (date, label) => `<time datetime="${e(date)}">${e(label)}</time>`;

function diagram({ type, icons, dates, accent, reason }, chart) {
  const rows = chart.rows || [];
  switch (type) {
    case 'options':
      return `<figure>${caption(chart.caption)}<div class="options">${rows.map(([label, outcome], i) => `
        <div class="option${i === accent ? ' accent' : ''}">${icon(icons[i])}
          <span class="option-label">${e(label)}</span><strong>${e(outcome)}</strong>
        </div>`).join('')}</div></figure>`;
    case 'notice':
      return `<figure class="notice">${caption(chart.caption)}${rows.map(([label, ...parties], i) => `
        <div class="notice-row${i ? ' accent' : ''}"><span class="chart-label">${e(label)}</span>
          <div class="notice-parties">${parties.map((party, j) => `<strong class="party${j ? ' added' : ''}">${j ? '+ ' : ''}${e(party)}</strong>`).join('')}</div>
        </div>`).join('')}</figure>`;
    case 'bars':
      return `<figure class="bars">${caption(chart.caption)}${rows.map(([label, value], i) => `
        <div class="bar-row"><span>${e(label)}</span><strong>${e(value)}</strong>
          <div class="bar-track${i ? ' short' : ''}" aria-hidden="true">${'<b></b>'.repeat(5)}</div>
        </div>`).join('')}
        <div class="bar-axis" aria-hidden="true">${chart.axis.map(label => `<span>${e(label)}</span>`).join('')}</div>
      </figure>`;
    case 'findings':
      return `<dl class="findings">${rows.map(([label, detail], i) => `<div class="finding${reason ? ' finding--reason' : ''}">
        <dt>${icon(icons[i])}${e(label)}</dt><dd>${e(detail)}</dd></div>`).join('')}</dl>`;
    case 'calendar':
      return `<figure>${caption(chart.caption)}<div class="calendar-range">${rows.map(([label, detail], i) => `
        <div class="date-point${i ? '' : ' accent'}">${time(dates[i], label)}<span>${e(detail)}</span></div>`).join('')}
      </div></figure>`;
    case 'period':
      return `<figure class="period"><figcaption class="period-heading">${icon('register')}
        <span><span class="chart-label">${e(chart.caption)}</span><strong>${e(chart.period)}</strong></span>
      </figcaption><ol class="months" role="list">${chart.months.map((month, i) => `<li>${time(dates[i], month)}</li>`).join('')}</ol></figure>`;
    case 'ticket':
    case 'timeline': {
      const timeline = `<ol class="timeline" role="list">${rows.map(([dateLabel, label, detail], i) => `
        <li${i === accent ? ' class="accent"' : ''}>${time(dates[i], dateLabel)}
          <div><span class="chart-label">${e(label)}</span><strong>${e(detail)}</strong></div>
        </li>`).join('')}</ol>`;
      if (type === 'timeline') return timeline;
      return `<figure><figcaption class="ticket"><span class="chart-label">${e(chart.ticket[0])}</span>
        <strong class="ticket-value">${e(chart.ticket[1])}</strong></figcaption>${timeline}</figure>`;
    }
  }
}

function extraLabel(ui) {
  return `<span class="read-more-label">${e(ui.more)}</span><span class="read-less-label">${e(ui.less)}</span>`;
}

function disclosures(id, copy, meta, ui, news, language, date) {
  return `
    <details class="frame-more" id="${id}-more">
      <summary>${extraLabel(ui)}</summary>
      <div class="more-copy">${copy.more.map((p, i) => `<p${i ? '' : ' tabindex="-1"'}>${e(p)}</p>`).join('')}</div>
    </details>
    <div class="frame-references">
      <details class="frame-sources" id="${id}-sources">
        <summary>${e(ui.sources)}</summary>
        <ul role="list">${meta.urls.map((url, i) => `<li><a href="${e(copy.sourceURLs?.[i] || url)}" target="_blank" rel="noopener noreferrer">${e(copy.sources[i])} <span aria-hidden="true">↗</span></a></li>`).join('')}</ul>
      </details>
      ${news?.length ? `<details class="frame-news">
        <summary>${e(ui.news)}</summary>
        <ul role="list">${news.map(([publisher, day, url, titles]) => `<li>
          <a href="${e(url)}" target="_blank" rel="noreferrer" hreflang="fi">
            <small>${e(publisher)} · ${time(day, date.format(new Date(day)))}</small>
            ${e(titles[language])} <span aria-hidden="true">↗</span>
          </a>
        </li>`).join('')}</ul>
      </details>` : ''}
      <details class="frame-terms" id="${id}-terms">
        <summary>${e(ui.terms)}</summary>
        <dl class="term-list">${copy.terms.map(([term, definition], i) => `
          <div><dt${i ? '' : ' tabindex="-1"'}>${e(term)}</dt><dd>${e(definition)}</dd></div>`).join('')}</dl>
      </details>
    </div>`;
}

export async function renderBillStories(root, { lang, route, current, navigate, focusFrame }) {
  const { frames } = await content[lang]();
  if (!current()) return;

  const [caseID, frameID] = (route.id || '').split('/');
  const story = stories.find(item => item.id === caseID) ?? stories[0];
  const index = Math.max(0, story.frames.indexOf(frameID));
  const id = story.id + '-' + story.frames[index];
  const copy = frames[id];
  const meta = structure[id];
  const ui = chrome[lang];
  const language = ['fi', 'sv', 'en'].indexOf(lang);
  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' });
  const otherStory = stories[(stories.indexOf(story) + 1) % stories.length];
  const atEnd = index === story.frames.length - 1;
  const docket = story.docket || '#/legislation/' + encodeURIComponent(story.proposal);
  const docketLink = className => `<a class="read-link ${className}" href="${e(docket)}"${story.docket ? ' target="_blank" rel="noreferrer"' : ''}>
    ${e(ui.docket)} <span aria-hidden="true">${story.docket ? '↗' : '→'}</span></a>`;
  root.innerHTML = `
    <section class="bill-stories" aria-labelledby="bill-stories-title">
      <div class="story-layout">
        <header class="story-picker">
          <h1 id="bill-stories-title">${e(ui.title)}</h1>
          <nav class="case-list" aria-label="${e(ui.choose)}">${stories.map(item => `
            <a class="story-choice" data-topic="${e(item.id)}" href="${storyPath(item)}"${item === story ? ' aria-current="location"' : ''}>
              <span class="story-ring" aria-hidden="true"><span class="story-cover">${icon(item.cover)}</span></span>
              <span class="story-name">${e(item.names[language])}</span>
            </a>`).join('')}</nav>
          ${docketLink('docket-desktop')}
        </header>
        <div class="reader is-interactive">
          <p class="visually-hidden" id="bill-stories-help">${e(ui.help)}</p>
          <div class="story-chrome">
            <nav class="segments" aria-label="${e(ui.chapters)}">${story.frames.map((slug, i) => `
              <a href="${storyPath(story, slug)}"${i < index ? ' class="is-past"' : ''}${i === index ? ' aria-current="step"' : ''}
                aria-label="${e(ui.frame + ' ' + (i + 1) + ' / ' + story.frames.length + ' · ' + frames[story.id + '-' + slug].step)}"></a>`).join('')}</nav>
            <p class="frame-meta"><span>${e(proposalLabel(story, lang))}</span><span>${index + 1} / ${story.frames.length}</span></p>
          </div>
          <div class="story-stage" role="region" aria-label="${e(ui.stage)}" aria-describedby="bill-stories-help" tabindex="0">
            <article class="story-frame" id="${id}">
              <header class="frame-heading">
                <p class="eyebrow">${e(copy.tag)}</p><h2 tabindex="-1" data-story-title>${e(copy.title)}</h2>
                <p class="context">${e(copy.lead)}</p>
              </header>
              <div class="frame-visual">${diagram(meta, copy.chart)}</div>
              ${copy.notes.map(note => `<p class="frame-note">${e(note)}</p>`).join('')}
              ${disclosures(id, copy, meta, ui, story.news, language, date)}
              ${docketLink('docket-mobile')}
            </article>
          </div>
          <div class="story-controls">
            <button class="back" type="button"${index === 0 ? ' disabled' : ''}><span aria-hidden="true">←</span><span class="control-label">${e(ui.back)}</span></button>
            <button class="next${atEnd ? ' next-story' : ''}" type="button"><span class="control-label">
              <span class="next-label">${e(atEnd ? ui.nextBill : ui.next)}</span>
            </span><span aria-hidden="true">→</span></button>
          </div>
        </div>
      </div>
    </section>`;

  const reader = root.querySelector('.bill-stories');
  const stage = reader.querySelector('.story-stage');
  const heading = stage.querySelector('[data-story-title]');
  const tray = reader.querySelector('.case-list');
  const selected = tray.querySelector('[aria-current]');
  tray.scrollLeft = selected.offsetLeft - (tray.clientWidth - selected.offsetWidth) / 2;
  if (focusFrame) heading.focus({ preventScroll: true });

  function move(direction) {
    const target = index + direction;
    if (target < 0) return;
    navigate(target === story.frames.length ? storyPath(otherStory) : storyPath(story, story.frames[target]));
  }
  reader.querySelector('.back').onclick = () => move(-1);
  reader.querySelector('.next').onclick = () => move(1);
  bindGestures(stage, move);
  reader.addEventListener('keydown', event => {
    const openDetails = event.target.closest('details[open]');
    if (event.key === 'Escape' && openDetails) {
      openDetails.open = false;
      openDetails.querySelector('summary').focus();
      return;
    }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('details, .case-list')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
}

function bindGestures(stage, move) {
  const interactive = target => target.closest('a, button, details');
  const tap = x => {
    const rect = stage.getBoundingClientRect();
    move(x < rect.left + rect.width * .28 ? -1 : 1);
  };
  let touch;
  let lastTouch = -Infinity;
  stage.addEventListener('click', event => {
    if (event.button !== 0 || interactive(event.target) || !window.getSelection()?.isCollapsed) return;
    if (event.pointerType && event.pointerType !== 'mouse' || performance.now() - lastTouch < 400) return;
    tap(event.clientX);
  });
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    touch = event.isPrimary && !interactive(event.target) ? {
      id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now()
    } : null;
  });
  stage.addEventListener('pointercancel', () => { touch = null; });
  stage.addEventListener('pointerup', event => {
    if (touch?.id !== event.pointerId) return;
    const { x, y, time } = touch;
    touch = null;
    if (interactive(event.target) || !window.getSelection()?.isCollapsed) return;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if (Math.abs(dx) >= 48 && Math.abs(dx) >= 1.5 * Math.abs(dy)) move(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && performance.now() - time < 450) tap(event.clientX);
    else return;
    lastTouch = performance.now();
  });
}
