// Concept renderer v3 (not the product). Holo nav-display style. Turquenish tau Ceti.
import { writeFileSync } from 'node:fs';
const AU=1.495978707e11, MU_SUN=1.32712440018e20, DAY=86400, G0=9.80665, GM_E=3.986004418e14, KM=1000, TAU=2*Math.PI;
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
function kepler(M,e){M=((M%TAU)+TAU)%TAU;let E=e<0.8?M:Math.PI;for(let i=0;i<60;i++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-13)break;}return E;}
const f1=n=>n.toFixed(1);
// ---------- star colour table (display) ----------
const STAR_COLORS=[['O',30000,'#9db4ff'],['B',10000,'#b5c7ff'],['A',7500,'#dfe6ff'],['F',6000,'#fbf6ea'],['G0',5600,'#fff0c8'],['G5',5200,'#ffdb96'],['K0',4700,'#ffc97a'],['K5',3900,'#ffad5c'],['M0',3500,'#ff9148'],['M5',2800,'#ff7a3a']];
const STAR={name:'tau Ceti',spec:'G8.5V',mass:0.78,lum:0.488,teff:5320,color:'#ffd98f'}; // G5-G9 row, toward orange
const muStar=MU_SUN*STAR.mass;
// ---------- system ----------
const P0={gane:40,horn:150,husk:260,sable:330,kak:95,gg:55,ig1:230,ig2:120}; // placeholder mean anomalies (deg)
const B={
 gane:{name:'Gane',des:'tC 1',a:0.133,e:0,R:2820,col:['#9b6a4c','#e0a77c']},
 horn:{name:'Hornstooth',des:'tC 2',a:0.243,e:0,R:3110,col:['#8a7a66','#d2bd9c']},
 husk:{name:'Husk',des:'tC 3',a:0.34,e:0,R:3350,col:['#76695e','#bcac97']},
 sable:{name:'Sable',des:'tC 4',a:0.538,e:0.1,R:7900,col:['#23222a','#6c6874']},
 kak:{name:'Kakakiko',des:'tC 5',a:0.71,e:0,R:6628,col:['#1d5f92','#86ccef']},
 gg:{name:'The Gas Giant',des:'tC 6',a:2.8,e:0,R:58200,col:['#a8875a','#ecd7a8']},
 ig1:{name:'Ice Giant 1',des:'tC 7',a:5.5,e:0,R:24600,col:['#1f4f9a','#86b8f2'],rings:true},
 ig2:{name:'Ice Giant 2',des:'tC 8',a:9.2,e:0,R:24000,col:['#4f7f8f','#bde0e8']},
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
 return {pts,T:t,tBurnEnd,dvUsed};}
// ---------- holo SVG kit ----------
const CY_='#5fe3ff';
function head(W,H){const o=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Consolas, 'Cascadia Mono', 'Segoe UI', monospace">`,
`<defs>
<radialGradient id="bg" cx="50%" cy="52%" r="75%"><stop offset="0" stop-color="#071726"/><stop offset=".65" stop-color="#030a13"/><stop offset="1" stop-color="#010307"/></radialGradient>
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#5fe3ff" opacity=".035"/></pattern>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<radialGradient id="starG" cx="45%" cy="42%" r="60%"><stop offset="0" stop-color="#fff8e6"/><stop offset=".55" stop-color="${STAR.color}"/><stop offset="1" stop-color="#e3a650"/></radialGradient>
<radialGradient id="corona"><stop offset=".45" stop-color="${STAR.color}" stop-opacity=".5"/><stop offset="1" stop-color="${STAR.color}" stop-opacity="0"/></radialGradient>
</defs>`,`<rect width="${W}" height="${H}" fill="url(#bg)"/>`];
 for(let i=0;i<180;i++)o.push(`<circle cx="${f1(hash('x'+i)*W)}" cy="${f1(hash('y'+i)*H)}" r="${hash('r'+i)>0.94?1.1:0.55}" fill="#cfe9ff" opacity="${(0.08+0.3*hash('o'+i)**3).toFixed(2)}"/>`);return o;}
