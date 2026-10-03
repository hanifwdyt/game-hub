/* Procedural key-art engine — placeholder art until real images land in <game>/art/.
   Ported from the console prototype. Pure canvas, client-only. */
const DPR = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
const REDUCED = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mk=(w,h)=>{const c=document.createElement("canvas");c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c};
const hash=s=>{let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const RNG=seed=>{let s=(seed>>>0)||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}};
const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
function noise(r,oct=4,base=.004){const w=[];for(let i=0;i<oct;i++)w.push({f:base*Math.pow(2.13,i)*(.8+r()*.4),p:r()*6.283,a:Math.pow(.5,i)});return x=>w.reduce((s,o)=>s+o.a*Math.sin(x*o.f+o.p),0)/1.875}
function lg(c,x0,y0,x1,y1,st){const g=c.createLinearGradient(x0,y0,x1,y1);st.forEach(([o,col])=>g.addColorStop(o,col));return g}
function glow(c,x,y,r,col,a=1){if(r<=0)return;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(col,a));g.addColorStop(.4,rgba(col,a*.35));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2)}
function ridge(c,W,bottom,fn,fill){c.beginPath();c.moveTo(-2,bottom);for(let x=-2;x<=W+2;x+=3)c.lineTo(x,fn(x));c.lineTo(W+2,bottom);c.closePath();c.fillStyle=fill;c.fill()}
function edge(c,W,fn,col,lw){c.beginPath();for(let x=-2;x<=W+2;x+=3){x<=-2?c.moveTo(x,fn(x)):c.lineTo(x,fn(x))}c.strokeStyle=col;c.lineWidth=lw;c.stroke()}
function stars(c,r,n,W,y0,y1,s,col=[255,255,255]){for(let i=0;i<n;i++){const x=r()*W,y=y0+r()*(y1-y0),z=r();c.fillStyle=rgba(col,.25+z*.75);c.beginPath();c.arc(x,y,(z*z*1.6+.3)*s,0,7);c.fill();if(z>.97){glow(c,x,y,8*s,col,.6);c.fillRect(x-6*s,y-.4*s,12*s,.8*s);c.fillRect(x-.4*s,y-6*s,.8*s,12*s)}}}
function cloud(c,x,y,w,col){c.fillStyle=col;c.beginPath();const n=6;for(let i=0;i<n;i++){const t=i/(n-1);c.moveTo(x+w*t,y);c.arc(x+w*t,y-Math.sin(t*Math.PI)*w*.12,w*(.12+Math.sin(t*Math.PI)*.1),0,7)}c.fill();c.fillRect(x,y-w*.02,w,w*.1)}
function haze(c,W,y,h,col,a){c.fillStyle=lg(c,0,y-h,0,y+h,[[0,rgba(col,0)],[.5,rgba(col,a)],[1,rgba(col,0)]]);c.fillRect(0,y-h,W,h*2)}

/* silhouettes */
function tank(c,x,y,z,col){c.fillStyle=col;c.beginPath();c.roundRect(x-z*.5,y-z*.15,z,z*.15,z*.075);c.fill();
  c.beginPath();c.moveTo(x-z*.46,y-z*.14);c.lineTo(x-z*.38,y-z*.27);c.lineTo(x+z*.4,y-z*.27);c.lineTo(x+z*.5,y-z*.14);c.fill();
  c.beginPath();c.moveTo(x-z*.2,y-z*.26);c.lineTo(x-z*.13,y-z*.39);c.lineTo(x+z*.16,y-z*.39);c.lineTo(x+z*.23,y-z*.26);c.fill();
  c.fillRect(x+z*.12,y-z*.35,z*.58,z*.04);c.fillRect(x-z*.05,y-z*.47,z*.02,z*.09)}
function heli(c,x,y,z,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,z*.3,z*.12,0,0,7);c.fill();
  c.beginPath();c.moveTo(x+z*.18,y-z*.05);c.lineTo(x+z*.8,y-z*.08);c.lineTo(x+z*.8,y-z*.03);c.lineTo(x+z*.18,y+z*.06);c.fill();
  c.beginPath();c.moveTo(x+z*.74,y-z*.07);c.lineTo(x+z*.84,y-z*.24);c.lineTo(x+z*.88,y-z*.24);c.lineTo(x+z*.82,y-z*.04);c.fill();
  c.fillRect(x-z*.02,y-z*.19,z*.05,z*.08);c.fillRect(x-z*.75,y-z*.205,z*1.5,z*.022);
  c.fillRect(x-z*.24,y+z*.18,z*.46,z*.025);c.fillRect(x-z*.14,y+z*.1,z*.02,z*.09);c.fillRect(x+z*.1,y+z*.1,z*.02,z*.09)}
function pagoda(c,x,base,w,tiers,col,lamp){let y=base,tw=w;c.fillStyle=col;
  for(let i=0;i<tiers;i++){const h=w*.2*(1-i*.06);c.fillRect(x-tw*.3,y-h,tw*.6,h);if(lamp){glow(c,x,y-h*.5,tw*.25,lamp,.5);c.fillStyle=col}y-=h;
    c.beginPath();c.moveTo(x-tw*.64,y-w*.07);c.quadraticCurveTo(x-tw*.46,y+w*.01,x-tw*.3,y);c.lineTo(x+tw*.3,y);c.quadraticCurveTo(x+tw*.46,y+w*.01,x+tw*.64,y-w*.07);
    c.quadraticCurveTo(x+tw*.42,y-w*.08,x+tw*.22,y-w*.15);c.lineTo(x-tw*.22,y-w*.15);c.quadraticCurveTo(x-tw*.42,y-w*.08,x-tw*.64,y-w*.07);c.fill();y-=w*.15;tw*=.8}
  c.fillRect(x-w*.012,y-w*.35,w*.024,w*.35);for(let k=0;k<4;k++){c.beginPath();c.arc(x,y-w*(.08+k*.06),w*.03,0,7);c.fill()}}
