#!/usr/bin/env node
/* Tells IndexNow (Bing, Yandex, Seznam, Naver and partners) about every URL in site/sitemap.xml.
 * Run it by hand AFTER the deploy is live, never from CI on a branch:
 *   node tools/indexnow.mjs            POST the sitemap URLs
 *   node tools/indexnow.mjs --dry-run  print the payload and stop
 *   node tools/indexnow.mjs /dirty-soda-washington-city /st-george-wedding-soda-bar   only these paths
 * The key file is site/010245df2c5b7bb57c9b59abcb5f89ab.txt (its content is the key). It must answer 200 at
 * KEY_LOCATION before you run this, or IndexNow returns 403/422. Google does not use IndexNow; use Search Console.
 */
import { readFileSync } from 'node:fs';

const HOST = 'thirstybeaches.com';
const KEY = '010245df2c5b7bb57c9b59abcb5f89ab';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const sitemap = readFileSync(new URL('../site/sitemap.xml', import.meta.url), 'utf8');
const fileKey = readFileSync(new URL(`../site/${KEY}.txt`, import.meta.url), 'utf8').trim();
if (fileKey !== KEY) throw new Error('site/' + KEY + '.txt does not contain the key');
let urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => new URL(u).host === HOST);
const only = process.argv.slice(2).filter((a) => a.startsWith('/'));
if (only.length) urlList = only.map((p) => `https://${HOST}${p}`);
if (!urlList.length) throw new Error('no URLs found in site/sitemap.xml');
if (urlList.length > 10000) throw new Error('IndexNow takes at most 10,000 URLs per request');
const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(payload, null, 2));
  console.log(`\n${urlList.length} URLs (dry run, nothing sent)`);
} else {
  const live = await fetch(KEY_LOCATION).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  if (live.trim() !== KEY) { console.error(`Key file not live at ${KEY_LOCATION}; deploy first.`); process.exit(1); }
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) });
  // 200 OK and 202 Accepted are both success; 403 = key not valid, 422 = URL off-host or key file unreachable.
  console.log(`IndexNow ${res.status} ${res.statusText} for ${urlList.length} URLs`);
  if (!res.ok && res.status !== 202) { console.error(await res.text()); process.exit(1); }
}
