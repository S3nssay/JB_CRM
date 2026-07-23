import { Router } from 'express';
import { pool } from './db';
import fs from 'fs';
import path from 'path';

// KeyData parity: AML Sanction Screening ("Sanction List Search Import").
// Two modes: (1) import a sanctions list CSV and match party names locally;
// (2) screen via an external provider API (configurable via env). Batch-checks
// landlords / tenants / applicants / contractors and writes proof documents.

export const sanctionScreeningRoutes = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Not authorized' });
  next();
};

const PROOF_DIR = path.join(process.cwd(), 'uploads', 'sanction-proofs');

const normalize = (s: string): string =>
  (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// ─── CSV parsing (RFC-4180-ish, handles quoted fields) ───────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim().length));
}

// Map a header row to column indexes we care about (flexible for OFSI/OpenSanctions/custom)
function mapColumns(header: string[]) {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const k = h.toLowerCase().trim();
    if (idx.name === undefined && /^name\b|full.?name|^name 1$|^name$/.test(k)) idx.name = i;
    if (/name 2|name 3|name 4|name 5|name 6/.test(k)) idx['name' + k.slice(-1)] = i;
    if (/alias|a\.k\.a|aka/.test(k) && idx.aliases === undefined) idx.aliases = i;
    if (/country|nationality/.test(k) && idx.country === undefined) idx.country = i;
    if (/regime|program|list|sanction/.test(k) && idx.program === undefined) idx.program = i;
    if (/d\.?o\.?b|birth/.test(k) && idx.dob === undefined) idx.dob = i;
    if (/group ?id|reference|record|id$/.test(k) && idx.reference === undefined) idx.reference = i;
    if (/entity|group type|type/.test(k) && idx.type === undefined) idx.type = i;
  });
  return idx;
}

