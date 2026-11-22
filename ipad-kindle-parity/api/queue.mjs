// A same-origin, fixed-destination gateway to the existing private Parasite Creator.
// Does not store or disclose the owner's password or Supabase credential.
const TARGET='https://parasite-creator.vercel.app/api/queue';
const ORIGIN='https://parasite-creator.vercel.app';
const failure=(msg,status)=>Response.json({error:msg},{status,headers:{'Cache-Control':'private, no-store'}});
export default async function handler(request){
 try{
  const u=new URL(request.url);
  if(!['GET','POST'].includes(request.method))return failure('Method not allowed',405);
  if(request.method==='POST'){
   const supplied=request.headers.get('origin');
   if(supplied&&supplied!==u.origin)return failure('Cross-site submission blocked',403);
   const len=Number(request.headers.get('content-length')||0);
   if(len>25000)return failure('Request too large',413);
  }
  const headers=new Headers();
  const cookie=request.headers.get('cookie');
  if(cookie)headers.set('cookie',cookie);
  if(request.headers.get('content-type'))headers.set('content-type',request.headers.get('content-type'));
  headers.set('accept','application/json');
  headers.set('origin',ORIGIN);
  headers.set('referer',ORIGIN+'/');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const upstream=await fetch(TARGET,{method:request.method,headers,
    body:request.method==='POST'?await request.text():undefined,
    redirect:'manual',signal:controller.signal});
   const responseHeaders=new Headers({'content-type':upstream.headers.get('content-type')||'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'});
   const setCookie=upstream.headers.get('set-cookie');
   if(setCookie)responseHeaders.set('set-cookie',setCookie);
   return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  }finally{clearTimeout(timeout)}
 }catch(e){return failure('Deploy service temporarily unavailable',502)}
}
