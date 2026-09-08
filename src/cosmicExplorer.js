/* COSMIC EXPLORER — visible scientific instrument layer over SOE. */
import * as THREE from 'three';
import { LEVELS } from './levels.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const make = (tag, id, cls, html='') => { const e=document.createElement(tag); if(id)e.id=id; if(cls)e.className=cls; e.innerHTML=html; return e; };
const fmt = (n,d=3) => Number.isFinite(n) ? Number(n).toLocaleString('en-US',{maximumFractionDigits:d}) : '—';
const lightCrossing = (m) => { const s=m/299792458; if(s<60)return `${fmt(s,1)} s`; if(s<86400)return `${fmt(s/3600,1)} h`; if(s<31557600)return `${fmt(s/86400,1)} d`; return `${fmt(s/31557600,2)} y`; };

let mode='nav'; let selected=null;

function levelData(i){ const L=LEVELS[i]; if(!L)return null; const radius=10**L.logSpan; return {L,radius,diameter:radius*2}; }

function openInspector(entry){
  selected=entry; const p=entry.payload||{};
  $('#cxInspectorTitle').textContent=entry.label;
  $('#cxInspectorType').textContent=`${entry.kind.toUpperCase()} / LEVEL ${entry.level+1}`;
  const grid=$('#cxInspectorGrid'); grid.innerHTML='';
  const add=(k,v)=>{if(v==null||v==='')return; const el=document.createElement('div'); el.innerHTML=`<span>${k}</span><b>${v}</b>`; grid.append(el);};
  if(entry.kind==='star'){
    add('DISTANCE',`${fmt(p.dist_ly)} ly`); add('APPARENT MAG',p.mag); add('ABSOLUTE MAG',p.absmag); add('SPECTRAL TYPE',p.spect); add('LUMINOSITY',p.lum_sun!=null?`${fmt(p.lum_sun)} × Sun`:null); add('CONSTELLATION',p.con);
    $('#cxProvenance').textContent='HYG v4.1 — Hipparcos, Yale Bright Star and Gliese. Values are catalogue fields, not AI estimates.';
    $('#cxTimelineValue').textContent=`${fmt(p.dist_ly)} YEARS AGO`; $('#cxTimelineNote').textContent=`Light reaching us from ${entry.label} left roughly ${fmt(p.dist_ly)} years ago. This is light-travel time, not a cosmological look-back calculation.`;
  } else if(entry.kind==='galaxy'){
    add('DISTANCE',`${fmt(p.dist_mpc)} Mpc`); add('LIGHT DISTANCE',`${fmt(p.dist_mly)} million ly`); add('MORPHOLOGY',p.morph); add('MESSIER',p.messier); add('CATALOGUE',p.desig); add('GROUP',p.group);
    $('#cxProvenance').textContent='Cosmicflows-3 — Tully et al. 2016, AJ 152, 50, via CDS/VizieR. Distance is a measured catalogue value.';
    $('#cxTimelineValue').textContent=`${fmt(p.dist_mly)} MILLION YEARS AGO`; $('#cxTimelineNote').textContent=`In the simple light-travel sense, light from ${entry.label} has travelled about ${fmt(p.dist_mly)} million years.`;
  } else { add('SCALE',p.scaleLabel); add('EVIDENCE',p.evidence); add('SOURCE',p.source); $('#cxProvenance').textContent=p.summary||''; }
  $('#cxInspector').classList.remove('hidden');
}

