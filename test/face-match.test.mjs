import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Face Match is independently routed and built',()=>{
  const h=read('face-match/index.html'), b=read('scripts/build-continuum-pages.mjs'),m=read('sitemap.xml');
  assert.match(h,/<title>Face Match/);assert.match(h,/\/resume-score\//);assert.match(b,/'face-match'/);
  assert.match(m,/\/face-match\/<\/loc>/);assert.match(h,/id="consent"/);
});
test('Camera privacy, actual API gate and safe rendering',()=>{
  const j=read('face-match/face-match.js'),c=read('face-match/face-match.css');
  assert.match(j,/getUserMedia/);assert.match(j,/stopCamera/);assert.match(j,/consent:true/);
  assert.match(j,/FaceDetector.createFromOptions/);
  assert.match(j,/\/api\/face-match\/config/);
  assert.match(j,/serverReady/);
  assert.match(j,/\/api\/face-match\/analyze/);assert.match(j,/if\(!valid\(data\)\)/);
  assert.doesNotMatch(j,/\.innerHTML\s*=/);
  assert.doesNotMatch(j,/localStorage\.setItem/);
  assert.match(c,/prefers-reduced-motion:reduce/);assert.match(c,/@media\(max-width:760px\)/);
});
test('Face Match privacy notice discloses photo processing',()=>{
  const p=read('privacy/index.html');
  assert.match(p,/Face Match/);
  assert.match(p,/DashScope\/Qwen/);
  assert.match(p,/provider-side retention/);
});

