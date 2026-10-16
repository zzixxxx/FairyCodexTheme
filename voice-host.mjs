// Local speech adapter. No credentials, message logs, or external speech provider.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function localEndpoint(value='http://127.0.0.1:9880/tts') {
  const u=new URL(value);
  if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.pathname!=='/tts'||u.username||u.password||u.search||u.hash)throw Error('语音地址仅支持本机 HTTP /tts');
  return u.href;
}
export async function synthesize(request,signal) {
  const text=typeof request.text==='string'?request.text.trim():'';
  if(!text||text.length>500)throw Error('朗读片段需为 1–500 字');
  if(request.engine==='fairy') {
    const endpoint=localEndpoint(request.endpoint);
    if(typeof request.reference!=='string'||!request.reference.trim()||request.reference.length>1024||typeof request.prompt!=='string'||request.prompt.length>2000)throw Error('请配置参考音频绝对路径和对应文本');
    const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(180000)]),body:JSON.stringify({text,text_lang:'zh',ref_audio_path:request.reference,prompt_text:request.prompt,prompt_lang:'zh',text_split_method:'cut5',batch_size:1,media_type:'wav',streaming_mode:0,parallel_infer:false})});
    if(!response.ok)throw Error(`本地 Fairy 语音服务返回 ${response.status}`);
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12*1024*1024)throw Error('语音片段超过大小限制');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
    const data=Buffer.concat(chunks);
    if(data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')throw Error('本地语音服务未返回 WAV 音频');
    return data.toString('base64');
  }
  if(request.engine!=='system')throw Error('未知语音引擎');
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./voice-sapi.ps1',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',error='',settled=false;
    const finish=(failure)=>{if(settled)return;settled=true;clearTimeout(timeout);signal.removeEventListener('abort',abort);failure?reject(failure):resolve(output.trim());};
    const abort=()=>{child.kill();finish(Error('朗读已取消'));};
    const timeout=setTimeout(()=>{child.kill();finish(Error('系统语音超时'));},30000);
    signal.addEventListener('abort',abort,{once:true});
    child.stdout.setEncoding('utf8');child.stdout.on('data',v=>{output+=v;if(output.length>16*1024*1024){child.kill();finish(Error('语音片段过大'));}});
    child.stderr.on('data',v=>{error+=v;});
    child.on('error',()=>finish(Error('系统中文语音不可用')));child.on('close',code=>finish(code!==0||!output?Error(error?'系统中文语音合成失败':'没有可用音频'):null));
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({text}));
    if(signal.aborted)abort();
  });
}
export async function attachVoiceBridge(session) {
  let active=null;
  const listener=async event=>{
    let m;try{m=JSON.parse(String(event.data));}catch{return;}
    if(m.method!=='Runtime.bindingCalled'||m.params.name!=='__fairySpeechRequest')return;
    let request;try{request=JSON.parse(m.params.payload);}catch{return;}
    if(request.action==='cancel'){active?.abort();active=null;return;}
    if(request.action!=='speak'||typeof request.id!=='string'||request.id.length>80)return;
    active?.abort();const controller=new AbortController();active=controller;
    let result;try{result={id:request.id,audio:await synthesize(request,controller.signal)};}catch(e){result={id:request.id,error:e.message};}
    if(active!==controller||controller.signal.aborted)return;
    active=null;
    await session.evaluate(`window.__FAIRY_VOICE__?.receive(${JSON.stringify(result)})`).catch(()=>{});
  };
  session.ws.addEventListener('message',listener);
  await session.send('Runtime.addBinding',{name:'__fairySpeechRequest'});
  return ()=>{active?.abort();session.ws.removeEventListener('message',listener);session.close();};
}
