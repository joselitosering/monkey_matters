- import React, { useRef, useState, useMemo, useEffect } from "react";
+ /* global React */
+ const { useRef, useState, useMemo, useEffect } = React;


// HHH Reactor — Hedge Hog Holdings Dashboard
// Build: v1.1 (beta)

- export default function HHHReactor() {
+ function HHHReactor() {
   // ...everything else unchanged...
 }

+ // expose to the window for index.html to mount
+ window.HHHReactor = HHHReactor;





  // ---- Build metadata ----
  const BUILD = "1.1";
  const RELEASE = "beta";

  // ---------------- Config ----------------
  const defaultConfig = {
    topLevelAccountName: "Top Level",
    summarySymbols: ["overview", "account total"],
    accountOrder: [
      "Top Level", "Income", "Hedge", "Savings", "Retirement", "Trust", "Crypto", "Piggy Bank", "Pocket Change"
    ],
    hiddenColumns: ["Account", "Description", "Cost Basis", "Security Type"],
    columnAliases: {
      MV: ["MV", "Market Value", "Total"],
      DayPL: ["Day P/L", "Day PnL", "Day Gain"],
      DayPct: ["Day %", "Day % Change", "Day Change %"],
      UnrlPL: ["Unrl P/L", "Unrealized P/L", "Unrealized"],
      UnrlPct: ["Unrl %", "Unrealized %"],
      Rating: ["Rating", "Score"],
      PctOfTotal: ["% of total", "% Of Total", "Pct of Total", "Allocation %", "% Total"],
      Date: ["Date", "As of", "As-of", "As Of", "Valuation Date", "Updated", "AsOf"]
    },
    palette: ['#4f46e5','#06b6d4','#16a34a','#ef4444','#f59e0b','#8b5cf6','#ec4899','#22d3ee','#93c5fd','#4ade80']
  };

  // ---------------- CSV Parser ----------------
  function parseCsv(text) {
    const matrix = [];
    let i = 0, field = "", row = [], inQ = false;
    while (i < text.length) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ""; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (c === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        row.push(field); matrix.push(row); row = []; field = ""; i++; continue;
      }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); matrix.push(row); }
    if (!matrix.length) return [];
    while (matrix.length && matrix[matrix.length - 1].every((x) => !String(x || "").trim())) matrix.pop();
    if (!matrix.length) return [];

    const headers = (matrix[0] || []).map((h) => String(h || "").trim());
    const out = [];
    let currentAccount = "";
    for (let r = 1; r < matrix.length; r++) {
      const raw = matrix[r] || [];
      const cells = Array.from({ length: headers.length }, (_, idx) => String(raw[idx] ?? "").trim());
      if (!cells.length || cells.every((c) => !c)) continue;
      // Section header: first cell has text, others blank
      if (cells[0] && cells.slice(1).every((c) => !c)) { currentAccount = cells[0]; continue; }
      const obj = {};
      for (let c = 0; c < headers.length; c++) obj[headers[c]] = cells[c] ?? "";
      if (!obj["Account"] && currentAccount) obj["Account"] = currentAccount;
      out.push(obj);
    }
    return out;
  }

  // ---------------- Loaders ----------------
  async function onFile(e) {
    try {
      setErrMsg("");
      const f = e.target.files?.[0];
      if (!f) return;
      const txt = await f.text();
      const objs = parseCsv(txt);
      setRows(objs || []);
      setCsvName(f.name);
    } catch (e2) {
      setErrMsg(`Could not read file: ${e2?.message || e2}`);
    }
  }

  async function loadFromUrl() {
    try {
      setErrMsg("");
      const url = urlRef.current?.value?.trim();
      if (!url) { setErrMsg("Enter a CSV URL"); return; }
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      const objs = parseCsv(txt);
      setRows(objs || []);
      setCsvName(url);
    } catch (e2) {
      setErrMsg(`Could not load URL: ${e2?.message || e2}`);
    }
  }

  // ---------------- Helpers ----------------
  function toNumber(x) { if (x == null) return 0; const s = String(x).trim(); if (!s) return 0; return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0; }
  function formatMoney(n) { const num = Number(n); const sign = Number.isFinite(num) && num < 0 ? "-" : ""; const abs = Number.isFinite(num) ? Math.abs(num) : 0; return sign + "$" + abs.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }
  function formatPct(n) { const x = Number(n); return (Number.isFinite(x) ? x : 0).toFixed(2) + "%"; }
  function signClass(n) { const x = Number(n); if (!Number.isFinite(x) || x === 0) return ""; return x < 0 ? "neg" : "pos"; }
  function isTickerHeader(header){ const h = String(header||"").toLowerCase(); return h === "symbol" || h === "ticker"; }
  function shouldColor(header){ const h = String(header||"").toLowerCase(); return h.includes("price chng") || h.includes("price change") || h === "day p/l" || h === "day %" || h === "unrl p/l" || h === "unrl %"; }

  function getAliased(row, canon){
    // Case-insensitive alias lookup across the row's keys
    const aliases = (defaultConfig.columnAliases[canon] || [canon]).map(a => String(a).toLowerCase());
    const keyMap = new Map(Object.keys(row).map(k => [String(k).toLowerCase(), k]));
    for (const a of aliases) {
      const realKey = keyMap.get(a);
      if (realKey && row[realKey] != null && row[realKey] !== "") return row[realKey];
    }
    return "";
  }
  function findSymKey(items) {
    const sample = items?.[0] || {};
    const keys = Object.keys(sample);
    return keys.find(k => ['symbol','ticker'].includes(String(k).toLowerCase())) || 'Symbol';
  }
  function lowerTrim(s){ return String(s||'').trim().toLowerCase(); }
  function accKey(s){ s = String(s || '').toLowerCase(); s = s.split(String.fromCharCode(160)).join(' '); s = s.trim().split(' ').filter(Boolean).join(' '); return s; }
  function normalizeSym(x){ return lowerTrim(x); }
  function findRowBySymbol(items, symbol){ const symKey = findSymKey(items||[]); const want = normalizeSym(symbol); return (items||[]).find(r => normalizeSym(r && r[symKey]) === want) || null; }

  function extractSummary(items) {
    const symKey = findSymKey(items||[]);
    const summaryRow = (items||[]).find(r => {
      const raw = r?.[symKey];
      const sym = String(raw || "").replace(/[\u00A0\u2000-\u200B]/g, ' ').trim().toLowerCase();
      return defaultConfig.summarySymbols.includes(sym);
    });
    if (!summaryRow) return null;
    const pctAliases = (defaultConfig.columnAliases.PctOfTotal || []).map(a => String(a).toLowerCase());
    let pctVal = 0; {
      const keyMap = new Map(Object.keys(summaryRow).map(k => [String(k).toLowerCase(), k]));
      for (const a of pctAliases) {
        const rk = keyMap.get(a);
        if (rk && summaryRow[rk] != null && String(summaryRow[rk]).trim() !== "") { pctVal = toNumber(summaryRow[rk]); break; }
      }
    }
    return {
      total: toNumber(getAliased(summaryRow, 'MV')),
      dayPL: toNumber(getAliased(summaryRow, 'DayPL')),
      dayPct: toNumber(getAliased(summaryRow, 'DayPct')),
      unrlPL: toNumber(getAliased(summaryRow, 'UnrlPL')),
      unrlPct: toNumber(getAliased(summaryRow, 'UnrlPct')),
      rating: getAliased(summaryRow, 'Rating'),
      pctOfTotal: pctVal
    };
  }

  // ---------------- Grouping & Summaries ----------------
  const accounts = useMemo(() => {
    const map = new Map();
    (rows||[]).forEach((r) => {
      const acct = String(r?.["Account"] || "(Unassigned)");
      if (!map.has(acct)) map.set(acct, []);
      map.get(acct).push(r);
    });
    return map;
  }, [rows]);

  const orderedAccounts = useMemo(() => {
    const entries = Array.from(accounts?.entries?.() || []);
    const order = (defaultConfig.accountOrder||[]).map(s => accKey(s));
    return entries.sort(([a], [b]) => {
      const ia = order.indexOf(accKey(a));
      const ib = order.indexOf(accKey(b));
      if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [accounts]);

  const summaries = useMemo(() => {
    const list = orderedAccounts || [];
    return list.map?.(([acct, items]) => {
      let s = extractSummary(items);
      const lower = accKey(acct);
      // If Pocket Change lacks an Account Total row, synthesize summary from the 'Pocket Change' row itself
      if (!s && lower === 'pocket change') {
        const pcRow = findRowBySymbol(items, 'Pocket Change');
        if (pcRow) {
          s = {
            total: toNumber(getAliased(pcRow, 'MV')),
            dayPL: toNumber(getAliased(pcRow, 'DayPL')),
            dayPct: toNumber(getAliased(pcRow, 'DayPct')),
            unrlPL: toNumber(getAliased(pcRow, 'UnrlPL')),
            unrlPct: toNumber(getAliased(pcRow, 'UnrlPct')),
            rating: getAliased(pcRow, 'Rating')
            // pctOfTotal intentionally omitted so downstream falls back to computed value
          };
        }
      }
      return [acct, s];
    }) || [];
  }, [orderedAccounts]);

  const grandTotal = useMemo(() => {
    const arr = summaries || [];
    return arr.reduce?.((sum, [, s]) => sum + (s ? s.total : 0), 0) || 0;
  }, [summaries]);

  // Helper used by Overview cards — FIXED (defined now)
  function getSummaryFor(name){
    const key = accKey(name);
    const entry = (summaries||[]).find(([acct]) => accKey(acct) === key);
    return entry ? entry[1] : null;
  }

  // Top Level summary for hero KPIs
  const topLevelItems = useMemo(() => {
    const name = accKey(defaultConfig.topLevelAccountName || 'Top Level');
    for (const [acct, items] of Array.from(accounts?.entries?.() || [])) {
      if (accKey(acct) === name) return items;
    }
    return [];
  }, [accounts]);
  const topSummary = useMemo(() => (topLevelItems?.length ? extractSummary(topLevelItems) : null), [topLevelItems]);

  // ---------------- Fast PIE chart (SVG) ----------------
  function PieChartSimple({ slices, size = 220 }) {
    const R = size / 2;
    const C = size / 2;
    const [progress, setProgress] = useState(0);
    const [hoverIdx, setHoverIdx] = useState(-1);

    useEffect(() => {
      let raf = 0, start;
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
      function step(ts){
        if (!start) start = ts;
        const t = Math.min(1, (ts - start) / 900);
        setProgress(easeOutCubic(t));
        if (t < 1) raf = requestAnimationFrame(step);
      }
      setProgress(0);
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [slices, size]);

    let acc = 0;
    const paths = [];
    (slices||[]).forEach((s, i) => {
      const startAcc = acc;
      const endAcc = acc + (s?.pct || 0);
      const visEnd = Math.min(endAcc, progress);
      const visFrac = Math.max(0, visEnd - startAcc);
      acc = endAcc;
      if (visFrac <= 0) return;
      const start = startAcc * 2 * Math.PI;
      const end = (startAcc + visFrac) * 2 * Math.PI;
      const x1 = C + R * Math.cos(start), y1 = C + R * Math.sin(start);
      const x2 = C + R * Math.cos(end),   y2 = C + R * Math.sin(end);
      const large = end - start > Math.PI ? 1 : 0;
      const isHover = hoverIdx === i;
      paths.push(
        <path
          key={i}
          d={`M${C},${C} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} z`}
          fill={s?.color || '#4f46e5'}
          style={{
            transition: 'transform 150ms, opacity 150ms',
            transformBox: 'fill-box',
            transformOrigin: `${C}px ${C}px`,
            transform: isHover ? 'scale(1.04)' : 'scale(1)',
            opacity: hoverIdx === -1 || isHover ? 1 : 0.5,
            cursor: 'pointer'
          }}
          onMouseEnter={() => setHoverIdx(i)}
          onMouseLeave={() => setHoverIdx(-1)}
        />
      );
    });

    const focus = hoverIdx >= 0 ? (slices||[])[hoverIdx] : null;
    const center1 = focus ? focus.label : 'Allocation';
    const center2 = focus ? `${(focus.pct*100).toFixed(1)}%` : `${Math.round(progress*100)}%`;

    return (
      <svg width={size} height={size} style={{display:'block'}}>
        {paths}
        <text x={C} y={C-4} textAnchor="middle" fill="#cbd5e1" fontSize="12">{center1}</text>
        <text x={C} y={C+14} textAnchor="middle" fill="#e5e7eb" fontSize="16" className="mono">{center2}</text>
      </svg>
    );
  }

  // ---------------- Render ----------------
  return (
    <div className="wrap">
      <style>{`
        :root{--bg:#0a0b0e;--fg:#e7eaf0;--sub:#94a3b8;--card:#10131a;--bd:#1f2736;--ok:#16a34a;--bad:#ef4444;--mut:#0d1117}
        *{box-sizing:border-box}
        html,body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 ui-sans-serif,system-ui,Segoe UI,Inter,Arial}
        .wrap{max-width:1400px;margin:auto;padding:20px}
        h1{font-size:22px;margin:0 0 10px}
        h2{font-size:14px;color:var(--sub);letter-spacing:.12em;text-transform:uppercase;margin:0 0 12px}
        .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:20px;margin:16px 0}
        .section-side{display:grid;grid-template-columns:2fr 1fr;gap:20px}
        .table-wrap{overflow-x:auto;border:1px solid var(--bd);border-radius:10px}
        table{width:100%;border-collapse:collapse;font-size:9pt}
        th, td{border-bottom:1px solid var(--bd);padding:6px 8px;text-align:left;white-space:normal;word-break:break-word}
        thead th{background:#0d1117;color:var(--sub);font-size:11px}
        .mono{font-variant-numeric:tabular-nums;font-family:ui-monospace,Menlo,Consolas,monospace}
        .pos{color:var(--ok)} .neg{color:var(--bad)}
        .muted{color:var(--sub)}
        .row{display:flex;gap:12px;align-items:center}
        input[type="text"], input[type="url"]{background:#0b0f17;color:#e7eaf0;border:1px solid var(--bd);border-radius:8px;padding:8px 10px}
        button{background:#0e7dd1;border:none;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
        button:disabled{opacity:.6;cursor:not-allowed}
        /* Template UI additions */
        .grid{display:grid;gap:10px}
        .grid.cols-2{grid-template-columns:repeat(2,minmax(220px,1fr))}
        .grid.cols-4{grid-template-columns:repeat(4,minmax(220px,1fr))}
        .grid.cols-6{grid-template-columns:repeat(6,minmax(140px,1fr))}
        .k{padding:10px;border:1px solid var(--bd);border-radius:10px;background:var(--mut)}
        .k .t{font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.12em}
        .k .v{font-variant-numeric:tabular-nums;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;margin-top:2px}
        .badge{border:1px solid var(--bd);border-radius:8px;padding:4px 8px;background:#0c1017;font-size:12px}
        .tag{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid var(--bd);font-size:12px;background:#0b0f17;color:#cbd5e1}
        .meter{display:flex;align-items:center;gap:8px}
        .meter .bar{flex:1;height:8px;border:1px solid var(--bd);border-radius:999px;background:#0b0f17;position:relative;overflow:hidden}
        .meter .bar i{position:absolute;left:0;top:0;bottom:0;background:#3b82f6}
        /* Full-width KPI grid */
        .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
        .kpi-grid.six{grid-template-columns:repeat(6,minmax(180px,1fr))}
        /* Overview card emphasis */
        #overview .k .v{font-size:26px}
      `}</style>

      <header className="row" style={{justifyContent:'space-between'}}>
        <h1>HHH Dashboard — Beta {BUILD}</h1>
        {csvName && <span className="muted">Loaded: <span className="mono">{csvName}</span></span>}
      </header>

      <section className="card" id="loaders">
        <div className="row" style={{flexWrap:'wrap'}}>
          <div>
            <div className="muted" style={{fontSize:12, marginBottom:6}}>Load CSV</div>
            <input type="file" accept=".csv,text/csv" onChange={onFile} />
          </div>
          <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
            <div>
              <div className="muted" style={{fontSize:12, marginBottom:6}}>or CSV URL</div>
              <input ref={urlRef} type="url" placeholder="https://.../dashboard.csv" style={{minWidth:320}} />
            </div>
            <button onClick={loadFromUrl}>Load URL</button>
          </div>
        </div>
        {errMsg && <div style={{color:'#ef4444', marginTop:10}}>{errMsg}</div>}
      </section>

      {rows?.length > 0 && (
        <>
          {/* Top Level Hero KPIs */}
          {topSummary && (
            <section className="card" id="top-level">
              <h2>Top Level</h2>
              <div className="kpi-grid six">
                <Kpi title="Total Market Value" value={formatMoney(topSummary.total)} tone={signClass(topSummary.total)} />
                <Kpi title="Day P/L" value={formatMoney(topSummary.dayPL)} tone={signClass(topSummary.dayPL)} />
                <Kpi title="Day %" value={formatPct(topSummary.dayPct)} tone={signClass(topSummary.dayPct)} />
                <Kpi title="Unrealized P/L" value={formatMoney(topSummary.unrlPL)} tone={signClass(topSummary.unrlPL)} />
                <Kpi title="Unrealized %" value={formatPct(topSummary.unrlPct)} tone={signClass(topSummary.unrlPct)} />
                <Kpi title="Rating" value={String(topSummary.rating||'—')} />
              </div>
            </section>
          )}

          {/* Overview */}
          <section className="card" id="overview">
            <h2>Overview</h2>
            <div className="grid cols-4">
              {['Income','Hedge','Savings','Retirement','Trust','Crypto','Piggy Bank','Pocket Change'].map((name) => {
                const isPC = accKey(name) === 'pocket change';
                let s = getSummaryFor(name);
                // Fallback: build Pocket Change summary directly from row if missing
                if (!s && isPC) {
                  const items = (() => {
                    const key=accKey('Pocket Change');
                    for (const [acct, it] of Array.from(accounts?.entries?.() || [])) { if (accKey(acct)===key) return it; }
                    return [];
                  })();
                  const pcRow = findRowBySymbol(items, 'Pocket Change');
                  if (pcRow) {
                    s = { total: toNumber(getAliased(pcRow, 'MV')), dayPL: toNumber(getAliased(pcRow,'DayPL')), dayPct: toNumber(getAliased(pcRow,'DayPct')), unrlPL: toNumber(getAliased(pcRow,'UnrlPL')), unrlPct: toNumber(getAliased(pcRow,'UnrlPct')), rating: getAliased(pcRow,'Rating') };
                  }
                }
                if (!s) return null;
                const anchor = isPC ? '#accounts' : '#acct-' + (String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''));
                return (
                  <a key={name} href={anchor} style={{textDecoration:'none', color:'inherit'}}>
                    <div className="k">
                      <div className="t">{name}</div>
                      <div className="v mono" style={{marginTop:6}}>{formatMoney(s.total)}</div>
                      {!isPC && (
                        <>
                          <div className="row" style={{marginTop:6, flexWrap:'wrap'}}>
                            <span className="badge mono">Day P/L: <span className={'mono '+signClass(s.dayPL)}>{formatMoney(s.dayPL)}</span></span>
                            <span className="badge mono">Day %: <span className={'mono '+signClass(s.dayPct)}>{formatPct(s.dayPct)}</span></span>
                            <span className="badge mono">Unrl P/L: <span className={'mono '+signClass(s.unrlPL)}>{formatMoney(s.unrlPL)}</span></span>
                            <span className="badge mono">Unrl %: <span className={'mono '+signClass(s.unrlPct)}>{formatPct(s.unrlPct)}</span></span>
                          </div>
                          <div style={{marginTop:8}}>
                            <div className="meter"><div className="bar"><i style={{width: `${Math.max(0, Math.min(100, Number(s.rating)||0))}%`}}/></div><span className="tag mono">{String(s.rating||'—')}</span></div>
                          </div>
                        </>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* Accounts (single table) + Allocation PIE */}
          <section className="card" id="accounts">
            <h2>Accounts</h2>
            <div className="section-side">
              {/* Left: single table of accounts */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Total</th>
                      <th>Day P/L</th>
                      <th>Day %</th>
                      <th>Unrl P/L</th>
                      <th>Unrl %</th>
                      <th>% of Total</th>
                      <th>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const TL = accKey(defaultConfig.topLevelAccountName || "Top Level");
                      const data = (summaries||[]).filter(([acct, s]) => s && accKey(acct) !== TL);
                      return data.map(([acct, s]) => {
                        let pct = Number.isFinite(s?.pctOfTotal) ? s.pctOfTotal : (grandTotal > 0 ? (s.total / grandTotal) * 100 : 0);
                        return (
                          <tr key={acct}>
                            <td><strong>{accKey(acct)==='pocket change' ? 'Cash' : acct}</strong></td>
                            <td>{formatMoney(s.total)}</td>
                            <td><span className={`mono ${signClass(s.dayPL)}`}>{formatMoney(s.dayPL)}</span></td>
                            <td><span className={`mono ${signClass(s.dayPct)}`}>{formatPct(s.dayPct)}</span></td>
                            <td><span className={`mono ${signClass(s.unrlPL)}`}>{formatMoney(s.unrlPL)}</span></td>
                            <td><span className={`mono ${signClass(s.unrlPct)}`}>{formatPct(s.unrlPct)}</span></td>
                            <td>{formatPct(pct)}</td>
                            <td>{s.rating || '—'}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Right: allocation PIE */}
              {(() => {
                const TL = accKey(defaultConfig.topLevelAccountName || 'Top Level');
                const data = (summaries||[]).filter(([acct,s])=> s && accKey(acct)!==TL);
                if (!data.length || grandTotal<=0) return (
                  <div className="muted">No allocation data</div>
                );
                const slices = data.map(([acct,s],i)=>{
                  let p = Number.isFinite(s?.pctOfTotal) ? s.pctOfTotal : (grandTotal>0 ? (s.total/grandTotal)*100 : 0);
                  const frac = Math.max(0, Math.min(1, p/100));
                  const label = accKey(acct) === 'pocket change' ? 'Cash' : acct;
                  return { label, pct: frac, color: defaultConfig.palette[i%defaultConfig.palette.length] };
                });
                return (
                  <div>
                    <div className="muted" style={{fontSize:12, marginBottom:6}}>Allocation</div>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <PieChartSimple slices={slices} />
                      <div>
                        {slices.map((sl,i)=> (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:12, marginBottom:6}}>
                            <span style={{width:10,height:10,background:sl.color,display:'inline-block',borderRadius:2}} />
                            <span style={{minWidth:140}}>{sl.label}</span>
                            <span className="mono" style={{color:'var(--sub)'}}>{(sl.pct*100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* Accounts Notes */}
            <div className="grid cols-2" style={{marginTop:12}}>
              <div className="k">
                <div className="t">Analysis</div>
                <div className="v" style={{fontSize:12,lineHeight:'1.5'}}>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.
                </div>
              </div>
              <div className="k">
                <div className="t">Action Items</div>
                <div className="v" style={{fontSize:12,lineHeight:'1.5'}}>
                  <ul style={{margin:'6px 0 0 16px'}}>
                    <li>Lorem ipsum dolor sit amet.</li>
                    <li>Consectetur adipiscing elit.</li>
                    <li>Sed do eiusmod tempor.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Per-account sections */}
          <div id="account-sections">
            {(orderedAccounts||[]).map(([acct, items]) => {
              const acctLower = accKey(acct);
              if (acctLower === accKey(defaultConfig.topLevelAccountName)) return null;
              if (acctLower === 'pocket change') return null; // PC has no detailed table section
              let headers = Object.keys(items?.[0] || {});
              headers = headers.filter(h => !defaultConfig.hiddenColumns.includes(h));

              // Helper to map header to canonical key
              const headerRole = (h) => {
                const L = String(h||"").toLowerCase();
                if (L === 'symbol' || L === 'ticker') return 'Symbol';
                for (const [canon, aliases] of Object.entries(defaultConfig.columnAliases)) {
                  if ((aliases||[]).map(a=>String(a).toLowerCase()).includes(L)) return canon;
                }
                return '';
              };

              const symKey = findSymKey(items||[]);
              return (
                <section key={acct} id={`acct-${String(acct).replace(/[^a-z0-9]+/gi,'-')}`} className="card">
                  <h2>{acct}</h2>
                  {(() => {
                    const sumEntry = (summaries||[]).find(([n]) => accKey(n)===acctLower);
                    const s = sumEntry ? sumEntry[1] : null;
                    if (!s) return null;
                    return (
                      <div className="grid cols-6" style={{marginBottom:8}}>
                        <div className="k"><div className="t">Market Value</div><div className="v mono">{formatMoney(s.total)}</div></div>
                        <div className="k"><div className="t">Day P/L</div><div className={'v mono '+signClass(s.dayPL)}>{formatMoney(s.dayPL)}</div></div>
                        <div className="k"><div className="t">Day %</div><div className={'v mono '+signClass(s.dayPct)}>{formatPct(s.dayPct)}</div></div>
                        <div className="k"><div className="t">Unrl P/L</div><div className={'v mono '+signClass(s.unrlPL)}>{formatMoney(s.unrlPL)}</div></div>
                        <div className="k"><div className="t">Unrl %</div><div className={'v mono '+signClass(s.unrlPct)}>{formatPct(s.unrlPct)}</div></div>
                        <div className="k"><div className="t">Rating</div><div className="row"><div className="meter"><div className="bar"><i style={{width:`${Math.max(0, Math.min(100, Number(s.rating)||0))}%`}}/></div><span className="tag mono">{String(s.rating||'—')}</span></div></div></div>
                      </div>
                    );
                  })()}
                  <div className="table-wrap" style={{marginTop:8}}>
                    <table>
                      <thead>
                        <tr>
                          {headers.map((h) => (<th key={h}>{h}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {(items||[]).map((r, i) => {
                          const raw = r?.[symKey];
                          const isSum = defaultConfig.summarySymbols.includes(String(raw||"").replace(/[  -​]/g,' ').trim().toLowerCase());
                          const rowStyle = isSum ? {fontWeight:'bold'} : undefined;
                          return (
                            <tr key={i} style={rowStyle}>
                              {headers.map((h) => {
                                const role = headerRole(h);
                                const val = r[h];
                                let content;
                                if (isSum) {
                                  if (role === 'Symbol') {
                                    content = 'Account Total';
                                  } else if (role === 'MV') {
                                    content = <span className="mono">{formatMoney(toNumber(val))}</span>;
                                  } else if (role === 'DayPL' || role === 'DayPct' || role === 'UnrlPL' || role === 'UnrlPct') {
                                    const num = toNumber(val);
                                    content = <span className={`mono ${signClass(num)}`}>{role.includes('Pct') ? formatPct(num) : formatMoney(num)}</span>;
                                  } else if (role === 'PctOfTotal') {
                                    const p = toNumber(val);
                                    content = <span className="mono">{formatPct(p)}</span>;
                                  } else {
                                    content = val;
                                  }
                                } else {
                                  content = isTickerHeader(h)
                                    ? <strong>{val}</strong>
                                    : shouldColor(h)
                                      ? <span className={`mono ${signClass(toNumber(val))}`}>{val}</span>
                                      : val;
                                }
                                return <td key={h+i}>{content}</td>;
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Notes panel (below table) */}
                  <div className="grid cols-2" style={{marginTop:8}}>
                    <div className="k">
                      <div className="t">Analysis</div>
                      <div className="v" style={{fontSize:12,lineHeight:'1.5'}}>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.
                      </div>
                    </div>
                    <div className="k">
                      <div className="t">Action Items</div>
                      <div className="v" style={{fontSize:12,lineHeight:'1.5'}}>
                        <ul style={{margin:'6px 0 0 16px'}}>
                          <li>Lorem ipsum dolor sit amet.</li>
                          <li>Consectetur adipiscing elit.</li>
                          <li>Sed do eiusmod tempor.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Debug self-tests (opt-in via ?debug=1) */}
          {(() => {
            try {
              if (typeof window === 'undefined') return null;
              const debug = new URLSearchParams(window.location.search).get('debug') === '1';
              if (!debug) return null;
              const tests = [];
              const pcEntry = (summaries||[]).find(([acct]) => accKey(acct)==='pocket change');
              const pcSummary = pcEntry ? pcEntry[1] : null;
              const topExists = !!topSummary;
              const overviewHasPC = !!pcSummary;
              const accountsHasCash = (summaries||[]).some(([acct]) => accKey(acct)==='pocket change');
              const pieHasCash = accountsHasCash && (grandTotal>0);
              tests.push({ name: 'Top level summary exists', ok: topExists });
              tests.push({ name: 'Pocket Change summary present (for Overview card)', ok: overviewHasPC });
              tests.push({ name: 'Accounts table includes Pocket Change (as Cash)', ok: accountsHasCash });
              tests.push({ name: 'Pie can include Cash slice (grandTotal>0)', ok: pieHasCash });
              tests.push({ name: 'Pocket Change has Day % value', ok: pcSummary ? Number.isFinite(pcSummary.dayPct) : true });
              // New v33 tests for getSummaryFor(name)
              const presentNames = (summaries||[]).map(([acct])=>acct);
              if (presentNames.length){
                const first = presentNames[0];
                const gs = getSummaryFor(first);
                tests.push({ name: 'getSummaryFor returns summary for an existing account', ok: !!gs });
              }
              if (pcSummary){
                const gsPc = getSummaryFor('Pocket Change');
                tests.push({ name: 'getSummaryFor("Pocket Change") matches summary entry', ok: !!gsPc && Math.abs((gsPc.total||0) - (pcSummary.total||0)) < 1e-6 });
              }
              return (
                <section className="card" id="debug-tests">
                  <h2>Debug Tests</h2>
                  <ul>{tests.map((t,i)=>(<li key={i} style={{color: t.ok ? '#6be675' : '#ff7a7a'}}>{t.ok ? 'PASS' : 'FAIL'} — {t.name}</li>))}</ul>
                </section>
              );
            } catch { return null; }
          })()}
        </>
      )}
    </div>
  );
}

// ---------------- Small component ----------------
function Kpi({ title, value, sub, tone }) {
  return (
    <div style={{
      background:'#0d1117', border:'1px solid var(--bd)', borderRadius:12, padding:14, minWidth:0
    }}>
      <div style={{fontSize:11, color:'var(--sub)', textTransform:'uppercase', letterSpacing:'.08em'}}>{title}</div>
      <div style={{fontFamily:'ui-monospace,Menlo,Consolas,monospace', fontSize:20}} className={tone ? tone : ''}>{value}</div>
      {sub ? <div style={{fontSize:12, color:'var(--sub)'}}>{sub}</div> : null}
    </div>
  );
}

- export default function HHHReactor() {
+ function HHHReactor() {
   // ...unchanged...
 }
 
+ // make the component visible to index.html
+ window.HHHReactor = HHHReactor;

