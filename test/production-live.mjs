// Read-only post-deploy verification. Never submit handoff, analytics or forms.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const expected=JSON.parse(await readFile(new URL('../dist/site-release.json',import.meta.url),'utf8'));
const origin='https://orbit-reaches.com';
const get=async path=>{
  const r=await fetch(origin+path+(path.includes('?')?'&':'?')+'release_check='+expected.commit,{signal:AbortSignal.timeout(20000)});
  assert.ok(r.ok,`${path}: HTTP ${r.status}`);return r;
};
const actual=await (await get('/site-release.json')).json();
assert.equal(actual.commit,expected.commit,'GitHub Pages is still serving another commit');
for(const entry of expected.files.filter(f=>/\.html$|\.css$|\.js$|CNAME$/.test(f.path))) {
  const bytes=Buffer.from(await (await get('/'+entry.path)).arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);
}
console.log(`PASS live site: ${actual.commit}; HTML/CSS/JS hashes match the approved artifact. No email or business write performed.`);