// ─── IMPORT A SANCTIONS LIST CSV ─────────────────────────────────────────────────
// POST /api/crm/sanctions/lists  { name, fileName?, csv }
sanctionScreeningRoutes.post('/sanctions/lists', requireAgent, async (req: any, res: any) => {
  const b = req.body || {};
  if (!b.name || !b.csv) return res.status(400).json({ error: 'name and csv are required' });
  const client = await pool.connect();
  try {
    const rows = parseCsv(b.csv);
    if (rows.length < 2) return res.status(400).json({ error: 'CSV has no data rows' });
    const header = rows[0];
    const looksLikeHeader = header.some(h => /name|country|regime|group|alias|reference/i.test(h));
    const idx = looksLikeHeader ? mapColumns(header) : { name: 0 };
    const dataRows = looksLikeHeader ? rows.slice(1) : rows;

    await client.query('BEGIN');
    const listRes = await client.query(
      `INSERT INTO sanction_list (name, source, file_name, entry_count, imported_by)
       VALUES ($1, 'csv', $2, 0, $3) RETURNING id`,
      [b.name, b.fileName || null, req.user?.id || null]
    );
    const listId = listRes.rows[0].id;

    let count = 0;
    for (const r of dataRows) {
      const nameParts = [idx.name, idx.name2, idx.name3, idx.name4, idx.name5, idx.name6]
        .filter(i => i !== undefined).map(i => (r[i as number] || '').trim()).filter(Boolean);
      const fullName = (nameParts.join(' ') || r[0] || '').trim();
      if (!fullName) continue;
      await client.query(
        `INSERT INTO sanction_list_entry
          (list_id, full_name, normalized_name, entity_type, aliases, country, program, date_of_birth, reference)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          listId, fullName, normalize(fullName),
          idx.type !== undefined ? (r[idx.type] || 'person') : 'person',
          idx.aliases !== undefined ? r[idx.aliases] : null,
          idx.country !== undefined ? r[idx.country] : null,
          idx.program !== undefined ? r[idx.program] : null,
          idx.dob !== undefined ? r[idx.dob] : null,
          idx.reference !== undefined ? r[idx.reference] : null,
        ]
      );
      count++;
    }
    await client.query(`UPDATE sanction_list SET entry_count = $1 WHERE id = $2`, [count, listId]);
    await client.query('COMMIT');
    res.status(201).json({ listId, entryCount: count });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[sanctions] import error', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Automated feed: latest consolidated sanctions targets (free, CC-BY-NC).
// Override with SANCTIONS_FEED_URL. Default = OpenSanctions consolidated sanctions CSV.
const DEFAULT_FEED_URL = 'https://data.opensanctions.org/datasets/latest/sanctions/targets.simple.csv';
const MAX_FEED_ENTRIES = parseInt(process.env.SANCTIONS_MAX_ENTRIES || '80000', 10);

// ─── AUTOMATED REFRESH (fetch latest sanctions list, no manual import) ───────────
// POST /api/crm/sanctions/refresh
sanctionScreeningRoutes.post('/sanctions/refresh', requireAgent, async (req: any, res: any) => {
  const feedUrl = process.env.SANCTIONS_FEED_URL || DEFAULT_FEED_URL;
  const client = await pool.connect();
  try {
    const resp = await fetch(feedUrl, { headers: { 'User-Agent': 'JB-CRM-AML/1.0' } });
    if (!resp.ok) return res.status(502).json({ error: `Feed responded ${resp.status}. Set SANCTIONS_FEED_URL to a reachable sanctions CSV.` });
    const text = await resp.text();
    const rows = parseCsv(text);
    if (rows.length < 2) return res.status(502).json({ error: 'Feed returned no usable rows.' });
    const idx = mapColumns(rows[0]);
    if (idx.name === undefined) idx.name = 0;
    const dataRows = rows.slice(1);

    await client.query('BEGIN');
    // Replace the previous automated list
    await client.query(`UPDATE sanction_list SET is_active = false WHERE source = 'opensanctions'`);
    const listRes = await client.query(
      `INSERT INTO sanction_list (name, source, file_name, entry_count, imported_by)
       VALUES ($1, 'opensanctions', $2, 0, $3) RETURNING id`,
      [`Consolidated sanctions (auto ${new Date().toISOString().slice(0, 10)})`, feedUrl, req.user?.id || null]
    );
    const listId = listRes.rows[0].id;

    let count = 0;
    for (const r of dataRows) {
      if (count >= MAX_FEED_ENTRIES) break;
      const fullName = (r[idx.name] || '').trim();
      if (!fullName) continue;
      await client.query(
        `INSERT INTO sanction_list_entry
          (list_id, full_name, normalized_name, entity_type, aliases, country, program, date_of_birth, reference)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          listId, fullName, normalize(fullName),
          idx.type !== undefined ? (r[idx.type] || 'person') : 'person',
          idx.aliases !== undefined ? r[idx.aliases] : null,
          idx.country !== undefined ? r[idx.country] : null,
          idx.program !== undefined ? r[idx.program] : null,
          idx.dob !== undefined ? r[idx.dob] : null,
          idx.reference !== undefined ? r[idx.reference] : null,
        ]
      );
      count++;
    }
    await client.query(`UPDATE sanction_list SET entry_count = $1 WHERE id = $2`, [count, listId]);
    await client.query('COMMIT');
    res.status(201).json({ listId, entryCount: count, truncated: count >= MAX_FEED_ENTRIES, source: feedUrl });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[sanctions] refresh error', err);
    res.status(500).json({ error: 'Refresh failed: ' + (err?.message || 'unknown') + '. The server may need outbound internet or a configured SANCTIONS_FEED_URL.' });
  } finally {
    client.release();
  }
});

