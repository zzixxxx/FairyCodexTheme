// Read-only Codex app-server RPC. Authentication stays inside the installed CLI.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import readline from 'node:readline';

export function normalizeAccountQuota(result, observedAt=Date.now()) {
  const bucket=result?.rateLimitsByLimitId?.codex ?? result?.rateLimits;
  if(!bucket||(bucket.limitId&&bucket.limitId!=='codex'))return null;
  const window=w=>w&&typeof w.usedPercent==='number'&&Number.isFinite(w.usedPercent)?{
    remaining:Math.max(0,Math.min(100,100-w.usedPercent)),
    minutes:typeof w.windowDurationMins==='number'&&Number.isFinite(w.windowDurationMins)?w.windowDurationMins:null,
    resetsAt:typeof w.resetsAt==='number'&&Number.isFinite(w.resetsAt)?w.resetsAt:null
  }:null;
  const primary=window(bucket.primary),secondary=window(bucket.secondary);
  return primary||secondary?{source:'codex-account-api',observedAt,primary,secondary}:null;
}

async function findCodex() {
  const name=process.platform==='win32'?'codex.exe':'codex';
  for(const dir of (process.env.PATH||'').split(path.delimiter).filter(Boolean)) {
    const candidate=path.join(dir.replace(/^"|"$/g,''),name);
    try{await fs.access(candidate);return candidate;}catch{}
  }
  if(process.platform==='win32') {
    const dir=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'OpenAI','Codex','bin');
    try {
      const candidates=[];
      for(const entry of await fs.readdir(dir,{withFileTypes:true}))if(entry.isDirectory()) {
        const candidate=path.join(dir,entry.name,name);
        try{candidates.push({candidate,mtime:(await fs.stat(candidate)).mtimeMs});}catch{}
      }
      return candidates.sort((a,b)=>b.mtime-a.mtime)[0]?.candidate||null;
    }catch{}
  }
  return null;
}

export async function collectAccountQuota({executable,timeoutMs=10000,spawnProcess=spawn}={}) {
  const binary=executable||await findCodex();
  if(!binary)return null;
  return new Promise(resolve=>{
    let child,lines,settled=false;
    const finish=value=>{
      if(settled)return;settled=true;clearTimeout(timeout);lines?.close();
      child?.stdin?.end();child?.kill();resolve(value);
    };
    const timeout=setTimeout(()=>finish(null),timeoutMs);
    try{child=spawnProcess(binary,['app-server','--stdio'],{windowsHide:true,stdio:['pipe','pipe','pipe']});}catch{finish(null);return;}
    child.on('error',()=>finish(null));child.on('exit',()=>finish(null));
    child.stdin.on('error',()=>finish(null));
    // Do not persist diagnostic output, credentials, account IDs or other notifications.
    child.stderr.resume();
    const send=value=>child.stdin.write(JSON.stringify(value)+'\n');
    lines=readline.createInterface({input:child.stdout});
    let requested=false;
    lines.on('line',line=>{
      let message;try{message=JSON.parse(line);}catch{return;}
      if(message.id===1&&!requested) {
        if(message.error){finish(null);return;}
        requested=true;send({method:'initialized',params:{}});
        send({id:2,method:'account/rateLimits/read',params:{}});
      }else if(message.id===2)finish(message.error?null:normalizeAccountQuota(message.result));
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'fairy_codex_theme',title:'Fairy Codex Theme',version:'1.3.1'}}});
  });
}
