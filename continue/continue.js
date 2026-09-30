'use strict';
const API='https://backend-production-2b40.up.railway.app',REPO='FutureWarren/recruiting-agent';
const token=new URLSearchParams(location.search).get('token')||'';
const $=id=>document.getElementById(id);
function os(){const ua=navigator.userAgent||'',p=navigator.userAgentData?.platform||'';if(/Android|iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&(navigator.maxTouchPoints||0)>1))return'mobile';if(/windows/i.test(p)||/Windows|Win64|Win32|WOW64/i.test(ua))return'win';if(/macos|mac os/i.test(p)||/Macintosh|Mac OS X/i.test(ua))return'mac';return'other'}
async function post(path,body){const r=await fetch(API+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Orbit could not open this handoff.');return j}
async function latestAsset(platform){const r=await fetch('https://api.github.com/repos/'+REPO+'/releases/latest');if(!r.ok)throw Error('Release unavailable');const rel=await r.json(),assets=rel.assets||[];if(platform==='mac')return assets.find(a=>/arm64.*\.dmg$/i.test(a.name||''));if(platform==='win')return assets.find(a=>/(x64.*setup|setup.*x64).*\.exe$/i.test(a.name||'')||/Orbit-.*-x64-Setup\.exe$/i.test(a.name||''));return null}
async function init(){
 if(!/^[A-Za-z0-9_-]{32,120}$/.test(token)){ $('title').textContent='This handoff link is incomplete.';$('lede').textContent='Open the newest link Orbit sent you, or set up Orbit again from your phone.';return}
 try{
  const lead=await post('/api/handoff/resolve',{token});void post('/api/handoff/event',{stage:'desktop_link_opened',token}).catch(()=>{});
  $('goal').textContent=lead.goal;$('detail').textContent=lead.detail||'';$('receipt').hidden=false;$('actions').hidden=false;
  $('title').textContent='Your Orbit is ready.';$('lede').textContent='You already told us what you’re recruiting for. Continue from here — no retyping.';
  const platform=os(),download=$('download-orbit'),open=$('open-orbit'),status=$('status');
  open.onclick=()=>{void post('/api/handoff/event',{stage:'desktop_app_opened',token,metadata:{attempt:'protocol'}}).catch(()=>{});status.textContent='Opening Orbit… If nothing happens, install it below and come back to this page.';location.href='orbit://handoff?token='+encodeURIComponent(token)};
  if(platform==='mobile'){download.setAttribute('aria-disabled','true');download.querySelector('span').textContent='Open this page on your computer';open.disabled=true;status.textContent='This continuation step needs your computer. Keep this email or copy the link below.';return}
  try{
   const asset=await latestAsset(platform);
   if(asset?.browser_download_url){download.href=asset.browser_download_url;download.querySelector('span').textContent=platform==='mac'?'Download for Mac':'Download for Windows';download.onclick=()=>{void post('/api/handoff/event',{stage:'download_clicked',token,metadata:{platform}}).catch(()=>{})};status.textContent='Already installed? Choose Open Orbit. Otherwise install it once, then return here.'}
   else{download.setAttribute('aria-disabled','true');download.querySelector('span').textContent=platform==='win'?'Windows build is not live yet':'Installer unavailable for this computer';status.textContent=platform==='win'?'Your setup is saved. The signed Windows installer is not live on the latest release yet.':'Orbit currently supports Apple Silicon Mac; other builds will appear here when released.'}
  }catch(_){download.href='https://github.com/'+REPO+'/releases/latest';download.querySelector('span').textContent='View latest downloads';status.textContent='Already installed? Choose Open Orbit.'}
 }catch(err){$('title').textContent='We couldn’t open this handoff.';$('lede').textContent=err.message||'The link may be old. Set up Orbit again from your phone.'}
}
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('copy-link').textContent='Copied ✓'}catch(_){$('copy-link').textContent='Copy from the address bar'}};
void init();