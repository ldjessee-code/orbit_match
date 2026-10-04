// Concept renderer v4 (not the product). Three layout variants (a/b/c) of each view; Empire-style interface theme. Turquenish tau Ceti, lore v2.26.
import { writeFileSync } from 'node:fs';
const AU=1.495978707e11, MU_SUN=1.32712440018e20, DAY=86400, G0=9.80665, GM_E=3.986004418e14, KM=1000, TAU=2*Math.PI;
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
function kepler(M,e){M=((M%TAU)+TAU)%TAU;let E=e<0.8?M:Math.PI;for(let i=0;i<60;i++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-13)break;}return E;}
const f1=n=>n.toFixed(1);
// ---------- star colour table (display) ----------
const STAR_COLORS=[['O',30000,'#9db4ff'],['B',10000,'#b5c7ff'],['A',7500,'#dfe6ff'],['F',6000,'#fbf6ea'],['G0',5600,'#fff0c8'],['G5',5200,'#ffdb96'],['K0',4700,'#ffc97a'],['K5',3900,'#ffad5c'],['M0',3500,'#ff9148'],['M5',2800,'#ff7a3a']];
const STAR={name:'tau Ceti',spec:'G8V',mass:0.78,lum:0.488,teff:5320,color:'#ffe0a0',edge:'#f3c983'}; // G8V: pale yellow, slight orange tint, a touch warmer than the Sun (#fff0c0), not red
const muStar=MU_SUN*STAR.mass;
// ---------- system ----------
const P0={gane:40,horn:150,husk:260,sable:330,kak:95,gg:55,ig1:230,ig2:120}; // placeholder mean anomalies (deg)
const B={
 gane:{name:'Gane',des:'tC 1',a:0.133,e:0,R:2820,col:['#9b6a4c','#e0a77c']},
 horn:{name:'Hornstooth',des:'tC 2',a:0.243,e:0,R:3110,col:['#8a7a66','#d2bd9c']},
 husk:{name:'Husk',des:'tC 3',a:0.34,e:0,R:3350,col:['#76695e','#bcac97']},
 sable:{name:'Sable',des:'tC 4',a:0.538,e:0.1,R:7900,col:['#23222a','#6c6874']},
 kak:{name:'Kakakiko',des:'tC 5',a:0.71,e:0,R:6628,col:['#1d5f92','#86ccef']},
 gg:{name:'Croquet Ball',des:'tC 6 · name proposed',a:2.8,e:0,R:58200,col:['#a8875a','#ecd7a8'],style:'striped'},
 ig1:{name:'Cue Ball',des:'tC 7 · ice giant',a:5.5,e:0,R:24600,col:['#b9d3e6','#f3f9fd'],rings:true,style:'cue'},
 ig2:{name:'tC 8',des:'ice giant · dusty · name TBD',a:9.2,e:0,R:24000,col:['#1c1916','#3d3630'],style:'dusty'},
};
Object.entries(B).forEach(([id,b])=>{b.id=id;b.P=365.25*Math.sqrt(b.a**3/STAR.mass);b.M0=P0[id]*Math.PI/180;b.w=0;});
function helio(b,t){const E=kepler(b.M0+TAU*t/b.P,b.e);const x=b.a*(Math.cos(E)-b.e),y=b.a*Math.sqrt(1-b.e*b.e)*Math.sin(E);return [x,y];}
function velOf(fn,t){const h=1e-4;const a=fn(t-h),b=fn(t+h);return [(b[0]-a[0])/(2*h),(b[1]-a[1])/(2*h)];}
// Kakakiko subsystem, km, planet-centred
const MU_K=GM_E*(1.045+0.01045);
const DER={a:400000,e:0.03,w:0,M0:Math.PI,P:28.36,R:1274.5,col:['#34333a','#a0958b']};
const SHU={a:251350,e:0.20,w:30*Math.PI/180,P:14.18,R:1083.5,col:['#8d8478','#e2d8c8']};
SHU.M0=(2*(DER.w+DER.M0)-SHU.w)-SHU.w; // 2:1, pericentre at conjunction
function kpos(o,t){const E=kepler(o.M0+TAU*t/o.P,o.e);const x=o.a*(Math.cos(E)-o.e),y=o.a*Math.sqrt(1-o.e*o.e)*Math.sin(E);const c=Math.cos(o.w),s=Math.sin(o.w);return [x*c-y*s,x*s+y*c];}
const derPos=t=>kpos(DER,t), shuPos=t=>kpos(SHU,t);
function lag(pt,t){const p=derPos(t),r=Math.hypot(...p),th=Math.atan2(p[1],p[0])+{L4:Math.PI/3,L5:-Math.PI/3,L3:Math.PI}[pt];return [r*Math.cos(th),r*Math.sin(th)];}
// 2-body state propagation (km, km/s, mu km^3/s^2)
function propagate(r0,v0,mu,dt){const r=Math.hypot(...r0),v2=v0[0]**2+v0[1]**2;const a=1/(2/r-v2/mu);const h=r0[0]*v0[1]-r0[1]*v0[0];
 const ex=(v0[1]*h)/mu-r0[0]/r, ey=(-v0[0]*h)/mu-r0[1]/r;const e=Math.hypot(ex,ey),w=Math.atan2(ey,ex);
 const nu0=Math.atan2(r0[1],r0[0])-w;const E0=2*Math.atan(Math.sqrt((1-e)/(1+e))*Math.tan(nu0/2));const M0=E0-e*Math.sin(E0);const n=Math.sqrt(mu/a**3);
 const E=kepler(M0+n*dt,e);const x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E);return {p:[x*Math.cos(w)-y*Math.sin(w),x*Math.sin(w)+y*Math.cos(w)],P:TAU/n,a,e};}
// ---------- transfers ----------
function hohmann(r1,r2,mu){const at=(r1+r2)/2;return {tof:Math.PI*Math.sqrt(at**3/mu),dv1:Math.abs(Math.sqrt(mu/r1)*(Math.sqrt(2*r2/(r1+r2))-1)),dv2:Math.abs(Math.sqrt(mu/r2)*(1-Math.sqrt(2*r1/(r1+r2)))),at,e:Math.abs(r2-r1)/(r1+r2)};}
// burn-coast-burn matched (gravity-free), SI. tb = burn time each end (tb=T/2 -> no coast)
function bcb(r0,v0,rT,vT,T,tb){const dr=[rT[0]-r0[0]-v0[0]*T,rT[1]-r0[1]-v0[1]*T],dv=[vT[0]-v0[0],vT[1]-v0[1]];
 const a1=[0,1].map(k=>(dr[k]/tb-dv[k]/2)/(T-tb)),a2=[0,1].map(k=>dv[k]/tb-a1[k]);return {a1,a2,amax:Math.max(Math.hypot(...a1),Math.hypot(...a2)),dvUsed:(Math.hypot(...a1)+Math.hypot(...a2))*tb};}
