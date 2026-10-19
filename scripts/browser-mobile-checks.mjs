import assert from 'node:assert/strict';

/** Check content geometry as well as page overflow on the affected mobile views. */
export async function checkMobileLayouts(page, navigate) {
  const searchLabels={fi:'Haku, rajaukset ja järjestys',sv:'Sök, avgränsa och sortera',en:'Search, filter and sort'};
  for(const language of ['fi','sv','en']) {
    await page.locator('.language-select').selectOption(language);
    for(const width of [320,390,600]) {
      await page.setViewportSize({width,height:844});
      const label=language+' / '+width+'px';
      await navigate('legislation');
      const cell=page.locator('[data-legislation-list] tbody tr').first().locator('td').first();
      const [field,title,document]=await Promise.all([
        cell.boundingBox(),cell.locator('.sub').boundingBox(),cell.locator('.matter-labels').boundingBox()
      ]);
      assert.ok(title.width>=field.width*.95,label+': matter titles use the full card width');
      assert.ok(Math.abs(title.x-field.x)<=1,label+': matter titles align with the card content');
      assert.ok(title.y>=document.y+document.height-1,label+': matter titles follow the document identifier');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+': legislation overflow');

      await navigate('parties');
      const cards=await page.locator('.cards .card').evaluateAll(elements=>elements.map(card=>{
        const name=card.querySelector('h2').getBoundingClientRect(),score=card.querySelector('.big').getBoundingClientRect();
        return {nameRight:name.right,scoreLeft:score.left};
      }));
      assert.ok(cards.length>0);
      assert.ok(cards.every(card=>card.scoreLeft>=card.nameRight-1),label+': party participation sits beside the name');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+': parties overflow');

      await navigate('speeches');
      const search=page.locator('[data-filter-panel]').filter({has:page.locator('[data-filter]')});
      assert.equal(await search.count(),1,label+': one speech search panel');
      assert.equal(await page.locator('main .filter-panel > summary').getByText(searchLabels[language],{exact:true}).count(),1,label+': one search heading');
      for(const selector of ['[data-speech-topic]','[data-speech-party]','[data-speech-member]','[data-speech-match]','[data-speech-scope]','[data-speech-exclude]']) {
        assert.equal(await search.locator(selector).count(),1,label+': '+selector+' shares the search panel');
      }
      const summary=search.locator(':scope > summary');
      await summary.click();
      assert.equal(await search.locator('[data-filter]').isVisible(),false);
      assert.equal(await search.locator('[data-speech-match]').isVisible(),false);
      await summary.focus();await summary.press('Enter');
      assert.equal(await search.locator('[data-filter]').isVisible(),true);
      assert.equal(await search.locator('[data-speech-match]').isVisible(),true);
      await search.locator('[data-speech-match]').selectOption('word');
      assert.match(await search.locator('[data-panel-count]').innerText(),/^1 /,label+': research choices update the shared active-filter count');
      assert.equal(await search.evaluate(element=>element.open),true);
      await search.locator('[data-speech-match]').selectOption('contains');
      assert.equal(await search.locator('[data-panel-count]').innerText(),'');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+': speech filters overflow');
      console.log('Mobile content and grouped speech filters passed: '+label);
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.language-select').selectOption('fi');
  await navigate('legislation');
  assert.equal(await page.locator('[data-legislation-list] td').first().evaluate(element=>getComputedStyle(element).display),'table-cell');
}
