# SMS consent wording (kept per version)

Each file here is the exact text a person saw next to the checkbox. The worker stores `consentVersion` = SHA-256 of the
text (whitespace collapsed, NFC) on every signup, so a consent can be traced to the wording it agreed to.

- `sms-consent-v1.txt` : the checkbox label on the website form (`site/index.html`, `#subConsentText`) and the kiosk Tide List.
- `sms-confirmation-v1.txt` : the one confirmation text sent after signup.

Never edit a published version. To change the wording, add `sms-consent-v2.txt`, add a `SMS_CONSENT_V2` constant in
`worker-tb-where/src/worker.js`, update the page and the kiosk, and keep v1 here. `worker-tb-where/test/consent.test.mjs`
fails when the worker, the website and these files disagree.
