import test from 'node:test';
import assert from 'node:assert/strict';
import { currentScrollPosition, savedScrollPosition, pushRoute, preservePageScroll } from '../navigation.js';

function browserFixture() {
  const root={contentHeight:2200,style:{minHeight:''},getBoundingClientRect:()=>({top:70-window.scrollY})};
  Object.defineProperty(root,'offsetHeight',{get:()=>Math.max(root.contentHeight,parseFloat(root.style.minHeight)||0)});
  const entries=[{hash:'#/votes',state:{existing:'kept'}}];
  globalThis.location={hash:'#/votes',href:'https://example.test/?view=full#/votes'};
  globalThis.history={
    state:entries[0].state,
    replaceState(state){this.state=state;entries.at(-1).state=state},
    pushState(state,unused,hash){this.state=state;location.hash=hash;entries.push({hash,state})}
  };
  globalThis.window={
    innerHeight:800,scrollX:0,scrollY:800,
    scrollTo({left,top}){this.scrollX=left;this.scrollY=Math.max(0,Math.min(top,root.offsetHeight+70-this.innerHeight))}
  };
  return {root,entries};
}

function deferred() {
  let resolve;
  const promise=new Promise(done=>{resolve=done});
  return {promise,resolve};
}

test('route history stores each outgoing position and avoids duplicate current entries', () => {
  const {entries}=browserFixture();
  assert.equal(pushRoute('#/members'),true);
  assert.deepEqual(entries[0].state,{existing:'kept',vahtikissaScroll:{x:0,y:800}});
  assert.deepEqual(savedScrollPosition(),{x:0,y:800});
  window.scrollY=1100;
  assert.equal(pushRoute('#/members'),false);
  assert.equal(entries.length,2);
  assert.equal(pushRoute('#/votes'),true);
  assert.deepEqual(entries[1].state.vahtikissaScroll,{x:0,y:1100});
  history.state=entries[0].state;
  assert.deepEqual(savedScrollPosition(),{x:0,y:800});
});

test('invalid history coordinates do not override the current reading position', () => {
  browserFixture();
  for(const position of [null,{x:0,y:NaN},{x:0,y:'800'},{x:Infinity,y:4}]) {
    history.state={vahtikissaScroll:position};
    assert.equal(savedScrollPosition(),undefined);
    const {root}=browserFixture();
    preservePageScroll(root,()=>{},savedScrollPosition());
    assert.deepEqual(currentScrollPosition(),{x:0,y:800});
  }
});

test('async loading retains document height and honors reading movement before completion', async () => {
  const {root}=browserFixture(),loaded=deferred();
  const render=preservePageScroll(root,()=>{root.contentHeight=200;return loaded.promise});
  assert.equal(root.offsetHeight,2200);
  assert.equal(window.scrollY,800);
  window.scrollTo({left:0,top:950});
  root.contentHeight=1800;loaded.resolve();await render;
  assert.equal(root.style.minHeight,'');
  assert.equal(window.scrollY,950);
});

test('new navigation wins over a stale async render and releases the original height', async () => {
  const {root}=browserFixture(),old=deferred();
  root.style.minHeight='100px';
  const pending=preservePageScroll(root,()=>{root.contentHeight=200;return old.promise});
  preservePageScroll(root,()=>{root.contentHeight=3000},{x:0,y:1200});
  assert.equal(root.style.minHeight,'100px');
  assert.equal(window.scrollY,1200);
  old.resolve();await pending;
  assert.equal(root.style.minHeight,'100px');
  assert.equal(window.scrollY,1200);
});

test('short destinations clamp to their available height and failed renders release placeholders', () => {
  const {root}=browserFixture();
  preservePageScroll(root,()=>{root.contentHeight=1000});
  assert.equal(window.scrollY,270);
  assert.throws(()=>preservePageScroll(root,()=>{throw new Error('render failed')}),/render failed/);
  assert.equal(root.style.minHeight,'');
});
