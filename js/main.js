/*
 * Uygulama olaylarını bağlar ve ilk görünümü çizer.
 * Önceki tüm modüllere dayanır.
 * index.html dosyasının en son yüklemesinde çalışır.
 */
"use strict";

/* ---------- 20) Başlat ---------- */
document.documentElement.dataset.theme=S.settings.theme;
let rzT;
window.addEventListener("hashchange",()=>{ syncRouteFromHash(); render(); window.scrollTo({top:0}); });
window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(UI.route==="analytics")render();},200);});
syncRouteFromHash();
renderShell(); render();
if(!storageOK)setTimeout(()=>toast("Tarayıcı depolaması kullanılamıyor (gizli mod olabilir); veriler sayfa kapanınca kaybolacak.","warn",7000),800);
