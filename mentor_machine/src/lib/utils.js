export function clamp01(x){ return Math.max(0, Math.min(1, x)); }
export function normalizeBias(bias){
  const s = (bias.bull||0)+(bias.base||0)+(bias.bear||0);
  if(s<=0) return { bull:1/3, base:1/3, bear:1/3 };
  return { bull: bias.bull/s, base: bias.base/s, bear: bias.bear/s };
}
export function weightedBlend(arr){
  let wb=0,wbase=0,wbr=0,W=0;
  for(const x of arr){ wb+=x.probs.bull*x.weight; wbase+=x.probs.base*x.weight; wbr+=x.probs.bear*x.weight; W+=x.weight; }
  if(W<=0) return { bull:1/3, base:1/3, bear:1/3 };
  return normalizeBias({ bull: wb/W, base: wbase/W, bear: wbr/W });
}
export function seededRand(seed){
  let s = (seed * 1664525 + 1013904223) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}
export function pickQuote(advisorId, seed, QUOTES){
  const arr = QUOTES[advisorId] || ["Stay process-pure; let probabilities guide you."];
  return arr[seed % arr.length];
}
