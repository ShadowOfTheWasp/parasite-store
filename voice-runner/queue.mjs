import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const api='https://zijdvgjngmnasvioblxh.supabase.co/functions/v1/parasite-voice';
const root=path.dirname(new URL(import.meta.url).pathname);
const working=path.join(process.env.RUNNER_TEMP||root,'private-voice-job');
const jobFile=path.join(working,'job.json'),output=path.join(working,'output');
async function request(route,token,data={}){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(api+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(25000)});
   const body=await response.json();
   if(response.ok)return body;
   if(response.status<500)throw Object.assign(new Error('Queue rejected worker request ('+response.status+').'),{fatal:true});
  }catch(error){if(error.fatal||attempt===2)throw error;}
  await new Promise(r=>setTimeout(r,1500*(attempt+1)));
 }
 throw new Error('Queue unavailable.');
}
if(process.argv[2]==='claim'){
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);url.searchParams.set('audience',api);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('GitHub could not issue worker identity.');
 const {value}=await response.json();
 const {job}=await request('/runner/claim',value);
 fs.appendFileSync(process.env.GITHUB_OUTPUT,'has_job='+(job?'true':'false')+'\n');
 if(job){fs.mkdirSync(working,{recursive:true,mode:0o700});fs.writeFileSync(jobFile,JSON.stringify(job),{mode:0o600});console.log('A private voice job was accepted.');}
 else console.log('No voice jobs are waiting.');
}else if(process.argv[2]==='run'){
 const job=JSON.parse(fs.readFileSync(jobFile,'utf8'));
 let progress=0,total=0,heartbeatFailed=false;
 async function heartbeat(){
  try{const p=JSON.parse(fs.readFileSync(path.join(output,'progress.json'),'utf8'));progress=p.progress;total=p.total;}catch{}
  try{await request('/runner/'+job.id+'/heartbeat',job.lease,{progress,total});}catch{heartbeatFailed=true;}
 }
 const timer=setInterval(heartbeat,30000);
 try{
  await heartbeat();
  await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[path.join(root,'render.mjs'),jobFile,output],{stdio:['ignore','pipe','pipe']});
   // Model exceptions can contain input text. Keep their full output out of public Actions logs.
   let errors='';child.stderr.on('data',c=>{errors=(errors+c.toString()).slice(-2000);});
   child.stdout.on('data',()=>{});
   child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('The voice model did not finish.')));
  });
  await heartbeat();
  const result=JSON.parse(fs.readFileSync(path.join(output,'result.json'),'utf8'));
  const wav=fs.readFileSync(path.join(output,'narration.wav'));
  if(wav.length>50331648)throw new Error('This script produced a take larger than 48 MB.');
  const {url}=await request('/runner/'+job.id+'/upload',job.lease);
  const target=new URL(url);
  if(target.origin!=='https://zijdvgjngmnasvioblxh.supabase.co')throw new Error('Unexpected upload destination.');
  const uploaded=await fetch(target,{method:'PUT',headers:{'Content-Type':'audio/wav','x-upsert':'true'},body:wav,signal:AbortSignal.timeout(180000)});
  if(!uploaded.ok)throw new Error('Private output upload did not finish ('+uploaded.status+').');
  await request('/runner/'+job.id+'/complete',job.lease,{seconds:result.seconds});
  console.log('Private voice render completed and saved.');
 }catch(error){
  try{await request('/runner/'+job.id+'/fail',job.lease);}catch{}
  console.error(error.message);process.exitCode=1;
 }finally{clearInterval(timer);fs.rmSync(working,{recursive:true,force:true});}
}else throw new Error('Use claim or run.');
