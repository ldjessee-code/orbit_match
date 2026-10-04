// Concept mockup generator (not the product). tau Ceti, static tilted view, transfer overlays.
import { writeFileSync } from 'node:fs';
const AU = 1.495978707e11, MU_SUN = 1.32712440018e20, DAY = 86400, G0 = 9.80665;
const W = 1600, H = 1000, CX = 1030, CY = 500;
const EL = 58 * Math.PI / 180, SIN = Math.sin(EL);
const star = { name: 'tau Ceti', spec: 'G8.5V', mass: 0.783, lum: 0.52, color: '#f3d58a' };
const mu = MU_SUN * star.mass;
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
const bodies = [
  { id:'g', name:'tau Ceti g', a:0.133, e:0, P:20.00, R:1.18, base:'#b9825a', band:'#8a5a3c', kind:'hot rocky' },
  { id:'h', name:'tau Ceti h', a:0.243, e:0, P:49.41, R:1.19, base:'#c9b48a', band:'#8f7d5e', kind:'rocky' },
  { id:'f', name:'tau Ceti f', a:1.334, e:0, P:636.13, R:1.81, base:'#6f93b0', band:'#b8cad6', kind:'cool super-Earth' },
];
const moon = { name:'f I (fixture)', parent:'f', P:9.0, R:0.3, color:'#9a9da3' };
bodies.forEach(b=>{ b.M0 = hash(b.id+'M')*2*Math.PI; b.w = hash(b.id+'w')*2*Math.PI; });
function kepler(M,e){let E=M;for(let i=0;i<30;i++)E-= (E-e*Math.sin(E)-M)/(1-e*Math.cos(E));return E;}
function posAU(b,tDays){const M=b.M0+2*Math.PI*tDays/b.P;const E=kepler(M,b.e);const x=b.a*(Math.cos(E)-b.e),y=b.a*Math.sqrt(1-b.e*b.e)*Math.sin(E);
  const c=Math.cos(b.w),s=Math.sin(b.w);return [x*c-y*s,x*s+y*c];}
// radial compression
const R_IN=60, A0=0.1, RMAX_AU=1.334, FIT=Math.min(W-CX-50, (H/2-55)/Math.sin(58*Math.PI/180)); const K=(FIT-R_IN)/Math.log(1+RMAX_AU/A0); const comp = r => R_IN + K*Math.log(1+r/A0);
function scr([x,y]){const r=Math.hypot(x,y);if(r===0)return[CX,CY];const k=comp(r)/r;return [CX+x*k, CY-y*k*SIN];}
const f1 = n=>n.toFixed(1);
let out=[];const P=s=>out.push(s);
P(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`);
P(`<defs>
<radialGradient id="bg" cx="50%" cy="52%" r="75%"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#03050a"/></radialGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".55"/><stop offset=".35" stop-color="#f3c96a" stop-opacity=".18"/><stop offset="1" stop-color="#f3c96a" stop-opacity="0"/></radialGradient>
<radialGradient id="sun" cx="45%" cy="42%" r="60%"><stop offset="0" stop-color="#fff6d8"/><stop offset=".55" stop-color="#f6d27e"/><stop offset="1" stop-color="#d99a3e"/></radialGradient>
<radialGradient id="hz"><stop offset="0" stop-color="#3fa36b" stop-opacity="0"/><stop offset="1" stop-color="#3fa36b" stop-opacity=".10"/></radialGradient>
</defs>`);
P(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
for(let i=0;i<260;i++){const x=hash('sx'+i)*W,y=hash('sy'+i)*H,o=0.15+0.45*hash('so'+i)**3;P(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${hash('sr'+i)>0.95?1.3:0.7}" fill="#dfe6ff" opacity="${o.toFixed(2)}"/>`);}
// plane grid: faint AU rings + radial spokes
function ringPath(rAU,n=180){let d='';for(let i=0;i<=n;i++){const t=2*Math.PI*i/n;const [x,y]=scr([rAU*Math.cos(t),rAU*Math.sin(t)]);d+=(i?'L':'M')+f1(x)+' '+f1(y);}return d;}
[0.05,0.1,0.2,0.5,1].forEach(r=>{P(`<path d="${ringPath(r)}" fill="none" stroke="#6f86b8" stroke-opacity=".10" stroke-width="1"/>`);
  const [lx,ly]=scr([r*Math.cos(-1.2),r*Math.sin(-1.2)]);P(`<text x="${f1(lx+4)}" y="${f1(ly)}" fill="#6f86b8" fill-opacity=".45" font-size="11">${r} AU</text>`);});
