/* Today's specials: the owner app writes them to the public Control repo (kiosk-control.json, "specials"[]);
   the kiosk features the same list. Read-only, cache-busted every 2 min. Any failure just leaves it hidden. */
(function(){
  var URL_='https://raw.githubusercontent.com/nicholasroper-cloud/Thirsty-Beaches-Control/main/kiosk-control.json';
  var str=function(v,n){ return typeof v==='string' ? v.replace(/\s+/g,' ').trim().slice(0,n) : ''; };
  var choice=function(id){ id=str(id,80); var i=id.indexOf(':'); return i>-1 ? id.slice(i+1).trim() : ''; };
  function render(d){
    var list=d && Array.isArray(d.specials) ? d.specials : [];
    var out=Array.isArray(d && d.soldOut) ? d.soldOut : [];
    var ul=document.getElementById('specialsList'), sec=document.getElementById('specials');
    var n=0;
    list.slice(0,6).forEach(function(sp){
      if(!sp || typeof sp!=='object') return;
      var name=str(sp.name,40); if(!name) return;
      var li=document.createElement('li'); li.className='sp';
      var sold=(sp.drinkId && out.indexOf(sp.drinkId)>-1) || (sp.baseItemId && out.indexOf(sp.baseItemId)>-1);
      if(sold) li.classList.add('is-out');
      var tag=document.createElement('span'); tag.className='sp__tag'; tag.textContent=str(sp.label,30)||'Today\u2019s special';
      var nm=document.createElement('b'); nm.className='sp__n'; nm.textContent=name;
      li.appendChild(tag); li.appendChild(nm);
      var blurb=str(sp.blurb,160);
      if(blurb){ var p=document.createElement('p'); p.className='sp__d'; p.textContent=blurb; li.appendChild(p); }
      var parts=[choice(sp.base)].concat(Array.isArray(sp.mods)?sp.mods.slice(0,8).map(choice):[]).filter(Boolean);
      if(parts.length){ var i=document.createElement('p'); i.className='sp__i'; i.textContent=parts.join(' \u00b7 '); li.appendChild(i); }
      if(sold){ var o=document.createElement('span'); o.className='sp__out'; o.textContent='Sold out today'; li.appendChild(o); }
      ul.appendChild(li); n++;
    });
    sec.hidden=!n;
  }
  try{
    var ctl=window.AbortController ? new AbortController() : null;
    if(ctl) setTimeout(function(){ ctl.abort(); },8000);
    fetch(URL_+'?t='+Math.floor(Date.now()/120000),{cache:'no-store',signal:ctl?ctl.signal:undefined})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if(d) render(d); })
      .catch(function(){});
  }catch(e){}
})();
