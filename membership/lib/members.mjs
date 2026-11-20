export const price = Object.freeze({ amount: 499, currency: 'gbp', interval: 'month' });
export const entitled = (subscriptions, priceId) => subscriptions.some(subscription =>
  subscription.status === 'active' &&
  subscription.items.data.some(item => item.price.id === priceId));

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function configure(env) {
  const required = ['APP_ORIGIN', 'STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID',
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const mode = env.PARASITE_BILLING_MODE;
  if (!mode) return null;
  if (!['test', 'live'].includes(mode) || required.some(key => !env[key]) ||
      !new RegExp('^(sk|rk)_' + mode + '_').test(env.STRIPE_SECRET_KEY)) {
    throw new HttpError(503, 'Membership configuration is incomplete.');
  }
  const origin = new URL(env.APP_ORIGIN);
  const supabase = new URL(env.SUPABASE_URL);
  if (![origin, supabase].every(url => url.protocol === 'https:' && url.href === url.origin + '/')) {
    throw new HttpError(503, 'Membership configuration is incomplete.');
  }
  const releases = JSON.parse(env.PARASITE_PRIVATE_RELEASES || '[]');
  if (!Array.isArray(releases) || releases.some(item =>
    typeof item.title !== 'string' || !/^[a-z0-9-]+$/.test(item.id) ||
    !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.apk$/.test(item.path) ||
    item.path.split('/').some(segment => ['.', '..'].includes(segment)))) {
    throw new HttpError(503, 'Membership release configuration is incomplete.');
  }
  if (mode === 'live' && releases.length === 0) {
    throw new HttpError(503, 'A member release is required before accepting live payments.');
  }
  return {...env, mode, origin:origin.origin, supabase:supabase.origin, releases};
}

export function providers(config, fetcher = fetch) {
  async function call(url, headers, method = 'GET', body) {
    const response = await fetcher(url, {method, headers, body, signal:AbortSignal.timeout(10000)});
    if (!response.ok) {
      throw new HttpError(response.status === 429 ? 429 : 502,
        response.status === 429 ? 'Too many requests. Try again shortly.' : 'The membership service is temporarily unavailable.');
    }
    return response.json();
  }
  function stripe(path, method, params = {}, idempotencyKey) {
    const encoded = new URLSearchParams(params);
    const url = new URL('https://api.stripe.com/v1/' + path);
    const headers = {Authorization:'Bearer ' + config.STRIPE_SECRET_KEY};
    if (method === 'GET') {
      url.search = encoded.toString();
      return call(url, headers);
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    return call(url, headers, method, encoded.toString());
  }
  function supabase(path, method, body, token, admin = false, extraHeaders = {}) {
    const key = admin ? config.SUPABASE_SERVICE_ROLE_KEY : config.SUPABASE_ANON_KEY;
    const headers = {apikey:key, 'Content-Type':'application/json', ...extraHeaders};
    if (token || admin) headers.Authorization = 'Bearer ' + (token || key);
    return call(config.supabase + path, headers, method, body === undefined ? undefined : JSON.stringify(body));
  }
  return {stripe, supabase, fetcher};
}

const json = (value, status = 200, headers = {}) => Response.json(value, {
  status, headers:{'Cache-Control':'no-store', ...headers}
});
const sessionCookie = (token, age) =>
  '__Host-parasite=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + age;
const tokenFrom = request => request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-parasite=([\w.-]+)(?:;|$)/)?.[1];
const allStates = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused']);
const asEmail = input => typeof input === 'string' && input.length < 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

export function createHandler(env, fetcher = fetch) {
  return async function handle(request) {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action') || 'status';
      const config = configure(env);
      const allowed = request.method === 'GET' ? ['status'] :
        request.method === 'POST' ? ['code', 'verify', 'signout', 'checkout', 'portal', 'download'] : [];
      if (!allowed.includes(action)) throw new HttpError(405, 'Unsupported request.');
      if (!config) {
        if (action === 'status') return json({mode:'preview', signedIn:false, member:false});
        throw new HttpError(503, 'Billing is disabled in this preview.');
      }
      if (request.method === 'POST' && request.headers.get('origin') !== config.origin) {
        throw new HttpError(403, 'Request origin is invalid.');
      }
      const {stripe, supabase} = providers(config, fetcher);
      if (action === 'code' || action === 'verify') {
        const {email, code} = await request.json();
        if (!asEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
        if (action === 'code') {
          await supabase('/auth/v1/otp', 'POST', {email, create_user:true});
          return json({ok:true});
        }
        if (typeof code !== 'string' || !/^\d{6,10}$/.test(code)) {
          throw new HttpError(400, 'Enter the code from your email.');
        }
        const session = await supabase('/auth/v1/verify', 'POST', {email, token:code, type:'email'}).catch(error => {
          if (error.status === 502) throw new HttpError(400, 'This code could not be verified. Request a new code and try again.');
          throw error;
        });
        return json({ok:true}, 200, {'Set-Cookie':sessionCookie(session.access_token, session.expires_in)});
      }
      if (action === 'signout') return json({ok:true}, 200, {'Set-Cookie':sessionCookie('', 0)});
      const token = tokenFrom(request);
      let user;
      if (token) {
        // Only an Auth authentication rejection clears a session. Provider downtime fails closed.
        const auth = await fetcher(config.supabase + '/auth/v1/user', {
          headers:{apikey:config.SUPABASE_ANON_KEY, Authorization:'Bearer ' + token},
          signal:AbortSignal.timeout(10000)
        });
        if (auth.ok) user = await auth.json();
        else if (![401, 403].includes(auth.status)) throw new HttpError(502, 'Sign-in is temporarily unavailable.');
      }
      if (!user?.id || !user.email_confirmed_at) {
        if (action === 'status') return json({mode:config.mode, signedIn:false, member:false});
        throw new HttpError(401, 'Sign in to continue.');
      }
      const path = '/rest/v1/parasite_customers';
      const userQuery = path + '?select=stripe_customer_id&user_id=eq.' + encodeURIComponent(user.id);
      const readCustomer = async () => (await supabase(userQuery, 'GET', undefined, null, true))[0]?.stripe_customer_id;
      let customer = await readCustomer();
      const target = config.STRIPE_PRICE_ID;
      const subscriptions = customer ? (await stripe('subscriptions', 'GET', {customer, price:target, status:'all', limit:100})).data : [];
      const member = entitled(subscriptions, target);
      const needsBilling = subscriptions.some(subscription => allStates.has(subscription.status));
      if (action === 'status') return json({
        mode:config.mode, signedIn:true, member, needsBilling, hasCustomer:Boolean(customer),
        releases:member ? config.releases.map(({id,title}) => ({id,title})) : []
      });
      if (action === 'download') {
        if (!member) throw new HttpError(403, 'An active membership is required.');
        const {id} = await request.json();
        const release = config.releases.find(item => item.id === id);
        if (!release) throw new HttpError(404, 'Release unavailable.');
        const object = release.path.split('/').map(encodeURIComponent).join('/');
        const result = await supabase('/storage/v1/object/sign/parasite-members/' + object, 'POST',
          {expiresIn:120}, null, true);
        if (!result.signedURL?.startsWith('/object/sign/')) throw new HttpError(502, 'Download temporarily unavailable.');
        return json({url:config.supabase + '/storage/v1' + result.signedURL});
      }
      if (action === 'portal') {
        if (!customer) throw new HttpError(404, 'Billing is available after checkout starts.');
        const portal = await stripe('billing_portal/sessions', 'POST', {customer, return_url:config.origin});
        return json({url:portal.url});
      }
      if (needsBilling) throw new HttpError(409, 'Manage your existing subscription in Billing.');
      const stripePrice = await stripe('prices/' + encodeURIComponent(target), 'GET');
      if (stripePrice.unit_amount !== price.amount || stripePrice.currency !== price.currency ||
          stripePrice.recurring?.interval !== price.interval || stripePrice.recurring.interval_count !== 1 ||
          stripePrice.livemode !== (config.mode === 'live') || !stripePrice.active) {
        throw new HttpError(503, 'The configured membership price is invalid.');
      }
      if (!customer) {
        const created = await stripe('customers', 'POST', {email:user.email, 'metadata[parasite_user_id]':user.id},
          'parasite-customer-' + user.id);
        await supabase(path, 'POST', {user_id:user.id, stripe_customer_id:created.id}, null, true,
          {Prefer:'resolution=ignore-duplicates,return=representation'});
        customer = await readCustomer();
        if (!customer) throw new HttpError(502, 'Checkout could not be prepared. Try again.');
      }
      const recent = await stripe('checkout/sessions', 'GET', {customer, limit:10});
      const open = recent.data.find(session => session.status === 'open' && session.metadata?.parasite_price === target);
      if (open) return json({url:open.url});
      const completed = recent.data.find(session => session.status === 'complete' && session.metadata?.parasite_price === target);
      if (completed && !subscriptions.length) {
        throw new HttpError(409, 'Your payment is being checked. Refresh membership status shortly.');
      }
      const checkout = await stripe('checkout/sessions', 'POST', {
        mode:'subscription', customer, 'line_items[0][price]':target, 'line_items[0][quantity]':'1',
        'payment_method_types[0]':'card', 'metadata[parasite_price]':target,
        success_url:config.origin + '/?checkout=complete', cancel_url:config.origin + '/?checkout=cancelled'
      }, 'parasite-checkout-' + customer + '-' + target + '-' + (recent.data[0]?.id || 'initial'));
      return json({url:checkout.url});
    } catch (error) {
      if (error instanceof SyntaxError) return json({error:'Invalid request data.'}, 400);
      if (!error.status) console.error('Membership request failed', error.name);
      return json({error:error.status ? error.message : 'Membership is temporarily unavailable.'}, error.status || 503);
    }
  };
}
