/* Fairy-DSH speech behavior adapted to Codex; native dictation remains available. */
((speech, options={})=>{
  window.__FAIRY_VOICE__?.dispose();
  const overlay=document.querySelector('#fairy-codex-overlay'),settings=overlay?.querySelector('.fairy-settings');
  if(!settings)return;
  let prefs={engine:'system',auto:false,volume:.8,endpoint:'http://127.0.0.1:9880/tts',reference:'',prompt:''};
  try{Object.assign(prefs,JSON.parse(localStorage.getItem('fairy-codex-voice-v1')||'{}'));}catch{}
  prefs.engine=prefs.engine==='fairy'?'fairy':'system';prefs.auto=prefs.auto===true;prefs.volume=Math.max(0,Math.min(1,Number.isFinite(Number(prefs.volume))?Number(prefs.volume):.8));
  const panel=document.createElement('section');panel.className='fairy-voice-panel';
  panel.innerHTML=`<strong>语音</strong><label>语音引擎<select data-voice="engine"><option value="system">系统中文语音</option><option value="fairy">Fairy 本地音色 · GPT-SoVITS</option></select></label><label><input type="checkbox" data-voice="auto"> 自动朗读新回复</label><div class="fairy-setting-row"><span>音量</span><span data-percent-slot="volume"></span></div><div class="fairy-voice-actions"><button type="button" data-speech="read">朗读最新回复</button><button type="button" data-speech="pause" disabled>暂停</button><button type="button" data-speech="stop" disabled>停止</button><button type="button" data-speech="test">试听</button></div><p class="fairy-voice-status" role="status">系统中文语音 · 待机</p><details><summary>Fairy 本地音色配置</summary><p>需自行安装 GPT-SoVITS 和 Fairy 模型，加载模型后填写参考音频及文本。</p><label>服务地址<input data-voice="endpoint" type="url" placeholder="http://127.0.0.1:9880/tts"></label><label>参考音频绝对路径<input data-voice="reference" type="text" placeholder="C:\\Voice\\fairy_ref.wav"></label><label>参考音频对应文本<textarea data-voice="prompt" rows="2"></textarea></label></details>`;
  const icons={read:'<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M8 7h5M8 11h3"/><path d="m16 12 6 4-6 4z"/>',pause:'<path d="M8 5v14M16 5v14"/>',resume:'<path d="m8 5 11 7-11 7z"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>',test:'<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>'};
  function iconButton(button,label,icon){button.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon]}</svg>`;button.setAttribute('aria-label',label);button.title=label;}
  for(const [action,label] of Object.entries({read:'朗读最新回复',pause:'暂停',stop:'停止',test:'试听'}))iconButton(panel.querySelector(`[data-speech="${action}"]`),label,action);
  settings.append(panel);
  const volumeControl=window.__FAIRY_CODEX__.percentageControl({label:'音量',min:0,max:1,step:.01,value:prefs.volume,factor:100,attribute:'data-voice',key:'volume'});
  panel.querySelector('[data-percent-slot="volume"]').replaceWith(volumeControl);
  for(const input of panel.querySelectorAll('[data-voice]')){const value=prefs[input.dataset.voice];if(input.type==='checkbox')input.checked=value;else input.value=String(value);}
  const status=panel.querySelector('.fairy-voice-status'),pauseButton=panel.querySelector('[data-speech="pause"]'),stopButton=panel.querySelector('[data-speech="stop"]');
  let disposed=false,epoch=0,audio=null,objectUrl=null,pending=null,queue=[],paused=false,active=false;
  let route=location.pathname+location.search,container=null,armed=false,settle=0;
  const say=text=>{status.textContent=text;};
  function save(){try{localStorage.setItem('fairy-codex-voice-v1',JSON.stringify(prefs));}catch{}}
  function update(){pauseButton.disabled=!active;iconButton(pauseButton,paused?'继续':'暂停',paused?'resume':'pause');stopButton.disabled=!active;}
  function release(){if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();audio=null;}if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}}
  function stop(message='已停止'){armed=false;clearTimeout(settle);settle=0;epoch++;active=false;paused=false;queue=[];pending=null;release();try{window.__fairySpeechRequest?.(JSON.stringify({action:'cancel'}));}catch{}say(message);update();}
  // Extract prose only when the user requests speech or a newly finished reply is armed.
  function latest(){
    const nodes=[...document.querySelectorAll('main [data-markdown-text-style="assistant-message"],main [data-message-author-role="assistant"],main article.assistant')].filter(n=>!n.closest('[hidden],[aria-hidden="true"]')&&n.getClientRects().length);
    const node=nodes.at(-1);if(!node)return '';
    const clone=node.cloneNode(true);
    clone.querySelectorAll('pre,code,table,svg,img,button,script,style,[aria-hidden="true"],[data-fairy-voice]').forEach(n=>n.remove());
    clone.querySelectorAll('p,h1,h2,h3,h4,li,blockquote').forEach(n=>n.append(document.createTextNode('；')));
    return speech.normalizeSpeechText(clone.textContent||'').slice(0,16000);
  }
  function chunks(text){const parts=speech.splitSpeechSentences(text),result=[];let current='';for(const part of parts){if(current.length+part.length>220){result.push(current);current='';}current+=part;}if(current)result.push(current);return result;}
  function next(){
    if(disposed||!active||paused)return;
    if(!queue.length){active=false;say('朗读完成');update();return;}
    if(typeof window.__fairySpeechRequest!=='function'){stop('语音连接未就绪，请使用 Start-Fairy 启动');return;}
    const id=`${epoch}-${Date.now()}`;pending=id;say('正在合成语音…');
    try{window.__fairySpeechRequest(JSON.stringify({action:'speak',id,text:queue.shift(),engine:prefs.engine,endpoint:prefs.endpoint,reference:prefs.reference,prompt:prefs.prompt}));}catch{stop('语音连接失败');}
  }
  function read(text){stop();if(!text?.trim()){say('当前没有可朗读的回复');return;}if(prefs.engine==='fairy'&&(!prefs.reference.trim()||!prefs.prompt.trim())){say('请先填写 Fairy 参考音频和对应文本');return;}queue=chunks(text);active=true;update();next();}
  async function receive(result){
    if(disposed||result.id!==pending)return;pending=null;
    if(result.error){stop(result.error);return;}
    const ticket=epoch;
    try{
      const bytes=Uint8Array.from(atob(result.audio),c=>c.charCodeAt(0));objectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));audio=new Audio(objectUrl);audio.volume=prefs.volume;
      audio.onended=()=>{if(ticket!==epoch)return;release();next();};
      audio.onerror=()=>{if(ticket===epoch)stop('音频播放失败');};
      if(!paused){await audio.play();if(ticket===epoch)say(prefs.engine==='fairy'?'Fairy 正在朗读':'系统中文语音 · 朗读中');}else say('已暂停');
    }catch{if(ticket===epoch)stop('无法播放音频，请点击试听重试');}
  }
  function onClick(e){const action=e.target.closest('[data-speech]')?.dataset.speech;if(!action)return;
    if(action==='read')read(latest());
    if(action==='test')read('你好，绳匠。语音系统已接入。');
    if(action==='stop')stop();
    if(action==='pause'&&active){paused=!paused;if(paused){audio?.pause();say('已暂停');}else if(audio){audio.play().then(()=>say('正在朗读')).catch(()=>stop('播放失败'));}else if(!pending)next();update();}
  }
  function onChange(e){const key=e.target.dataset.voice;if(!key)return;
    if(key==='auto'){prefs.auto=e.target.checked;armed=false;clearTimeout(settle);}
    else if(key==='volume'){prefs.volume=Math.max(0,Math.min(1,Number(e.target.value)));volumeControl.syncPercent(prefs.volume);if(audio)audio.volume=prefs.volume;}
    else{prefs[key]=e.target.value;stop(prefs.engine==='system'?'系统中文语音 · 待机':'Fairy 本地音色 · 待配置/试听');}
    save();
  }
  function tick(){
    const currentRoute=location.pathname+location.search,currentContainer=document.querySelector('main .thread-scroll-container');
    if(route!==currentRoute||container!==currentContainer){route=currentRoute;container=currentContainer;armed=false;clearTimeout(settle);if(active)stop('已切换会话，朗读停止');return;}
    if(!window.__FAIRY_CODEX__?.status().enabled){if(active)stop('朗读停止');armed=false;return;}
    if(!prefs.auto||document.hidden)return;
    const busy=window.__FAIRY_CODEX__.status().busy;
    if(busy){armed=true;clearTimeout(settle);settle=0;}
    else if(armed&&!settle){armed=false;settle=setTimeout(()=>{settle=0;if(!disposed&&prefs.auto&&route===location.pathname+location.search&&!window.__FAIRY_CODEX__?.status().busy)read(latest());},1100);}
  }
  panel.addEventListener('click',onClick);panel.addEventListener('change',onChange);panel.addEventListener('input',e=>{if(e.target.dataset.voice==='volume')onChange(e);});
  const interval=setInterval(tick,800);
  function dispose(){if(disposed)return;disposed=true;clearInterval(interval);clearTimeout(settle);stop();panel.remove();delete window.__FAIRY_VOICE__;}
  window.__FAIRY_VOICE__={receive,dispose,status:()=>({engine:prefs.engine,auto:prefs.auto,active,paused,connected:typeof window.__fairySpeechRequest==='function'})};
  return window.__FAIRY_VOICE__.status();
})
