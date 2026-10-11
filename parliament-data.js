import { fetchJSONWithTimeout, hydrateBallots } from './app-utils.js';

export function createParliamentLoader(fetchJSON = fetchJSONWithTimeout) {
  const cache = new Map();
  const pending = new Map();
  let generation = 0;
  function load(name) {
    if (cache.has(name)) return Promise.resolve(cache.get(name));
    if (!pending.has(name)) {
      const version = cache.get('core.json')?.metadata.generatedAt;
      const started = generation;
      const url = `./data/parliament/${name}${version ? `?v=${encodeURIComponent(version)}` : ''}`;
      const request = Promise.resolve().then(() => fetchJSON(url, { cache: name === 'core.json' ? 'no-cache' : 'default' })).then(value => {
        if (started !== generation) throw new Error('This Parliament request was superseded by a retry.');
        if (version && value.snapshot !== version) throw new Error('Parliament data was updated. Please retry to load the current snapshot.');
        if (name === 'core.json') for (const vote of value.votes) vote.committees = value.voteCommittees?.[vote.document] || [];
        if (value.ballots) value.ballots = hydrateBallots(value.ballots, cache.get('core.json').members);
        cache.set(name, value);
        return value;
      }).finally(() => { if (pending.get(name) === request) pending.delete(name); });
      pending.set(name, request);
    }
    return pending.get(name);
  }
  function resources(route, view) {
    const core = cache.get('core.json');
    if (!core) return ['core.json'];
    if (route.page === 'votes' && route.id) {
      const index = core.votes.findIndex(vote => vote.id === route.id);
      return index < 0 ? [] : [`vote-${index}.json`];
    }
    if (route.page === 'members' && route.id) {
      const index = core.members.findIndex(member => String(member.id) === String(route.id));
      return index < 0 ? [] : [`member-${index}.json`];
    }
    if (route.page === 'speeches') return ['speeches.json'];
    if (route.page === 'legislation') return ['legislation.json'];
    if (route.page === 'votes' && view === 'simple') return ['party-votes.json'];
    return [];
  }
  return {
    loadCore: () => load('core.json'),
    loadSpeeches: async () => { await load('core.json'); return (await load('speeches.json')).speeches; },
    routeReady: (route, view) => cache.has('core.json') && resources(route, view).every(name => cache.has(name)),
    async loadRoute(route, view) {
      const core = await load('core.json');
      const chunks = await Promise.all(resources(route, view).map(load));
      // Each route gets its own collections: a member's votes must not leak into another page.
      return Object.assign({ ballots: [], speeches: [], legislation: [] }, core, ...chunks);
    },
    clear() { generation++; cache.clear(); pending.clear(); }
  };
}
