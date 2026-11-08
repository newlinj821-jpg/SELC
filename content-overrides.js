/* Approved editorial copy only. No HTML interpretation or dynamic code execution. */
(()=>{'use strict';
 const current=document.currentScript,site=current?.dataset?.site;
 if(!['hub','portal','selc'].includes(site))return;
 const skip='script,style,noscript,svg,iframe,pre,code,[data-content-editor-ignore]';
 const origin='https://sanctumportal.org/.netlify/functions/selc-content';
 const path=location.pathname||'/';
 const endpoint=origin+'?scope=published&site='+encodeURIComponent(site)+'&path='+encodeURIComponent(path);
 const norm=s=>String(s||'').trim();
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
