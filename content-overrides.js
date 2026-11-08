/* Approved editorial copy only. No HTML interpretation or dynamic code execution. */
(()=>{'use strict';
 const current=document.currentScript,site=current?.dataset?.site;
 if(!['hub','portal','selc'].includes(site))return;
 const skip='script,style,noscript,svg,iframe,pre,code,[data-content-editor-ignore]';
 const origin='https://sanctumportal.org/.netlify/functions/selc-content';
 const path=location.pathname||'/';
 const endpoint=origin+'?scope=published&site='+encodeURIComponent(site)+'&path='+encodeURIComponent(path);
 const norm=s=>String(s||'').trim();

 // Visual selection is opt-in and transmits only the text the editor clicks.
 // No tokens, fields, page HTML, private records, or automatic page scraping.
 if(new URLSearchParams(location.search).get('selc_pick')==='1'&&window.opener){
  const header=document.createElement('div');
  header.id='selc-copy-picker-banner';
  header.textContent='SELC text picker · Tap a heading, sentence or button to propose an edit. Esc to cancel.';
  header.style.cssText='position:fixed;inset:0 0 auto;z-index:2147483647;padding:12px 18px;background:#a92e48;color:white;font:700 13px/1.45 system-ui;text-align:center;box-shadow:0 3px 16px #0008';
  const style=document.createElement('style');
  style.textContent='.selc-copy-picker-target{outline:2px solid #ed536b!important;outline-offset:3px!important;cursor:crosshair!important}';
  document.head.append(style);
  document.body.append(header);
  let highlighted=null;
  const candidate=node=>{
   const el=node?.closest?.('main h1,main h2,main h3,main h4,main p,main li,main button,main a,main label,main summary,main span,main small,main strong,main em,nav a,header a,footer a');
   return el?.closest('input,textarea,select,[contenteditable],script,style,#selc-copy-picker-banner')?null:el;
  };
  document.addEventListener('pointerover',e=>{
   const target=candidate(e.target);
   if(highlighted&&highlighted!==target)highlighted.classList.remove('selc-copy-picker-target');
   highlighted=target;
   highlighted?.classList.add('selc-copy-picker-target');
  },true);
  document.addEventListener('click',e=>{
   const target=candidate(e.target);
   if(!target)return;
   const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);
   let selected='';
   while(walker.nextNode()){
    const node=walker.currentNode;
    if(!node.parentElement?.closest('script,style,noscript,[data-content-editor-ignore]')&&norm(node.nodeValue)){
     selected=norm(node.nodeValue);
     break;
    }
   }
   if(!selected)return;
   e.preventDefault();e.stopImmediatePropagation();
   window.opener.postMessage({type:'SELC_COPY_PICK',site,path,text:selected.slice(0,2000)},'https://se-selc.netlify.app');
   header.textContent='Selected text sent to SELC. Return to your editor tab.';
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const u=new URL(location.href);u.searchParams.delete('selc_pick');location.replace(u.toString())}});
 }

 let edits=[],running=false,queued=false;
 function apply(){
  if(running||!edits.length)return;
  running=true;
  try{
   const root=document.body;if(!root)return;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
     if(!norm(node.nodeValue)||node.parentElement?.closest(skip))return NodeFilter.FILTER_REJECT;
     return NodeFilter.FILTER_ACCEPT
    }
   });
   const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
   for(const change of edits){
    const matches=nodes.filter(n=>norm(n.nodeValue)===change.original);
    const selected=change.occurrence>0?[matches[change.occurrence-1]].filter(Boolean):matches;
    for(const node of selected){
     const before=node.nodeValue,lead=before.match(/^\s*/)?.[0]||'',trail=before.match(/\s*$/)?.[0]||'';
     node.nodeValue=lead+change.replacement+trail;
    }
    const attrNodes=root.querySelectorAll('[placeholder],[title],[aria-label],[alt],input[type="button"],input[type="submit"]');
    let count=0;
    for(const element of attrNodes){
     if(element.closest(skip))continue;
     for(const attr of ['placeholder','title','aria-label','alt',...(element.matches('input[type="button"],input[type="submit"]')?['value']:[])]){
      if(norm(element.getAttribute(attr))!==change.original)continue;
      count++;
      if(change.occurrence===0||count===change.occurrence)element.setAttribute(attr,change.replacement);
     }
    }
   }
  }finally{running=false}
 }
 function queue(){if(queued||running)return;queued=true;setTimeout(()=>{queued=false;apply()},280)}
 fetch(endpoint,{cache:'no-store',credentials:'omit'})
  .then(r=>r.ok?r.json():null)
  .then(data=>{
   edits=(data?.overrides||[]).filter(x=>typeof x.original==='string'&&typeof x.replacement==='string'&&x.original!==x.replacement&&x.original.length<2100&&x.replacement.length<2100)
      .map(x=>({original:norm(x.original),replacement:x.replacement,occurrence:Number(x.occurrence)||0}));
   if(!edits.length)return;
   apply();
   new MutationObserver(queue).observe(document.body,{subtree:true,childList:true,characterData:true});
  }).catch(()=>{}); // Public pages remain usable if the optional editorial service is offline.
})();
