// Read token-count metadata only. Chat contents, auth files and prompts are never parsed.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
const cache=new Map();
export function dayBounds(now=new Date()) {
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const start=Date.parse(`${date}T00:00:00+08:00`);
  return {date,start,end:start+86400000};
}
const number=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
export function tallyRows(rows, bounds) {
  let previous=null;
  const sums={input:0,cached:0,output:0,total:0,events:0};
  for(const row of rows) {
    if(row.type!=='event_msg'||row.payload?.type!=='token_count'||!row.payload.info)continue;
    const info=row.payload.info,total=info.total_token_usage,last=info.last_token_usage;
    if(!total)continue;
    const curr={input:number(total.input_tokens),cached:number(total.cached_input_tokens),output:number(total.output_tokens),total:number(total.total_tokens)};
    if(!curr.total)curr.total=curr.input+curr.output;
    const timestamp=Date.parse(row.timestamp);
    if(timestamp>=bounds.start&&timestamp<bounds.end&&(!previous||curr.total!==previous.total)) {
      const fresh=!previous||curr.total<previous.total;
      const delta=fresh?{input:number(last?.input_tokens),cached:number(last?.cached_input_tokens),output:number(last?.output_tokens),total:number(last?.total_tokens)}:Object.fromEntries(Object.keys(curr).map(k=>[k,Math.max(0,curr[k]-previous[k])]));
      if(!delta.total)delta.total=delta.input+delta.output;
      for(const k of ['input','cached','output','total'])sums[k]+=delta[k];
      if(delta.total)sums.events++;
    }
    previous=curr;
  }
  return sums;
}

// Account quota is metadata attached to token events, separate from local token totals.
export function quotaFromRows(rows) {
  let latest=null;
  for(const row of rows) {
    const limits=row.type==='event_msg'&&row.payload?.type==='token_count'?row.payload.rate_limits:null;
    const timestamp=Date.parse(row.timestamp);
    if(!limits||!Number.isFinite(timestamp)||(limits.limit_id&&limits.limit_id!=='codex')||(latest&&timestamp<=latest.observedAt))continue;
    const window=value=>value&&typeof value.used_percent==='number'&&Number.isFinite(value.used_percent)?{
      remaining:Math.max(0,Math.min(100,100-value.used_percent)),
      minutes:typeof value.window_minutes==='number'&&Number.isFinite(value.window_minutes)?value.window_minutes:null,
      resetsAt:typeof value.resets_at==='number'&&Number.isFinite(value.resets_at)?value.resets_at:null
    }:null;
    const primary=window(limits.primary),secondary=window(limits.secondary);
    if(primary||secondary)latest={source:'codex-account-quota',observedAt:timestamp,primary,secondary};
  }
  return latest;
}

async function walk(dir,found=[]) {
  for(const entry of await fsp.readdir(dir,{withFileTypes:true})) {
    const p=path.join(dir,entry.name);
    if(entry.isSymbolicLink())continue;
    if(entry.isDirectory())await walk(p,found);
    else if(entry.isFile()&&entry.name.endsWith('.jsonl'))found.push(p);
  }
  return found;
}
export async function collectUsage({sessionsDir=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions'),now=new Date()}={}) {
  const bounds=dayBounds(now),sums={input:0,cached:0,output:0,total:0,events:0};let files=0,failed=0,quota=null;
  let paths;
  try{paths=await walk(sessionsDir);}catch{return {available:false,date:bounds.date,updatedAt:now.toISOString(),source:'local-token-events',reason:'No accessible session metadata'};}
  for(const file of paths) {
    try {
      const stat=await fsp.stat(file);if(stat.mtimeMs<bounds.start)continue;
      const key=`${bounds.date}:${stat.size}:${stat.mtimeMs}`;let item=cache.get(file);
      if(!item||item.key!==key) {
        const rows=[];
        for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})) {
          // Reject other event lines before JSON.parse; do not retain chat data.
          if(!line.includes('"token_count"'))continue;
          try{const row=JSON.parse(line);if(row.type==='event_msg'&&row.payload?.type==='token_count')rows.push(row);}catch{}
        }
        item={key,sums:tallyRows(rows,bounds),quota:quotaFromRows(rows)};cache.set(file,item);
      }
      if(item.quota&&(!quota||item.quota.observedAt>quota.observedAt))quota=item.quota;
      if(item.sums.events)files++;
      for(const k of Object.keys(sums))sums[k]+=item.sums[k];
    }catch{failed++;}
  }
  return {available:true,date:bounds.date,...sums,files,quota,partial:failed>0,updatedAt:now.toISOString(),source:'local-token-events',scope:'Local recorded token events; not provider billing'};
}