function fusionMatched(depFn,tgtFn,t0,acc,budget,S){const r0=depFn(t0).map(x=>x*S),v0=velOf(depFn,t0).map(x=>x*S/DAY);
 const st=T=>{const td=t0+T/DAY;return [tgtFn(td).map(x=>x*S),velOf(tgtFn,td).map(x=>x*S/DAY)];};
 const tbFor=T=>Math.min(T/2,budget/(2*acc));
 const need=T=>{const [rT,vT]=st(T);return bcb(r0,v0,rT,vT,T,tbFor(T)).amax;};
 let lo=1000,hi=2000;while(need(hi)>acc)hi*=1.5;for(let i=0;i<80;i++){const m=(lo+hi)/2;if(need(m)>acc)lo=m;else hi=m;}
 const T=hi,tb=tbFor(T),[rT,vT]=st(T),s=bcb(r0,v0,rT,vT,T,tb);
 const at=t=>{let p=[...r0],v=[...v0];const seg=(dt,a)=>{p=[p[0]+v[0]*dt+0.5*a[0]*dt*dt,p[1]+v[1]*dt+0.5*a[1]*dt*dt];v=[v[0]+a[0]*dt,v[1]+a[1]*dt];};
  seg(Math.min(t,tb),s.a1);if(t>tb){seg(Math.min(t,T-tb)-tb,[0,0]);if(t>T-tb)seg(t-(T-tb),s.a2);}return p.map(x=>x/S);};
 return {T,days:T/DAY,tb,at,dvUsed:s.dvUsed,arrive:tgtFn(t0+T/DAY)};}
// low-thrust tangential spiral with gravity (RK4), km & s
function spiral(r0km,mu,acc_kms2,apoTarget){let s=[r0km,0,0,Math.sqrt(mu/r0km)],t=0;const pts=[[s[0],s[1],0]];let phase='burn',dvUsed=0,tBurnEnd=null;
 const f=(s,thr)=>{const r=Math.hypot(s[0],s[1]),g=-mu/r**3;const v=Math.hypot(s[2],s[3]);const a=thr?acc_kms2/v:0;return [s[2],s[3],g*s[0]+a*s[2],g*s[1]+a*s[3]];};
 while(t<40*DAY){const r=Math.hypot(s[0],s[1]);const dt=Math.max(5,Math.min(600,0.002*TAU*Math.sqrt(r**3/mu)));const thr=phase==='burn';
  const k1=f(s,thr),k2=f(s.map((x,i)=>x+k1[i]*dt/2),thr),k3=f(s.map((x,i)=>x+k2[i]*dt/2),thr),k4=f(s.map((x,i)=>x+k3[i]*dt),thr);
  const prevR=r;s=s.map((x,i)=>x+dt/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));t+=dt;if(thr)dvUsed+=acc_kms2*dt;pts.push([s[0],s[1],t]);
  if(phase==='burn'){const rr=Math.hypot(s[0],s[1]),v2=s[2]**2+s[3]**2,a=1/(2/rr-v2/mu),h=s[0]*s[3]-s[1]*s[2],e=Math.sqrt(Math.max(0,1-h*h/(mu*a)));if(a*(1+e)>=apoTarget){phase='coast';tBurnEnd=t;}}
  else if(Math.hypot(s[0],s[1])<prevR)break;}
 return {pts,T:t,tBurnEnd,dvUsed};}// ---------- interface themes (Empire-style is the mockup default; swatches are (est.) from review/visual_style_sheet_DRAFT.md) ----------
const THEMES={
 empire:{name:'Empire-style',panel:'#EEF1F5',panelA:.9,text:'#12202b',sub:'#4b5d6c',blue:'#7FD3FF',green:'#6EE7A8',line:'#7FD3FF',bezel:'#EEF1F5',bezelEdge:'#c9d2dc'},
 mardat:{name:'Mardat-style',panel:'#6B6F76',panelA:.95,ground:'#0A0C10',text:'#f1f2f4',sub:'#b8bcc2',red:'#C0142B',blue:'#0B2A6F',line:'#C0142B'}};
const TH=THEMES.empire; const LN=TH.line; // display line colour (holo grid, rims)
function head(W,H,V){const o=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Consolas, 'Cascadia Mono', Inconsolata, 'Segoe UI', monospace">`,
`<defs>
<radialGradient id="bg" cx="50%" cy="52%" r="75%"><stop offset="0" stop-color="#08192a"/><stop offset=".65" stop-color="#040c16"/><stop offset="1" stop-color="#01040a"/></radialGradient>
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${LN}" opacity=".035"/></pattern>
<pattern id="scan2" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="#ffffff" opacity=".16"/></pattern>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="lit" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<radialGradient id="starG" cx="45%" cy="42%" r="60%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".55" stop-color="${STAR.color}"/><stop offset="1" stop-color="${STAR.edge}"/></radialGradient>
<radialGradient id="corona"><stop offset=".45" stop-color="${STAR.color}" stop-opacity=".5"/><stop offset="1" stop-color="${STAR.color}" stop-opacity="0"/></radialGradient>
<radialGradient id="emit" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${LN}" stop-opacity=".35"/><stop offset="1" stop-color="${LN}" stop-opacity="0"/></radialGradient>
<linearGradient id="cone" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${LN}" stop-opacity=".10"/><stop offset="1" stop-color="${LN}" stop-opacity="0"/></linearGradient>
</defs>`,`<rect width="${W}" height="${H}" fill="url(#bg)"/>`];
 for(let i=0;i<180;i++)o.push(`<circle cx="${f1(hash('x'+i)*W)}" cy="${f1(hash('y'+i)*H)}" r="${hash('r'+i)>0.94?1.1:0.55}" fill="#cfe9ff" opacity="${(0.08+0.3*hash('o'+i)**3).toFixed(2)}"/>`);
 if(V.holo>=2){o.push(`<path d="M${W/2-60} ${H-26} L${W/2-560} 120 L${W/2+560} 120 L${W/2+60} ${H-26} Z" fill="url(#cone)"/>`);o.push(`<ellipse cx="${W/2}" cy="${H-30}" rx="260" ry="26" fill="url(#emit)"/>`);}
 return o;}