function tail(o,W,H){o.push(`<rect width="${W}" height="${H}" fill="url(#scan)"/>`);o.push(`<rect x="6" y="6" width="${W-12}" height="${H-12}" fill="none" stroke="${CY_}" stroke-opacity=".18"/>`);
 [[14,14,1,1],[W-14,14,-1,1],[14,H-14,1,-1],[W-14,H-14,-1,-1]].forEach(([x,y,sx,sy])=>o.push(`<path d="M${x} ${y+sy*26} L${x} ${y} L${x+sx*26} ${y}" fill="none" stroke="${CY_}" stroke-opacity=".6" stroke-width="1.5"/>`));o.push('</svg>');}
const poly=pts=>pts.map((p,i)=>(i?'L':'M')+f1(p[0])+' '+f1(p[1])).join('');
function holoSphere(o,id,x,y,r,col,light,ratio){const L=Math.hypot(...light)||1;const hx=50+30*light[0]/L,hy=50+30*light[1]/L;
 o.push(`<radialGradient id="h_${id}" cx="${hx.toFixed(0)}%" cy="${hy.toFixed(0)}%" r="80%"><stop offset="0" stop-color="${col[1]}" stop-opacity=".95"/><stop offset=".55" stop-color="${col[0]}" stop-opacity=".85"/><stop offset="1" stop-color="#021018" stop-opacity=".9"/></radialGradient>`);
 o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r*1.35)}" fill="${col[1]}" opacity=".10" filter="url(#soft)"/>`);
 o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="url(#h_${id})"/>`);
 o.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r)}" ry="${f1(r*ratio*0.55)}" fill="none" stroke="${CY_}" stroke-opacity=".22" stroke-width=".8"/>`);
 o.push(`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r*0.45)}" ry="${f1(r)}" fill="none" stroke="${CY_}" stroke-opacity=".14" stroke-width=".8"/>`);
 o.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="none" stroke="${CY_}" stroke-opacity=".55" stroke-width="1.1"/>`);}
function tag(o,x,y,txt,sub,anchor='start',col='#bff3ff'){o.push(`<text x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" fill="${col}" font-size="12" letter-spacing="1.2">${txt}</text>`);if(sub)o.push(`<text x="${f1(x)}" y="${f1(y+12)}" text-anchor="${anchor}" fill="#6fa8bf" font-size="9.5" letter-spacing=".8">${sub}</text>`);}
function card(o,x,y,w,title,lines,target,accent=CY_){const h=34+lines.length*15;
 // callout line: from nearest card edge midpoint, dogleg to target
 const cx=x+w/2,cy=y+h/2;const ex=target[0]<x?x:target[0]>x+w?x+w:cx,ey=target[1]<y?y:target[1]>y+h?y+h:cy;const sx=(target[0]<x||target[0]>x+w)?ex:cx,sy=(target[0]<x||target[0]>x+w)?cy:ey;
 const midx=sx+(target[0]-sx)*0.35,midy=sy;o.push(`<path d="M${f1(sx)} ${f1(sy)} L${f1(midx)} ${f1(midy)} L${f1(target[0])} ${f1(target[1])}" fill="none" stroke="${accent}" stroke-opacity=".42" stroke-width="1"/>`);
 o.push(`<circle cx="${f1(target[0])}" cy="${f1(target[1])}" r="3" fill="none" stroke="${accent}" stroke-opacity=".7"/>`);
 o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#06141f" fill-opacity=".72" stroke="${accent}" stroke-opacity=".45"/>`);
 o.push(`<rect x="${x}" y="${y}" width="${w}" height="22" rx="4" fill="${accent}" fill-opacity=".12"/>`);
 o.push(`<text x="${x+10}" y="${y+15}" fill="${accent}" font-size="12" letter-spacing="1.5">${title}</text>`);
 lines.forEach((l,i)=>o.push(`<text x="${x+10}" y="${y+38+i*15}" fill="#cfeefa" font-size="11">${l}</text>`));}
function legend(o,x,y,w,title,rows,notes){const h=34+rows.length*18+notes.length*14+6;
 o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#06141f" fill-opacity=".72" stroke="${CY_}" stroke-opacity=".35"/>`);
 o.push(`<text x="${x+10}" y="${y+18}" fill="${CY_}" font-size="12" letter-spacing="1.8">${title}</text>`);
 rows.forEach(([sw,txt],i)=>{const yy=y+38+i*18;o.push(sw(x+10,yy-4));o.push(`<text x="${x+52}" y="${yy}" fill="#cfeefa" font-size="11">${txt}</text>`);});
 notes.forEach((n,i)=>o.push(`<text x="${x+10}" y="${y+38+rows.length*18+i*14}" fill="#6fa8bf" font-size="9.8">${n}</text>`));}
