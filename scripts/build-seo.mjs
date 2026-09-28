import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { publicPages, privatePages, routeSeo, SITE_URL, SOCIAL_IMAGE, IMAGE_ALT } from '../src/lib/seo.ts';
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
  const content = publicPage ? `<main style="max-width:900px;margin:4rem auto;padding:24px;font:20px Georgia,serif"><h1>${escape(meta.title.split(' | ')[0])}</h1><p>${escape(meta.description)}</p><nav aria-label="Governance"><a href="/">Home</a> · <a href="/proposals">Proposals</a> · <a href="/structure">Structure</a> · <a href="/contribute">Contribute</a></nav><noscript><p>Enable JavaScript for live data, wallet connections and interactive governance tools.</p></noscript></main>` : '';
  return template.replace(/<title>.*?<\/title>/s,'').replace(/<meta name="description"[^>]*>/,'').replace('</head>',`${head}\n</head>`).replace('<div id="root"></div>',`<div id="root">${content}</div>`);
}
await mkdir('dist/seo', {recursive:true});
for(const path of Object.keys(publicPages)) await writeFile(path==='/' ? 'dist/index.html' : `dist/seo/${path.slice(1)}.html`, render(path,true));
await writeFile('dist/seo/workspace.html',render('/workspace'));
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(publicPages).map(p=>`\n  <url><loc>${SITE_URL}${p}</loc></url>`).join('')}\n</urlset>\n`);
console.log(`Built initial-HTML metadata for ${Object.keys(publicPages).length} public pages; ${privatePages.length} workspace routes excluded from sitemap.`);
