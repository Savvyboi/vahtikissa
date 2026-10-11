/** Open search/sort disclosures through visible controls, retaining the test reader's place. */
export async function openFilterPanels(page) {
  const position=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  const active=await page.evaluateHandle(()=>document.activeElement);
  for (const panel of await page.locator('[data-filter-panel]').all()) {
    const summary=panel.locator(':scope > summary');
    if (await summary.isVisible() && !await panel.evaluate(element=>element.open)) await summary.click();
  }
  await active?.evaluate(element=>{if(element.isConnected)element.focus({preventScroll:true});});
  await active?.dispose();
  await page.evaluate(position=>window.scrollTo(position.x,position.y),position);
}
