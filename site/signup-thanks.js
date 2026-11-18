/* shows the right line after a no-JavaScript signup form post (the worker redirects here with ?r=ok|bad|rate|consent) */
(function(){
  var r=(new URLSearchParams(location.search)).get('r')||'ok';
  var T={ok:['Almost there','Thanks. We’ll text or email you once to confirm. Nothing goes out until you confirm, and you can stop any time.'],
    bad:['That didn’t look right','We couldn’t read that phone number or email. Go back and try again.'],
    consent:['One more thing','To get texts, tick the box that says it’s okay to text you. Go back and try again.'],
    rate:['Too many tries','Give it a little while and try again.']}[r]||['Almost there',''];
  document.getElementById('stTitle').textContent=T[0]; document.getElementById('stBody').textContent=T[1];
})();