function towerC(c,x,base,w,h,col,flag){c.fillStyle=col;c.fillRect(x-w/2,base-h,w,h);
  for(let i=0;i<4;i++)c.fillRect(x-w/2-w*.08+i*(w*1.16/3.5),base-h-w*.18,w*.22,w*.2);
  c.fillRect(x-w/2-w*.1,base-h,w*1.2,w*.08);
  c.beginPath();c.moveTo(x-w*.6,base-h-w*.18);c.lineTo(x,base-h-w*1.4);c.lineTo(x+w*.6,base-h-w*.18);c.fill();
  if(flag){const fy=base-h-w*1.4;c.fillRect(x-1,fy-w*.7,2.2,w*.7);c.fillStyle=flag;c.beginPath();c.moveTo(x+1,fy-w*.7);c.quadraticCurveTo(x+w*.4,fy-w*.8,x+w*.75,fy-w*.58);c.quadraticCurveTo(x+w*.4,fy-w*.45,x+1,fy-w*.42);c.fill();c.fillStyle=col}
  c.fillStyle="rgba(255,190,110,.8)";c.fillRect(x-w*.06,base-h*.7,w*.12,w*.22);c.fillStyle=col}
function palm(c,x,base,h,col,lean){c.strokeStyle=col;c.lineCap="round";c.lineWidth=h*.045;c.beginPath();c.moveTo(x,base);const tx=x+lean*h,ty=base-h;c.quadraticCurveTo(x+lean*h*.2,base-h*.6,tx,ty);c.stroke();c.fillStyle=col;
  for(let i=0;i<8;i++){const a=-Math.PI+i*(Math.PI/7)+(i%2?.12:-.08),L=h*(.48+(i%3)*.06);const ex=tx+Math.cos(a)*L,ey=ty+Math.sin(a)*L*.55+L*.35;
    c.beginPath();c.moveTo(tx,ty);c.quadraticCurveTo(tx+Math.cos(a)*L*.5,ty+Math.sin(a)*L*.6-L*.18,ex,ey);c.quadraticCurveTo(tx+Math.cos(a)*L*.5,ty+Math.sin(a)*L*.6-L*.02,tx,ty+h*.02);c.fill()}}
function skyline(c,r,W,base,hmin,hmax,col,win,s){let x=-10;while(x<W+10){const w=(18+r()*46)*s,h=hmin+r()*(hmax-hmin);c.fillStyle=col;c.fillRect(x,base-h,w,h);
  if(r()>.6)c.fillRect(x+w*.45,base-h-h*.18,w*.08,h*.18);
  if(win){for(let yy=base-h+6*s;yy<base-4*s;yy+=6*s)for(let xx=x+4*s;xx<x+w-4*s;xx+=5*s)if(r()>.72){c.fillStyle=win[(r()*win.length)|0];c.fillRect(xx,yy,2.2*s,2.8*s)}}
  x+=w+r()*6*s}}
function block(c,x,y,z,top,side,q){c.fillStyle=side;c.fillRect(x,y,z,z);c.fillStyle="rgba(0,0,0,.28)";c.fillRect(x,y+z*.82,z,z*.18);c.fillRect(x+z*.84,y,z*.16,z);
  c.fillStyle="rgba(255,255,255,.18)";c.fillRect(x,y,z*.12,z);if(top){c.fillStyle=top;c.fillRect(x,y,z,z*.26);for(let i=0;i<4;i++)c.fillRect(x+i*z*.26,y+z*.24,z*.14,z*.1)}
  if(q){c.fillStyle="rgba(120,60,0,.85)";c.font=`900 ${z*.62}px Bungee, sans-serif`;c.textAlign="center";c.textBaseline="middle";c.fillText("?",x+z*.46,y+z*.52)}}
function bomb(c,x,y,rr,spark){c.fillStyle="#141018";c.beginPath();c.arc(x,y,rr,0,7);c.fill();c.fillStyle="rgba(255,255,255,.22)";c.beginPath();c.arc(x-rr*.35,y-rr*.35,rr*.25,0,7);c.fill();
  c.fillStyle="#2a2430";c.fillRect(x-rr*.25,y-rr*1.15,rr*.5,rr*.3);c.strokeStyle="#c8a36a";c.lineWidth=rr*.08;c.beginPath();c.moveTo(x,y-rr*1.15);c.quadraticCurveTo(x+rr*.4,y-rr*1.7,x+rr*.7,y-rr*1.5);c.stroke();
  if(spark){glow(c,x+rr*.7,y-rr*1.5,rr*.9,[255,210,90],1);glow(c,x+rr*.7,y-rr*1.5,rr*.3,[255,255,230],1)}}
function crystal(c,x,base,h,col,r){for(let i=0;i<5;i++){const w=h*(.12+r()*.08),hh=h*(.4+r()*.6),xx=x+(i-2)*h*.13,a=(i-2)*.18;
  c.save();c.translate(xx,base);c.rotate(a);c.fillStyle=lg(c,-w,-hh,w,0,[[0,rgba(col,.95)],[.5,rgba([Math.min(255,col[0]+80),Math.min(255,col[1]+80),255],.9)],[1,rgba(col,.35)]]);
  c.beginPath();c.moveTo(-w/2,0);c.lineTo(-w/2,-hh*.8);c.lineTo(0,-hh);c.lineTo(w/2,-hh*.8);c.lineTo(w/2,0);c.fill();c.fillStyle="rgba(255,255,255,.35)";c.beginPath();c.moveTo(0,-hh);c.lineTo(w/2,-hh*.8);c.lineTo(w*.1,-hh*.2);c.fill();c.restore()}}