function install(){
  if($('#cosmicExplorer'))return;
  // One opening. This carries the project's name, the range it covers and the
  // thesis, which is what the second intro layer used to say on its own.
  const hero=make('section','cosmicExplorer','cx-hero',`<div class="cx-hero-inner"><div class="ci-kicker">An interactive map of scale</div><h1 class="ci-title">Scale of <em>Everything</em></h1><p class="ci-sub">From the place beneath your feet to structures beyond direct measurement. Every boundary is labelled by what we actually know.</p><p class="cx-hero-copy">Measured catalogues. Physical models. Hypotheses. One interface that tells you which is which.</p><div class="ci-scale"><span class="ci-from">1.7 m</span><span class="ci-arrow">→</span><span class="ci-to">the edge of the map</span></div><div class="cx-hero-actions"><button id="cxLaunch" class="cx-primary">ENTER EXPLORER <span>↗</span></button><button id="cxGuide" class="cx-secondary">HOW IT WORKS</button></div></div>`);
  const instrument=make('aside','cxInstrument','cx-instrument',`<div class="cx-instrument-top"><span>OBSERVATORY // LIVE</span><b>●</b></div><div class="cx-object" id="cxObject">EARTH</div><div class="cx-object-sub" id="cxObjectSub">LEVEL 01 / MEASURED</div><div class="cx-metrics"><div><span>REAL SCALE</span><strong id="cxScale">6,371 km</strong></div><div><span>LOG₁₀ RADIUS</span><strong id="cxLog">10^6.8 m</strong></div><div><span>LIGHT CROSSING</span><strong id="cxLight">—</strong></div><div><span>EVIDENCE</span><strong id="cxEvidence">MEASURED</strong></div></div><div class="cx-meter"><span>CONFIDENCE / DATA STATUS</span><i><em id="cxConfidence"></em></i></div><button id="cxInspect" class="cx-inspect">OPEN OBJECT INSPECTOR</button>`);
  const dock=make('nav','cosmicDock','cx-dock',`<button class="cx-mode active" data-mode="nav">01 NAV</button><button class="cx-mode" data-mode="light">02 LIGHT</button><button class="cx-mode" data-mode="time">03 TIME</button><button class="cx-mode" data-mode="map">04 MAP</button><button class="cx-mode" data-mode="physics">05 PHYSICS</button>`);
  const timeline=make('section','cxTimeline','cx-timeline',`<div class="cx-timeline-head"><span>OBSERVATION TIMELINE</span><b id="cxTimelineValue">PRESENT</b></div><div class="cx-track"><i></i><span>EMISSION</span><span>NOW</span></div><div class="cx-timeline-note" id="cxTimelineNote">Select a named object to inspect its light-travel time.</div>`);
  const inspector=make('section','cxInspector','cx-inspector hidden',`<button id="cxCloseInspector" class="cx-close">×</button><div class="cx-inspector-kicker">OBJECT INSPECTOR</div><h2 id="cxInspectorTitle">—</h2><div id="cxInspectorType">CATALOGUE OBJECT</div><div class="cx-inspector-grid" id="cxInspectorGrid"></div><div class="cx-provenance" id="cxProvenance"></div>`);
  const guide=make('section','cxGuidePanel','cx-guide hidden',`<div class="cx-guide-kicker">THE RULE OF THE EXPLORER</div><h2>MEASURE IT.<br>MODEL IT.<br>LABEL IT.</h2><p>The visualisation never hides the difference between observation and inference. Every scale carries an evidence status.</p><div class="cx-legend"><span class="measured">MEASURED</span><span class="modelled">MODELLED</span><span class="hypothesis">HYPOTHESIS</span><span class="notScience">NOT SCIENCE</span></div><button id="cxCloseGuide">BACK TO EXPLORER</button>`);
  document.body.append(hero,instrument,dock,timeline,inspector,guide);

  const confidence={measured:100,modelled:62,hypothesis:25,notScience:0};
  function current(){const r=$('#ladder .rung.active');return r?Number(r.dataset.index):0;}
  function update(){const d=levelData(current());if(!d)return;const i=current();$('#cxObject').textContent=d.L.name.toUpperCase();$('#cxObjectSub').textContent=`LEVEL ${String(i+1).padStart(2,'0')} / ${d.L.evidence.toUpperCase()}`;$('#cxScale').textContent=d.L.scaleLabel;$('#cxLog').textContent=`10^${d.L.logSpan.toFixed(1)} m`;$('#cxLight').textContent=lightCrossing(d.radius);$('#cxEvidence').textContent=d.L.evidence.toUpperCase();$('#cxConfidence').style.width=`${confidence[d.L.evidence]}%`;if(mode==='time'||mode==='light')$('#cxTimeline').classList.add('show');}
  function setMode(m){mode=m;document.body.classList.remove('cx-warp','cx-time','cx-map','cx-physics');if(m==='light')document.body.classList.add('cx-warp');if(m==='time')document.body.classList.add('cx-time');if(m==='map')document.body.classList.add('cx-map');if(m==='physics')document.body.classList.add('cx-physics');dock.querySelectorAll('.cx-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));update();}
  document.body.classList.add('cx-intro');
  $('#cxLaunch').onclick=()=>{document.body.classList.remove('cx-intro');hero.classList.add('cx-dismiss');instrument.classList.add('open');timeline.classList.add('show');setTimeout(()=>hero.remove(),700);};
  $('#cxGuide').onclick=()=>guide.classList.remove('hidden'); $('#cxCloseGuide').onclick=()=>guide.classList.add('hidden'); $('#cxCloseInspector').onclick=()=>inspector.classList.add('hidden');
  $('#cxInspect').onclick=()=>selected?openInspector(selected):$('#infoPanel')?.classList.remove('hidden');
  dock.querySelectorAll('.cx-mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  const ladder=$('#ladder');if(ladder)new MutationObserver(update).observe(ladder,{subtree:true,attributes:true,attributeFilter:['class']});
  addEventListener('keydown',e=>{if(document.activeElement?.tagName==='INPUT')return;const m={'1':'nav','2':'light','3':'time','4':'map','5':'physics'}[e.key];if(m)setMode(m);});
  window.CX={openInspector,setMode}; update(); setTimeout(()=>hero.classList.add('ready'),80);
}

function searchHook(){const input=$('#searchInput');if(!input)return;input.addEventListener('keydown',e=>{if(e.key!=='Enter')return;setTimeout(()=>{const q=input.value.trim().toLowerCase();const idx=window.SOE?.searchIndex||[];const hit=idx.find(x=>x.label?.toLowerCase()===q)||idx.find(x=>x.label?.toLowerCase().includes(q));if(hit&&window.CX)window.CX.openInspector(hit);},120);});}
function particles(){const start=()=>{const soe=window.SOE;if(!soe?.scene)return setTimeout(start,400);if(soe.scene.getObjectByName('cosmic-explorer-atmosphere'))return;const g=new THREE.BufferGeometry(),n=650,p=new Float32Array(n*3);for(let i=0;i<n;i++){const r=500+Math.random()*1250,a=Math.random()*Math.PI*2,z=(Math.random()*2-1)*r*.32;p[i*3]=Math.cos(a)*r;p[i*3+1]=z;p[i*3+2]=Math.sin(a)*r;}g.setAttribute('position',new THREE.BufferAttribute(p,3));const mat=new THREE.PointsMaterial({color:0x83dfff,size:1.35,transparent:true,opacity:.18,depthWrite:false,blending:THREE.AdditiveBlending});const cloud=new THREE.Points(g,mat);cloud.name='cosmic-explorer-atmosphere';soe.scene.add(cloud);if(!reduced){const tick=()=>{cloud.rotation.y+=.00012;cloud.rotation.z+=.000015;requestAnimationFrame(tick)};tick();}};start();}
function boot(){install();searchHook();particles();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
