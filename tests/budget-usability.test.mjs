import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetClosestPath, budgetShare, budgetChange, budgetTreemap, budgetEntries, searchBudgetEntries } from '../budget-utils.js';

test('switching budget years retains the deepest available parent classification', () => {
  const year={expense:[{code:'33',children:[{code:'3310',children:[{code:'331057'}]}]}],income:[{code:'11'}]};
  assert.deepEqual(budgetClosestPath(year,'expense',['33','3310','331057']),['33','3310','331057']);
  assert.deepEqual(budgetClosestPath(year,'expense',['33','3310','331058']),['33','3310']);
  assert.deepEqual(budgetClosestPath(year,'expense',['33','missing','331057']),['33']);
  assert.deepEqual(budgetClosestPath(year,'income',['33']),[]);
  assert.deepEqual(budgetClosestPath(undefined,'expense',['33']),[]);
});

test('budget shares distinguish a zero total from a zero or negative item', () => {
  assert.equal(budgetShare(0,100),0);
  assert.equal(budgetShare(-10,100),-10);
  assert.ok(Math.abs(budgetShare(110,100)-110)<1e-9);
  assert.equal(budgetShare(0,0),null);
  assert.equal(budgetShare(100,0),null);
  assert.equal(budgetShare(Infinity,100),null);
  assert.equal(budgetShare(100,NaN),null);
  assert.equal(budgetChange(NaN,100),null);
});

test('treemap safely omits non-positive and non-finite areas while keeping valid ratios', () => {
  const items=[{budget:0},{budget:-10},{budget:Infinity},{budget:NaN},{budget:30},{budget:70}];
  const rectangles=budgetTreemap(items);
  assert.equal(rectangles.length,2);
  for(const rectangle of rectangles)assert.ok(Math.abs(rectangle.width*rectangle.height/6500-rectangle.value/100)<1e-9);
  assert.deepEqual(budgetTreemap(items,undefined,0,65),[]);
  assert.deepEqual(budgetTreemap(items,undefined,100,Infinity),[]);
});

test('budget search accepts English source labels when available without losing Finnish fallback', () => {
  const entries=budgetEntries({expense:[{code:'33',name:{fi:'Sosiaaliturva',en:'Social security'},children:[{code:'3310',name:{fi:'Asumistuki',en:'Housing benefit'}}]}]},'expense');
  assert.equal(searchBudgetEntries(entries,'housing')[0].code,'3310');
  assert.equal(searchBudgetEntries(entries,'asumistuki')[0].code,'3310');
  assert.equal(searchBudgetEntries(entries,'33.10')[0].code,'3310');
});