function cottage(c,x,base,w,col,warm){c.fillStyle=col;c.fillRect(x-w*.5,base-w*.5,w,w*.5);c.beginPath();c.moveTo(x-w*.62,base-w*.48);c.lineTo(x,base-w*.95);c.lineTo(x+w*.62,base-w*.48);c.fill();c.fillRect(x+w*.22,base-w*.95,w*.12,w*.3);
  c.fillStyle=warm;c.fillRect(x-w*.32,base-w*.36,w*.18,w*.16);c.fillRect(x+w*.14,base-w*.36,w*.18,w*.16);glow(c,x-w*.23,base-w*.28,w*.35,[255,190,110],.55);glow(c,x+w*.23,base-w*.28,w*.35,[255,190,110],.55);
  for(let i=0;i<5;i++){c.fillStyle=`rgba(255,240,230,${.18-i*.03})`;c.beginPath();c.arc(x+w*.28+i*w*.08,base-w*1.02-i*w*.14,w*(.06+i*.03),0,7);c.fill()}}
function tree(c,x,base,h,col){c.fillStyle=col;c.fillRect(x-h*.04,base-h*.35,h*.08,h*.35);[[0,-.55,.3],[-.18,-.42,.22],[.18,-.42,.22],[0,-.78,.2]].forEach(([dx,dy,r])=>{c.beginPath();c.arc(x+dx*h,base+dy*h,r*h,0,7);c.fill()})}
function mast(c,x,base,h,col,blink){c.strokeStyle=col;c.lineWidth=Math.max(1,h*.012);c.beginPath();const w=h*.09;
  c.moveTo(x-w,base);c.lineTo(x,base-h);c.lineTo(x+w,base);for(let i=1;i<12;i++){const t=i/12,y=base-h*t,ww=w*(1-t);c.moveTo(x-ww,y);c.lineTo(x+ww,y-h/12)}c.stroke();
  if(blink){glow(c,x,base-h,h*.12,blink,1)}}