const swLine=(col,dash,w=2)=>(x,y)=>`<line x1="${x}" y1="${y}" x2="${x+34}" y2="${y}" stroke="${col}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const swDot=(col)=>(x,y)=>`<g fill="${col}">${[0,8,16,24,32].map(d=>`<rect x="${x+d}" y="${y-1.5}" width="4" height="3"/>`).join('')}</g>`;
const report={};
const TILT=58*Math.PI/180, RATIO=Math.cos(TILT); // tilt measured from straight-down
// ================= (a) whole system, schematic distances =================
{const W=1600,H=1000,CX=800,CY=545;const o=head(W,H);const T0=0;
 const Rstar=64,R_IN=Rstar+34;
 // schematic knots: blend of rank spacing and log spacing
 const knots=[['gane',0.133],['horn',0.243],['husk',0.34],['sable',0.538],['kak',0.71],['s1',1.1],['s2',1.6],['gg',2.8],['ig1',5.5],['ig2',9.2],['w1',10],['w2',50]];
 const n=knots.length,lam=0.45,la=Math.log(knots[0][1]),lb=Math.log(knots[n-1][1]);
 const u=knots.map(([,a],i)=>((i/(n-1))+lam*(Math.log(a)-la)/(lb-la))/(1+lam));
 const FIT=Math.min(W/2-70,(H/2-60)/RATIO);const rho=u.map(x=>R_IN+(FIT-R_IN)*x);
 const map=r=>{if(r<=knots[0][1])return R_IN*(r/knots[0][1])**0.5+(rho[0]-R_IN)*(r/knots[0][1]);for(let i=1;i<n;i++)if(r<=knots[i][1]){const t=(Math.log(r)-Math.log(knots[i-1][1]))/(Math.log(knots[i][1])-Math.log(knots[i-1][1]));return rho[i-1]+t*(rho[i]-rho[i-1]);}return rho[n-1];};
 const scr=([x,y])=>{const r=Math.hypot(x,y);if(!r)return[CX,CY];const k=map(r)/r;return[CX+x*k,CY-y*k*RATIO];};
 const ring=(rpx)=>`<ellipse cx="${CX}" cy="${CY}" rx="${f1(rpx)}" ry="${f1(rpx*RATIO)}"`;
 // polar holo grid
 for(let r=80;r<FIT+40;r+=55)o.push(`${ring(r)} fill="none" stroke="${CY_}" stroke-opacity=".06"/>`);
 for(let i=0;i<24;i++){const t=i*TAU/24;o.push(`<line x1="${f1(CX+R_IN*Math.cos(t))}" y1="${f1(CY-R_IN*RATIO*Math.sin(t))}" x2="${f1(CX+(FIT+30)*Math.cos(t))}" y2="${f1(CY-(FIT+30)*RATIO*Math.sin(t))}" stroke="${CY_}" stroke-opacity="${i%6?0.035:0.08}"/>`);}
 // HZ band
 const hz1=map(0.68),hz2=map(1.22);o.push(`<path d="M${CX-hz2} ${CY} a${hz2} ${f1(hz2*RATIO)} 0 1 0 ${2*hz2} 0 a${hz2} ${f1(hz2*RATIO)} 0 1 0 ${-2*hz2} 0 M${CX-hz1} ${CY} a${hz1} ${f1(hz1*RATIO)} 0 1 1 ${2*hz1} 0 a${hz1} ${f1(hz1*RATIO)} 0 1 1 ${-2*hz1} 0" fill="#3fe0a0" fill-opacity=".06" fill-rule="evenodd"/>`);
 // belts
 [['somb',1.1,1.6,380,'#d8c9a3'],['wall',10,50,700,'#9ec3e0']].forEach(([id,a1,a2,cnt,col])=>{for(let i=0;i<cnt;i++){const r=a1*Math.pow(a2/a1,hash(id+'u'+i)),t=hash(id+'t'+i)*TAU,p=scr([r*Math.cos(t),r*Math.sin(t)]);o.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${hash(id+'s'+i)>0.9?1.2:0.7}" fill="${col}" opacity="${(0.2+0.35*hash(id+'o'+i)).toFixed(2)}"/>`);}});
 // orbits (glow)
 Object.values(B).forEach(b=>{const d=poly(Array.from({length:241},(_,i)=>scr(helio(b,b.P*i/240))));o.push(`<path d="${d}" fill="none" stroke="${CY_}" stroke-opacity=".10" stroke-width="4"/><path d="${d}" fill="none" stroke="${CY_}" stroke-opacity=".45" stroke-width="1"/>`);});
 // ---- transfers: Hohmann + fusion (burn-coast-burn) Kakakiko -> Gas Giant ----
 const kak=B.kak,gg=B.gg;const h=hohmann(kak.a*AU,gg.a*AU,muStar),tofd=h.tof/DAY;
 const lead=Math.PI-TAU*tofd/gg.P,ang=p=>Math.atan2(p[1],p[0]),nrm=a=>((a%TAU)+3*Math.PI)%TAU-Math.PI;let tw=0;for(let t=0;t<2000;t+=0.02)if(Math.abs(nrm(ang(helio(gg,t))-ang(helio(kak,t))-lead))<0.004){tw=t;break;}
 const thD=ang(helio(kak,tw)),aAU=h.at/AU;const arc=[];for(let i=0;i<=160;i++){const nu=Math.PI*i/160,r=aAU*(1-h.e*h.e)/(1+h.e*Math.cos(nu));arc.push(scr([r*Math.cos(thD+nu),r*Math.sin(thD+nu)]));}
 o.push(`<path d="${poly(arc)}" fill="none" stroke="#5fffc0" stroke-width="2" stroke-dasharray="9 6" filter="url(#glow)" opacity=".9"/>`);
 const ghost=(p,col)=>o.push(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="9" fill="none" stroke="${col}" stroke-width="1.3" stroke-dasharray="3 3"/>`);
 ghost(scr(helio(kak,tw)),'#5fffc0');ghost(scr(helio(gg,tw+tofd)),'#5fffc0');
 const BUD=150000;const fz=fusionMatched(t=>helio(kak,t),t=>helio(gg,t),T0,0.01*G0,BUD,AU);
 const seg=(t1,t2,n)=>Array.from({length:n+1},(_,i)=>scr(fz.at(t1+(t2-t1)*i/n)));
 o.push(`<path d="${poly(seg(0,fz.T,120))}" fill="none" stroke="#c49bff" stroke-width="1.2" stroke-opacity=".7" stroke-dasharray="2 4"/>`);
 o.push(`<path d="${poly(seg(0,fz.tb,40))}" fill="none" stroke="#c49bff" stroke-width="3" filter="url(#glow)"/>`);
 o.push(`<path d="${poly(seg(fz.T-fz.tb,fz.T,40))}" fill="none" stroke="#c49bff" stroke-width="3" filter="url(#glow)"/>`);
 ghost(scr(fz.arrive),'#c49bff');
 // star
 o.push(`<circle cx="${CX}" cy="${CY}" r="${Rstar*2.1}" fill="url(#corona)"/>`);
 [1.25,1.45].forEach(k=>o.push(`<ellipse cx="${CX}" cy="${CY}" rx="${f1(Rstar*k)}" ry="${f1(Rstar*k*RATIO)}" fill="none" stroke="${STAR.color}" stroke-opacity=".35"/>`));
 o.push(`<circle cx="${CX}" cy="${CY}" r="${Rstar}" fill="url(#starG)" filter="url(#glow)"/>`);
 tag(o,CX,CY-Rstar-30,'TAU CETI','G8.5V','middle','#ffe2a8');
 // bodies: schematic large sizes r = 8 + 5*(R/RE)^0.4, depth cue ±8%
 const RE=6371;const sz=b=>8+5*Math.pow(b.R/RE,0.4);
 const items=Object.values(B).map(b=>({b,p:scr(helio(b,T0)),y:helio(b,T0)[1]})).sort((a,c)=>a.p[1]-c.p[1]);
 const pos={};items.forEach(({b,p})=>{const depth=1-0.08*((p[1]-CY)/(FIT*RATIO))*-1;const r=sz(b)*depth;pos[b.id]={p,r};
  if(b.rings){o.push(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r*2.1)}" ry="${f1(r*2.1*RATIO*0.5)}" fill="none" stroke="#bfe0ff" stroke-opacity=".6" stroke-width="1.4"/>`);}
  holoSphere(o,b.id,p[0],p[1],r,b.col,[CX-p[0],CY-p[1]],RATIO);
  if(b.id==='kak'){[r+8,r+13].forEach((rr,k)=>{o.push(`<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(rr)}" ry="${f1(rr*RATIO)}" fill="none" stroke="${CY_}" stroke-opacity=".35"/>`);const t=k?2.2:4.0;o.push(`<circle cx="${f1(p[0]+rr*Math.cos(t))}" cy="${f1(p[1]-rr*RATIO*Math.sin(t))}" r="${k?2.6:2.2}" fill="${k?'#a0958b':'#e2d8c8'}"/>`);});}
  const lx=p[0]+r+8,ly=p[1]-r-4;tag(o,lx,ly,b.name.toUpperCase(),b.des);});
 // hover example on Kakakiko's orbit (true distance)
 {const q=scr([0.71*Math.cos(-0.6),0.71*Math.sin(-0.6)]);o.push(`<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="2.5" fill="${CY_}"/><rect x="${f1(q[0]+6)}" y="${f1(q[1]-9)}" width="66" height="16" rx="3" fill="#06141f" fill-opacity=".85" stroke="${CY_}" stroke-opacity=".5"/><text x="${f1(q[0]+12)}" y="${f1(q[1]+3)}" fill="${CY_}" font-size="10.5">0.71 AU</text>`);}
 {const p=scr([1.35*Math.cos(2.5),1.35*Math.sin(2.5)]);tag(o,p[0],p[1],'THE SOMBRERO','B1 · belt','middle','#e8dcb8');const q=scr([25*Math.cos(1.62),25*Math.sin(1.62)]);tag(o,q[0],q[1]-4,'OUTER WALL','B2 · belt','middle','#b9d6ee');}
 // callouts (3)
 const K=pos.kak.p,G=pos.gg.p;
 card(o,1210,40,350,'KAKAKIKO · tC 5',['Ocean super-Earth · 0.967 G · 34 h day','Orbit 0.71 AU · year 247.4 d','Moons: Shudder, Der Eindringling','L3 / L4 / L5 stations on Der\'s orbit','[ Open in Orbital Object Details ]'],[K[0]+pos.kak.r*0.7,K[1]-pos.kak.r*0.7]);
 const hp=arc[80];
 card(o,40,40,370,'TRANSFER · KAKAKIKO → GAS GIANT',[`Hohmann (ion/cargo): ${tofd.toFixed(0)} d, Δv ${(h.dv1/1000).toFixed(1)} + ${(h.dv2/1000).toFixed(1)} km/s`,`   next window T+${tw.toFixed(0)} d`,`Turquenish Empire fusion 0.01 g: ${fz.days.toFixed(0)} d`,`   burn-coast-burn, ${(fz.tb/DAY).toFixed(1)} d burns · Δv ${(fz.dvUsed/1000).toFixed(0)}/${BUD/1000} km/s`,'   arrival matched to the Gas Giant'],hp,'#5fffc0');
 card(o,1230,800,330,'TAU CETI · G8.5V',['0.78 M☉ · 0.488 L☉ · 5,320 K','Display colour: G5–G9 row (pale yellow-orange)','Habitable zone 0.68–1.22 AU (green band)'],[CX+Rstar*0.7,CY+Rstar*0.7],'#ffd98f');
 legend(o,40,800,420,'LEGEND · TAU CETI (TURQUENISH)',[[swLine('#5fffc0','9 6'),'Hohmann transfer (ghost rings = depart / arrive)'],[swLine('#c49bff',null,3),'Turquenish Empire fusion 0.01 g burn · dotted = coast'],[(x,y)=>`<ellipse cx="${x+17}" cy="${y}" rx="16" ry="${f1(16*RATIO)}" fill="none" stroke="${CY_}" stroke-opacity=".6"/>`,'Orbit · hover a ring for true distance']],
  ['Distances SCHEMATIC (toggle: TRUE AU) · sizes enlarged, not to scale','Epoch T+0 (circa 1600 yrs hence) · placeholder · phases placeholder','Concept mockup from spec v3 math, not the product']);
 tail(o,W,H);writeFileSync('concept_tauceti-turquenish-system_20260929_v3.svg',o.join('\n'));
 report.system={hohmann:{tof:tofd,dv1:h.dv1/1000,dv2:h.dv2/1000,window:tw},fusion:{days:fz.days,burn_d:fz.tb/DAY,dv:fz.dvUsed/1000}};}
