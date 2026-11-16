'use strict';
// One-time style analysis. Photo bytes are only sent after explicit consent.
// The website never invents match scores: all scores must come from a real server response.
const API = 'https://backend-production-2b40.up.railway.app';
const $ = id => document.getElementById(id);
const archetypes = [
  {id:'wall-street',title:'Wall Street',subtitle:'Tailored & polished'},
  {id:'consulting',title:'Consulting',subtitle:'Composed & approachable'},
  {id:'tech',title:'Tech',subtitle:'Relaxed & minimal'},
  {id:'founder',title:'Founder',subtitle:'Expressive & individual'},
  {id:'client-facing',title:'Client-facing',subtitle:'Warm & personable'}
];
const MAX_BYTES = 5 * 1024 * 1024;
let photo = null, analysisPhoto = null, previewUrl = null, stream = null, report = null, controller = null;
let imageDetectorPromise = null, serverReady = false;
const networkingBridge = window.OrbitNetworkingBridge;
const networkingVariant = networkingBridge?.variant('face-match') || 'a';
let selectedNetworkingIndustry = '';
function error(message){$('error').textContent=message;$('error').hidden=!message;}
function enable(){ $('analyze').disabled = !(photo && $('consent').checked && serverReady); }
async function detector(){
  if(!imageDetectorPromise) imageDetectorPromise=(async()=>{
    const mp=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/vision_bundle.mjs');
    const vision=await mp.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm');
    return mp.FaceDetector.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'},runningMode:'IMAGE',minDetectionConfidence:0.5});
  })().catch(()=>null);
  return imageDetectorPromise;
}
async function checkSingleFace(blob){
  const model=await detector();if(!model) return {ok:true,box:null,warning:'On-device photo framing check unavailable; photo will still be analyzed.'};
  const bitmap=await createImageBitmap(blob);
  try{const faces=model.detect(bitmap).detections||[];
    if(faces.length!==1)return {ok:false,message:faces.length===0?'We could not find one clear face. Try a brighter, front-facing photo.':'Please use a solo photo with just one face.'};
    const b=faces[0].boundingBox;if(b&&Math.min(b.width,b.height)<65)return {ok:false,message:'Please choose a closer photo with a larger, clearer face.'};
    return {ok:true,box:b||null};
  }finally{bitmap.close();}
}
async function initialize(){
  try{const response=await fetch(API+'/api/face-match/config',{cache:'no-store'});const data=await response.json();serverReady=response.ok&&data.ready===true;}
  catch{serverReady=false;}
  if(!serverReady){$('camera-note').textContent='Face Match analysis is not yet enabled. You can preview the interface, but scoring is temporarily unavailable.';}
  enable();
}
// Capture lifecycle is isolated from the rest of Face Match onboarding.
let cameraToken=0,cameraFacing='user',cameraScrollY=0,cameraReturnFocus=null;
let capturedBlob=null,capturedObjectUrl=null;
function clearCapturedPreview(){
  if(capturedObjectUrl){URL.revokeObjectURL(capturedObjectUrl);capturedObjectUrl=null;}
  capturedBlob=null;
  $('camera-captured-preview').removeAttribute('src');
  $('camera-captured-preview').hidden=true;
}
function stopCamera(){
  cameraToken++;
  if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}
  const video=$('camera');
  video.pause();video.srcObject=null;
  video.classList.remove('is-mirrored');video.hidden=false;
  clearCapturedPreview();
  $('camera-modal').hidden=true;
  $('camera-controls').hidden=false;
  $('camera-review-actions').hidden=true;
  $('snap').disabled=true;
  $('flip-camera').disabled=true;
  if(document.body.classList.contains('fm-camera-open')){
    document.body.classList.remove('fm-camera-open');
    document.body.style.top='';
    window.scrollTo(0,cameraScrollY);
  }
  if(cameraReturnFocus?.isConnected){
    try{cameraReturnFocus.focus({preventScroll:true})}catch{cameraReturnFocus.focus()}
  }
  cameraReturnFocus=null;
}
function clearPhoto(){stopCamera();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}photo=null;analysisPhoto=null;$('photo-preview').hidden=true;$('photo-placeholder').hidden=false;$('photo-input').value='';enable();}

/**
 * Preserve the original photo for previews and sharing, but provide Qwen a
 * face-centered crop for this expression-only fictional aesthetic quiz.
 * Bounding boxes are geometric framing signals, not identity or beauty metrics.
 */
async function cropForVisualStyle(blob,box){
  if(!box||![box.originX,box.originY,box.width,box.height].every(Number.isFinite)||
    box.width<65||box.height<65)return blob;
  let bitmap;
  try{
    bitmap=await createImageBitmap(blob);
    const iw=bitmap.width,ih=bitmap.height;
    const width=Math.min(iw,Math.max(1,box.width*1.5));
    const height=Math.min(ih,Math.max(1,box.height*1.36));
    const x=Math.max(0,Math.min(iw-width,box.originX+box.width/2-width/2));
    const y=Math.max(0,Math.min(ih-height,box.originY-box.height*.2));
    const canvas=document.createElement('canvas');
    canvas.width=Math.min(1024,Math.max(1,Math.round(width)));
    canvas.height=Math.min(1024,Math.max(1,Math.round(height)));
    canvas.getContext('2d').drawImage(bitmap,x,y,width,height,0,0,canvas.width,canvas.height);
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82))||blob;
  }catch{return blob;}
  finally{bitmap?.close();}
}

