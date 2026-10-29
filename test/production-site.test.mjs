import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pages } from '../scripts/build-continuum-pages.mjs';
const read = p => readFile(new URL('../'+p,import.meta.url),'utf8');
const html = await read('dist/index.html');
const main = value => value.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
const scripts = value => [...value.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(m=>m[0]);
test('Production ships the approved design, not the old prototype or disabled preview', async()=>{
  assert.match(html,/class="continuum continuum-dark"/);
  for(const marker of ['data-continuum-scene','data-ambient-scene','data-email-story','ceramic-face','id="companies"','id="hero-demo"','id="mobile-handoff-form"']) assert.ok(html.includes(marker),marker);
  for(const page of ['',...pages]) {
    const value=await read(`dist/${page?page+'/':''}index.html`);
    assert.doesNotMatch(value,/\/preview\/|127\.0\.0\.1|localhost|guard\.js|design preview/i);
    assert.match(value,/<link rel="canonical"/);
  }
  assert.match(html,/\/assets\/orbit\/continuum.js\?v=[0-9a-f]{12}/);
});
test('All rendered pages retain prices, legal prose and executable business code',async()=>{
  for(const page of ['pricing','support','privacy','terms','refunds','unsubscribe']) assert.equal(main(await read(`dist/${page}/index.html`)),main(await read(`${page}/index.html`)),page);
  for(const page of pages) {
    const source=(await read(`${page}/index.html`)).replace(/(src|href)="((?:start|continue)\.(?:js|css)[^"]*)"/g,`$1="/${page}/$2"`);
    assert.deepEqual(scripts(await read(`dist/${page}/index.html`)),scripts(source),page);
  }
  for(const p of ['home.js','home.css','mobile.js','mobile.css','start/start.js','continue/continue.js','admin/index.html','pricing/credit-v2.json']) assert.equal(await read('dist/'+p),await read(p),p);
  const source=await read('home.js');
  assert.equal(await read('dist/assets/orbit/home-services.js'),source.slice(0,source.indexOf('\n(()=>{\n const $='))+'\n');
});
test('Public indexing restored while token and preference routes retain their policy',async()=>{
  for(const page of pages) {
    const robots=v=>v.match(/<meta name="robots"[^>]*>/g)||[];
    assert.deepEqual(robots(await read(`dist/${page}/index.html`)),robots(await read(`${page}/index.html`)),page);
  }
  for(const [,url] of (await read('dist/sitemap.xml')).matchAll(/<loc>([^<]+)<\/loc>/g)) assert.doesNotMatch(await read('dist'+new URL(url).pathname+'index.html'),/<meta[^>]+noindex/i);
  assert.equal((await read('dist/CNAME')).trim(),'orbit-reaches.com');
});
test('Production page links and assets all resolve inside the published artifact',async()=>{
  for(const page of ['',...pages]) {
    const value=await read(`dist/${page?page+'/':''}index.html`);
    for(const [,path] of value.matchAll(/(?:src|href|poster)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
      assert.ok((await stat(new URL('../dist'+path+(path.endsWith('/')?'index.html':''),import.meta.url))).size>0,`${page}: ${path}`);
    }
  }
});
test('Artifact excludes source, prototypes, private QA and credentials; release hashes are accurate',async()=>{
  const rootFiles=await readdir(new URL('../dist/',import.meta.url));
  for(const excluded of ['preview','test','src','scripts','artifacts','node_modules','.git','.github','package.json','package-lock.json','model','orbit.css','download.js','site.js']) assert.ok(!rootFiles.includes(excluded),excluded);
  const manifest=JSON.parse(await read('dist/site-release.json'));
  assert.equal(manifest.design,'orbit-continuum');
  assert.match(manifest.commit,/^[a-f0-9]{40}$/);
  for(const entry of manifest.files) {
    const bytes=await readFile(new URL('../dist/'+entry.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);
    assert.doesNotMatch(entry.path,/\.env|secret|\.pem|\.key|^artifacts\//i);
  }
});
