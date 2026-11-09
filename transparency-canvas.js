import cytoscape from './assets/vendor/cytoscape.esm.min.mjs';
import { escapeHTML as e } from './app-utils.js';
import { viewPositions } from './transparency-model.js';

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = list => { const result = []; for (const point of list) { while (result.length >= 2 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop(); result.push(point); } return result; };
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)];
}
export function createTransparencyCanvas(container, { onInspect, onExpand, lang = 'fi' }) {
  const tr = (fi, sv, en) => lang === 'sv' ? sv : lang === 'en' ? en : fi;
  const controls = document.createElement('div');
  controls.className = 'sna-gesture-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', tr('Kartan ohjaimet', 'Kartkontroller', 'Map controls'));
  controls.innerHTML = `<button type="button" data-sna-gestures aria-pressed="false">${tr('Siirrä karttaa', 'Flytta kartan', 'Pan map')}</button>
    <button type="button" data-sna-zoom="out" aria-label="${tr('Loitonna', 'Zooma ut', 'Zoom out')}">−</button>
    <button type="button" data-sna-zoom="in" aria-label="${tr('Lähennä', 'Zooma in', 'Zoom in')}">+</button>`;
  container.before(controls);
  const gestureButton = controls.querySelector('[data-sna-gestures]');
  const stage = container.closest('[data-sna-stage]');
  const host = document.createElement('div'); host.className = 'sna-cytoscape'; container.append(host);
  const overlay = document.createElement('canvas'); overlay.className = 'sna-overlay'; overlay.setAttribute('aria-hidden', 'true'); container.append(overlay);
  const tip = document.createElement('div'); tip.className = 'sna-tooltip'; tip.hidden = true; container.append(tip);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = { nodes: [], edges: [] }, metric = 'degree', mode = 'force', selected = null, hull = 'none', hovered = null, frame = 0, destroyed = false;
  let preferredLabels = [];
  const chrome = [...container.parentElement.querySelectorAll('.sna-map-kicker, .sna-map-footer'), controls, tip];
  const readTheme = () => {
    const css = getComputedStyle(container), value = key => css.getPropertyValue(key).trim();
    return { background: value('--sna-canvas'), ink: value('--ink'), muted: value('--muted'), mp: value('--sna-mp'), org: value('--sna-org'), bill: value('--sna-bill'), interest: value('--sna-interest'), lobby: value('--sna-lobby'), gift: value('--sna-gift'), path: value('--sna-path') };
  };
  let colors = readTheme();
  const cy = cytoscape({ container: host, elements: [], layout: { name: 'preset' }, minZoom: 0.04, maxZoom: 4, pixelRatio: Math.min(devicePixelRatio, 2), selectionType: 'single', boxSelectionEnabled: false, userPanningEnabled: false, userZoomingEnabled: false, autoungrabify: true });
  const setGestures = enabled => {
    gestureButton.setAttribute('aria-pressed', String(enabled));
    host.classList.toggle('sna-gestures-active', enabled);
    cy.userPanningEnabled(enabled);
    cy.userZoomingEnabled(enabled);
    cy.autoungrabify(!enabled);
  };
  gestureButton.onclick = () => setGestures(gestureButton.getAttribute('aria-pressed') === 'false');
  // Cytoscape can cancel a swipe starting on a node even with panning disabled.
  // Leave touch gestures to the browser in scroll mode. A tap still produces a click.
  host.addEventListener('touchstart', event => {
    if (!cy.userPanningEnabled()) event.stopImmediatePropagation();
  }, { capture: true, passive: true });
  const zoom = (factor, renderedPosition = { x: container.clientWidth / 2, y: container.clientHeight / 2 }) => cy.zoom({
    level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)),
    renderedPosition
  });
  const wheel = event => {
    // Use the same zoom controls for wheel input without Cytoscape's page-scroll cooldown.
    event.stopPropagation();
    if (!cy.userZoomingEnabled() || event.ctrlKey || event.metaKey || event.altKey) return;
    const { deltaMode, deltaY } = event;
    if (!deltaY) return;
    event.preventDefault();
    const unit = deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : deltaMode === WheelEvent.DOM_DELTA_PAGE ? container.clientHeight : 1;
    const pixels = Math.max(-200, Math.min(200, deltaY * unit));
    const box = container.getBoundingClientRect();
    zoom(Math.exp(-pixels * 0.002), { x: event.clientX - box.left, y: event.clientY - box.top });
  };
  container.addEventListener('wheel', wheel, { capture: true, passive: false });
  controls.querySelector('[data-sna-zoom="out"]').onclick = () => zoom(0.8);
  controls.querySelector('[data-sna-zoom="in"]').onclick = () => zoom(1.25);
  const fit = () => { cy.resize(); cy.fit(undefined, 55); scheduleDraw(); };
  const fullscreenChanged = () => {
    if (document.fullscreenElement !== stage) setGestures(false);
    fit();
  };
  stage?.addEventListener('fullscreenchange', fullscreenChanged);
  function style() {
    const maximum = Math.max(1e-12, ...current.nodes.map(node => node[metric] || 0));
    preferredLabels = [...current.nodes].sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).map(node => node.id);
    cy.style([
      { selector: 'node', style: { width: node => 15 + 30 * Math.sqrt((node.data(metric) || 0) / maximum), height: node => 15 + 30 * Math.sqrt((node.data(metric) || 0) / maximum), 'background-color': colors.mp, 'border-width': 2, 'border-color': colors.mp, 'overlay-opacity': 0 } },
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
      { selector: '.dim, .hover-dim', style: { opacity: 0.15 } },
      { selector: 'edge.path', style: { 'line-color': colors.path, 'target-arrow-color': colors.path, width: 4, opacity: 1 } },
      { selector: 'node.path', style: { 'border-color': colors.path, 'border-width': 4, opacity: 1 } },
      { selector: 'node:selected', style: { 'border-width': 5, 'border-color': colors.path } },
      { selector: 'edge:selected', style: { 'line-color': colors.path, width: 5, opacity: 1 } }
    ]).update();
    scheduleDraw();
  }
  function mapHulls() {
    if (hull === 'none') return [];
    const groups = new Map();
    for (const node of current.nodes.filter(node => node.type === 'mp')) for (const group of hull === 'party' ? [node.party] : node.committees || []) {
      if (!group) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(cy.getElementById(node.id).renderedPosition());
    }
    return [...groups].filter(([, points]) => points.length >= 3)
      .map(([group, points]) => ({ text: group.toUpperCase(), polygon: convexHull(points) }))
      .filter(group => group.polygon.length >= 3);
  }
  function mapLabels(ctx, width, height, groups) {
    if (!current.nodes.length) return [];
    const origin = container.getBoundingClientRect();
    const occupied = chrome.filter(element => !element.hidden).map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - origin.left, right: rect.right - origin.left, top: rect.top - origin.top, bottom: rect.bottom - origin.top };
    });
    const bodies = new Map();
    cy.nodes().forEach(node => {
      const { x, y } = node.renderedPosition(), rx = node.renderedOuterWidth() / 2, ry = node.renderedOuterHeight() / 2;
      const bounds = { left: x - rx, right: x + rx, top: y - ry, bottom: y + ry };
      if (bounds.right < 0 || bounds.bottom < 0 || bounds.left > width || bounds.top > height) return;
      bodies.set(node.id(), { x, y, ...bounds });
      occupied.push(bounds);
    });
    const labels = [], size = Math.min(16, Math.max(11, Math.round(13 * cy.zoom())));
    ctx.font = `600 ${size}px sans-serif`;
    function place(text, anchor) {
      const halfWidth = ctx.measureText(text).width / 2 + 3, halfHeight = size / 2 + 3;
      const gap = 2;
      const positions = [
        [anchor.x, anchor.bottom + halfHeight + gap], [anchor.x, anchor.top - halfHeight - gap],
        [anchor.right + halfWidth + gap, anchor.y], [anchor.left - halfWidth - gap, anchor.y]
      ];
      for (const [x, y] of positions) {
        const box = { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
        if (box.left < 4 || box.top < 4 || box.right > width - 4 || box.bottom > height - 4 || occupied.some(other => overlaps(box, other))) continue;
        occupied.push(box);
        labels.push({ text, x, y, size });
        return true;
      }
      return false;
    }
    // Screen-space placement keeps labels apart at every zoom and width.
    const maxLabels = width < 480 ? 9 : 24;
    const pathLabels = cy.nodes('.path').map(node => node.id());
    for (const id of new Set([selected, ...pathLabels, ...preferredLabels])) {
      if (labels.length >= maxLabels) break;
      const body = bodies.get(id);
      if (!body || id === hovered) continue;
      const node = cy.getElementById(id);
      if (id !== selected && !node.hasClass('path') && (node.hasClass('dim') || node.hasClass('hover-dim'))) continue;
      const text = node.data('fullLabel');
      if (!place(text, body) && text.length > 16) place(text.slice(0, 14).trimEnd() + '…', body);
    }
    for (const { text, polygon: [{ x, y }] } of groups) {
      place(text, { x, y, left: x, right: x, top: y, bottom: y });
    }
    return labels;
  }
  function scheduleDraw() {
    if (!frame && !destroyed) frame = requestAnimationFrame(draw);
  }
  function draw(time) {
    frame = 0;
    const ctx = overlay.getContext('2d'), ratio = Math.min(devicePixelRatio, 2), width = container.clientWidth, height = container.clientHeight;
    if (overlay.width !== Math.round(width * ratio) || overlay.height !== Math.round(height * ratio)) { overlay.width = Math.round(width * ratio); overlay.height = Math.round(height * ratio); }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    const groups = mapHulls();
    for (const { polygon } of groups) {
      ctx.beginPath(); polygon.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
      ctx.fillStyle = colors.mp; ctx.globalAlpha = 0.07; ctx.fill(); ctx.globalAlpha = 0.4; ctx.strokeStyle = colors.mp; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    ctx.fillStyle = colors.ink; ctx.strokeStyle = colors.background;
    for (const { text, x, y } of mapLabels(ctx, width, height, groups)) {
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }
    if (hovered && !reduced.matches) {
      for (const edge of cy.getElementById(hovered).connectedEdges().filter(edge => edge.data('layers')?.includes('lobbaus'))) {
        const a = edge.source().renderedPosition(), b = edge.target().renderedPosition(), t = (time % 1600) / 1600;
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2.5, 0, 2 * Math.PI); ctx.fillStyle = colors.lobby; ctx.fill();
      }
      scheduleDraw();
    }
  }
  function spotlight(node) {
    cy.elements().removeClass('hover-dim'); hovered = node?.id() || null;
    if (node) cy.elements().difference(node.closedNeighborhood()).addClass('hover-dim');
    scheduleDraw();
  }
  cy.on('mouseover', 'node', event => {
    spotlight(event.target); const position = event.target.renderedPosition();
    tip.textContent = event.target.data('name'); tip.hidden = false;
    tip.style.left = `${Math.max(8, Math.min(container.clientWidth - tip.offsetWidth - 8, position.x + 14))}px`;
    tip.style.top = `${Math.max(8, Math.min(container.clientHeight - tip.offsetHeight - 8, position.y - 32))}px`;
  });
  cy.on('mouseout', 'node', () => { tip.hidden = true; spotlight(null); });
  cy.on('tap', 'node, edge', event => { selected = event.target.id(); onInspect(event.target.isNode() ? 'node' : 'edge', selected); });
  cy.on('dbltap', 'node', event => onExpand(event.target.id()));
  cy.on('pan zoom position render', scheduleDraw);
  const resize = new ResizeObserver(() => { cy.resize(); scheduleDraw(); }); resize.observe(container);
  const theme = new MutationObserver(() => { colors = readTheme(); style(); }); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  reduced.addEventListener('change', scheduleDraw);
  const keyboard = event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'f', 'F'].includes(event.key)) return;
    event.preventDefault();
    const delta = { ArrowLeft: { x: 45, y: 0 }, ArrowRight: { x: -45, y: 0 }, ArrowUp: { x: 0, y: 45 }, ArrowDown: { x: 0, y: -45 } }[event.key];
    if (delta) cy.panBy(delta);
    else if (event.key.toLowerCase() === 'f') fit();
    else zoom(event.key === '-' ? 0.8 : 1.25);
  };
  const releaseGestures = event => {
    if (event.key === 'Escape' && gestureButton.getAttribute('aria-pressed') === 'true') {
      setGestures(false);
      if (!document.fullscreenElement) gestureButton.focus({ preventScroll: true });
    }
  };
  container.addEventListener('keydown', keyboard);
  container.addEventListener('keydown', releaseGestures);
  controls.addEventListener('keydown', releaseGestures);
  function layout(animate = true) {
    const positions = viewPositions(current.nodes, mode, selected, metric, current.focus);
    // New bill nodes have no offline force coordinate: place them beside the MP layer.
    current.nodes.filter(node => node.type === 'bill').forEach((node, i) => { if (mode === 'force' && !Number.isFinite(node.initialX)) positions.set(node.id, { x: 600, y: i * 80 - 300 }); });
    cy.layout({ name: 'preset', positions: node => positions.get(node.id()), fit: true, padding: 55, animate: animate && !reduced.matches, animationDuration: 450 }).run();
  }
  return {
    setView(value, options = {}) {
      controls.hidden = !value.edges.length;
      if (controls.hidden) setGestures(false);
      cy.elements().removeClass('path dim'); tip.hidden = true; spotlight(null); current = value; metric = options.metric || metric; mode = options.layout || mode;
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
    setHull(value) { hull = value; scheduleDraw(); },
    select(id) { selected = id; cy.elements().unselect(); cy.getElementById(id).select(); },
    highlightPath(path) { cy.elements().removeClass('path dim'); if (path) { cy.elements().addClass('dim'); [...path.nodes, ...path.edges].forEach(id => cy.getElementById(id).removeClass('dim').addClass('path')); } },
    fit,
    positions() { return Object.fromEntries(cy.nodes().map(node => [node.id(), { ...node.position(), rendered: node.renderedPosition() }])); },
    viewport() { return { zoom: cy.zoom(), pan: { ...cy.pan() } }; },
    async png() {
      cancelAnimationFrame(frame);
      draw(performance.now());
      const blob = await cy.png({ output: 'blob-promise', full: false, scale: 2, bg: colors.background });
      const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height); bitmap.close();
      return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    },
    svg(metadata = {}) {
      const width = container.clientWidth, height = container.clientHeight;
      const groups = mapHulls();
      const hullSVG = groups.map(({ polygon }) => `<polygon points="${polygon.map(point => `${point.x},${point.y}`).join(' ')}" fill="${e(colors.mp)}" fill-opacity="0.07" stroke="${e(colors.mp)}" stroke-opacity="0.4" stroke-dasharray="5 5"/>`).join('');
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
        return `<g opacity="${node.style('opacity')}">${shape} fill="${fill}" stroke="${border}" stroke-width="${node.renderedStyle('border-width')}"/></g>`;
      }).join('');
      const labels = mapLabels(overlay.getContext('2d'), width, height, groups).map(({ text, x, y, size }) =>
        `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${size}">${e(text)}</text>`
      ).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${lang === 'fi' ? 'Vahtikissan verkostokartta' : 'Vahtikissa network map'}</title><metadata>${e(JSON.stringify(metadata))}</metadata><rect width="100%" height="100%" fill="${e(colors.background)}"/>${hullSVG}${edgeSVG}${nodeSVG}<g fill="${e(colors.ink)}" stroke="${e(colors.background)}" stroke-width="3" stroke-linejoin="round" paint-order="stroke" font-weight="600" font-family="sans-serif">${labels}</g></svg>`;
    },
    destroy() {
      destroyed = true; cancelAnimationFrame(frame); resize.disconnect(); theme.disconnect(); reduced.removeEventListener('change', scheduleDraw);
      container.removeEventListener('keydown', keyboard);
      container.removeEventListener('keydown', releaseGestures);
      container.removeEventListener('wheel', wheel, true);
      stage?.removeEventListener('fullscreenchange', fullscreenChanged);
      cy.destroy(); controls.remove(); overlay.remove(); tip.remove(); host.remove();
    }
  };
}
