import { escapeHTML as e } from './app-utils.js';
import { followingStore } from './following-store.js';
const L = (lang, fi, sv, en) => lang === 'sv' ? sv : lang === 'en' ? en : fi;
export const browserNote = lang => L(lang,
  'Valinnat tallentuvat vain tähän selaimeen. Ne eivät siirry automaattisesti laitteiden välillä ja katoavat, jos selaimen tallennustila tyhjennetään. Et tarvitse tiliä.',
  'Valen sparas bara i denna webbläsare. De synkroniseras inte automatiskt mellan enheter och försvinner om webbläsarlagringen rensas. Inget konto behövs.',
  'Selections are saved only in this browser. They do not sync automatically across devices and are lost if browser storage is cleared. No account is needed.');
export const storageFailure = lang => L(lang,
  'Tallennus ei onnistunut. Selaimen tallennustila voi olla estetty, täynnä tai vioittunut. Valintaa ei vahvistettu tallennetuksi.',
  'Det gick inte att spara. Webbläsarlagringen kan vara blockerad, full eller skadad. Valet har inte bekräftats som sparat.',
  'Saving failed. Browser storage may be blocked, full or corrupt. The selection has not been confirmed as saved.');
const memberButtonText = (lang, selected) => L(lang, selected ? 'Lopeta edustajan seuraaminen' : 'Seuraa edustajaa', selected ? 'Sluta följa ledamoten' : 'Följ ledamoten', selected ? 'Unfollow MP' : 'Follow MP');

// Shared decoration keeps the same control and browser state in both reading modes.
export function decorateMemberFollowing(root, { route, data, lang }) {
  if (route.page !== 'members' || !route.id) return;
  const member = data.members.find(item => String(item.id) === String(route.id));
  const page = root.querySelector('.page,.easy-page');
  if (!member || !page || page.querySelector('.member-following')) return;
  const section = document.createElement('section');
  section.className = 'member-following';
  const selected = followingStore.selections().members.includes(String(member.id));
  section.innerHTML = `<div class="following-actions"><button type="button" data-follow-member="${e(member.id)}" aria-pressed="${selected}">${memberButtonText(lang, selected)}</button><a href="#/following">${L(lang, 'Seuratut', 'Följer', 'Following')} →</a></div><p>${browserNote(lang)}</p><p data-follow-status role="status"></p>`;
  (page.querySelector('.page-head,.easy-hero') || page.firstElementChild)?.after(section);
  const button = section.querySelector('button'), status = section.querySelector('[data-follow-status]');
  if (followingStore.status().error) status.textContent = storageFailure(lang);
  button.onclick = () => {
    const result = followingStore.toggleMember(String(member.id));
    if (!result.ok) { status.textContent = storageFailure(lang); return; }
    const pressed = followingStore.selections().members.includes(String(member.id));
    button.setAttribute('aria-pressed', String(pressed)); button.textContent = memberButtonText(lang, pressed);
    status.textContent = L(lang, 'Valinta tallennettu tähän selaimeen.', 'Valet sparades i denna webbläsare.', 'Selection saved in this browser.');
  };
}