for(let i=0;i<12;i++){const t=i*Math.PI/6;const a=scr([0.03*Math.cos(t),0.03*Math.sin(t)]),b=scr([1.6*Math.cos(t),1.6*Math.sin(t)]);P(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="#6f86b8" stroke-opacity=".06"/>`);}
// goldilocks band
const hzIn=0.95*Math.sqrt(star.lum), hzOut=1.67*Math.sqrt(star.lum);
P(`<path d="${ringPath(hzOut)} ${ringPath(hzIn)}" fill="#3fa36b" fill-opacity=".07" fill-rule="evenodd" stroke="#3fa36b" stroke-opacity=".25" stroke-dasharray="2 6"/>`);
{const [x,y]=scr([hzOut*Math.cos(1.2),hzOut*Math.sin(1.2)]);P(`<text x="${f1(x)}" y="${f1(y-8)}" fill="#6fcf97" fill-opacity=".6" font-size="12" letter-spacing="1">GOLDILOCKS ${hzIn.toFixed(2)}–${hzOut.toFixed(2)} AU</text>`);}
// orbits
function orbitPath(b,from=0,to=1){let d='';const n=240;for(let i=0;i<=n;i++){const t=b.P*(from+(to-from)*i/n);const p=scr(posAU(b,t));d+=(i?'L':'M')+f1(p[0])+' '+f1(p[1]);}return d;}
bodies.forEach(b=>P(`<path d="${orbitPath(b)}" fill="none" stroke="#9fb3d9" stroke-opacity=".38" stroke-width="1.2"/>`));
// --- transfers ---
const T0=0;
// Hohmann g -> f using mean radii; find next window
const g=bodies[0], f=bodies[2], h=bodies[1];
const r1=g.a*AU, r2=f.a*AU, at=(r1+r2)/2;
const tof=Math.PI*Math.sqrt(at**3/mu)/DAY;
const dv1=Math.sqrt(mu/r1)*(Math.sqrt(2*r2/(r1+r2))-1)/1000, dv2=Math.sqrt(mu/r2)*(1-Math.sqrt(2*r1/(r1+r2)))/1000;
const ang=p=>Math.atan2(p[1],p[0]);
const lead=Math.PI-2*Math.PI*tof/f.P; // required angle of f ahead of g at departure
let tw=0;{const norm=a=>((a%(2*Math.PI))+3*Math.PI)%(2*Math.PI)-Math.PI;for(let t=0;t<400;t+=0.05){const d=norm(ang(posAU(f,t))-ang(posAU(g,t))-lead);if(Math.abs(d)<0.01){tw=t;break;}}}
const thD=ang(posAU(g,tw)); const eT=(r2-r1)/(r2+r1), aAU=at/AU;
let hd='';for(let i=0;i<=160;i++){const nu=Math.PI*i/160;const r=aAU*(1-eT*eT)/(1+eT*Math.cos(nu));const p=scr([r*Math.cos(thD+nu),r*Math.sin(thD+nu)]);hd+=(i?'L':'M')+f1(p[0])+' '+f1(p[1]);}
P(`<path d="${hd}" fill="none" stroke="#5fe0a8" stroke-width="2.2" stroke-dasharray="9 6" stroke-opacity=".9"/>`);
// arrow chevrons along hohmann
function ghost(p,col,lab,dx=10,dy=-10){const s=scr(p);P(`<circle cx="${f1(s[0])}" cy="${f1(s[1])}" r="7" fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="3 3"/>`);if(lab)P(`<text x="${f1(s[0]+dx)}" y="${f1(s[1]+dy)}" fill="${col}" font-size="11">${lab}</text>`);}
ghost(posAU(g,tw),'#5fe0a8',`depart +${tw.toFixed(0)} d`,-80,18);
ghost(posAU(f,tw+tof),'#5fe0a8',`arrive +${(tw+tof).toFixed(0)} d`,12,20);
// brachistochrone h -> f at several accelerations
const brach=[1.0,0.25].map(gs=>{const acc=gs*G0;const p0=posAU(h,T0);let T=0;for(let k=0;k<20;k++){const p1=posAU(f,T0+T/DAY);const d=Math.hypot(p1[0]-p0[0],p1[1]-p0[1])*AU;T=2*Math.sqrt(d/acc);}
  const p1=posAU(f,T0+T/DAY);const d=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);return {gs,T:T/DAY,p0,p1,dAU:d,vmax:acc*T/2/1000};});
brach.forEach((b,i)=>{const col=i===0?'#ffb347':'#ff8a5c';let d='';for(let j=0;j<=100;j++){const t=j/100;const p=scr([b.p0[0]+(b.p1[0]-b.p0[0])*t,b.p0[1]+(b.p1[1]-b.p0[1])*t]);d+=(j?'L':'M')+f1(p[0])+' '+f1(p[1]);}
  P(`<path d="${d}" fill="none" stroke="${col}" stroke-width="${i===0?2.4:1.6}" stroke-opacity="${i===0?.95:.7}"/>`);
  const mid=scr([(b.p0[0]+b.p1[0])/2,(b.p0[1]+b.p1[1])/2]);const q=scr([b.p0[0]+(b.p1[0]-b.p0[0])*0.51,b.p0[1]+(b.p1[1]-b.p0[1])*0.51]);
  const ux=q[0]-mid[0],uy=q[1]-mid[1],L=Math.hypot(ux,uy)||1;const nx=-uy/L*9,ny=ux/L*9;
  P(`<line x1="${f1(mid[0]-nx)}" y1="${f1(mid[1]-ny)}" x2="${f1(mid[0]+nx)}" y2="${f1(mid[1]+ny)}" stroke="${col}" stroke-width="2"/>`);
  if(i===0)P(`<text x="${f1(mid[0]+14)}" y="${f1(mid[1]-10)}" fill="${col}" font-size="11">flip</text>`);
  ghost(b.p1,col,null);});
// star
P(`<circle cx="${CX}" cy="${CY}" r="150" fill="url(#glow)"/><circle cx="${CX}" cy="${CY}" r="40" fill="url(#sun)"/>`);
P(`<text x="${CX}" y="${CY+72}" text-anchor="middle" fill="#f3e2b0" font-size="15" letter-spacing="1.5">TAU CETI</text><text x="${CX}" y="${CY+89}" text-anchor="middle" fill="#b8a980" font-size="11">G8.5V · 0.78 M☉</text>`);
// redraw near halves of orbits over star (near side = screen y > CY)
bodies.forEach(b=>{let d='',on=false;const n=240;for(let i=0;i<=n;i++){const p=scr(posAU(b,b.P*i/n));if(p[1]>CY&&Math.hypot(p[0]-CX,(p[1]-CY))<55){d+=(on?'L':'M')+f1(p[0])+' '+f1(p[1]);on=true;}else on=false;}if(d)P(`<path d="${d}" fill="none" stroke="#9fb3d9" stroke-opacity=".38" stroke-width="1.2"/>`);});
// planets with star-facing lighting
const pr=b=>6+6*Math.sqrt(b.R);
function planet(cxy,r,base,band,id,label,sub){const [x,y]=cxy;const lx=CX-x,ly=CY-y,L=Math.hypot(lx,ly)||1;const hx=50+30*lx/L,hy=50+30*ly/L;
  P(`<radialGradient id="pg${id}" cx="${hx.toFixed(0)}%" cy="${hy.toFixed(0)}%" r="75%"><stop offset="0" stop-color="${band}"/><stop offset=".45" stop-color="${base}"/><stop offset="1" stop-color="#05070c"/></radialGradient>`);
  P(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="url(#pg${id})"/>`);
  if(label){P(`<line x1="${f1(x+r*0.8)}" y1="${f1(y-r*0.8)}" x2="${f1(x+r+16)}" y2="${f1(y-r-16)}" stroke="#c9d4ee" stroke-opacity=".5"/>`);
    P(`<text x="${f1(x+r+19)}" y="${f1(y-r-18)}" fill="#e3e9f7" font-size="13" letter-spacing=".5">${label}</text>`);
    if(sub)P(`<text x="${f1(x+r+19)}" y="${f1(y-r-4)}" fill="#8f9bb8" font-size="10.5">${sub}</text>`);}}
