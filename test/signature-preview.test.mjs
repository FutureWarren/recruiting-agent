import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
const after=await read('preview/signature/index.html');
const before=await read('preview/original/index.html');
test('Original website content below the hero is retained exactly',()=>{
  const tail=s=>s.slice(s.indexOf('<section class="company-section')).replace(/<script type="module" src="\/media\/3d\/orbit-signature.js"><\/script>\n/,'');
  assert.equal(tail(after),tail(before));
});
test('Existing downloads, mobile handoff, and base styles are unchanged',async()=>{
  for(const file of ['home.js','mobile.js','home.css','mobile.css']) {
    const original=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'});
    assert.equal(await read(file),original,file);
  }
  assert.equal((after.match(/data-orbit-download/g)||[]).length,(before.match(/data-orbit-download/g)||[]).length);
});
test('Preview is guarded against external writes and does not load the rejected theme',async()=>{
  assert.match(after,/src="\/preview\/guard.js"/);
  const guard=await read('preview/guard.js');
  assert.match(guard,/!\['GET', 'HEAD'\]\.includes\(method\)/);
  assert.match(guard,/No email was sent/);
  assert.doesNotMatch(after,/href="orbit.css|src="site.js|src="download.js/);
});
test('Original ring and satellite identity, with no unrequested typewriter or orange palette',async()=>{
  assert.match(after,/class="orbit-mark"/);
  assert.match(after,/<h1>Your next/);
  const model=await read('src/signature-model.js');
  assert.match(model,/#5c5cf2/);
  assert.match(model,/Orbit brand satellite/);
  assert.doesNotMatch(model,/#ff7a4c|#e85a18|Events|Creators/);
});
test('Pause, reduced motion, offscreen, hidden tab, loss of WebGL and cleanup are handled',async()=>{
  const scene=await read('src/signature-scene.js');
  for(const text of ['prefers-reduced-motion','saveData','motion-off','IntersectionObserver','visibilitychange','webglcontextlost','webglcontextrestored','pagehide','renderer.dispose()']) assert.ok(scene.includes(text),text);
  const css=await read('preview/signature/signature.css');
  assert.match(css,/signature-fallback/);
  assert.match(css,/prefers-reduced-motion/);
});
test('Exported original 3D model is a valid GLB and browser bundle stays below 600KB',async()=>{
  const buffer=await readFile(new URL('../media/3d/orbit-signature.glb',import.meta.url));
  assert.equal(buffer.toString('utf8',0,4),'glTF');
  assert.equal(buffer.readUInt32LE(4),2);
  assert.equal(buffer.readUInt32LE(8),buffer.length);
  const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
  assert.ok(json.nodes.some(n=>n.name==='168 sculpted satin-metal fins'));
  assert.ok(json.nodes.some(n=>n.name==='Orbit brand satellite'));
  assert.ok(json.nodes.some(n=>n.name==='Recessed continuous satin surface'));
  assert.ok((await stat(new URL('../media/3d/orbit-signature.js',import.meta.url))).size<600000);
});
