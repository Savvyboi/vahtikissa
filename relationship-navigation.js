const labels = {
  fi: ['Verkostonäkymät', 'Verkostokartta', 'Äänestykset & puheet'],
  sv: ['Nätverksvyer', 'Nätverkskarta', 'Omröstningar & anföranden'],
  en: ['Network views', 'Network map', 'Voting & speeches']
};

// Both views are destinations in the same app, so keep the return path visible.
export function relationshipNavigation(lang = 'fi', active = 'map') {
  const [label, map, analysis] = labels[lang] || labels.fi;
  return `<nav class="relationship-subnav" aria-label="${label}"><a href="#/relationships"${active === 'map' ? ' aria-current="page"' : ''}>${map}</a><a href="#/relationships?feature=vote-neighbours"${active === 'analysis' ? ' aria-current="page"' : ''}>${analysis}</a></nav>`;
}
