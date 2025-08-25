// replace ADVISORS, QUOTES, SECTOR_MAP, TICKER_META definitions with:
import ADVISORS from "/src/lib/advisors.json";
import QUOTES from "/src/lib/quotes.json";
import SECTOR_MAP from "/src/lib/sector_map.json";
import TICKER_META from "/src/lib/ticker_meta.json";
import { clamp01, normalizeBias, weightedBlend, seededRand, pickQuote } from "/src/lib/utils";

import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";

// =============================================
// Mentor Machine — Persona Mixer & Probability Engine (React/TSX)
// Dark brand theme + SHADOW MONKEY pill + sticky header
// Analysis refreshes on MENTOR; includes persona quotes
// Added: Hover a sector slice to see top 10 tickers table beside chart
// Removed: Import / Export buttons
// =============================================

type Scenario = "bull" | "base" | "bear";

type Advisor = {
  id: string;
  name: string;
  category:
    | "Macro & Value"
    | "Analyst"
    | "Technical"
    | "Activist / Stock Picker"
    | "Quant / Multi-Strategy";
  bias: Record<Scenario, number>;
  defaultWeight: number;
  defaultAccuracy: number;
  voiceTag?: string;
};



function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function normalizeBias(bias: Record<Scenario, number>): Record<Scenario, number> {
  const s = bias.bull + bias.base + bias.bear;
  return s <= 0 ? { bull: 1 / 3, base: 1 / 3, bear: 1 / 3 } : { bull: bias.bull / s, base: bias.base / s, bear: bias.bear / s };
}
function weightedBlend(arr: { probs: Record<Scenario, number>; weight: number }[]): Record<Scenario, number> {
  let wb = 0, wbase = 0, wbr = 0, W = 0;
  for (const x of arr) { wb += x.probs.bull * x.weight; wbase += x.probs.base * x.weight; wbr += x.probs.bear * x.weight; W += x.weight; }
  return W <= 0 ? { bull: 1 / 3, base: 1 / 3, bear: 1 / 3 } : normalizeBias({ bull: wb / W, base: wbase / W, bear: wbr / W });
}


function pickQuote(advisorId: string, seed: number) {
  const arr = QUOTES[advisorId] || ["Stay process‑pure; let probabilities guide you."]; 
  return arr[seed % arr.length];
}
function seededRand(seed: number) { let s = (seed * 1664525 + 1013904223) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; }; }

function tiltsForSector(sector: string, scenario: Record<"bull" | "base" | "bear", number>) {
  const b = scenario.bull, r = scenario.bear; const net = b - r;
  if (sector === "Growth/Tech" || sector === "Thematic/Innovation") {
    if (net > 0.15) return { tilt: "Bullish (overweight growth)", note: "Momentum & liquidity support innovation." };
    if (net < -0.05) return { tilt: "Neutral/Cautious", note: "Prefer baskets/ETFs over single-name risk." };
    return { tilt: "Constructive", note: "Growth OK with risk controls." };
  }
  if (sector === "Defensive (Staples/Health)" || sector === "Bonds & Gold") {
    if (net < -0.10) return { tilt: "Bullish Defensive", note: "Elevated downside risk — add ballast." };
    if (net > 0.10) return { tilt: "Underweight", note: "Reduce ballast in strong risk-on tapes." };
    return { tilt: "Core Hold", note: "Keep as stabilizers." };
  }
  if (sector === "Cash & Hedges") {
    if (net < -0.10) return { tilt: "Elevated", note: "Hold dry powder / optional hedges." };
    if (net > 0.10) return { tilt: "Lower", note: "Deploy cash selectively." };
    return { tilt: "Neutral", note: "Maintain baseline liquidity." };
  }
  if (net > 0.10) return { tilt: "Constructive", note: "Add quality cyclicals." };
  if (net < -0.10) return { tilt: "Overweight Quality", note: "Defense via cash-flow resilience." };
  return { tilt: "Neutral", note: "Market-weight." };
}

