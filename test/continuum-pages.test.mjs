import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pages, previewLinks } from '../scripts/build-continuum-pages.mjs';
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
const main = html => html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)[1];
const scripts = html => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m => !m[1].includes('/preview/guard.js')).map(m => [m[1], m[2]]);

test('All ten public companion pages use local navigation, shared dark skin and write guard', async () => {
  for (const page of pages) {
    const html = await read(`preview/continuum/${page}/index.html`);
    assert.match(html, /class="orbit-pages page-/);
    assert.match(html, /href="\/preview\/continuum\/pages.css"/);
    assert.match(html, /content="noindex,nofollow"/);
    assert.ok(html.indexOf('/preview/guard.js') < html.indexOf('</head>'));
    assert.match(html, /aria-label="Primary navigation"/);
    assert.match(html, /class="site-footer"/);
    assert.doesNotMatch(html, /<a\b[^>]*href="\/(?:pricing|privacy|terms|support|refunds|recruiting-news|recruiting-guide|unsubscribe|start)\//);
    for (const [, path] of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
      assert.ok((await stat(new URL('..' + path + (path.endsWith('/') ? 'index.html' : ''), import.meta.url))).size > 0, `${page}: ${path}`);
    }
  }
});
test('Plan prices, allowances, billing disclosures, legal prose and form content are retained', async () => {
  for (const page of ['pricing', 'support', 'terms', 'privacy', 'refunds', 'unsubscribe']) {
    const before = await read(`${page}/index.html`), after = await read(`preview/continuum/${page}/index.html`);
    assert.equal(main(after), main(previewLinks(before)), page);
  }
});
test('Source commercial pages and service scripts are not changed by the redesign', async () => {
  for (const file of [...pages.map(p => `${p}/index.html`), 'site.css', 'start/start.js', 'continue/continue.js', 'admin/index.html']) {
    assert.equal(await read(file), execFileSync('git', ['show', 'HEAD:' + file], { encoding:'utf8' }), file);
  }
});
test('Inline form and article scripts remain intact; handoff files use original services', async () => {
  for (const page of pages) {
    let source = await read(`${page}/index.html`);
    source = source.replace(/(src|href)="((?:start|continue)\.(?:js|css)[^"]*)"/g, `$1="/${page}/$2"`);
    assert.deepEqual(scripts(await read(`preview/continuum/${page}/index.html`)), scripts(source), page);
  }
});
test('Shared design covers mobile, reduced motion, keyboard focus and every commercial card', async () => {
  const css = await read('preview/continuum/pages.css');
  for (const text of ['color-scheme:dark', '--bg:#090a0e', '.plan.featured', '.credit-stage', '.legal-card', '.contact-card', '.preferences .panel', '.page-start', '.page-continue', 'prefers-reduced-motion:reduce', ':focus-visible', '@media(max-width:380px)', '.site-skip:focus']) assert.ok(css.includes(text), text);
});
