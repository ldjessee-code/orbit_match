// Concept renderer v2 (not the product): Turquenish tau Ceti, whole system + Kakakiko close-up.
// Implements the v2 spec math: time-parametric positions, two-stage zoom, Lagrange co-orbits,
// Hohmann, and matched-velocity two-phase constant thrust.
import { writeFileSync } from 'node:fs';
const AU=1.495978707e11, MU_SUN=1.32712440018e20, DAY=86400, G0=9.80665, GM_EARTH=3.986004418e14, KM=1000;
const TAU=2*Math.PI;
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
function kepler(M,e){M=((M%TAU)+TAU)%TAU;let E=e<0.8?M:Math.PI;for(let i=0;i<50;i++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-13)break;}return E;}
// ---- system (from Tau_Cet_system_v2.md; placeholders marked) ----
const STAR={name:'tau Ceti',spec:'G8V',mass:0.78,lum:0.488,radius_solar:0.793};
const muStar=MU_SUN*STAR.mass;
const B={
 gane:{name:'Gane',des:'tC 1',a_au:0.133,e:0,R_km:2820,col:['#9b6a4c','#d7a27a'],note:'hot bare rock'},
 horn:{name:'Hornstooth',des:'tC 2',a_au:0.243,e:0,R_km:3110,col:['#8a7a66','#c9b597'],note:'hot bare rock'},
 husk:{name:'Husk',des:'tC 3',a_au:0.34,e:0,R_km:3350,col:['#7d6f63','#b8a894'],note:'stripped rock'},
 sable:{name:'Sable',des:'tC 4',a_au:0.538,e:0.1,R_km:7900,col:['#1e1d22','#5a5660'],note:'black basalt'},
 kak:{name:'Kakakiko',des:'tC 5',a_au:0.71,e:0,R_km:6628,col:['#1f5d8c','#7fc3e6'],note:'ocean super-Earth'},
 gg:{name:'The Gas Giant',des:'tC 6',a_au:2.8,e:0,R_km:58200,col:['#a8875a','#e7d2a3'],note:'Saturn-size'},
 ig1:{name:'Ice Giant 1',des:'tC 7',a_au:5.5,e:0,R_km:24600,col:['#1f4f9a','#7fb2ee'],note:'ringed',rings:true},
 ig2:{name:'Ice Giant 2',des:'tC 8',a_au:9.2,e:0,R_km:24000,col:['#4f7f8f','#b5dbe3'],note:'size placeholder',ph:true},
};
Object.entries(B).forEach(([id,b])=>{b.id=id;b.P=365.25*Math.sqrt(b.a_au**3/STAR.mass);b.M0=hash(id+'M0')*TAU;b.w=hash(id+'w')*TAU;});
const belts=[{id:'sombrero',name:'The Sombrero',a1:1.1,a2:1.6,n:420,col:'#b9a98c'},{id:'wall',name:'Outer Wall',a1:10,a2:50,n:900,col:'#8fa0b8'}];
// Kakakiko subsystem (planet-centred, km)
const KAK_MU=GM_EARTH*1.045;
const DER={name:'Der Eindringling',a_km:400000,e:0.03,R_km:1274.5,col:['#3b3a40','#9a8f86'],P:28.36};
const SHU={name:'Shudder',a_km:251350,e:0.20,R_km:1083.5,col:['#8d8478','#d9cfbf'],P:14.18};
// resonance-consistent phases: Der lambda0 placeholder; Shudder at perigee at conjunction: phi=2λD−λS−ϖS=0
DER.w=hash('der-w')*TAU; DER.M0=hash('der-M')*TAU; SHU.w=hash('shu-w')*TAU;
// Shudder mean longitude λS0 = 2λD0 − ϖS ; λ = ϖ + M
const lamD0=DER.w+DER.M0; SHU.M0=(2*lamD0-SHU.w)-SHU.w;
function orbitPos(o,t,aKey){const M=o.M0+TAU*t/o.P;const E=kepler(M,o.e);const a=o[aKey];const x=a*(Math.cos(E)-o.e),y=a*Math.sqrt(1-o.e*o.e)*Math.sin(E);const c=Math.cos(o.w),s=Math.sin(o.w);return [x*c-y*s,x*s+y*c];}
const helio=(b,t)=>orbitPos(b,t,'a_au');
const derPos=t=>orbitPos(DER,t,'a_km'), shuPos=t=>orbitPos(SHU,t,'a_km');
function lagrange(point,t){const p=derPos(t);const r=Math.hypot(...p),th=Math.atan2(p[1],p[0]);const d={L4:Math.PI/3,L5:-Math.PI/3,L3:Math.PI}[point];return [r*Math.cos(th+d),r*Math.sin(th+d)];}
function vel(fn,t){const h=1e-4;const a=fn(t-h),b=fn(t+h);return [(b[0]-a[0])/(2*h),(b[1]-a[1])/(2*h)];} // units per day
// ---- transfers ----
function hohmann(r1,r2,mu){const at=(r1+r2)/2;return {tof:Math.PI*Math.sqrt(at**3/mu),dv1:Math.abs(Math.sqrt(mu/r1)*(Math.sqrt(2*r2/(r1+r2))-1)),dv2:Math.abs(Math.sqrt(mu/r2)*(1-Math.sqrt(2*r1/(r1+r2)))),at,e:Math.abs(r2-r1)/(r1+r2)};}
// matched-velocity two-phase constant thrust (gravity-free), SI units
function twoPhase(r0,v0,rT,vT,T){const dr=[rT[0]-r0[0]-v0[0]*T,rT[1]-r0[1]-v0[1]*T],dv=[vT[0]-v0[0],vT[1]-v0[1]];
 const a1=[4*dr[0]/T/T-dv[0]/T,4*dr[1]/T/T-dv[1]/T],a2=[3*dv[0]/T-4*dr[0]/T/T,3*dv[1]/T-4*dr[1]/T/T];return {a1,a2,amax:Math.max(Math.hypot(...a1),Math.hypot(...a2))};}
