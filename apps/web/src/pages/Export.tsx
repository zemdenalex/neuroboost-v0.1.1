import { useEffect, useState } from 'react';
import { API_BASE } from '../api';

type DryRunItem = { path: string; action: 'create' | 'update'; preview?: string };

export default function ExportPanel() {
  const [items, setItems] = useState<DryRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
    
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/export/dry-run`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const normalized = Array.isArray(j.files)
          ? j.files.map((f: any) => ({
              path: f.path ?? f.relPath ?? '',
              action: f.action ?? '',
              bytes: f.bytes ?? 0
            }))
          : [];
        setItems(normalized);
      } catch (e:any) {
        setErr(e.message || String(e));
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="font-mono min-h-screen bg-black text-zinc-100">
      <header className="flex items-center justify-between p-2 border-b border-zinc-800">
        <div className="font-semibold">NeuroBoost — Export (dry-run)</div>
        <a className="underline" href="#/">Back</a>
      </header>

      <div className="p-4 space-y-4 text-sm">
        <div className="border border-yellow-600/40 bg-yellow-900/20 rounded-md p-3">
          <strong>Writes disabled.</strong> This build supports <em>dry-run only</em>.
          Files are confined to <code>NeuroBoost/</code>. <span className="opacity-70">No deletions.</span>
        </div>

        {loading && <div>Loading…</div>}
        {err && <div className="text-red-400">Error: {err}</div>}

        {!loading && !err && (
          <ul className="divide-y divide-zinc-800">
            {items.map((it, i) => (
              <li key={i} className="py-2 flex items-center gap-3">
                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200">{it.action}</span>
                <code className="text-zinc-300">{it.path}</code>
              </li>
            ))}
            {!items.length && <li className="py-2 opacity-70">No pending writes in dry-run.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
