import { createHash, timingSafeEqual } from 'node:crypto';

const owner = process.env.PARASITE_CREATOR_OWNER;
const dbToken = process.env.PARASITE_CREATOR_DB_TOKEN;
const endpoint = process.env.PARASITE_CREATOR_DB_URL;
const publicKey = process.env.PARASITE_CREATOR_DB_KEY;
const cookieName = '__Host-parasite-creator';
const origin = 'https://parasite-creator.vercel.app';
const sha = value => createHash('sha256').update(value).digest();
const normalize = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
const authorized = attempt => owner && attempt.length < 100 && timingSafeEqual(sha(attempt), sha(owner));
const cookie = (value, age) => cookieName + '=' + value + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' + age;
function reply(value, status = 200, headers = {}) {
  return Response.json(value, {status,headers:{'Cache-Control':'private, no-store',...headers}});
}
async function queue(params = {}) {
  const response = await fetch(endpoint + '/rest/v1/rpc/parasite_creator_queue', {
    method:'POST', signal:AbortSignal.timeout(9000),
    headers:{apikey:publicKey,'Content-Type':'application/json'},
    body:JSON.stringify({api_token:dbToken,...params})
  });
  if (!response.ok) throw new Error('Queue unavailable: ' + response.status);
  return response.json();
}
async function handle(request) {
  if (!owner || !dbToken || !endpoint || !publicKey) return reply({error:'Creator setup is incomplete.'},503);
  const session = request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-parasite-creator=([\w-]+)(?:;|$)/)?.[1] || '';
  try {
    if (request.method === 'GET') {
      if (!authorized(session)) return reply({error:'Enter your access code.'},401);
      return reply({requests:await queue()});
    }
    if (request.headers.get('origin') !== origin) return reply({error:'Open Creator at its main address.'},403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'Invalid request.'},415);
    if (Number(request.headers.get('content-length')) > 20000) return reply({error:'Brief is too long.'},413);
    const raw = await request.text();
    if (raw.length > 20000) return reply({error:'Brief is too long.'},413);
    const data = JSON.parse(raw);
    if (data === null || typeof data !== 'object') return reply({error:'Invalid request.'},400);
    if (data.action === 'unlock') {
      const code = normalize(data.code);
      if (!authorized(code)) return reply({error:'That access code did not match.'},401);
      return reply({ok:true},200,{'Set-Cookie':cookie(code,60*60*24*90)});
    }
    if (data.action === 'lock') return reply({ok:true},200,{'Set-Cookie':cookie('',0)});
    if (!authorized(session)) return reply({error:'Enter your access code.'},401);
    if (data.action !== 'submit') return reply({error:'Invalid request.'},400);
    const brief = typeof data.brief === 'string' ? data.brief.trim() : '';
    if (brief.length < 10 || brief.length > 4000) return reply({error:'Use between 10 and 4,000 characters.'},400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id || '')) {
      return reply({error:'Missing request identifier.'},400);
    }
    return reply({request:await queue({request_id:data.id,request_brief:brief})},201);
  } catch (error) {
    if (error instanceof SyntaxError) return reply({error:'Invalid request data.'},400);
    console.error('Parasite Creator queue', error.message);
    return reply({error:'Queue unavailable. Your draft is still on this device. Try again shortly.'},503);
  }
}

export const GET = handle;
export const POST = handle;
