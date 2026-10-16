#!/usr/bin/env node
// Loopback CDP transport adapted from freestylefly/codex-themes (MIT).
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {attachVoiceBridge} from './voice-host.mjs';
import {collectUsage} from './usage.mjs';
import {collectAccountQuota} from './account-quota.mjs';
const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const command = process.argv[2] || 'status';
const portArg = process.argv.find(v=>v.startsWith('--port='));
const port = Number(portArg?.slice(7) || 9341);
if(!Number.isInteger(port)||port<1024||port>65535) throw Error('Invalid port');
const stopPath = path.join(dir,'.watch-stop');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let usageSnapshot=null,usageUpdated=0,lastAccountQuota=null;
async function usage() {
  if(!usageSnapshot||Date.now()-usageUpdated>60000) {
    const [local,account]=await Promise.all([collectUsage(),collectAccountQuota().catch(()=>null)]);
    if(account)lastAccountQuota=account;
    const fallback=local.quota;
    const quota=account||(!fallback||lastAccountQuota?.observedAt>fallback.observedAt?lastAccountQuota:fallback);
    usageSnapshot={...local,quota};usageUpdated=Date.now();
  }
  return usageSnapshot;
}

export function validateTarget(target, expectedPort) {
  const u = new URL(target.webSocketDebuggerUrl);
  if(target.type !== 'page' || !target.url?.startsWith('app://') ||
    u.protocol !== 'ws:' || !['127.0.0.1','localhost','[::1]'].includes(u.hostname) || Number(u.port)!==expectedPort)
    throw Error('Rejected CDP target: expected app:// page on local loopback');
  return u.href;
}
export class Session {
  constructor(target, port) {this.target=target;this.url=validateTarget(target,port);this.pending=new Map();this.id=0;}
  async open() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message',event=>{
      const m=JSON.parse(String(event.data)), p=this.pending.get(m.id);
      if(!p)return;clearTimeout(p.timer);this.pending.delete(m.id);
      m.error?p.reject(Error(m.error.message)):p.resolve(m.result);
    });
    this.ws.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('CDP disconnected'));}this.pending.clear();});
    await new Promise((resolve,reject)=>{const t=setTimeout(()=>{this.ws.close();reject(Error('CDP open timed out'));},4000);
      this.ws.addEventListener('open',()=>{clearTimeout(t);resolve();},{once:true});
      this.ws.addEventListener('error',()=>{clearTimeout(t);reject(Error('CDP open failed'));},{once:true});});
    return this;
  }
  send(method,params={}) {return new Promise((resolve,reject)=>{const id=++this.id;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP command timeout'));},6000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
  async evaluate(expression) {const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
  close(){this.ws?.close();}
}
const probe = `(()=>{
  const b=[...document.querySelectorAll('button')].find(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&r.left<360&&r.top<160&&/^(Codex|ChatGPT)$/i.test(b.textContent.trim())});
  const mode=b?.textContent.trim()||document.title;
  return /^codex(?:\\s|$)/i.test(mode)&&!!document.querySelector('aside.app-shell-left-panel')&&!!document.querySelector('main');
})()`;
async function targets() {
  const r=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(2000)});
  if(!r.ok)throw Error(`CDP HTTP ${r.status}`);
  const rows=await r.json();if(!Array.isArray(rows))throw Error('Unexpected CDP response');
  return rows.filter(t=>{try{validateTarget(t,port);return true;}catch{return false;}});
}
async function payload() {
  const [css, renderer] = await Promise.all(['fairy.css','renderer.js'].map(f=>fs.readFile(path.join(dir,f),'utf8')));
  const eye = require('./vendor/mascot-eye-svg.cjs');
  const [voice,speech]=await Promise.all(['voice.js','vendor/speech-text.js'].map(f=>fs.readFile(path.join(dir,f),'utf8')));
  return `(()=>{const state=(${renderer.trim()})(${JSON.stringify(css)},${JSON.stringify(eye)});(${voice.trim()})(${speech.trim()});return state;})()`;
}
async function eachTarget(action) {
  const found=await targets();const results=[];
  for(const t of found){let s;try{s=await new Session(t,port).open();results.push(await action(s));}finally{s?.close();}}
  return results.filter(Boolean);
}
async function apply(force=false) {
  const [expression,metrics]=await Promise.all([payload(),usage()]);
  return eachTarget(async s=>{
    const state=await s.evaluate('window.__FAIRY_CODEX__?.status() || null');
    if(state && !force) {await s.evaluate(`window.__FAIRY_CODEX__?.setUsage?.(${JSON.stringify(metrics)})`);return state;}
    if(!await s.evaluate(probe))return null;
    const result=await s.evaluate(expression);
    await s.evaluate(`window.__FAIRY_CODEX__?.setUsage?.(${JSON.stringify(metrics)})`);return result;
  });
}
const voiceSessions=new Map();
async function connectVoices(){
  const found=await targets();
  for(const [id,value] of voiceSessions)if(!found.some(t=>t.id===id)||value.session.ws.readyState!==1){value.dispose();voiceSessions.delete(id);}
  for(const t of found){if(voiceSessions.has(t.id))continue;let session;try{session=await new Session(t,port).open();if(!await session.evaluate('!!window.__FAIRY_CODEX__&&!window.__FAIRY_CODEX__.disabled')){session.close();continue;}const dispose=await attachVoiceBridge(session);voiceSessions.set(t.id,{session,dispose});}catch{session?.close();}}
}
async function main() {
  if(command==='status') {
    const results=await eachTarget(async s=>({codex:await s.evaluate(probe),theme:await s.evaluate('window.__FAIRY_CODEX__?.status() || null')}));
    console.log(JSON.stringify({port,targets:results},null,2));return;
  }
  if(command==='restore') {
    await fs.writeFile(stopPath,'stop');
    const results=await eachTarget(s=>s.evaluate(`(()=>{window.__FAIRY_CODEX__?.dispose();return {restored:!document.querySelector('#fairy-codex-style')};})()`));
    console.log(JSON.stringify(results));return;
  }
  if(command==='apply') {const r=await apply(true);if(!r.length)throw Error('No verified Codex surface. Switch the app to Codex mode.');console.log(JSON.stringify(r));return;}
  if(command==='watch') {
    await fs.rm(stopPath,{force:true});
    let last='', fail=0;
    const stop=()=>{process.exitCode=0;stopping=true;};let stopping=false;
    process.on('SIGINT',stop);process.on('SIGTERM',stop);
    console.log(`Fairy visual watcher: loopback ${port}. Speech reads reply text only when enabled; no contents are logged.`);
    while(!stopping) {
      try {await fs.access(stopPath);break;}catch{}
      try {const result=await apply();await connectVoices();fail=0;
        if(result.some(s=>s.disabled)) {
          await fs.writeFile(stopPath,'stop');
          await eachTarget(s=>s.evaluate('(()=>{window.__FAIRY_CODEX__?.dispose();return true})()'));
          console.log('Fairy restored. Watcher stopped.');break;
        }
        const msg=JSON.stringify(result);if(msg!==last){console.log(msg);last=msg;}}
      catch {if(++fail===1)console.log('Waiting for Codex CDP...');if(fail>=30)break;}
      await sleep(2000);
    }
    for(const value of voiceSessions.values())value.dispose();voiceSessions.clear();
    return;
  }
  throw Error('Usage: node fairy.mjs status|apply|watch|restore [--port=9341]');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{
  console.error(`Fairy: ${e.message}. If CDP is not open, quit Codex normally and run Start-Fairy.ps1.`);process.exitCode=1;
});
