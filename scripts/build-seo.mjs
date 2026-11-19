import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'vite';
import { dirname } from 'node:path';
import { indexablePages, routeSeo, SITE_URL, SOCIAL_IMAGE, IMAGE_ALT } from '../src/lib/seo.ts';

// Compile the same pure public components used by the app. The separate entry
// deliberately excludes its wallet providers, private workspaces and live data.
await build({
  configFile: false,
  logLevel: 'warn',
  esbuild: { jsx: 'automatic' },
  build: {
    ssr: 'src/prerender.tsx',
    outDir: 'dist-ssr',
    target: 'node24',
    rollupOptions: { output: { entryFileNames: 'public-pages.mjs' } },
  },
});
const { renderPublicPage } = await import('../dist-ssr/public-pages.mjs');

const escape = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const template = await readFile('dist/index.html', 'utf8');
function render(path, publicPage = false) {
  const meta = routeSeo(path);
  const head = [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}">`,
    `<meta name="robots" content="${meta.robots}">`,
    ...(publicPage ? [`<link rel="canonical" href="${meta.canonical}">`, `<meta property="og:url" content="${meta.canonical}">`] : []),
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Bittrees Governance">',
    '<meta property="og:locale" content="en_US">',
    `<meta property="og:title" content="${escape(meta.title)}">`,
    `<meta property="og:description" content="${escape(meta.description)}">`,
    `<meta property="og:image" content="${SOCIAL_IMAGE}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${IMAGE_ALT}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escape(meta.title)}">`,
    `<meta name="twitter:description" content="${escape(meta.description)}">`,
    `<meta name="twitter:image" content="${SOCIAL_IMAGE}">`,
    `<meta name="twitter:image:alt" content="${IMAGE_ALT}">`,
  ].join('\n    ');
  const content = publicPage ? renderPublicPage(path) : '';
  return template.replace(/<title>.*?<\/title>/s,'').replace(/<meta name="description"[^>]*>/,'').replace('</head>',`${head}\n</head>`).replace('<div id="root"></div>',`<div id="root">${content}</div>`);
}
await mkdir('dist/seo', {recursive:true});
for(const path of Object.keys(indexablePages)) {
  const file=path==='/' ? 'dist/index.html' : `dist/seo/${path.slice(1)}.html`;
  await mkdir(dirname(file), {recursive:true});
  await writeFile(file, render(path,true));
}
await writeFile('dist/seo/workspace.html',render('/workspace'));
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(indexablePages).map(p=>`\n  <url><loc>${SITE_URL}${p}</loc></url>`).join('')}\n</urlset>\n`);
console.log(`Prerendered approved content and metadata for ${Object.keys(indexablePages).length} public pages; private workspaces and unapproved record pages remain excluded from sitemap.`);
