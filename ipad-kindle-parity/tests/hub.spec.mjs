import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('**/api/queue',async route=>{
  if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({requests:[]})});
  return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Private session required'})});
 });
 await page.route('**/api/subscription-status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({billingEnabled:false})}));
});
test('catalogue appears without private authentication and tools stay in Hub',async({page})=>{
 await page.goto('/');
 const modules=page.locator('#modules [data-catalogue-tool]');
 await expect(modules).toHaveCount(3);
 await expect(page.locator('#hubEmpty')).toBeHidden();
 await modules.filter({hasText:'Chorus 6'}).click();
 await expect(page.locator('body')).toHaveClass(/playing/);
 const iframe=page.frameLocator('#instrument');
 await expect(iframe.getByRole('heading',{name:/Chorus 6/})).toBeVisible();
 await expect(page.locator('#instrument')).toHaveAttribute('src','/tools/chorus-6/v1.0.0/index.html');
 await page.locator('#back').click();
 await expect(page.locator('body')).not.toHaveClass(/playing/);
 await expect(modules).toHaveCount(3);
});
test('composer accepts text, but does not claim success when private API rejects it',async({page})=>{
 await page.goto('/');
 const editor=page.locator('#deployBrief');
 await editor.fill('Create a frequency alignment calculator with millisecond output');
 await expect(page.locator('#deploySend')).toBeEnabled();
 await page.locator('#deploySend').click();
 await expect(page.locator('#deployStatus')).toContainText(/Not submitted|Unlock/i);
 await expect(editor).toHaveValue(/frequency alignment calculator/);
});
test('mobile layout avoids horizontal document overflow and controls remain tappable',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#deployBrief')).toBeVisible();
 const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+2);
 const editor=page.locator('#deployBrief');
 await editor.scrollIntoViewIfNeeded();
 await editor.fill('A new stereo audio spectrum analyser with history graph');
 await expect(page.locator('#deploySend')).toBeEnabled();
});
test('synth has actual playable Web Audio graph in browser',async({page})=>{
 await page.goto('/');
 await page.locator('[data-catalogue-tool="chorus-6"]').click();
 const iframe=page.frameLocator('#instrument');
 await iframe.locator('#power').click();
 await expect(iframe.locator('#status')).toContainText(/AUDIO READY|Audio error/);
 const status=await iframe.locator('#status').innerText();
 expect(status).toContain('AUDIO READY');
 const key=iframe.locator('.white[data-m="60"]');
 await key.dispatchEvent('pointerdown',{pointerId:5,pointerType:'touch',button:0});
 await expect(iframe.locator('#status')).toContainText(/1 notes/);
 await key.dispatchEvent('pointerup',{pointerId:5,pointerType:'touch',button:0});
 await iframe.locator('#panic').click();
 await expect(iframe.locator('#status')).toContainText('ALL NOTES OFF');
});
test('offline catalogue and tools are available after service-worker precache',async({page,context,browserName})=>{
 test.skip(browserName!=='chromium','Offline smoke is Chromium-only');
 await page.goto('/');
 await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;await reg.update();});
 await expect.poll(()=>page.evaluate(async()=>{
  const keys=await caches.keys();const all=await Promise.all(keys.map(k=>caches.open(k).then(c=>c.keys())));
  const urls=all.flat().map(x=>new URL(x.url).pathname);
  return ['/index.html','/tools/catalogue.json','/tools/chorus-6/v1.0.0/index.html'].every(p=>urls.includes(p));
 }),{timeout:25000}).toBe(true);
 await context.setOffline(true);
 await page.reload();
 await expect(page.locator('[data-catalogue-tool="chorus-6"]')).toBeVisible();
 await page.locator('[data-catalogue-tool="chorus-6"]').click();
 await expect(page.frameLocator('#instrument').getByRole('heading',{name:/Chorus 6/})).toBeVisible();
 await context.setOffline(false);
});
