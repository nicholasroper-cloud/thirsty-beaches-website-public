// Drink-text denylist for AI output that reaches customers (name, why, nickname, reading).
// This is a copy of the DENY_PATTERNS in the kiosk's moderation.js (Thirsty-Beaches- repo, Lady Jaye's policy), so the
// website mixer and the kiosk path reject the same words. KEEP THE TWO IN STEP: when the kiosk list changes, change this
// one. tests/moderation.test.mjs pins the behavior. Returns the cleaned text, or '' = rejected (caller uses its curated
// fallback). Never logs the rejected text.
'use strict';

/* Lady Jaye compliance gate 2026-11-15: alcohol, drug and innuendo terms (a kids-friendly kiosk). "beer" skips "root beer". */
const DENY_SUBSTANCE = [
  /\bbooz(e|y)\b/i, /\btips(y|ier)\b/i, /\bdrunk(en)?\b/i, /\bwasted\b/i, /\bhammered\b/i, /\bsloshed\b/i, /\bhungover\b/i, /\bhangover/i,
  /\bshots?\b/i, /\bvodka\b/i, /\brum\b/i, /\btequila\b/i, /\bwhisk(e)?y\b/i, /\bbourbon\b/i, /\bgin\b/i, /\bliquor\b/i,
  /(?<!root )\bbeers?\b/i, /\bwines?\b/i, /\bcocktails?\b/i, /\bmargarita/i, /\bmimosa/i, /\bsangria\b/i, /\bspiked\b/i, /\bkeg\b/i,
  /\bhigh\b/i, /\bstoned\b/i, /\bstoner/i, /\bweed\b/i, /\b420\b/i, /\bmarijuana\b/i, /\bcannabis\b/i, /\bcocaine\b/i, /\bheroin\b/i,
  /\bmeth\b/i, /\bmolly\b/i, /\becstasy\b/i, /\blsd\b/i, /\bdope\b/i, /\bblunt\b/i, /\bjoint\b/i, /\bdank\b/i, /\bvap(e|ing)\b/i, /\bsmok(e|ing)\b/i,
];
const DENY_INNUENDO = [
  /\bhott(ie|y|ies)\b/i, /\bthicc\b/i, /\bbooty\b/i, /\btwerk/i, /\bhorny\b/i, /\bkinky\b/i, /\bsteamy\b/i, /\bnaughty\b/i, /\bhook.?ups?\b/i,
  /\bdick\b/i, /\bcock\b/i, /\bpuss(y|ies)\b/i, /\bpenis\b/i, /\bvagina\b/i, /\btits?\b/i, /\bboobs?\b/i, /\bnipple/i, /\borgasm/i, /\bcum\b/i,
  /\bballs\b/i, /\bbutt(s)?\b/i, /\bsugar (daddy|mama)\b/i, /\bdaddy\b/i, /\bmilf\b/i, /\bstrip(per|tease)?\b/i, /\bbang(ing|ed)?\b/i,
];
const DENY_CONTENT = [
  // ---- profanity (abbreviated; Lady Jaye to expand) ----
  /\bf+u+c+k/i, /\bs+h+i+t/i, /\bb+i+t+c+h/i, /\ba+s+s+h+o+l+e/i,
  /\bc+u+n+t/i, /\bd+a+m+n/i, /\bh+e+l+l\b/i, /\bcr+a+p\b/i,
  // ---- sexual / adult ----
  /\bsex(y|ual)?\b/i, /\bnaked\b/i, /\bnude\b/i, /\bporn/i,
  /\berotic/i, /\bintimate\b/i, /\bhooker\b/i, /\bslut\b/i, /\bwhore\b/i,
  // ---- violence ----
  /\bkill(ing|ed)?\b/i, /\bblood(y)?\b/i, /\bdead\b/i, /\bmurder/i,
  /\bgun(s|shot)?\b/i, /\bweapon\b/i, /\bstab/i, /\bexplosion\b/i,
  // ---- slurs (sample; Lady Jaye to expand to full list) ----
  /\bn[i1]gg/i, /\bfag(got)?\b/i, /\bretard/i, /\bspic\b/i, /\bkike\b/i,
];
export const DENY_PATTERNS = [
  ...DENY_CONTENT, ...DENY_SUBSTANCE, ...DENY_INNUENDO,
  // ---- brand / trademark names (in AI-generated copy) ----
  /\bcoca.?cola\b/i, /\bpepsi\b/i, /\bdr\.?\s*pepper\b/i, /\bsprite\b/i,
  /\bmonster\b/i, /\bred\s*bull\b/i, /\balani\b/i, /\bgatorade\b/i,
  /\bstarbucks\b/i, /\bchipotle\b/i, /\bmcdonald/i, /\bdunkin\b/i,
  // ---- health / allergen / wellness claims (FDA/FTC) ----
  /\bgluten.?free\b/i, /\bdairy.?free\b/i, /\bsugar.?free\b/i,
  /\bketo\b/i, /\bpaleo\b/i, /\bvegan\b/i, /\bimmun(ity|e)\b/i,
  /\bdetox/i, /\banti.?inflam/i, /\bcalorie.?free\b/i, /\blow.?cal\b/i,
  /\bweight\s*loss\b/i, /\bfat.?burn/i, /\benergy\s*boost\b/i,
  /\bprobiotic/i, /\bantioxidant/i, /\bsuperf[oa]od/i,
  // ---- allergen / "free from" claims ----
  /\bnut.?free\b/i, /\bpeanut.?free\b/i, /\btree.?nut.?free\b/i,
  /\bsoy.?free\b/i, /\begg.?free\b/i, /\bwheat.?free\b/i,
  /contains\s+(no|zero)\s+(allergen|nut|gluten|dairy)/i,
  // ---- emoji / non-printable (name/blurb must be plain text) ----
  // Emoji range: U+1F300-U+1FFFF and common symbols
  /[\u{1F300}-\u{1FFFF}]/u, /[\u{2600}-\u{27BF}]/u,
];


const NAME_MAX = 28;
const BLURB_MAX = 160;

export function sanitizeDrinkText(text, field) {
  if (typeof text !== 'string') return '';
  let t = text.trim().replace(/\s+/g, ' ');
  // Plain text only: no markup characters or control characters ever reach a page, a printer or a voice.
  if (/[\u0000-\u001f\u007f<>]/.test(t)) return '';
  t = field === 'name' ? t.slice(0, NAME_MAX) : t.slice(0, BLURB_MAX);
  for (const pat of DENY_PATTERNS) if (pat.test(t)) return '';
  return t;
}
