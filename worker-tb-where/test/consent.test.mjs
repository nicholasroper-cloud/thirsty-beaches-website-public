// node test/consent.test.mjs — the SMS consent wording is identical in the worker, the kept version file and the website form.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const norm = t => t.normalize('NFC').replace(/\s+/g, ' ').trim();
const unesc = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"');

const file = norm(read('../../consent/sms-consent-v1.txt'));
const worker = /const SMS_CONSENT_V1 = "((?:[^"\\]|\\.)*)";/.exec(read('../src/worker.js'))[1];
const page = unesc(/<span id="subConsentText">([\s\S]*?)<\/span>/.exec(read('../../site/index.html'))[1]);
assert.equal(norm(worker), file, 'worker constant = consent/sms-consent-v1.txt');
assert.equal(norm(page), file, 'website form text = consent/sms-consent-v1.txt');
const confirm = norm(read('../../consent/sms-confirmation-v1.txt'));
assert.equal(/const CONFIRM_TEXT = '([^']*)';/.exec(read('../src/worker.js'))[1], confirm, 'confirmation text');
for (const must of ['automated marketing texts', 'Not required to buy anything', 'msg & data rates may apply', 'Reply STOP to cancel, HELP for help', "I'm 13+", 'thirstybeaches.com/sms-terms']) assert.ok(file.includes(must), must);
const hid = /name="consentVersion" value="([0-9a-f]{64})"/.exec(read('../../site/index.html'))[1];
assert.equal(hid, createHash('sha256').update(file).digest('hex'), 'the no-JS form carries the current hash');
console.log('consent v1 sha256', createHash('sha256').update(file).digest('hex'));
console.log('consent.test.mjs ok');