// ================= (b) Kakakiko close-up, tilted 58° =================
{const W=1600,H=1000,CX=820,CY=540;const o=head(W,H);const T0=6.0;
 const S=0.00135; // px per km
 const scr=([x,y])=>[CX+x*S,CY-y*S*RATIO];
 for(let r=50000;r<=450000;r+=50000){o.push(`<ellipse cx="${CX}" cy="${CY}" rx="${f1(r*S)}" ry="${f1(r*S*RATIO)}" fill="none" stroke="${CY_}" stroke-opacity="${r%100000?0.035:0.07}"/>`);if(r%100000===0){const p=scr([r*Math.cos(-1.9),r*Math.sin(-1.9)]);o.push(`<text x="${f1(p[0]+4)}" y="${f1(p[1]+11)}" fill="${CY_}" fill-opacity=".4" font-size="9.5">${r/1000}k km</text>`);}}
 for(let i=0;i<24;i++){const t=i*TAU/24;const a=scr([60000*Math.cos(t),60000*Math.sin(t)]),b=scr([460000*Math.cos(t),460000*Math.sin(t)]);o.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${CY_}" stroke-opacity="${i%6?0.03:0.07}"/>`);}
 const orb=(fn,P)=>poly(Array.from({length:361},(_,i)=>scr(fn(P*i/360))));
 [[derPos,DER.P,'#c8bcb0'],[shuPos,SHU.P,'#e8dccb']].forEach(([fn,P,col])=>{const d=orb(fn,P);o.push(`<path d="${d}" fill="none" stroke="${CY_}" stroke-opacity=".10" stroke-width="4"/><path d="${d}" fill="none" stroke="${col}" stroke-opacity=".55" stroke-width="1.1"/>`);});
 {const c=Math.cos(SHU.w),s=Math.sin(SHU.w);const pe=scr([SHU.a*(1-SHU.e)*c,SHU.a*(1-SHU.e)*s]),ap=scr([-SHU.a*(1+SHU.e)*c,-SHU.a*(1+SHU.e)*s]);
  o.push(`<circle cx="${f1(pe[0])}" cy="${f1(pe[1])}" r="2.5" fill="#e8dccb"/><text x="${f1(pe[0]+6)}" y="${f1(pe[1]-6)}" fill="#bfb3a2" font-size="9.5">PERIGEE 201,080 km</text><circle cx="${f1(ap[0])}" cy="${f1(ap[1])}" r="2.5" fill="#e8dccb"/><text x="${f1(ap[0]-6)}" y="${f1(ap[1]+14)}" text-anchor="end" fill="#bfb3a2" font-size="9.5">APOGEE 301,620 km</text>`);}
 const D=derPos(T0),L4=lag('L4',T0),L5=lag('L5',T0),L3=lag('L3',T0);
 [[D,L4],[D,L5],[L4,[0,0]],[L5,[0,0]],[D,[0,0]]].forEach(([a,b])=>{const p=scr(a),q=scr(b);o.push(`<line x1="${f1(p[0])}" y1="${f1(p[1])}" x2="${f1(q[0])}" y2="${f1(q[1])}" stroke="${CY_}" stroke-opacity=".12" stroke-dasharray="3 6"/>`);});
 // ---- mass-driver slug stream Der -> L4 (backward shots, one-orbit phasing) ----
 const vD=t=>velOf(derPos,t).map(x=>x/DAY); // km/s
 const dvBack=0.0686; // km/s beyond escape (v_inf), backward
 const slugs=[];let Ps=null;
 for(let k=0;k<40;k++){const tl=T0-k*0.6;const r0=derPos(tl),v=vD(tl),vm=Math.hypot(...v);const v0=[v[0]-dvBack*v[0]/vm,v[1]-dvBack*v[1]/vm];
  const pr=propagate(r0,v0,MU_K/1e9,(T0-tl)*DAY);Ps=pr.P/DAY;if(T0-tl<=Ps)slugs.push(pr.p);}
 {// one reference slug path
  const tl=T0-Ps*0.999;const r0=derPos(tl),v=vD(tl),vm=Math.hypot(...v);const v0=[v[0]-dvBack*v[0]/vm,v[1]-dvBack*v[1]/vm];
  const path=Array.from({length:181},(_,i)=>scr(propagate(r0,v0,MU_K/1e9,Ps*DAY*i/180).p));o.push(`<path d="${poly(path)}" fill="none" stroke="#ffcf7a" stroke-opacity=".22" stroke-dasharray="1 5"/>`);}
 slugs.forEach(p=>{const s=scr(p);o.push(`<rect x="${f1(s[0]-2.2)}" y="${f1(s[1]-1.4)}" width="4.4" height="2.8" fill="#d9dde3" stroke="#ffcf7a" stroke-opacity=".6" stroke-width=".6"/>`);});
 // ---- ship: fusion 0.01 g tangential spiral, low orbit -> L5 ----
 const sp=spiral(7028,MU_K/1e9,0.01*G0/1000,400000);
 const tArr=sp.T/DAY; const tLaunch=T0-0.72*tArr; // ship is 72% through
 const endP=sp.pts[sp.pts.length-1];const L5arr=lag('L5',tLaunch+tArr);const rot=Math.atan2(L5arr[1],L5arr[0])-Math.atan2(endP[1],endP[0]);
 const R=(p)=>[p[0]*Math.cos(rot)-p[1]*Math.sin(rot),p[0]*Math.sin(rot)+p[1]*Math.cos(rot)];
 const tNow=(T0-tLaunch)*DAY;const done=sp.pts.filter(p=>p[2]<=tNow&&Math.hypot(p[0],p[1])*S>62),todo=sp.pts.filter(p=>p[2]>=tNow);
 const burnEnd=sp.tBurnEnd;
 o.push(`<path d="${poly(done.filter(p=>p[2]<=burnEnd).map(p=>scr(R(p))))}" fill="none" stroke="#c49bff" stroke-width="2.2" filter="url(#glow)" opacity=".95"/>`);
 o.push(`<path d="${poly(done.filter(p=>p[2]>=burnEnd).map(p=>scr(R(p))))}" fill="none" stroke="#c49bff" stroke-width="1.2" stroke-opacity=".8"/>`);
 o.push(`<path d="${poly(todo.map(p=>scr(R(p))))}" fill="none" stroke="#c49bff" stroke-width="1.2" stroke-opacity=".55" stroke-dasharray="5 5"/>`);
 const shipP=scr(R(todo[0]));const nxt=scr(R(todo[Math.min(20,todo.length-1)]));const hd=Math.atan2(nxt[1]-shipP[1],nxt[0]-shipP[0]);
 const burning=tNow<burnEnd;
 o.push(`<g transform="translate(${f1(shipP[0])} ${f1(shipP[1])}) rotate(${f1(hd*180/Math.PI)})">${burning?'<path d="M-6 0 L-22 -3 L-22 3 Z" fill="#c49bff" opacity=".6"/>':''}<path d="M9 0 L-6 -5 L-3 0 L-6 5 Z" fill="#e9dcff" stroke="#c49bff"/></g>`);
 {const a=scr(L5arr);o.push(`<circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="9" fill="none" stroke="#c49bff" stroke-width="1.3" stroke-dasharray="3 3"/>`);}
 // ---- bodies ----
 const c=62/Math.pow(6628,0.7),rp=R_=>c*Math.pow(R_,0.7);
 const bodies=[{id:'kak',p:[0,0],r:rp(6628),col:B.kak.col,n:'KAKAKIKO',s:'tC 5'},{id:'shu',p:shuPos(T0),r:rp(SHU.R),col:SHU.col,n:'SHUDDER',s:'Moon I · 2.8 g/cm³ · e 0.20'},{id:'der',p:D,r:rp(DER.R),col:DER.col,n:'DER EINDRINGLING',s:'Moon II · 7.2 g/cm³'}].map(b=>({...b,q:scr(b.p)})).sort((a,b)=>a.q[1]-b.q[1]);
 const light=[-1,0.25];
 bodies.forEach(b=>{holoSphere(o,'c'+b.id,b.q[0],b.q[1],b.r,b.col,light,RATIO);tag(o,b.q[0]+b.r+8,b.q[1]-b.r+2,b.n,b.s);});
 const icon=(p,kind,col,name,sub)=>{const s=scr(p);if(kind==='yard'){o.push(`<g stroke="${col}" fill="none" stroke-width="1.3" filter="url(#glow)"><rect x="${f1(s[0]-9)}" y="${f1(s[1]-5)}" width="18" height="10"/><line x1="${f1(s[0]-9)}" y1="${f1(s[1])}" x2="${f1(s[0]+9)}" y2="${f1(s[1])}"/><path d="M${f1(s[0]+10)} ${f1(s[1]-5)} L${f1(s[0]+24)} ${f1(s[1]-10)} L${f1(s[0]+24)} ${f1(s[1]+10)} L${f1(s[0]+10)} ${f1(s[1]+5)} Z"/></g>`);}
  else if(kind==='haven'){for(let k=-1;k<=1;k++)o.push(`<rect x="${f1(s[0]-11+k*4)}" y="${f1(s[1]-3+k*6)}" width="22" height="5" rx="2.5" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="1.1"/>`);}
  else o.push(`<path d="M${f1(s[0])} ${f1(s[1]-7)} L${f1(s[0]+7)} ${f1(s[1])} L${f1(s[0])} ${f1(s[1]+7)} L${f1(s[0]-7)} ${f1(s[1])} Z" fill="${col}" fill-opacity=".2" stroke="${col}" stroke-width="1.2"/>`);
  tag(o,s[0]+16,s[1]+20,name,sub,'start',col);return s;};
 const s4=icon(L4,'yard','#ffcf7a','L4 YARD + GOLIATH FUNNEL','leads Der by 60°');const s5=icon(L5,'haven','#8fe3ff','L5 HAVEN','trails Der by 60°');const s3=icon(L3,'watch','#b7c4dc','L3 WATCH','opposite Der');
 {const a=scr(derPos(T0+2.5)),b=scr(derPos(T0+3.6));o.push(`<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${CY_}" stroke-opacity=".6" stroke-width="1.3"/><circle cx="${f1(b[0])}" cy="${f1(b[1])}" r="2" fill="${CY_}"/>`);}
 // callouts (3): ship (top-right), mass-driver stream, Der
 const elapsed=tNow/3600,eta=(sp.T-tNow)/3600;
 card(o,40,40,360,'SHIP · CREW SHUTTLE (placeholder)',[`Turquenish Empire fusion 0.01 g · ${burning?'burning':'coasting'}`,'Orbit raise: Kakakiko low orbit → L5 Haven',`Elapsed ${elapsed.toFixed(1)} h · arrive in ${eta.toFixed(1)} h`,`Δv ${(sp.dvUsed).toFixed(1)} km/s of 9.0 budget (placeholder)`,'Reaction mass left ~28% (placeholder)'],[shipP[0]+4,shipP[1]-4],'#c49bff');
 const mid=scr(slugs[Math.floor(slugs.length*0.45)]);
 card(o,1210,800,350,'MASS-DRIVER STREAM · DER → L4',['Backward shots, ~70 m/s beyond escape',`One-orbit phasing ellipse · ${Ps.toFixed(1)} d to the catcher`,`${slugs.length} slugs in flight (1 per 0.6 d, placeholder)`],[mid[0],mid[1]],'#ffcf7a');
 card(o,1210,40,350,'L3 WATCH STATION',['Der\'s L3 point, opposite Der · ~400,000 km','Weather and monitoring of the far hemisphere','Crew ~20 (under 50) · 2 weeks on / 2 off','Relays to Der via L4 and L5'],[s3[0]+6,s3[1]-6],'#b7c4dc');
 legend(o,40,810,440,'LEGEND · KAKAKIKO CLOSE-UP',[[swLine('#c49bff',null,2.4),'Turquenish Empire fusion 0.01 g · thin = coast · dashed = planned'],[swDot('#d9dde3'),'Mass-driver slugs (dotted stream)'],[(x,y)=>`<ellipse cx="${x+17}" cy="${y}" rx="16" ry="${f1(16*RATIO)}" fill="none" stroke="#e8dccb" stroke-opacity=".7"/>`,'Moon orbit (true shape, linear distances)']],
  ['Planet-centred · tilt 58° · 1 px ≈ 740 km · bodies enlarged (R^0.7)','Epoch T+0 (circa 1600 yrs hence) + 6 d · placeholder','Concept mockup from spec v3 math, not the product']);
 tail(o,W,H);writeFileSync('concept_kakakiko-closeup_20260929_v3.svg',o.join('\n'));
 report.kak={spiral_h:sp.T/3600,burn_h:sp.tBurnEnd/3600,spiral_dv:sp.dvUsed,slugP:Ps,slugs:slugs.length,ship_elapsed_h:elapsed,eta_h:eta};}
console.log(JSON.stringify(report,null,1));