async function usePhoto(file) {
  error('');
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type)){error('Please select a JPEG, PNG or WebP image.');return false;}
  if(file.size<100 || file.size>MAX_BYTES){error('Choose a photo smaller than 5 MB.');return false;}
  // Downsample locally before any upload; avoids shipping huge original images.
  try {
    const bitmap=await createImageBitmap(file);
    const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
    if(!blob) throw new Error('Image conversion failed.');
    const checked=await checkSingleFace(blob);
    if(!checked.ok){error(checked.message);return false;}
    const faceOnly=await cropForVisualStyle(blob,checked.box);
    clearPhoto();photo=blob;analysisPhoto=faceOnly;previewUrl=URL.createObjectURL(blob);
    if(checked.warning)$('camera-note').textContent=checked.warning;
    $('photo-preview').src=previewUrl;$('photo-preview').hidden=false;$('photo-placeholder').hidden=true;enable();
    return true;
  } catch {error('Could not read that photo. Try a different image.');return false;}
}
$('photo-input').addEventListener('change',event=>{if(event.target.files?.[0])usePhoto(event.target.files[0]);});
$('consent').addEventListener('change',enable);
function setCameraStatus(message){
  const node=$('camera-status');
  node.textContent=message;node.hidden=!message;
}
function enterCamera(){
  if(!$('camera-modal').hidden)return;
  cameraScrollY=window.scrollY;
  cameraReturnFocus=document.activeElement;
  document.body.style.top=(-cameraScrollY)+'px';
  document.body.classList.add('fm-camera-open');
  $('camera-modal').hidden=false;
  $('camera-controls').hidden=false;
  $('camera-review-actions').hidden=true;
  $('camera-captured-preview').hidden=true;
  $('camera-hint').textContent='Frame your face. The front preview mirrors like a selfie.';
  $('camera-modal').focus({preventScroll:true});
}
async function startCamera(facing){
  const token=++cameraToken;
  $('snap').disabled=true;
  $('flip-camera').disabled=true;
  setCameraStatus('Opening '+(facing==='user'?'front':'rear')+' camera…');
  try{
    const next=await navigator.mediaDevices.getUserMedia({
      audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:1280}}
    });
    if(token!==cameraToken||$('camera-modal').hidden){next.getTracks().forEach(t=>t.stop());return;}
    if(stream)stream.getTracks().forEach(track=>track.stop());
    stream=next;
    cameraFacing=facing;
    const video=$('camera');
    video.hidden=false;
    video.srcObject=next;
    video.classList.toggle('is-mirrored',cameraFacing==='user');
    video.setAttribute('aria-label',cameraFacing==='user'?'Mirrored front camera preview':'Rear camera preview');
    try{
      // Don't block the shutter indefinitely if Safari delays play() resolution.
      await Promise.race([
        video.play().catch(()=>undefined),
        new Promise(resolve=>setTimeout(resolve,1200))
      ]);
    }catch{
      // Muted/playsinline autoplay may begin on metadata in some WebKit versions.
    }
    if(token!==cameraToken)return;
    $('camera-facing-label').textContent=cameraFacing==='user'?'Mirrored selfie':'Rear camera';
    $('camera-hint').textContent=cameraFacing==='user'
      ?'Mirrored live preview · saved photo matches what you see'
      :'Rear camera · saved photo matches what you see';
    $('camera-review-actions').hidden=true;
    $('camera-controls').hidden=false;
    clearCapturedPreview();
    setCameraStatus('');
    $('snap').disabled=false;
    $('flip-camera').disabled=false;
    $('snap').focus({preventScroll:true});
  }catch{
    if(token!==cameraToken)return;
    if(stream?.active){
      setCameraStatus('That camera is unavailable. Your current camera is still active.');
      $('snap').disabled=false;
      $('flip-camera').disabled=false;
    }else{
      stopCamera();
      error('Camera permission was denied or unavailable. You can upload a photo instead.');
    }
  }
}
$('open-camera').addEventListener('click',async()=>{
  error('');
  if(!navigator.mediaDevices?.getUserMedia){
    error('Camera is unavailable in this browser. Please upload a photo instead.');
    return;
  }
  enterCamera();
  cameraFacing='user';
  await startCamera('user');
});
$('cancel-camera').addEventListener('click',stopCamera);
$('flip-camera').addEventListener('click',()=>startCamera(cameraFacing==='user'?'environment':'user'));
function drawCameraFrame(video,faceMirror,frame){
  const sourceWidth=video.videoWidth,sourceHeight=video.videoHeight;
  const bounds=frame.getBoundingClientRect();
  const wantedRatio=Math.max(.4,Math.min(2.2,bounds.width/Math.max(1,bounds.height)));
  const sourceRatio=sourceWidth/sourceHeight;
  let cropWidth=sourceWidth,cropHeight=sourceHeight;
  if(sourceRatio>wantedRatio)cropWidth=sourceHeight*wantedRatio;
  else cropHeight=sourceWidth/wantedRatio;
  const sx=(sourceWidth-cropWidth)/2,sy=(sourceHeight-cropHeight)/2;
  const maxSide=1280;
  const width=wantedRatio>1?maxSide:Math.round(maxSide*wantedRatio);
  const height=wantedRatio>1?Math.round(maxSide/wantedRatio):maxSide;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,width);canvas.height=Math.max(1,height);
  const ctx=canvas.getContext('2d');
  if(faceMirror){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
  ctx.drawImage(video,sx,sy,cropWidth,cropHeight,0,0,canvas.width,canvas.height);
  return canvas;
}
$('snap').addEventListener('click',async()=>{
  if(!stream||$('snap').disabled)return;
  const video=$('camera');
  if(!video.videoWidth||!video.videoHeight){
    setCameraStatus('Camera is still focusing. Tap the shutter again.');
    return;
  }
  $('snap').disabled=true;
  try{
    const canvas=drawCameraFrame(video,cameraFacing==='user',$('camera-frame'));
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
    if(!blob)throw new Error('The camera could not save this shot.');
    clearCapturedPreview();
    capturedBlob=blob;capturedObjectUrl=URL.createObjectURL(blob);
    const preview=$('camera-captured-preview');
    preview.src=capturedObjectUrl;preview.hidden=false;
    video.hidden=true;
    if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    video.pause();video.srcObject=null;
    $('camera-controls').hidden=true;
    $('camera-review-actions').hidden=false;
    $('camera-hint').textContent='Looks good? Choose Use this photo, or retake it.';
    setCameraStatus('');
    $('use-photo').focus({preventScroll:true});
  }catch{
    $('snap').disabled=false;
    setCameraStatus('Could not capture this photo. Please try again.');
  }
});
$('retake-photo').addEventListener('click',async()=>{
  clearCapturedPreview();
  $('camera').hidden=false;
  $('camera-review-actions').hidden=true;
  $('camera-controls').hidden=false;
  await startCamera(cameraFacing);
});
$('use-photo').addEventListener('click',async()=>{
  if(!capturedBlob)return;
  const button=$('use-photo');
  button.disabled=true;
  const original=button.textContent;
  button.textContent='Checking your photo…';
  try{
    const accepted=await usePhoto(new File([capturedBlob],'selfie.jpg',{type:'image/jpeg'}));
    if(accepted){
      requestAnimationFrame(()=>{$('consent').scrollIntoView({
        block:'center',
        behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'
      });});
    }else{
      setCameraStatus($('error').textContent||'Try another photo.');
    }
  }finally{button.disabled=false;button.textContent=original;}
});
// Keep keyboard access inside the modal and support Escape to close.
document.addEventListener('keydown',event=>{
  if($('camera-modal').hidden)return;
  if(event.key==='Escape'){event.preventDefault();stopCamera();return;}
  if(event.key!=='Tab')return;
  const buttons=[...$('camera-modal').querySelectorAll('button:not([disabled])')]
    .filter(node=>node.offsetParent!==null);
  if(!buttons.length)return;
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===first){
    event.preventDefault();last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){
    event.preventDefault();first.focus();
  }
});
async function toBase64(blob){
  const buffer=new Uint8Array(await blob.arrayBuffer());let raw='';
  for(let i=0;i<buffer.length;i+=8192)raw+=String.fromCharCode(...buffer.subarray(i,i+8192));
  return btoa(raw);
}
function show(id){for(const x of ['capture','loading','results'])$(x).hidden=x!==id;$(id).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
function valid(data){
  const matches=data?.matches;
  const honestAmbiguity=data?.methodology==='independent-photo-cues-v3' &&
    data?.mixed===true && data?.company===null &&
    Array.isArray(data.companyAlternates)&&data.companyAlternates.length===0;
  if(data?.version==='photo-vibe-v2' && !honestAmbiguity &&
    (!allowedBrand(data.company)||!Array.isArray(data.companyAlternates)||
     data.companyAlternates.length!==2||!data.companyAlternates.every(allowedBrand)))return false;
  if(!Array.isArray(matches)||matches.length!==5) return false;
  const ids=new Set();
  for(const match of matches){if(!archetypes.some(a=>a.id===match.id)||ids.has(match.id)||!Number.isInteger(match.score)||match.score<0||match.score>100)return false;ids.add(match.id);}
  return typeof data.title==='string'&&data.title.length<=90&&data.title.length>0&&
    typeof data.tagline==='string'&&data.tagline.length<=180&&
    typeof data.explanation==='string'&&data.explanation.length<=400&&
    Array.isArray(data.tags)&&data.tags.length<=4&&data.tags.every(t=>typeof t==='string'&&t.length<=35);
}

/* Explicit company allowlist. Qwen never invents a company, logo or URL. */
const APPROVED_BRAND_DOMAINS=new Set([
 'goldmansachs.com','jpmorgan.com','morganstanley.com',
 'mckinsey.com','bcg.com','bain.com',
 'google.com','meta.com','nvidia.com',
 'notion.so','figma.com','linear.app',
 'salesforce.com','airbnb.com','hubspot.com'
]);
function allowedBrand(brand){
 return brand && typeof brand.name==='string' && brand.name.length>0 && brand.name.length<=65 &&
  typeof brand.domain==='string' && APPROVED_BRAND_DOMAINS.has(brand.domain) &&
  typeof brand.mood==='string' && brand.mood.length<=90;
}
/**
 * Render every result-page brand from the exact same local SVG allowlist as the
 * default Story PNG. Never use low-resolution third-party favicons.
 */
function attachBrandLogo(img,brand,fallback){
  const url=shareCompanyLogoUrl(brand?.domain);
  const frame=img.parentElement;
  const initials=String(brand?.name||'Company').split(/\s+/).map(word=>word[0]||'').slice(0,2).join('').toUpperCase();
  img.hidden=true;
  img.removeAttribute('src');
  img.dataset.logoDomain=brand?.domain||'';
  img.decoding='async';
  img.alt=brand?.name?brand.name+' logo':'';
  fallback.textContent=initials;
  fallback.hidden=false;
  frame?.classList.remove('fm-logo-wide','fm-logo-square');
  const hide=()=>{
    if(img.dataset.logoDomain!==brand?.domain)return;
    img.hidden=true;
    fallback.hidden=false;
  };
  img.onerror=hide;
  img.onload=()=>{
    if(img.dataset.logoDomain!==brand?.domain)return;
    if(!img.naturalWidth||!img.naturalHeight){hide();return;}
    frame?.classList.add(img.naturalWidth/img.naturalHeight>1.7?'fm-logo-wide':'fm-logo-square');
    img.hidden=false;
    fallback.hidden=true;
  };
  if(url)img.src=url;
}
function createSmallBrandMark(brand){
  const frame=document.createElement('span');
  frame.className='fm-brand-mark';
  const img=document.createElement('img');
  img.alt='';
  img.decoding='async';
  img.loading='eager';
  img.hidden=true;
  const fallback=document.createElement('span');
  fallback.className='fm-brand-mark-fallback';
  frame.append(img,fallback);
  attachBrandLogo(img,brand,fallback);
  // Adjacent visible text already identifies the brand.
  img.alt='';
  return frame;
}

function renderBrandVibe(data){
 const shell=$('brand-match');
 if(data.version!=='photo-vibe-v2' || !allowedBrand(data.company)){
   shell.hidden=true;return;
 }
 shell.hidden=false;
 $('brand-name').textContent=data.company.name;
 $('brand-mood').textContent=data.company.mood;
 $('brand-alternates-heading').textContent=data.mixed?'ANOTHER SIDE OF YOUR AURA':'MORE FROM THIS WORLD';
 attachBrandLogo($('brand-logo'),data.company,$('brand-fallback'));
 const row=$('brand-alternates');row.replaceChildren();
 for(const brand of (data.companyAlternates||[]).filter(allowedBrand).slice(0,2)){
  const el=document.createElement('div');el.className='fm-brand-alt';
  const mark=createSmallBrandMark(brand);
  const name=document.createElement('span');name.className='fm-brand-alt-name';name.textContent=brand.name;
  el.append(mark,name);row.append(el);
 }
}
/** Explain the actual v3 photo-vibe rubric without storing image embeddings or PII. */
function renderScoringDetails(data){
  const panel=$('fm-scoring-details');
  const output=$('fm-scoring-grid');
  const list=data?.vibeBreakdown;
  if(!Array.isArray(list)||list.length!==8){panel.hidden=true;return;}
  const allowed=new Set(['sweet','bold','bright','cool','playful','composed','friendly','expressive']);
  if(list.some(item=>!allowed.has(item.id)||!Number.isInteger(item.value)||item.value<0||item.value>4)){
    panel.hidden=true;return;
  }
  output.replaceChildren();
  for(const item of list){
    const row=document.createElement('div');row.className='fm-cue-row';
    const title=document.createElement('span');title.textContent=String(item.label||item.id).slice(0,40);
    const value=document.createElement('strong');value.textContent=item.value+' / 4';
    const meter=document.createElement('div');meter.className='fm-cue-meter';
    meter.setAttribute('role','meter');meter.setAttribute('aria-valuemin','0');
    meter.setAttribute('aria-valuemax','4');meter.setAttribute('aria-valuenow',String(item.value));
    meter.setAttribute('aria-label',title.textContent+' strength in this photo');
    const fill=document.createElement('span');fill.style.width=(item.value*25)+'%';
    meter.append(fill);row.append(title,value,meter);output.append(row);
  }
  panel.hidden=false;
}

function render(data){
  report=data;renderBrandVibe(data);renderScoringDetails(data);
  // Preload local brand marks so iPhone native sharing can stay responsive.
  void shareImagesForReport(data);
  const ordered=[...data.matches].sort((a,b)=>b.score-a.score);
  $('result-photo').src=previewUrl;$('result-title').textContent=data.title;
  $('result-subtitle').textContent=data.subtitle||'YOUR STYLE ALTER EGO';
  $('result-line').textContent=data.tagline;$('result-reason').textContent=data.explanation;
  const tags=$('style-tags');tags.replaceChildren();for(const tag of data.tags){const el=document.createElement('span');el.textContent=tag;tags.append(el);}
  const list=$('match-list');list.replaceChildren();
  for(const [index,match] of ordered.entries()){
    const type=archetypes.find(a=>a.id===match.id);
    const row=document.createElement('div');row.className='fm-match';row.style.setProperty('--delay',(index*.12)+'s');
    const rank=document.createElement('span');rank.className='fm-rank';rank.textContent=String(index+1).padStart(2,'0');
    const name=document.createElement('div');name.className='fm-match-name';name.textContent=type.title;
    const sub=document.createElement('small');sub.textContent=type.subtitle;name.append(sub);
    const brand=shareBrandForMatch(data,match);
    if(brand){
      const brandExample=document.createElement('div');brandExample.className='fm-match-brand';
      brandExample.title='Illustrative company aesthetic, not a hiring prediction';
      const brandMark=createSmallBrandMark(brand);
      const brandName=document.createElement('span');brandName.textContent=brand.name;
      brandExample.append(brandMark,brandName);name.append(brandExample);
    }
    const meter=document.createElement('div');meter.className='fm-meter';meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',type.title+' visual style alignment');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow',String(match.score));
    const fill=document.createElement('span');fill.style.setProperty('--score',match.score+'%');meter.append(fill);
    const score=document.createElement('div');score.className='fm-value';score.textContent=match.score;const unit=document.createElement('small');unit.textContent=' /100';score.append(unit);
    row.append(rank,name,meter,score);list.append(row);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const target=match.score,duration=900,delay=index*125,start=performance.now()+delay;
      score.firstChild.textContent='0';
      const tick=now=>{if(!row.isConnected)return;const progress=Math.max(0,Math.min(1,(now-start)/duration));
        const eased=1-Math.pow(1-progress,3);score.firstChild.textContent=String(Math.round(target*eased));
        if(progress<1)requestAnimationFrame(tick);
      };requestAnimationFrame(tick);
    }
  }
}
$('analyze').addEventListener('click',async()=>{
  error('');if(!photo||!$('consent').checked)return;
  $('analyze').disabled=true;show('loading');controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch(API+'/api/face-match/analyze',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imageBase64:await toBase64(analysisPhoto||photo),mimeType:'image/jpeg',consent:true}),
      signal:controller.signal,cache:'no-store'
    });
    if(!response.ok){
      const status=response.status;
      if(status===429)throw new Error('Today\u2019s free Face Match analyses are full. Please try again tomorrow.');
      if(status===400)throw new Error('We couldn\u2019t read this photo. Please choose another photo.');
      if(status===503 || status===502 || status===504)throw new Error('Our AI couldn\u2019t finish this analysis. Your photo is still ready; tap Reveal my aura to retry.');
      throw new Error('The photo analysis failed. Please retry.');
    }
    const data=await response.json();
    if(!valid(data))throw new Error('The AI result was incomplete. Please tap Reveal my aura to try again.');
    render(data);show('results');
    networkingBridge?.track('face-match','result_viewed',networkingVariant);
    observeNetworkingBridge();
  }catch(e){
    show('capture');error(e.name==='AbortError'?'The analysis timed out. Please retry.':e.message||'Could not complete your analysis.');
  }finally{clearTimeout(timeout);controller=null;enable();}
});
// Face Match is entertainment only. These interests are actively chosen by the visitor
// and are NOT inferred from facial characteristics or visual style.
function updateNetworkingCTA() {
  const cta = $('fm-networking-cta');
  cta.href = networkingBridge?.href('face_match',networkingVariant) || '/start/';
  if (!selectedNetworkingIndustry) {
    cta.textContent = 'Start networking with Orbit ↗';
    return;
  }
  cta.textContent = networkingVariant === 'b'
    ? 'Start networking in ' + selectedNetworkingIndustry + ' ↗'
    : 'Find alumni in ' + selectedNetworkingIndustry + ' ↗';
}
$('fm-industry-choices').querySelectorAll('[data-networking-interest]').forEach(button=>{
  button.addEventListener('click',()=>{
    const value=button.dataset.networkingInterest || '';
    selectedNetworkingIndustry=selectedNetworkingIndustry===value?'':value;
    $('fm-industry-choices').querySelectorAll('[data-networking-interest]').forEach(item=>{
      item.setAttribute('aria-pressed',String(item.dataset.networkingInterest===selectedNetworkingIndustry));
    });
    updateNetworkingCTA();
  });
});
$('fm-networking-cta').addEventListener('click',()=>{
  networkingBridge?.prepare({source:'face_match',industry:selectedNetworkingIndustry});
  networkingBridge?.track('face-match','networking_cta_clicked',networkingVariant);
});
let networkingObserver=null;
function observeNetworkingBridge(){
  if(networkingObserver)networkingObserver.disconnect();
  if(!('IntersectionObserver' in window)){
    networkingBridge?.track('face-match','networking_cta_viewed',networkingVariant);
    return;
  }
  networkingObserver=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){
      networkingBridge?.track('face-match','networking_cta_viewed',networkingVariant);
      networkingObserver.disconnect();
      networkingObserver=null;
    }
  },{threshold:0.3});
  networkingObserver.observe($('fm-network-bridge'));
}
updateNetworkingCTA();