test('Face Match only shows custom upload action and explains transient server errors',()=>{
  const html=read('face-match/index.html');
  const css=read('face-match/face-match.css');
  const js=read('face-match/face-match.js');
  assert.match(html,/id="photo-input" class="fm-visually-hidden"/);
  assert.match(css,/\.fm-visually-hidden\{/);
  assert.match(js,/controller\.abort\(\),45000/);
  assert.match(js,/Our AI couldn/);
  assert.doesNotMatch(js,/Analysis is not available yet\. Please try again later/);
});

test('Portrait-vibe v2 renders real editorial brand logos and positive tags',()=>{
 const h=read('face-match/index.html');
 const js=read('face-match/face-match.js');
 const css=read('face-match/face-match.css');
 assert.match(h,/id="brand-match"/);
 assert.match(h,/id="brand-logo"/);
 assert.match(h,/id="brand-alternates"/);
 assert.match(h,/id="result-subtitle"/);
 assert.match(js,/APPROVED_BRAND_DOMAINS/);
 assert.match(js,/goldmansachs\.com/);
 assert.match(js,/morganstanley\.com/);
 assert.match(js,/figma\.com/);
 assert.match(js,/google\.com/);
 assert.match(js,/shareCompanyLogoUrl/);
 assert.doesNotMatch(js,/officialFaviconUrl/);
 assert.match(js,/renderBrandVibe/);
 assert.match(js,/data\??\.version==='photo-vibe-v2'/);
 assert.match(css,/\.fm-brand-match/);
 assert.doesNotMatch(js,/short-term request limit/);
 assert.match(h,/not your outfit/);
});

test('Face Match explains the independently scored photo cues',()=>{
 const html=read('face-match/index.html');
 const js=read('face-match/face-match.js');
 const css=read('face-match/face-match.css');
 assert.match(html,/id="fm-scoring-details"/);
 assert.match(html,/compares them with five fictional editorial style profiles/);
 assert.match(html,/Ethnicity, clothing and real hiring potential are not scoring criteria/);
 assert.match(js,/renderScoringDetails\(data\)/);
 assert.match(js,/data\?\.vibeBreakdown/);
 assert.match(js,/meter\.setAttribute\('aria-valuenow'/);
 assert.match(css,/\.fm-scoring-grid/);
 assert.doesNotMatch(html,/Looking at outfit, color and composition/);
});

test('Face Match V3 crops the image for inference, preserving original preview/share',()=>{
  const js=read('face-match/face-match.js');
  assert.match(js,/async function cropForVisualStyle\(blob,box\)/);
  assert.match(js,/analysisPhoto=faceOnly/);
  assert.match(js,/toBase64\(analysisPhoto\|\|photo\)/);
  assert.match(js,/photo=null;analysisPhoto=null/);
  assert.match(js,/honestAmbiguity/);
});
test('Privacy discloses aggregate style counts and never links them to visitors',()=>{
  const privacy=read('privacy/index.html');
  assert.match(privacy,/aggregate daily request counts/);
  assert.match(privacy,/fictional Career Aura labels/);
  assert.match(privacy,/without connecting those labels to individual visitors/);
});

test('Selfie camera uses a fixed, accessible mobile shutter and matching front-camera mirror',()=>{
  const html=read('face-match/index.html');
  const css=read('face-match/face-match.css');
  const js=read('face-match/face-match.js');
  assert.match(html,/id="camera-modal"/);
  assert.match(html,/aria-modal="true"/);
  assert.match(html,/id="camera-frame"/);
  assert.match(html,/id="camera-captured-preview"/);
  assert.match(html,/id="snap"/);
  assert.match(html,/id="retake-photo"/);
  assert.match(html,/id="use-photo"/);
  assert.match(css,/\.fm-camera-modal\{position:fixed/);
  assert.match(css,/\.fm-camera-frame video\.is-mirrored\{transform:scaleX\(-1\)/);
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/body\.fm-camera-open\{position:fixed/);
  assert.match(js,/video\.classList\.toggle\('is-mirrored',cameraFacing==='user'\)/);
  assert.match(js,/drawCameraFrame\(video,cameraFacing==='user'/);
  assert.match(js,/if\(faceMirror\)\{ctx\.translate\(canvas\.width,0\);ctx\.scale\(-1,1\)/);
  assert.match(js,/frame\.getBoundingClientRect\(\)/);
  assert.match(js,/window\.scrollTo\(0,cameraScrollY\)/);
  assert.doesNotMatch(html,/id="camera-actions"/);
});

test('Every hard-coded Face Match UI ID used by JavaScript exists in HTML',()=>{
  const html=read('face-match/index.html');
  const js=read('face-match/face-match.js');
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]));
  const references=new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(match=>match[1]));
  assert.deepEqual([...references].filter(id=>!ids.has(id)),[],'missing HTML IDs crash camera/gallery interactions');
});

test('Export is a 9:16 Orbit Story with original brand mark and offline URL QR',()=>{
 const js=read('face-match/face-match.js');
 assert.match(js,/canvas.width=1080;canvas.height=1920/);
 assert.match(js,/FACE_MATCH_SHARE_URL='https:\/\/orbit-reaches\.com\/face-match\/'/);
 assert.match(js,/FACE_MATCH_QR_SIZE=37/);
 assert.match(js,/FACE_MATCH_QR_PACKED=/);
 assert.match(js,/function shareQR\(ctx,x,y,side\)/);
 assert.match(js,/ctx\.fillRect\(sx\+col\*unit,sy\+row\*unit,unit,unit\)/);
 assert.match(js,/c\.arc\(93,107,23/);
 assert.match(js,/c\.arc\(93,71,7/);
 assert.match(js,/async function blobForShare\(\)/);
 assert.doesNotMatch(js,/www\.google\.com\/s2\/favicons[^\n]*resultCanvas/);
});

test('Every Face Match Story company domain has a local, self-contained vector logo',()=>{
  const js=read('face-match/face-match.js');
  const names=['goldmansachs','jpmorgan','morganstanley','mckinsey','bcg','bain','google','meta','nvidia','notion','figma','linear','salesforce','airbnb','hubspot'];
  for(const name of names){
    const svg=read('face-match/brand-logos/'+name+'.svg');
    assert.match(svg,/<svg\b/i,name+' is an SVG');
    assert.match(svg,/viewBox=/i,name+' preserves the original icon geometry');
    assert.doesNotMatch(svg,/<script\b|<foreignObject\b|<image\b|<use\b|onload=|href=|url\(/i,name+' is self-contained and cannot fetch remote content');
    assert.match(js,new RegExp(":'"+name+"'"),name+' is mapped to a fixed local asset');
  }
  assert.match(js,/SHARE_BRAND_LOGOS=Object\.freeze/);
  assert.match(js,/function shareCompanyTile\(ctx,brand,logo/);
  assert.match(js,/function shareHeroCompany\(ctx,brand,logo/);
  assert.match(js,/function shareLogoImage\(brand\)/);
  assert.match(js,/const images=await shareImagesForReport\(report\)/);
  assert.match(js,/void shareImagesForReport\(data\)/);
  assert.match(js,/shareLogoImage\(brand\)/);
  assert.match(js,/SHARE_BRAND_EXAMPLES=Object\.freeze/);
  assert.doesNotMatch(js,/SHARE_BRAND_NAMES=/,'the old wordmark-only template is removed');
  assert.match(js,/async function blobForShare\(\)/,'default Share and Save still use this canvas');
});
test('Default Story always uses own-origin logo assets with fallback and no AI image generation',()=>{
  const js=read('face-match/face-match.js');
  assert.match(js,/return slug\?'\/face-match\/brand-logos\/'\+slug\+'\.svg'/);
  assert.match(js,/function shareBrandForMatch\(data,match\)/);
  assert.match(js,/const brand=shareBrandForMatch\(report,match\)/);
  assert.match(js,/shareCompanyTile\(c,brand,images\.get\(brand\?\.domain\)/);
  assert.match(js,/shareHeroCompany\(c,primary,images\.get\(primary\.domain\)/);
  assert.match(js,/if\(logo\)\{/);
  assert.match(js,/ctx\.fillText\(label/);
  assert.doesNotMatch(js,/drawImage\([^)]*officialFaviconUrl/,'external favicons are never used for Canvas');
  assert.match(js,/NOT AFFILIATED WITH SHOWN BRANDS/);
});

test('Live Face Match results use the same all-15 local vector assets as Story export',()=>{
 const js=read('face-match/face-match.js');
 const css=read('face-match/face-match.css');
 assert.doesNotMatch(js,/officialFaviconUrl|https:\/\/www\.google\.com\/s2\/favicons/);
 assert.match(js,/function attachBrandLogo\(img,brand,fallback\)/);
 assert.match(js,/const url=shareCompanyLogoUrl\(brand\?\.domain\)/);
 assert.match(js,/function createSmallBrandMark\(brand\)/);
 assert.match(js,/attachBrandLogo\(\$\('brand-logo'\),data\.company,\$\('brand-fallback'\)\)/);
 assert.match(js,/const mark=createSmallBrandMark\(brand\)/);
 assert.match(js,/const brand=shareBrandForMatch\(data,match\)/);
 assert.match(js,/brandExample\.append\(brandMark,brandName\)/);
 assert.match(css,/\.fm-logo-frame\.fm-logo-wide img/);
 assert.match(css,/\.fm-brand-alt-list\{display:grid/);
 assert.match(css,/\.fm-match-brand/);
 const approved=[...js.matchAll(/'(?:[a-z0-9-]+\.)+(?:com|so|app)'/g)]
    .map(x=>x[0].slice(1,-1)).filter(x=>!x.includes('orbit-reaches.com'));
 const allowed=approved.slice(0,15);
 const raw=js.slice(js.indexOf('const SHARE_BRAND_LOGOS=Object.freeze'),js.indexOf('const SHARE_BRAND_EXAMPLES=Object.freeze'));
 for(const domain of allowed)assert.ok(raw.includes("'"+domain+"':"),'Missing local logo mapping for '+domain);
});

test('Face Match result surfaces a dismissible email prompt after exactly ten seconds',()=>{
  const html=read('face-match/index.html');
  const js=read('face-match/email-nudge.js');
  const core=read('face-match/face-match.js');
  const css=read('face-match/face-match.css');
  assert.match(html,/id="fm-email-nudge"/);
  assert.match(html,/id="fm-email-nudge-close"/);
  assert.match(html,/id="fm-email-nudge-form"/);
  assert.match(html,/id="fm-email-nudge-input" type="email"/);
  assert.match(html,/id="fm-email-nudge-later"/);
  assert.match(html,/id="fm-email-nudge-success"/);
  assert.match(html,/\/face-match\/email-nudge\.js" defer/);
  assert.match(js,/const DELAY_MS=10_000/);
  assert.match(js,/timer=setTimeout\(\(\)=>/);
  assert.match(js,/if\(document\.hidden\)/);
  assert.match(js,/HANDLED_KEY='orbit_face_match_email_nudge_handled_v1'/);
  assert.match(js,/markHandled\(\)/);
  assert.match(core,/if\(id==='results'\)window\.OrbitFaceMatchEmailNudge\?\.schedule\?\.\(\)/);
  assert.match(core,/else window\.OrbitFaceMatchEmailNudge\?\.cancel\?\.\(\)/);
  assert.match(css,/\.fm-email-nudge\{[\s\S]*position:fixed/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('Email invitation uses only existing handoff API and never uploads face-derived labels',()=>{
  const js=read('face-match/email-nudge.js');
  const privacy=read('privacy/index.html');
  assert.match(js,/fetch\(API\+'\/api\/handoff\/start'/);
  assert.match(js,/utm_campaign:'post_result_email'/);
  assert.match(js,/source:'face_match'/);
  assert.match(js,/funnelVersion:2/);
  assert.match(js,/Never send messages without my approval/);
  assert.match(js,/form\.addEventListener\('submit'/);
  assert.match(js,/credentials:'omit'/);
  assert.match(js,/handledInMemory=true/);
  assert.doesNotMatch(js,/imageBase64|report\.|result\.company|attractiveness/);
  assert.match(privacy,/Face Match optional email invitation/);
  assert.match(privacy,/does not itself register an Orbit account/);
});

test('V4 persona presentation maintains five compatible match rows and social card',()=>{
  const html=read('face-match/index.html');
  const js=read('face-match/face-match.js');
  assert.match(html,/selects a more specific photo persona and positive tags/);
  assert.match(html,/Close results blend two style worlds/);
  assert.match(js,/subtitle:'Focused & cinematic'/);
  assert.match(js,/subtitle:'Bright & composed'/);
  assert.match(js,/subtitle:'Cool & playful'/);
  assert.match(js,/subtitle:'Bold & expressive'/);
  assert.match(js,/subtitle:'Warm & upbeat'/);
  assert.match(js,/\$\('result-title'\)\.textContent=data\.title/);
  assert.match(js,/shareWordWrap\(c,report\?\.title\|\|'My Career Aura'/);
});
