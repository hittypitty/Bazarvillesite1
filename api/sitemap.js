// Dynamic sitemap: static pages + every published product (read from Supabase), served at /sitemap.xml
const SITE = "https://www.bazarville.com";
const STATIC = [["/",1.0],["/products",0.9],["/galaxy",0.8],["/about",0.6],["/contact",0.6],["/track",0.4],["/privacy",0.3]];
module.exports = async (req, res) => {
  let urls = STATIC.map(([p, pr]) => ({ loc: SITE + p, pr }));
  try {
    const cfg = require("fs").readFileSync(require("path").join(process.cwd(), "assets/supabase-config.js"), "utf8");
    const url = /SUPABASE_URL\s*=\s*"([^"]+)"/.exec(cfg)[1], key = /SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/.exec(cfg)[1];
    const r = await fetch(`${url}/rest/v1/products?select=id,status&order=id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) (await r.json()).filter(p => !p.status || p.status === "published").forEach(p => urls.push({ loc: `${SITE}/product?id=${p.id}`, pr: 0.7 }));
  } catch (e) { /* fall back to the static pages only */ }
  const today = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pr}</priority></url>`).join("\n") + `\n</urlset>\n`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
};
