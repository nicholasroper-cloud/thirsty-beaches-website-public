/* Shared 80s cup motion. No APIs, browser storage or production writes. */
(()=>{
  "use strict";
  const TB=window.TB=window.TB||{};
  TB.mountFizz=(root=document,{builder=false}={})=>{
  const NS="http://www.w3.org/2000/svg";
  const body=root.querySelector("[data-bubble-body],#body-bubbles");
  const surface=root.querySelector("[data-bubble-surface],#surface-bubbles");
  if(!body||!surface||body.dataset.mounted)return;
  body.dataset.mounted="true";
  const preference=matchMedia("(prefers-reduced-motion: reduce)");
  let running=!preference.matches,frame=0,last=0,clock=0,onscreen=true;
  const particles=[];
  function element(tag,attrs){
    const el=document.createElementNS(NS,tag);
    for(const [key,value] of Object.entries(attrs||{}))el.setAttribute(key,String(value));
    return el;
  }
  function particle(i,top=false){
    const group=element("g"),pink=i%5===0;
    const ring=element("circle",{class:"bubble"+(pink?" bubble--pink":""),r:1});
    const shine=element("path",{class:"bubble-shine",d:""});
    const pop=element("path",{class:"bubble-pop",d:"",opacity:0});
    group.append(ring,shine,pop);(top?surface:body).append(group);
    const p={group,ring,shine,pop,top,
      x:top?[287,490,722][i%3]:[395,457,565,627][i%4],
      start:top?549:1370,end:top?438:558,
      radius:top?5+(i%4)*2:5+(i%6)*1.7,
      duration:top?1900+(i%4)*390:4900+(i%7)*440,
      offset:(i*.173%1),seed:i};
    particles.push(p);return p;
  }
  for(let i=0;i<28;i++)particle(i);
  for(let i=0;i<12;i++)particle(i,true);
  function draw(){
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i],raw=clock/p.duration+p.offset;
      const t=raw%1,peak=p.top?.74:.84;
      const y=p.start+(p.end-p.start)*Math.min(t/peak,1);
      const x=p.x+Math.sin(t*Math.PI*3+p.seed)* (p.top?6:14);
      const fadeIn=Math.min(1,t*9),popPhase=Math.max(0,(t-peak)/(1-peak));
      const radius=p.radius*(.5+.5*Math.min(t/peak,1));
      p.group.setAttribute("transform",`translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      p.group.setAttribute("opacity",String((p.top?.8:.52)*fadeIn*(1-popPhase)));
      p.ring.setAttribute("r",radius.toFixed(2));
      p.ring.setAttribute("opacity",popPhase?0:1);
      p.shine.setAttribute("d",`M${-radius*.6} ${-radius*.1} Q${-radius*.65} ${-radius*.55} ${-radius*.15} ${-radius*.63}`);
      p.shine.setAttribute("opacity",popPhase?0:.72);
      const a=radius*(1+popPhase*2),b=a+radius*.48;
      p.pop.setAttribute("d",`M${-a} 0H${-b} M${a} 0H${b} M0 ${-a}V${-b} M0 ${a}V${b}`);
      p.pop.setAttribute("opacity",popPhase?1:0);
    }
  }
  function tick(now){
    if(!running||document.hidden||!onscreen){frame=0;last=0;return;}
    if(last)clock+=Math.min(now-last,80);
    last=now;draw();frame=requestAnimationFrame(tick);
  }
  function schedule(){if(running&&onscreen&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
  function update(){
    if(!running){cancelAnimationFrame(frame);frame=0;last=0;}
    schedule();
  }
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}
    else schedule();
  });
  preference.addEventListener("change",()=>{running=!preference.matches;update();});
  if(builder&&"IntersectionObserver"in window){
    const observer=new IntersectionObserver(entries=>{
      onscreen=entries[0].isIntersecting;
      if(!onscreen){cancelAnimationFrame(frame);frame=0;last=0;}
      else schedule();
    },{rootMargin:"100px"});
    observer.observe(body.closest("svg"));
  }
  draw();update();
  };
  if(document.getElementById("soda"))TB.mountFizz();
})();