// List imported sanctions lists
sanctionScreeningRoutes.get('/sanctions/lists', requireAgent, async (_req: any, res: any) => {
  try {
    const r = await pool.query(
      `SELECT id, name, source, file_name AS "fileName", entry_count AS "entryCount",
              is_active AS "isActive", imported_at AS "importedAt"
       FROM sanction_list ORDER BY imported_at DESC`);
    res.json(r.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── PROVIDER ADAPTER (external sanctions-screening API) ──────────────────────────
// Configured via env: SANCTIONS_PROVIDER_URL (match endpoint), SANCTIONS_PROVIDER_KEY, SANCTIONS_PROVIDER (label).
// Default shape targets an OpenSanctions/yente-style /match endpoint; adjust env to your provider.
function providerConfigured(): boolean {
  return !!process.env.SANCTIONS_PROVIDER_URL;
}
async function screenViaProvider(name: string): Promise<{ status: string; score: number; matchedName: string | null; details: any }> {
  const url = process.env.SANCTIONS_PROVIDER_URL!;
  const key = process.env.SANCTIONS_PROVIDER_KEY;
  const body = { queries: { q1: { schema: 'Person', properties: { name: [name] } } } };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `ApiKey ${key}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Provider ${resp.status}`);
  const data: any = await resp.json();
  const results = data?.responses?.q1?.results || data?.results || [];
  if (!results.length) return { status: 'clear', score: 0, matchedName: null, details: { provider: 'ok', results: 0 } };
  const top = results[0];
  const score = Math.round((top.score ?? 0) * 100);
  const status = score >= 90 ? 'match' : score >= 55 ? 'potential_match' : 'clear';
  return { status, score, matchedName: top.caption || top.name || null, details: top };
}

// Local CSV-list matching for one name
async function screenViaCsv(name: string, listId: number | null): Promise<{ status: string; score: number; matchedName: string | null; matchedEntryId: number | null; details: any }> {
  const norm = normalize(name);
  if (!norm) return { status: 'clear', score: 0, matchedName: null, matchedEntryId: null, details: {} };
  const tokens = norm.split(' ').filter(t => t.length > 1);
  const params: any[] = [];
  let where = '';
  if (listId) { params.push(listId); where = `WHERE e.list_id = $1 AND `; } else { where = `WHERE `; }
  // candidate entries sharing at least one token
  const like = tokens.map((_, i) => `e.normalized_name LIKE $${params.length + i + 1}`).join(' OR ');
  tokens.forEach(t => params.push(`%${t}%`));
  const cand = await pool.query(
    `SELECT e.id, e.full_name, e.normalized_name, e.aliases, e.country, e.program
     FROM sanction_list_entry e ${where}(${like || 'false'}) LIMIT 200`,
    params
  );
  let best: any = null, bestScore = 0;
  for (const e of cand.rows) {
    const eNorm: string = e.normalized_name;
    if (eNorm === norm) { best = e; bestScore = 100; break; }
    const eTokens = new Set(eNorm.split(' ').filter((t: string) => t.length > 1));
    const overlap = tokens.filter(t => eTokens.has(t)).length;
    const score = tokens.length ? Math.round((overlap / tokens.length) * 100) : 0;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  const status = bestScore >= 90 ? 'match' : bestScore >= 60 ? 'potential_match' : 'clear';
  return {
    status: best ? status : 'clear',
    score: best ? bestScore : 0,
    matchedName: best?.full_name || null,
    matchedEntryId: best?.id || null,
    details: best ? { country: best.country, program: best.program, aliases: best.aliases } : {},
  };
}

// Gather parties by type
async function gatherParties(types: string[]): Promise<Array<{ type: string; id: number; name: string }>> {
  const out: Array<{ type: string; id: number; name: string }> = [];
  const add = async (type: string, sql: string) => {
    try { const r = await pool.query(sql); for (const row of r.rows) if (row.name) out.push({ type, id: row.id, name: row.name }); }
    catch { /* table/column variance — skip this type */ }
  };
  if (types.includes('landlord')) await add('landlord', `SELECT id, name FROM landlord WHERE COALESCE(status,'active') <> 'archived'`);
  if (types.includes('tenant')) await add('tenant', `SELECT id, name FROM tenant`);
  if (types.includes('applicant')) await add('applicant', `SELECT id, full_name AS name FROM lead`);
  if (types.includes('contractor')) await add('contractor', `SELECT id, COALESCE(company_name, contact_name) AS name FROM contractor`);
  return out;
}

function writeProof(runId: number, party: { type: string; id: number; name: string }, result: any): string | null {
  try {
    if (!fs.existsSync(PROOF_DIR)) fs.mkdirSync(PROOF_DIR, { recursive: true });
    const stamp = result.screenedAtIso || '';
    const file = `run${runId}_${party.type}_${party.id}.html`;
    const html = `<!doctype html><meta charset="utf-8"><title>Sanction screening proof</title>
<body style="font-family:Arial,sans-serif;max-width:640px;margin:24px auto;color:#222">
<h2 style="color:#791E75">AML Sanction Screening — Proof of Check</h2>
<p><b>Screened:</b> ${stamp}</p>
<p><b>Party:</b> ${party.name} (${party.type} #${party.id})</p>
<p><b>Result:</b> <span style="text-transform:uppercase">${result.status}</span> (score ${result.score})</p>
${result.matchedName ? `<p><b>Closest list entry:</b> ${result.matchedName}</p>` : '<p>No sanctions-list match found.</p>'}
<p><b>Provider:</b> ${result.provider}</p>
<pre style="background:#f6f6f6;padding:8px;white-space:pre-wrap">${JSON.stringify(result.details || {}, null, 2)}</pre>
</body>`;
    fs.writeFileSync(path.join(PROOF_DIR, file), html, 'utf8');
    return `/uploads/sanction-proofs/${file}`;
  } catch (e: any) {
    console.error('[sanctions] proof write failed', e?.message);
    return null;
  }
}

// ─── RUN SCREENING (batch or single) ─────────────────────────────────────────────
// POST /api/crm/sanctions/screen
//   { provider?: 'csv'|'provider', listId?, partyTypes: [...], autoGenerateProof?, single?: {type,id,name} }
sanctionScreeningRoutes.post('/sanctions/screen', requireAgent, async (req: any, res: any) => {
  const b = req.body || {};
  const provider = b.provider === 'provider' ? 'provider' : 'csv';
  const autoProof = b.autoGenerateProof !== false;
  if (provider === 'provider' && !providerConfigured()) {
    return res.status(400).json({ error: 'Provider not configured. Set SANCTIONS_PROVIDER_URL (and SANCTIONS_PROVIDER_KEY), or use CSV mode.' });
  }
  try {
    // In CSV/list mode, default to the most recent active list if none specified.
    let listId = b.listId || null;
    if (provider === 'csv' && !listId) {
      const latest = await pool.query(`SELECT id FROM sanction_list WHERE is_active = true ORDER BY imported_at DESC LIMIT 1`);
      if (!latest.rows.length) {
        return res.status(400).json({ error: 'No sanctions list loaded. Click "Refresh sanctions data" first, or configure a live provider.' });
      }
      listId = latest.rows[0].id;
    }
    let parties: Array<{ type: string; id: number; name: string }>;
    if (b.single && b.single.name) {
      parties = [{ type: b.single.type || 'landlord', id: parseInt(b.single.id) || 0, name: b.single.name }];
    } else {
      const types = Array.isArray(b.partyTypes) && b.partyTypes.length ? b.partyTypes : ['landlord', 'tenant', 'applicant', 'contractor'];
      parties = await gatherParties(types);
    }

    const runRes = await pool.query(
      `INSERT INTO sanction_screening_run (run_type, provider, list_id, party_types, total_checked, status, auto_generate_proof, run_by)
       VALUES ($1,$2,$3,$4,0,'running',$5,$6) RETURNING id`,
      [b.single ? 'single' : 'batch', provider, listId,
       (b.partyTypes || ['landlord','tenant','applicant','contractor']).join(','), autoProof, req.user?.id || null]
    );
    const runId = runRes.rows[0].id;

    let matches = 0, potential = 0;
    const nowIso = new Date().toISOString();
    for (const p of parties) {
      let r: any;
      try {
        r = provider === 'provider'
          ? { ...(await screenViaProvider(p.name)), matchedEntryId: null }
          : await screenViaCsv(p.name, listId);
      } catch (e: any) {
        r = { status: 'error', score: 0, matchedName: null, matchedEntryId: null, details: { error: e?.message } };
      }
      if (r.status === 'match') matches++;
      else if (r.status === 'potential_match') potential++;
      const proofUrl = autoProof && r.status !== 'clear'
        ? writeProof(runId, p, { ...r, provider, screenedAtIso: nowIso })
        : null;
      await pool.query(
        `INSERT INTO sanction_screening_result
          (run_id, party_type, party_id, party_name, match_status, match_score, matched_entry_id, matched_name, provider, details, proof_document_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [runId, p.type, p.id || null, p.name, r.status, r.score ?? null, r.matchedEntryId ?? null, r.matchedName ?? null, provider, JSON.stringify(r.details || {}), proofUrl]
      );
    }

    await pool.query(
      `UPDATE sanction_screening_run SET total_checked=$1, total_matches=$2, total_potential=$3, status='completed' WHERE id=$4`,
      [parties.length, matches, potential, runId]
    );
    res.status(201).json({ runId, totalChecked: parties.length, matches, potential });
  } catch (err: any) {
    console.error('[sanctions] screen error', err);
    res.status(500).json({ error: err.message });
  }
});

// List screening runs
sanctionScreeningRoutes.get('/sanctions/runs', requireAgent, async (_req: any, res: any) => {
  try {
    const r = await pool.query(
      `SELECT id, run_type AS "runType", provider, party_types AS "partyTypes",
              total_checked AS "totalChecked", total_matches AS "totalMatches",
              total_potential AS "totalPotential", status, run_at AS "runAt"
       FROM sanction_screening_run ORDER BY run_at DESC LIMIT 50`);
    res.json(r.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Results for a run (default: only matches/potential; ?all=1 for everything)
sanctionScreeningRoutes.get('/sanctions/runs/:id/results', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const all = req.query.all === '1';
  try {
    const r = await pool.query(
      `SELECT id, party_type AS "partyType", party_id AS "partyId", party_name AS "partyName",
              match_status AS "matchStatus", match_score AS "matchScore", matched_name AS "matchedName",
              provider, proof_document_url AS "proofDocumentUrl", details, screened_at AS "screenedAt"
       FROM sanction_screening_result
       WHERE run_id = $1 ${all ? '' : `AND match_status <> 'clear'`}
       ORDER BY CASE match_status WHEN 'match' THEN 0 WHEN 'potential_match' THEN 1 WHEN 'error' THEN 2 ELSE 3 END, match_score DESC`,
      [id]
    );
    res.json(r.rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Provider status (for the UI to show automated-feed / live-provider / list availability)
sanctionScreeningRoutes.get('/sanctions/provider-status', requireAgent, async (_req: any, res: any) => {
  let activeList: any = null;
  try {
    const r = await pool.query(`SELECT id, name, entry_count AS "entryCount", imported_at AS "importedAt" FROM sanction_list WHERE is_active = true ORDER BY imported_at DESC LIMIT 1`);
    activeList = r.rows[0] || null;
  } catch { /* ignore */ }
  res.json({
    providerConfigured: providerConfigured(),
    provider: process.env.SANCTIONS_PROVIDER || null,
    feedUrl: process.env.SANCTIONS_FEED_URL || DEFAULT_FEED_URL,
    activeList,
  });
});