// white Empire-style paneling bezel with lit light-blue / green accents
function tail(o,W,H,V,title){o.push(`<rect width="${W}" height="${H}" fill="url(#scan)"/>`);
 const b=22;o.push(`<path d="M0 0 H${W} V${H} H0 Z M${b} ${b+14} V${H-b} H${W-b} V${b+14} Z" fill="${TH.bezel}" fill-rule="evenodd"/>`);
 o.push(`<path d="M0 0 H${W} V${H} H0 Z" fill="none" stroke="${TH.bezelEdge}" stroke-width="3"/>`);
 o.push(`<rect x="${b}" y="${b+14}" width="${W-2*b}" height="${H-2*b-14}" fill="none" stroke="${TH.blue}" stroke-width="2" filter="url(#lit)"/>`);
 o.push(`<text x="${b+4}" y="${b+6}" fill="${TH.sub}" font-size="11.5" letter-spacing="2">${title}</text>`);
 o.push(`<text x="${W-b-4}" y="${b+6}" text-anchor="end" fill="${TH.sub}" font-size="11" letter-spacing="1.5">INTERFACE: EMPIRE-STYLE · VARIANT 4${V.id.toUpperCase()} · ${V.tiltLabel}</text>`);
 [[W-b-360,TH.green],[W-b-376,TH.blue],[W-b-392,TH.green]].forEach(([x,c])=>o.push(`<circle cx="${x}" cy="${b+2}" r="3.2" fill="${c}" filter="url(#lit)"/>`));
 [[b+2,b+16,1,1],[W-b-2,b+16,-1,1],[b+2,H-b-2,1,-1],[W-b-2,H-b-2,-1,-1]].forEach(([x,y,sx,sy])=>o.push(`<path d="M${x} ${y+sy*30} L${x} ${y} L${x+sx*30} ${y}" fill="none" stroke="${TH.green}" stroke-width="3" filter="url(#lit)"/>`));o.push('</svg>');}
const poly=pts=>pts.map((p,i)=>(i?'L':'M')+f1(p[0])+' '+f1(p[1])).join('');
// holo body: gradient or surface pattern (striped / cue / dusty), shading, holo rims
function holoBody(o,id,x,y,r,b,light,ratio,holo){const col=b.col;const L=Math.hypot(...light)||1;const hx=50+30*light[0]/L,hy=50+30*light[1]/L;
 o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r*1.35)}" fill="${col[1]}" opacity="${holo>=2?.16:.10}" filter="url(#soft)"/>`);
 o.push(`<clipPath id="cp_${id}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/></clipPath>`);
 if(!b.style){o.push(`<radialGradient id="h_${id}" cx="${hx.toFixed(0)}%" cy="${hy.toFixed(0)}%" r="80%"><stop offset="0" stop-color="${col[1]}" stop-opacity=".95"/><stop offset=".55" stop-color="${col[0]}" stop-opacity=".85"/><stop offset="1" stop-color="#021018" stop-opacity=".9"/></radialGradient>`);
  o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="url(#h_${id})"/>`);}
 else{o.push(`<g clip-path="url(#cp_${id})">`);
  if(b.style==='striped'){const bands=['#e9d6a8','#b68d5c','#f1e3bf','#9c7447','#e2c893','#c9a26d','#f4e8c8','#a47d52','#e6d0a0'];const n=bands.length;
   o.push(`<g transform="rotate(-12 ${f1(x)} ${f1(y)})">`);bands.forEach((c,i)=>{const y0=y-r+2*r*i/n,hh=2*r/n;o.push(`<rect x="${f1(x-r*1.3)}" y="${f1(y0)}" width="${f1(r*2.6)}" height="${f1(hh+0.6)}" fill="${c}"/>`);});
   o.push(`<rect x="${f1(x-r*1.3)}" y="${f1(y-0.09*r)}" width="${f1(r*2.6)}" height="${f1(0.18*r)}" fill="#fff6dc" opacity=".7"/></g>`);}
  else if(b.style==='cue'){o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col[1]}"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col[0]}" opacity=".35"/>`);
   o.push(`<ellipse cx="${f1(x+0.28*r)}" cy="${f1(y+0.18*r)}" rx="${f1(0.24*r)}" ry="${f1(0.2*r)}" fill="#101318"/><ellipse cx="${f1(x+0.28*r)}" cy="${f1(y+0.18*r)}" rx="${f1(0.31*r)}" ry="${f1(0.26*r)}" fill="none" stroke="#8aa3b5" stroke-opacity=".5" stroke-width="${f1(Math.max(.8,r*0.03))}"/>`);}
  else if(b.style==='dusty'){o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${col[1]}"/>`);for(let i=0;i<5;i++){const yy=y-r+(i+0.5)*2*r/5;o.push(`<rect x="${f1(x-r)}" y="${f1(yy-r*0.12)}" width="${f1(2*r)}" height="${f1(r*0.2)}" fill="${col[0]}" opacity="${(0.35+0.3*hash(id+i)).toFixed(2)}"/>`);}
   for(let i=0;i<40;i++)o.push(`<circle cx="${f1(x+(hash(id+'dx'+i)*2-1)*r)}" cy="${f1(y+(hash(id+'dy'+i)*2-1)*r)}" r="${f1(r*0.03+0.3)}" fill="#7a6e60" opacity=".35"/>`);}
  o.push(`<radialGradient id="sh_${id}" cx="${hx.toFixed(0)}%" cy="${hy.toFixed(0)}%" r="80%"><stop offset="0" stop-color="#ffffff" stop-opacity=".18"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#021018" stop-opacity=".8"/></radialGradient>`);
  o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="url(#sh_${id})"/></g>`);}
 if(holo>=2)o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="url(#scan2)"/>`);
 o.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r*ratio*0.55)}" fill="none" stroke="${LN}" stroke-opacity=".22" stroke-width=".8"/>`);
 o.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r*0.45)}" ry="${f1(r)}" fill="none" stroke="${LN}" stroke-opacity=".14" stroke-width=".8"/>`);
 if(holo>=1){o.push(`<ellipse cx="${f1(x)}" cy="${f1(y-r*0.5)}" rx="${f1(r*0.866)}" ry="${f1(r*ratio*0.4)}" fill="none" stroke="${LN}" stroke-opacity=".14" stroke-width=".7"/><ellipse cx="${f1(x)}" cy="${f1(y+r*0.5)}" rx="${f1(r*0.866)}" ry="${f1(r*ratio*0.4)}" fill="none" stroke="${LN}" stroke-opacity=".14" stroke-width=".7"/>`);}
 o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="none" stroke="${LN}" stroke-opacity="${holo>=2?.8:.55}" stroke-width="${holo>=2?1.5:1.1}"${holo>=2?' filter="url(#glow)"':''}/>`);}
function tag(o,x,y,txt,sub,anchor='start',col='#d6f1ff'){o.push(`<text x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" fill="${col}" font-size="12" letter-spacing="1.2">${txt}</text>`);if(sub)o.push(`<text x="${f1(x)}" y="${f1(y+12)}" text-anchor="${anchor}" fill="#86b3c8" font-size="9.5" letter-spacing=".8">${sub}</text>`);}
// corner placement inside the bezel
const M=44;function slot(corner,w,h,W,H){return {x:corner[1]==='L'?M:W-M-w,y:corner[0]==='T'?M+14:H-M-h};}
function calloutLine(o,x,y,w,h,target,col,op=.6){const cx=x+w/2,cy=y+h/2;const side=(target[0]<x||target[0]>x+w);const sx=side?(target[0]<x?x:x+w):cx,sy=side?cy:(target[1]<y?y:y+h);
 const midx=sx+(target[0]-sx)*0.35;o.push(`<path d="M${f1(sx)} ${f1(sy)} L${f1(midx)} ${f1(sy)} L${f1(target[0])} ${f1(target[1])}" fill="none" stroke="${col}" stroke-opacity="${op}" stroke-width="1.3"/>`);
 o.push(`<circle cx="${f1(target[0])}" cy="${f1(target[1])}" r="3.5" fill="none" stroke="${col}" stroke-opacity=".9"/>`);}
