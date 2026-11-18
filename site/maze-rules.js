/* last week's winning draw ticket (public, no personal data) and whether the draw is running */
(function(){
  var API='https://tb-where.nicholasroper.workers.dev';
  var out=document.getElementById('lastWin'), st=document.getElementById('drawState');
  fetch(API+'/draw/last',{cache:'no-store'}).then(function(r){ return r.json(); }).then(function(d){
    if(st) st.textContent=d.enabled?'Status: the weekly draw is running.':'Status: the weekly draw is paused. Nothing on this page applies until it starts.';
    out.textContent=d.ticket?(d.ticket+(d.claimed?' (claimed)':'')):'no winner posted yet';
  }).catch(function(){ out.textContent='not available right now'; });
})();
