// Parasite Hub's authenticated, same-origin API gateway.
// Uses the Vercel Node.js (req,res) contract. Secret owner credentials are
// forwarded to Creator over HTTPS, never stored in the Hub or public JS.
const TARGET='https://parasite-creator.vercel.app/api/queue';
const fail=(res,status,error)=>res.status(status).setHeader('Cache-Control','private, no-store').json({error});
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return fail(res,405,'Method not allowed')}
 const host=String(req.headers.host||'');
 const origin=String(req.headers.origin||'');
 // Requests are same-origin only. Browsers send Origin on JSON POST.
 if(req.method==='POST'&&origin!==`https://${host}`){return fail(res,403,'Cross-site request blocked')}
 try{
  const headers={'Accept':'application/json','Origin':'https://parasite-creator.vercel.app','Referer':'https://parasite-creator.vercel.app/'};
  if(req.headers.cookie)headers.Cookie=String(req.headers.cookie);
  if(req.method==='POST')headers['Content-Type']='application/json';
  let body;
  if(req.method==='POST'){
   if(req.body!==undefined&&req.body!==null){body=typeof req.body==='string'?req.body:JSON.stringify(req.body)}
   else{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>25000)return fail(res,413,'Request too large');chunks.push(chunk)}body=Buffer.concat(chunks).toString('utf8')}
   if(Buffer.byteLength(body,'utf8')>25000)return fail(res,413,'Request too large');
   try{JSON.parse(body)}catch{return fail(res,400,'Invalid JSON')}
  }
  const upstream=await fetch(TARGET,{
   method:req.method,headers,
   body,redirect:'manual',signal:AbortSignal.timeout(15000)
  });
  const cookie=upstream.headers.get('set-cookie');
  if(cookie)res.setHeader('Set-Cookie',cookie);
  const contentType=upstream.headers.get('content-type')||'application/json';
  res.status(upstream.status);
  res.setHeader('Content-Type',contentType);
  const bytes=Buffer.from(await upstream.arrayBuffer());
  if(bytes.length>300000)return fail(res,502,'Creator response too large');
  return res.send(bytes);
 }catch(e){return fail(res,502,'Deploy connection unavailable. Please try again.')}
}
