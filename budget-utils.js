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
// Keep the deepest available context when classifications change between years.
export function budgetClosestPath(year, type, codes = []) {
  const result = [];
  let items = year?.[type] || [];
  for (const code of codes) {
    const item = items.find(item => item.code === code);
    if (!item) break;
    result.push(code);
    items = item.children || [];
  }
  return result;
}
export function budgetShare(value, total) {
  return Number.isFinite(value) && Number.isFinite(total) && total !== 0 ? value / total * 100 : null;
}
export function budgetChange(value, previous) {
  if (!Number.isFinite(value) || !Number.isFinite(previous) || previous === 0) return null;
  return (value - previous) / Math.abs(previous) * 100;
}
export function budgetTotals(year, metric = 'budget') {
  const sum = items => (items || []).reduce((total, item) => total + (Number(item[metric]) || 0), 0);
  const income = sum(year?.income), expense = sum(year?.expense);
  const find = (items, code) => {
    for (const item of items || []) {
      if (item.code === code) return item;
      const nested = find(item.children, code);
      if (nested) return nested;
    }
    return null;
  };
  // Class 15 also contains repayments of loans owed to the state.
  const borrowing = Number(find(year?.income, '150301')?.[metric]) || 0;
  return { income, expense, borrowing, revenue: income - borrowing, balance: income - borrowing - expense };
}
// A balanced binary treemap preserves positive area ratios without chart dependencies.
export function budgetTreemap(items, value = item => item.budget, width = 100, height = 65) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  const entries = items.map(item => ({ item, value: Number(value(item)) })).filter(item => Number.isFinite(item.value) && item.value > 0).sort((a,b) => b.value - a.value);
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

// Flatten paths so search can reach moments without knowing their ministry first.
export function budgetEntries(year, type) {
  const result=[];
  function visit(items, codes=[], ancestors=[]) {
    for (const item of items || []) {
      const path=[...codes,item.code];
      result.push({...item,path,ancestors});
      visit(item.children,path,[...ancestors,item]);
    }
  }
  visit(year?.[type]);
  return result;
}
export function searchBudgetEntries(entries, query) {
  const words=String(query||'').normalize('NFC').toLocaleLowerCase('fi').trim().split(/\s+/u).filter(Boolean);
  return entries.filter(item=>{
    const names=[item,...(item.ancestors||[])].flatMap(node=>[node.name?.fi,node.name?.sv,node.name?.en]).filter(Boolean).join(' ').toLocaleLowerCase('fi');
    return words.every(word=>names.includes(word)||item.code.includes(word.replace(/\./g,'')));
  });
}
