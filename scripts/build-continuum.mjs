import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { buildCompanionPages, previewLinks } from './build-continuum-pages.mjs';
import { closingMark, personalDemo } from './continuum-visuals.mjs';

// Build a concise local preview from the retained Orbit page. Installer,
// attribution, handoff and legal content remain the original implementation.
let html = await readFile('preview/signature/index.html', 'utf8');
html = html.replace('<body>', '<body class="continuum continuum-dark"><div class="ambient-orbit" data-ambient-scene aria-hidden="true"><canvas></canvas><div class="ambient-fallback"><i></i></div></div>')
  .replace('href="/preview/signature/signature.css"', 'href="/preview/signature/signature.css"\n><link rel="stylesheet" href="/preview/continuum/continuum.css"')
  .replace('data-signature-scene', 'data-continuum-scene')
  .replace('src="/home.js?v=acquisition-v2-20261013"', 'src="/preview/continuum/home-services.js"')
  .replace('src="/media/3d/orbit-signature.js"', 'src="/preview/continuum/assets/continuum.js"')
  .replace('<title>Orbit — Your AI recruiting employee</title>', '<title>Orbit — A little closer</title>')
  .replace('Your AI recruiting employee.</div>', 'Your ambition. In motion.</div>')
  .replace('<a href="#how">How it works</a><a href="#demo">Watch demo</a>', '<a href="#demo">Demo</a><a href="#numbers">Results</a>')
  .replace('<div class="kicker">See the product</div>', '')
  .replace('Your brief becomes research, work-email discovery, and a personalized introduction. See the full walkthrough.', 'From finding the right person to a draft ready for your review.')
  .replace('or explore the workflow above.', 'or read the email example below.')
  .replace('<div class="kicker">Think beyond your circle</div>', '')
  .replace('<section class="final" id="download">', '<section class="final closing-section" id="download">')
  .replace('<span class="orbit-mark" aria-hidden="true"></span><h2>Put Orbit to work.</h2>', `${closingMark}<h2>Your next conversation<br><span>starts here.</span></h2>`)
  .replace('A little more time for everything else.', 'Mac + Windows. 100 free Orbit Credits to start.');

// The Hero header and its 3D scene are deliberately unchanged. Company examples
// sit directly after the Hero, outside its animation stage, followed by Demo.
html = html.replace('</div><section class="company-section hero-companies"', '</div></div><section class="company-section hero-companies"')
  .replace('</p></div></section></div>\n<section id="demo"', '</p></div></section>\n<section id="demo"');
html = html.replace(/<section id="how"[\s\S]*?<\/section>/, '');
html = html.replace(/<section class="stats"[\s\S]*?<\/section>/, `<section class="stats concise-results" id="numbers"><div class="shell">
  <div class="results-heading motion-reveal"><h2>Less legwork.<br><span>More introductions.</span></h2><p>Research, email discovery and a personal draft.<br>One task, instead of a dozen tabs.</p></div>
  <div class="stats-grid">
    <article class="stat motion-reveal"><span class="stat-number">≈90<small>/hr</small></span><h3>Outreach emails in an internal test.</h3><p>Team-reported speed, not an independent benchmark.</p></article>
    <article class="stat motion-reveal"><span class="stat-number">100</span><h3>Drafts prepared in one task.</h3><p>Earlier beta results. Drafts, not confirmed sends.</p></article>
  </div>
  <details class="results-context"><summary>About these numbers</summary><p>Internal speed reference supplied September 28, 2026. The 100-draft result appeared in two earlier beta task-result screens; it is not a per-hour rate. Results are not a performance guarantee: research, email availability and review time affect speed. Orbit Credits are not an email count. <a href="/pricing/">Plans and credit details.</a></p></details>
</div></section>`);
html = html.replace(/<section id="profile"[\s\S]*?<\/section>/, personalDemo);
html = html.replace(/<section id="security"[\s\S]*?<\/section>/, '');
html = html.replace(/<section id="recruiting-resources"[\s\S]*?<\/section>/, '');
html = html.replace('<div class="footer-links">', '<div class="footer-links"><a href="/recruiting-guide/">Recruiting guide</a><a href="/recruiting-news/">News</a>');
await mkdir('preview/continuum/assets', { recursive: true });
await buildCompanionPages();
await writeFile('preview/continuum/index.html', previewLinks(html));
const home = await readFile('home.js', 'utf8');
const cut = home.indexOf('\n(()=>{\n const $=');
if (cut < 0) throw Error('Original home services boundary changed; inspect before rebuilding.');
await writeFile('preview/continuum/home-services.js', home.slice(0, cut) + '\n');
await build({ entryPoints: ['src/continuum.js'], bundle: true, splitting: true, minify: true, format: 'esm', outdir: 'preview/continuum/assets', legalComments: 'linked', chunkNames: '[name]-[hash]' });
await copyFile('node_modules/three/LICENSE', 'preview/continuum/assets/THREE-LICENSE.txt');
console.log('Built complete local Orbit preview: http://127.0.0.1:8767/preview/continuum/');
