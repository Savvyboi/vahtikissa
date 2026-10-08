import assert from 'node:assert/strict';

export async function checkUI(page, navigate, data) {
  let fields = 0, links = 0;
  const valid = {
    votes:new Set(data.votes.map(item=>item.id)), members:new Set(data.members.map(item=>item.id)),
    parties:new Set(data.parties.map(item=>item.code)), sessions:new Set(data.sessions.map(item=>item.id)),
    legislation:new Set(data.legislation.map(item=>item.id))
  };
  const routes = ['overview','votes','members','parties','programmes','sessions','speeches','legislation','budget','elections','influence','about',
    `members/${data.members[0].id}`,`votes/${encodeURIComponent(data.votes[0].id)}`,`parties/${data.parties[0].code}`,`sessions/${data.sessions[0].id}`,`legislation/${encodeURIComponent(data.legislation.find(item=>item.voteIds.length).id)}`];
  async function inspectFields() {
    // Open each filter panel so the fields are exercised through visible controls.
    for (const summary of await page.locator('main details > summary').all()) {
      if (await summary.isVisible() && !await summary.evaluate(e=>e.parentElement.open)) await summary.click();
    }
    const controls = await page.locator('main input:not([type="checkbox"]), main select').evaluateAll(elements=>elements.map(element=>{
      const collection=element.closest('[data-collection]');
      const facet=element.closest('[data-facet]');
      const attrs=[...element.attributes].filter(a=>a.name.startsWith('data-')).map(a=>`[${a.name}="${CSS.escape(a.value)}"]`).join('');
      const selector=`${collection?`[data-collection="${collection.dataset.collection}"] `:''}${facet?`[data-facet="${facet.dataset.facet}"] `:''}${element.tagName.toLowerCase()}${attrs}`;
      return {selector,type:element.type,value:element.value,options:element.tagName==='SELECT'?[...element.options].filter(o=>!o.disabled).map(o=>o.value):null};
    }));
    for(const control of controls) {
      const input=page.locator(control.selector).first();
      if(!await input.count()||!await input.isVisible())continue;
      if(control.options) {
        // All sorting choices; a representative choice for long data-driven lists.
        const options=control.options.length<=15?control.options:control.options.slice(0,2);
        for(const value of options){await input.selectOption(value);assert.equal(await input.inputValue(),value);fields++;}
        if(await input.count())await input.selectOption(control.value);
      } else {
        const value=control.type==='date'?'2024-01-01':control.type==='number'?'0':'zzzz-no-matching-record';
        await input.fill(value); if(['date','number'].includes(control.type))await input.press('Tab');
        assert.equal(await input.inputValue(),value); fields++;
        await input.fill(control.value); if(['date','number'].includes(control.type))await input.press('Tab');
      }
    }
    for(const facet of await page.locator('main [data-facet]').all()) {
      const include=facet.locator('[data-selection="include"]').first(),exclude=facet.locator('[data-selection="exclude"]').first();
      if(!await include.count()||!await include.isVisible())continue;
      await include.check();assert.equal(await include.isChecked(),true);
      await exclude.check();assert.equal(await include.isChecked(),false);assert.equal(await exclude.isChecked(),true);
      await exclude.uncheck();fields+=2;
    }
    for(const clear of await page.locator('main [data-tool-clear]').all())await clear.click();
    const hrefs=await page.locator('a[href]').evaluateAll(elements=>elements.map(e=>e.getAttribute('href')));
    for(const link of hrefs){
      assert.ok(link && !/^javascript:/i.test(link));links++;
      if(!link.startsWith('#/'))continue;
      const [route,...parts]=link.slice(2).split('/');
      assert.ok([...routes.map(item=>item.split('/')[0]),'speeches'].includes(route),`Unknown route ${link}`);
      if(parts.length&&valid[route])assert.ok(valid[route].has(decodeURIComponent(parts.join('/'))),`Missing route target ${link}`);
    }
  }
  for(const route of routes){await navigate(route);await inspectFields();console.log(`Fields and route targets passed: ${route}`);}
  for(const tab of ['parties','candidates']){await navigate('elections');await page.locator(`[data-election-tab="${tab}"]`).click();await inspectFields();}
  for(const tab of ['gifts','interests','lobbying']){await navigate('influence');await page.locator(`[data-influence-tab="${tab}"]`).click();await inspectFields();}

  // Every member image must decode, including lazy images below the viewport.
  await navigate('members');await page.locator('[data-member-query]').fill('');
  if(!await page.locator('[data-member-party]').isVisible())await page.locator('[data-member-party]').evaluate(e=>e.closest('details').open=true);
  await page.locator('[data-member-party]').selectOption('all');
  assert.equal(await page.locator('.member-portrait').count(),data.members.length);
  const broken=await page.locator('.member-portrait').evaluateAll(async elements=>{
    return (await Promise.all(elements.map(async img=>{img.loading='eager';try{await img.decode();return img.naturalWidth?null:img.src}catch{return img.src}}))).filter(Boolean);
  });
  assert.deepEqual(broken,[]);

  // Follow each primary menu link at phone, tablet and landscape sizes in both languages.
  for(const language of ['fi','sv']) {
    if(await page.locator('html').getAttribute('lang')!==language)await page.locator('.language-button').click();
    for(const viewport of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:844,height:390},{width:1180,height:820}]) {
      await page.setViewportSize(viewport);
      await page.locator('.menu-button').click();
      const boxes=await page.locator('.nav a').evaluateAll(elements=>elements.map(e=>{
        const b=e.getBoundingClientRect();return {text:e.textContent,left:b.left,right:b.right,top:b.top,bottom:b.bottom};
      }));
      assert.equal(boxes.length,11);
      for(const box of boxes)assert.ok(box.left>=0&&box.right<=viewport.width+1&&box.top>=0&&box.bottom<=viewport.height,`Menu item outside ${viewport.width}×${viewport.height}: ${box.text}`);
      await page.keyboard.press('Escape');assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'false');
      for(const route of routes.slice(0,11)) {
        await page.locator('.menu-button').click();await page.locator(`.nav [data-page="${route}"]`).click();
        assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'false');
        assert.equal(await page.locator('main').getAttribute('data-route'),`#/${route}`);
      }
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.keyboard.press('Control+k');
  await page.locator('#global-search').fill(data.members[0].lastName);
  await page.locator('.search-results a').first().waitFor();
  await page.locator('.search-results a').first().click();
  assert.equal(await page.locator('.search-panel').isVisible(),false);
  for(const theme of ['light','dark','contrast']){
    await page.locator('.theme-select').selectOption(theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    assert.ok((await page.locator('.theme-control').boundingBox()).width<=40);
  }
  await page.reload();await page.locator('main[aria-busy="false"] h1').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'contrast');
  assert.equal(await page.locator('html').getAttribute('lang'),'sv');
  await page.locator('.theme-select').selectOption('light');await page.locator('.language-button').click();
  console.log(`${fields} filter interactions; ${links} rendered links; ${data.members.length} decoded portraits; all 11 menu links at 5 mobile/tablet sizes in Finnish and Swedish passed.`);
}
