/* Original adaptation; Fairy eye SVG is from Fairy-DSH (Apache-2.0). */
((css, eye, options = {}) => {
  const KEY = '__FAIRY_CODEX__';
  window[KEY]?.dispose({reapply:true});
  let disposed = false, timer = 0, raf = 0, disabled = false;
  const marked = new Map();
  const root = document.documentElement;
  // Use the same settings route as the host UI; retain the original native theme.
  // The bridge is optional: offline previews never write application settings.
  function nativeThemeBridge(){
    if(options.preview||!location.href.startsWith('app://')||typeof window.electronBridge?.sendMessageFromView!=='function')return null;
    if(window.__FAIRY_NATIVE_THEME__)return window.__FAIRY_NATIVE_THEME__;
    let original,desired=null,queue=Promise.resolve(),generation=0;
    function request(action,params){return new Promise((resolve,reject)=>{
      const requestId='fairy-native-theme-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      const clean=()=>{clearTimeout(timeout);window.removeEventListener('message',receive);};
      const receive=event=>{const value=event.data;if(value?.type!=='fetch-response'||value.requestId!==requestId)return;clean();
        if(value.responseType!=='success'){reject(Error('Native theme request failed'));return;}
        try{resolve(JSON.parse(value.bodyJsonString));}catch{reject(Error('Invalid native theme response'));}};
      window.addEventListener('message',receive);
      const timeout=setTimeout(()=>{clean();reject(Error('Native theme request timed out'));},2500);
      try{Promise.resolve(window.electronBridge.sendMessageFromView({type:'fetch',requestId,method:'POST',url:'vscode://codex/'+action,body:JSON.stringify(params)})).catch(error=>{clean();reject(error);});}catch(error){clean();reject(error);}
    });}
    const enqueue=action=>{queue=queue.catch(()=>{}).then(action).catch(()=>{});};
    const api={set(value){if(desired===value)return;desired=value;generation++;
      enqueue(async()=>{if(original===undefined){const result=await request('get-setting',{key:'appearanceTheme'});if(!['light','dark','system'].includes(result.value))throw Error('Unknown original appearance');original=result.value;}
        await request('set-setting',{key:'appearanceTheme',value});});},
      restore(){const ticket=++generation;desired=null;enqueue(async()=>{try{if(original!==undefined&&ticket===generation)await request('set-setting',{key:'appearanceTheme',value:original});}finally{if(ticket===generation&&window.__FAIRY_NATIVE_THEME__===api)delete window.__FAIRY_NATIVE_THEME__;}});}};
    window.__FAIRY_NATIVE_THEME__=api;return api;
  }
  const nativeTheme=nativeThemeBridge();

  const style = document.createElement('style');
  style.id = 'fairy-codex-style'; style.textContent = css;
  const dockStyle=document.createElement('style');dockStyle.id='fairy-codex-dock-style';
  const widthStyle=document.createElement('style');widthStyle.id='fairy-codex-width-style';
  const overlay = document.createElement('div');
  overlay.id = 'fairy-codex-overlay';
  overlay.dataset.motion = 'on';
  overlay.innerHTML = `<div class="fairy-stage" aria-hidden="true"><div class="fairy-orbit"></div>${eye}</div><div class="fairy-caption" aria-hidden="true"><small>HOLLOW DEEP DIVE SYSTEM</small><h1>你好，绳匠。</h1><p>Fairy 已接入。随时可以开始委托。</p><span class="fairy-state">FAIRY // STANDBY</span></div><button class="fairy-control" type="button" aria-label="Fairy 外观设置" aria-expanded="false" aria-controls="fairy-codex-settings">◉ FAIRY · HDD</button><section id="fairy-codex-settings" class="fairy-settings" aria-label="Fairy 外观设置" hidden><strong>FAIRY / VISUAL</strong><div class="fairy-appearance-options"><label><input type="checkbox" data-option="eye" checked> 显示 Fairy</label><label><input type="checkbox" data-option="power"> 低功耗模式</label><button type="button" data-action="restore">恢复 Codex 原貌</button></div><section class="fairy-eye-settings" aria-label="眼睛外观"><div class="fairy-section-heading"><strong>眼睛</strong><button type="button" data-action="reset-eye" aria-label="恢复默认眼睛" title="恢复默认眼睛"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.5 7M3 4v7h7"/></svg></button></div><div class="fairy-setting-row"><span>眼睛大小</span><span data-percent-slot="scale"></span></div><label>眨眼速度<select data-option="blink" aria-label="眨眼速度"><option value="0">不眨眼</option><option value="12">慢</option><option value="8">标准</option><option value="4">快</option></select></label><label>眼睛颜色<input type="color" data-option="color" aria-label="眼睛颜色"></label></section></section>`;
  overlay.insertAdjacentHTML('beforeend',`<button class="fairy-workspace" type="button" aria-expanded="false" aria-controls="fairy-workspace-menu" data-action="workspace"><span>选择工作区</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10.2954 6.54537C10.5003 6.3404 10.8325 6.34051 11.0376 6.54537C11.2426 6.7504 11.2426 7.08253 11.0376 7.28756L8.60689 9.71822C8.27169 10.0534 7.72823 10.0534 7.39303 9.71822L4.96236 7.28756C4.75734 7.08253 4.75734 6.7504 4.96236 6.54537C5.16739 6.34035 5.49952 6.34035 5.70455 6.54537L7.99947 8.84029L10.2954 6.54537Z" fill="currentColor"/></svg></button><section class="fairy-workspace-menu" id="fairy-workspace-menu" aria-label="选择工作区" hidden><strong>选择工作区</strong><p>打开项目工作区，不更改当前聊天目录。</p><div class="fairy-project-list"></div><button type="button" data-action="add-project">＋ 添加工作区…</button></section>`);
  overlay.querySelector('.fairy-settings strong').insertAdjacentHTML('afterend',`<label>外观<select aria-label="外观模式" data-option="theme"><option value="dark">深潜夜间</option><option value="light">日间模式</option></select></label>`);
  const meter=document.createElement('section');meter.id='fairy-codex-meter';meter.setAttribute('aria-label','用量概览');
  meter.innerHTML=`<div class="fairy-meter-summary"><span>余额</span><b data-metric="cash">—</b><span>今日电量</span><b data-metric="tokens" title="本机 Token 记录，尚未读取">—</b></div><section class="fairy-quota" aria-label="剩余用量"><header><span>剩余用量</span><button type="button" data-action="power" aria-pressed="false">普通模式</button></header><div class="fairy-quota-row" data-quota-row="primary"><span>5 小时</span><b data-metric="quota-primary">—</b><time>等待更新</time></div><div class="fairy-quota-row" data-quota-row="secondary"><span>1 周</span><b data-metric="quota-secondary">—</b><time>等待更新</time></div><p class="fairy-quota-updated">等待账户额度记录</p></section>`;
  document.head.append(style,widthStyle,dockStyle); document.body.append(overlay);
  const stage = overlay.querySelector('.fairy-stage');
  const caption = overlay.querySelector('.fairy-caption');
  const control = overlay.querySelector('.fairy-control');
  const settings = overlay.querySelector('.fairy-settings');
  const stateLabel = overlay.querySelector('.fairy-state');
  // Shared percentage editor: compact value at rest, slider and exact entry on demand.
  function percentageControl({label,min,max,step=1,value,factor=1,attribute,key}) {
    const host=document.createElement('details');host.className='fairy-percent';
    host.innerHTML=`<summary aria-label="${label}调节"><output>${Math.round(value*factor)}%</output><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="m4.5 6 3.5 3.5L11.5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></summary><div class="fairy-percent-popover"><input type="range" min="${min}" max="${max}" step="${step}" aria-label="${label}" ${attribute}="${key}"><div class="fairy-percent-entry"><input type="number" min="${min*factor}" max="${max*factor}" step="1" aria-label="${label}百分比"><span>%</span></div></div>`;
    const range=host.querySelector('[type=range]'),number=host.querySelector('[type=number]'),output=host.querySelector('output');
    if(key==='scale')output.dataset.eyeValue='scale';
    host.syncPercent=value=>{range.style.setProperty('--fairy-percent-fill',((value-min)/(max-min)*100)+'%');range.value=String(value);number.value=String(Math.round(value*factor));output.textContent=Math.round(value*factor)+'%';};
    const commit=()=>{if(number.value==='')return;const value=Math.max(min,Math.min(max,Number(number.value)/factor));host.syncPercent(value);range.dispatchEvent(new Event('input',{bubbles:true}));};
    number.addEventListener('input',()=>{const value=Number(number.value)/factor;if(number.value!==''&&value>=min&&value<=max){range.value=String(value);output.textContent=Math.round(value*factor)+'%';range.dispatchEvent(new Event('input',{bubbles:true}));}});
    number.addEventListener('change',commit);
    number.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();host.open=false;host.querySelector('summary').focus();}});
    range.addEventListener('input',()=>host.syncPercent(Number(range.value)));
    host.addEventListener('toggle',()=>{if(host.open)for(const other of settings.querySelectorAll('.fairy-percent[open]'))if(other!==host)other.open=false;});
    host.syncPercent(value);return host;
  }
  const scaleControl=percentageControl({label:'眼睛大小',min:70,max:120,value:100,attribute:'data-option',key:'scale'});
  overlay.querySelector('[data-percent-slot="scale"]').replaceWith(scaleControl);

  control.innerHTML='<span class="fairy-hdd-dot" aria-hidden="true"></span><span>H.D.D</span>';
  control.setAttribute('aria-label','H.D.D 设置');
  control.insertAdjacentHTML('afterend','<button class="fairy-day-toggle" type="button" data-action="theme-toggle" aria-label="切换到日间模式" title="切换到日间模式">☀</button>');
  const brand=document.createElement('div');brand.id='fairy-codex-brand';
  // User-provided avatar, embedded so the live watcher and offline preview use the same asset.
  brand.innerHTML=`<span class="fairy-brand-avatar" aria-hidden="true"><img src="data:image/webp;base64,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" alt="" draggable="false"></span><span class="fairy-brand-copy"><strong>Fairy</strong><small>空洞深潜辅助系统</small></span>`;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('fairy-codex-visual-v1') || '{}') || {}; } catch {}
  let motion = true, showEye = saved.eye !== false, lowPower = saved.power === true;
  let theme=saved.theme==='light'?'light':'dark';
  const clamp=(n,min,max,fallback)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
  let eyeScale=clamp(saved.scale,70,120,100), speed=clamp(saved.speed,30,150,70);
  let blink=[0,4,8,12].includes(saved.blink)?saved.blink:8;
  let eyeColor=/^#[0-9a-f]{6}$/i.test(saved.color||'')?saved.color:'#4053f0';
  function save() {try{localStorage.setItem('fairy-codex-visual-v1',JSON.stringify({motion,eye:showEye,power:lowPower,scale:eyeScale,speed,theme,blink,color:eyeColor}));}catch{}}
  overlay.dataset.motion=motion?'on':'off';overlay.dataset.power=lowPower?'low':'normal';
  for(const [key,value] of Object.entries({eye:showEye,power:lowPower})) overlay.querySelector(`[data-option="${key}"]`).checked=value;
  function applyEye(){
    setStyle(overlay,'--fairy-eye-scale',String(eyeScale/100));
    setStyle(overlay,'--fairy-orbit-duration',`${28*70/speed}s`);
    setStyle(overlay,'--fairy-blink-duration',`${blink||8}s`);
    overlay.dataset.blink=blink===0?'off':'on';
    stage.toggleAttribute('data-custom-color',eyeColor.toLowerCase()!=='#4053f0');
    const rgb=[1,3,5].map(i=>parseInt(eyeColor.slice(i,i+2),16));
    const mix=(amount,target)=>`rgb(${rgb.map(v=>Math.round(v*(1-amount)+target*amount)).join(', ')})`;
    for(const [key,value] of Object.entries({color:eyeColor,dark:mix(.5,0),shade:mix(.2,0),light:mix(.55,255),iris:mix(.15,255)}))setStyle(stage,`--fairy-eye-${key}`,value);
    scaleControl.syncPercent(eyeScale);
    overlay.querySelector('[data-option="blink"]').value=String(blink);
    overlay.querySelector('[data-option="color"]').value=eyeColor;
  }
  applyEye();
  overlay.querySelector('[data-option="theme"]').value=theme;
  const workspace=overlay.querySelector('.fairy-workspace'),workspaceMenu=overlay.querySelector('.fairy-workspace-menu');
  function mark(node, attr) {
    if (!node) return;
    if (!marked.has(node)) marked.set(node, new Map());
    const attrs = marked.get(node);
    if (!attrs.has(attr)) attrs.set(attr, node.getAttribute(attr));
    if (!node.hasAttribute(attr)) node.setAttribute(attr, '');
  }
  function clearMarkers() {
    for (const [node, attrs] of marked) for (const [attr, value] of attrs)
      value === null ? node.removeAttribute(attr) : node.setAttribute(attr, value);
    marked.clear();
  }
  function unmark(node, attr) {
    const attrs = marked.get(node);
    if(!attrs?.has(attr)) return;
    const old = attrs.get(attr);
    old === null ? node.removeAttribute(attr) : node.setAttribute(attr,old);
    attrs.delete(attr);if(!attrs.size)marked.delete(node);
  }
  function setStyle(node,property,value) {if(node.style.getPropertyValue(property)!==value)node.style.setProperty(property,value);}
  function rendered(node) {
    // Native modal menus mark the still-visible app aria-hidden; keep its geometry stable.
    if(!node||node.closest('[hidden]'))return false;
    const rect=node.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&(getComputedStyle(node).visibility!=='hidden'||node.hasAttribute('data-fairy-home-copy')||node.hasAttribute('data-fairy-home-logo'));
  }
  let modeNode=null;
  function isCodex() {
    if(options.preview)return true;
    if(!location.href.startsWith('app://'))return false;
    const matches=node=>/^(Codex|ChatGPT)$/i.test(node.textContent.trim());
    if(!modeNode?.isConnected||!matches(modeNode)||!rendered(modeNode)) {
      modeNode=[...document.querySelectorAll('aside.app-shell-left-panel button')].find(node=>matches(node)&&rendered(node))||null;
    }
    return modeNode?/^Codex$/i.test(modeNode.textContent.trim()):/^codex(?:\s|$)/i.test(document.title);
  }
  function mainNode() { return [...document.querySelectorAll('main.main-surface,main[class*="_MainContentSurface_"],main')].find(rendered); }
  let watchedMain=null,watchedComposer=null,watchedScroll=null,watchedPane=null,eyeRect=null,lastUsageSignature=null,missingSince=null;
  const resize = new ResizeObserver(() => schedule());
  let lastDock='',lastModel=null,lastPermission=null,projectTargets=[];
  function setTheme() {
    if(overlay.dataset.theme===theme&&root.getAttribute('data-fairy-theme')===theme)return;
    overlay.dataset.theme=theme;
    nativeTheme?.set(theme);
    const quick=overlay.querySelector('.fairy-day-toggle');
    quick.textContent=theme==='light'?'☾':'☀';quick.setAttribute('aria-label',theme==='light'?'切换到夜间模式':'切换到日间模式');quick.title=quick.getAttribute('aria-label');
    overlay.querySelector('[data-option="theme"]').value=theme;
    if(root.hasAttribute('data-fairy-codex')) {mark(root,'data-fairy-theme');if(root.getAttribute('data-fairy-theme')!==theme)root.setAttribute('data-fairy-theme',theme);}
  }
  function updateMeter() {
    const button=meter.querySelector('button'),text=lowPower?'低功耗模式':'普通模式';if(button.textContent!==text)button.textContent=text;if(button.getAttribute('aria-pressed')!==String(lowPower))button.setAttribute('aria-pressed',String(lowPower));
  }
  function setUsage(data) {
    const quota=data?.quota,now=Date.now();
    const expired=key=>Boolean(quota?.[key]?.resetsAt&&quota[key].resetsAt*1000<=now);
    const signature=JSON.stringify(data)+':'+expired('primary')+':'+expired('secondary');
    if(signature===lastUsageSignature)return;lastUsageSignature=signature;
    const localDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
    const time=value=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value);
    for(const [key,fallback] of [['primary','5 小时'],['secondary','1 周']]) {
      const w=quota?.[key],row=meter.querySelector(`[data-quota-row="${key}"]`);
      const valid=w&&Number.isFinite(w.remaining)&&(!w.resetsAt||w.resetsAt*1000>now);
      row.querySelector('span').textContent=w?.minutes===10080?'1 周':w?.minutes?`${Number((w.minutes/60).toFixed(1))} 小时`:fallback;
      row.querySelector('b').textContent=valid?`${Number(w.remaining.toFixed(1))}%`:'—';
      const reset=row.querySelector('time');
      if(valid&&w.resetsAt) {
        const d=new Date(w.resetsAt*1000),sameDay=localDate(d)===localDate(now);
        const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric'}).format(d);
        reset.textContent=`重置 ${sameDay?'':date+' '}${time(d)}`;reset.dateTime=d.toISOString();
      }else {reset.textContent=valid?'重置时间未知':'等待更新';reset.removeAttribute('datetime');}
    }
    meter.querySelector('.fairy-quota-updated').textContent=quota?`${quota.source==='codex-account-api'?'查询':'记录'} ${time(quota.observedAt)} · 北京时间`:'等待账户额度记录';
    const node=meter.querySelector('[data-metric="tokens"]');
    if(data?.available&&Number.isFinite(data.total)&&data.total>=0) {
      const value=data.total>=1e6?`${(data.total/1e6).toFixed(2)}M`:data.total>=1000?`${(data.total/1000).toFixed(1)}k`:String(data.total);
      if(node.textContent!==value)node.textContent=value;
      node.title=`${data.date} · 本机记录 ${data.total.toLocaleString()} tokens（包含缓存输入）\n${data.files??0} 个会话有用量，${data.partial?'部分文件不可读；':''}不等于服务商账单。\n更新：${data.updatedAt}`;
    }else {node.textContent='—';node.title='暂时无法读取本机 Token 记录';}
  }
  function dockControls(composer,box,bounds) {
    const compact=bounds.width<500;
    const reserve=bounds.width>=760?230:180;
    const desiredWidth=bounds.width>=300?bounds.width-(compact?24:reserve):null;
    const shift=compact?0:(reserve-50)/2;
    const composerStyle=composer?getComputedStyle(composer):null;
    const centeredAbsolute=composerStyle?.position==='absolute'&&composerStyle.transform!=='none';
    // Native composers sit in a capped message column whose center can differ
    // from the chat pane when source/browser panels open. Align in pane space.
    let offset=centeredAbsolute?0:(parseFloat(composerStyle?.left)||0);
    const sizing=left=>desiredWidth?`html[data-fairy-codex] [data-fairy-composer]{width:${desiredWidth}px!important;max-width:${desiredWidth}px!important;flex-shrink:0!important;margin-left:${centeredAbsolute?shift:0}px!important;margin-right:0px!important;${centeredAbsolute?'':`position:relative!important;left:${left}px!important;`}${compact?'padding-top:38px!important;':''}}`:'';
    let widthCss=sizing(offset);
    if(widthStyle.textContent!==widthCss)widthStyle.textContent=widthCss;
    box=composer?.getBoundingClientRect();
    if(box&&desiredWidth&&!centeredAbsolute) {
      const target=bounds.left+(compact?12:reserve-25);
      const next=offset+target-box.left;
      if(Math.abs(next-offset)>.1) {
        offset=next;widthCss=sizing(offset);
        if(widthStyle.textContent!==widthCss)widthStyle.textContent=widthCss;
        box=composer.getBoundingClientRect();
      }
    }
    const room=box?box.left-bounds.left:0;
    const enabled=box&&desiredWidth&&(compact||room>=120)&&box.height<bounds.height*.7;
    const consoleMode=enabled;
    for(const node of marked.keys())if(node.hasAttribute('data-fairy-console')&&(node!==composer||!consoleMode))unmark(node,'data-fairy-console');
    if(consoleMode)mark(composer,'data-fairy-console');
    overlay.dataset.console=String(Boolean(consoleMode));
    const model=composer?.querySelector('[data-codex-intelligence-trigger],[data-composer-navigation-target="reasoning"]');
    const permission=composer?.querySelector('[data-composer-navigation-target="permissions"],button[aria-label="更改权限"]');
    for(const [attr,node] of [['data-fairy-native-model',enabled?model:null],['data-fairy-native-permission',enabled?permission:null]]) {
      for(const old of marked.keys())if(old.hasAttribute(attr)&&old!==node)unmark(old,attr);
      if(node)mark(node,attr);
    }
    workspace.hidden=!enabled;
    if(!enabled){dockStyle.textContent='';lastDock='';return box;}
    const width=compact?(bounds.width-32)/3:Math.min(180,room-20);
    const x=compact?bounds.left+12:bounds.left+(room-width)/2;
    const y=compact?box.top+2:box.top+(box.height-102)/2;
    const uiFont=getComputedStyle(document.querySelector('aside [data-app-action-sidebar-project-label]')||document.body).fontSize;
    setStyle(overlay,'--fairy-ui-font',uiFont);
    setStyle(root,'--fairy-ui-font',uiFont);
    setStyle(overlay,'--fairy-console-top',box.top+'px');
    setStyle(overlay,'--fairy-dock-left',`${x}px`);setStyle(overlay,'--fairy-dock-top',`${y}px`);setStyle(overlay,'--fairy-dock-width',`${width}px`);
    const signature=[compact,x,y,width,bounds.left,bounds.right,box.left,box.right].join(':');
    if(signature!==lastDock||model!==lastModel||permission!==lastPermission) {
      const selectors=['data-fairy-native-model','data-fairy-native-permission'];
      const base=selectors.map(a=>`html[data-fairy-codex] [${a}]{position:fixed!important;left:0!important;top:0!important;width:${width}px!important;height:34px!important;min-height:34px!important;max-height:34px!important;z-index:45!important;margin:0!important;}`).join('')+`html[data-fairy-codex] [data-fairy-console]::before{left:${bounds.left-box.left}px!important;right:${box.right-bounds.right}px!important;}`;
      dockStyle.textContent=base;
      const offsets=[model,permission].map((n,i)=>n?(()=>{const r=n.getBoundingClientRect();return `html[data-fairy-codex] [${selectors[i]}]{left:${x+(compact?(width+4)*(i+1):0)-r.x}px!important;top:${y+(compact?0:34*(i+1))-r.y}px!important;}`;})():'');
      dockStyle.textContent=base+offsets.join('');lastDock=signature;lastModel=model;lastPermission=permission;
    }
    return box;
  }
  function refresh() {
    if (disposed) return;
    for(const [node,attrs] of marked)if(!node.isConnected) {
      for(const [attr,value] of attrs)value===null?node.removeAttribute(attr):node.setAttribute(attr,value);
      marked.delete(node);
    }
    const main = mainNode();
    for(const node of marked.keys())if(node.hasAttribute('data-fairy-main')&&node!==main)unmark(node,'data-fairy-main');
    const sidebar = document.querySelector('aside.app-shell-left-panel');
    const codexMode=!disabled&&isCodex();
    // React can leave a short gap between old and new route containers. Keep the
    // existing skin mounted through that gap instead of flashing the native theme.
    if(codexMode&&(!main||!sidebar)) {
      missingSince??=performance.now();
      if(performance.now()-missingSince<200){schedule();return;}
    }else missingSince=null;
    if(!codexMode||!main||!sidebar) {
      resize.disconnect();watchedMain=null;watchedComposer=null;watchedScroll=null;watchedPane=null;
      lastDock='';lastModel=null;lastPermission=null;
      clearMarkers();overlay.hidden=true;meter.remove();brand.remove();return;
    }
    overlay.hidden = false;
    mark(root, 'data-fairy-codex'); mark(main, 'data-fairy-main');
    setTheme();
    const composer = [...main.querySelectorAll('.composer-surface-chrome,[class*="_ComposerLayoutRoot_"]')].find(rendered);
    for(const node of marked.keys()) if(node.hasAttribute('data-fairy-composer') && node!==composer) unmark(node,'data-fairy-composer');
    if (composer) mark(composer, 'data-fairy-composer');
    // A browser/review panel shares the outer main surface. Anchor only to the
    // conversation focus area, never the combined workspace or the composer width.
    const scroll=[...main.querySelectorAll('.thread-scroll-container')].find(rendered);
    const pane=(scroll||composer)?.closest('[data-app-shell-focus-area="main"]')||[...main.querySelectorAll('[data-app-shell-focus-area="main"]')].find(rendered)||main;
    if(main!==watchedMain||composer!==watchedComposer||pane!==watchedPane) {resize.disconnect();resize.observe(main);if(composer)resize.observe(composer);if(pane!==main)resize.observe(pane);watchedMain=main;watchedComposer=composer;watchedPane=pane;}
    const mainBounds=main.getBoundingClientRect(),paneBounds=pane.getBoundingClientRect();
    const left=Math.max(mainBounds.left,paneBounds.left),right=Math.min(mainBounds.right,paneBounds.right);
    const bounds={left,right,top:mainBounds.top,bottom:mainBounds.bottom,width:Math.max(0,right-left),height:mainBounds.height};
    setStyle(overlay,'--fairy-pane-right',Math.max(0,innerWidth-right)+'px');setStyle(overlay,'--fairy-pane-width',bounds.width+'px');
    const composerRect = dockControls(composer,composer?.getBoundingClientRect(),bounds);
    // Use message anchors rather than full text reads. Never inspect chat contents.
    watchedScroll=scroll||null;
    const hasMessages=!!scroll||[...main.querySelectorAll('article,[data-message-author-role],[data-testid*="conversation-turn"],[data-turn-id],[data-fairy-preview-message]')].some(rendered);
    const homeSignals = [...main.querySelectorAll('[data-feature="game-source"],[class~="group/home-suggestions"]')].some(rendered);
    const homeRoute = homeSignals || /^(?:\/|\/threads\/new|\/thread\/new|\/new|\/index.html)$/.test(location.pathname) || options.preview;
    const task = hasMessages || !homeRoute;
    for(const node of main.querySelectorAll('[data-fairy-home-copy]')) {
      if(task)unmark(node,'data-fairy-home-copy');
    }
    if(!task) for(const node of main.querySelectorAll('h1,[data-feature="game-source"]')) mark(node,'data-fairy-home-copy');
    // Hide only standalone decorative home icons, preserving all native control icons.
    for(const node of marked.keys())if(node.hasAttribute('data-fairy-home-logo')&&(task||!main.contains(node)))unmark(node,'data-fairy-home-logo');
    if(!task)for(const svg of main.querySelectorAll('svg')) {
      if(svg.closest('button,a,form,nav,header,[role="button"],[role="menu"],[data-fairy-composer],[class~="group/home-suggestions"]'))continue;
      const r=svg.getBoundingClientRect();
      if(r.width>=24&&r.width<=160&&r.height>=24&&r.height<=160&&r.top>=bounds.top+40&&r.bottom<(composerRect?.top||bounds.bottom))mark(svg,'data-fairy-home-logo');
    }
    overlay.dataset.layout = task ? 'task' : 'home';
    const x = bounds.left + bounds.width / 2;
    const available = Math.min(bounds.bottom, composerRect?.top || bounds.bottom - 100) - bounds.top;
    const y = task ? bounds.top + (innerHeight<=700?130:178) : bounds.top + Math.max(90, available * .36);
    setStyle(overlay,'--fairy-x', `${x}px`); setStyle(overlay,'--fairy-y', `${y}px`);
    const visible = showEye && (task ? bounds.width >= 700 && bounds.height >= 520 : bounds.width >= 400 && available >= 300);
    stage.hidden = !visible; caption.hidden = !visible || task;eyeRect=null;

    for(const node of marked.keys()) if(node.hasAttribute('data-fairy-thread-scroll') && (node!==scroll||!visible||!task)) unmark(node,'data-fairy-thread-scroll');
    for(const node of marked.keys()) if(node.hasAttribute('data-fairy-thread-layout') && (node!==scroll?.parentElement||!visible||!task)) unmark(node,'data-fairy-thread-layout');
    if(scroll && task && visible) {mark(scroll,'data-fairy-thread-scroll');mark(scroll.parentElement,'data-fairy-thread-layout');}
    const history = [...sidebar.querySelectorAll('[data-app-action-sidebar-scroll], [role="tree"]')].find(rendered);
    for(const node of marked.keys()) if(node.hasAttribute('data-fairy-history') && node!==history) unmark(node,'data-fairy-history');
    if(history) mark(history,'data-fairy-history');
    const sidebarNav=[...sidebar.querySelectorAll('[role="navigation"]')].find(rendered);
    if(sidebarNav&&meter.parentElement!==sidebarNav)sidebarNav.append(meter);
    updateMeter();
    const sidebarHeader=sidebarNav?[...sidebarNav.children].find(n=>rendered(n)&&String(n.className).includes('_header_')):null;
    if(sidebarHeader&&brand.parentElement!==sidebarHeader)sidebarHeader.prepend(brand);
    const newChat=sidebarHeader?[...sidebarHeader.querySelectorAll('[data-codex-tab-conversation-drop-target] > button')].find(rendered):null;
    for(const [attr,target] of [['data-fairy-sidebar-nav',sidebarNav],['data-fairy-sidebar-header',sidebarHeader],['data-fairy-new-chat',newChat]]) {
      for(const node of marked.keys()) if(node.hasAttribute(attr)&&node!==target) unmark(node,attr);
      if(target) mark(target,attr);
    }
    const busy = [...main.querySelectorAll('button[aria-label*="Stop"],button[aria-label*="停止"],[data-testid="stop-button"]')].some(rendered);
    overlay.dataset.busy = String(busy);
    const label = busy ? 'FAIRY // PROCESSING' : 'FAIRY // STANDBY';
    if (stateLabel.textContent !== label) stateLabel.textContent = label;
  }
  function schedule() {
    if(disposed||timer)return;
    timer=requestAnimationFrame(()=>{timer=0;refresh();});
  }
  const structureSelector='main,.composer-surface-chrome,[class*="_ComposerLayoutRoot_"],.thread-scroll-container,[role="navigation"],[role="tree"],[data-app-action-sidebar-scroll],[data-codex-intelligence-trigger],[data-composer-navigation-target="reasoning"],[data-composer-navigation-target="permissions"],button[aria-label="更改权限"],[data-testid="stop-button"]';
  function affectsLayout(record) {
    const target=record.target.nodeType===1?record.target:record.target.parentElement;
    if(!target||target.closest('#fairy-codex-overlay,#fairy-codex-meter,#fairy-codex-brand')||target===style||target===dockStyle||target===widthStyle)return false;
    if(record.type==='attributes') {
      if(record.attributeName==='hidden'||target.matches(structureSelector))return true;
      if(record.attributeName==='aria-label'||record.attributeName==='data-testid')return target===modeNode||!!watchedComposer?.contains(target)||/Stop|停止/.test(target.getAttribute('aria-label')||'');
      return target===watchedMain||target===watchedComposer||target===watchedPane||target===watchedScroll||target===watchedScroll?.parentElement||
        !!(watchedMain&&target.contains(watchedMain))||!!(watchedComposer&&target.contains(watchedComposer))||target===modeNode;
    }
    if(target===modeNode||modeNode?.contains(target))return true;
    if(target.closest('aside.app-shell-left-panel')&&target.matches('aside,[role="navigation"],[data-fairy-sidebar-header]'))return true;
    if((watchedMain&&target.contains(watchedMain))||(watchedComposer&&target.contains(watchedComposer))||target===watchedScroll)return true;
    for(const nodes of [record.addedNodes,record.removedNodes])for(const node of nodes)
      if(node.nodeType===1&&(node.matches(structureSelector)||node.querySelector(structureSelector)))return true;
    return false;
  }
  const observer=new MutationObserver(records=>{if(records.some(affectsLayout))schedule();});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-label','data-testid','hidden','class','style']});
  function onMove(event) {
    if (!motion || lowPower || matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden || overlay.hidden || stage.hidden || raf) return;
    const x = event.clientX, y = event.clientY;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const rect=eyeRect||(eyeRect=stage.getBoundingClientRect());
      stage.style.setProperty('--fairy-look-x', `${Math.max(-5, Math.min(5, (x-rect.left-rect.width/2)/70))}px`);
      stage.style.setProperty('--fairy-look-y', `${Math.max(-4, Math.min(4, (y-rect.top-rect.height/2)/90))}px`);
    });
  }
  function onSleep() {if(document.hidden)mark(root,'data-fairy-sleep');else {root.removeAttribute('data-fairy-sleep');schedule();}}
  function onKey(e) { if(e.key === 'Escape') {const percent=settings.querySelector('.fairy-percent[open]');if(percent){percent.open=false;percent.querySelector('summary').focus();return;}if(!workspaceMenu.hidden){workspaceMenu.hidden=true;workspace.setAttribute('aria-expanded','false');workspace.focus();}else if(!settings.hidden){settings.hidden = true;control.setAttribute('aria-expanded','false');control.focus();}} }
  function showWorkspaces() {
    const sidebar=document.querySelector('aside.app-shell-left-panel');
    projectTargets=[...sidebar?.querySelectorAll('[data-app-action-sidebar-select-project]')||[]].filter(rendered);
    const list=workspaceMenu.querySelector('.fairy-project-list');list.replaceChildren();
    projectTargets.forEach((node,index)=>{const b=document.createElement('button');b.type='button';b.dataset.projectIndex=String(index);b.textContent=node.closest('[data-app-action-sidebar-project-label]')?.getAttribute('data-app-action-sidebar-project-label')||node.textContent.trim()||'工作区';list.append(b);});
    if(!projectTargets.length){const p=document.createElement('p');p.textContent='暂无已添加项目，可用下方按钮添加。';list.append(p);}
    workspaceMenu.hidden=false;workspace.setAttribute('aria-expanded','true');
  }
  function onOutsidePointer(e) {
    const path=e.composedPath();
    for(const percent of settings.querySelectorAll('.fairy-percent[open]'))if(!path.includes(percent))percent.open=false;
    if(!settings.hidden&&!path.includes(settings)&&!path.includes(control)) {settings.hidden=true;control.setAttribute('aria-expanded','false');}
    if(!workspaceMenu.hidden&&!path.includes(workspaceMenu)&&!path.includes(workspace)) {workspaceMenu.hidden=true;workspace.setAttribute('aria-expanded','false');}
  }
  function onClick(e) {
    if(e.target.closest('.fairy-control')===control) {settings.hidden = !settings.hidden; control.setAttribute('aria-expanded',String(!settings.hidden));}
    if(e.target.closest('[data-action="theme-toggle"]')) {theme=theme==='light'?'dark':'light';setTheme();save();}
    if(e.target.closest('[data-action="restore"]')) dispose();
    if(e.target.closest('[data-action="reset-eye"]')) {eyeScale=100;blink=8;eyeColor='#4053f0';applyEye();eyeRect=null;save();}
    if(e.target.closest('[data-action="workspace"]')) {if(workspaceMenu.hidden)showWorkspaces();else{workspaceMenu.hidden=true;workspace.setAttribute('aria-expanded','false');}}
    if(e.target.closest('[data-project-index]')) {const node=projectTargets[Number(e.target.closest('[data-project-index]').dataset.projectIndex)];if(node?.isConnected)node.click();workspaceMenu.hidden=true;workspace.setAttribute('aria-expanded','false');}
    if(e.target.closest('[data-action="add-project"]')) {document.querySelector('aside [data-app-action-sidebar-project-create]')?.click();workspaceMenu.hidden=true;workspace.setAttribute('aria-expanded','false');}
    if(e.target.closest('[data-action="power"]')) {lowPower=!lowPower;overlay.dataset.power=lowPower?'low':'normal';overlay.querySelector('[data-option="power"]').checked=lowPower;updateMeter();refresh();save();}
  }
  function onChange(e) {
    if(e.target.dataset.option === 'motion') {
      motion = e.target.checked; overlay.dataset.motion = motion ? 'on':'off';
      if(!motion) {stage.style.removeProperty('--fairy-look-x');stage.style.removeProperty('--fairy-look-y');}
    }
    if(e.target.dataset.option === 'eye') {showEye = e.target.checked;refresh();}
    if(e.target.dataset.option === 'power') {lowPower=e.target.checked;overlay.dataset.power=lowPower?'low':'normal';refresh();}
    if(e.target.dataset.option === 'theme') {theme=e.target.value==='light'?'light':'dark';setTheme();}
    if(e.target.dataset.option==='blink') {blink=[0,4,8,12].includes(Number(e.target.value))?Number(e.target.value):8;applyEye();}
    save();
  }
  function onInput(e) {
    if(e.target.dataset.option==='color'&&/^#[0-9a-f]{6}$/i.test(e.target.value)) {eyeColor=e.target.value;applyEye();}
    if(e.target.dataset.option === 'scale') {eyeScale=clamp(Number(e.target.value),70,120,100);applyEye();eyeRect=null;}
    if(e.target.dataset.option === 'speed') {speed=clamp(Number(e.target.value),30,150,70);setStyle(overlay,'--fairy-orbit-duration',`${28*70/speed}s`);}
    save();
  }
  function dispose({reapply=false}={}) {
    if(disposed) return; if(!reapply)nativeTheme?.restore(); window.__FAIRY_VOICE__?.dispose(); disposed = true; disabled = true;
    observer.disconnect();resize.disconnect();cancelAnimationFrame(timer);cancelAnimationFrame(raf);
    window.removeEventListener('resize',schedule);window.removeEventListener('popstate',schedule);
    document.removeEventListener('pointermove',onMove);document.removeEventListener('visibilitychange',onSleep);
    document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onOutsidePointer,true);
    overlay.removeEventListener('click',onClick);overlay.removeEventListener('change',onChange);
    overlay.removeEventListener('input',onInput);
    meter.removeEventListener('click',onClick);root.style.removeProperty('--fairy-ui-font');clearMarkers();style.remove();dockStyle.remove();widthStyle.remove();overlay.remove();meter.remove();brand.remove();
    window[KEY] = {version:'1.3.0',disabled:true,dispose(){},status(){return {enabled:false,disabled:true};}};
  }
  window.addEventListener('resize',schedule);window.addEventListener('popstate',schedule);
  document.addEventListener('pointermove',onMove,{passive:true});document.addEventListener('visibilitychange',onSleep);
  document.addEventListener('pointerdown',onOutsidePointer,true);
  document.addEventListener('keydown',onKey);overlay.addEventListener('click',onClick);overlay.addEventListener('change',onChange);
  overlay.addEventListener('input',onInput);
  meter.addEventListener('click',onClick);
  window[KEY] = {version:'1.3.0',dispose,setUsage,percentageControl,status(){return {enabled:!disposed&&!overlay.hidden,version:'1.3.0',layout:overlay.dataset.layout,busy:overlay.dataset.busy==='true',lowPower,theme};}};
  refresh();onSleep();
  return window[KEY].status();
})