/* painters: layer = sky | far | mid | front. T = top (pop offset), H = visible height */
const P = {};
P.desert=(L,c,W,H,T,r,s,v={})=>{const B=T+H,hz=T+H*.64,n1=noise(r,4,.006/s),n2=noise(r,3,.003/s),n3=noise(r,4,.0045/s);
  const pal=v.pal||{top:"#14060c",mid:"#5a1220",low:"#c2401f",hor:"#ffb566",sun:[255,222,160],mesa:"#7c2420",dune:"#3b0d10",fg:"#120405"};
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,hz,[[0,pal.top],[.4,pal.mid],[.78,pal.low],[1,pal.hor]]);c.fillRect(0,0,W,B);
    glow(c,W*.64,hz-H*.1,H*1.1,[255,110,50],.45);glow(c,W*.64,hz-H*.12,H*.32,pal.sun,.9);
    c.fillStyle=rgba(pal.sun,1);c.beginPath();c.arc(W*.64,hz-H*.12,H*.12,0,7);c.fill();
    for(let i=0;i<5;i++){c.fillStyle=`rgba(90,20,20,${.25+i*.08})`;c.fillRect(0,hz-H*.12+i*H*.028,W,H*.008+i*H*.003)}
    stars(c,r,60,W,0,hz-H*.35,s,[255,210,190]);}
  if(L==="far"){ridge(c,W,B,x=>hz-H*.05-Math.max(-.1,Math.min(.38,n1(x)))*H*.3,pal.mesa);haze(c,W,hz,H*.08,[255,150,90],.35);
    ridge(c,W,B,x=>hz+H*.02-n2(x)*H*.05,"#5a1618");}
  if(L==="mid"){const f=x=>hz+H*.1-n2(x*1.3+99)*H*.07;ridge(c,W,B,f,lg(c,0,hz,0,B,[[0,"#4a1112"],[1,pal.dune]]));edge(c,W,f,"rgba(255,150,90,.35)",1.4*s);
    tank(c,W*.3,f(W*.3)+2*s,H*.2,"#1c0607");tank(c,W*.44,f(W*.44)+2*s,H*.12,"#2a0a0b");mast(c,W*.12,f(W*.12),H*.34,"#24090a",[255,60,60]);}
  if(L==="front"){const f=x=>B-H*.14-n3(x+400)*H*.08;ridge(c,W,B+2,f,pal.fg);edge(c,W,f,"rgba(255,120,70,.28)",2*s);
    c.fillStyle=pal.fg;const sx=W*.87,sb=f(sx)+4;c.beginPath();c.moveTo(sx-H*.2,sb);c.lineTo(sx-H*.12,T+H*.3);c.lineTo(sx-H*.07,T+H*.05);c.lineTo(sx-H*.02,T-H*.1);c.lineTo(sx+H*.04,T-H*.14);c.lineTo(sx+H*.09,T+H*.0);c.lineTo(sx+H*.14,T+H*.28);c.lineTo(sx+H*.22,sb);c.fill();
    c.strokeStyle="rgba(255,140,80,.35)";c.lineWidth=2*s;c.beginPath();c.moveTo(sx-H*.12,T+H*.3);c.lineTo(sx-H*.07,T+H*.05);c.lineTo(sx-H*.02,T-H*.1);c.stroke();
    heli(c,W*.56,T+H*.06,H*.26,"#1a0607");heli(c,W*.4,T+H*.18,H*.12,"#3a0f10");}
};
P.steel=(L,c,W,H,T,r,s)=>P.desert(L,c,W,H,T,r,s,{pal:{top:"#061018",mid:"#123342",low:"#3f7d86",hor:"#f2c07a",sun:[255,236,190],mesa:"#1f4a52",dune:"#0f262c",fg:"#050c0f"}});
P.night=(L,c,W,H,T,r,s)=>{const B=T+H,hz=T+H*.62,n1=noise(r,5,.005/s),n2=noise(r,4,.004/s);
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,B,[[0,"#04051a"],[.5,"#161444"],[.85,"#3e2c72"],[1,"#6b3f86"]]);c.fillRect(0,0,W,B);stars(c,r,220,W,0,hz,s);
    const mx=W*.7,my=T+H*.3,mr=H*.2;glow(c,mx,my,mr*4,[170,160,255],.5);c.fillStyle=lg(c,mx-mr,my-mr,mx+mr,my+mr,[[0,"#fffaf0"],[1,"#c9c2ff"]]);c.beginPath();c.arc(mx,my,mr,0,7);c.fill();
    c.fillStyle="rgba(120,110,180,.25)";[[.3,-.2,.18],[-.35,.1,.12],[.1,.4,.1],[-.1,-.45,.08]].forEach(([a,b,k])=>{c.beginPath();c.arc(mx+a*mr,my+b*mr,k*mr,0,7);c.fill()});
    c.fillStyle="rgba(20,18,50,.55)";cloud(c,W*.52,my+mr*.5,mr*2.6,"rgba(30,24,70,.6)");}
  if(L==="far"){ridge(c,W,B,x=>hz-H*.12-Math.abs(n1(x))*H*.26,"#2a2560");haze(c,W,hz,H*.1,[160,130,230],.35);ridge(c,W,B,x=>hz-H*.02-Math.abs(n2(x+50))*H*.14,"#1b1845");}
  if(L==="mid"){const f=x=>hz+H*.08-n2(x*1.6+9)*H*.06;ridge(c,W,B,f,"#0f0d2c");pagoda(c,W*.28,f(W*.28),H*.2,4,"#0b0a22",[255,110,90]);pagoda(c,W*.12,f(W*.12),H*.11,3,"#0d0c26",[255,110,90]);
    haze(c,W,f(W*.5)+H*.04,H*.07,[190,160,255],.25);}
  if(L==="front"){const f=x=>B-H*.1-n1(x+300)*H*.07;ridge(c,W,B+2,f,"#05040f");pagoda(c,W*.86,f(W*.86)+4,H*.34,5,"#05040f",[255,90,80]);
    c.strokeStyle="#05040f";c.lineCap="round";c.lineWidth=8*s;c.beginPath();c.moveTo(-10,T+H*.05);c.quadraticCurveTo(W*.12,T+H*.02,W*.22,T+H*.12);c.stroke();c.lineWidth=4*s;c.beginPath();c.moveTo(W*.1,T+H*.05);c.quadraticCurveTo(W*.14,T-H*.05,W*.2,T-H*.08);c.stroke();
    c.fillStyle="#ff9ec2";for(let i=0;i<40;i++){const x=r()*W*.24,y=T-H*.1+r()*H*.28;c.globalAlpha=.4+r()*.5;c.beginPath();c.arc(x,y,(2+r()*4)*s,0,7);c.fill()}c.globalAlpha=1;}
};
P.space=(L,c,W,H,T,r,s,v={})=>{const B=T+H,a=v.a||[255,80,200],b=v.b||[80,160,255];
  if(L==="sky"){c.fillStyle="#03030b";c.fillRect(0,0,W,B);for(let i=0;i<14;i++)glow(c,r()*W,T+r()*H,(H*.2+r()*H*.5),i%2?a:b,.16+r()*.14);glow(c,W*.45,T+H*.5,H*.9,[120,60,200],.2);stars(c,r,380,W,0,B,s);}
  if(L==="far"){glow(c,W*.2,T+H*.3,H*.12,b,.5);c.fillStyle=lg(c,W*.16,T+H*.26,W*.24,T+H*.34,[[0,rgba(b,1)],[1,"#101030"]]);c.beginPath();c.arc(W*.2,T+H*.3,H*.05,0,7);c.fill();}
  if(L==="mid"){for(let i=0;i<7;i++){const x=W*(.05+r()*.55),y=T+H*(.55+r()*.4),rr=H*(.02+r()*.05);c.fillStyle="#120f22";c.beginPath();for(let k=0;k<9;k++){const an=k/9*6.28,d=rr*(.7+r()*.4);k?c.lineTo(x+Math.cos(an)*d,y+Math.sin(an)*d):c.moveTo(x+Math.cos(an)*d,y+Math.sin(an)*d)}c.fill();c.strokeStyle=rgba(a,.4);c.lineWidth=1.2*s;c.stroke()}}
  if(L==="front"){const px=W*.76,py=T+H*.2,pr=H*.42;
    c.save();c.translate(px,py);c.rotate(-.35);c.strokeStyle=rgba(a,.35);c.lineWidth=pr*.14;c.beginPath();c.ellipse(0,0,pr*1.65,pr*.36,0,Math.PI,2*Math.PI);c.stroke();c.restore();
    glow(c,px,py,pr*1.7,a,.35);c.fillStyle=lg(c,px-pr,py-pr,px+pr,py+pr,[[0,rgba(a,1)],[.45,rgba(b,.9)],[1,"#070612"]]);c.beginPath();c.arc(px,py,pr,0,7);c.fill();
    c.save();c.beginPath();c.arc(px,py,pr,0,7);c.clip();for(let i=0;i<7;i++){c.fillStyle=`rgba(255,255,255,${.04+r()*.06})`;c.fillRect(px-pr,py-pr+i*pr*.3+r()*pr*.1,pr*2,pr*(.05+r()*.08))}c.fillStyle=lg(c,px-pr,py,px+pr,py,[[0,"rgba(0,0,0,0)"],[.7,"rgba(3,3,12,.5)"],[1,"rgba(3,3,12,.9)"]]);c.fillRect(px-pr,py-pr,pr*2,pr*2);c.restore();
    c.save();c.translate(px,py);c.rotate(-.35);const rg=c.createLinearGradient(-pr*1.7,0,pr*1.7,0);rg.addColorStop(0,rgba(a,.1));rg.addColorStop(.5,rgba([255,230,250],.85));rg.addColorStop(1,rgba(b,.15));c.strokeStyle=rg;c.lineWidth=pr*.12;c.beginPath();c.ellipse(0,0,pr*1.65,pr*.36,0,0,Math.PI);c.stroke();c.lineWidth=pr*.03;c.strokeStyle="rgba(255,255,255,.4)";c.beginPath();c.ellipse(0,0,pr*1.85,pr*.42,0,0,Math.PI);c.stroke();c.restore();
    c.fillStyle="#07060f";c.beginPath();c.moveTo(-5,B+2);for(let x=-5;x<W*.45;x+=6)c.lineTo(x,B-H*.1-Math.abs(Math.sin(x*.02/s))*H*.06-r()*H*.02);c.lineTo(W*.45,B+2);c.fill();}
};
P.space2=(L,c,W,H,T,r,s)=>P.space(L,c,W,H,T,r,s,{a:[60,220,255],b:[40,90,255]});
P.fantasy=(L,c,W,H,T,r,s,v={})=>{const B=T+H,hz=T+H*.6,n1=noise(r,5,.006/s),n2=noise(r,3,.003/s);const p=v.p||{s0:"#1a2240",s1:"#6b4a7a",s2:"#f3a55a",sun:[255,220,150],m1:"#5a5d8e",m2:"#35355f",h:"#1d1b35",fg:"#0a0914",flag:"#e24a4a"};
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,hz,[[0,p.s0],[.6,p.s1],[1,p.s2]]);c.fillRect(0,0,W,B);glow(c,W*.35,hz-H*.05,H*.9,p.sun,.45);c.fillStyle=rgba(p.sun,1);c.beginPath();c.arc(W*.35,hz-H*.06,H*.08,0,7);c.fill();
    for(let i=0;i<6;i++)cloud(c,r()*W,T+H*(.1+r()*.35),H*(.3+r()*.4),`rgba(255,${190+r()*40|0},${170+r()*40|0},${.12+r()*.12})`);}
  if(L==="far"){const f=x=>hz-H*.06-Math.abs(n1(x))*H*.36;ridge(c,W,B,f,p.m1);c.save();c.beginPath();c.moveTo(0,B);for(let x=0;x<=W;x+=3)c.lineTo(x,f(x));c.lineTo(W,B);c.clip();c.fillStyle=lg(c,0,hz-H*.4,0,hz,[[0,"rgba(255,245,240,.75)"],[.35,"rgba(255,245,240,0)"]]);c.fillRect(0,0,W,B);c.restore();haze(c,W,hz,H*.1,[255,190,160],.3);}
  if(L==="mid"){const f=x=>hz+H*.08-n2(x+70)*H*.1;ridge(c,W,B,f,p.m2);const cx=W*.36,cb=f(cx);towerC(c,cx-H*.1,cb,H*.05,H*.14,p.h);towerC(c,cx+H*.1,cb,H*.05,H*.12,p.h);c.fillStyle=p.h;c.fillRect(cx-H*.1,cb-H*.08,H*.2,H*.08);towerC(c,cx,cb,H*.07,H*.22,p.h,p.flag);
    c.strokeStyle=p.h;c.lineWidth=1.5*s;for(let i=0;i<7;i++){const bx=W*(.5+r()*.25),by=T+H*(.2+r()*.2),z=(4+r()*5)*s;c.beginPath();c.moveTo(bx-z,by-z*.4);c.quadraticCurveTo(bx-z*.4,by-z*.5,bx,by);c.quadraticCurveTo(bx+z*.4,by-z*.5,bx+z,by-z*.4);c.stroke()}}
  if(L==="front"){const f=x=>B-H*.12-n1(x+500)*H*.08;ridge(c,W,B+2,f,p.fg);towerC(c,W*.86,f(W*.86)+4,H*.14,H*.66,p.fg,p.flag);c.fillStyle=p.fg;c.fillRect(W*.86-H*.07,f(W*.86)-H*.3,-H*.25,H*.3);}
};
P.fantasy2=(L,c,W,H,T,r,s)=>P.fantasy(L,c,W,H,T,r,s,{p:{s0:"#120a2a",s1:"#4a2a78",s2:"#d98ad8",sun:[255,200,250],m1:"#4a3a86",m2:"#2a2058",h:"#160f30",fg:"#08061a",flag:"#f2c14e"}});
P.dungeon=(L,c,W,H,T,r,s,v={})=>{const B=T+H,col=v.col||[160,90,255],vx=W*.5,vy=T+H*.5;
  if(L==="sky"){c.fillStyle="#06040c";c.fillRect(0,0,W,B);glow(c,vx,vy,H*.9,col,.55);glow(c,vx,vy,H*.18,[255,255,255],.35);}
  if(L==="far"){for(let k=9;k>=0;k--){const sc=Math.pow(.8,k),w=H*1.1*sc,h=H*1.2*sc,x=vx-w/2,y=vy+h*.42-h;c.fillStyle=`rgba(10,6,20,${.55+.45*(1-k/9)})`;c.beginPath();c.rect(x-w*.25,y-h*.3,w*1.5,h*1.4);
    c.moveTo(x+w*.12,y+h);c.lineTo(x+w*.12,y+h*.35);c.arc(vx,y+h*.35,w*.38,Math.PI,0);c.lineTo(x+w*.88,y+h);c.closePath();c.fill("evenodd");c.strokeStyle=rgba(col,.12+.3*(k/9));c.lineWidth=1.2*s;c.stroke()}}
  if(L==="mid"){c.fillStyle=lg(c,0,vy,0,B,[[0,"rgba(12,8,24,0)"],[1,"#0a0616"]]);c.fillRect(0,vy,W,B-vy);
    if(v.stairs){for(let i=0;i<14;i++){const t=i/14,y=B-(B-vy-H*.05)*t,w=W*.5*(1-t*.85);c.fillStyle=`rgba(${40+i*6},10,14,1)`;c.fillRect(vx-w/2,y-H*.035*(1-t*.6),w,H*.035*(1-t*.6));c.fillStyle=rgba(col,.35*(1-t));c.fillRect(vx-w/2,y-H*.035*(1-t*.6),w,1.2*s)}}
    for(let i=0;i<9;i++){const x=r()*W,y=T+H*(.2+r()*.6);c.font=`${(10+r()*16)*s}px Pirata One, serif`;c.fillStyle=rgba(col,.55);c.fillText("ᚱᚦᛟᚨᛉ"[i%5],x,y)}
    [W*.16,W*.84].forEach(x=>{glow(c,x,T+H*.42,H*.2,[255,150,60],.7);c.fillStyle="#1a0d10";c.fillRect(x-3*s,T+H*.44,6*s,H*.12)});}
  if(L==="front"){c.fillStyle="#030208";c.fillRect(0,T-H*.05,W*.08,B);c.fillRect(W*.92,T-H*.05,W*.08,B);ridge(c,W,B+2,x=>B-H*.07-Math.abs(Math.sin(x*.03/s))*H*.03,"#030208");
    if(!v.stairs){glow(c,W*.82,B-H*.3,H*.45,col,.45);crystal(c,W*.82,B,H*.95,col,r)}else{c.fillStyle="#030208";for(let i=0;i<7;i++){const x=W*(.72+i*.04),h=H*(.4+r()*.6);c.beginPath();c.moveTo(x,B);c.lineTo(x+H*.015,T+H-h);c.lineTo(x+H*.03,B);c.fill()}glow(c,W*.5,T+H*.35,H*.1,[255,40,40],.9);}}
};
P.stairs=(L,c,W,H,T,r,s)=>P.dungeon(L,c,W,H,T,r,s,{col:[255,50,50],stairs:true});
P.sea=(L,c,W,H,T,r,s)=>{const B=T+H,hz=T+H*.58,n1=noise(r,4,.006/s);
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,hz,[[0,"#1b1542"],[.45,"#7a3a72"],[.8,"#ff7f5c"],[1,"#ffd28a"]]);c.fillRect(0,0,W,hz+1);glow(c,W*.5,hz,H*.9,[255,150,90],.55);
    c.fillStyle="#fff0c8";c.beginPath();c.arc(W*.5,hz,H*.13,Math.PI,0);c.fill();for(let i=0;i<5;i++)cloud(c,r()*W,T+H*(.12+r()*.3),H*(.3+r()*.5),`rgba(255,${140+r()*60|0},150,${.15+r()*.15})`);
    c.fillStyle=lg(c,0,hz,0,B,[[0,"#8a3f6a"],[1,"#140c2a"]]);c.fillRect(0,hz,W,B-hz);}
  if(L==="far"){ridge(c,W,hz+1,x=>{const d=Math.max(0,n1(x));return hz-d*H*.16},"#3a1f4c");}
  if(L==="mid"){for(let i=0;i<60;i++){const y=hz+2+Math.pow(r(),1.6)*(B-hz),w=(H*.04+r()*H*.3)*(1-(y-hz)/(B-hz)*.3);c.fillStyle=`rgba(255,${200+r()*50|0},150,${.18+r()*.4})`;c.fillRect(W*.5-w/2+(r()-.5)*H*.2,y,w,1.4*s)}
    const bx=W*.34,by=hz+H*.1;c.fillStyle="#1a0f24";c.beginPath();c.moveTo(bx-H*.07,by);c.lineTo(bx+H*.07,by);c.lineTo(bx+H*.05,by+H*.025);c.lineTo(bx-H*.05,by+H*.025);c.fill();c.fillRect(bx-1,by-H*.14,2*s,H*.14);c.beginPath();c.moveTo(bx+2,by-H*.13);c.lineTo(bx+H*.06,by-H*.01);c.lineTo(bx+2,by-H*.01);c.fill();}
  if(L==="front"){c.fillStyle="#0c0716";c.beginPath();c.moveTo(W*.7,B+2);c.quadraticCurveTo(W*.85,B-H*.2,W+4,B-H*.16);c.lineTo(W+4,B+2);c.fill();palm(c,W*.9,B-H*.12,H*.95,"#0c0716",-.18);palm(c,W*.8,B-H*.08,H*.6,"#120a1e",-.08);}
};
P.blocks=(L,c,W,H,T,r,s,v={})=>{const B=T+H,z=H*.1,k=v.k||{s0:"#2f8cff",s1:"#9fe3ff",hill:"#4cc46a",hill2:"#2f9e55",top:"#5bd46b",side:"#b8703a"};
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,B,[[0,k.s0],[1,k.s1]]);c.fillRect(0,0,W,B);glow(c,W*.8,T+H*.18,H*.5,[255,250,200],.8);for(let i=0;i<7;i++)cloud(c,r()*W,T+H*(.12+r()*.35),H*(.2+r()*.3),"rgba(255,255,255,.9)");}
  if(L==="far"){c.fillStyle=k.hill;for(let i=0;i<6;i++){c.beginPath();c.arc(r()*W,B-H*.15,H*(.25+r()*.2),Math.PI,0);c.fill()}c.fillStyle=k.hill2;c.fillRect(0,B-H*.16,W,H*.2);}
  if(L==="mid"){if(v.bomb){for(let i=0;i<5;i++)bomb(c,W*(.1+r()*.6),T+H*(.35+r()*.35),H*(.04+r()*.04),true)}else{[[.1,.55,3],[.34,.4,2],[.52,.6,4]].forEach(([x,y,n])=>{for(let j=0;j<n;j++)block(c,W*x+j*z,T+H*y,z,k.top,k.side)});block(c,W*.38,T+H*.15,z,null,"#f2b632",true);
    c.fillStyle="#ffd84a";for(let i=0;i<5;i++){const cx=W*(.12+i*.05),cy=T+H*.45;c.beginPath();c.ellipse(cx,cy,z*.18,z*.26,0,0,7);c.fill()}}}
  if(L==="front"){for(let i=0;i<Math.ceil(W/z)+1;i++)block(c,i*z,B-z*1.2,z,k.top,k.side);for(let j=0;j<7;j++)block(c,W*.8,B-z*(2.2+j),z,j===6?k.top:null,j===6?k.side:"#9b5a2e");for(let j=0;j<4;j++)block(c,W*.8+z,B-z*(2.2+j),z,j===3?k.top:null,j===3?k.side:"#9b5a2e");
    if(v.bomb)bomb(c,W*.86,T+H*.04,H*.09,true);}
};
P.blocks2=(L,c,W,H,T,r,s)=>P.blocks(L,c,W,H,T,r,s,{k:{s0:"#15b39b",s1:"#c8fff0",hill:"#7ad86a",hill2:"#4aaa4e",top:"#8bf06b",side:"#7a8a9a"}});
P.bomb=(L,c,W,H,T,r,s)=>P.blocks(L,c,W,H,T,r,s,{bomb:true,k:{s0:"#ff5f6d",s1:"#ffc371",hill:"#ff9a5a",hill2:"#e0703f",top:"#ffd166",side:"#8d4a2a"}});
P.city=(L,c,W,H,T,r,s,v={})=>{const B=T+H,hz=T+H*.72,nc=v.nc||[[255,60,160],[60,220,255],[255,200,60]];
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,B,[[0,"#05060f"],[.55,"#1a0f3a"],[1,"#4a1452"]]);c.fillRect(0,0,W,B);glow(c,W*.5,hz,H,nc[0],.3);glow(c,W*.2,hz,H*.6,nc[1],.2);}
  if(L==="far")skyline(c,r,W,hz+H*.05,H*.15,H*.45,"#150c2e",["rgba(140,120,255,.5)","rgba(255,120,200,.4)"],s);
  if(L==="mid"){skyline(c,r,W,B,H*.2,H*.55,"#0b0718",["rgba(255,220,150,.85)","rgba(120,220,255,.8)","rgba(255,90,170,.7)"],s);
    for(let i=0;i<6;i++){const x=r()*W,y=T+H*(.45+r()*.3),w=H*(.04+r()*.1),h=H*.022,cc=nc[i%3];glow(c,x+w/2,y,w,cc,.6);c.fillStyle=rgba(cc,1);c.fillRect(x,y,w,h)}
    if(v.road){for(let i=0;i<16;i++){const t=i/16,cc=i%2?nc[0]:nc[1];c.strokeStyle=rgba(cc,.7);c.lineWidth=(1+t*3)*s;c.beginPath();c.moveTo(W*.5+(t-.5)*H*.2,hz);c.lineTo(W*.5+(t-.5)*W*1.6,B);c.stroke()}}}
  if(L==="front"){c.fillStyle="#040309";c.fillRect(0,B-H*.14,W,H*.16);
    if(v.signal){mast(c,W*.84,B-H*.12,H*1.08,"#0a0714",[255,60,60]);c.strokeStyle=rgba(nc[1],.55);for(let i=1;i<5;i++){c.lineWidth=2*s;c.beginPath();c.arc(W*.84,T-H*.04,H*.07*i,-2.3,-.84);c.stroke()}}
    else{c.fillRect(W*.74,B-H*.6,W*.26,H*.6);c.fillRect(W*.8,T-H*.08,H*.02,H*.6);c.fillRect(W*.86,T+H*.08,H*.012,H*.4);glow(c,W*.8+H*.01,T-H*.08,H*.06,[255,60,80],1);
      for(let i=0;i<5;i++){c.fillStyle=rgba(nc[i%3],.9);c.fillRect(W*.76,B-H*.55+i*H*.1,W*.2,1.5*s)}}}
};
P.signal=(L,c,W,H,T,r,s)=>P.city(L,c,W,H,T,r,s,{signal:true,nc:[[60,200,255],[120,255,230],[60,120,255]]});
P.road=(L,c,W,H,T,r,s)=>P.city(L,c,W,H,T,r,s,{road:true,nc:[[0,230,200],[255,60,120],[255,220,60]]});
P.cozy=(L,c,W,H,T,r,s)=>{const B=T+H,hz=T+H*.6,n1=noise(r,3,.004/s),n2=noise(r,3,.006/s);
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,hz,[[0,"#2b3a6e"],[.6,"#e7948a"],[1,"#ffe0a6"]]);c.fillRect(0,0,W,B);glow(c,W*.25,hz-H*.05,H*.7,[255,210,150],.6);for(let i=0;i<5;i++)cloud(c,r()*W,T+H*(.1+r()*.3),H*(.3+r()*.3),"rgba(255,220,210,.25)");}
  if(L==="far"){ridge(c,W,B,x=>hz-n1(x)*H*.1,"#7a7fb0");ridge(c,W,B,x=>hz+H*.06-n2(x+20)*H*.08,"#557a7a");}
  if(L==="mid"){const f=x=>hz+H*.16-n2(x*.8+60)*H*.07;ridge(c,W,B,f,"#2f5a4a");cottage(c,W*.4,f(W*.4)+2,H*.2,"#1c2f2a","#ffd08a");[.2,.55,.62].forEach(x=>tree(c,W*x,f(W*x)+2,H*.2,"#23443a"));}
  if(L==="front"){const f=x=>B-H*.1-n1(x+90)*H*.05;ridge(c,W,B+2,f,"#0f1f1c");tree(c,W*.88,f(W*.88)+4,H*1.05,"#0f1f1c");c.fillStyle="#0f1f1c";for(let x=0;x<W*.5;x+=H*.06){c.fillRect(x,f(x)-H*.08,H*.012,H*.08)}c.fillRect(0,f(0)-H*.06,W*.5,H*.01);
    for(let i=0;i<14;i++)glow(c,r()*W,T+H*(.4+r()*.5),H*.02,[255,240,150],.9);}
};

