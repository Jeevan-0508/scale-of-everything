/* Cosmic Explorer: an additive command layer over the existing SOE engine. */
import * as THREE from 'three';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const make = (tag, id, cls, html='') => { const e=document.createElement(tag); if(id)e.id=id; if(cls)e.className=cls; e.innerHTML=html; return e; };

function fmt(n){ if(n==null||Number.isNaN(n))return '—'; return Number(n).toLocaleString('en-US',{maximumFractionDigits:3}); }
function lightTimeFromLy(ly){ if(!Number.isFinite(ly))return '—'; if(ly<0.001)return `${fmt(ly*365.25*24*60*60)} s`; if(ly<1)return `${fmt(ly*365.25)} days`; return `${fmt(ly)} years`; }
function modeData(i){
  const L=window.SOE?.LEVELS?.[i]; if(!L)return null;
  const radius=Math.pow(10,L.logSpan);
  return {L,radius,diameter:radius*2,log:L.logSpan, evidence:L.evidence};
}

function installUI(){
  if($('#cosmicDock'))return;
  const dock=make('nav','cosmicDock','',`<button class="cx-mode active" data-mode="nav">◉ NAV</button><button class="cx-mode" data-mode="light">↯ LIGHT</button><button class="cx-mode" data-mode="time">◷ TIME</button><button class="cx-mode" data-mode="map">⌁ MAP</button><button class="cx-mode" data-mode="physics">∿ PHYSICS</button>`);
  const telemetry=make('aside','cosmicTelemetry','',`<div class="cx-head"><span class="cx-eyebrow">COSMIC EXPLORER</span><span class="cx-live">● LIVE</span></div><div class="cx-title" id="cxTitle">Earth</div><div class="cx-sub" id="cxSub">Navigate the scale ladder. The numbers describe the real astronomical scale behind the visual shell.</div><div class="cx-readout"><div class="cx-cell"><span>Scale</span><b id="cxScale">—</b></div><div class="cx-cell"><span>Log radius</span><b id="cxLog">—</b></div><div class="cx-cell"><span>Light crossing</span><b id="cxLight">—</b></div><div class="cx-cell"><span>Evidence</span><b id="cxEvidence">—</b></div></div>`);
  const ruler=make('div','cosmicRuler','',`<div class="cx-ruler-line"></div><div class="cx-ruler-label" id="cxRulerLabel">scale ruler</div>`);
  const mode=make('div','cosmicModeLabel','');
  const hint=make('div','cosmicHint','', 'Tap an object or search for one to inspect it');
  document.body.append(dock,telemetry,ruler,mode,hint);

  let active='nav'; let opened=false;
  function current(){const r=$('#ladder .rung.active');return r?Number(r.dataset.index):0;}
  function update(){
    const d=modeData(current()); if(!d)return;
    $('#cxTitle').textContent=d.L.name; $('#cxScale').textContent=d.L.scaleLabel; $('#cxLog').textContent=`10^${d.log.toFixed(1)} m`;
    const sec=d.radius/299792458; $('#cxLight').textContent=sec<31557600?`${fmt(sec/86400)} days`:`${fmt(sec/31557600)} years`;
    $('#cxEvidence').textContent=d.L.evidence.toUpperCase();
    $('#cxSub').textContent=d.L.summary;
    if(active==='light'){$('#cxRulerLabel').textContent=`A photon crosses this radius in ${$('#cxLight').textContent}`;$('#cosmicRuler').classList.add('show');}
    else if(active==='physics'){$('#cxRulerLabel').textContent=`radius × 2 = ${d.L.evidence==='notScience'?'undefined':fmt(d.diameter)+' m'}`;$('#cosmicRuler').classList.add('show');}
    else $('#cosmicRuler').classList.remove('show');
  }
  function setMode(m){active=m;document.body.classList.remove('cx-warp','cx-time','cx-map');if(m==='light')document.body.classList.add('cx-warp');if(m==='time')document.body.classList.add('cx-time');if(m==='map')document.body.classList.add('cx-map');dock.querySelectorAll('.cx-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));mode.textContent={nav:'NAVIGATION',light:'LIGHT-CROSSING MODE',time:'LOOK-BACK TIME',map:'COSMIC MAP',physics:'PHYSICS SCALE'}[m];mode.classList.remove('flash');void mode.offsetWidth;mode.classList.add('flash');telemetry.classList.add('open');update();}
  dock.querySelectorAll('.cx-mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  dock.addEventListener('mouseenter',()=>{opened=true;telemetry.classList.add('open');update();});
  dock.addEventListener('mouseleave',()=>{if(!opened)telemetry.classList.remove('open');});
  const ladder=$('#ladder'); if(ladder)new MutationObserver(update).observe(ladder,{subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(update,700);
  update();
}

function installParticles(){
  const start=()=>{
    const soe=window.SOE; if(!soe?.scene)return setTimeout(start,500);
    if(soe.scene.getObjectByName('cosmic-explorer-particles'))return;
    const g=new THREE.BufferGeometry(), count=420, p=new Float32Array(count*3);
    for(let i=0;i<count;i++){const r=110+Math.random()*900, a=Math.random()*Math.PI*2, z=(Math.random()*2-1)*r*.35; p[i*3]=Math.cos(a)*r;p[i*3+1]=z;p[i*3+2]=Math.sin(a)*r;}
    g.setAttribute('position',new THREE.BufferAttribute(p,3));
    const m=new THREE.PointsMaterial({color:0x9bdcff,size:1.5,transparent:true,opacity:.25,depthWrite:false,blending:THREE.AdditiveBlending});
    const cloud=new THREE.Points(g,m); cloud.name='cosmic-explorer-particles'; soe.scene.add(cloud);
    if(!reduced){const tick=()=>{cloud.rotation.y+=.00009;cloud.rotation.x+=.000015;requestAnimationFrame(tick)};tick();}
  }; start();
}

function installSearchIntelligence(){
  const input=$('#searchInput'); if(!input)return;
  input.addEventListener('keydown',()=>setTimeout(()=>{
    if(!input.value.trim()||!window.SOE?.searchIndex)return;
    const q=input.value.toLowerCase(); const hit=window.SOE.searchIndex.find(e=>e.label.toLowerCase()===q||e.label.toLowerCase().includes(q));
    if(hit&&hit.payload){
      const p=hit.payload; const ly=p.dist_ly ?? (p.dist_mly!=null?p.dist_mly*1e6:null);
      const t=ly!=null?lightTimeFromLy(ly):'not directly defined';
      $('#cxSub').textContent=`${hit.blurb}  Look-back time: ${t}.`;
      $('#cosmicTelemetry').classList.add('open');
    }
  },40));
}

function boot(){installUI();installParticles();installSearchIntelligence();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