// Empire-style card: translucent white panel, lit light-blue or green outline, chip in the object's own display colour
function card(o,corner,W,H,w,title,lines,target,accent,chip){const h=34+lines.length*15;const {x,y}=slot(corner,w,h,W,H);const A=TH[accent];
 calloutLine(o,x,y,w,h,target,A);
 o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${TH.panel}" fill-opacity="${TH.panelA}" stroke="${A}" stroke-width="2" filter="url(#lit)"/>`);
 o.push(`<rect x="${x+2}" y="${y+2}" width="${w-4}" height="20" rx="4" fill="${A}" fill-opacity=".45"/>`);
 if(chip)o.push(`<rect x="${x+8}" y="${y+7}" width="10" height="10" rx="2" fill="${chip}" stroke="${TH.text}" stroke-opacity=".4"/>`);
 o.push(`<text x="${x+(chip?24:10)}" y="${y+16}" fill="${TH.text}" font-size="12" font-weight="bold" letter-spacing="1.3">${title}</text>`);
 lines.forEach((l,i)=>o.push(`<text x="${x+10}" y="${y+38+i*15}" fill="${i%1?TH.sub:TH.text}" font-size="11">${l}</text>`));}
// Mardat-style card (hardware override, e.g. Der's mines): medium-gray panel, near-black display, bright dark red outline, deep dark blue title bar
function cardMardat(o,corner,W,H,w,title,lines,target){const T=THEMES.mardat;const h=34+lines.length*15;const {x,y}=slot(corner,w,h,W,H);
 calloutLine(o,x,y,w,h,target,T.red,.85);
 o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${T.panel}" stroke="${T.red}" stroke-width="2.2"/>`);
 o.push(`<rect x="${x+5}" y="${y+24}" width="${w-10}" height="${h-29}" fill="${T.ground}"/>`);
 o.push(`<rect x="${x+2}" y="${y+2}" width="${w-4}" height="20" fill="${T.blue}"/><rect x="${x+2}" y="${y+2}" width="6" height="20" fill="${T.red}"/>`);
 o.push(`<text x="${x+14}" y="${y+16}" fill="${T.text}" font-size="12" font-weight="bold" letter-spacing="1.3">${title}</text>`);
 lines.forEach((l,i)=>o.push(`<text x="${x+12}" y="${y+40+i*15}" fill="${i===lines.length-1?'#ff5a6e':T.text}" font-size="11">${l}</text>`));}
function legend(o,corner,W,H,w,title,rows,notes){const h=34+rows.length*18+notes.length*14+6;const {x,y}=slot(corner,w,h,W,H);
 o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${TH.panel}" fill-opacity="${TH.panelA}" stroke="${TH.green}" stroke-width="2" filter="url(#lit)"/>`);
 o.push(`<rect x="${x+8}" y="${y+26}" width="${w-16}" height="${rows.length*18+4}" rx="3" fill="#06141f"/>`);
 o.push(`<text x="${x+10}" y="${y+18}" fill="${TH.text}" font-size="12" font-weight="bold" letter-spacing="1.8">${title}</text>`);
 rows.forEach(([sw,txt],i)=>{const yy=y+42+i*18;o.push(sw(x+14,yy-4));o.push(`<text x="${x+56}" y="${yy}" fill="#d6f1ff" font-size="11">${txt}</text>`);});
 notes.forEach((n,i)=>o.push(`<text x="${x+10}" y="${y+48+rows.length*18+i*14}" fill="${TH.sub}" font-size="9.8">${n}</text>`));}
const swLine=(col,dash,w=2)=>(x,y)=>`<line x1="${x}" y1="${y}" x2="${x+34}" y2="${y}" stroke="${col}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const swDot=(col)=>(x,y)=>`<g fill="${col}">${[0,8,16,24,32].map(d=>`<rect x="${x+d}" y="${y-1.5}" width="4" height="3"/>`).join('')}</g>`;
const report={};
const deg=Math.PI/180;
// tilt is now given as ELEVATION above the orbital plane (Doug, round 4): ellipse ratio ry/rx = sin(elevation)
const VARIANTS=[
 {id:'a',elev:70,bodyK:1.3,Rstar:84,closeK:1.25,holo:1,legend:'BR',sys:['TL','TR','BL'],close:['TL','TR','BL'],fitPad:130,mardat:false,note:'steeper 70° (orbits rounder), larger bodies'},
 {id:'b',elev:32,bodyK:1.0,Rstar:64,closeK:1.0,holo:0,legend:'TR',sys:['TL','BL','BR'],close:['TL','BL','BR'],fitPad:90,mardat:true,note:'current v3 tilt (32° elevation = 58° from overhead), medium bodies, Mardat-style Der-mines callout'},
 {id:'c',elev:20,bodyK:1.6,Rstar:100,closeK:1.5,holo:2,legend:'TL',sys:['TR','BL','BR'],close:['BL','TR','BR'],fitPad:90,mardat:false,note:'flatter 20° (orbits flatter), largest holo-style bodies'}];
const CORNERS=['TL','TR','BL','BR'];
function renderSystem(V){const RATIO=Math.sin(V.elev*deg);const W=1600,H=1000,CX=800,CY=548;const o=head(W,H,V);const T0=0;
 const Rstar=V.Rstar,R_IN=RATIO<0.5?Math.max(Rstar+34,(Rstar+10)/0.5):Rstar+34;
 const knots=[['gane',0.133],['horn',0.243],['husk',0.34],['sable',0.538],['kak',0.71],['s1',1.1],['s2',1.6],['gg',2.8],['ig1',5.5],['ig2',9.2],['w1',10],['w2',50]];
 const n=knots.length,lam=0.45,la=Math.log(knots[0][1]),lb=Math.log(knots[n-1][1]);
 const u=knots.map(([,a],i)=>((i/(n-1))+lam*(Math.log(a)-la)/(lb-la))/(1+lam));
 const FIT=Math.min(W/2-80,(H/2-80)/RATIO);const rho=u.map(x=>R_IN+(FIT-R_IN)*x);
 const map=r=>{if(r<=knots[0][1])return R_IN*(r/knots[0][1])**0.5+(rho[0]-R_IN)*(r/knots[0][1]);for(let i=1;i<n;i++)if(r<=knots[i][1]){const t=(Math.log(r)-Math.log(knots[i-1][1]))/(Math.log(knots[i][1])-Math.log(knots[i-1][1]));return rho[i-1]+t*(rho[i]-rho[i-1]);}return rho[n-1];};
 const scr=([x,y])=>{const r=Math.hypot(x,y);if(!r)return[CX,CY];const k=map(r)/r;return[CX+x*k,CY-y*k*RATIO];};
 const ring=(rpx)=>`<ellipse cx="${CX}" cy="${CY}" rx="${f1(rpx)}" ry="${f1(rpx*RATIO)}"`;
 for(let r=80;r<FIT+40;r+=55)o.push(`${ring(r)} fill="none" stroke="${LN}" stroke-opacity=".06"/>`);
 for(let i=0;i<24;i++){const t=i*TAU/24;o.push(`<line x1="${f1(CX+R_IN*Math.cos(t))}" y1="${f1(CY-R_IN*RATIO*Math.sin(t))}" x2="${f1(CX+(FIT+30)*Math.cos(t))}" y2="${f1(CY-(FIT+30)*RATIO*Math.sin(t))}" stroke="${LN}" stroke-opacity="${i%6?0.035:0.08}"/>`);}
 const hz1=map(0.68),hz2=map(1.22);o.push(`<path d="M${CX-hz2} ${CY} a${hz2} ${f1(hz2*RATIO)} 0 1 0 ${2*hz2} 0 a${hz2} ${f1(hz2*RATIO)} 0 1 0 ${-2*hz2} 0 M${CX-hz1} ${CY} a${hz1} ${f1(hz1*RATIO)} 0 1 1 ${2*hz1} 0 a${hz1} ${f1(hz1*RATIO)} 0 1 1 ${-2*hz1} 0" fill="${TH.green}" fill-opacity=".07" fill-rule="evenodd"/>`);
 [['somb',1.1,1.6,380,'#d8c9a3'],['wall',10,50,700,'#9ec3e0']].forEach(([id,a1,a2,cnt,col])=>{for(let i=0;i<cnt;i++){const r=a1*Math.pow(a2/a1,hash(id+'u'+i)),t=hash(id+'t'+i)*TAU,p=scr([r*Math.cos(t),r*Math.sin(t)]);o.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${hash(id+'s'+i)>0.9?1.2:0.7}" fill="${col}" opacity="${(0.2+0.35*hash(id+'o'+i)).toFixed(2)}"/>`);}});
 Object.values(B).forEach(b=>{const d=poly(Array.from({length:241},(_,i)=>scr(helio(b,b.P*i/240))));o.push(`<path d="${d}" fill="none" stroke="${LN}" stroke-opacity=".10" stroke-width="4"/><path d="${d}" fill="none" stroke="${LN}" stroke-opacity=".45" stroke-width="1"/>`);});
 const kak=B.kak,gg=B.gg;const h=hohmann(kak.a*AU,gg.a*AU,muStar),tofd=h.tof/DAY;
 const lead=Math.PI-TAU*tofd/gg.P,ang=p=>Math.atan2(p[1],p[0]),nrm=a=>((a%TAU)+3*Math.PI)%TAU-Math.PI;let tw=0;for(let t=0;t<2000;t+=0.02)if(Math.abs(nrm(ang(helio(gg,t))-ang(helio(kak,t))-lead))<0.004){tw=t;break;}
 const thD=ang(helio(kak,tw)),aAU=h.at/AU;const arc=[];for(let i=0;i<=160;i++){const nu=Math.PI*i/160,r=aAU*(1-h.e*h.e)/(1+h.e*Math.cos(nu));arc.push(scr([r*Math.cos(thD+nu),r*Math.sin(thD+nu)]));}
 o.push(`<path d="${poly(arc)}" fill="none" stroke="#5fffc0" stroke-width="2" stroke-dasharray="9 6" filter="url(#glow)" opacity=".9"/>`);
 const ghost=(p,col)=>o.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="9" fill="none" stroke="${col}" stroke-width="1.3" stroke-dasharray="3 3"/>`);
 ghost(scr(helio(kak,tw)),'#5fffc0');ghost(scr(helio(gg,tw+tofd)),'#5fffc0');
 const BUD=150000;const fz=fusionMatched(t=>helio(kak,t),t=>helio(gg,t),T0,0.01*G0,BUD,AU);
 const seg=(t1,t2,n)=>Array.from({length:n+1},(_,i)=>scr(fz.at(t1+(t2-t1)*i/n)));
 o.push(`<path d="${poly(seg(0,fz.T,120))}" fill="none" stroke="#c49bff" stroke-width="1.8" stroke-opacity=".9" stroke-dasharray="3 4"/>`);
 o.push(`<path d="${poly(seg(0,fz.tb,40))}" fill="none" stroke="#c49bff" stroke-width="3" filter="url(#glow)"/>`);
 o.push(`<path d="${poly(seg(fz.T-fz.tb,fz.T,40))}" fill="none" stroke="#c49bff" stroke-width="3" filter="url(#glow)"/>`);
 ghost(scr(fz.arrive),'#c49bff');
 const RE=6371;const sz=b=>V.bodyK*(8+5*Math.pow(b.R/RE,0.4));
 const items=Object.values(B).map(b=>({b,p:scr(helio(b,T0))})).sort((a,c)=>a.p[1]-c.p[1]);
 const pos={};const drawBody=({b,p})=>{const depth=1+0.08*((p[1]-CY)/(FIT*RATIO));const r=sz(b)*depth;pos[b.id]={p,r};
  if(b.rings){o.push(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r*2.1)}" ry="${f1(r*2.1*Math.max(RATIO,0.3)*0.5)}" fill="none" stroke="#dcecf8" stroke-opacity=".6" stroke-width="1.4"/>`);}
  holoBody(o,V.id+b.id,p[0],p[1],r,b,[CX-p[0],CY-p[1]],RATIO,V.holo);
  if(b.id==='kak'){[r+8,r+13].forEach((rr,k)=>{o.push(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rr)}" ry="${f1(rr*RATIO)}" fill="none" stroke="${LN}" stroke-opacity=".35"/>`);const t=k?2.2:4.0;o.push(`<circle cx="${f1(p[0]+rr*Math.cos(t))}" cy="${f1(p[1]-rr*RATIO*Math.sin(t))}" r="${k?2.6:2.2}" fill="${k?'#a0958b':'#e2d8c8'}"/>`);});}
  tag(o,p[0]+r+8,p[1]-r-4,b.name.toUpperCase(),b.des);};
 // occlusion: bodies above the star centre (far side) first, then star, then near side
 items.filter(i=>i.p[1]<CY).forEach(drawBody);
 o.push(`<circle cx="${CX}" cy="${CY}" r="${Rstar*2.1}" fill="url(#corona)"/>`);
 [1.25,1.45].forEach(k=>o.push(`<ellipse cx="${CX}" cy="${CY}" rx="${f1(Rstar*k)}" ry="${f1(Rstar*k*RATIO)}" fill="none" stroke="${STAR.color}" stroke-opacity=".35"/>`));
 o.push(`<circle cx="${CX}" cy="${CY}" r="${Rstar}" fill="url(#starG)" filter="url(#glow)"/>`);
 if(V.holo>=2)o.push(`<circle cx="${CX}" cy="${CY}" r="${Rstar}" fill="url(#scan2)" opacity=".5"/>`);
 o.push(`<text x="${CX}" y="${CY-3}" text-anchor="middle" fill="#5b3f12" font-size="${Rstar>70?15:13}" font-weight="bold" letter-spacing="1.5">TAU CETI</text><text x="${CX}" y="${CY+13}" text-anchor="middle" fill="#7a5a24" font-size="11" letter-spacing="1">G8V · 5,320 K</text>`);
 items.filter(i=>i.p[1]>=CY).forEach(drawBody);
 {const q=scr([0.71*Math.cos(-0.6),0.71*Math.sin(-0.6)]);o.push(`<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="2.5" fill="${LN}"/><rect x="${f1(q[0]+6)}" y="${f1(q[1]-9)}" width="66" height="16" rx="3" fill="${TH.panel}" fill-opacity=".92" stroke="${TH.blue}" stroke-width="1.4"/><text x="${f1(q[0]+12)}" y="${f1(q[1]+3)}" fill="${TH.text}" font-size="10.5">0.71 AU</text>`);}
 {const p=scr([1.35*Math.cos(2.5),1.35*Math.sin(2.5)]);tag(o,p[0],p[1],'THE SOMBRERO','B1 · belt','middle','#e8dcb8');const q=scr([25*Math.cos(1.62),25*Math.sin(1.62)]);tag(o,q[0],q[1]-4,'OUTER WALL','B2 · belt','middle','#b9d6ee');}
 const K=pos.kak.p,hp=arc[80];const free=V.sys;
 card(o,free[0],W,H,380,'TRANSFER · KAKAKIKO → tC 6',[`Hohmann (ion/cargo): ${tofd.toFixed(0)} d, Δv ${(h.dv1/1000).toFixed(1)} + ${(h.dv2/1000).toFixed(1)} km/s`,`   next window T+${tw.toFixed(0)} d`,`Turquenish Empire fusion 0.01 g: ${fz.days.toFixed(0)} d`,`   burn-coast-burn, ${(fz.tb/DAY).toFixed(1)} d burns · Δv ${(fz.dvUsed/1000).toFixed(0)}/${BUD/1000} km/s`,'   arrival matched to tC 6 (Croquet Ball, proposed)'],hp,'green','#c49bff');
 card(o,free[1],W,H,350,'KAKAKIKO · tC 5',['Ocean super-Earth · 0.967 G · 34 h day','Orbit 0.71 AU · year 247.4 d','Moons: Shudder, Der Eindringling','L3 / L4 / L5 stations on Der\'s orbit','[ Open in Orbital Object Details ]'],[K[0]+pos.kak.r*0.7,K[1]-pos.kak.r*0.7],'blue',B.kak.col[1]);
 card(o,free[2],W,H,350,'TAU CETI · G8V',['0.78 M☉ · 0.488 L☉ · 5,320 K · metal-poor','Display: pale yellow, slight orange tint','   (a touch warmer than the Sun; not red)','Habitable zone 0.68–1.22 AU (green band)'],[CX+Rstar*0.7,CY+Rstar*0.7],'blue',STAR.color);
 legend(o,V.legend,W,H,440,'LEGEND · TAU CETI (TURQUENISH)',[[swLine('#5fffc0','9 6'),'Hohmann transfer (ghost rings = depart / arrive)'],[swLine('#c49bff',null,3),'Turquenish Empire fusion 0.01 g burn · dotted = coast'],[(x,y)=>`<ellipse cx="${x+17}" cy="${y}" rx="16" ry="${f1(16*Math.max(RATIO,0.35))}" fill="none" stroke="${LN}" stroke-opacity=".7"/>`,'Orbit · hover a ring for true distance']],
  ['Distances SCHEMATIC (toggle: TRUE AU) · sizes enlarged, not to scale',`Epoch T+0 (circa 1600 yrs hence) · placeholder · view elevation ${V.elev}°`,'Interface theme: Empire-style (swatches est.) · concept mockup v4'+V.id]);
 tail(o,W,H,V,'TAU CETI · SYSTEM NAV HOLO');writeFileSync(`concept_tauceti-turquenish-system_20260930_v4${V.id}.svg`,o.join('\n'));
 report['system_'+V.id]={ratio:RATIO,hohmann:{tof:tofd,dv1:h.dv1/1000,dv2:h.dv2/1000,window:tw},fusion:{days:fz.days,burn_d:fz.tb/DAY,dv:fz.dvUsed/1000}};}