function SectorBlendTable({ allocation, scenario }: { allocation: { key: string; val: number }[]; scenario: Record<"bull" | "base" | "bear", number> }) {
  const rows = allocation.map(({ key, val }) => {
    const map = SECTOR_MAP[key] || { etfs: [], leaders: [], growth: [] };
    const leadersWeight = Math.round(val * 0.6);
    const growthWeight = Math.round(val * 0.4);
    const leaderPer = map.leaders.length ? leadersWeight / map.leaders.length : 0;
    const growthPer = map.growth.length ? growthWeight / map.growth.length : 0;
    const rec = tiltsForSector(key, scenario);
    return { sector: key, weight: val, etfs: map.etfs.join(", "), leaders: map.leaders.map((t) => `${t} (${leaderPer.toFixed(1)}%)`).join(", "), growth: map.growth.map((t) => `${t} (${growthPer.toFixed(1)}%)`).join(", "), tilt: rec.tilt, note: rec.note };
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left bg-[#111827] text-slate-200">
            <th className="p-2">Sector</th>
            <th className="p-2">Suggested Weight</th>
            <th className="p-2">ETFs</th>
            <th className="p-2">Leaders (split)</th>
            <th className="p-2">Top Growth (split)</th>
            <th className="p-2">Analyst Tilt</th>
            <th className="p-2">Context</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sector} className="border-b border-white/5 last:border-none align-top">
              <td className="p-2 font-medium text-slate-200">{r.sector}</td>
              <td className="p-2 text-slate-300">{r.weight}%</td>
              <td className="p-2 whitespace-pre-wrap text-slate-300">{r.etfs}</td>
              <td className="p-2 whitespace-pre-wrap text-slate-300">{r.leaders || "—"}</td>
              <td className="p-2 whitespace-pre-wrap text-slate-300">{r.growth || "—"}</td>
              <td className="p-2 text-slate-300">{r.tilt}</td>
              <td className="p-2 text-slate-400">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

(function runSanityTests() {
  try {
    const nb = normalizeBias({ bull: 0.2, base: 0.5, bear: 0.3 });
    console.assert(Math.abs(nb.bull + nb.base + nb.bear - 1) < 1e-9, "normalizeBias sums to 1");
    const wb = weightedBlend([
      { probs: { bull: 0.5, base: 0.3, bear: 0.2 }, weight: 2 },
      { probs: { bull: 0.2, base: 0.5, bear: 0.3 }, weight: 1 },
    ]);
    console.assert(Math.abs(wb.bull + wb.base + wb.bear - 1) < 1e-9, "weightedBlend sums to 1");
  } catch (e) { console.warn("Sanity tests failed:", e); }
})();

export default function AdvisorMixer() {
  const [riskAppetite, setRiskAppetite] = useState(50);
  const [skepticism, setSkepticism] = useState(40);
  const [timeHorizon, setTimeHorizon] = useState(60);
  const [conviction, setConviction] = useState(55);
  const [tone, setTone] = useState("Macro (Dalio) — balanced & explanatory");
  const [refreshKey, setRefreshKey] = useState(0);

  type AdvisorState = { on: boolean; weight: number; accuracy: number };
  const [advisors, setAdvisors] = useState<Record<string, AdvisorState>>(() => {
    const map: Record<string, AdvisorState> = {};
    ADVISORS.forEach((a) => { map[a.id] = { on: true, weight: a.defaultWeight, accuracy: a.defaultAccuracy }; });
    return map;
  });

  const ACCURACY_FLOOR = 0.35, RISK_ALPHA = 0.0045, SKEPTIC_ALPHA = 0.0045, HORIZON_ALPHA = 0.004, CONVICTION_ALPHA = 0.004;

  const scenario = useMemo(() => {
    const items = ADVISORS.filter((a) => advisors[a.id]?.on).map((a) => {
      const st = advisors[a.id];
      const base = normalizeBias(a.bias);
      let bull = base.bull * (1 + (riskAppetite - 50) * RISK_ALPHA - (skepticism - 50) * SKEPTIC_ALPHA + (conviction - 50) * CONVICTION_ALPHA * 0.5);
      let bear = base.bear * (1 + (skepticism - 50) * SKEPTIC_ALPHA - (riskAppetite - 50) * RISK_ALPHA + (conviction - 50) * CONVICTION_ALPHA * 0.5);
      let bas = base.base * (1 + (timeHorizon - 50) * HORIZON_ALPHA - (conviction - 50) * CONVICTION_ALPHA);
      const adj = normalizeBias({ bull, base: bas, bear });
      const acc = ACCURACY_FLOOR + clamp01(st.accuracy) * (1 - ACCURACY_FLOOR);
      const w = Math.max(0, st.weight) * acc;
      return { probs: adj, weight: w };
    });
    return weightedBlend(items);
  }, [advisors, riskAppetite, skepticism, timeHorizon, conviction]);

  const allocation = useMemo(() => {
    const b = scenario.bull, m = scenario.base, r = scenario.bear;
    let growthTech = 20 + Math.round((b - r) * 30);
    let qualityValue = 20 + Math.round((m - r) * 15);
    let defensives = 15 + Math.round((r - b) * 20);
    let bondsGold = 15 + Math.round(r * 20 + m * 5 - b * 10);
    let thematic = 15 + Math.round(b * 15 - r * 10);
    let cashHedges = 15 + Math.round(r * 20 - b * 10);
    const raw = [
      { key: "Growth/Tech", val: growthTech },
      { key: "Quality/Value", val: qualityValue },
      { key: "Defensive (Staples/Health)", val: defensives },
      { key: "Bonds & Gold", val: bondsGold },
      { key: "Thematic/Innovation", val: thematic },
      { key: "Cash & Hedges", val: cashHedges },
    ];
    const sum = raw.reduce((s, x) => s + x.val, 0);
    const norm = raw.map((x) => ({ key: x.key, val: Math.max(0, Math.round((x.val / sum) * 100)) }));
    const drift = 100 - norm.reduce((s, x) => s + x.val, 0);
    if (drift !== 0 && norm.length > 0) norm[0].val += drift;
    return norm;
  }, [scenario]);

  const allocData = useMemo(() => allocation.map((a) => ({ name: a.key, value: a.val })), [allocation]);
  const probData = useMemo(() => [
    { name: "Bull", value: Math.round(scenario.bull * 100) },
    { name: "Base", value: Math.round(scenario.base * 100) },
    { name: "Bear", value: Math.round(scenario.bear * 100) },
  ], [scenario]);

  const dominant = useMemo(() => {
    let bestId = "", bestW = -Infinity;
    ADVISORS.forEach((a) => {
      const st = advisors[a.id];
      if (!st?.on) return;
      const eff = (st.weight || 0) * (st.accuracy || 0);
      if (eff > bestW) { bestW = eff; bestId = a.id; }
    });
    return ADVISORS.find((a) => a.id === bestId) || ADVISORS[0];
  }, [advisors]);

  const KW: Record<string, string> = {
    Liquidity: "Cash and credit conditions that influence how easily assets trade without moving price.",
    "Earnings breadth": "Proportion of companies with improving earnings versus deteriorating.",
    "Anchored VWAP": "Volume‑weighted average price from a specific anchor date (e.g., earnings, low).",
    "Mean‑reversion": "Tendency for price to return toward its average after extremes.",
    "Tail risk": "Low‑probability, high‑impact downside events.",
    Drawdown: "Peak‑to‑trough portfolio decline.",
    Regime: "Market state characterized by volatility, rates, and leadership.",
    Dispersion: "Spread between winners and losers; impacts stock picking edge.",
    Sharpe: "Risk‑adjusted return (excess return divided by volatility).",
  };

  const renderRich = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\[\[kw:([^\]]+)\]\])|(\[\[num:([^\]]+)\]\])/g;
    let lastIndex = 0; let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
      if (m[2]) {
        const term = m[2];
        const def = KW[term] || "Definition not available.";
        parts.push(
          <span key={parts.length} className="relative group font-semibold text-sky-300 border-b border-sky-400/30 cursor-help">
            {term}
            <span className="pointer-events-none absolute left-0 top-full mt-1 w-64 bg-[#0b1220] text-white text-xs p-2 rounded shadow-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {def}
            </span>
          </span>
        );
      } else if (m[4]) {
        const num = m[4];
        parts.push(<b key={parts.length} className="text-purple-400 font-extrabold">{num}</b>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return <p className="text-slate-300 leading-7">{parts}</p>;
  };

  const analysisParas = useMemo(() => {
    const b = Math.round(scenario.bull * 100), m = Math.round(scenario.base * 100), r = Math.round(scenario.bear * 100);
    const net = b - r; const skew = net > 0 ? "edge to upside" : net < 0 ? "defensive tilt" : "evenly balanced";
    const rng = seededRand(12345 + refreshKey);
    const picks = [
      `${dominant.name} lens: probabilities [[num:${b}%]] / [[num:${m}%]] / [[num:${r}%]] (bull/base/bear) indicate ${skew}. We let [[kw:Liquidity]] and [[kw:Earnings breadth]] frame risk, not narratives.`,
      `Execution is level‑driven: respect [[kw:Anchored VWAP]], 20‑day retests, and prior pivots. Prefer adds on pullbacks; avoid chasing beyond 2 ATR. Use [[kw:Mean‑reversion]] when base dominates.`,
      `Risk is inventory control. Cap single‑name heat; define failure pre‑trade (thesis invalidation). Guard against [[kw:Tail risk]]; cut when [[kw:Drawdown]] breaches guardrails.`,
      `Allocation follows edge: overweight leadership when dispersion favors trend; rotate to quality when [[kw:Dispersion]] widens. Rebalance systematically; aim to raise portfolio [[kw:Sharpe]] via selection, not leverage.`,
      `Regime awareness: macro [[kw:Regime]] shifts (rates, credit, vol) override micro signals; lighten risk when liquidity deteriorates, redeploy when it normalizes.`,
      `Playbook flexibility: when upside tail grows, scale entries; when downside tail grows, build optionality via cash, duration, and hedges.`,
    ];
    const order = picks.map((p, i) => ({ p, k: rng() + i * 0.01 })).sort((a, b) => a.k - b.k).slice(0, 4).map(x => x.p);
    const quote = pickQuote(dominant.id, Math.floor(rng() * 1000));
    order.splice(1, 0, `“${quote}” — ${dominant.name}`);
    return order;
  }, [scenario, dominant, refreshKey]);

  const COLORS = ["#7C3AED", "#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

  const [hoverSector, setHoverSector] = useState<string | null>(null);
  console.assert(allocData.length === allocation.length, "allocData mirrors allocation length");
  const currentSector = hoverSector || (allocation[0]?.key ?? "Growth/Tech");

  // --- Sector Top 10 metadata (placeholder; wire to data source later)


  const sectorTop10 = useMemo(() => {
    const s = SECTOR_MAP[currentSector] || { leaders: [], growth: [], etfs: [] } as any;
    return ([...(s.leaders||[]), ...(s.growth||[])]).slice(0,10);
  }, [currentSector]);

  // Presets (kept, but without import/export UI)
  const applyPreset = (key: string) => {
    const next = { ...advisors };
    const setAll = (ids: string[], w: number) => ids.forEach((id) => (next[id] = { ...next[id], on: true, weight: w }));
    const offAll = () => ADVISORS.forEach((a) => (next[a.id] = { ...next[a.id], on: false }));
    if (/^Balanced/i.test(key)) { ADVISORS.forEach((a) => (next[a.id] = { ...a, on: true, weight: a.defaultWeight } as any)); setRiskAppetite(50); setSkepticism(40); setTimeHorizon(60); setConviction(55); setTone("Macro (Dalio) — balanced & explanatory"); }
    else if (/^Macro/i.test(key)) { offAll(); setAll(ADVISORS.filter((a) => a.category === "Macro & Value").map((a) => a.id), 14); setRiskAppetite(45); setSkepticism(45); setTimeHorizon(70); setConviction(50); setTone("Macro (Dalio) — balanced & explanatory"); }
    else if (/^Technical/i.test(key)) { offAll(); setAll(ADVISORS.filter((a) => a.category === "Technical").map((a) => a.id), 12); setRiskAppetite(52); setSkepticism(42); setTimeHorizon(50); setConviction(60); setTone("Technical (Shannon/Bollinger/DeMark) — price confirms"); }
    else if (/^Growth\/Innovation/i.test(key)) { offAll(); setAll(["danIves", "tomLee", "stephanieLink"], 14); setRiskAppetite(65); setSkepticism(35); setTimeHorizon(55); setConviction(65); setTone("Innovation (Wood/Ives) — thematic momentum"); }
    setAdvisors(next);
  };

  return (
    <div className="min-h-screen w-full bg-[#0f1117] text-slate-100">
      {/* Sticky Branding Header */}
      <div className="sticky top-0 z-50 backdrop-blur-sm bg-[#0f1117]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="px-4 py-1 rounded-full text-white font-bold text-sm tracking-wide bg-gradient-to-r from-purple-600 to-indigo-600">SHADOW MONKEY</span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Mentor Machine</h1>
          </div>
          <button
            className="px-4 py-2 rounded-full text-white font-semibold bg-gradient-to-r from-purple-500 to-sky-400 shadow hover:opacity-90"
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Refresh analysis insight"
          >
            MENTOR
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <header className="flex items-center justify-between">
          <div className="text-slate-300 font-semibold">Persona Tuning Presets</div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-2xl bg-[#1a1c23] text-slate-200 border border-white/10 hover:bg-[#23262f]" onClick={() => applyPreset("Balanced")}>
              Preset: Balanced
            </button>
            <button className="px-3 py-2 rounded-2xl bg-[#1a1c23] text-slate-200 border border-white/10 hover:bg-[#23262f]" onClick={() => applyPreset("Macro-Heavy")}>
              Preset: Macro-Heavy
            </button>
            <button className="px-3 py-2 rounded-2xl bg-[#1a1c23] text-slate-200 border border-white/10 hover:bg-[#23262f]" onClick={() => applyPreset("Technical-Heavy")}>
              Preset: Technical-Heavy
            </button>
            <button className="px-3 py-2 rounded-2xl bg-[#1a1c23] text-slate-200 border border-white/10 hover:bg-[#23262f]" onClick={() => applyPreset("Growth/Innovation")}>
              Preset: Growth/Innovation
            </button>
          </div>
        </header>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#0f1623] border border-white/5 rounded-2xl shadow p-5 space-y-5">
            <h2 className="font-semibold text-lg text-slate-200">Temperament Controls</h2>
            <div className="space-y-3 text-slate-300">
              <label className="block">Risk Appetite: <b>{riskAppetite}</b>
                <input type="range" min={0} max={100} value={riskAppetite} onChange={(e) => setRiskAppetite(parseInt(e.target.value))} className="w-full" />
              </label>
              <label className="block">Skepticism / Risk‑Off Tilt: <b>{skepticism}</b>
                <input type="range" min={0} max={100} value={skepticism} onChange={(e) => setSkepticism(parseInt(e.target.value))} className="w-full" />
              </label>
              <label className="block">Time Horizon (Short → Long): <b>{timeHorizon}</b>
                <input type="range" min={0} max={100} value={timeHorizon} onChange={(e) => setTimeHorizon(parseInt(e.target.value))} className="w-full" />
              </label>
              <label className="block">Conviction Aggressiveness: <b>{conviction}</b>
                <input type="range" min={0} max={100} value={conviction} onChange={(e) => setConviction(parseInt(e.target.value))} className="w-full" />
              </label>
            </div>
            <div className="mt-2">
              <label className="block mb-2 text-slate-300">Narrative Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1220] text-slate-200 p-2">
                <option>Macro (Dalio) — balanced & explanatory</option>
                <option>Contrarian (Tepper/Burry) — opportunity & defense</option>
                <option>Quality & Compounding (Buffett/Link) — steady edge</option>
                <option>Innovation (Wood/Ives) — thematic momentum</option>
                <option>Technical (Shannon/Bollinger/DeMark) — price confirms</option>
              </select>
            </div>
            <p className="text-sm text-slate-400"><b>How it works:</b> Sliders tilt each advisor's default scenario bias. Accuracy scales their influence. The engine blends all active personas into a single probability distribution.</p>
          </div>

          <div className="bg-[#0f1623] border border-white/5 rounded-2xl shadow p-5 space-y-5">
            <h2 className="font-semibold text-lg text-slate-200">Scenario Probabilities</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={probData}>
                  <XAxis dataKey="name" tick={{ fill: '#FFFFFF' }} stroke="#334155" />
                  <YAxis domain={[0, 100]} tick={{ fill: '#FFFFFF' }} stroke="#334155" />
                  <Tooltip contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #1f2937', color: '#FFFFFF' }} labelStyle={{ color: '#FFFFFF' }} itemStyle={{ color: '#FFFFFF' }} />
                  <Bar dataKey="value">
                    {probData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                  <Legend wrapperStyle={{ color: '#FFFFFF' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-slate-400"><b>Argument for these probabilities:</b> They reflect your persona weights and accuracy assumptions, transformed by temperament. Adjust them to match your research logs.</p>
          </div>
        </section>

        {/* Sector Allocation Visualization + Table + Analysis & Actions */}
        <section className="bg-[#0f1623] border border-white/5 rounded-2xl shadow p-5 space-y-5">
          <h2 className="font-semibold text-lg text-slate-200">Sector Allocation (Visual) &rarr; Portfolio Blend</h2>

          {/* Chart + Hover Tickers */}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <Pie data={allocData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={120} label>
                    {allocData.map((entry, index) => (
                      <Cell
                        key={`alloc-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        onMouseEnter={() => setHoverSector(entry.name)}
                        onMouseLeave={() => setHoverSector(null)}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0b1220', border: '1px solid #1f2937', color: '#FFFFFF' }} labelStyle={{ color: '#FFFFFF' }} itemStyle={{ color: '#FFFFFF' }} />
                  <Legend wrapperStyle={{ color: '#FFFFFF' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Hover‑responsive top tickers table */}
            <div className=\"space-y-3\">
              <div className=\"p-3 rounded-xl bg-[#0b1220] border border-white/10\">
                <div className=\"text-slate-300 font-semibold mb-2\">{currentSector} — Top 10 (ticker, company, %YTD, yield, rating)</div>
                <div className=\"overflow-x-auto\">
                  <table className=\"min-w-full text-sm\">
                    <thead>
                      <tr className=\"text-left bg-[#111827] text-slate-200\">
                        <th className=\"p-2\">Ticker</th>
                        <th className=\"p-2\">Company</th>
                        <th className=\"p-2\">% YTD</th>
                        <th className=\"p-2\">% Yield</th>
                        <th className=\"p-2\">Buy Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorTop10.map((t, i) => {
                        const meta = TICKER_META[t] || { name: "—" };
                        const ytd = typeof meta.ytd === 'number' ? meta.ytd : null;
                        const yld = typeof meta.yield === 'number' ? meta.yield : null;
                        const rating = meta.rating || "—";
                        return (
                          <tr key={\`top10-${'\${'}i{'}\}'}\`} className=\"border-b border-white/5 last:border-none\">
                            <td className=\"p-2 text-slate-200 font-medium\">{t}</td>
                            <td className=\"p-2 text-slate-300\">{meta.name}</td>
                            <td className=\"p-2\"><span className={ytd===null?"text-slate-400":"" + (ytd!==null && ytd<0?" text-red-400":" text-green-400")} >{ytd===null?"—":`${(ytd).toFixed(1)}%`}</span></td>
                            <td className=\"p-2 text-slate-300\">{yld===null?"—":`${(yld).toFixed(1)}%`}</td>
                            <td className=\"p-2 text-slate-300\">{rating}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className=\"text-xs text-slate-500 mt-2\">Hover the donut to switch sectors. Values are placeholders — wire YTD, yield, and ratings to your data source.</p>
              </div>
            </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left bg-[#111827] text-slate-200">
                        <th className="p-2">Leaders</th>
                        <th className="p-2">Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(SECTOR_MAP[currentSector]?.leaders || []).slice(0, 10).map((t, i) => (
                        <tr key={`lead-${i}`} className="border-b border-white/5 last:border-none">
                          <td className="p-2 text-slate-300">{t}</td>
                          <td className="p-2 text-slate-300">{SECTOR_MAP[currentSector]?.growth?.[i] || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">Hover the donut to switch sectors. Lists are suggestions — replace with your watchlist.</p>
              </div>

              <div className="p-3 rounded-xl bg-[#0b1220] border border-white/10">
                <div className="text-slate-300 font-semibold mb-2">Portfolio Blend — suggested splits</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left bg-[#111827] text-slate-200">
                        <th className="p-2">Sector</th>
                        <th className="p-2">Weight</th>
                        <th className="p-2">ETFs</th>
                        <th className="p-2">Leaders</th>
                        <th className="p-2">Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocation.map((a) => {
                        const map = SECTOR_MAP[a.key] || { etfs: [], leaders: [], growth: [] };
                        const leadersW = Math.round(a.val * 0.6), growthW = Math.round(a.val * 0.4);
                        const etfSlice = Math.max(0, Math.round(a.val * 0.4));
                        return (
                          <tr key={a.key} className="border-b border-white/5 last:border-none align-top">
                            <td className="p-2 text-slate-200 font-medium">{a.key}</td>
                            <td className="p-2 text-slate-300">{a.val}%</td>
                            <td className="p-2 text-slate-300 whitespace-pre-wrap">{etfSlice}% • {(map.etfs || []).slice(0,2).join(" / ") || '—'}</td>
                            <td className="p-2 text-slate-300 whitespace-pre-wrap">{leadersW}% • {(map.leaders || []).slice(0,3).join(", ") || '—'}</td>
                            <td className="p-2 text-slate-300 whitespace-pre-wrap">{growthW}% • {(map.growth || []).slice(0,3).join(", ") || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="list-disc ml-6 text-xs text-slate-400 mt-3 space-y-1">
                  <li><span className="font-medium text-slate-300">Sizing:</span> cap single‑name exposure at 5% of portfolio; target 2:1 reward‑to‑risk; raise cash if portfolio drawdown hits 10–12%.</li>
                  <li><span className="font-medium text-slate-300">Execution:</span> stage entries on pullbacks to anchored VWAP/20‑day; trim into strength; rebalance monthly or on regime breaks.</li>
                </ul>
              </div>
            </div>
          </div>

            <div className=\"p-3 rounded-xl bg-[#0b1220] border border-white/10 mt-5\">
              <div className=\"text-slate-300 font-semibold mb-2\">Portfolio Blend — suggested splits</div>
              <div className=\"overflow-x-auto\">
                <table className=\"min-w-full text-sm\">
                  <thead>
                    <tr className=\"text-left bg-[#111827] text-slate-200\">
                      <th className=\"p-2\">Sector</th>
                      <th className=\"p-2\">Weight</th>
                      <th className=\"p-2\">ETFs</th>
                      <th className=\"p-2\">Leaders</th>
                      <th className=\"p-2\">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocation.map((a) => {
                      const map = SECTOR_MAP[a.key] || { etfs: [], leaders: [], growth: [] };
                      const leadersW = Math.round(a.val * 0.6), growthW = Math.round(a.val * 0.4);
                      const etfSlice = Math.max(0, Math.round(a.val * 0.4));
                      return (
                        <tr key={a.key} className=\"border-b border-white/5 last:border-none align-top\">
                          <td className=\"p-2 text-slate-200 font-medium\">{a.key}</td>
                          <td className=\"p-2 text-slate-300\">{a.val}%</td>
                          <td className=\"p-2 text-slate-300 whitespace-pre-wrap\">{etfSlice}% • {(map.etfs || []).slice(0,2).join(" / ") || '—'}</td>
                          <td className=\"p-2 text-slate-300 whitespace-pre-wrap\">{leadersW}% • {(map.leaders || []).slice(0,3).join(", ") || '—'}</td>
                          <td className=\"p-2 text-slate-300 whitespace-pre-wrap\">{growthW}% • {(map.growth || []).slice(0,3).join(", ") || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className=\"list-disc ml-6 text-xs text-slate-400 mt-3 space-y-1\">
                <li><span className=\"font-medium text-slate-300\">Sizing:</span> cap single‑name exposure at 5% of portfolio; target 2:1 reward‑to‑risk; raise cash if portfolio drawdown hits 10–12%.</li>
                <li><span className=\"font-medium text-slate-300\">Execution:</span> stage entries on pullbacks to anchored VWAP/20‑day; trim into strength; rebalance monthly or on regime breaks.</li>
              </ul>
            </div>

            <p className="text-xs text-slate-500">Default intra‑sector split is <b>60% leaders / 40% growth</b>. Replace lists with your own universe as needed. Educational only — not investment advice.</p>
        </section>

        <section className="bg-[#0f1623] border border-white/5 rounded-2xl shadow p-5 space-y-3">
          <h2 className="font-semibold text-lg text-slate-200">Advisory Summary (Context & Contrast)</h2>
          <div className="p-4 bg-[#0b1220] rounded-xl border border-white/10 text-sm leading-relaxed text-slate-200">
            Using persona‑weighted probabilities, we synthesize a playbook and highlight which voices pull bullish vs. bearish at the margin.
          </div>
        </section>

        <section className="bg-[#0f1623] border border-white/5 rounded-2xl shadow p-5">
          <h2 className="font-semibold text-lg mb-3 text-slate-200">Persona Weights & Accuracy (toggle to include, tune impact)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left bg-[#111827] text-slate-200">
                  <th className="p-2">On</th>
                  <th className="p-2">Advisor</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Bias (Bull/Base/Bear)</th>
                  <th className="p-2">Weight</th>
                  <th className="p-2">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {ADVISORS.map((a) => {
                  const st = advisors[a.id];
                  const b = normalizeBias(a.bias);
                  return (
                    <tr key={a.id} className="border-b border-white/5 last:border-none">
                      <td className="p-2 align-middle">
                        <input type="checkbox" checked={!!st?.on} onChange={(e) => setAdvisors({ ...advisors, [a.id]: { ...st, on: e.target.checked } })} />
                      </td>
                      <td className="p-2 align-middle font-medium text-slate-200">{a.name}</td>
                      <td className="p-2 align-middle text-slate-300">{a.category}</td>
                      <td className="p-2 align-middle text-slate-300">
                        <div className="flex gap-2 items-center">
                          <span className="inline-block w-16">{Math.round(b.bull * 100)}%</span>
                          <span className="inline-block w-16">{Math.round(b.base * 100)}%</span>
                          <span className="inline-block w-16">{Math.round(b.bear * 100)}%</span>
                        </div>
                      </td>
                      <td className="p-2 align-middle text-slate-300">
                        <input type="range" min={0} max={20} value={st?.weight ?? a.defaultWeight} onChange={(e) => setAdvisors({ ...advisors, [a.id]: { ...st, weight: parseInt(e.target.value) } })} />
                        <span className="ml-2">{st?.weight ?? a.defaultWeight}</span>
                      </td>
                      <td className="p-2 align-middle text-slate-300">
                        <input type="range" min={0.3} max={0.9} step={0.01} value={st?.accuracy ?? a.defaultAccuracy} onChange={(e) => setAdvisors({ ...advisors, [a.id]: { ...st, accuracy: parseFloat(e.target.value) } })} />
                        <span className="ml-2">{(st?.accuracy ?? a.defaultAccuracy).toFixed(2)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-[#0f1623] border border-white/5 rounded-2xl shadow p-5">
            <h2 className="font-semibold text-lg text-slate-200">Mentor Analysis</h2>
            <div className="space-y-3">
              {analysisParas.map((txt, i) => (
                <div key={i} className="p-3 rounded-xl bg-[#0b1220] border border-white/10">
                  {renderRich(txt)}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0f1623] border border-white/5 rounded-2xl shadow p-5">
            <h2 className="font-semibold text-lg text-slate-200">Action Items</h2>
            <ul className="list-disc ml-6 text-sm text-slate-300 space-y-2">
              <li>Confirm persona settings reflect current macro/earnings views; log changes.</li>
              <li>Translate allocation into tickets; respect sizing rules (cap single‑name ≤5%).</li>
              <li>Set alerts at anchored VWAPs, 20/50‑DMA, and prior pivots for top watchlist.</li>
              <li>Schedule weekly rebalance; add trims/adds playbook based on scenario shifts.</li>
            </ul>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500 pt-4">Educational research only. Not investment advice.</footer>
      </div>
    </div>
  );
}
