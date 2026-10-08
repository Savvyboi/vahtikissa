// Shared calculations for the visual budget explorer.
export function budgetLevel(year, type, codes = []) {
  let items = year?.[type] || [], node = null;
  for (const code of codes) {
    node = items.find(item => item.code === code);
    if (!node) return { node: null, items: [], valid: false };
    items = node.children || [];
  }
  return { node, items, valid: true };
}
export function budgetChange(value, previous) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return (value - previous) / Math.abs(previous) * 100;
}
export function budgetTotals(year, metric = 'budget') {
  const sum = items => (items || []).reduce((total, item) => total + (Number(item[metric]) || 0), 0);
  const income = sum(year?.income), expense = sum(year?.expense);
  const borrowing = (year?.income || []).filter(item => item.code === '15').reduce((total, item) => total + (Number(item[metric]) || 0), 0);
  return { income, expense, borrowing, revenue: income - borrowing, balance: income - borrowing - expense };
}
// A balanced binary treemap preserves area ratios without chart dependencies.
export function budgetTreemap(items, value = item => item.budget, width = 100, height = 65) {
  const entries = items.map(item => ({ item, value: Math.max(0, Number(value(item)) || 0) })).filter(item => item.value > 0).sort((a,b) => b.value - a.value);
  const rectangles = [];
  function split(group, x, y, w, h) {
    if (!group.length) return;
    if (group.length === 1) { rectangles.push({ ...group[0], x, y, width: w, height: h }); return; }
    const total = group.reduce((sum, entry) => sum + entry.value, 0);
    let middle = 1, subtotal = group[0].value;
    while (middle < group.length - 1 && Math.abs(subtotal + group[middle].value - total / 2) < Math.abs(subtotal - total / 2)) subtotal += group[middle++].value;
    const fraction = subtotal / total;
    if (w >= h) { split(group.slice(0,middle),x,y,w*fraction,h); split(group.slice(middle),x+w*fraction,y,w*(1-fraction),h); }
    else { split(group.slice(0,middle),x,y,w,h*fraction); split(group.slice(middle),x,y+h*fraction,w,h*(1-fraction)); }
  }
  split(entries,0,0,width,height);
  return rectangles;
}
