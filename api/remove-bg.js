// Vercel serverless function: removes an image background via remove.bg.
// The key is read from the REMOVE_BG_API_KEY environment variable (set it in Vercel > Settings > Environment Variables).
const MAX = 4.4 * 1024 * 1024; // Vercel request body limit is 4.5 MB

function readBody(req) {
  return new Promise((ok, bad) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX) { bad(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', bad);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'POST only' }); }
  const key = process.env.REMOVE_BG_API_KEY;
  if (!key) return res.status(500).json({ error: 'REMOVE_BG_API_KEY is not set on the server' });

  // Only accept calls made from this same site (blocks other websites from spending your credits).
  const origin = req.headers.origin || '';
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Forbidden' }); }
    catch (e) { return res.status(403).json({ error: 'Forbidden' }); }
  }

  let buf;
  try { buf = Buffer.isBuffer(req.body) && req.body.length ? req.body : await readBody(req); }
  catch (e) { return res.status(413).json({ error: 'Image is too large' }); }
  if (!buf || !buf.length) return res.status(400).json({ error: 'No image received' });

  const type = String(req.headers['content-type'] || 'image/jpeg').split(';')[0];
  const fd = new FormData();
  fd.append('image_file', new Blob([buf], { type }), 'image');
  fd.append('size', 'auto');
  fd.append('format', 'png');

  let r;
  try { r = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': key }, body: fd }); }
  catch (e) { return res.status(502).json({ error: 'Could not reach the background removal service' }); }
  if (!r.ok) {
    let msg = 'Background removal failed';
    try { const j = await r.json(); msg = (j.errors && j.errors[0] && j.errors[0].title) || msg; } catch (e) {}
    return res.status(r.status === 402 ? 402 : 502).json({ error: msg });
  }
  const out = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(out);
};