const drawn=bodies.map(b=>({b,p:scr(posAU(b,T0))})).sort((a,c)=>a.p[1]-c.p[1]);
drawn.forEach(({b,p})=>{planet(p,pr(b),b.base,b.band,b.id,b.name,`${b.a} AU · ${b.P} d · ${b.R} R⊕`);
  if(b.id==='f'){const rr=pr(b)+16;P(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${rr}" ry="${f1(rr*SIN)}" fill="none" stroke="#9fb3d9" stroke-opacity=".3"/>`);
    const t=hash('moonphase')*2*Math.PI;planet([p[0]+rr*Math.cos(t),p[1]-rr*SIN*Math.sin(t)],4,moon.color,'#d6d8dc','m',null);}});
// legend panel
const hx0=40,hy0=40;P(`<g><rect x="${hx0}" y="${hy0}" width="360" height="206" rx="6" fill="#0b1224" fill-opacity=".72" stroke="#5a6f9a" stroke-opacity=".35"/>
<text x="${hx0+16}" y="${hy0+28}" fill="#e3e9f7" font-size="15" letter-spacing="1.5">TAU CETI · SYSTEM VIEW</text>
<text x="${hx0+16}" y="${hy0+48}" fill="#8f9bb8" font-size="11">Camera 58° above plane · distance log-compressed · sizes √-compressed</text>
<line x1="${hx0+16}" y1="${hy0+74}" x2="${hx0+56}" y2="${hy0+74}" stroke="#5fe0a8" stroke-width="2.2" stroke-dasharray="9 6"/>
<text x="${hx0+66}" y="${hy0+78}" fill="#cfe9dc" font-size="12">Hohmann g → f: ${tof.toFixed(0)} d, Δv ${dv1.toFixed(1)} + ${dv2.toFixed(1)} km/s</text>
<text x="${hx0+66}" y="${hy0+94}" fill="#8f9bb8" font-size="11">next window in ${tw.toFixed(0)} d</text>
<line x1="${hx0+16}" y1="${hy0+120}" x2="${hx0+56}" y2="${hy0+120}" stroke="#ffb347" stroke-width="2.4"/>
<text x="${hx0+66}" y="${hy0+124}" fill="#f5dcb5" font-size="12">Constant 1 g h → f: ${brach[0].T.toFixed(1)} d, peak ${brach[0].vmax.toFixed(0)} km/s</text>
<line x1="${hx0+16}" y1="${hy0+146}" x2="${hx0+56}" y2="${hy0+146}" stroke="#ff8a5c" stroke-width="1.6" stroke-opacity=".7"/>
<text x="${hx0+66}" y="${hy0+150}" fill="#f5cdb5" font-size="12">Constant ¼ g h → f: ${brach[1].T.toFixed(1)} d, peak ${brach[1].vmax.toFixed(0)} km/s</text>
<text x="${hx0+16}" y="${hy0+180}" fill="#8f9bb8" font-size="10.5">Tick = flip point. Dashed rings = where the body will be.</text>
<text x="${hx0+16}" y="${hy0+195}" fill="#8f9bb8" font-size="10.5">Concept mockup, not the product. Moon "f I" is a fixture.</text></g>`);
P(`</svg>`);
writeFileSync(process.argv[2]||'concept.svg', out.join('\n'));
console.log(JSON.stringify({tof,dv1,dv2,tw,brach:brach.map(b=>({gs:b.gs,T:b.T,dAU:b.dAU,vmax:b.vmax})),hz:[hzIn,hzOut]},null,1));
// reference values
const e2m=Math.PI*Math.sqrt(((AU+1.524*AU)/2)**3/MU_SUN)/DAY;
const ra=AU, rb=1.524*AU;
console.log('Earth-Mars TOF d',e2m.toFixed(1),'dv1',(Math.sqrt(MU_SUN/ra)*(Math.sqrt(2*rb/(ra+rb))-1)/1000).toFixed(3),'dv2',(Math.sqrt(MU_SUN/rb)*(1-Math.sqrt(2*ra/(ra+rb)))/1000).toFixed(3));
const Tb=2*Math.sqrt(AU/G0);console.log('1AU 1g T d',(Tb/DAY).toFixed(3),'vmax km/s',(G0*Tb/2/1000).toFixed(1),'0.25g T d',(2*Math.sqrt(AU/(0.25*G0))/DAY).toFixed(3),'1.25g', (2*Math.sqrt(AU/(1.25*G0))/DAY).toFixed(3));
