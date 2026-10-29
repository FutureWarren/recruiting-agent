import { readFile, writeFile, mkdir, copyFile, cp, mkdtemp, rename, rm, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { pages } from './build-continuum-pages.mjs';
import './build-continuum.mjs';
import './build-signature.mjs';

// Publish only the owner-approved Continuum design. Keep the local review routes
// and their write guard separate from the public, working handoff pages.
const root = resolve('.');
const staging = await mkdtemp(join(root, '.orbit-publish-'));
const assets = join(staging, 'assets/orbit');
await mkdir(assets, { recursive: true });
const copy = async (from, to = from) => {
  await mkdir(resolve(staging, to, '..'), { recursive: true });
  await copyFile(from, join(staging, to));
};
const publicPath = html => html
  .replace('<script src="/preview/guard.js"></script>', '')
  .replaceAll('/preview/signature/signature.css', '/assets/orbit/signature.css')
  .replaceAll('/preview/continuum/assets/', '/assets/orbit/')
  .replaceAll('/preview/continuum/home-services.js', '/assets/orbit/home-services.js')
  .replaceAll('/preview/continuum/continuum.css', '/assets/orbit/continuum.css')
  .replaceAll('/preview/continuum/pages.css', '/assets/orbit/pages.css')
  .replaceAll('/preview/continuum/', '/');
try {
  // Existing business services are copied unchanged. Admin is not redesigned.
  for (const dir of [...pages, 'admin', 'docs']) await cp(dir, join(staging, dir), { recursive: true });
  for (const file of ['CNAME', 'robots.txt', 'sitemap.xml', 'home.css', 'home.js', 'mobile.css', 'mobile.js', 'site.css']) await copy(file);
  for (const file of await readdir('media')) {
    if (/\.(mp4|jpg|png|svg|webp)$/.test(file)) await copy(`media/${file}`);
  }
  await copy('preview/signature/signature.css', 'assets/orbit/signature.css');
  await copy('preview/continuum/continuum.css', 'assets/orbit/continuum.css');
  await copy('preview/continuum/pages.css', 'assets/orbit/pages.css');
  await copy('preview/continuum/home-services.js', 'assets/orbit/home-services.js');
  await copy('node_modules/three/LICENSE', 'assets/orbit/THREE-LICENSE.txt');
  await build({ entryPoints: ['src/continuum.js'], bundle: true, splitting: true,
    minify: true, format: 'esm', outdir: assets, legalComments: 'linked', chunkNames: '[name]-[hash]' });
  const versionAssets = async html => {
    for (const match of [...html.matchAll(/(?:src|href)="(\/assets\/orbit\/[^"?]+)"/g)]) {
      const digest = createHash('sha256').update(await readFile(join(staging, match[1]))).digest('hex').slice(0,12);
      html = html.replaceAll(`"${match[1]}"`, `"${match[1]}?v=${digest}"`);
    }
    return html;
  };
  let homepage = publicPath(await readFile('preview/continuum/index.html', 'utf8'))
    .replace('<meta name="theme-color" content="#f5f5f0">', '<meta name="theme-color" content="#090a0e">');
  await writeFile(join(staging, 'index.html'), await versionAssets(homepage));
  for (const page of pages) {
    const original = await readFile(`${page}/index.html`, 'utf8');
    let html = publicPath(await readFile(`preview/continuum/${page}/index.html`, 'utf8'));
    // Restore each route's actual indexing policy, including noindex on token /
    // preferences pages. Never publish the preview's blanket noindex,nofollow.
    html = html.replace(/<meta name="robots"[^>]*>/g, '');
    const robots = original.match(/<meta name="robots"[^>]*>/g) || [];
    html = html.replace('</head>', robots.join('\n') + '</head>');
    if (!html.includes('rel="canonical"')) html = html.replace('</head>', `<link rel="canonical" href="https://orbit-reaches.com/${page}/"></head>`);
    await writeFile(join(staging, page, 'index.html'), await versionAssets(html));
  }
  const files = [];
  async function collect(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = prefix + entry.name;
      if (entry.isDirectory()) await collect(join(dir, entry.name), path + '/');
      else files.push({ path, sha256: createHash('sha256').update(await readFile(join(dir, entry.name))).digest('hex') });
    }
  }
  await collect(staging);
  const commit = execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim();
  await writeFile(join(staging, 'site-release.json'), JSON.stringify({ design:'orbit-continuum', commit, files:files.sort((a,b)=>a.path.localeCompare(b.path)) }, null, 2) + '\n');
  await writeFile(join(staging, '.nojekyll'), '');
  // dist is generated output only; never remove or overwrite source/preview data.
  await rm(join(root, 'dist'), { recursive:true, force:true });
  await rename(staging, join(root, 'dist'));
  console.log(`Built approved production site: ${files.length} public files → dist/ (${commit.slice(0,8)})`);
} catch (error) {
  await rm(staging, { recursive:true, force:true });
  throw error;
}