function matched(depFn,tgtFn,t0d,accel,unit){ // depFn/tgtFn: t(days)->pos in `unit` metres per unit
 const S=unit; const r0=depFn(t0d).map(x=>x*S), v0=vel(depFn,t0d).map(x=>x*S/DAY);
 const need=T=>{const td=t0d+T/DAY;return twoPhase(r0,v0,tgtFn(td).map(x=>x*S),vel(tgtFn,td).map(x=>x*S/DAY),T).amax;};
 let lo=1,hi=1;while(need(hi)>accel)hi*=2;for(let i=0;i<80;i++){const m=(lo+hi)/2;if(need(m)>accel)lo=m;else hi=m;}
 const T=hi,td=t0d+T/DAY;const sol=twoPhase(r0,v0,tgtFn(td).map(x=>x*S),vel(tgtFn,td).map(x=>x*S/DAY),T);
 const path=[];for(let i=0;i<=120;i++){const t=T*i/120;let p;if(t<=T/2)p=[r0[0]+v0[0]*t+0.5*sol.a1[0]*t*t,r0[1]+v0[1]*t+0.5*sol.a1[1]*t*t];
  else{const h=T/2,ph=[r0[0]+v0[0]*h+0.5*sol.a1[0]*h*h,r0[1]+v0[1]*h+0.5*sol.a1[1]*h*h],vh=[v0[0]+sol.a1[0]*h,v0[1]+sol.a1[1]*h],u=t-h;p=[ph[0]+vh[0]*u+0.5*sol.a2[0]*u*u,ph[1]+vh[1]*u+0.5*sol.a2[1]*u*u];}
  path.push(p.map(x=>x/S));}
 const vpk=Math.hypot(v0[0]+sol.a1[0]*T/2,v0[1]+sol.a1[1]*T/2);
 return {T,days:T/DAY,path,flip:path[60],arrive:tgtFn(td),dvSpent:(Math.hypot(...sol.a1)+Math.hypot(...sol.a2))*T/2,vpk};}
// ---- two-stage zoom scale ----
function zoomSize(s0,Z,Z1,beta=1){return Z<=Z1?s0:s0*Math.pow(Z/Z1,beta);}
// ---- SVG helpers ----
const f1=n=>n.toFixed(1);
function svgHead(W,H){return [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`,
`<defs><radialGradient id="bg" cx="55%" cy="50%" r="80%"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#03050a"/></radialGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".55"/><stop offset=".35" stop-color="#f3c96a" stop-opacity=".16"/><stop offset="1" stop-color="#f3c96a" stop-opacity="0"/></radialGradient>
<radialGradient id="sun" cx="45%" cy="42%" r="60%"><stop offset="0" stop-color="#fff4d0"/><stop offset=".55" stop-color="#f4cc74"/><stop offset="1" stop-color="#d4923a"/></radialGradient>
<marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L9,5 L0,9" fill="none" stroke="context-stroke" stroke-width="1.6"/></marker></defs>`,
`<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
...Array.from({length:260},(_,i)=>`<circle cx="${f1(hash('sx'+i)*W)}" cy="${f1(hash('sy'+i)*H)}" r="${hash('sr'+i)>0.95?1.2:0.6}" fill="#dfe6ff" opacity="${(0.12+0.4*hash('so'+i)**3).toFixed(2)}"/>`)];}
function sphere(out,id,x,y,r,col,light,opts={}){const L=Math.hypot(light[0],light[1])||1;const hx=50+32*light[0]/L,hy=50+32*light[1]/L;
 out.push(`<radialGradient id="g_${id}" cx="${hx.toFixed(0)}%" cy="${hy.toFixed(0)}%" r="78%"><stop offset="0" stop-color="${col[1]}"/><stop offset=".5" stop-color="${col[0]}"/><stop offset="1" stop-color="#04060b"/></radialGradient>`);
 out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="url(#g_${id})"/>`);}
