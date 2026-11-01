import cytoscape from './assets/vendor/cytoscape.esm.min.mjs';
import { escapeHTML as e } from './app-utils.js';
import { viewPositions } from './transparency-model.js';

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = list => { const result = []; for (const point of list) { while (result.length >= 2 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop(); result.push(point); } return result; };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}
export function createTransparencyCanvas(container, { onInspect, onExpand, lang = 'fi' }) {
  const host = document.createElement('div'); host.className = 'sna-cytoscape'; container.append(host);
  const overlay = document.createElement('canvas'); overlay.className = 'sna-overlay'; overlay.setAttribute('aria-hidden', 'true'); container.append(overlay);
  const tip = document.createElement('div'); tip.className = 'sna-tooltip'; tip.hidden = true; container.append(tip);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = { nodes: [], edges: [] }, metric = 'degree', mode = 'force', selected = null, hull = 'none', hovered = null, frame = 0, destroyed = false;
  const readTheme = () => {
    const css = getComputedStyle(container), value = key => css.getPropertyValue(key).trim();
    return { background: value('--sna-canvas'), ink: value('--ink'), muted: value('--muted'), mp: value('--sna-mp'), org: value('--sna-org'), bill: value('--sna-bill'), interest: value('--sna-interest'), lobby: value('--sna-lobby'), gift: value('--sna-gift'), path: value('--sna-path') };
  };
  let colors = readTheme();
  const cy = cytoscape({ container: host, elements: [], layout: { name: 'preset' }, minZoom: 0.04, maxZoom: 4, pixelRatio: Math.min(devicePixelRatio, 2), selectionType: 'single', boxSelectionEnabled: false });
  function style() {
    const maximum = Math.max(1e-12, ...current.nodes.map(node => node[metric] || 0));
    const labeled = new Set(['mp', 'org', 'bill', 'committee'].flatMap(type => current.nodes.filter(node => node.type === type).sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).slice(0, type === 'bill' || type === 'committee' || current.nodes.length <= 30 ? 100 : 12).map(node => node.id)));
    cy.nodes().forEach(node => node.data('label', labeled.has(node.id()) ? node.data('fullLabel') : ''));
    cy.style([
      { selector: 'node', style: { label: 'data(label)', 'font-family': 'DM Sans, sans-serif', 'font-size': 13, 'min-zoomed-font-size': 6, color: colors.ink, 'text-outline-color': colors.background, 'text-outline-width': 2, 'text-valign': 'bottom', 'text-margin-y': 7, width: node => 15 + 30 * Math.sqrt((node.data(metric) || 0) / maximum), height: node => 15 + 30 * Math.sqrt((node.data(metric) || 0) / maximum), 'background-color': colors.mp, 'border-width': 2, 'border-color': colors.mp, 'overlay-opacity': 0 } },
      { selector: 'node[type="org"]', style: { shape: 'roundrectangle', 'background-color': colors.org, 'border-color': colors.org } },
      { selector: 'node[type="bill"]', style: { shape: 'diamond', 'background-color': colors.bill, 'border-color': colors.bill, width: 24, height: 24 } },
      { selector: 'node[type="committee"]', style: { shape: 'hexagon', 'background-color': colors.bill, 'border-color': colors.bill, width: 28, height: 28 } },
      { selector: 'edge', style: { width: edge => Math.min(5, 0.8 + Math.log1p(edge.data('weight')) * 0.55), 'line-color': colors.interest, 'curve-style': 'straight', opacity: 0.8, 'overlay-opacity': 0 } },
      { selector: 'edge[styleLayer="lobbaus"]', style: { 'line-style': 'dashed', 'line-color': colors.lobby, 'target-arrow-color': colors.lobby, 'target-arrow-shape': 'triangle', 'arrow-scale': 0.65 } },
      { selector: 'edge[styleLayer="lahja"]', style: { 'line-style': 'dotted', 'line-color': colors.gift } },
      { selector: 'edge[styleLayer="multiplex"]', style: { width: 3.5, 'line-color': colors.interest } },
      { selector: 'edge[styleLayer="bill"]', style: { 'line-style': 'dashed', 'line-color': colors.bill } },
      { selector: 'edge[styleLayer="membership"]', style: { 'line-style': 'dotted', 'line-color': colors.bill } },
      { selector: 'edge[?inferredOnly]', style: { 'line-style': 'dotted', opacity: 0.8 } },
      { selector: '.dim', style: { opacity: 0.15 } },
      { selector: '.spotlight', style: { opacity: 1, label: 'data(fullLabel)' } },
      { selector: 'edge.path', style: { 'line-color': colors.path, 'target-arrow-color': colors.path, width: 4, opacity: 1 } },
      { selector: 'node.path', style: { 'border-color': colors.path, 'border-width': 4, opacity: 1 } },
      { selector: 'node:selected', style: { 'border-width': 5, 'border-color': colors.path, label: 'data(fullLabel)' } },
      { selector: 'edge:selected', style: { 'line-color': colors.path, width: 5, opacity: 1 } }
    ]).update();
    draw();
  }
  function draw(time = 0) {
    if (destroyed) return;
    const ctx = overlay.getContext('2d'), ratio = Math.min(devicePixelRatio, 2), width = container.clientWidth, height = container.clientHeight;
    if (overlay.width !== Math.round(width * ratio) || overlay.height !== Math.round(height * ratio)) { overlay.width = Math.round(width * ratio); overlay.height = Math.round(height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    if (hull !== 'none') {
      const groups = new Map();
      for (const node of current.nodes.filter(node => node.type === 'mp')) for (const group of hull === 'party' ? [node.party] : node.committees || []) {
        const point = cy.getElementById(node.id).renderedPosition();
        if (!point) continue;
        if (!groups.has(group)) groups.set(group, []); groups.get(group).push(point);
      }
      for (const [group, points] of groups) if (points.length >= 3) {
        const polygon = convexHull(points); if (!polygon.length) continue;
        ctx.beginPath(); polygon.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
        ctx.fillStyle = colors.mp; ctx.globalAlpha = 0.07; ctx.fill(); ctx.globalAlpha = 0.4; ctx.strokeStyle = colors.mp; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.fillStyle = colors.ink; ctx.font = '11px sans-serif'; ctx.fillText(group.toUpperCase(), polygon[0].x, polygon[0].y - 10);
      }
    }
    if (hovered && !reduced.matches) {
      for (const edge of cy.getElementById(hovered).connectedEdges().filter(edge => edge.data('layers')?.includes('lobbaus'))) {
        const a = edge.source().renderedPosition(), b = edge.target().renderedPosition(), t = (time % 1600) / 1600;
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2.5, 0, 2 * Math.PI); ctx.fillStyle = colors.lobby; ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    }
  }
  function spotlight(node) {
    cy.elements().removeClass('dim spotlight'); hovered = node?.id() || null;
    if (node) { cy.elements().addClass('dim'); node.closedNeighborhood().removeClass('dim').addClass('spotlight'); }
    cancelAnimationFrame(frame); draw();
  }
  cy.on('mouseover', 'node', event => {
    spotlight(event.target); const position = event.target.renderedPosition();
    tip.textContent = event.target.data('name'); tip.style.left = `${Math.max(8, Math.min(container.clientWidth - 200, position.x + 14))}px`; tip.style.top = `${Math.max(8, position.y - 32)}px`; tip.hidden = false;
  });
  cy.on('mouseout', 'node', () => { tip.hidden = true; spotlight(null); });
  cy.on('tap', 'node, edge', event => { selected = event.target.id(); onInspect(event.target.isNode() ? 'node' : 'edge', selected); });
  cy.on('dbltap', 'node', event => onExpand(event.target.id()));
  cy.on('pan zoom position render', () => { if (!hovered || reduced.matches) draw(); });
  const resize = new ResizeObserver(() => { cy.resize(); draw(); }); resize.observe(container);
  const theme = new MutationObserver(() => { colors = readTheme(); style(); }); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const motion = () => { cancelAnimationFrame(frame); draw(); }; reduced.addEventListener('change', motion);
  const keyboard = event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'f', 'F'].includes(event.key)) return;
    event.preventDefault();
    const delta = { ArrowLeft: { x: 45, y: 0 }, ArrowRight: { x: -45, y: 0 }, ArrowUp: { x: 0, y: 45 }, ArrowDown: { x: 0, y: -45 } }[event.key];
    if (delta) cy.panBy(delta);
    else if (event.key.toLowerCase() === 'f') cy.fit(undefined, 55);
    else cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * (event.key === '-' ? 0.8 : 1.25))), renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 } });
  };
  container.addEventListener('keydown', keyboard);
  function layout(animate = true) {
    const positions = viewPositions(current.nodes, mode, selected, metric);
    // New bill nodes have no offline force coordinate: place them beside the MP layer.
    current.nodes.filter(node => node.type === 'bill').forEach((node, i) => { if (mode === 'force') positions.set(node.id, { x: 600, y: i * 80 - 300 }); });
    cy.layout({ name: 'preset', positions: node => positions.get(node.id()), fit: true, padding: 55, animate: animate && !reduced.matches, animationDuration: 450 }).run();
  }
  return {
    setView(value, options = {}) {
      spotlight(null); current = value; metric = options.metric || metric; mode = options.layout || mode;
      cy.batch(() => {
        const wanted = new Set([...value.nodes, ...value.edges].map(element => element.id));
        cy.elements().filter(element => !wanted.has(element.id())).remove();
        for (const node of value.nodes) {
          const data = { ...node, fullLabel: `${node.name.length > 33 ? node.name.slice(0, 30) + '…' : node.name}${node.type === 'mp' ? ` · ${node.party.toUpperCase()}` : ''}` }, prior = cy.getElementById(node.id);
          if (prior.length) prior.data(data); else cy.add({ group: 'nodes', data, position: { x: node.initialX || 0, y: node.initialY || 0 } });
        }
        for (const edge of value.edges) {
          const data = { ...edge, styleLayer: edge.layers.includes('bill') ? 'bill' : edge.isMultiplex ? 'multiplex' : edge.layers[0], inferredOnly: !!(edge.details?.length && edge.details.every(d => d.inferred)) }, prior = cy.getElementById(edge.id);
          if (prior.length) prior.data(data); else cy.add({ group: 'edges', data });
        }
      }); style(); layout(!!options.animate);
    },
    setLayout(value) { mode = value; layout(); },
    setMetric(value) { metric = value; style(); if (mode === 'rings') layout(); },
    setHull(value) { hull = value; draw(); },
    select(id) { selected = id; cy.elements().unselect(); cy.getElementById(id).select(); },
    highlightPath(path) { cy.elements().removeClass('path dim'); if (path) { cy.elements().addClass('dim'); [...path.nodes, ...path.edges].forEach(id => cy.getElementById(id).removeClass('dim').addClass('path')); } },
    fit() { cy.resize(); cy.fit(undefined, 55); draw(); },
    positions() { return Object.fromEntries(cy.nodes().map(node => [node.id(), { ...node.position(), rendered: node.renderedPosition() }])); },
    viewport() { return { zoom: cy.zoom(), pan: { ...cy.pan() } }; },
    async png() {
      const blob = await cy.png({ output: 'blob-promise', full: false, scale: 2, bg: colors.background });
      const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height); bitmap.close();
      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    },
    svg(metadata = {}) {
      const width = container.clientWidth, height = container.clientHeight;
      let hullSVG = '';
      if (hull !== 'none') {
        const groups = new Map();
        for (const node of current.nodes.filter(node => node.type === 'mp')) for (const group of hull === 'party' ? [node.party] : node.committees || []) {
          if (!groups.has(group)) groups.set(group, []); groups.get(group).push(cy.getElementById(node.id).renderedPosition());
        }
        for (const [group, points] of groups) if (points.length >= 3) {
          const polygon = convexHull(points);
          if (polygon.length) hullSVG += `<polygon points="${polygon.map(point => `${point.x},${point.y}`).join(' ')}" fill="${e(colors.mp)}" fill-opacity="0.07" stroke="${e(colors.mp)}" stroke-opacity="0.4" stroke-dasharray="5 5"/><text x="${polygon[0].x}" y="${polygon[0].y - 10}" fill="${e(colors.ink)}" font-size="11" font-family="sans-serif">${e(group.toUpperCase())}</text>`;
        }
      }
      const edgeSVG = cy.edges().map(edge => {
        const a = edge.source().renderedPosition(), b = edge.target().renderedPosition(), color = edge.style('line-color'), dash = edge.style('line-style') === 'dotted' ? '2 5' : edge.style('line-style') === 'dashed' ? '8 5' : '';
        let arrow = '';
        if (edge.style('target-arrow-shape') === 'triangle') {
          const length = Math.hypot(b.x - a.x, b.y - a.y) || 1, dx = (b.x - a.x) / length, dy = (b.y - a.y) / length, radius = edge.target().renderedOuterWidth() / 2;
          const x = b.x - dx * radius, y = b.y - dy * radius, size = 6 * Math.min(1, cy.zoom());
          arrow = `<polygon points="${x},${y} ${x - dx * size - dy * size / 2},${y - dy * size + dx * size / 2} ${x - dx * size + dy * size / 2},${y - dy * size - dx * size / 2}" fill="${e(edge.style('target-arrow-color'))}"/>`;
        }
        return `<g opacity="${edge.style('opacity')}"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${e(color)}" stroke-width="${edge.renderedStyle('width')}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>${arrow}</g>`;
      }).join('');
      const nodeSVG = cy.nodes().map(node => {
        const p = node.renderedPosition(), w = node.renderedOuterWidth(), h = node.renderedOuterHeight(), type = node.data('type'), fill = e(node.style('background-color')), border = e(node.style('border-color'));
        const shape = type === 'org' ? `<rect x="${p.x - w / 2}" y="${p.y - h / 2}" width="${w}" height="${h}" rx="4"` : type === 'bill' ? `<polygon points="${p.x},${p.y - h / 2} ${p.x + w / 2},${p.y} ${p.x},${p.y + h / 2} ${p.x - w / 2},${p.y}"` : type === 'committee' ? `<polygon points="${p.x - w / 4},${p.y - h / 2} ${p.x + w / 4},${p.y - h / 2} ${p.x + w / 2},${p.y} ${p.x + w / 4},${p.y + h / 2} ${p.x - w / 4},${p.y + h / 2} ${p.x - w / 2},${p.y}"` : `<ellipse cx="${p.x}" cy="${p.y}" rx="${w / 2}" ry="${h / 2}"`;
        const font = parseFloat(node.renderedStyle('font-size')), margin = parseFloat(node.renderedStyle('text-margin-y'));
        return `<g opacity="${node.style('opacity')}">${shape} fill="${fill}" stroke="${border}" stroke-width="${node.renderedStyle('border-width')}"/><text x="${p.x}" y="${p.y + h / 2 + margin + font * 0.85}" text-anchor="middle" fill="${e(colors.ink)}" font-size="${font}" font-family="sans-serif" paint-order="stroke" stroke="${e(colors.background)}" stroke-width="${2 * cy.zoom()}">${e(node.style('label'))}</text></g>`;
      }).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${lang === 'fi' ? 'Vahtikissan verkostokartta' : 'Vahtikissa network map'}</title><metadata>${e(JSON.stringify(metadata))}</metadata><rect width="100%" height="100%" fill="${e(colors.background)}"/>${hullSVG}${edgeSVG}${nodeSVG}</svg>`;
    },
    destroy() { destroyed = true; cancelAnimationFrame(frame); resize.disconnect(); theme.disconnect(); reduced.removeEventListener('change', motion); container.removeEventListener('keydown', keyboard); cy.destroy(); overlay.remove(); tip.remove(); host.remove(); }
  };
}
