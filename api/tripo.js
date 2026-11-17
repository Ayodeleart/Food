// Vercel serverless function: turns a product picture into a 3D model (.glb) with Tripo.
// Set TRIPO_API_KEY in Vercel > Settings > Environment Variables (optional: TRIPO_MODEL to pick a Tripo model version).
//   POST { image_url }          -> starts a job, returns { task_id }
//   GET  ?id=<task>&item=<id>   -> { status, progress }; when finished it saves the .glb to Supabase storage and returns { status:'success', url }
const SB = 'https://fubhpawdzzjutsfzyzhz.supabase.co', SBK = 'sb_publishable_YCZHLx7xjXJtnwoJ7amhZg_NiHiJ0mm', BUCKET = 'food-menu';
const TRIPO = 'https://openapi.tripo3d.ai/v3';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.TRIPO_API_KEY;
  if (!key) return res.status(500).json({ error: 'TRIPO_API_KEY is not set on the server' });
  const origin = req.headers.origin || '';
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Forbidden' }); } catch (e) { return res.status(403).json({ error: 'Forbidden' }); } }
  const auth = { Authorization: 'Bearer ' + key };

  try {
    if (req.method === 'POST') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
      const img = String((b && b.image_url) || '');
      if (!img.startsWith(SB + '/storage/')) return res.status(400).json({ error: 'Use a picture that is already uploaded' });
      const r = await fetch(TRIPO + '/generation/image-to-model', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: img, model: process.env.TRIPO_MODEL || 'P2-20260801' }) });
      const j = await r.json().catch(() => ({}));
      const id = j && j.data && j.data.task_id;
      if (!r.ok || !id) return res.status(502).json({ error: (j && (j.message || j.error)) || 'Tripo would not start the job (check the key and credits)' });
      return res.status(200).json({ task_id: id });
    }
    if (req.method === 'GET') {
      const id = String(req.query.id || ''), item = String(req.query.item || '');
      if (!/^[\w-]+$/.test(id) || !/^[\w-]+$/.test(item)) return res.status(400).json({ error: 'Bad request' });
      const r = await fetch(TRIPO + '/tasks/' + id, { headers: auth });
      const j = await r.json().catch(() => ({}));
      const d = (j && j.data) || {};
      if (!r.ok) return res.status(502).json({ error: (j && j.message) || 'Could not check the job' });
      if (d.status !== 'success') {
        if (['failed', 'cancelled', 'banned', 'expired'].includes(d.status)) return res.status(200).json({ status: 'failed' });
        return res.status(200).json({ status: 'running', progress: d.progress || 0 });
      }
      const mu = d.output && (d.output.model_url || d.output.pbr_model || d.output.model);
      if (!mu) return res.status(502).json({ error: 'Tripo finished but sent no model' });
      const f = await fetch(mu); if (!f.ok) return res.status(502).json({ error: 'Could not download the model' });
      const buf = Buffer.from(await f.arrayBuffer());
      const path = 'models/items-' + item + '.glb';
      const up = await fetch(SB + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'POST',
        headers: { apikey: SBK, Authorization: 'Bearer ' + SBK, 'Content-Type': 'model/gltf-binary', 'x-upsert': 'true', 'cache-control': 'max-age=3600' }, body: buf });
      if (!up.ok) return res.status(502).json({ error: 'Could not save the model: ' + (await up.text()).slice(0, 120) });
      const url = SB + '/storage/v1/object/public/' + BUCKET + '/' + path + '?v=' + Date.now();
      const reg = await fetch(SB + '/rest/v1/menu_images?on_conflict=key', { method: 'POST',
        headers: { apikey: SBK, Authorization: 'Bearer ' + SBK, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: 'models/items/' + item, image_url: url, updated_at: new Date().toISOString() }]) });
      if (!reg.ok) return res.status(502).json({ error: 'Model saved but could not be linked: ' + (await reg.text()).slice(0, 120) });
      return res.status(200).json({ status: 'success', url });
    }
    res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'GET or POST only' });
  } catch (e) { return res.status(502).json({ error: 'Could not reach Tripo' }); }
};