const LAYERS=["sky","far","mid","front"];
function paint(g,layer,c,W,H,T){const r=RNG(hash(g.id+layer));const s=H/400;(P[g.theme]||P.space)(layer,c,W,H,T,r,s)}
function composite(g,W,H){const cv=mk(W,H),c=cv.getContext("2d");LAYERS.forEach(L=>paint(g,L,c,W,H,0));
  c.fillStyle=lg(c,0,0,0,H,[[0,"rgba(0,0,0,0)"],[.7,"rgba(0,0,0,0)"],[1,"rgba(0,0,0,.35)"]]);c.fillRect(0,0,W,H);return cv}
const cache=new Map();
function art(g,w,h){const k=g.id+w+"x"+h;if(!cache.has(k))cache.set(k,composite(g,w,h));return cache.get(k)}
function place(host,g,w,h,url){ // url slot for fal.ai art
  if(url){const im=new Image();im.alt="";im.decoding="async";im.src=url;host.prepend(im);return}
  const src=art(g,w*DPR|0,h*DPR|0),cv=mk(src.width,src.height);cv.getContext("2d").drawImage(src,0,0);host.prepend(cv)}


/* ---------- extra painter: temple arena (Tarung Maut) ---------- */
P.temple=(L,c,W,H,T,r,s)=>{const B=T+H,hz=T+H*.66;
  if(L==="sky"){c.fillStyle=lg(c,0,0,0,hz,[[0,"#10040a"],[.45,"#4a0c1a"],[.8,"#b3261e"],[1,"#ff9a4a"]]);c.fillRect(0,0,W,B);
    glow(c,W*.5,hz-H*.12,H*.9,[255,120,60],.5);c.fillStyle="#ffe2b0";c.beginPath();c.arc(W*.5,hz-H*.14,H*.1,0,7);c.fill();glow(c,W*.5,hz-H*.14,H*.22,[255,230,180],.7);
    for(let i=0;i<5;i++){c.fillStyle=`rgba(60,8,16,${.35+i*.1})`;c.fillRect(0,hz-H*(.1-i*.03),W,H*.012)}stars(c,r,50,W,0,hz-H*.4,s,[255,200,190]);}
  if(L==="far"){c.fillStyle="#5a1420";c.beginPath();c.moveTo(W*.15,hz+2);c.lineTo(W*.42,hz-H*.3);c.lineTo(W*.47,hz-H*.31);c.lineTo(W*.52,hz-H*.29);c.lineTo(W*.85,hz+2);c.fill();haze(c,W,hz,H*.08,[255,140,90],.4);
    ridge(c,W,B,x=>hz-Math.abs(Math.sin(x*.004/s))*H*.05,"#3a0d16");}
  if(L==="mid"){const cx=W*.5,gap=H*.05,bw=H*.34,base=hz+H*.1;c.fillStyle=lg(c,0,hz,0,B,[[0,"#2a0a10"],[1,"#12040a"]]);c.fillRect(0,base,W,B-base);
    glow(c,cx,base-H*.2,H*.3,[255,150,80],.55);
    [-1,1].forEach(sd=>{let y=base;for(let i=0;i<8;i++){const w=bw*(1-i*.105),h=H*(.055-i*.002);const x=sd<0?cx-gap-w:cx+gap;c.fillStyle="#170508";c.fillRect(x,y-h,w,h);
      c.fillStyle="#0d0306";const ox=sd<0?x:x+w;c.beginPath();c.moveTo(ox,y-h);c.lineTo(ox-sd*H*.02,y-h-H*.02);c.lineTo(ox-sd*H*.03,y-h);c.fill();y-=h}
      c.fillStyle="#170508";const tx=sd<0?cx-gap-H*.02:cx+gap+H*.02;c.fillRect(tx-H*.006,y-H*.06,H*.012,H*.06)});
    [W*.2,W*.8].forEach(x=>tree(c,x,base,H*.24,"#1a0609"));}
  if(L==="front"){c.fillStyle="#070203";c.fillRect(0,B-H*.09,W,H*.1);c.fillRect(0,T+H*.1,W*.05,H);c.fillRect(W*.95,T+H*.1,W*.05,H);
    [W*.1,W*.9].forEach(x=>{c.fillStyle="#070203";c.fillRect(x-H*.008,B-H*.42,H*.016,H*.34);glow(c,x,B-H*.45,H*.12,[255,150,60],1);glow(c,x,B-H*.45,H*.03,[255,240,190],1)});}
};


export { DPR, REDUCED, P, LAYERS, paint, composite, art, mk, hash, RNG, glow, lg };
