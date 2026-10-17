/*
 * İlerleme Analizi ekranını içerir.
 * UI çekirdeği ve türetimlere dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 15) Bölüm: İlerleme Analizi ---------- */
function renderAnalytics(v){
  const sess=sessionsInRange();
  const subjects=S.subjects.filter(s=>!s.archived);
  const filtered=UI.anaSubj==="all"?sess:sess.filter(s=>s.subjectId===UI.anaSubj);
  const totalMin=Math.round(filtered.reduce((a,s)=>a+s.elapsedMs,0)/60000);
  const qa=filtered.reduce((a,s)=>a+(s.qAttempted||0),0),qc=filtered.reduce((a,s)=>a+(s.qCorrect||0),0);
  const enough=filtered.length>0;
  const rangeLabel=UI.anaRange==="7"?"Son 7 gün":UI.anaRange==="30"?"Son 30 gün":UI.anaRange==="all"?"Tüm zamanlar":`${fmtShort(UI.anaFrom)} – ${fmtShort(UI.anaTo)}`;
  v.innerHTML=pageHead("İlerleme Analizi","Yalnızca kayıtlı veriden hesaplanır; örneklemi küçük sonuçlar yanıltıcı olabilir",
    `<div class="filters">
      <div class="seg">
        <button class="${UI.anaRange==="7"?"on":""}" onclick="App.setRange('7')">7 gün</button>
        <button class="${UI.anaRange==="30"?"on":""}" onclick="App.setRange('30')">30 gün</button>
        <button class="${UI.anaRange==="all"?"on":""}" onclick="App.setRange('all')">Tümü</button>
        <button class="${UI.anaRange==="custom"?"on":""}" onclick="App.setRange('custom')">Özel</button></div>
      <select onchange="App.setAnaSubj(this.value)" aria-label="Ders filtresi" style="width:auto">
        <option value="all">Tüm dersler</option>${subjects.map(s=>`<option value="${s.id}" ${UI.anaSubj===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select></div>`)+
  (UI.anaRange==="custom"?`<div class="card" style="margin-bottom:16px"><div class="row">
    <label class="small muted">Başlangıç <input type="date" value="${UI.anaFrom}" onchange="UI.anaFrom=this.value;render()" style="width:auto"></label>
    <label class="small muted">Bitiş <input type="date" value="${UI.anaTo}" onchange="UI.anaTo=this.value;render()" style="width:auto"></label>
    ${UI.anaFrom>UI.anaTo?'<span class="badge b-danger">Başlangıç bitişten sonra olamaz</span>':""}</div></div>`:"")+
  (enough? `
  <div class="dash">
    <div class="stack">
      <div class="card"><h3><i data-lucide="gauge"></i>Özet — ${rangeLabel}</h3>
        <div class="stat-line"><span class="muted">Gerçek çalışma süresi</span><span class="v mono-num">${fmtDur(totalMin)}</span></div>
        <div class="stat-line"><span class="muted">Oturum sayısı</span><span class="v mono-num">${filtered.length}</span></div>
        <div class="stat-line"><span class="muted">Sorular (doğru / deneme)</span><span class="v mono-num">${qc} / ${qa}${qa?` · %${pct(qc,qa)}`:""}</span></div>
        <div class="stat-line"><span class="muted">Gün içi tutarlılık</span><span class="v mono-num">${new Set(filtered.map(s=>dayKey(new Date(s.startedAt)))).size} gün</span></div>
        ${filtered.some(s=>s.demo)?`<span class="badge b-demo" style="margin-top:8px">DEMO oturumları dahil</span>`:""}
      </div>
      <div class="card"><h3><i data-lucide="bar-chart-3"></i>Derslere göre süre</h3><div class="chart-wrap"><canvas class="chart" id="ch-subj" height="150" aria-label="Derslere göre süre grafiği"></canvas></div></div>
      <div class="card"><h3><i data-lucide="line-chart"></i>Günlere göre süre</h3><div class="chart-wrap"><canvas class="chart" id="ch-days" height="150" aria-label="Günlere göre süre grafiği"></canvas></div></div>
    </div>
    <div class="stack">
      <div class="card"><h3><i data-lucide="pie-chart"></i>Konu durumu dağılımı</h3><div class="chart-wrap"><canvas class="chart" id="ch-status" height="150" aria-label="Konu durumu dağılımı"></canvas></div>
        <div class="row small muted" style="margin-top:8px">${Object.entries(TOPIC_STATUS).map(([k,l],i)=>`<span class="row" style="gap:5px"><span class="color-dot" style="background:${["#6b7386","#8d9bf0","#dfb35d","#4cc38a"][i]}"></span>${l}: ${S.topics.filter(t=>t.status===k).length}</span>`).join("")}</div></div>
      <div class="card"><h3><i data-lucide="target"></i>Soru doğruluğu (deneme sayısıyla)</h3>
        ${(()=>{ const rows=subjects.map(s=>{const ss=sessionsOfSubject(s.id).filter(x=>filtered.includes(x));
            const a=ss.reduce((x,y)=>x+(y.qAttempted||0),0),c=ss.reduce((x,y)=>x+(y.qCorrect||0),0);return{s,a,c};})
          .filter(r=>r.a>0);
          return rows.length? rows.map(r=>`<div style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div class="spread"><span class="row" style="gap:7px"><span class="color-dot" style="background:${r.s.color}"></span><b style="font-weight:500">${esc(r.s.name)}</b></span>
            <span class="mono-num small">${r.a<10?"örneklem küçük · ":""}%${pct(r.c,r.a)} <span class="muted">(${r.a} soru)</span></span></div>
            <div class="sbar" style="max-width:none;margin-top:6px"><span style="width:${pct(r.c,r.a)}%;background:${r.s.color}"></span></div></div>`).join("")
          :`<div class="empty" style="padding:14px"><p>Bu aralıkta soru çözümü kaydı yok.</p></div>`; })()}
        <div class="help">Doğruluk = doğru / deneme. 10 sorunun altındaki oranlar güvenilir bir gösterge değildir.</div></div>
    </div>
  </div>`:
  `<div class="card"><div class="empty"><i data-lucide="bar-chart-3"></i><b>Grafik için yeterli veri yok</b><p>Bu aralıkta (${rangeLabel}) kayıtlı oturum bulunmuyor. Oturum kaydettikçe analizler gerçek veriyle dolacak — uygulama hiçbir değeri uydurmadan gösterir.</p></div></div>`);
  if(enough){ requestAnimationFrame(()=>{ drawSubjectChart(); drawDaysChart(); drawStatusChart(); }); }
}
function chartCtx(id,h){ const cv=$(id); if(!cv)return null;
  const dpr=window.devicePixelRatio||1, w=cv.parentElement.clientWidth;
  cv.width=w*dpr; cv.height=h*dpr; cv.style.height=h+"px";
  const ctx=cv.getContext("2d"); ctx.scale(dpr,dpr);
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return{ctx,w,h,css};}
function drawSubjectChart(){
  const c=chartCtx("#ch-subj",150); if(!c)return;
  const data=S.subjects.filter(s=>!s.archived).map(s=>({l:s.name,v:Math.round(sessionsInRange().filter(x=>x.subjectId===s.id).reduce((a,x)=>a+x.elapsedMs,0)/60000),col:s.color}))
    .filter(d=>d.v>0).sort((a,b)=>b.v-a.v);
  if(!data.length){c.ctx.fillStyle=c.css("--faint");c.ctx.font="12px Instrument Sans";c.ctx.fillText("Veri yok",10,20);return;}
  const max=Math.max(...data.map(d=>d.v)),bw=Math.min(26,(c.w-140)/data.length-14);
  const base=c.h-24;
  c.ctx.font="11px Instrument Sans";
  data.forEach((d,i)=>{ const x=110+i*((c.w-120)/data.length)+((c.w-120)/data.length-bw)/2;
    const h=Math.max(2,(d.v/max)*(base-20));
    c.ctx.fillStyle=d.col; c.ctx.globalAlpha=.85; c.ctx.beginPath();c.ctx.roundRect(x,base-h,bw,h,4);c.ctx.fill();c.ctx.globalAlpha=1;
    c.ctx.fillStyle=c.css("--muted");
    c.ctx.save();c.ctx.translate(x+bw/2,base+8);c.ctx.rotate(data.length>6?.6:0);c.ctx.textAlign="center";c.ctx.fillText(d.l.length>11?d.l.slice(0,10)+"…":d.l,0,data.length>6?4:10);c.ctx.restore();
    c.ctx.fillStyle=c.css("--text");c.ctx.textAlign="center";c.ctx.font="600 10px Space Grotesk";c.ctx.fillText(fmtDur(d.v).replace(" dk","'"),x+bw/2,base-h-5);c.ctx.font="11px Instrument Sans";});
  c.ctx.strokeStyle=c.css("--border");c.ctx.beginPath();c.ctx.moveTo(105,base);c.ctx.lineTo(c.w-5,base);c.ctx.stroke();
}
function drawDaysChart(){
  const c=chartCtx("#ch-days",150); if(!c)return;
  const sess=sessionsInRange();
  const n=UI.anaRange==="7"?7:UI.anaRange==="30"?30:14;
  const days=[]; for(let i=n-1;i>=0;i--){const k=addDaysKey(todayKey(),-i);
    days.push({l:parseDay(k).getDate(),v:Math.round(sess.filter(x=>dayKey(new Date(x.startedAt))===k).reduce((a,x)=>a+x.elapsedMs,0)/60000)});}
  const max=Math.max(15,...days.map(d=>d.v)),base=c.h-24,bw=Math.max(3,(c.w-20)/n-6);
  c.ctx.font="10px Instrument Sans";
  days.forEach((d,i)=>{ const x=12+i*((c.w-24)/days.length);
    const h=Math.max(1.5,(d.v/max)*(base-18));
    c.ctx.fillStyle=d.v?"var(--accent)":c.css("--border");
    c.ctx.fillStyle=d.v?c.css("--accent"):c.css("--border"); c.ctx.globalAlpha=d.v?.85:.7;
    c.ctx.beginPath();c.ctx.roundRect(x,base-h,bw,h,3);c.ctx.fill();c.ctx.globalAlpha=1;
    if(n<=14||i%5===0){c.ctx.fillStyle=c.css("--faint");c.ctx.textAlign="center";c.ctx.fillText(d.l,x+bw/2,base+12);}});
  c.ctx.strokeStyle=c.css("--border");c.ctx.beginPath();c.ctx.moveTo(10,base);c.ctx.lineTo(c.w-10,base);c.ctx.stroke();
  c.ctx.fillStyle=c.css("--faint");c.ctx.textAlign="left";c.ctx.fillText("en yoğun gün: "+fmtDur(max),12,12);
}
function drawStatusChart(){
  const c=chartCtx("#ch-status",130); if(!c)return;
  const counts=Object.keys(TOPIC_STATUS).map(k=>S.topics.filter(t=>t.status===k).length);
  const tot=counts.reduce((a,b)=>a+b,0);
  if(!tot){c.ctx.fillStyle=c.css("--faint");c.ctx.font="12px Instrument Sans";c.ctx.fillText("Konu yok",10,20);return;}
  const cols=["#6b7386","#8d9bf0","#dfb35d","#4cc38a"];
  let x=0;const y=c.h/2-18,h=26;
  counts.forEach((n,i)=>{ if(!n)return; const w=n/tot*(c.w-10);
    c.ctx.fillStyle=cols[i];c.ctx.globalAlpha=.85;c.ctx.beginPath();c.ctx.roundRect(x===0?5:x,y,Math.max(w-.5,1),h,3);c.ctx.fill();c.ctx.globalAlpha=1;x+=w;});
  c.ctx.fillStyle=c.css("--muted");c.ctx.font="12px Instrument Sans";
  c.ctx.fillText(tot+" konu · "+counts[3]+" tanesi öğrenildi sayılıyor",5,y+h+18);
  c.ctx.fillStyle=c.css("--faint");c.ctx.font="10.5px Instrument Sans";
  c.ctx.fillText("“Öğrenildi” öğrencinin kendi işaretidir; bilgi ölçümü değildir.",5,y+h+33);
}
function setRange(r){ UI.anaRange=r; render(); }
function setAnaSubj(id){ UI.anaSubj=id; render(); }