function label(out,x,y,r,name,sub,dx=1,dy=-1,col='#e3e9f7'){const ex=x+dx*(r+18),ey=y+dy*(r+14);out.push(`<line x1="${f1(x+dx*r*0.75)}" y1="${f1(y+dy*r*0.75)}" x2="${f1(ex)}" y2="${f1(ey)}" stroke="#c9d4ee" stroke-opacity=".45"/>`);
 const anc=dx<0?'end':'start',tx=ex+dx*3;out.push(`<text x="${f1(tx)}" y="${f1(ey-2)}" text-anchor="${anc}" fill="${col}" font-size="12.5" letter-spacing=".4">${name}</text>`);if(sub)out.push(`<text x="${f1(tx)}" y="${f1(ey+11)}" text-anchor="${anc}" fill="#8f9bb8" font-size="10">${sub}</text>`);}
function ghost(out,x,y,col,lab,dx=10,dy=-10){out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="none" stroke="${col}" stroke-width="1.4" stroke-dasharray="3 3"/>`);if(lab)out.push(`<text x="${f1(x+dx)}" y="${f1(y+dy)}" fill="${col}" font-size="10.5">${lab}</text>`);}
function poly(pts){return pts.map((p,i)=>(i?'L':'M')+f1(p[0])+' '+f1(p[1])).join('');}
function flipTick(out,path,scr,col){const m=scr(path[60]),q=scr(path[62]);const ux=q[0]-m[0],uy=q[1]-m[1],L=Math.hypot(ux,uy)||1;const nx=-uy/L*8,ny=ux/L*8;out.push(`<line x1="${f1(m[0]-nx)}" y1="${f1(m[1]-ny)}" x2="${f1(m[0]+nx)}" y2="${f1(m[1]+ny)}" stroke="${col}" stroke-width="2"/>`);}
const report={};
// =================== (a) whole system, zoom Z=1 ===================
{const W=1600,H=1000,CX=1010,CY=505,EL=58*Math.PI/180,SIN=Math.sin(EL);const T0=0;
 const R_IN=52,A0=0.1,RMAX=50;const FIT=Math.min(W-CX-40,(H/2-40)/SIN);const K=(FIT-R_IN)/Math.log(1+RMAX/A0);
 const comp=r=>R_IN+K*Math.log(1+r/A0);const scr=([x,y])=>{const r=Math.hypot(x,y);if(!r)return[CX,CY];const k=comp(r)/r;return[CX+x*k,CY-y*k*SIN];};
 const out=svgHead(W,H);const ring=(r,n=240)=>poly(Array.from({length:n+1},(_,i)=>scr([r*Math.cos(TAU*i/n),r*Math.sin(TAU*i/n)])));
 [0.1,0.3,1,3,10,30].forEach(r=>{out.push(`<path d="${ring(r)}" fill="none" stroke="#6f86b8" stroke-opacity=".08"/>`);const p=scr([r*Math.cos(-1.05),r*Math.sin(-1.05)]);out.push(`<text x="${f1(p[0]+4)}" y="${f1(p[1]+10)}" fill="#6f86b8" fill-opacity=".4" font-size="10">${r} AU</text>`);});
 for(let i=0;i<12;i++){const t=i*Math.PI/6,a=scr([0.05*Math.cos(t),0.05*Math.sin(t)]),b=scr([50*Math.cos(t),50*Math.sin(t)]);out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="#6f86b8" stroke-opacity=".05"/>`);}
 const hz=[0.68,1.22];out.push(`<path d="${ring(hz[1])} ${ring(hz[0])}" fill="#3fa36b" fill-opacity=".08" fill-rule="evenodd" stroke="#3fa36b" stroke-opacity=".22" stroke-dasharray="2 5"/>`);
 belts.forEach(bt=>{for(let i=0;i<bt.n;i++){const u=hash(bt.id+'u'+i),r=bt.a1*Math.pow(bt.a2/bt.a1,u),t=hash(bt.id+'t'+i)*TAU;const p=scr([r*Math.cos(t),r*Math.sin(t)]);out.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${hash(bt.id+'s'+i)>0.9?1.1:0.6}" fill="${bt.col}" opacity="${(0.25+0.4*hash(bt.id+'o'+i)).toFixed(2)}"/>`);}});
 const orbitD=b=>poly(Array.from({length:241},(_,i)=>scr(helio(b,b.P*i/240))));
 Object.values(B).forEach(b=>out.push(`<path d="${orbitD(b)}" fill="none" stroke="${b.col[1]}" stroke-opacity=".30" stroke-width="1.1"/>`));
 // transfers
 const kak=B.kak,gg=B.gg,sab=B.sable;
 const h=hohmann(kak.a_au*AU,gg.a_au*AU,muStar);const tofd=h.tof/DAY;const lead=Math.PI-TAU*tofd/gg.P;
 const ang=p=>Math.atan2(p[1],p[0]);const nrm=a=>((a%TAU)+3*Math.PI)%TAU-Math.PI;let tw=0;for(let t=0;t<2000;t+=0.02){if(Math.abs(nrm(ang(helio(gg,t))-ang(helio(kak,t))-lead))<0.004){tw=t;break;}}
 const thD=ang(helio(kak,tw)),aAU=h.at/AU;const arc=[];for(let i=0;i<=160;i++){const nu=Math.PI*i/160,r=aAU*(1-h.e*h.e)/(1+h.e*Math.cos(nu));arc.push(scr([r*Math.cos(thD+nu),r*Math.sin(thD+nu)]));}
 out.push(`<path d="${poly(arc)}" fill="none" stroke="#5fe0a8" stroke-width="2" stroke-dasharray="9 6" stroke-opacity=".9"/>`);
 {const a=scr(helio(kak,tw)),b=scr(helio(gg,tw+tofd));ghost(out,a[0],a[1],'#5fe0a8',`depart +${tw.toFixed(0)} d`,-78,-10);ghost(out,b[0],b[1],'#5fe0a8',`arrive +${(tw+tofd).toFixed(0)} d`,10,18);}
 const m1=matched(t=>helio(kak,t),t=>helio(gg,t),T0,1*G0,AU);
 out.push(`<path d="${poly(m1.path.map(scr))}" fill="none" stroke="#ffb347" stroke-width="2.3" stroke-opacity=".95"/>`);flipTick(out,m1.path,scr,'#ffb347');{const a=scr(m1.arrive);ghost(out,a[0],a[1],'#ffb347',null);}
 const m2=matched(t=>helio(kak,t),t=>helio(gg,t),T0,0.01*G0,AU);
 out.push(`<path d="${poly(m2.path.map(scr))}" fill="none" stroke="#c49bff" stroke-width="1.8" stroke-opacity=".95"/>`);flipTick(out,m2.path,scr,'#c49bff');{const a=scr(m2.arrive);ghost(out,a[0],a[1],'#c49bff',null);}
 // star
 out.push(`<circle cx="${CX}" cy="${CY}" r="110" fill="url(#glow)"/><circle cx="${CX}" cy="${CY}" r="30" fill="url(#sun)"/>`);
 out.push(`<text x="${CX}" y="${CY+50}" text-anchor="middle" fill="#f3e2b0" font-size="13" letter-spacing="1.5">TAU CETI</text>`);
 // bodies: stage-1 sizes constant: r = 2.6 + 1.9*sqrt(R/R_E)
 const sz=b=>zoomSize(2.6+1.9*Math.sqrt(b.R_km/6371),1,4);
 const lab={gane:[-1,-1],horn:[-1,1],husk:[1,1],sable:[1,-1],kak:[-1,-1],gg:[1,-1],ig1:[1,-1],ig2:[-1,-1]};
 const items=Object.values(B).map(b=>({b,p:scr(helio(b,T0))})).sort((a,c)=>a.p[1]-c.p[1]);
 items.forEach(({b,p})=>{const r=sz(b);if(b.rings)out.push(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r*2.1)}" ry="${f1(r*2.1*SIN*0.45)}" fill="none" stroke="#b9d3f5" stroke-opacity=".55" stroke-width="1.2"/>`);
  sphere(out,b.id,p[0],p[1],r,b.col,[CX-p[0],CY-p[1]]);
  if(b.id==='kak'){const rr=r+6;out.push(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${rr}" ry="${f1(rr*SIN)}" fill="none" stroke="#9fb3d9" stroke-opacity=".35"/><ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${rr+4}" ry="${f1((rr+4)*SIN)}" fill="none" stroke="#9fb3d9" stroke-opacity=".35"/>`);
   const s=shuPos(T0),d=derPos(T0),ts=Math.atan2(s[1],s[0]),td=Math.atan2(d[1],d[0]);sphere(out,'kS',p[0]+rr*Math.cos(ts),p[1]-rr*SIN*Math.sin(ts),1.6,SHU.col,[1,0]);sphere(out,'kD',p[0]+(rr+4)*Math.cos(td),p[1]-(rr+4)*SIN*Math.sin(td),1.8,DER.col,[1,0]);}
  const [dx,dy]=lab[b.id];label(out,p[0],p[1],r,b.name,`${b.des} · ${b.a_au} AU${b.ph?' · size placeholder':''}`,dx,dy,b.id==='kak'?'#bfe4ff':'#e3e9f7');});
 {const p=scr([1.35*Math.cos(2.4),1.35*Math.sin(2.4)]);out.push(`<text x="${f1(p[0])}" y="${f1(p[1])}" fill="#cbbd9f" fill-opacity=".75" font-size="11" text-anchor="middle" letter-spacing="1">THE SOMBRERO</text>`);
  const q=scr([22*Math.cos(1.7),22*Math.sin(1.7)]);out.push(`<text x="${f1(q[0])}" y="${f1(q[1])}" fill="#a9b7cc" fill-opacity=".7" font-size="11" text-anchor="middle" letter-spacing="1">OUTER WALL · 10–50 AU</text>`);
  const z=scr([1.0*Math.cos(-2.2),1.0*Math.sin(-2.2)]);out.push(`<text x="${f1(z[0])}" y="${f1(z[1]+4)}" fill="#6fcf97" fill-opacity=".6" font-size="10" text-anchor="middle">habitable zone 0.68–1.22 AU</text>`);}
 const x0=36,y0=36;out.push(`<rect x="${x0}" y="${y0}" width="420" height="238" rx="6" fill="#0b1224" fill-opacity=".75" stroke="#5a6f9a" stroke-opacity=".35"/>
<text x="${x0+16}" y="${y0+28}" fill="#e3e9f7" font-size="15" letter-spacing="1.5">TAU CETI (TURQUENISH) · SYSTEM VIEWER</text>
<text x="${x0+16}" y="${y0+47}" fill="#8f9bb8" font-size="11">Zoom 1 (whole system) · camera 58° · distances log-compressed · sizes √, fixed</text>
<line x1="${x0+16}" y1="${y0+72}" x2="${x0+56}" y2="${y0+72}" stroke="#5fe0a8" stroke-width="2" stroke-dasharray="9 6"/>
<text x="${x0+66}" y="${y0+76}" fill="#cfe9dc" font-size="12">Hohmann Kakakiko → Gas Giant: ${tofd.toFixed(0)} d, Δv ${(h.dv1/1000).toFixed(1)} + ${(h.dv2/1000).toFixed(1)} km/s</text>
<text x="${x0+66}" y="${y0+91}" fill="#8f9bb8" font-size="11">next window +${tw.toFixed(0)} d</text>
<line x1="${x0+16}" y1="${y0+114}" x2="${x0+56}" y2="${y0+114}" stroke="#ffb347" stroke-width="2.3"/>
<text x="${x0+66}" y="${y0+118}" fill="#f5dcb5" font-size="12">Reactionless 1 g, matched arrival → Gas Giant: ${m1.days.toFixed(1)} d</text>
<text x="${x0+66}" y="${y0+133}" fill="#8f9bb8" font-size="11">peak ${(m1.vpk/1000).toFixed(0)} km/s · tick = flip</text>
<line x1="${x0+16}" y1="${y0+156}" x2="${x0+56}" y2="${y0+156}" stroke="#c49bff" stroke-width="1.8"/>
<text x="${x0+66}" y="${y0+160}" fill="#e2d4ff" font-size="12">Fusion 0.01 g, matched → Gas Giant: ${m2.days.toFixed(1)} d, Δv ${(m2.dvSpent/1000).toFixed(0)} km/s</text>
<text x="${x0+16}" y="${y0+190}" fill="#8f9bb8" font-size="10.5">Names/orbits: Turquenish SoT Tau_Cet_system_v2.md. Phases are placeholders.</text>
<text x="${x0+16}" y="${y0+205}" fill="#8f9bb8" font-size="10.5">Dashed rings = where the body will be at arrival.</text>
<text x="${x0+16}" y="${y0+222}" fill="#8f9bb8" font-size="10.5">Concept mockup drawn from the spec math, not the product.</text>`);
 out.push('</svg>');writeFileSync('concept_tauceti-turquenish-system_20260929.svg',out.join('\n'));
 report.system={hohmann:{tof_d:tofd,dv1:h.dv1/1000,dv2:h.dv2/1000,window_d:tw},react1g:{days:m1.days,vpk:m1.vpk/1000,dv:m1.dvSpent/1000},fusion001:{days:m2.days,dv:m2.dvSpent/1000}};}
// =================== (b) Kakakiko close-up (stage 2) ===================
{const W=1600,H=1000,CX=930,CY=500,EL=58*Math.PI/180,SIN=Math.sin(EL);const T0=3.0;
 const S=1.2/1000; // px per km (linear; deep zoom blends compression to linear)
 const scr=([x,y])=>[CX+x*S,CY-y*S*SIN];const out=svgHead(W,H);
 const star=[-1,0.35]; // direction to tau Ceti in planet frame (placeholder)
 const ring=(r,n=240)=>poly(Array.from({length:n+1},(_,i)=>scr([r*Math.cos(TAU*i/n),r*Math.sin(TAU*i/n)])));
 [100000,200000,300000,400000].forEach(r=>{out.push(`<path d="${ring(r)}" fill="none" stroke="#6f86b8" stroke-opacity=".08"/>`);const p=scr([r*Math.cos(-1.2),r*Math.sin(-1.2)]);out.push(`<text x="${f1(p[0]+4)}" y="${f1(p[1]+10)}" fill="#6f86b8" fill-opacity=".45" font-size="10">${(r/1000).toFixed(0)}k km</text>`);});
 const orb=(fn,P)=>poly(Array.from({length:361},(_,i)=>scr(fn(P*i/360))));
 out.push(`<path d="${orb(derPos,DER.P)}" fill="none" stroke="${DER.col[1]}" stroke-opacity=".45" stroke-width="1.3"/>`);
 out.push(`<path d="${orb(shuPos,SHU.P)}" fill="none" stroke="${SHU.col[1]}" stroke-opacity=".5" stroke-width="1.3"/>`);
 // Shudder apsides
 {const c=Math.cos(SHU.w),s=Math.sin(SHU.w);const pe=scr([SHU.a_km*(1-SHU.e)*c,SHU.a_km*(1-SHU.e)*s]),ap=scr([-SHU.a_km*(1+SHU.e)*c,-SHU.a_km*(1+SHU.e)*s]);
  out.push(`<circle cx="${f1(pe[0])}" cy="${f1(pe[1])}" r="2.5" fill="#d9cfbf"/><text x="${f1(pe[0]+6)}" y="${f1(pe[1]+14)}" fill="#bdb3a3" font-size="10">perigee 201,080 km</text>`);
  out.push(`<circle cx="${f1(ap[0])}" cy="${f1(ap[1])}" r="2.5" fill="#d9cfbf"/><text x="${f1(ap[0]+6)}" y="${f1(ap[1]-8)}" fill="#bdb3a3" font-size="10">apogee 301,620 km</text>`);}
 // equilateral construction lines Kakakiko–Der–L4/L5
 const D=derPos(T0),L4=lagrange('L4',T0),L5=lagrange('L5',T0),L3=lagrange('L3',T0);
 [[D,L4],[D,L5],[L4,[0,0]],[L5,[0,0]]].forEach(([a,b])=>{const p=scr(a),q=scr(b);out.push(`<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="#6f86b8" stroke-opacity=".18" stroke-dasharray="4 5"/>`);});
 // motion trails (time-parametric): last 1.5 d
 const trail=(fn,col)=>{const pts=Array.from({length:31},(_,i)=>scr(fn(T0-1.5+1.5*i/30)));out.push(`<path d="${poly(pts)}" fill="none" stroke="${col}" stroke-width="2.4" stroke-opacity=".35" stroke-linecap="round"/>`);};
 trail(derPos,DER.col[1]);trail(shuPos,SHU.col[1]);trail(t=>lagrange('L4',t),'#ffcf7a');trail(t=>lagrange('L5',t),'#8fe3ff');
 // transfers: ion cargo Hohmann LKO -> L5 (window), fusion 0.01 g matched -> L3
 const rL=6628+400;const h=hohmann(rL*KM,DER.a_km*KM,KAK_MU);const tofd=h.tof/DAY;
 const nL=TAU/(TAU*Math.sqrt((rL*KM)**3/KAK_MU)/DAY); // rad/day of LKO
 // choose departure so arc apoapsis lands on L5 at arrival: depart angle = angle(L5 at t0+tof) - pi
 const tDep=T0+0.4;const arr=lagrange('L5',tDep+tofd);const thA=Math.atan2(arr[1],arr[0]);const thD=thA-Math.PI;
 const arc=[];for(let i=0;i<=160;i++){const nu=Math.PI*i/160,a=h.at/KM,r=a*(1-h.e*h.e)/(1+h.e*Math.cos(nu));arc.push(scr([r*Math.cos(thD+nu),r*Math.sin(thD+nu)]));}
 out.push(`<path d="${poly(arc)}" fill="none" stroke="#5fe0a8" stroke-width="2" stroke-dasharray="9 6" stroke-opacity=".9"/>`);
 {const b=scr(arr);ghost(out,b[0],b[1],'#5fe0a8',`L5 when cargo arrives, +${tofd.toFixed(1)} d`,10,20);}
 const lko=t=>{const th=thD+nL*(t-tDep);return [rL*Math.cos(th),rL*Math.sin(th)];};
 const m=matched(t=>[0,0],t=>lagrange('L3',t),T0,0.01*G0,KM);
 out.push(`<path d="${poly(m.path.map(scr))}" fill="none" stroke="#c49bff" stroke-width="2" stroke-opacity=".95"/>`);flipTick(out,m.path,scr,'#c49bff');{const a=scr(m.arrive);ghost(out,a[0],a[1],'#c49bff',null);}
 // planet (stage-2 size: r_px = c*R^0.7, planet 44 px)
 const c=44/Math.pow(6628,0.7);const rp=R=>c*Math.pow(R,0.7);
 const items=[{id:'kak',p:[0,0],r:rp(6628),col:B.kak.col,name:'Kakakiko',sub:'tC 5 · 1.045 M⊕ · 0.967 G · 34 h day',d:[-1,-1]},
  {id:'shu',p:shuPos(T0),r:rp(SHU.R_km),col:SHU.col,name:'Shudder (Moon I)',sub:'Ø 2,167 km · 2.8 g/cm³ · e 0.20 · 14.18 d',d:[1,-1]},
  {id:'der',p:D,r:rp(DER.R_km),col:DER.col,name:'Der Eindringling',sub:'Ø 2,549 km · 7.2 g/cm³ · 4.2× Shudder mass · 28.36 d',d:[1,1]}].map(o=>({...o,s:scr(o.p)})).sort((a,b)=>a.s[1]-b.s[1]);
 // atmosphere halo for Kakakiko
 items.forEach(o=>{const lp=[star[0],-star[1]];sphere(out,'c'+o.id,o.s[0],o.s[1],o.r,o.col,lp);if(o.id==='kak')out.push(`<circle cx="${f1(o.s[0])}" cy="${f1(o.s[1])}" r="${f1(o.r+2)}" fill="none" stroke="#9fd6ff" stroke-opacity=".35" stroke-width="2.5"/>`);label(out,o.s[0],o.s[1],o.r,o.name,o.sub,o.d[0],o.d[1],o.id==='kak'?'#bfe4ff':'#e3e9f7');});
 // megastructures (icons)
 const icon=(p,kind,col,name,sub,d)=>{const s=scr(p);if(kind==='yard'){out.push(`<g stroke="${col}" fill="none" stroke-width="1.4"><rect x="${f1(s[0]-8)}" y="${f1(s[1]-5)}" width="16" height="10"/><line x1="${f1(s[0]-8)}" y1="${f1(s[1])}" x2="${f1(s[0]+8)}" y2="${f1(s[1])}"/><line x1="${f1(s[0])}" y1="${f1(s[1]-5)}" x2="${f1(s[0])}" y2="${f1(s[1]+5)}"/></g><path d="M${f1(s[0]+9)} ${f1(s[1]-6)} L${f1(s[0]+22)} ${f1(s[1]-10)} L${f1(s[0]+22)} ${f1(s[1]+10)} L${f1(s[0]+9)} ${f1(s[1]+6)} Z" fill="none" stroke="${col}" stroke-opacity=".8"/>`);}
  else if(kind==='haven'){for(let k=-1;k<=1;k++)out.push(`<rect x="${f1(s[0]-10+k*4)}" y="${f1(s[1]-3+k*6)}" width="20" height="5" rx="2.5" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="1.1"/>`);}
  else out.push(`<path d="M${f1(s[0])} ${f1(s[1]-6)} L${f1(s[0]+6)} ${f1(s[1])} L${f1(s[0])} ${f1(s[1]+6)} L${f1(s[0]-6)} ${f1(s[1])} Z" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="1.2"/>`);
  label(out,s[0],s[1],10,name,sub,d[0],d[1],col);};
 icon(L4,'yard','#ffcf7a','L4 Yard + Goliath Funnel','leads Der by 60° · shipyards, catcher',[1,-1]);
 icon(L5,'haven','#8fe3ff','L5 Haven','trails Der by 60° · O\'Neill colonies, spaceport',[-1,1]);
 icon(L3,'watch','#b7c4dc','L3 Watch Station','opposite Der · weather/monitoring',[-1,-1]);
 // motion arrow on Der orbit + star direction
 {const a=scr(derPos(T0+2.2)),b=scr(derPos(T0+3.2));out.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="#c9d4ee" stroke-opacity=".7" stroke-width="1.4" marker-end="url(#arr)"/>`);}
 out.push(`<line x1="120" y1="930" x2="60" y2="930" stroke="#f3d58a" stroke-width="1.4" marker-end="url(#arr)"/><text x="130" y="934" fill="#f3d58a" font-size="11">to tau Ceti (0.71 AU)</text>`);
 const x0=36,y0=36;out.push(`<rect x="${x0}" y="${y0}" width="430" height="236" rx="6" fill="#0b1224" fill-opacity=".75" stroke="#5a6f9a" stroke-opacity=".35"/>
<text x="${x0+16}" y="${y0+28}" fill="#e3e9f7" font-size="15" letter-spacing="1.5">KAKAKIKO · CLOSE-UP (ZOOM STAGE 2)</text>
<text x="${x0+16}" y="${y0+47}" fill="#8f9bb8" font-size="11">Planet-centred frame · distances linear (1 px = 833 km) · sizes R^0.7, enlarged</text>
<text x="${x0+16}" y="${y0+64}" fill="#8f9bb8" font-size="11">2:1 resonance: Shudder is at perigee whenever it passes Der</text>
<line x1="${x0+16}" y1="${y0+90}" x2="${x0+56}" y2="${y0+90}" stroke="#5fe0a8" stroke-width="2" stroke-dasharray="9 6"/>
<text x="${x0+66}" y="${y0+94}" fill="#cfe9dc" font-size="12">Ion cargo, Hohmann low orbit → L5: ${tofd.toFixed(1)} d, Δv ${(h.dv1/1000).toFixed(2)} + ${(h.dv2/1000).toFixed(2)} km/s</text>
<line x1="${x0+16}" y1="${y0+118}" x2="${x0+56}" y2="${y0+118}" stroke="#c49bff" stroke-width="2"/>
<text x="${x0+66}" y="${y0+122}" fill="#e2d4ff" font-size="12">Fusion shuttle 0.01 g, Kakakiko → L3, matched: ${(m.days*24).toFixed(0)} h, Δv ${(m.dvSpent/1000).toFixed(1)} km/s</text>
<text x="${x0+16}" y="${y0+150}" fill="#8f9bb8" font-size="10.5">L3/L4/L5 co-orbit with Der (same radius, ±60° / 180°).</text>
<text x="${x0+16}" y="${y0+166}" fill="#8f9bb8" font-size="10.5">Soft trails = last 1.5 days of motion. Light from tau Ceti (left).</text>
<text x="${x0+16}" y="${y0+182}" fill="#8f9bb8" font-size="10.5">Moon diameters ratio 0.85 kept; Der is 4.2× Shudder's mass.</text>
<text x="${x0+16}" y="${y0+198}" fill="#8f9bb8" font-size="10.5">Source: Tau_Cet_system_v2.md §6.5. Phases/orientation are placeholders.</text>
<text x="${x0+16}" y="${y0+220}" fill="#8f9bb8" font-size="10.5">Concept mockup drawn from the spec math, not the product.</text>`);
 out.push('</svg>');writeFileSync('concept_kakakiko-closeup_20260929.svg',out.join('\n'));
 report.kak={hohmann_lko_L5:{tof_d:tofd,dv1:h.dv1/1000,dv2:h.dv2/1000},fusion_L3:{hours:m.days*24,dv:m.dvSpent/1000}};}
// reference checks
const t2=twoPhase([0,0],[0,0],[0,0],[10000,0],3*10000/G0);report.checks={pureDv_T_s:3*10000/G0,amax_at_that_T:t2.amax/G0};
const rest=twoPhase([0,0],[0,0],[AU,0],[0,0],2*Math.sqrt(AU/G0));report.checks.rest_1AU_amax_g=rest.amax/G0;
report.periods=Object.fromEntries(Object.values(B).map(b=>[b.name,b.P]));
console.log(JSON.stringify(report,null,1));
