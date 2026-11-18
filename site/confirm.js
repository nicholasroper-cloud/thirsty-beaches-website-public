(function(){
  var API='https://tb-where.nicholasroper.workers.dev';
  var t=document.getElementById('cfTitle'), b=document.getElementById('cfBody');
  var code=(new URLSearchParams(location.search)).get('c')||'';
  if(!/^[a-z0-9]{24}$/i.test(code)){ t.textContent='That link doesn’t look right'; b.textContent='Open the link from your email again, or sign up again on the home page.'; return; }
  fetch(API+'/subscribe/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code})})
    .then(function(r){ return r.json().then(function(d){ return {ok:r.ok&&d.ok}; }); })
    .then(function(x){
      if(x.ok){ t.textContent='You’re in'; b.textContent='Thanks. We’ll let you know where the trailer is parked and when specials drop, a few times a month. You can unsubscribe any time.'; }
      else { t.textContent='That link has expired'; b.textContent='It may already have been used. Sign up again on the home page.'; }
    })
    .catch(function(){ t.textContent='We couldn’t reach the server'; b.textContent='Try the link again in a minute.'; });
})();