/**
 * Orbit Face Match share card — exact brand mark, native canvas typography and
 * an OFFLINE, hardcoded, tested QR symbol for https://orbit-reaches.com/face-match/.
 * QR modules include a four-module white quiet zone. Never generate QR data
 * with the vision model or load untrusted images into the export canvas.
 */
const FACE_MATCH_SHARE_URL='https://orbit-reaches.com/face-match/';
const FACE_MATCH_QR_SIZE=37;
const FACE_MATCH_QR_PACKED='AAAAAAAAAAAAAAAAAAAAAAAAAP7q4/gEF4PQQC6r4roBdJe10Auta66AQQMFBAP6qq/gAAhhAACf59y4AkLbrYA2gtAoAGIUlpADO/PwgErw8fwAnA1AoBom0dUAkmkZQAUBS+WAMunF0gHo6VXAD61N/wAAcpRgA/q36wAQWYsTALrcn8gF1/loQC6U3W4BBGwO0A/tcYAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
// Offline-safe vector company marks shipped from the same Orbit origin.
// Both selected and illustrative brands are resolved by a closed, trusted domain map.
const SHARE_BRAND_LOGOS=Object.freeze({
  'goldmansachs.com':'goldmansachs',
  'jpmorgan.com':'jpmorgan',
  'morganstanley.com':'morganstanley',
  'mckinsey.com':'mckinsey',
  'bcg.com':'bcg',
  'bain.com':'bain',
  'google.com':'google',
  'meta.com':'meta',
  'nvidia.com':'nvidia',
  'notion.so':'notion',
  'figma.com':'figma',
  'linear.app':'linear',
  'salesforce.com':'salesforce',
  'airbnb.com':'airbnb',
  'hubspot.com':'hubspot'
});
const SHARE_BRAND_EXAMPLES=Object.freeze({
  'wall-street':{name:'Goldman Sachs',domain:'goldmansachs.com'},
  consulting:{name:'McKinsey & Company',domain:'mckinsey.com'},
  tech:{name:'Meta',domain:'meta.com'},
  founder:{name:'Figma',domain:'figma.com'},
  'client-facing':{name:'Airbnb',domain:'airbnb.com'}
});
const SHARE_LOGO_CACHE=new Map();
function shareCompanyLogoUrl(domain){
  const slug=SHARE_BRAND_LOGOS[domain];
  return slug?'/face-match/brand-logos/'+slug+'.svg':'';
}
function shareBrandForMatch(data,match){
  const selected=data?.company;
  return selected?.category===match.id && shareCompanyLogoUrl(selected.domain)
    ?{name:selected.name,domain:selected.domain}
    :SHARE_BRAND_EXAMPLES[match.id]||null;
}
function shareLogoImage(brand){
  const url=shareCompanyLogoUrl(brand?.domain);
  if(!url)return Promise.resolve(null);
  if(SHARE_LOGO_CACHE.has(url))return SHARE_LOGO_CACHE.get(url);
  // SVG from our own origin means the browser can safely draw it into a PNG canvas.
  const loaded=new Promise(resolve=>{
    const image=new Image();
    let done=false;
    const finish=value=>{
      if(done)return;
      done=true;clearTimeout(timeout);
      image.onload=null;image.onerror=null;resolve(value);
    };
    const timeout=setTimeout(()=>finish(null),3500);
    image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0?image:null);
    image.onerror=()=>finish(null);
    image.decoding='async';
    image.src=url;
  });
  SHARE_LOGO_CACHE.set(url,loaded);
  return loaded;
}
async function shareImagesForReport(data){
  const matches=[...(data?.matches||[])].sort((a,b)=>b.score-a.score).slice(0,3);
  const brands=matches.map(match=>shareBrandForMatch(data,match));
  if(data?.company?.domain)brands.push(data.company);
  const loaded=await Promise.all(brands.map(shareLogoImage));
  const byDomain=new Map();
  brands.forEach((brand,i)=>{if(brand?.domain)byDomain.set(brand.domain,loaded[i]);});
  return byDomain;
}
function shareFitLogo(ctx,image,x,y,w,h){
  if(!image?.naturalWidth||!image?.naturalHeight)return false;
  const ratio=Math.min(w/image.naturalWidth,h/image.naturalHeight);
  const rw=image.naturalWidth*ratio,rh=image.naturalHeight*ratio;
  ctx.drawImage(image,x+(w-rw)/2,y+(h-rh)/2,rw,rh);
  return true;
}
function shareCompanyTile(ctx,brand,logo,x,y,w=199,h=62){
  shareRoundedRect(ctx,x,y,w,h,13,'#f8f7fb',null);
  const name=String(brand?.name||'').slice(0,55);
  const aspect=logo?.naturalWidth&&logo?.naturalHeight
    ?logo.naturalWidth/logo.naturalHeight:0;
  if(logo&&aspect>1.9){
    if(shareFitLogo(ctx,logo,x+13,y+11,w-26,h-22))return;
  }
  if(logo){
    shareFitLogo(ctx,logo,x+12,y+10,42,42);
    ctx.fillStyle='#25202e';
    const label=name.length>15?name.split(' ').slice(0,2).join(' '):name;
    let size=15;
    do{ctx.font='650 '+size+'px Inter, -apple-system, sans-serif';size--}
    while(size>=10&&ctx.measureText(label).width>126);
    ctx.textAlign='left';ctx.fillText(label,x+65,y+36,125);
    return;
  }
  // Fail safely without a fake corporate mark if an asset cannot load.
  ctx.textAlign='center';ctx.fillStyle='#2c2733';
  const label=name||'Company';
  let size=18;
  do{ctx.font='650 '+size+'px Inter, -apple-system, sans-serif';size--}
  while(size>=11&&ctx.measureText(label).width>w-23);
  ctx.fillText(label,x+w/2,y+h/2+6,w-23);ctx.textAlign='left';
}
function shareHeroCompany(ctx,brand,logo){
  const x=94,y=1457;
  if(logo){
    const aspect=logo.naturalWidth/logo.naturalHeight;
    if(aspect>2){
      shareRoundedRect(ctx,x,y,218,73,14,'#f8f7fb',null);
      shareFitLogo(ctx,logo,x+11,y+11,196,51);
      ctx.fillStyle='#f4effa';ctx.font='650 31px Inter, -apple-system, sans-serif';
      const name=shareWordWrap(ctx,brand.name,330,2);
      name.forEach((line,i)=>ctx.fillText(line,330,1494+i*37));
      return;
    }
    shareRoundedRect(ctx,x,y,82,78,14,'#f8f7fb',null);
    shareFitLogo(ctx,logo,x+14,y+12,54,54);
    ctx.fillStyle='#f4effa';ctx.font='650 38px Inter, -apple-system, sans-serif';
    const name=shareWordWrap(ctx,brand.name,490,2);
    name.forEach((line,i)=>ctx.fillText(line,195,1505+i*43));
    return;
  }
  ctx.fillStyle='#f4effa';ctx.font='650 43px Inter, -apple-system, sans-serif';
  shareWordWrap(ctx,brand.name,586,2).forEach((line,i)=>ctx.fillText(line,94,1506+i*48));
}

function shareRoundedRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function shareCoverImage(ctx,img,x,y,w,h,r){
  if(!img?.naturalWidth||!img?.naturalHeight)return;
  const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
  const sourceW=w/scale,sourceH=h/scale;
  const sx=(img.naturalWidth-sourceW)/2,sy=(img.naturalHeight-sourceH)/2;
  ctx.save();
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
  ctx.drawImage(img,sx,sy,sourceW,sourceH,x,y,w,h);
  ctx.restore();
}
function shareWordWrap(ctx,message,maxWidth,maxLines=3){
  const words=String(message||'Your Career Aura').trim().split(/\s+/);
  const lines=[];let current='';
  for(const word of words){
    const candidate=current?current+' '+word:word;
    if(ctx.measureText(candidate).width>maxWidth&&current){
      lines.push(current);current=word;
    }else current=candidate;
  }
  if(current)lines.push(current);
  return lines.slice(0,maxLines);
}
function shareQR(ctx,x,y,side){
  // Data is the 37x37 QR matrix for the canonical Face Match URL with ECC M.
  const bits=Uint8Array.from(atob(FACE_MATCH_QR_PACKED),chr=>chr.charCodeAt(0));
  const unit=Math.floor(side/FACE_MATCH_QR_SIZE);
  const actual=unit*FACE_MATCH_QR_SIZE;
  const sx=x+Math.floor((side-actual)/2),sy=y+Math.floor((side-actual)/2);
  shareRoundedRect(ctx,x-10,y-10,side+20,side+20,20,'#ffffff',null);
  ctx.fillStyle='#111018';
  for(let i=0;i<FACE_MATCH_QR_SIZE*FACE_MATCH_QR_SIZE;i++){
    if(bits[i>>3]&(1<<(7-(i&7)))){
      const col=i%FACE_MATCH_QR_SIZE,row=Math.floor(i/FACE_MATCH_QR_SIZE);
      ctx.fillRect(sx+col*unit,sy+row*unit,unit,unit);
    }
  }
}
async function resultCanvas(){
  const images=await shareImagesForReport(report);
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
  const c=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height;
  const bg=c.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#19142e');bg.addColorStop(.25,'#0c0b14');
  bg.addColorStop(.75,'#0c0b15');bg.addColorStop(1,'#21183a');
  c.fillStyle=bg;c.fillRect(0,0,W,H);
  // Understated orbital grid and a single satellite dot from Orbit's visual system.
  c.save();c.strokeStyle='rgba(176,154,250,.12)';c.lineWidth=1;
  for(let y=195;y<1850;y+=122){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
  for(let x=95;x<W;x+=125){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}
  c.beginPath();c.ellipse(520,590,850,520,-.48,2.68,6.08);c.strokeStyle='rgba(167,130,249,.32)';c.lineWidth=2;c.stroke();
  c.fillStyle='#8f75ff';c.beginPath();c.arc(918,111,12,0,Math.PI*2);c.fill();
  c.restore();
  // Brand is based on Orbit's actual mark: one open ring plus satellite at 12 o'clock.
  c.strokeStyle='#f2f2f5';c.lineWidth=6;c.beginPath();c.arc(93,107,23,0,Math.PI*2);c.stroke();
  c.fillStyle='#5c5cf2';c.beginPath();c.arc(93,71,7,0,Math.PI*2);c.fill();
  c.fillStyle='#f2f2f5';c.font='650 48px Inter, -apple-system, sans-serif';c.fillText('Orbit',132,125);
  c.fillStyle='rgba(207,198,230,.5)';c.fillRect(307,82,2,49);
  c.fillStyle='#c8beeb';c.font='500 31px Inter, -apple-system, sans-serif';c.fillText('FACE MATCH',331,121);
  c.fillStyle='#b8aaff';c.font='500 22px Inter, -apple-system, sans-serif';c.fillText('001',952,122);
  c.strokeStyle='rgba(209,202,233,.4)';c.lineWidth=1;c.beginPath();c.moveTo(65,166);c.lineTo(1015,166);c.stroke();
  c.fillStyle='#b3a4f6';c.font='600 21px Inter, -apple-system, sans-serif';c.fillText('YOUR CAREER AURA',67,215);
  c.fillStyle='#a6a0b9';c.font='500 15px Inter, -apple-system, sans-serif';c.textAlign='right';
  c.fillText('ORBIT LABS  /  JUST FOR FUN',1015,212);c.textAlign='left';
  const img=$('result-photo');
  try{if(img?.decode)await img.decode();}catch{}
  shareRoundedRect(c,64,246,468,662,27,'#17141e','rgba(199,177,255,.72)');
  shareCoverImage(c,img,67,249,462,656,25);
  // Poster title: editorial, not generic AI-glow typography.
  c.fillStyle='#bdaeff';c.font='600 18px Inter, -apple-system, sans-serif';c.fillText('THE RESULTS',567,284);
  c.fillStyle='#f4f1fa';c.font='650 73px Inter, -apple-system, sans-serif';
  const headline=shareWordWrap(c,report?.title||'My Career Aura',430,3);
  headline.forEach((line,i)=>c.fillText(line,565,366+i*84));
  c.fillStyle='#5c5cf2';c.fillRect(566,624,91,5);
  c.font='600 20px Inter, -apple-system, sans-serif';c.fillStyle='#dbd4f3';
  const tags=(report?.tags||[]).slice(0,2);
  tags.forEach((tag,i)=>c.fillText(String(tag).toUpperCase().slice(0,23),566,689+i*37));
  c.fillStyle='#aaa1ba';c.font='500 15px Inter, -apple-system, sans-serif';
  c.fillText('ONE SELFIE  /  YOUR OWN VIBE',566,850);
  // Three top matches with recognizable real-company wordmarks rendered as text,
  // so export stays offline-safe and doesn't invent a corporate logo graphic.
  shareRoundedRect(c,65,949,1015-65,401,25,'#14131d','rgba(190,174,225,.48)');
  c.fillStyle='#f3f2f8';c.font='650 31px Inter, -apple-system, sans-serif';c.fillText('TOP MATCHES',92,1000);
  c.fillStyle='#b2a4e1';c.font='500 15px Inter, -apple-system, sans-serif';
  c.textAlign='right';c.fillText('STYLE ALIGNMENT',987,994);c.textAlign='left';
  const ordered=[...(report?.matches||[])].sort((a,b)=>b.score-a.score).slice(0,3);
  ordered.forEach((match,i)=>{
    const y=1043+i*97;
    if(i){c.strokeStyle='rgba(155,145,178,.24)';c.beginPath();c.moveTo(94,y-5);c.lineTo(985,y-5);c.stroke();}
    const brand=shareBrandForMatch(report,match);
    shareCompanyTile(c,brand,images.get(brand?.domain),92,y+13,199,62);
    const name=archetypes.find(a=>a.id===match.id)?.title||match.id;
    c.fillStyle='#e7e3f1';c.font='650 17px Inter, -apple-system, sans-serif';c.fillText(name.toUpperCase(),308,y+49);
    shareRoundedRect(c,536,y+36,311,13,7,'#524b67',null);
    const value=Math.max(0,Math.min(100,Number(match.score)||0));
    shareRoundedRect(c,536,y+36,Math.max(7,Math.round(311*value/100)),13,7,'#6554e4',null);
    c.fillStyle='#c2b2ff';c.font='650 38px Inter, -apple-system, sans-serif';
    c.textAlign='right';c.fillText(String(value),982,y+59);c.textAlign='left';
  });
  // Bottom action region: real QR rather than a decorative fake square.
  shareRoundedRect(c,65,1391,950,458,27,'#14131d','rgba(190,174,225,.45)');
  c.fillStyle='#b9a7f4';c.font='500 18px Inter, -apple-system, sans-serif';
  c.fillText(report?.company?.name?'YOUR BRAND-VIBE TWIN':'YOUR AURA, YOUR WAY',94,1434);
  const primary=report?.company?.name
    ?{name:report.company.name,domain:report.company.domain}
    :{name:'Your own mix',domain:''};
  shareHeroCompany(c,primary,images.get(primary.domain));
  c.fillStyle='#a9a2b9';c.font='500 15px Inter, -apple-system, sans-serif';
  c.fillText('A CREATIVE MOODBOARD, NOT A HIRING PREDICTION',95,1589);
  c.strokeStyle='rgba(165,149,195,.38)';c.beginPath();c.moveTo(95,1609);c.lineTo(681,1609);c.stroke();
  c.fillStyle='#f2eff9';c.font='500 23px Inter, -apple-system, sans-serif';c.fillText("WHAT'S YOUR",95,1666);
  c.fillStyle='#c0b0ff';c.font='750 41px Inter, -apple-system, sans-serif';c.fillText('CAREER AURA?',94,1711);
  c.fillStyle='#f0ebf8';c.font='500 21px Inter, -apple-system, sans-serif';c.fillText('Scan to try Face Match.',94,1777);
  c.fillStyle='#beb7ce';c.font='500 18px Inter, -apple-system, sans-serif';
  c.fillText('orbit-reaches.com/face-match/',94,1821);
  shareQR(c,726,1527,263);
  c.fillStyle='#c5b9f7';c.font='600 14px Inter, -apple-system, sans-serif';
  c.textAlign='center';c.fillText('SCAN ME',859,1834);c.textAlign='left';
  c.fillStyle='#ada6c4';c.font='500 15px Inter, -apple-system, sans-serif';
  c.fillText('ORBIT  /  FIND YOUR NEXT CONNECTION',66,1892);
  c.fillStyle='#938ba9';c.font='500 13px Inter, -apple-system, sans-serif';
  c.textAlign='right';c.fillText('NOT AFFILIATED WITH SHOWN BRANDS',1013,1892);c.textAlign='left';
  return canvas;
}
async function blobForShare(){
  const canvas=await resultCanvas();
  return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
}
$('save').addEventListener('click',async()=>{
  if(!report)return;const blob=await blobForShare();if(!blob)return;
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='orbit-career-aura.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('share-status').textContent='Share card saved to your device.';
});
$('share').addEventListener('click',async()=>{
  if(!report)return;
  networkingBridge?.track('face-match','share_clicked',networkingVariant);const blob=await blobForShare();if(!blob)return;
  const file=new File([blob],'orbit-career-aura.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'My Career Aura',text:'What is your career aura?'});return;}catch(e){if(e.name==='AbortError')return;}}
  if(navigator.share){try{await navigator.share({title:'My Career Aura',url:'https://orbit-reaches.com/face-match/'});return;}catch(e){if(e.name==='AbortError')return;}}
  $('save').click();
});
$('reset').addEventListener('click',()=>{if(controller)controller.abort();report=null;clearPhoto();$('consent').checked=false;enable();show('capture');});
window.addEventListener('pagehide',()=>{stopCamera();if(previewUrl)URL.revokeObjectURL(previewUrl);if(controller)controller.abort();});
initialize();


/** Anonymous acquisition measurement: no photo, resume, email or identity is sent. */
function recordPublicToolPageview(){
  try{
    if(navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
    const key='orbit_labs_tab_session_v1';
    let sessionId=sessionStorage.getItem(key);
    if(!sessionId){sessionId=crypto.randomUUID();sessionStorage.setItem(key,sessionId);}
    void fetch(API+'/api/public-tools/view',{
      method:'POST',mode:'cors',credentials:'omit',cache:'no-store',keepalive:true,
      headers:{'content-type':'application/json'},
      body:JSON.stringify({tool:'face-match',sessionId})
    }).catch(()=>undefined);
  }catch{/* Tracking cannot block the free tool. */}
}
recordPublicToolPageview();
