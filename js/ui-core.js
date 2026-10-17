/*
 * Modal, bildirim, ortak arayüz yardımcıları ve gezinme kabuğunu içerir.
 * Durum ve sabitlere dayanır.
 * Görünümler, eylemler ve başlangıç kullanır.
 */
"use strict";

/* ---------- 8) UI çekirdeği ---------- */
function toast(msg,type="ok",dur=3200){
  const el=document.createElement("div");el.className="toast "+type;
  const ic=type==="ok"?"check-circle-2":type==="err"?"alert-circle":type==="warn"?"alert-triangle":"info";
  el.innerHTML=`<i data-lucide="${ic}" style="margin-top:1px"></i><div>${esc(msg)}</div>`;
  $("#toast-root").appendChild(el);lucide.createIcons({attrs:{},nameAttr:"data-lucide"});
  setTimeout(()=>{el.style.opacity="0";el.style.transition="opacity .25s";setTimeout(()=>el.remove(),260);},dur);
}
let modalKeydown=null;
function openModal({title,body,footer,wide,onMount}){
  UI.questionModalRequest++;
  UI.backupImportRequest++;
  if(UI.questionModalUrl){URL.revokeObjectURL(UI.questionModalUrl);UI.questionModalUrl=null;}
  const root=$("#modal-root");
  root.innerHTML=`<div class="overlay" data-ov="1"><div class="dialog${wide?" wide":""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="dlg-head"><h3>${esc(title)}</h3><button class="btn btn-ghost btn-icon" onclick="closeModal()" aria-label="Kapat"><i data-lucide="x"></i></button></div>
    <div class="dlg-body">${body}</div>${footer?`<div class="dlg-foot">${footer}</div>`:""}</div></div>`;
  root.querySelector(".overlay").addEventListener("mousedown",e=>{if(e.target.dataset.ov)closeModal();});
  if(modalKeydown)document.removeEventListener("keydown",modalKeydown);
  modalKeydown=e=>{if(e.key==="Escape")closeModal();};
  document.addEventListener("keydown",modalKeydown);
  lucide.createIcons(); if(onMount)onMount();
  const f=root.querySelector("input,select,textarea,button:not(.btn-ghost)"); if(f)f.focus();
}
function closeModal(){
  $("#modal-root").innerHTML="";
  UI.questionModalRequest++;
  UI.backupImportRequest++;
  if(UI.questionModalUrl){URL.revokeObjectURL(UI.questionModalUrl);UI.questionModalUrl=null;}
  if(modalKeydown){document.removeEventListener("keydown",modalKeydown);modalKeydown=null;}
}
function confirmDialog({title,message,confirmText="Sil",onConfirm}){
  openModal({title,body:`<p style="color:var(--muted);font-size:13.5px;line-height:1.55">${message}</p>`,
    footer:`<button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-danger" id="cf-btn"><i data-lucide="trash-2"></i>${esc(confirmText)}</button>`,
    onMount:()=>{$("#cf-btn").onclick=()=>{closeModal();onConfirm();};}});
}
const fld=(label,inner,help)=>`<div class="fld"><label>${label}</label>${inner}${help?`<div class="help">${help}</div>`:""}</div>`;
const statusBadge=st=>{const m={baslanmadi:["b-mut","Başlanmadı"],calisiliyor:["b-info","Çalışılıyor"],tekrar:["b-warn","Tekrar Gerekli"],ogrenildi:["b-ok","Öğrenildi"]};
  const[c,l]=m[st]||m.baslanmadi;return `<span class="badge ${c}">${l}</span>`;};
const prioDot=p=>`<span class="prio-dot" style="background:${PRIOS[p]?.c||"var(--faint)"}" title="${PRIOS[p]?.l} öncelik"></span>`;
const subjTag=id=>{const n=subjName(id);return n?`<span class="badge b-mut">${esc(n)}</span>`:"";};

