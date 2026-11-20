import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler, entitled} from './members.mjs';

const origin = 'https://members.example';
const settings = {
  APP_ORIGIN:origin, PARASITE_BILLING_MODE:'test', STRIPE_SECRET_KEY:'sk_test_fixture', STRIPE_PRICE_ID:'price_member',
  SUPABASE_URL:'https://store.example', SUPABASE_ANON_KEY:'public', SUPABASE_SERVICE_ROLE_KEY:'server',
  PARASITE_PRIVATE_RELEASES:'[{"id":"first","title":"First member release","path":"first/module.apk"}]'
};
function request(action, {method = 'GET', authenticated = false, from = origin, body = {}} = {}) {
  const headers = {origin:from, ...(authenticated && {cookie:'__Host-parasite=session-token'})};
  return new Request(origin + '/api/member?action=' + action, {
    method, headers, ...(method === 'POST' && {body:JSON.stringify(body)})
  });
}
const sub = (status, id = 'price_member') => ({status, items:{data:[{price:{id}}]}});
function fixture({status, priceAmount = 499, existingCheckout = false} = {}) {
  const calls = [];
  const handler = createHandler(settings, async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({path, options});
    switch (path) {
      case '/auth/v1/user': return Response.json({id:'user-1',email_confirmed_at:'2026-11-20'});
      case '/rest/v1/parasite_customers': return Response.json([{stripe_customer_id:'cus_test'}]);
      case '/v1/subscriptions': return Response.json({data:status ? [sub(status)] : []});
      case '/storage/v1/object/sign/parasite-members/first/module.apk':
        return Response.json({signedURL:'/object/sign/parasite-members/first/module.apk?token=fixture'});
      case '/v1/prices/price_member':
        return Response.json({unit_amount:priceAmount,currency:'gbp',recurring:{interval:'month',interval_count:1},livemode:false,active:true});
      case '/v1/checkout/sessions': return Response.json(options.method === 'POST' ? {url:'https://checkout.example/subscribe'} :
        {data:existingCheckout ? [{status:'open',url:'https://checkout.example/reuse',metadata:{parasite_price:'price_member'}}] : []});
      case '/auth/v1/verify': return Response.json({access_token:'session-token', expires_in:3600});
      default: throw Error('Unexpected request ' + path);
    }
  });
  return {handler,calls};
}
test('preview works without touching external services and rejects checkout', async () => {
  const handler = createHandler({}, () => assert.fail('Provider request in preview'));
  assert.equal((await (await handler(request('status'))).json()).mode,'preview');
  assert.equal((await handler(request('checkout',{method:'POST'}))).status,503);
});
test('protected actions reject foreign origins and anonymous callers', async () => {
  const {handler,calls} = fixture();
  assert.equal((await handler(request('download',{method:'POST',from:'https://elsewhere.example'}))).status,403);
  assert.equal((await handler(request('download',{method:'POST'}))).status,401);
  assert.deepEqual(calls,[]);
});
test('status does not trust payment redirect or unrelated subscriptions', () => {
  assert.ok(entitled([sub('active')],'price_member'));
  assert.equal(entitled([sub('active','another_price'),sub('past_due'),sub('canceled')],'price_member'),false);
});
test('active members can request only configured assets and receive expiring URLs', async () => {
  const {handler,calls} = fixture({status:'active'});
  const response = await handler(request('status',{authenticated:true}));
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual((await response.json()).releases,[{id:'first',title:'First member release'}]);
  const query = {method:'POST',authenticated:true};
  assert.equal((await handler(request('download',{...query,body:{id:'other'}}))).status,404);
  const download = await handler(request('download',{...query,body:{id:'first'}}));
  assert.equal(download.status,200);
  assert.match((await download.json()).url,/^https:\/\/store.example\/storage\/v1\/object\/sign\//);
  assert.equal(JSON.parse(calls.at(-1).options.body).expiresIn,120);
});
test('past-due membership cannot download or start a second checkout', async () => {
  const {handler,calls} = fixture({status:'past_due'});
  const query = {method:'POST',authenticated:true};
  assert.equal((await handler(request('download',{...query,body:{id:'first'}}))).status,403);
  assert.equal((await handler(request('checkout',query))).status,409);
  assert.ok(calls.every(call => !call.path.includes('sign') && !call.path.includes('checkout')));
});
test('checkout uses verified £4.99 monthly price and reuses an open session', async () => {
  const query = {method:'POST',authenticated:true};
  const bad = fixture({priceAmount:999});
  assert.equal((await bad.handler(request('checkout',query))).status,503);
  const open = fixture({existingCheckout:true});
  const reuse = await open.handler(request('checkout',query));
  assert.equal((await reuse.json()).url,'https://checkout.example/reuse');
  const valid = fixture();
  assert.equal((await valid.handler(request('checkout',query))).status,200);
  const checkout = valid.calls.at(-1);
  assert.equal(checkout.options.method,'POST');
  assert.equal(new URLSearchParams(checkout.options.body).get('line_items[0][price]'),'price_member');
  assert.ok(checkout.options.headers['Idempotency-Key']);
});
test('email sign-in stores the provider token in a private cookie', async () => {
  const {handler} = fixture();
  const response = await handler(request('verify',{method:'POST',body:{email:'member@example.com',code:'123456'}}));
  assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
  assert.deepEqual(await response.json(),{ok:true});
});
