/*
 * Yardımcı fonksiyonları ve biçimlendiricileri içerir.
 * Bağımsız temel araçları tanımlar.
 * Depolama, türetimler ve tüm görünümler tarafından kullanılır.
 */
"use strict";

/* ---------- 1) Yardımcılar ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
/* Kullanıcı metni HTML özniteliklerinde ve şablonlarda güvenle gösterilsin diye özel karakterleri kodlar. */
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* Desteklenmeyen tarayıcılarda da çakışma olasılığı düşük bir kimlik üretmek için zaman ve rastgelelik yedeği kullanılır. */
const uid=()=> (crypto.randomUUID?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(36).slice(2,9));
const pad=n=>String(n).padStart(2,"0");
const dayKey=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const todayKey=()=>dayKey(new Date());
/* Gün anahtarları yerel takvim tarihidir; UTC timestamp'leri doğrudan bu ayrıştırıcıya verilmez. */
const parseDay=s=>{const[y,m,d]=String(s).split("-").map(Number);return new Date(y,m-1,d);};
/* setDate takvim gününü ilerletir; günü sabit milisaniyeyle eklemek yaz/kış saati geçişlerinde kayabilir. */
const addDaysKey=(key,n)=>{const d=parseDay(key);d.setDate(d.getDate()+n);return dayKey(d);};
/* 864e5 bir günün milisaniyesidir; yuvarlama yerel günler arasındaki yaz/kış saati farkını dengeler. */
const daysBetween=(a,b)=>Math.round((parseDay(b)-parseDay(a))/864e5);
const DAY_NAMES=["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
const DAY_SHORT=["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
function fmtDay(key,style){ if(!key)return "—"; const d=parseDay(key);
  if(style==="kısa")return d.toLocaleDateString("tr-TR",{day:"numeric",month:"short"});
  return d.toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric",weekday:"long"});}
const fmtShort=key=>fmtDay(key,"kısa");
function fmtDur(min){ min=Math.max(0,Math.round(min)); const h=Math.floor(min/60),m=min%60;
  if(h&&m)return h+" sa "+m+" dk"; if(h)return h+" sa"; return m+" dk";}
const fmtClock=ms=>{const t=Math.floor(ms/1000);return pad(Math.floor(t/3600))+":"+pad(Math.floor(t%3600/60))+":"+pad(t%60);};
const pct=(a,b)=> b>0?Math.round(a/b*100):null;
const relDays=n=> n===0?"bugün": n===1?"dün": n===-1?"yarın": n>0?n+" gün önce":(-n)+" gün sonra";