function renderClose(V){const RATIO=Math.sin(V.elev*deg);const W=1600,H=1000,CX=820,CY=548;const o=head(W,H,V);const T0=6.0;
 const S=Math.min(0.00135,(W/2-110)/465000,(H/2-V.fitPad)/(465000*RATIO));
 const scr=([x,y])=>[CX+x*S,CY-y*S*RATIO];
 for(let r=50000;r<=450000;r+=50000){o.push(`<ellipse cx="${CX}" cy="${CY}" rx="${f1(r*S)}" ry="${f1(r*S*RATIO)}" fill="none" stroke="${LN}" stroke-opacity="${r%100000?0.035:0.07}"/>`);if(r%100000===0){const p=scr([r*Math.cos(-1.9),r*Math.sin(-1.9)]);o.push(`<text x="${f1(p[0]+4)}" y="${f1(p[1]+11)}" fill="${LN}" fill-opacity=".45" font-size="9.5">${r/1000}k km</text>`);}}
 for(let i=0;i<24;i++){const t=i*TAU/24;const a=scr([60000*Math.cos(t),60000*Math.sin(t)]),b=scr([460000*Math.cos(t),460000*Math.sin(t)]);o.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${LN}" stroke-opacity="${i%6?0.03:0.07}"/>`);}
 const orb=(fn,P)=>poly(Array.from({length:361},(_,i)=>scr(fn(P*i/360))));
 [[derPos,DER.P,'#c8bcb0'],[shuPos,SHU.P,'#e8dccb']].forEach(([fn,P,col])=>{const d=orb(fn,P);o.push(`<path d="${d}" fill="none" stroke="${LN}" stroke-opacity=".10" stroke-width="4"/><path d="${d}" fill="none" stroke="${col}" stroke-opacity=".55" stroke-width="1.1"/>`);});
 {const c=Math.cos(SHU.w),s=Math.sin(SHU.w);const pe=scr([SHU.a*(1-SHU.e)*c,SHU.a*(1-SHU.e)*s]),ap=scr([-SHU.a*(1+SHU.e)*c,-SHU.a*(1+SHU.e)*s]);
  o.push(`<circle cx="${f1(pe[0])}" cy="${f1(pe[1])}" r="2.5" fill="#e8dccb"/><text x="${f1(pe[0]+6)}" y="${f1(pe[1]-6)}" fill="#bfb3a2" font-size="9.5">PERIGEE 201,080 km</text><circle cx="${f1(ap[0])}" cy="${f1(ap[1])}" r="2.5" fill="#e8dccb"/><text x="${f1(ap[0]-6)}" y="${f1(ap[1]+14)}" text-anchor="end" fill="#bfb3a2" font-size="9.5">APOGEE 301,620 km</text>`);}
 const D=derPos(T0),L4=lag('L4',T0),L5=lag('L5',T0),L3=lag('L3',T0);
 [[D,L4],[D,L5],[L4,[0,0]],[L5,[0,0]],[D,[0,0]]].forEach(([a,b])=>{const p=scr(a),q=scr(b);o.push(`<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${LN}" stroke-opacity=".12" stroke-dasharray="3 6"/>`);});
 const vD=t=>velOf(derPos,t).map(x=>x/DAY);const dvBack=0.0686;const slugs=[];let Ps=null;
 for(let k=0;k<40;k++){const tl=T0-k*0.6;const r0=derPos(tl),v=vD(tl),vm=Math.hypot(...v);const v0=[v[0]-dvBack*v[0]/vm,v[1]-dvBack*v[1]/vm];
  const pr=propagate(r0,v0,MU_K/1e9,(T0-tl)*DAY);Ps=pr.P/DAY;if(T0-tl<=Ps)slugs.push(pr.p);}
 {const tl=T0-Ps*0.999;const r0=derPos(tl),v=vD(tl),vm=Math.hypot(...v);const v0=[v[0]-dvBack*v[0]/vm,v[1]-dvBack*v[1]/vm];
  const path=Array.from({length:181},(_,i)=>scr(propagate(r0,v0,MU_K/1e9,Ps*DAY*i/180).p));o.push(`<path d="${poly(path)}" fill="none" stroke="#ffcf7a" stroke-opacity=".25" stroke-dasharray="1 5"/>`);}
 const sk=V.closeK;slugs.forEach(p=>{const s=scr(p);o.push(`<rect x="${f1(s[0]-2.2*sk)}" y="${f1(s[1]-1.4*sk)}" width="${f1(4.4*sk)}" height="${f1(2.8*sk)}" fill="#d9dde3" stroke="#ffcf7a" stroke-opacity=".6" stroke-width=".6"/>`);});
 const c=62*V.closeK/Math.pow(6628,0.7),rp=R_=>c*Math.pow(R_,0.7);const kakR=rp(6628);
 const sp=spiral(7028,MU_K/1e9,0.01*G0/1000,400000);
 const tArr=sp.T/DAY; const tLaunch=T0-0.72*tArr;
 const endP=sp.pts[sp.pts.length-1];const L5arr=lag('L5',tLaunch+tArr);const rot=Math.atan2(L5arr[1],L5arr[0])-Math.atan2(endP[1],endP[0]);
 const R=(p)=>[p[0]*Math.cos(rot)-p[1]*Math.sin(rot),p[0]*Math.sin(rot)+p[1]*Math.cos(rot)];
 const tNow=(T0-tLaunch)*DAY;const outside=p=>{const q=scr(R(p));return Math.hypot(q[0]-CX,q[1]-CY)>kakR;};
 const done=sp.pts.filter(p=>p[2]<=tNow&&outside(p)),todo=sp.pts.filter(p=>p[2]>=tNow);const burnEnd=sp.tBurnEnd;
 o.push(`<path d="${poly(done.filter(p=>p[2]<=burnEnd).map(p=>scr(R(p))))}" fill="none" stroke="#c49bff" stroke-width="2.2" filter="url(#glow)" opacity=".95"/>`);
 o.push(`<path d="${poly(done.filter(p=>p[2]>=burnEnd).map(p=>scr(R(p))))}" fill="none" stroke="#c49bff" stroke-width="1.2" stroke-opacity=".8"/>`);
 o.push(`<path d="${poly(todo.map(p=>scr(R(p))))}" fill="none" stroke="#c49bff" stroke-width="1.2" stroke-opacity=".55" stroke-dasharray="5 5"/>`);
 const shipP=scr(R(todo[0]));const nxt=scr(R(todo[Math.min(20,todo.length-1)]));const hd=Math.atan2(nxt[1]-shipP[1],nxt[0]-shipP[0]);const burning=tNow<burnEnd;
 o.push(`<g transform="translate(${f1(shipP[0])} ${f1(shipP[1])}) rotate(${f1(hd*180/Math.PI)}) scale(${sk})">${burning?'<path d="M-6 0 L-22 -3 L-22 3 Z" fill="#c49bff" opacity=".6"/>':''}<path d="M9 0 L-6 -5 L-3 0 L-6 5 Z" fill="#e9dcff" stroke="#c49bff"/></g>`);
 {const a=scr(L5arr);o.push(`<circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="9" fill="none" stroke="#c49bff" stroke-width="1.3" stroke-dasharray="3 3"/>`);}
 const bodies=[{id:'kak',p:[0,0],r:kakR,b:{col:B.kak.col},n:'KAKAKIKO',s:'tC 5'},{id:'shu',p:shuPos(T0),r:rp(SHU.R),b:{col:SHU.col},n:'SHUDDER',s:'Moon I · 2.8 g/cm³ · e 0.20'},{id:'der',p:D,r:rp(DER.R),b:{col:DER.col},n:'DER EINDRINGLING',s:'Moon II · 7.2 g/cm³'}].map(b=>({...b,q:scr(b.p)})).sort((a,b)=>a.q[1]-b.q[1]);
 const light=[-1,0.25];const bq={};
 bodies.forEach(b=>{bq[b.id]=b;holoBody(o,V.id+'c'+b.id,b.q[0],b.q[1],b.r,b.b,light,RATIO,V.holo);tag(o,b.q[0]+b.r+8,b.q[1]-b.r+2,b.n,b.s);});
 const icon=(p,kind,col,name,sub)=>{const s=scr(p);if(kind==='yard'){o.push(`<g stroke="${col}" fill="none" stroke-width="1.3" filter="url(#glow)"><rect x="${f1(s[0]-9)}" y="${f1(s[1]-5)}" width="18" height="10"/><line x1="${f1(s[0]-9)}" y1="${f1(s[1])}" x2="${f1(s[0]+9)}" y2="${f1(s[1])}"/><path d="M${f1(s[0]+10)} ${f1(s[1]-5)} L${f1(s[0]+24)} ${f1(s[1]-10)} L${f1(s[0]+24)} ${f1(s[1]+10)} L${f1(s[0]+10)} ${f1(s[1]+5)} Z"/></g>`);}
  else if(kind==='haven'){for(let k=-1;k<=1;k++)o.push(`<rect x="${f1(s[0]-11+k*4)}" y="${f1(s[1]-3+k*6)}" width="22" height="5" rx="2.5" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="1.1"/>`);}
  else o.push(`<path d="M${f1(s[0])} ${f1(s[1]-7)} L${f1(s[0]+7)} ${f1(s[1])} L${f1(s[0])} ${f1(s[1]+7)} L${f1(s[0]-7)} ${f1(s[1])} Z" fill="${col}" fill-opacity=".2" stroke="${col}" stroke-width="1.2"/>`);
  tag(o,s[0]+16,s[1]+20,name,sub,'start',col);return s;};
 icon(L4,'yard','#ffcf7a','L4 YARD + GOLIATH FUNNEL','leads Der by 60°');icon(L5,'haven','#8fe3ff','L5 HAVEN','trails Der by 60°');const s3=icon(L3,'watch','#b7c4dc','L3 WATCH','opposite Der');
 {const a=scr(derPos(T0+2.5)),b=scr(derPos(T0+3.6));o.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${LN}" stroke-opacity=".6" stroke-width="1.3"/><circle cx="${f1(b[0])}" cy="${f1(b[1])}" r="2" fill="${LN}"/>`);}
 const elapsed=tNow/3600,eta=(sp.T-tNow)/3600;const free=V.close;
 card(o,free[0],W,H,370,'SHIP · CREW SHUTTLE (placeholder)',[`Turquenish Empire fusion 0.01 g · ${burning?'burning':'coasting'}`,'Orbit raise: Kakakiko low orbit → L5 Haven',`Elapsed ${elapsed.toFixed(1)} h · arrive in ${eta.toFixed(1)} h`,`Δv ${(sp.dvUsed).toFixed(1)} km/s of 9.0 budget (placeholder)`,'Reaction mass left ~28% (placeholder)'],[shipP[0]+4,shipP[1]-4],'green','#c49bff');
 if(V.mardat){const d=bq.der;cardMardat(o,free[1],W,H,360,'DER MINES · MARDAT HARDWARE',['Some Der mining runs Mardat hardware + software','(best-in-class automation, or war-surplus buys)','Interface override: Mardat-style, per object','CROSS-BORDER HARDWARE · narrative'],[d.q[0]-d.r*0.5,d.q[1]+d.r*0.5]);}
 else card(o,free[1],W,H,360,'L3 WATCH STATION',['Der\'s L3 point, opposite Der · ~400,000 km','Weather and monitoring of the far hemisphere','Crew ~20 (under 50) · 2 weeks on / 2 off','Relays to Der via L4 and L5'],[s3[0]+6,s3[1]-6],'blue','#b7c4dc');
 const mid=scr(slugs[Math.floor(slugs.length*0.45)]);
 card(o,free[2],W,H,360,'MASS-DRIVER STREAM · DER → L4',['Backward shots, ~70 m/s beyond escape',`One-orbit phasing ellipse · ${Ps.toFixed(1)} d to the catcher`,`${slugs.length} slugs in flight (1 per 0.6 d, placeholder)`],[mid[0],mid[1]],'green','#ffcf7a');
 legend(o,V.legend,W,H,460,'LEGEND · KAKAKIKO CLOSE-UP',[[swLine('#c49bff',null,2.4),'Turquenish Empire fusion 0.01 g · thin = coast · dashed = planned'],[swDot('#d9dde3'),'Mass-driver slugs (dotted stream)'],[(x,y)=>`<ellipse cx="${x+17}" cy="${y}" rx="16" ry="${f1(16*Math.max(RATIO,0.35))}" fill="none" stroke="#e8dccb" stroke-opacity=".8"/>`,'Moon orbit (true shape, linear distances)']],
  [`Planet-centred · elevation ${V.elev}° · 1 px ≈ ${Math.round(1/S)} km · bodies enlarged (R^0.7)`,'Epoch T+0 (circa 1600 yrs hence) + 6 d · placeholder',`Interface theme: Empire-style${V.mardat?' (Der mines: Mardat-style override)':''} · mockup v4${V.id}`]);
 tail(o,W,H,V,'KAKAKIKO · LOCAL NAV HOLO');writeFileSync(`concept_kakakiko-closeup_20260930_v4${V.id}.svg`,o.join('\n'));
 report['close_'+V.id]={ratio:RATIO,S,spiral_h:sp.T/3600,burn_h:sp.tBurnEnd/3600,spiral_dv:sp.dvUsed,slugP:Ps,slugs:slugs.length,ship_elapsed_h:elapsed,eta_h:eta};}
for(const V of VARIANTS){V.tiltLabel=`ELEV ${V.elev}°`;renderSystem(V);renderClose(V);}
console.log(JSON.stringify(report,null,1));
