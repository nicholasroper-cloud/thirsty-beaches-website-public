(function(){
  var API='https://tb-where.nicholasroper.workers.dev';
  var f=document.getElementById('unForm'), m=document.getElementById('unMsg'), b=document.getElementById('unBtn'), i=document.getElementById('unContact');
  var say=function(t,c){ m.className='alerts__msg '+(c||''); m.textContent=t; };
  f.addEventListener('submit',async function(e){
    e.preventDefault(); if(b.disabled) return;
    var v=i.value.trim(); if(!v){ say('Enter the phone number or email you signed up with','err'); i.focus(); return; }
    b.disabled=true; say('Working…');
    try{
      var r=await fetch(API+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contact:v})});
      var d=await r.json();
      if(r.ok&&d.ok){ say('Done. You won’t get any more alerts from us.','ok'); i.value=''; }
      else if(d.error==='bad-contact') say('That doesn’t look like a US phone number or an email','err');
      else if(r.status===429) say('Too many tries. Give it a little while.','err');
      else say('Something went wrong. Email hello@thirstybeaches.com and we’ll remove you.','err');
    }catch(err){ say('Network error. Try again, or email hello@thirstybeaches.com.','err'); }
    finally{ b.disabled=false; }
  });
})();