/* ---------- 9) Kabuk & gezinme ---------- */
const ROUTES={
  overview:{t:"Genel Bakış",i:"layout-dashboard",render:v=>renderOverview(v)},
  "school-schedule":{t:"Okul Programı",i:"calendar-days",render:v=>renderSchoolSchedule(v)},
  subjects:{t:"Dersler ve Konular",i:"library",render:v=>renderSubjects(v)},
  planner:{t:"Çalışma Planı",i:"calendar-range",render:v=>renderPlanner(v)},
  exams:{t:"Sınav Takvimi",i:"calendar-days",render:v=>renderExams(v)},
  sessions:{t:"Çalışma Oturumları",i:"timer",render:v=>renderSessions(v)},
  "question-archive":{t:"Soru Arşivi",i:"archive",render:v=>renderQuestionArchive(v)},
  analytics:{t:"İlerleme Analizi",i:"bar-chart-3",render:v=>renderAnalytics(v)},
  review:{t:"Tekrar Merkezi",i:"rotate-ccw",render:v=>renderReview(v)},
  settings:{t:"Ayarlar ve Veri",i:"settings",render:v=>renderSettings(v)},
};
const normalizeRoute=route=>ROUTES[route] ? route : "overview";
function syncRouteFromHash(){
  const hash=window.location.hash.replace(/^#/, "").trim();
  const next=normalizeRoute(hash || "overview");
  if(next!==UI.route){ UI.route=next; }
  if(hash!==next && next!=="overview"){
    window.history.replaceState(null, "", "#"+next);
  } else if(hash && next==="overview"){
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
function setRoute(r){
  const next=normalizeRoute(r);
  const changed=next!==UI.route;
  UI.route=next;
  if(next==="subjects")UI.topicSubj="all";
  const hash=next==="overview"?"":`#${next}`;
  if(window.location.hash!==hash){
    const url=hash||window.location.pathname+window.location.search;
    if(changed)window.history.pushState(null,"",url);
    else window.history.replaceState(null,"",url);
  }
  render(); window.scrollTo({top:0});
}
function renderShell(){
  const nav=Object.entries(ROUTES).map(([k,v])=>`<button class="nav-btn${UI.route===k?" active":""}" data-route="${k}" aria-label="${esc(v.t)}" title="${esc(v.t)}" onclick="setRoute('${k}')"><i data-lucide="${v.i}"></i><span>${v.t}</span></button>`).join("");
  $("#app").innerHTML=`
  <aside aria-label="Ana gezinme">
    <div class="logo"><span class="logo-mark">S</span><span>StudyOS</span></div>
    ${nav}
    <div class="aside-foot">
      <button class="nav-btn" onclick="App.toggleTheme()" id="theme-btn"><i data-lucide="${S.settings.theme==="dark"?"sun":"moon"}"></i><span>${S.settings.theme==="dark"?"Aydınlık tema":"Karanlık tema"}</span></button>
    </div>
  </aside>
  <main><div id="view"></div></main>`;
}
function render(){
  const v=$("#view"); if(!v){renderShell();}
  if(UI.route!=="question-archive"){
    UI.questionArchiveRender++;
    UI.questionArchiveUrls.forEach(url=>URL.revokeObjectURL(url));
    UI.questionArchiveUrls=[];
  }
  if(UI.route!=="school-schedule"&&UI.schoolScheduleUrl){
    URL.revokeObjectURL(UI.schoolScheduleUrl);
    UI.schoolScheduleUrl=null;
  }
  $$(".nav-btn[data-route]").forEach(btn=>{
    const active=btn.dataset.route===UI.route;
    btn.classList.toggle("active",active);
    if(active)btn.setAttribute("aria-current","page");
    else btn.removeAttribute("aria-current");
  });
  ROUTES[UI.route].render($("#view"));
  renderLiveBar();
  lucide.createIcons();
}
function pageHead(title,sub,actions=""){return `<div class="page-head"><div><h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:""}</div><div class="head-actions">${actions}</div></div>`;}
