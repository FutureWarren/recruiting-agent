import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Local design routes only. Source content, form endpoints and service scripts
// remain authoritative; this renderer neither publishes nor changes billing.
export const pages = ['pricing', 'support', 'recruiting-guide', 'recruiting-news', 'privacy', 'terms', 'refunds', 'unsubscribe', 'start', 'continue'];
export const prefix = '/preview/continuum';
export function previewLinks(html) {
  return html.replace(/(<a\b[^>]*\bhref=")([^"\s]+)(")/g, (match, before, href, after) => {
    if (href === '/' || href.startsWith('/#') || pages.some(page => href === `/${page}/` || href.startsWith(`/${page}/#`))) {
      return before + prefix + href + after;
    }
    return match;
  });
}
const nav = page => `<a class="site-skip" href="#page-content">Skip to content</a><header class="shell topbar"><a class="brand" href="/" aria-label="Orbit home"><span class="orbit-mark" aria-hidden="true"></span>Orbit</a><nav class="nav" aria-label="Primary navigation"><a href="/#demo">Demo</a><a href="/pricing/"${page === 'pricing' ? ' aria-current="page"' : ''}>Pricing</a><a href="/support/"${page === 'support' ? ' aria-current="page"' : ''}>Support</a><a class="primary" href="/#download">Get Orbit <span aria-hidden="true">↗</span></a></nav></header>`;
const footer = `<footer class="site-footer"><div class="shell footer-inner"><a class="brand" href="/"><span class="orbit-mark" aria-hidden="true"></span>Orbit</a><div class="footer-links"><a href="/pricing/">Pricing</a><a href="/support/">Support</a><a href="/recruiting-guide/">Recruiting guide</a><a href="/recruiting-news/">News</a><a href="/start/">Desktop link</a><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a><a href="/refunds/">Refunds</a><a href="/unsubscribe/">Email preferences</a></div></div><div class="shell copyright">© 2026 Orbit · Operated by Angelic</div></footer>`;

export async function buildCompanionPages() {
  for (const page of pages) {
    let html = await readFile(`${page}/index.html`, 'utf8');
    // Relative assets in the two handoff pages must still use their originals.
    html = html.replace(/(src|href)="((?:start|continue)\.(?:js|css)[^"]*)"/g, `$1="/${page}/$2"`);
    html = html.replace('<head>', '<head>\n<script src="/preview/guard.js"></script>\n<link rel="stylesheet" href="/site.css">')
      .replace(/<meta name="robots"[^>]*>/g, '')
      .replace('</head>', `<meta name="robots" content="noindex,nofollow"><link rel="stylesheet" href="${prefix}/pages.css"></head>`)
      .replace(/(<meta name="theme-color" content=")[^"]+/, '$1#090a0e')
      .replace('<body>', `<body class="orbit-pages page-${page}">`);
    if (page.startsWith('recruiting-')) {
      html = html.replace(/<nav>[\s\S]*?<\/nav>/, nav(page));
    } else {
      html = html.replace(/<header\b[\s\S]*?<\/header>/, nav(page));
    }
    html = html.replace(/<footer>[\s\S]*?<\/footer>/, '');
    html = html.replace('</body>', footer + '\n</body>');
    html = html.replace(/<main\b([^>]*)>/, (match, attrs) => /\bid=/.test(attrs) ? `<main${attrs} tabindex="-1">` : `<main${attrs} id="page-content" tabindex="-1">`);
    // The preferences form's established main ID is retained.
    if (page === 'unsubscribe') html = html.replace('href="#page-content"', 'href="#main"');
    // Only visual labels change case. Legal prose and executable scripts stay intact.
    html = html.replace('ORBIT / STUDENT RECRUITING GUIDE', 'Student recruiting guide')
      .replace('ORBIT RECRUITING RADAR', 'Recruiting resources')
      .replace('ORBIT / HANDOFF', 'Desktop link')
      .replace('>READY<', '>Ready<')
      .replace('>DESKTOP HANDOFF<', '>Desktop handoff<');
    html = previewLinks(html);
    await mkdir(`preview/continuum/${page}`, { recursive: true });
    await writeFile(`preview/continuum/${page}/index.html`, html);
  }
}
