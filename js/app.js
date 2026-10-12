
"use strict";
/* ================================================================
   StudyOS — kişisel akademik komuta merkezi
   Katmanlar: yardımcılar → depolama → demo veri → türetiler →
   öneri motoru → UI çekirdeği → bölüm görünümleri → eylemler
================================================================ */

/* ---------- 1) Yardımcılar ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=> (crypto.randomUUID?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(36).slice(2,9));
const pad=n=>String(n).padStart(2,"0");
const dayKey=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const todayKey=()=>dayKey(new Date());
const parseDay=s=>{const[y,m,d]=String(s).split("-").map(Number);return new Date(y,m-1,d);};
const addDaysKey=(key,n)=>{const d=parseDay(key);d.setDate(d.getDate()+n);return dayKey(d);};
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

/* ---------- 2) Sabitler & modeller ---------- */
const STORAGE_KEY="studyos-data"; const DATA_VERSION=1; const QUESTION_STATS_VERSION=1;
const SCHOOL_SCHEDULE_DB="studyos-media"; const SCHOOL_SCHEDULE_STORE="assets"; const SCHOOL_SCHEDULE_KEY="weekly-schedule";
const TOPIC_STATUS={baslanmadi:"Başlanmadı",calisiliyor:"Çalışılıyor",tekrar:"Tekrar Gerekli",ogrenildi:"Öğrenildi"};
const SESSION_TYPES={konu:"Konu öğrenme",soru:"Soru çözümü",tekrar:"Tekrar",deneme:"Deneme sınavı",odev:"Ödev"};
const PRIOS={1:{l:"Yüksek",c:"var(--danger)"},2:{l:"Normal",c:"var(--warn)"},3:{l:"Düşük",c:"var(--faint)"}};
const SUBJ_COLORS=["#8d9bf0","#4cc38a","#dfb35d","#e26873","#6bb7e0","#c39be0","#7fd0c1","#e0937a"];
const REVIEW_OPTIONS=[{d:1,l:"Yarın"},{d:3,l:"3 gün sonra"},{d:7,l:"7 gün sonra"},{d:14,l:"14 gün sonra"}];
const FEEDBACK={kolay:"Kolaydı",zor:"Zordu",hatirlayamadim:"Hatırlayamadım"};

function schoolScheduleRequest(action,value){
  return new Promise((resolve,reject)=>{
    let request;
    try{request=indexedDB.open(SCHOOL_SCHEDULE_DB,1);}
    catch(e){reject(e);return;}
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(SCHOOL_SCHEDULE_STORE))db.createObjectStore(SCHOOL_SCHEDULE_STORE,{keyPath:"key"});
    };
    request.onerror=()=>reject(request.error||new Error("IndexedDB açılamadı."));
    request.onsuccess=()=>{
      const db=request.result;
      let tx,result;
      try{
        tx=db.transaction(SCHOOL_SCHEDULE_STORE,action==="get"?"readonly":"readwrite");
        const store=tx.objectStore(SCHOOL_SCHEDULE_STORE);
        const op=action==="get"?store.get(SCHOOL_SCHEDULE_KEY):
          action==="put"?store.put(value):store.delete(SCHOOL_SCHEDULE_KEY);
        op.onsuccess=()=>{result=op.result;};
        op.onerror=()=>{reject(op.error||new Error("Okul programı depolama işlemi başarısız oldu."));};
        tx.oncomplete=()=>{db.close();resolve(result);};
        tx.onerror=()=>{db.close();reject(tx.error||new Error("Okul programı depolama işlemi başarısız oldu."));};
        tx.onabort=()=>{db.close();reject(tx.error||new Error("Okul programı depolama işlemi iptal edildi."));};
      }catch(e){db.close();reject(e);}
    };
  });
}

function decodeSchoolScheduleImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>{
      const valid=image.naturalWidth>0&&image.naturalHeight>0;
      URL.revokeObjectURL(url);
      if(valid)resolve();
      else reject(new Error("Dosya geçerli bir görsel olarak açılamadı."));
    };
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Dosya geçerli bir görsel olarak açılamadı."));};
    image.src=url;
  });
}

async function validateSchoolScheduleImage(file){
  if(!file)return "Önce bir görsel seçin.";
  const mimeByExtension={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
  const extension=file.name.split(".").pop().toLowerCase(),expectedMime=mimeByExtension[extension];
  if(!expectedMime)return "Yalnızca JPG, JPEG, PNG veya WebP görselleri yüklenebilir.";
  if(file.type&&file.type.toLowerCase()!==expectedMime)return "Dosya uzantısı ile görsel türü eşleşmiyor.";
  if(file.size===0)return "Seçilen dosya boş.";
  if(file.size>15*1024*1024)return "Görsel en fazla 15 MB olabilir.";
  try{
    const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const isPng=header.length>=8&&header[0]===0x89&&header[1]===0x50&&header[2]===0x4e&&header[3]===0x47&&
      header[4]===0x0d&&header[5]===0x0a&&header[6]===0x1a&&header[7]===0x0a;
    const isJpeg=header.length>=3&&header[0]===0xff&&header[1]===0xd8&&header[2]===0xff;
    const isWebp=header.length>=12&&String.fromCharCode(...header.subarray(0,4))==="RIFF"&&
      String.fromCharCode(...header.subarray(8,12))==="WEBP";
    const actualMime=isPng?"image/png":isJpeg?"image/jpeg":isWebp?"image/webp":null;
    if(actualMime!==expectedMime)return "Dosyanın gerçek görsel biçimi uzantısıyla eşleşmiyor veya desteklenmiyor.";
    await decodeSchoolScheduleImage(file);
  }catch(error){
    return error?.message||"Dosya geçerli bir görsel olarak açılamadı.";
  }
  return null;
}

function defaultSettings(){return{ name:"",theme:"dark",weekStart:1,dailyTargetMin:180,dailyMaxMin:300,
  studyDays:[1,2,3,4,5,6],restDays:[0],sessionLen:40,breakLen:10,examWarnDays:5,dateStyle:"uzun",demoActive:true };}
function blankState(){return{ version:DATA_VERSION, questionStatsVersion:QUESTION_STATS_VERSION, settings:defaultSettings(), subjects:[],topics:[],exams:[],tasks:[],sessions:[],reviewLog:[],activeSession:null };}

/* ---------- 3) Depolama (versiyonlu, korumalı) ---------- */
let storageOK=true;
function loadState(){
  let raw=null;
  try{ raw=localStorage.getItem(STORAGE_KEY);}catch(e){storageOK=false;}
  if(!raw){ const s=blankState(); Object.assign(s,buildDemoData()); return migrateQuestionStats(s); }
  try{
    const parsed=JSON.parse(raw);
    if(!parsed||typeof parsed!=="object"||!Array.isArray(parsed.subjects)) throw new Error("şema");
    const s=blankState();
    // Gevşek birleştirme: bilinen alanlar + tip koruması (migrasyon zemini)
    s.settings={...s.settings,...(parsed.settings||{})};
    for(const k of["subjects","topics","exams","tasks","sessions","reviewLog"])
      s[k]=Array.isArray(parsed[k])?parsed[k].filter(x=>x&&x.id):[];
    s.activeSession=parsed.activeSession&&parsed.activeSession.startedAt?parsed.activeSession:null;
    s.questionStatsVersion=parsed.questionStatsVersion||0;
    return migrateQuestionStats(s);
  }catch(e){
    const s=blankState(); Object.assign(s,buildDemoData());
    setTimeout(()=>toast("Kayıtlı veri okunamadı; uygulama örnek veriyle başlatıldı. Ayarlar → Yedekleme bölümünden durumu kontrol edebilirsin.","warn",6000),400);
    return migrateQuestionStats(s);
  }
}
let lastSavedStateJSON="";
function save(){
  const serialized=JSON.stringify(S);
  try{
    localStorage.setItem(STORAGE_KEY,serialized);
    lastSavedStateJSON=serialized;
    storageOK=true;
    return true;
  }catch(e){
    if(lastSavedStateJSON) S=JSON.parse(lastSavedStateJSON);
    storageOK=false;
    toast("Değişiklik kaydedilemedi; önceki kayıt geri yüklendi. Tarayıcı deposunu kontrol et.","err",6000);
    return false;
  }
}
function persist(){
  if(save())return true;
  document.documentElement.dataset.theme=S.settings.theme;
  closeModal();
  render();
  return false;
}

/* ---------- 4) Başlangıç demo verisi (dinamik tarihli, etiketli) ---------- */
function buildDemoData(){
  const t=todayKey(); const d=n=>addDaysKey(t,n);
  const mk=(name,color,icon,prio)=>({id:uid(),name,color,icon,priority:prio??2,targetGrade:"",notes:"",archived:false});
  const mat=mk("Matematik","#8d9bf0","sigma",1), fiz=mk("Fizik","#6bb7e0","atom",1), kim=mk("Kimya","#4cc38a","flask-conical",2),
        bio=mk("Biyoloji","#7fd0c1","leaf",3), edb=mk("Edebiyat","#c39be0","feather",3), tar=mk("Tarih","#dfb35d","landmark",3);
  const tp=(s,title,o={})=>({ id:uid(),subjectId:s.id,parentId:null,title,examRelevance:o.er??1,estMinutes:o.em??60,
    status:o.st??"baslanmadi",confidence:o.cf??1,lastStudiedAt:o.ls??null,nextReviewAt:o.nr??null,notes:o.no??"",resources:"",
    qAttempted:o.qa??0,qCorrect:o.qc??0 });
  const g1=tp(mat,"Temel geometri",{st:"calisiliyor",cf:2,er:3,em:120,ls:d(-3),qa:24,qc:11,no:"Üçgen alan ve açı konularında eksiğim var."});
  const g1a=tp(mat,"Üçgende benzerlik",{er:3,em:60,st:"calisiliyor",cf:2});
  const g2=tp(mat,"Dörtgenler",{st:"tekrar",cf:3,er:3,em:90,ls:d(-2),qa:18,qc:12,nr:d(-1)});
  const g3=tp(mat,"Çemberde açı",{er:2,em:75});
  const at1=tp(fiz,"Atışlar",{er:3,em:90,st:"calisiliyor",cf:2,ls:d(-1),qa:15,qc:7});
  const at1a=tp(fiz,"Serbest düşme",{er:3,em:45,st:"calisiliyor",cf:3,parentId:at1.id,qa:10,qc:7,ls:d(-1)});
  const kn1=tp(kim,"Periyodik sistem",{er:2,em:60,st:"tekrar",cf:3,ls:d(-4),nr:d(0),qa:20,qc:14});
  const kn2=tp(kim,"Kimyasal bağlar",{er:2,em:60});
  const bn1=tp(bio,"Hücre",{er:2,em:50,st:"ogrenildi",cf:4,ls:d(-6),qa:12,qc:10});
  const en1=tp(edb,"Tanzimat edebiyatı",{er:1,em:40,st:"calisiliyor",cf:2,ls:d(-5)});
  const rn1=tp(tar,"Kurtuluş Savaşı",{er:1,em:45});
  const topics=[g1,g1a,g2,g3,at1,at1a,kn1,kn2,bn1,en1,rn1];
  const ex1={id:uid(),subjectId:fiz.id,title:"1. Dönem 1. Yazılı — Atışlar",date:d(6),time:"09:30",topicIds:[at1.id,at1a.id],importance:1,notes:"Sınıf ortalaması üzerinde hedefliyorum.",targetGrade:"85"};
  const ex2={id:uid(),subjectId:mat.id,title:"Geometri Yazılısı",date:d(13),time:"",topicIds:[g1.id,g1a.id,g2.id,g3.id],importance:1,notes:"",targetGrade:""};
  const ex3={id:uid(),subjectId:bio.id,title:"Hücre Konulu Kısa Sınav",date:d(20),time:"",topicIds:[bn1.id],importance:2,notes:"",targetGrade:""};
  // Demo oturumlar — hepsi demo:true ile açıkça etiketli
  const ses=(s,topic,day,type,mins,qa,qc,no)=>{const st=parseDay(day);st.setHours(17,10,0,0);const en=new Date(st.getTime()+mins*60000);
    return{id:uid(),subjectId:s.id,topicId:topic?topic.id:null,type,startedAt:st.toISOString(),endedAt:en.toISOString(),
      elapsedMs:mins*60000,plannedMin:mins,qAttempted:qa||0,qCorrect:qc||0,notes:no||"",demo:true};};
  const sessions=[ ses(mat,g1,d(-6),"konu",50), ses(mat,g1,d(-6),"soru",40,12,4), ses(fiz,at1,d(-5),"konu",55),
    ses(kim,kn1,d(-4),"tekrar",30,20,14), ses(mat,g2,d(-3),"soru",45,18,12), ses(fiz,at1,d(-2),"soru",40,15,7),
    ses(mat,g1a,d(-1),"konu",35), ses(bio,bn1,d(-1),"tekrar",20,12,10) ];
  const tasks=[
    {id:uid(),subjectId:mat.id,topicId:g1.id,title:"Üçgende alan–benzerlik soru seti",date:t,estMinutes:45,priority:1,status:"planli",type:"soru",createdAt:t},
    {id:uid(),subjectId:fiz.id,topicId:at1.id,title:"Atışlar konu tekrarı + 10 soru",date:t,estMinutes:50,priority:1,status:"planli",type:"tekrar",createdAt:t},
    {id:uid(),subjectId:edb.id,topicId:en1.id,title:"Tanzimat şiiri özet çıkar",date:t,estMinutes:25,priority:3,status:"planli",type:"odev",createdAt:t},
    {id:uid(),subjectId:mat.id,topicId:g2.id,title:"Dörtgenler tekrar soruları",date:null,estMinutes:40,priority:2,status:"planli",type:"soru",createdAt:t},
    {id:uid(),subjectId:tar.id,topicId:rn1.id,title:"Kurtuluş Savaşı kronoloji çalış",date:d(2),estMinutes:35,priority:2,status:"planli",type:"konu",createdAt:t} ];
  return{questionStatsVersion:0,subjects:[mat,fiz,kim,bio,edb,tar],topics,exams:[ex1,ex2,ex3],tasks,sessions,reviewLog:[],
    settings:{...defaultSettings(),demoActive:true}};
}

function migrateQuestionStats(state){
  if(state.questionStatsVersion>=QUESTION_STATS_VERSION)return state;
  const totals=new Map();
  for(const session of state.sessions||[]){
    if(!session.topicId)continue;
    const old=totals.get(session.topicId)||{attempted:0,correct:0};
    old.attempted+=Math.max(0,Number(session.qAttempted)||0);
    old.correct+=Math.max(0,Number(session.qCorrect)||0);
    totals.set(session.topicId,old);
  }
  for(const topic of state.topics||[]){
    const session=totals.get(topic.id)||{attempted:0,correct:0};
    const attempted=Math.max(0,Number(topic.qAttempted)||0);
    const correct=Math.max(0,Number(topic.qCorrect)||0);
    topic.qAttempted=Math.max(0,attempted-session.attempted);
    topic.qCorrect=Math.min(topic.qAttempted,Math.max(0,correct-session.correct));
  }
  state.questionStatsVersion=QUESTION_STATS_VERSION;
  return state;
}

function backupError(message){ throw new Error("Yedek doğrulanamadı: "+message); }
function backupId(value,label){
  if(typeof value!=="string"||! /^[A-Za-z0-9_-]{1,100}$/.test(value))backupError(label+" kimliği geçersiz.");
  return value;
}
function backupText(value,label,max=2000,optional=false){
  if(optional&&value==null)return "";
  if(typeof value!=="string"||value.length>max)backupError(label+" metni geçersiz.");
  return value;
}
function backupInt(value,label,min,max,optional=false){
  if(optional&&value==null)return null;
  if(!Number.isInteger(value)||value<min||value>max)backupError(label+" sayı değeri geçersiz.");
  return value;
}
function backupDay(value,label,optional=false){
  if(optional&&value==null)return null;
  if(typeof value!=="string"||! /^\d{4}-\d{2}-\d{2}$/.test(value)||dayKey(parseDay(value))!==value)
    backupError(label+" tarihi geçersiz.");
  return value;
}
function backupTimestamp(value,label){
  const ms=typeof value==="number"?value:typeof value==="string"?Date.parse(value):NaN;
  if(!Number.isFinite(ms))backupError(label+" zaman damgası geçersiz.");
  return value;
}
function backupTimestampMs(value,label){
  const checked=backupTimestamp(value,label);
  return typeof checked==="number"?checked:Date.parse(checked);
}
function validateBackupState(input){
  if(!input||typeof input!=="object"||Array.isArray(input))backupError("ana kayıt nesnesi eksik.");
  for(const key of ["subjects","topics","sessions"])
    if(!Array.isArray(input[key]))backupError(key+" listesi eksik.");
  for(const key of ["exams","tasks","reviewLog"])
    if(input[key]!=null&&!Array.isArray(input[key]))backupError(key+" listesi geçersiz.");
  if(input.questionStatsVersion!=null&&input.questionStatsVersion>QUESTION_STATS_VERSION)
    backupError("daha yeni bir soru istatistiği sürümü desteklenmiyor.");

  const result={...blankState(),settings:{...defaultSettings(),...(input.settings||{})},
    subjects:[],topics:[],exams:[],tasks:[],sessions:[],reviewLog:[],activeSession:null};
  const seen=new Set();
  const uniqueId=(value,label)=>{
    const id=backupId(value,label);
    if(seen.has(id))backupError("yinelenen "+label+" kimliği.");
    seen.add(id);
    return id;
  };
  result.subjects=input.subjects.map((item,i)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))backupError("ders kaydı geçersiz.");
    const label="Ders "+(i+1);
    const color=backupText(item.color,label+" renk",20);
    if(!/^#[0-9a-fA-F]{6}$/.test(color))backupError(label+" rengi geçersiz.");
    if(item.archived!=null&&typeof item.archived!=="boolean")backupError(label+" arşiv durumu geçersiz.");
    return {...item,id:uniqueId(item.id,label),name:backupText(item.name,label+" adı",50),
      color,priority:backupInt(item.priority,label+" önceliği",1,3),
      targetGrade:backupText(item.targetGrade,label+" hedef notu",10,true),
      notes:backupText(item.notes,label+" notu",5000,true),
      icon:backupText(item.icon,label+" simgesi",50,true),archived:item.archived??false};
  });
  const subjectIds=new Set(result.subjects.map(x=>x.id));
  result.topics=input.topics.map((item,i)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))backupError("konu kaydı geçersiz.");
    const label="Konu "+(i+1),id=uniqueId(item.id,label);
    if(!subjectIds.has(item.subjectId))backupError(label+" geçerli bir derse bağlı değil.");
    const parentId=item.parentId??null;
    if(parentId!==null)backupId(parentId,label+" üst konu");
    const status=backupText(item.status,label+" durumu",30);
    if(!Object.prototype.hasOwnProperty.call(TOPIC_STATUS,status))backupError(label+" durumu tanınmıyor.");
    const examRelevance=backupInt(item.examRelevance,label+" sınav önemi",0,3);
    const qAttempted=backupInt(item.qAttempted??0,label+" soru sayısı",0,1000000000);
    const qCorrect=backupInt(item.qCorrect??0,label+" doğru sayısı",0,1000000000);
    if(qCorrect>qAttempted)backupError(label+" doğru sayısı soru sayısından fazla.");
    return {...item,id,subjectId:item.subjectId,parentId,title:backupText(item.title,label+" başlığı",120),
      examRelevance,estMinutes:backupInt(item.estMinutes,label+" tahmini süre",10,600),
      status,confidence:backupInt(item.confidence,label+" güven değeri",1,5),
      lastStudiedAt:backupDay(item.lastStudiedAt,label+" son çalışma tarihi",true),
      nextReviewAt:backupDay(item.nextReviewAt,label+" tekrar tarihi",true),
      notes:backupText(item.notes,label+" notu",5000,true),
      resources:backupText(item.resources,label+" kaynak",2000,true),qAttempted,qCorrect};
  });
  const topicMap=new Map(result.topics.map(x=>[x.id,x]));
  for(const topic of result.topics){
    if(topic.parentId){
      const parent=topicMap.get(topic.parentId);
      if(!parent||parent.parentId||parent.subjectId!==topic.subjectId||parent.id===topic.id)
        backupError("konu üst konu ilişkisi geçersiz.");
    }
  }
  result.exams=(input.exams||[]).map((item,i)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))backupError("sınav kaydı geçersiz.");
    const label="Sınav "+(i+1);
    if(!subjectIds.has(item.subjectId))backupError(label+" geçerli bir derse bağlı değil.");
    if(item.topicIds!=null&&!Array.isArray(item.topicIds))backupError(label+" konu listesi geçersiz.");
    const topicIds=(item.topicIds??[]).map(id=>{
      backupId(id,label+" konu");
      if(!topicMap.has(id)||topicMap.get(id).subjectId!==item.subjectId)backupError(label+" başka derse ait veya bulunmayan bir konuya bağlı.");
      return id;
    });
    if(new Set(topicIds).size!==topicIds.length)backupError(label+" içinde yinelenen konu var.");
    const time=backupText(item.time,label+" saati",5,true);
    if(time&&! /^([01]\d|2[0-3]):[0-5]\d$/.test(time))backupError(label+" saati geçersiz.");
    return {...item,id:uniqueId(item.id,label),subjectId:item.subjectId,
      title:backupText(item.title,label+" başlığı",100),date:backupDay(item.date,label+" tarihi"),
      time,importance:backupInt(item.importance,label+" önemi",1,3),
      targetGrade:backupText(item.targetGrade,label+" hedef notu",10,true),
      notes:backupText(item.notes,label+" notu",5000,true),topicIds};
  });
  result.tasks=(input.tasks||[]).map((item,i)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))backupError("görev kaydı geçersiz.");
    const label="Görev "+(i+1),subjectId=item.subjectId??null,topicId=item.topicId??null;
    if(subjectId!==null&&!subjectIds.has(subjectId))backupError(label+" geçerli bir derse bağlı değil.");
    if(topicId!==null){
      const topic=topicMap.get(topicId);
      if(!topic||subjectId!==topic.subjectId)backupError(label+" konu/derse ilişkisi geçersiz.");
    }
    const status=backupText(item.status,label+" durumu",20);
    if(!["planli","tamam","iptal"].includes(status))backupError(label+" durumu tanınmıyor.");
    const type=backupText(item.type,label+" türü",30);
    if(!Object.prototype.hasOwnProperty.call(SESSION_TYPES,type))backupError(label+" türü tanınmıyor.");
    return {...item,id:uniqueId(item.id,label),subjectId,topicId,
      title:backupText(item.title,label+" başlığı",120),date:backupDay(item.date,label+" tarihi",true),
      estMinutes:backupInt(item.estMinutes,label+" tahmini süre",5,480),
      priority:backupInt(item.priority,label+" önceliği",1,3),status,type,
      createdAt:backupDay(item.createdAt,label+" oluşturulma tarihi",true)};
  });
  result.sessions=input.sessions.map((item,i)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))backupError("oturum kaydı geçersiz.");
    const label="Oturum "+(i+1),type=backupText(item.type,label+" türü",30);
    if(!Object.prototype.hasOwnProperty.call(SESSION_TYPES,type))backupError(label+" türü tanınmıyor.");
    const qAttempted=backupInt(item.qAttempted??0,label+" soru sayısı",0,1000000000);
    const qCorrect=backupInt(item.qCorrect??0,label+" doğru sayısı",0,1000000000);
    if(qCorrect>qAttempted)backupError(label+" doğru sayısı soru sayısından fazla.");
    if(item.demo!=null&&typeof item.demo!=="boolean")backupError(label+" demo işareti geçersiz.");
    return {...item,id:uniqueId(item.id,label),subjectId:backupId(item.subjectId,label+" ders"),
      topicId:item.topicId==null?null:backupId(item.topicId,label+" konu"),type,
      startedAt:backupTimestamp(item.startedAt,label+" başlangıcı"),
      endedAt:backupTimestamp(item.endedAt,label+" bitişi"),
      elapsedMs:backupInt(item.elapsedMs,label+" süresi",0,864000000),
      plannedMin:backupInt(item.plannedMin,label+" planlı süresi",0,480,true),
      qAttempted,qCorrect,notes:backupText(item.notes,label+" notu",5000,true),
      subjectName:backupText(item.subjectName,label+" ders adı",50,true),demo:item.demo??false};
  });
  result.reviewLog=(input.reviewLog||[]).map((item,i)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))backupError("tekrar kaydı geçersiz.");
    const label="Tekrar "+(i+1),feedback=backupText(item.feedback,label+" geri bildirimi",30);
    if(!Object.prototype.hasOwnProperty.call(FEEDBACK,feedback))backupError(label+" geri bildirimi tanınmıyor.");
    return {...item,id:uniqueId(item.id,label),topicId:backupId(item.topicId,label+" konu"),
      date:backupDay(item.date,label+" tarihi"),feedback};
  });
  const settings=input.settings??{};
  if(!settings||typeof settings!=="object"||Array.isArray(settings))backupError("ayarlar geçersiz.");
  for(const [key,allowed] of [["theme",["dark","light"]],["dateStyle",["uzun","kısa"]]])
    if(settings[key]!=null&&!allowed.includes(settings[key]))backupError(key+" ayarı geçersiz.");
  if(settings.weekStart!=null&&![0,1].includes(settings.weekStart))backupError("hafta başlangıcı geçersiz.");
  for(const key of ["studyDays","restDays"])
    if(settings[key]!=null&&(!Array.isArray(settings[key])||settings[key].some(d=>!Number.isInteger(d)||d<0||d>6)))
      backupError(key+" listesi geçersiz.");
  for(const [key,min,max] of [["dailyTargetMin",15,720],["dailyMaxMin",30,900],
    ["sessionLen",10,180],["breakLen",0,60],["examWarnDays",1,30]])
    if(settings[key]!=null)backupInt(settings[key],key,min,max);
  if(settings.name!=null)backupText(settings.name,"profil adı",30);
  if(settings.demoActive!=null&&typeof settings.demoActive!=="boolean")backupError("demo durumu geçersiz.");
  result.settings={...defaultSettings(),...settings};
  const qVersion=input.questionStatsVersion??0;
  if(!Number.isInteger(qVersion)||qVersion<0||qVersion>QUESTION_STATS_VERSION)backupError("soru istatistiği sürümü geçersiz.");
  result.questionStatsVersion=qVersion;
  if(input.activeSession!=null){
    const a=input.activeSession;
    if(typeof a!=="object"||Array.isArray(a))backupError("aktif oturum geçersiz.");
    const type=backupText(a.type,"aktif oturum türü",30);
    if(!Object.prototype.hasOwnProperty.call(SESSION_TYPES,type))backupError("aktif oturum türü tanınmıyor.");
    const startedAt=backupTimestampMs(a.startedAt,"aktif oturum başlangıcı");
    const accumulatedMs=backupInt(a.accumulatedMs??0,"aktif oturum birikmiş süresi",0,864000000);
    const pausedAt=a.pausedAt==null?null:backupTimestampMs(a.pausedAt,"aktif oturum duraklatma zamanı");
    const runningSince=a.runningSince==null?(pausedAt?null:startedAt):backupTimestampMs(a.runningSince,"aktif oturum çalışma başlangıcı");
    result.activeSession={...a,subjectId:backupId(a.subjectId,"aktif oturum dersi"),
      topicId:a.topicId==null?null:backupId(a.topicId,"aktif oturum konusu"),type,startedAt,
      accumulatedMs,pausedAt,runningSince,
      plannedMin:backupInt(a.plannedMin,"aktif oturum hedef süresi",0,480,true)};
  }
  return migrateQuestionStats(result);
}

/* ---------- 5) Genel durum ---------- */
let S=loadState();
lastSavedStateJSON=JSON.stringify(S);
const UI={route:"overview",topicQ:"",topicSubj:"all",topicStatus:"all",topicSort:"exam",topicSel:new Set(),
  calY:new Date().getFullYear(),calM:new Date().getMonth(),plannerView:"hafta",plannerDate:todayKey(),
  anaRange:"7",anaFrom:addDaysKey(todayKey(),-29),anaTo:todayKey(),anaSubj:"all",
  schoolScheduleRequest:0,schoolScheduleUrl:null,schoolScheduleSaving:false};

/* ---------- 6) Türetiler (hesaplamalar) ---------- */
const subjectById=id=>S.subjects.find(x=>x.id===id);
const topicById=id=>S.topics.find(x=>x.id===id);
const examById=id=>S.exams.find(x=>x.id===id);
const subjName=id=>{const s=subjectById(id);return s?s.name:null;};
function sessionsOfSubject(sid){return S.sessions.filter(x=>x.subjectId===sid);}
function subjectStats(sid){
  const topics=S.topics.filter(t=>t.subjectId===sid);
  const done=topics.filter(t=>t.status==="ogrenildi").length;
  const sess=sessionsOfSubject(sid);
  const totalMin=Math.round(sess.reduce((a,s)=>a+(s.elapsedMs||0),0)/60000);
  const qa=sess.reduce((a,s)=>a+(s.qAttempted||0),0), qc=sess.reduce((a,s)=>a+(s.qCorrect||0),0);
  const lastSess=sess.length?sess.reduce((a,s)=>s.startedAt>a.startedAt?s:a):null;
  const lastDay=lastSess?dayKey(new Date(lastSess.startedAt)):null;
  const ex=S.exams.filter(e=>e.subjectId===sid&&e.date>=todayKey()).sort((a,b)=>a.date<b.date?-1:1)[0]||null;
  return{topics,done,totalMin,qa,qc,lastDay,accuracy:pct(qc,qa),nextExam:ex};
}
function topicPrep(t){ // Açıklanabilir tahmin: durum %40, öz-güven %30, doğruluk %30 (veri yoksa yeniden dağıtılır)
  const sw={baslanmadi:0,calisiliyor:.45,tekrar:.6,ogrenildi:.95}[t.status]||0;
  const cf=(clampNum(t.confidence,1,5)-1)/4;
  const topicSessions=S.sessions.filter(s=>s.topicId===t.id);
  const qa=(t.qAttempted||0)+topicSessions.reduce((a,s)=>a+(s.qAttempted||0),0);
  const qc=(t.qCorrect||0)+topicSessions.reduce((a,s)=>a+(s.qCorrect||0),0);
  const acc=qa>0?qc/qa:null;
  const score= acc==null? sw*.55+cf*.45 : sw*.4+cf*.3+acc*.3;
  return{score:Math.round(score*100),qa,qc,acc};
}
const clampNum=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||a));
function examTopicIds(ex){
  if(Array.isArray(ex.topicIds))return ex.topicIds;
  return ex.topicIds==null?[]:null;
}
function examPrep(ex){
  const topicIds=examTopicIds(ex);
  if(!topicIds)return null;
  const ts=topicIds.map(topicById).filter(Boolean);
  if(!ts.length)return null;
  return Math.round(ts.reduce((a,t)=>a+topicPrep(t).score,0)/ts.length);
}
function examIncomplete(ex){
  const topicIds=examTopicIds(ex);
  return topicIds?topicIds.map(topicById).filter(t=>t&&t.status!=="ogrenildi"):null;
}
function examEstimate(ex){ // Kapsamdaki eksik konuların kalan tahmini (dakika)
  const inc=examIncomplete(ex);
  if(!inc)return null;
  if(!inc.length)return 0;
  return inc.reduce((a,t)=>a+(Number(t.estMinutes)||60),0);
}
function examEst(ex){ return examEstimate(ex); }
function daysUntilExam(ex){ return daysBetween(todayKey(),ex.date); }
function dueReviews(){ return S.topics.filter(t=>t.nextReviewAt&&t.nextReviewAt<=todayKey()&&t.status!=="ogrenildi")
  .sort((a,b)=>a.nextReviewAt<b.nextReviewAt?-1:1); }
function upcomingReviews(){ return S.topics.filter(t=>t.nextReviewAt&&t.nextReviewAt>todayKey()&&t.nextReviewAt<=addDaysKey(todayKey(),7)); }
function strugglingTopics(){ // Son tekrarlarda üst üste zorlanan konular
  return S.topics.filter(t=>{ const log=S.reviewLog.filter(r=>r.topicId===t.id).slice(-3);
    return log.length>=2&&log.filter(r=>r.feedback!=="kolay").length>=2; });
}
function tasksForDay(key){ return S.tasks.filter(x=>x.date===key&&x.status!=="iptal").sort((a,b)=>a.priority-b.priority); }
function unscheduledTasks(){ return S.tasks.filter(x=>!x.date&&x.status!=="iptal").sort((a,b)=>a.priority-b.priority); }
function anaRangeStart(){
  if(UI.anaRange==="7")return addDaysKey(todayKey(),-6);
  if(UI.anaRange==="30")return addDaysKey(todayKey(),-29);
  if(UI.anaRange==="all")return "0000-01-01";
  return UI.anaFrom;
}
function sessionsInRange(){ const a=anaRangeStart(),b=UI.anaRange==="custom"?UI.anaTo:todayKey();
  return S.sessions.filter(s=>{const k=dayKey(new Date(s.startedAt));return k>=a&&k<=b;}); }

/* ---------- 7) Öneri motoru (kural tabanlı, veriye dayalı) ---------- */
/* Arayüz notu: Recommendations.generate(state) saf bir fonksiyondur; ileride isteğe bağlı bir
   sağlayıcı (plan rafine etme, hata açıklama vb.) aynı imzayla beslenebilir. Sağlayıcı yoksa
   uygulama bu kural tabanlı motorla eksiksiz çalışır. Hiçbir metin uydurma veriye dayanmaz. */
const Recommendations={
  generate(){
    const out=[],t=todayKey();
    // 1) Yaklaşan sınav + eksik konu
    for(const ex of S.exams.filter(e=>e.date>=t).sort((a,b)=>a.date<b.date?-1:1).slice(0,3)){
      const dl=daysUntilExam(ex),inc=examIncomplete(ex);
      if(inc&&inc.length&&dl<=14) out.push({icon:"alarm-clock",text:`${subjName(ex.subjectId)} sınavına ${dl===0?"bugün":dl+" gün"} kaldı ve ${inc.length} konu henüz tamamlanmadı.`,
        act:{label:"Konuları gör",route:"subjects"}});
      const est=examEst(ex), avail=dl*S.settings.dailyTargetMin;
      if(est>avail&&dl>=0) out.push({icon:"alert-triangle",danger:true,text:`${subjName(ex.subjectId)} sınavı için tahmini kalan çalışma (${fmtDur(est)}), mevcut süre hedefine göre fazla görünüyor. Konuları öncelik sırasına dizmayı düşün.`,act:{label:"Planla",route:"planner"}});
    }
    // 2) Gecikmiş tekrarlar
    const od=dueReviews().filter(r=>r.nextReviewAt<t);
    if(od.length) out.push({icon:"rotate-ccw",text:`${od.length} tekrarın gecikmiş. Kısa tekrarlar bile eksikleri kapatmak için etkilidir.`,act:{label:"Tekrar Merkezi",route:"review"}});
    // 3) Bugünün planı sınırı aşıyor mu
    const today=tasksForDay(t), planMin=today.filter(x=>x.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0);
    if(planMin>S.settings.dailyMaxMin) out.push({icon:"gauge",danger:true,text:`Bugünün planı (${fmtDur(planMin)}) günlük çalışma sınırını (${fmtDur(S.settings.dailyMaxMin)}) aşıyor. Düşük önceliklileri ileri taşıyabilirsin.`,act:{label:"Planı aç",route:"planner"}});
    // 4) Düşük doğruluk (yeterli örneklemde)
    for(const s of S.subjects){
      const st=subjectStats(s.id);
      if(st.qa>=10&&st.accuracy!==null&&st.accuracy<50)
        out.push({icon:"target",text:`${s.name}: ${st.qa} soruda doğruluk %${st.accuracy}. Konuyu baştan özetleyip kolay sorulardan başlamak işe yarayabilir.`});
    }
    // 5) Bugün oturum yok + görev var
    const todaySess=S.sessions.some(x=>dayKey(new Date(x.startedAt))===t);
    if(!todaySess&&today.length) out.push({icon:"play",text:`Bugün henüz kayıtlı oturum yok. İlk görevle kısa bir oturum başlatmak günü rayına oturtur.`});
    // 6) Tamamlanan tekrarlar → zamanı başka derse kaydır önerisi
    if(!dueReviews().length&&S.topics.some(x=>x.nextReviewAt))
      out.push({icon:"check-circle-2",text:`Planlanan tekrarların hepsi tamam. Kalan zamanı en yakın sınavının dersine ayırmayı düşünebilirsin.`});
    // 7) Hiç veri yoksa dürüst başlangıç önerisi
    if(!S.sessions.length&&!out.length)
      out.push({icon:"sparkles",text:`Henüz kayıtlı oturum yok. Bir ders seçip 25 dakikalık kısa bir oturumla başlamak için yeterli.`});
    return out.slice(0,6);
  }
};

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
function closeModal(){ $("#modal-root").innerHTML=""; if(modalKeydown){document.removeEventListener("keydown",modalKeydown);modalKeydown=null;} }
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
  overview:{t:"Genel Bakış",i:"layout-dashboard",render:renderOverview},
  "school-schedule":{t:"Okul Programı",i:"calendar-days",render:renderSchoolSchedule},
  subjects:{t:"Dersler ve Konular",i:"library",render:renderSubjects},
  planner:{t:"Çalışma Planı",i:"calendar-range",render:renderPlanner},
  exams:{t:"Sınav Takvimi",i:"calendar-days",render:renderExams},
  sessions:{t:"Çalışma Oturumları",i:"timer",render:renderSessions},
  analytics:{t:"İlerleme Analizi",i:"bar-chart-3",render:renderAnalytics},
  review:{t:"Tekrar Merkezi",i:"rotate-ccw",render:renderReview},
  settings:{t:"Ayarlar ve Veri",i:"settings",render:renderSettings},
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

/* ---------- 10) Bölüm: Genel Bakış ---------- */
function greeting(){ const h=new Date().getHours();
  const g=h<6?"İyi geceler":h<12?"Günaydın":h<18?"İyi günler":"İyi akşamlar";
  return S.settings.name?`${g}, ${S.settings.name}`:g; }
function renderOverview(v){
  const t=todayKey();
  const exams=S.exams.filter(e=>e.date>=t).sort((a,b)=>a.date<b.date?-1:1);
  const today=tasksForDay(t);
  const planMin=today.filter(x=>x.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0);
  const wk=weekSummary();
  const recos=Recommendations.generate();
  const due=dueReviews();
  const overLimit=planMin>S.settings.dailyMaxMin;

  const examList= exams.length? exams.slice(0,4).map(ex=>{
    const topicIds=examTopicIds(ex),inc=examIncomplete(ex);
    const dl=daysUntilExam(ex),tot=topicIds?topicIds.length:0,incCount=inc?inc.length:0;
    const urgent=dl<=S.settings.examWarnDays&&dl>=0;
    return `<div class="exam-row">
      <div class="countdown" style="color:${urgent?"var(--danger)":"var(--text)"}">${dl===0?"Bugün":dl}<small>${dl===0?"sınav günü":dl===1?"1 gün kaldı":"gün kaldı"}</small></div>
      <div style="min-width:170px;flex:1">
        <div class="row"><b style="font-weight:600">${esc(ex.title)}</b>${urgent?'<span class="badge b-danger">Yakın</span>':""}</div>
        <div class="small muted">${esc(subjName(ex.subjectId)||"—")} · ${fmtShort(ex.date)}${ex.time?" · "+esc(ex.time):""} · ${ex.importance===1?'<span style="color:var(--danger)">Yüksek öneme</span>':"önemli"}</div>
      </div>
      <div class="small">${!topicIds?`<span class="badge b-danger">Kapsam verisi geçersiz</span>`:tot?`<span class="badge ${incCount?"b-warn":"b-ok"}">${tot-incCount}/${tot} konu hazır</span>`:`<span class="badge b-mut">Kapsam belirtilmemiş</span>`}</div>
      <button class="btn btn-sm" onclick="App.openExamDetail('${ex.id}')">Detay <i data-lucide="arrow-right"></i></button>
    </div>`;}).join("") :
    `<div class="empty"><i data-lucide="calendar-x"></i><b>Yaklaşan sınav yok</b><p>Sınav Takvimi bölümünden ekleyebilirsin. Geri sayımlar burada listelenir.</p></div>`;

  const taskList= today.length? today.map(taskRow).join("") :
    `<div class="empty"><i data-lucide="clipboard-check"></i><b>Bugün için görev yok</b><p>Planlanmamış görevleri bugüne alabilir ya da yeni bir görev ekleyebilirsin.</p></div>`;

  const subjList= S.subjects.filter(s=>!s.archived).length? S.subjects.filter(s=>!s.archived).map(s=>{
    const st=subjectStats(s.id); const p=st.topics.length?Math.round(st.done/st.topics.length*100):0;
    const lastTxt=st.lastDay?relDays(daysBetween(st.lastDay,t)):"hiç";
    return `<div class="subj-row">
      <span class="color-dot" style="background:${s.color}"></span>
      <span class="subj-name" style="min-width:110px">${esc(s.name)}</span>
      <span class="subj-meta">
        ${st.nextExam?`<span>Sınav: <b>${fmtShort(st.nextExam.date)}</b> · <b>${daysUntilExam(st.nextExam)} gün</b></span>`:""}
        <span>Konu: <b>${st.topics.length-st.done}/${st.topics.length}</b> eksik</span>
        <span>Süre: <b>${st.totalMin?fmtDur(st.totalMin):"—"}</b></span>
        ${st.qa>0?`<span>Doğruluk: <b>%${st.accuracy}</b> (${st.qa} soru)</span>`:""}
        <span>Son: <b>${lastTxt}</b></span>
      </span>
      <span class="sbar" title="Konu durumu: öğrenilen / toplam"><span style="width:${p}%;background:${s.color}"></span></span>
      <button class="btn btn-sm btn-ghost" onclick="App.gotoSubject('${s.id}')">Konular <i data-lucide="chevron-right"></i></button>
    </div>`;}).join("") :
    `<div class="empty"><i data-lucide="library"></i><b>Henüz ders eklenmemiş</b><p>Dersler ve Konular bölümünden derslerini ekleyerek başla.</p></div>`;

  v.innerHTML=`
  <div class="page-head">
    <div><h1>${esc(greeting())}</h1><div class="sub">${fmtDay(t,S.settings.dateStyle)} · ${today.length?`bugün ${today.length} görev, tahmini ${fmtDur(planMin)}`:"bugün planlı görev yok"}${overLimit?` · <span style="color:var(--danger)">günlük sınır aşıyor</span>`:""}</div></div>
    <div class="head-actions">
      <button class="btn btn-primary" onclick="App.startSessionModal()"><i data-lucide="play"></i>Oturum başlat</button>
      <button class="btn" onclick="App.taskModal(null,'${t}')"><i data-lucide="plus"></i>Görev ekle</button>
    </div>
  </div>
  ${S.settings.demoActive?`<div class="card" style="margin-bottom:16px;padding:11px 16px;border-style:dashed"><div class="row small"><span class="badge b-demo">DEMO VERİSİ</span><span class="muted">Uygulama örnek kayıtlarla başladı; bunlar gerçek ilerlemen değil. Ayarlar → Veri Yönetimi'nden temizleyebilirsin.</span></div></div>`:""}
  <div class="dash">
    <div class="stack">
      <div class="card"><h3><i data-lucide="alarm-clock"></i>Yaklaşan sınavlar</h3>${examList}
        <div style="margin-top:10px"><button class="btn btn-sm btn-ghost" onclick="setRoute('exams')">Tüm sınavlar <i data-lucide="arrow-right"></i></button></div></div>
      <div class="card"><h3><i data-lucide="list-todo"></i>Bugünün planı ${today.length?`<span class="badge b-mut">${fmtDur(planMin)} tahmini</span>`:""}</h3>
        ${taskList}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-sm" onclick="App.taskModal(null,'${t}')"><i data-lucide="plus"></i>Bugüne görev ekle</button>
          <button class="btn btn-sm btn-ghost" onclick="setRoute('planner')">Planı aç</button>
        </div></div>
      <div class="card"><h3><i data-lucide="library"></i>Derslerin durumu
        <span class="small muted" style="margin-left:auto;font-weight:400">Konu durumları, süre ve doğruluk gerçek kayıtlardan</span></h3>${subjList}</div>
    </div>
    <div class="stack">
      <div class="card"><h3><i data-lucide="lightbulb"></i>Şu an önerilen</h3>
        ${recos.length?recos.map(r=>`<div class="reco"><i data-lucide="${r.icon}" style="${r.danger?"color:var(--warn)":""}"></i><div class="rt">${esc(r.text)}${r.act?` <button class="btn btn-sm btn-ghost" style="padding:2px 8px" onclick="setRoute('${r.act.route}')">${esc(r.act.label)} →</button>`:""}</div></div>`).join(""):`<div class="empty" style="padding:14px"><p>Şu an için özel bir öneri yok.</p></div>`}
      </div>
      <div class="card"><h3><i data-lucide="zap"></i>Hızlı işlemler</h3>
        <div class="qa-grid">
          <button class="qa" onclick="App.taskModal()"><i data-lucide="plus"></i>Görev ekle</button>
          <button class="qa" onclick="App.topicModal()"><i data-lucide="book-plus"></i>Konu ekle</button>
          <button class="qa" onclick="App.examModal()"><i data-lucide="calendar-plus"></i>Sınav ekle</button>
          <button class="qa" onclick="App.startSessionModal()"><i data-lucide="play"></i>Oturum başlat</button>
          <button class="qa" onclick="App.logQuestionsModal()"><i data-lucide="target"></i>Soru kaydet</button>
          <button class="qa" onclick="setRoute('review')"><i data-lucide="rotate-ccw"></i>Tekrarlar${due.length?` (${due.length})`:""}</button>
        </div></div>
      <div class="card"><h3><i data-lucide="activity"></i>Son 7 gün</h3>
        <div class="stat-line"><span class="muted">Gerçek çalışma süresi</span><span class="v mono-num">${fmtDur(wk.totalMin)}</span></div>
        <div class="stat-line"><span class="muted">Tamamlanan oturum</span><span class="v mono-num">${wk.n}</span></div>
        <div class="stat-line"><span class="muted">Sorular (doğru / deneme)</span><span class="v mono-num">${wk.qc} / ${wk.qa}${wk.qa?` · %${pct(wk.qc,wk.qa)}`:""}</span></div>
        <div class="stat-line"><span class="muted">Görevler (tamam / planlı)</span><span class="v mono-num">${wk.doneTasks} / ${wk.totTasks}</span></div>
        <div class="stat-line" style="border:none;flex-direction:column;align-items:stretch;gap:0"><span class="muted" style="margin-bottom:2px">Çalışma tutarlılığı (7 günde ${wk.activeDays} gün)</span>
          <div class="wk-dots">${wk.days.map(d=>`<div class="wk-day"><div class="wk-bar${d.min?"":" zero"}" style="${d.min?`height:${Math.max(10,d.min/wk.maxMin*30)}px`:""}" title="${d.label}: ${d.min?fmtDur(d.min):"oturum yok"}"></div><span class="wk-lab">${d.s}</span></div>`).join("")}</div>
          <span class="help">Tutarlılık yalnızca kayıtlı oturum olan günleri sayar; öğrenme ölçüsü değildir.</span>
        </div>
        ${wk.hasDemo?`<span class="badge b-demo" style="margin-top:8px">DEMO oturumları dahil</span>`:""}
      </div>
    </div>
  </div>`;
}
function weekSummary(){
  const t=todayKey(); const from=addDaysKey(t,-6);
  const sess=S.sessions.filter(s=>{const k=dayKey(new Date(s.startedAt));return k>=from&&k<=t;});
  const days=[]; for(let i=6;i>=0;i--){const k=addDaysKey(t,-i);
    days.push({key:k,s:DAY_SHORT[parseDay(k).getDay()],label:fmtShort(k),min:Math.round(sess.filter(x=>dayKey(new Date(x.startedAt))===k).reduce((a,x)=>a+x.elapsedMs,0)/60000)});}
  const tasks=S.tasks.filter(x=>x.date>=from&&x.date<=t&&x.status!=="iptal");
  return{ totalMin:Math.round(sess.reduce((a,s)=>a+s.elapsedMs,0)/60000), n:sess.length,
    qa:sess.reduce((a,s)=>a+(s.qAttempted||0),0), qc:sess.reduce((a,s)=>a+(s.qCorrect||0),0),
    totTasks:tasks.length, doneTasks:tasks.filter(x=>x.status==="tamam").length,
    days, activeDays:days.filter(d=>d.min>0).length, maxMin:Math.max(30,...days.map(d=>d.min)),
    hasDemo:sess.some(s=>s.demo)};
}
function taskRow(tk){
  const t=topicById(tk.topicId);
  return `<div class="task ${tk.status==="tamam"?"done":""}">
    <button class="chk ${tk.status==="tamam"?"on":""}" onclick="App.toggleTask('${tk.id}')" aria-label="Görevi tamamlandı olarak işaretle"><i data-lucide="check"></i></button>
    ${prioDot(tk.priority)}
    <div style="min-width:150px;flex:1">
      <div class="t-title">${esc(tk.title)}</div>
      <div class="small muted">${esc(subjName(tk.subjectId)||"Genel")}${t?" · "+esc(t.title):""} · ${fmtDur(tk.estMinutes||0)} · ${esc(SESSION_TYPES[tk.type]||"Görev")}</div>
    </div>
    <div class="acts">
      ${tk.status==="tamam"?`<button class="btn btn-sm btn-ghost" onclick="App.toggleTask('${tk.id}')" title="Geri al"><i data-lucide="undo-2"></i></button>`:
      `<button class="btn btn-sm" onclick="App.startSessionForTask('${tk.id}')" title="Oturum başlat"><i data-lucide="play"></i></button>
       <button class="btn btn-sm btn-ghost" onclick="App.postponeTask('${tk.id}')" title="Ertele"><i data-lucide="calendar-clock"></i></button>`}
      <button class="btn btn-sm btn-ghost" onclick="App.taskModal('${tk.id}')" title="Düzenle"><i data-lucide="pencil"></i></button>
      <button class="btn btn-sm btn-ghost" onclick="App.deleteTask('${tk.id}')" title="Sil"><i data-lucide="trash-2"></i></button>
    </div></div>`;
}

/* ---------- 11) Bölüm: Dersler ve Konular ---------- */
function gotoSubject(id){ UI.topicSubj=id; UI.topicQ=""; setRoute("subjects"); }
function filteredTopics(){
  let list=S.topics.filter(t=>!t.parentId);
  if(UI.topicSubj!=="all")list=list.filter(t=>t.subjectId===UI.topicSubj);
  if(UI.topicStatus!=="all")list=list.filter(t=>t.status===UI.topicStatus);
  if(UI.topicQ){const q=UI.topicQ.toLowerCase();
    const matchAll=S.topics.filter(t=>(t.title+" "+(subjName(t.subjectId)||"")).toLowerCase().includes(q)).map(t=>t.id);
    list=list.filter(t=>matchAll.includes(t.id)||S.topics.some(x=>x.parentId===t.id&&matchAll.includes(x.id)));}
  const exBonus=t=>{const ex=S.exams.find(e=>{const ids=examTopicIds(e);return ids&&ids.includes(t.id);});return ex?daysUntilExam(ex):999;};
  const sorts={
    exam:(a,b)=>(a.examRelevance!==b.examRelevance?b.examRelevance-a.examRelevance:exBonus(a)-exBonus(b)),
    review:(a,b)=>((a.nextReviewAt||"9999")<(b.nextReviewAt||"9999")?-1:1),
    est:(a,b)=>(b.estMinutes||0)-(a.estMinutes||0),
    alpha:(a,b)=>a.title.localeCompare(b.title,"tr")};
  return list.sort(sorts[UI.topicSort]||sorts.exam);
}
function renderSubjects(v){
  const list=filteredTopics();
  const subjects=S.subjects.filter(s=>!s.archived);
  v.innerHTML=pageHead("Dersler ve Konular","Konu ekle, durumunu ve güvenini güncelle; tekrar tarihlerini planla",
    `<button class="btn" onclick="App.subjectModal()"><i data-lucide="plus"></i>Ders ekle</button><button class="btn btn-primary" onclick="App.topicModal()"><i data-lucide="book-plus"></i>Konu ekle</button>`)+
  `<div class="card" style="margin-bottom:16px">
    <div class="filters">
      <div class="row" style="flex:1;min-width:200px"><i data-lucide="search" style="color:var(--faint)"></i>
        <input id="topic-q" placeholder="Konu veya ders ara…" value="${esc(UI.topicQ)}" oninput="UI.topicQ=this.value;render()" style="border:none;background:transparent;padding:6px 2px" aria-label="Konu ara"></div>
      <select onchange="UI.topicSubj=this.value;render()" aria-label="Ders filtresi" style="width:auto">
        <option value="all">Tüm dersler</option>
        ${subjects.map(s=>`<option value="${s.id}" ${UI.topicSubj===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>
      <select onchange="UI.topicStatus=this.value;render()" aria-label="Durum filtresi" style="width:auto">
        <option value="all">Tüm durumlar</option>
        ${Object.entries(TOPIC_STATUS).map(([k,l])=>`<option value="${k}" ${UI.topicStatus===k?"selected":""}>${l}</option>`).join("")}</select>
      <select onchange="UI.topicSort=this.value;render()" aria-label="Sıralama" style="width:auto">
        <option value="exam" ${UI.topicSort==="exam"?"selected":""}>Sınav önemine göre</option>
        <option value="review" ${UI.topicSort==="review"?"selected":""}>Tekrar tarihine göre</option>
        <option value="est" ${UI.topicSort==="est"?"selected":""}>Kalan süreye göre</option>
        <option value="alpha" ${UI.topicSort==="alpha"?"selected":""}>A→Z</option></select>
    </div>
    ${UI.topicSel.size?`<div class="row" style="margin-top:10px"><span class="small muted">${UI.topicSel.size} konu seçildi</span>
      <select id="bulk-st" style="width:auto" aria-label="Toplu durum"><option value="">Durumu değiştir…</option>${Object.entries(TOPIC_STATUS).map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select>
      <button class="btn btn-sm" onclick="App.bulkStatus()">Uygula</button>
      <button class="btn btn-sm btn-ghost" onclick="UI.topicSel.clear();render()">Seçimi bırak</button></div>`:""}
  </div>
  <div class="card">
    ${list.length? list.map(t=>{
      const subs=S.topics.filter(x=>x.parentId===t.id);
      const p=topicPrep(t);
      return `<div class="topic-row">
        <input type="checkbox" ${UI.topicSel.has(t.id)?"checked":""} onchange="App.selTopic('${t.id}')" aria-label="Konuyu seç" style="width:15px;height:15px">
        <button class="chk ${t.status==="ogrenildi"?"on":""}" style="cursor:default" title="${TOPIC_STATUS[t.status]}" onclick="App.topicDetail('${t.id}')"><i data-lucide="check"></i></button>
        <div style="flex:1;min-width:180px;cursor:pointer" onclick="App.topicDetail('${t.id}')">
          <div class="row"><span class="top-title">${esc(t.title)}</span>
            ${t.examRelevance===3?'<span class="badge b-danger">Sınav için kritik</span>':t.examRelevance===2?'<span class="badge b-warn">Sınavda çıkabilir</span>':""}
            ${t.nextReviewAt&&t.nextReviewAt<=todayKey()?'<span class="badge b-warn">Tekrarı gecikmiş</span>':""}</div>
          <div class="small muted">${esc(subjName(t.subjectId)||"—")} · kalan tahmin ${fmtDur(t.estMinutes||60)} · son çalışma ${t.lastStudiedAt?relDays(daysBetween(t.lastStudiedAt,todayKey())):"yok"}</div>
          ${subs.length?`<div class="subtopics">${subs.map(s=>`<div class="small row" style="padding:3px 0"><i data-lucide="corner-down-right" style="width:12px;height:12px;color:var(--faint)"></i><span style="cursor:pointer" onclick="App.topicDetail('${s.id}');event.stopPropagation()">${esc(s.title)}</span> ${statusBadge(s.status)}</div>`).join("")}</div>`:""}
        </div>
        <span class="conf-stars" title="Öz-güven: ${t.confidence}/5">${[1,2,3,4,5].map(i=>`<i data-lucide="star" style="color:${i<=t.confidence?"var(--warn)":"var(--border2)"};fill:${i<=t.confidityCouldFix}",opacity:${i<=(t.confidence||1)?1:.35}"></i>`).join("")}</span>
        ${statusBadge(t.status)}
        <button class="btn btn-sm btn-ghost" onclick="App.topicModal(null,'${t.subjectId}','${t.id}')" title="Alt konu ekle"><i data-lucide="git-branch"></i></button>
        <button class="btn btn-sm btn-ghost" onclick="App.topicModal('${t.id}')" title="Düzenle"><i data-lucide="pencil"></i></button>
      </div>`;}).join("") :
    `<div class="empty"><i data-lucide="book-open"></i><b>Konu bulunamadı</b><p>${S.topics.length?"Filtreleri değiştirmeyi dene ya da yeni bir konu ekle.":"İlk konunu ekleyerek başla; ister alt konularla böl."}</p></div>`}
  </div>`;
}

/* ---------- 12) Bölüm: Çalışma Planı ---------- */
function renderPlanner(v){
  const ws=S.settings.weekStart;
  const base=parseDay(UI.plannerDate);
  const dow=(base.getDay()-ws+7)%7;
  const weekStartKey=addDaysKey(UI.plannerDate,-dow);
  const maxMin=S.settings.dailyMaxMin;
  const dayCol=key=>{
    const items=tasksForDay(key);
    const min=items.filter(x=>x.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0);
    const isRest=S.settings.restDays.includes(parseDay(key).getDay());
    const over=min>maxMin;
    return `<div class="pday ${key===todayKey()?"today":""}">
      <div class="pd-head"><span>${DAY_SHORT[parseDay(key).getDay()]}${isRest?" · dinlenme":""}</span><b>${parseDay(key).getDate()}</b></div>
      <div class="small" style="color:${over?"var(--danger)":"var(--faint)"}">${min?fmtDur(min):"—"}${over?" · sınır aşılıyor":""}</div>
      ${items.map(x=>`<button class="pmini ${x.status==="tamam"?"done":""}" onclick="App.taskModal('${x.id}')" title="Düzenle: ${esc(x.title)}">${esc(x.title)}</button>`).join("")}
      <button class="pmini" style="border-style:dashed;color:var(--muted);background:transparent" onclick="App.taskModal(null,'${key}')">+ görev</button>
    </div>`;};
  const week=[]; for(let i=0;i<7;i++)week.push(addDaysKey(weekStartKey,i));
  const uns=unscheduledTasks();
  const dayTasks= tasksForDay(UI.plannerDate);
  v.innerHTML=pageHead("Çalışma Planı","Haftalık veya günlük görünüm; görevleri taşı, ötele, tamamla",
    `<div class="seg"><button class="${UI.plannerView==="hafta"?"on":""}" onclick="UI.plannerView='hafta';render()">Hafta</button><button class="${UI.plannerView==="gun"?"on":""}" onclick="UI.plannerView='gun';render()">Gün</button></div>
     <button class="btn" onclick="App.taskModal()"><i data-lucide="plus"></i>Görev ekle</button>`)+
  `<div class="row" style="margin-bottom:14px">
    <button class="btn btn-sm btn-icon" onclick="App.shiftPlan(-7)" aria-label="Önceki hafta"><i data-lucide="chevron-left"></i></button>
    <input type="date" value="${UI.plannerDate}" onchange="UI.plannerDate=this.value||todayKey();render()" aria-label="Plan tarihi" style="width:auto">
    <button class="btn btn-sm btn-icon" onclick="App.shiftPlan(7)" aria-label="Sonraki hafta"><i data-lucide="chevron-right"></i></button>
    <button class="btn btn-sm btn-ghost" onclick="UI.plannerDate=todayKey();render()">Bugün</button>
  </div>
  ${UI.plannerView==="hafta"? `<div style="overflow-x:auto;padding-bottom:4px"><div class="planner" style="min-width:840px">${week.map(dayCol).join("")}</div></div>`:
  `<div class="dash"><div class="stack"><div class="card"><h3><i data-lucide="list-todo"></i>${fmtDay(UI.plannerDate,"uzun")} · ${dayTasks.filter(t=>t.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0)} dk planlı</h3>
    ${dayTasks.length?dayTasks.map(taskRow).join(""):`<div class="empty"><i data-lucide="coffee"></i><b>Bu gün boş</b><p>Dinlenme günü olarak bırakabilir ya da görev ekleyebilirsin.</p></div>`}</div></div>
    <div class="card"><h3><i data-lucide="inbox"></i>Planlanmamış görevler</h3>${unschedHtml(uns)}</div></div>`}
  ${UI.plannerView==="hafta"?`<div class="card" style="margin-top:16px"><h3><i data-lucide="inbox"></i>Planlanmamış görevler</h3>${unschedHtml(uns)}</div>`:""}`;
}
function unschedHtml(uns){
  return uns.length? uns.map(tk=>`<div class="task"><span class="badge b-warn">Tarihsiz</span>
    <div style="flex:1;min-width:150px"><div class="t-title">${esc(tk.title)}</div>
    <div class="small muted">${esc(subjName(tk.subjectId)||"Genel")} · ${fmtDur(tk.estMinutes||0)} · ${PRIOS[tk.priority].l} öncelik</div></div>
    <div class="acts"><button class="btn btn-sm" onclick="App.postponeTask('${tk.id}')"><i data-lucide="calendar-plus"></i>Tarihlendir</button>
    <button class="btn btn-sm btn-ghost" onclick="App.taskModal('${tk.id}')"><i data-lucide="pencil"></i></button>
    <button class="btn btn-sm btn-ghost" onclick="App.deleteTask('${tk.id}')"><i data-lucide="trash-2"></i></button></div></div>`).join("")
  :`<div class="empty" style="padding:16px"><p>Planlanmamış görev yok. Her şey yerli yerinde.</p></div>`;
}
function shiftPlan(n){ UI.plannerDate=addDaysKey(UI.plannerDate,n); render(); }

/* ---------- 13) Bölüm: Sınav Takvimi ---------- */
function renderExams(v){
  const now=todayKey();
  const up=S.exams.filter(e=>e.date>=now).sort((a,b)=>a.date<b.date?-1:1);
  const past=S.exams.filter(e=>e.date<now).sort((a,b)=>a.date<b.date?-1:1).slice(-5).reverse();
  const cal=renderCalendar();
  v.innerHTML=pageHead("Sınav Takvimi","Tarihler tamamen sana ait; geri sayımlar gerçek tarihlerden hesaplanır",
    `<button class="btn btn-primary" onclick="App.examModal()"><i data-lucide="calendar-plus"></i>Sınav ekle</button>`)+
  `<div class="dash"><div class="stack">
    <div class="card"><h3><i data-lucide="alarm-clock"></i>Yaklaşan sınavlar</h3>
    ${up.length? up.map(ex=>{
      const topicIds=examTopicIds(ex),inc=examIncomplete(ex);
      const dl=daysUntilExam(ex),tot=topicIds?topicIds.length:0,incCount=inc?inc.length:0,est=examEst(ex);
      const feas=dl>=0&&est!==null&&est>dl*S.settings.dailyTargetMin;
      return `<div class="exam-row">
        <div class="countdown" style="color:${dl<=S.settings.examWarnDays?"var(--danger)":"var(--text)"}">${dl}<small>${dl===1?"1 gün kaldı":dl===0?"bugün":"gün kaldı"}</small></div>
        <div style="flex:1;min-width:170px"><div class="row"><b>${esc(ex.title)}</b>${ex.importance===1?'<span class="badge b-danger">Yüksek öneme</span>':ex.importance===2?'<span class="badge b-warn">Orta öneme</span>':''}</div>
        <div class="small muted">${esc(subjName(ex.subjectId)||"—")} · ${fmtShort(ex.date)}${ex.time?" "+esc(ex.time):""}${ex.targetGrade?` · hedef ${esc(ex.targetGrade)}`:""}</div></div>
        <div class="small">${!topicIds?`<span class="badge b-danger">kapsam verisi geçersiz</span>`:tot?`<span class="badge ${incCount?"b-warn":"b-ok"}">${tot-incCount}/${tot} konu</span>`:`<span class="badge b-mut">kapsam yok</span>`}
        ${topicIds&&tot&&est?`<span class="badge ${feas?"b-danger":"b-info"}" title="Eksik konuların kalan tahmini">${feas?"Süre riskli":"tahmini "+fmtDur(est)}</span>`:""}</div>
        <button class="btn btn-sm" onclick="App.openExamDetail('${ex.id}')">Detay</button>
        <button class="btn btn-sm btn-ghost" onclick="App.examModal('${ex.id}')"><i data-lucide="pencil"></i></button>
        <button class="btn btn-sm btn-ghost" onclick="App.deleteExam('${ex.id}')"><i data-lucide="trash-2"></i></button>
      </div>`;}).join("") : `<div class="empty"><i data-lucide="calendar-x"></i><b>Yaklaşan sınav yok</b><p>Bir sınav ekle; kalan gün, eksik konu ve süre uygunluğu otomatik hesaplanır.</p></div>`}</div>
    ${past.length?`<div class="card"><h3><i data-lucide="history"></i>Geçmiş sınavlar</h3>${past.map(ex=>`<div class="sess-row"><span class="badge b-mut">Geçti</span><b style="font-weight:500">${esc(ex.title)}</b><span class="small muted">${esc(subjName(ex.subjectId)||"—")} · ${fmtShort(ex.date)}</span>
      <div class="acts" style="margin-left:auto"><button class="btn btn-sm btn-ghost" onclick="App.openExamDetail('${ex.id}')">Detay</button></div></div>`).join("")}</div>`:""}
  </div>
  <div class="stack"><div class="card"><h3><i data-lucide="calendar-days"></i>Takvim</h3>${cal}</div>
  <div class="card"><h3><i data-lucide="info"></i>Nasıl çalışır?</h3><p class="small muted" style="line-height:1.6">Sınav kapsamını sen belirlediğin için eksik konu sayısı yalnızca seçtiğin konulardan hesaplanır. "Süre riskli" etiketi, eksik konuların tahmini kalan süresinin kalan gün × günlük süre hedefini aşması durumunda görünür — bu bir tahmindir, garanti değildir.</p></div></div></div>`;
}
function renderCalendar(){
  const y=UI.calY,m=UI.calM;
  const first=new Date(y,m,1); const startDow=(first.getDay()-S.settings.weekStart+7)%7;
  const dim=new Date(y,m+1,0).getDate(); const prevDim=new Date(y,m,0).getDate();
  const monthName=first.toLocaleDateString("tr-TR",{month:"long",year:"numeric"});
  const head=[...Array(7)].map((_,i)=>DAY_SHORT[(i+S.settings.weekStart)%7]);
  let cells="";
  for(let i=0;i<42;i++){
    let dNum,out=false,dk;
    if(i<startDow){dNum=prevDim-startDow+1+i;out=true;dk=null;}
    else if(i-startDow+1>dim){dNum=i-startDow+1-dim;out=true;dk=null;}
    else{dNum=i-startDow+1;dk=dayKey(new Date(y,m,dNum));}
    const evs=dk?S.exams.filter(e=>e.date===dk):[];
    cells+=`<div class="cal-cell ${out?"out":""} ${dk===todayKey()?"today":""}">
      <span class="cdn">${dNum}</span>
      ${evs.map(e=>`<button class="cal-ev" onclick="App.openExamDetail('${e.id}')" title="${esc(e.title)}">${esc(subjName(e.subjectId)||"")}</button>`).join("")}
    </div>`;
  }
  return `<div class="spread" style="margin-bottom:10px">
    <button class="btn btn-sm btn-icon" onclick="App.calNav(-1)" aria-label="Önceki ay"><i data-lucide="chevron-left"></i></button>
    <b style="font-family:var(--font-head);text-transform:capitalize">${monthName}</b>
    <button class="btn btn-sm btn-icon" onclick="App.calNav(1)" aria-label="Sonraki ay"><i data-lucide="chevron-right"></i></button></div>
    <div class="cal-grid" style="margin-bottom:4px">${head.map(h=>`<div class="small faint" style="text-align:center;padding:3px 0">${h}</div>`).join("")}</div>
    <div class="cal-grid">${cells}</div>`;
}
function calNav(n){ UI.calM+=n; if(UI.calM<0){UI.calM=11;UI.calY--;} if(UI.calM>11){UI.calM=0;UI.calY++;} render(); }

/* ---------- 14) Bölüm: Çalışma Oturumları ---------- */
function renderSessions(v){
  const list=[...S.sessions].sort((a,b)=>b.startedAt<a.startedAt?-1:1).slice(0,60);
  const week=weekSummary();
  v.innerHTML=pageHead("Çalışma Oturumları","Zaman damgası tabanlı kronometre; sayfa yenilense bile oturum kaybolmaz",
    `<button class="btn" onclick="App.manualSessionModal()"><i data-lucide="keyboard"></i>Elle giriş</button>
     <button class="btn btn-primary" onclick="App.startSessionModal()"><i data-lucide="play"></i>Oturum başlat</button>`)+
  `<div class="card" style="margin-bottom:16px"><div class="row">
    <i data-lucide="activity" style="color:var(--accent)"></i>
    <span>Bu hafta: <b>${fmtDur(week.totalMin)}</b> gerçek çalışma · ${week.n} oturum</span>
    ${week.hasDemo?'<span class="badge b-demo">DEMO oturumları dahil</span>':""}
    <span class="small muted" style="margin-left:auto">Süre, duraklatmalar hariç geçen süredir.</span></div></div>
  <div class="card">
    ${list.length? list.map(s=>{
      const t=topicById(s.topicId);
      return `<div class="sess-row">
        <span class="badge ${s.demo?"b-demo":"b-mut"}">${s.demo?"DEMO":esc(SESSION_TYPES[s.type]||s.type)}</span>
        <div style="flex:1;min-width:170px"><b style="font-weight:500">${esc(subjName(s.subjectId)||"—")}${t?" · "+esc(t.title):""}</b>
          <div class="small muted">${fmtShort(dayKey(new Date(s.startedAt)))} · ${new Date(s.startedAt).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}–${s.endedAt?new Date(s.endedAt).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}):""}</div>
          ${s.notes?`<div class="small muted" style="margin-top:2px">“${esc(s.notes)}”</div>`:""}</div>
        <span class="mono-num" style="font-weight:600">${fmtDur(Math.round((s.elapsedMs||0)/60000))}</span>
        ${s.qAttempted?`<span class="badge b-info">${s.qCorrect}/${s.qAttempted} doğru · %${pct(s.qCorrect,s.qAttempted)}</span>`:""}
        <button class="btn btn-sm btn-ghost" onclick="App.deleteSession('${s.id}')" title="Kaydı sil"><i data-lucide="trash-2"></i></button>
      </div>`;}).join("") :
    `<div class="empty"><i data-lucide="timer"></i><b>Kayıtlı oturum yok</b><p>Kronometreyle ya da elle giriş yaparak ilk oturumunu kaydet. Yalnızca kaydedilen oturumlar istatistiklerde sayılır.</p></div>`}
  </div>`;
}
function renderLiveBar(){
  const old=$("#live-bar"); if(old)old.remove();
  const a=S.activeSession; if(!a)return;
  const paused=!!a.pausedAt;
  const bar=document.createElement("div"); bar.id="live-bar";
  bar.innerHTML=`<span class="pulse ${paused?"paused":""}"></span>
    <div style="min-width:130px"><b style="font-weight:600">${esc(subjName(a.subjectId)||"—")}</b>
    <div class="small muted">${esc(SESSION_TYPES[a.type]||"")}${a.topicId?" · "+esc(topicById(a.topicId)?.title||""):""}</div></div>
    <span id="live-timer">${fmtClock(activeElapsed())}</span>
    <button class="btn btn-sm" onclick="App.togglePause()"><i data-lucide="${paused?"play":"pause"}"></i>${paused?"Devam":"Duraklat"}</button>
    <button class="btn btn-sm btn-primary" onclick="App.finishSessionModal()"><i data-lucide="square"></i>Bitir</button>
    <button class="btn btn-sm btn-ghost" onclick="App.cancelActive()" title="Oturumu iptal et"><i data-lucide="x"></i></button>`;
  document.body.appendChild(bar); lucide.createIcons();
}
function activeElapsed(){ const a=S.activeSession; if(!a)return 0;
  return (a.accumulatedMs||0)+(a.pausedAt?0:Date.now()-(a.runningSince||a.startedAt)); }
setInterval(()=>{ const el=$("#live-timer"); if(el&&S.activeSession)el.textContent=fmtClock(activeElapsed()); },500);

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

/* ---------- 16) Bölüm: Tekrar Merkezi ---------- */
function renderReview(v){
  const due=dueReviews(),up=upcomingReviews(),strug=strugglingTopics();
  const revItem=(topic,late)=>{
    const overdue=topic.nextReviewAt<todayKey();
    return `<div class="rev-item">
      <span class="color-dot" style="background:${subjectById(topic.subjectId)?.color||"var(--faint)"}"></span>
      <div style="flex:1;min-width:160px"><b style="font-weight:500">${esc(topic.title)}</b>
        <div class="small muted">${esc(subjName(topic.subjectId)||"—")} · ${overdue?`<span style="color:var(--warn)">${daysBetween(topic.nextReviewAt,todayKey())} gün gecikmiş`:"bugün tekrar zamanı"}</div></div>
      ${statusBadge(topic.status)}
      <button class="btn btn-sm btn-primary" onclick="App.reviewModal('${topic.id}')"><i data-lucide="check"></i>Tekrarı yap</button>
      <button class="btn btn-sm btn-ghost" onclick="App.rescheduleReview('${topic.id}')" title="Tarihi değiştir"><i data-lucide="calendar-clock"></i></button>
    </div>`;};
  v.innerHTML=pageHead("Tekrar Merkezi","Hatırlama pratiği: notları açmadan önce hatırlamayı dene, sonra kendini test et",
    `<button class="btn" onclick="App.schedulePickModal()"><i data-lucide="calendar-plus"></i>Tekrar planla</button>`)+
  `<div class="dash"><div class="stack">
    <div class="card"><h3><i data-lucide="bell-ring"></i>Bugün ve gecikmiş tekrarlar</h3>
      ${due.length?due.map(tp=>revItem(tp,true)).join(""):`<div class="empty" style="padding:16px"><i data-lucide="check-circle-2"></i><p>Şu an bekleyen tekrar yok. Ara vermek de planın bir parçası.</p></div>`}</div>
    <div class="card"><h3><i data-lucide="flame"></i>Zorlandığın konular</h3>
      ${strug.length?strug.map(tp=>`<div class="rev-item"><span class="badge b-warn">Üst üste zor</span>
        <div style="flex:1"><b style="font-weight:500">${esc(tp.title)}</b><div class="small muted">${esc(subjName(tp.subjectId)||"—")} · son tekrarlarda "zordu/hatırlayamadım" işaretlendi</div></div>
        <button class="btn btn-sm" onclick="App.topicDetail('${tp.id}')">Konuyu aç</button></div>`).join("")
      :`<div class="empty" style="padding:16px"><p>Tekrarlarında zorlandığın olarak işaretlenen konu yok.</p></div>`}
      <div class="help">Bu liste yalnızca geri bildirimlerinden üretilir; uygulama neyi bildiğini doğrudan ölçemez.</div></div>
    <div class="card"><h3><i data-lucide="history"></i>Son tekrar kayıtları</h3>
      ${S.reviewLog.length?[...S.reviewLog].reverse().slice(0,8).map(r=>`<div class="sess-row">
        <span class="badge ${r.feedback==="kolay"?"b-ok":r.feedback==="zor"?"b-warn":"b-danger"}">${FEEDBACK[r.feedback]}</span>
        <span style="font-weight:500">${esc(topicById(r.topicId)?.title||"Silinmiş konu")}</span>
        <span class="small muted">${fmtShort(r.date)}</span></div>`).join(""):`<div class="empty" style="padding:16px"><p>Henüz tekrar kaydı yok.</p></div>`}</div>
  </div>
  <div class="stack">
    <div class="card"><h3><i data-lucide="calendar-check"></i>Yaklaşan tekrarlar (7 gün)</h3>
      ${up.length?up.map(tp=>`<div class="sess-row"><span class="badge b-info">${daysBetween(todayKey(),tp.nextReviewAt)} gün sonra</span>
        <span style="font-weight:500">${esc(tp.title)}</span><span class="small muted">${esc(subjName(tp.subjectId)||"—")}</span></div>`).join("")
      :`<div class="empty" style="padding:16px"><p>Önümüzdeki 7 günde planlı tekrar yok.</p></div>`}</div>
    <div class="card"><h3><i data-lucide="lightbulb"></i>Hatırlama pratiği ipuçları</h3>
      <ul class="small muted" style="line-height:1.7;padding-left:16px">
        <li>Notları açmadan önce konuyu <b>sessizce anlatmayı dene</b> — eksikler hemen görünür.</li>
        <li>Soruları çözümlere bakmadan çöz; yanlışları biriktirip <b>ayrı bir turda</b> tekrar ele al.</li>
        <li>Tekrardan sonra güven puanını yeniden değerlendir; test edilmeden yükseltme.</li>
      </ul>
      <div class="help">Aralık önerileri (1/3/7/14 gün) yaygın hatırlama pratiğinden esinlenen pratik değerlerdir; bilimsel garanti değildir, dilediğin gibi değiştirebilirsin.</div></div>
  </div></div>`;
}

/* ---------- 17) Bölüm: Ayarlar ---------- */
function renderSchoolSchedule(v){
  if(UI.schoolScheduleUrl){URL.revokeObjectURL(UI.schoolScheduleUrl);UI.schoolScheduleUrl=null;}
  const request=++UI.schoolScheduleRequest;
  v.innerHTML=pageHead("Okul Programı","Haftalık ders programı görselini bu tarayıcıda sakla")+
    `<input type="file" id="school-schedule-file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onchange="App.uploadSchoolSchedule(this)">
    <div class="card" id="school-schedule-content" aria-live="polite">
      <div class="empty"><i data-lucide="loader-circle"></i><b>Program yükleniyor</b><p>Kaydedilmiş görsel kontrol ediliyor…</p></div>
    </div>`;
  loadSchoolSchedule(request);
}
async function loadSchoolSchedule(request){
  const target=()=>UI.route==="school-schedule"&&request===UI.schoolScheduleRequest?
    $("#school-schedule-content"):null;
  try{
    const record=await schoolScheduleRequest("get");
    const content=target(); if(!content)return;
    if(!record){
      content.innerHTML=`<div class="empty"><i data-lucide="calendar-days"></i><b>Henüz okul programı eklenmedi</b>
        <p>Haftalık programının JPG, PNG veya WebP fotoğrafını ya da ekran görüntüsünü yükleyebilirsin. Görsel yalnızca bu tarayıcıda saklanır; JSON yedeğine eklenmez.</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="App.chooseSchoolScheduleImage()"><i data-lucide="image-plus"></i>Program görseli yükle</button></div>`;
    }else if(!(record.blob instanceof Blob)){
      throw new Error("Kaydedilmiş okul programı görsel verisi okunamadı.");
    }else{
      const url=URL.createObjectURL(record.blob);
      if(!target()){URL.revokeObjectURL(url);return;}
      UI.schoolScheduleUrl=url;
      const updated=Number.isFinite(Date.parse(record.updatedAt||""))?
        new Date(record.updatedAt).toLocaleString("tr-TR"):"";
      content.innerHTML=`<div class="spread" style="margin-bottom:12px">
          <div><h3 style="font-size:14.5px">${esc(record.name||"Haftalık okul programı")}</h3>
          <div class="small muted">${updated?"Son güncelleme: "+esc(updated):"Kaydedilmiş program görseli"}</div></div>
          <div class="school-upload-actions">
            <button class="btn btn-sm" ${UI.schoolScheduleSaving?"disabled":""} onclick="App.chooseSchoolScheduleImage()"><i data-lucide="refresh-cw"></i>Görseli değiştir</button>
            <button class="btn btn-sm btn-danger" ${UI.schoolScheduleSaving?"disabled":""} onclick="App.deleteSchoolSchedule()"><i data-lucide="trash-2"></i>Görseli kaldır</button>
          </div>
        </div>
        <div class="school-image-frame"><img src="${url}" alt="Haftalık okul ders programı"></div>
        <div class="help" style="margin-top:10px">Görselin özgün en-boy oranı korunur. En fazla 15 MB; JPG, JPEG, PNG ve WebP desteklenir.</div>`;
    }
    lucide.createIcons();
  }catch(error){
    const content=target(); if(!content)return;
    content.innerHTML=`<div class="empty"><i data-lucide="circle-alert"></i><b>Okul programı yüklenemedi</b>
      <p>${esc(error?.message||"Tarayıcı görsel deposuna erişemedi.")}</p>
      <button class="btn" style="margin-top:12px" onclick="renderSchoolSchedule($('#view'))"><i data-lucide="refresh-cw"></i>Yeniden dene</button></div>`;
    lucide.createIcons();
  }
}

function renderSettings(v){
  const st=S.settings;
  const days=[...Array(7)].map((_,i)=>({i,n:DAY_SHORT[(i+st.weekStart)%7]}));
  v.innerHTML=pageHead("Ayarlar ve Veri Yönetimi",`Veriler yalnızca bu tarayıcıda saklanır; cihazlar arasında otomatik eşitlenmez${storageOK?"":" — şu an depolama kullanılamıyor"}`)+
  `<div class="set-grid">
    <div class="card"><h3><i data-lucide="user"></i>Profil</h3>
      ${fld("Görünmek istediğin ad (isteğe bağlı)",`<input id="s-name" value="${esc(st.name)}" placeholder="örn. Deniz" maxlength="30">`,"Boş bırakırsan selamlama saat bazlı olur.")}
      ${fld("Tema",`<select id="s-theme"><option value="dark" ${st.theme==="dark"?"selected":""}>Karanlık</option><option value="light" ${st.theme==="light"?"selected":""}>Aydınlık</option></select>`)}
      ${fld("Hafta başlangıcı",`<select id="s-week"><option value="1" ${st.weekStart===1?"selected":""}>Pazartesi</option><option value="0" ${st.weekStart===0?"selected":""}>Pazar</option></select>`)}
      ${fld("Tarih gösterimi",`<select id="s-datestyle"><option value="uzun" ${st.dateStyle==="uzun"?"selected":""}>Uzun (9 Kasım 2026 Pazartesi)</option><option value="kısa" ${st.dateStyle==="kısa"?"selected":""}>Kısa (9 Kas)</option></select>`)}
    </div>
    <div class="card"><h3><i data-lucide="clock"></i>Çalışma alışkanlıkları</h3>
      ${fld("Günlük süre hedefi (dakika)",`<input type="number" id="s-target" min="15" max="720" value="${st.dailyTargetMin}">`)}
      ${fld("Günlük plan üst sınırı (dakika)",`<input type="number" id="s-max" min="30" max="900" value="${st.dailyMaxMin}">`,"Planner bu sınırı aştığında uyarır; engellemez.")}
      ${fld("Varsayılan oturum uzunluğu (dk)",`<input type="number" id="s-sess" min="10" max="180" value="${st.sessionLen}">`)}
      ${fld("Varsayılan mola (dk)",`<input type="number" id="s-break" min="0" max="60" value="${st.breakLen}">`)}
      ${fld("Sınav uyarı eşiği (gün)",`<input type="number" id="s-warn" min="1" max="30" value="${st.examWarnDays}">`,'Kalan gün bu değerin altına inince sınav "yakın" olarak vurgulanır.')}
    </div>
    <div class="card"><h3><i data-lucide="calendar-check"></i>Çalışma günlerin</h3>
      ${fld("Çalıştığın günler",`<div class="day-toggles">${days.map(d=>`<button class="day-tg ${st.studyDays.includes(d.i)?"on":""}" onclick="App.togDay('studyDays',${d.i})">${d.n}</button>`).join("")}</div>`)}
      ${fld("Dinlenme günleri",`<div class="day-toggles">${days.map(d=>`<button class="day-tg ${st.restDays.includes(d.i)?"on":""}" onclick="App.togDay('restDays',${d.i})">${d.n}</button>`).join("")}</div>`,"Dinlenme günleri planda etiket olarak görünür; görev eklemeni engellemez.")}
      <button class="btn btn-primary" onclick="App.saveSettings()"><i data-lucide="check"></i>Ayarları kaydet</button>
    </div>
    <div class="card"><h3><i data-lucide="database"></i>Yedekleme ve geri yükleme</h3>
      <p class="small muted" style="margin-bottom:12px">Tüm verilerin tek bir JSON dosyasında dışa aktarılabilir. İçe aktarmadan önce içerik doğrulanır ve önizleme gösterilir; mevcut verin onayın olmadan asla değişmez.</p>
      <div class="row">
        <button class="btn" onclick="App.exportJSON()"><i data-lucide="download"></i>JSON yedek al</button>
        <button class="btn" onclick="$('#imp-file').click()"><i data-lucide="upload"></i>Yedeği geri yükle</button>
        <input type="file" id="imp-file" accept=".json,application/json" style="display:none" onchange="App.importJSON(this)">
        <button class="btn" onclick="App.exportCSV()"><i data-lucide="file-text"></i>Oturumları CSV aktar</button>
      </div>
    </div>
    <div class="card"><h3><i data-lucide="trash-2"></i>Veri yönetimi</h3>
      ${st.demoActive?`<div class="row small" style="margin-bottom:10px"><span class="badge b-demo">DEMO</span><span class="muted">Başlangıçta yüklenen örnek oturumlar hâlâ kayıtlarda.</span></div>
      <button class="btn" style="margin-bottom:8px" onclick="App.removeDemo()"><i data-lucide="eraser"></i>Demo verisini kaldır</button>`:""}
      <button class="btn btn-danger" onclick="App.wipeAll()"><i data-lucide="alert-triangle"></i>Tüm verileri sıfırla</button>
      <div class="help">Sıfırlama, dersler ve konular dahil her şeyi siler ve boş bir çalışma alanı bırakır. Silinen veri geri alınamaz.</div>
    </div>
  </div>`;
}

/* ---------- 18) Eylemler (App) ---------- */
const App={
  chooseSchoolScheduleImage(){
    if(UI.schoolScheduleSaving)return;
    $("#school-schedule-file")?.click();
  },
  async uploadSchoolSchedule(input){
    const file=input.files&&input.files[0]; input.value="";
    if(!file)return;
    try{
      const validationError=await validateSchoolScheduleImage(file);
      if(validationError){toast(validationError,"err",5000);return;}
      UI.schoolScheduleSaving=true;
      const content=$("#school-schedule-content");
      if(content)content.setAttribute("aria-busy","true");
      const extension=file.name.split(".").pop().toLowerCase();
      const fallbackMime={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[extension];
      await schoolScheduleRequest("put",{key:SCHOOL_SCHEDULE_KEY,blob:file.slice(0,file.size,file.type||fallbackMime),
        name:file.name,updatedAt:new Date().toISOString()});
      UI.schoolScheduleSaving=false;
      toast("Okul programı görseli kaydedildi.","ok");
      if(UI.route==="school-schedule")render();
    }catch(error){
      UI.schoolScheduleSaving=false;
      toast("Okul programı kaydedilemedi. Tarayıcı depolama alanını veya izinlerini kontrol edin."+
        (error?.message?" ("+error.message+")":""),"err",7000);
      if(UI.route==="school-schedule")render();
    }
  },
  deleteSchoolSchedule(){
    confirmDialog({title:"Okul programı görselini kaldır",confirmText:"Görseli kaldır",
      message:"Kaydedilmiş okul programı görseli bu tarayıcıdan kalıcı olarak silinecek.",
      onConfirm:async()=>{
        UI.schoolScheduleSaving=true;
        try{
          await schoolScheduleRequest("delete");
          UI.schoolScheduleSaving=false;
          toast("Okul programı görseli kaldırıldı.");
          if(UI.route==="school-schedule")render();
        }catch(error){
          UI.schoolScheduleSaving=false;
          toast("Okul programı silinemedi. Tarayıcı depolama alanını veya izinlerini kontrol edin."+
            (error?.message?" ("+error.message+")":""),"err",7000);
          if(UI.route==="school-schedule")render();
        }
      }});
  },
  toggleTheme(){ S.settings.theme=S.settings.theme==="dark"?"light":"dark";
    document.documentElement.dataset.theme=S.settings.theme; if(!persist())return; render(); },
  togDay(list,i){ const arr=S.settings[list]; const k=arr.indexOf(i);
    if(k>=0)arr.splice(k,1);else arr.push(i); if(!persist())return; render(); },
  saveSettings(){
    const num=(id,mn,mx,d)=>{const v=parseInt($(id).value);return isNaN(v)?d:Math.min(mx,Math.max(mn,v));};
    S.settings.name=$("#s-name").value.trim();
    S.settings.theme=$("#s-theme").value; S.settings.weekStart=parseInt($("#s-week").value);
    S.settings.dateStyle=$("#s-datestyle").value;
    S.settings.dailyTargetMin=num("#s-target",15,720,180); S.settings.dailyMaxMin=num("#s-max",30,900,300);
    S.settings.sessionLen=num("#s-sess",10,180,40); S.settings.breakLen=num("#s-break",0,60,10);
    S.settings.examWarnDays=num("#s-warn",1,30,5);
    document.documentElement.dataset.theme=S.settings.theme;
    if(!persist())return; render(); toast("Ayarlar kaydedildi.");
  },

  /* --- Görevler --- */
  taskModal(id,presetDate){
    const tk=id?S.tasks.find(x=>x.id===id):null;
    const date=tk?tk.date||"":(presetDate||"");
    const subjs=S.subjects.filter(s=>!s.archived);
    openModal({title:tk?"Görevi düzenle":"Yeni görev",body:
      fld("Görev başlığı *",`<input id="tk-title" value="${esc(tk?.title||"")}" maxlength="120" placeholder="örn. Dörtgenler soru seti">`)+
      `<div class="frow">${fld("Ders",`<select id="tk-subj" onchange="App.fillTopicSelect('tk-topic',this.value)"><option value="">Genel</option>${subjs.map(s=>`<option value="${s.id}" ${tk?.subjectId===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)}
      ${fld("Konu (isteğe bağlı)",`<select id="tk-topic"><option value="">—</option></select>`)}</div>`+
      `<div class="frow">${fld("Tarih (boş = planlanmamış)",`<input type="date" id="tk-date" value="${date}">`)}
      ${fld("Tahmini süre (dk)",`<input type="number" id="tk-min" min="5" max="480" value="${tk?.estMinutes??45}">`)}</div>`+
      `<div class="frow">${fld("Öncelik",`<select id="tk-prio">${[1,2,3].map(p=>`<option value="${p}" ${(tk?.priority??2)===p?"selected":""}>${PRIOS[p].l}</option>`).join("")}</select>`)}
      ${fld("Tür",`<select id="tk-type">${Object.entries(SESSION_TYPES).map(([k,l])=>`<option value="${k}" ${(tk?.type||"konu")===k?"selected":""}>${l}</option>`).join("")}</select>`)}</div>`,
      footer:`${tk?`<button class="btn btn-danger" onclick="closeModal();App.deleteTask('${tk.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveTask('${id||""}')">Kaydet</button>`,
      onMount:()=>App.fillTopicSelect("tk-topic",tk?.subjectId||"")});
  },
  fillTopicSelect(selId,subjId){
    const sel=$("#"+selId); if(!sel)return; const cur=sel.value;
    const topics=subjId?S.topics.filter(t=>t.subjectId===subjId):[];
    sel.innerHTML=`<option value="">—</option>`+topics.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join("");
    if(cur&&topics.some(t=>t.id===cur))sel.value=cur;
  },
  saveTask(id){
    const title=$("#tk-title").value.trim();
    if(!title){toast("Görev başlığı boş olamaz.","err");$("#tk-title").focus();return;}
    const data={title,subjectId:$("#tk-subj").value||null,topicId:$("#tk-topic").value||null,
      date:$("#tk-date").value||null,estMinutes:clampNum($("#tk-min").value,5,480,45),
      priority:parseInt($("#tk-prio").value),type:$("#tk-type").value};
    if(data.topicId){const t=topicById(data.topicId);if(t)data.subjectId=t.subjectId;}
    if(id){Object.assign(S.tasks.find(x=>x.id===id),data);}
    else S.tasks.push({id:uid(),...data,status:"planli",createdAt:todayKey()});
    if(!persist())return; closeModal();render();toast(id?"Görev güncellendi.":"Görev eklendi.");
  },
  toggleTask(id){ const tk=S.tasks.find(x=>x.id===id); if(!tk)return;
    if(tk.status==="tamam"){tk.status="planli";}
    else{tk.status="tamam";toast("Görev tamamlandı olarak işaretlendi.","ok");}
    if(!persist())return; render(); },
  deleteTask(id){ confirmDialog({title:"Görevi sil",message:"Bu görev listeden kaldırılacak. Geri alınamaz.",onConfirm:()=>{
    S.tasks=S.tasks.filter(x=>x.id!==id);if(!persist())return;render();toast("Görev silindi.");}}); },
  postponeTask(id){ const tk=S.tasks.find(x=>x.id===id); if(!tk)return;
    openModal({title:"Görevi ertele",body:
      `<p class="small muted" style="margin-bottom:12px">“${esc(tk.title)}” için yeni bir tarih seç ya da görevi planlanmamış kuyruğuna taşı. Görev asla kaybolmaz, kopyası oluşmaz.</p>`+
      fld("Yeni tarih",`<input type="date" id="pp-date" value="${addDaysKey(todayKey(),1)}" min="${todayKey()}">`),
      footer:`<button class="btn" onclick="App.unscheduleTask('${id}')">Planlanmamışlara al</button>
        <button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.applyPostpone('${id}')">Tarihe taşı</button>`});
  },
  applyPostpone(id){ const tk=S.tasks.find(x=>x.id===id);
    const d=$("#pp-date").value; if(!d){toast("Bir tarih seçmelisin.","err");return;}
    tk.date=d; if(!persist())return;closeModal();render();toast(`Görev ${fmtShort(d)} gününe taşındı.`); },
  unscheduleTask(id){ const tk=S.tasks.find(x=>x.id===id); tk.date=null;
    if(!persist())return;closeModal();render();toast("Görev planlanmamış kuyruğuna alındı."); },
  startSessionForTask(id){ const tk=S.tasks.find(x=>x.id===id); if(!tk)return;
    if(S.activeSession){toast("Zaten devam eden bir oturum var. Önce onu bitir.","warn");return;}
    App.startSessionModal(tk.subjectId,tk.topicId,tk.type); },

  /* --- Dersler --- */
  subjectModal(id){
    const sb=id?subjectById(id):null;
    openModal({title:sb?"Dersi düzenle":"Yeni ders",body:
      fld("Ders adı *",`<input id="sb-name" value="${esc(sb?.name||"")}" maxlength="50" placeholder="örn. Matematik">`)+
      `<div class="frow">${fld("Renk",`<select id="sb-color">${SUBJ_COLORS.map(c=>`<option value="${c}" ${sb?.color===c?"selected":""}>${c}</option>`).join("")}</select>`)}
      ${fld("Öncelik",`<select id="sb-prio">${[1,2,3].map(p=>`<option value="${p}" ${(sb?.priority??2)===p?"selected":""}>${PRIOS[p].l}</option>`).join("")}</select>`)}</div>`+
      `<div class="frow">${fld("Hedef not (isteğe bağlı)",`<input id="sb-grade" value="${esc(sb?.targetGrade||"")}" maxlength="10">`)}</div>`+
      fld("Notlar",`<textarea id="sb-notes" rows="2">${esc(sb?.notes||"")}</textarea>`),
      footer:`${sb?`<button class="btn btn-danger" onclick="closeModal();App.deleteSubject('${sb.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveSubject('${id||""}')">Kaydet</button>`});
  },
  saveSubject(id){
    const name=$("#sb-name").value.trim();
    if(!name){toast("Ders adı boş olamaz.","err");return;}
    const data={name,color:$("#sb-color").value,priority:parseInt($("#sb-prio").value),
      targetGrade:$("#sb-grade").value.trim(),notes:$("#sb-notes").value.trim()};
    if(id){Object.assign(subjectById(id),data);}
    else S.subjects.push({id:uid(),...data,archived:false});
    if(!persist())return;closeModal();render();toast(id?"Ders güncellendi.":"Ders eklendi.");
  },
  deleteSubject(id){
    const sb=subjectById(id); if(!sb)return;
    const nT=S.topics.filter(t=>t.subjectId===id).length;
    const nE=S.exams.filter(e=>e.subjectId===id).length;
    const nS=S.sessions.filter(s=>s.subjectId===id).length;
    confirmDialog({title:"Dersi sil",confirmText:"Dersi ve bağlantılarını sil",
      message:`<b>${esc(sb.name)}</b> dersi silinecek. Bu dersin <b>${nT} konusu</b> ve <b>${nE} sınavı</b> da silinir.<br><br>Çalışma oturumu geçmişin <b>silinmez</b> — ${nS} oturum kaydı ders adıyla korunur, istatistikler bozulmaz.`,
      onConfirm:()=>{
        const ids=new Set(S.topics.filter(t=>t.subjectId===id).map(t=>t.id));
        S.sessions.forEach(s=>{if(s.subjectId===id&&!s.subjectName)s.subjectName=sb.name;});
        S.topics=S.topics.filter(t=>t.subjectId!==id);
        S.exams=S.exams.filter(e=>e.subjectId!==id);
        S.tasks=S.tasks.filter(t=>t.subjectId!==id);
        S.subjects=S.subjects.filter(s=>s.id!==id);
        if(!persist())return;render();toast("Ders silindi; oturum geçmişi korundu.");}});
  },
  gotoSubject(id){ gotoSubject(id); },

  /* --- Konular --- */
  selTopic(id){ UI.topicSel.has(id)?UI.topicSel.delete(id):UI.topicSel.add(id); render(); },
  bulkStatus(){ const st=$("#bulk-st").value; if(!st){toast("Önce bir durum seç.","warn");return;}
    let n=0; UI.topicSel.forEach(id=>{const t=topicById(id);if(t){t.status=st;n++;}});
    UI.topicSel.clear(); if(!persist())return;render();toast(n+" konunun durumu güncellendi."); },
  topicModal(id,subjId,parentId){
    const tp=id?topicById(id):null;
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:tp?"Konuyu düzenle":parentId?"Alt konu ekle":"Yeni konu",body:
      fld("Konu başlığı *",`<input id="tp-title" value="${esc(tp?.title||"")}" maxlength="120" placeholder="örn. Dörtgenler">`)+
      fld("Ders *",`<select id="tp-subj">${subjs.map(s=>`<option value="${s.id}" ${(tp?.subjectId||subjId)===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)+
      `<div class="frow">${fld("Sınav önemi",`<select id="tp-er">${[["0","Genel"],["1","Düşük"],["2","Sınavda çıkabilir"],["3","Kritik"]].map(([v,l])=>`<option value="${v}" ${(tp?.examRelevance??1)==v?"selected":""}>${l}</option>`).join("")}</select>`)}
      ${fld("Kalan tahmini süre (dk)",`<input type="number" id="tp-em" min="10" max="600" value="${tp?.estMinutes??60}">`)}</div>`+
      `<div class="frow">${fld("Durum",`<select id="tp-st">${Object.entries(TOPIC_STATUS).map(([k,l])=>`<option value="${k}" ${(tp?.status||"baslanmadi")===k?"selected":""}>${l}</option>`).join("")}</select>`)}
      ${fld("Öz-güven (1–5)",`<select id="tp-cf">${[1,2,3,4,5].map(i=>`<option value="${i}" ${(tp?.confidence??1)===i?"selected":""}>${i}</option>`).join("")}</select>`)}</div>`+
      `<div class="frow">${fld("Son çalışma",`<input type="date" id="tp-ls" value="${tp?.lastStudiedAt||""}">`)}
      ${fld("Sonraki tekrar",`<input type="date" id="tp-nr" value="${tp?.nextReviewAt||""}">`)}</div>`+
      fld("Kaynak / bağlantı (isteğe bağlı)",`<input id="tp-res" value="${esc(tp?.resources||"")}" placeholder="örn. kitap sayfası veya video bağlantısı">`)+
      fld("Notlar",`<textarea id="tp-notes" rows="2">${esc(tp?.notes||"")}</textarea>`),
      footer:`${tp?`<button class="btn btn-danger" onclick="closeModal();App.deleteTopic('${tp.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveTopic('${id||""}','${parentId||""}')">Kaydet</button>`});
  },
  saveTopic(id,parentId){
    const title=$("#tp-title").value.trim();
    if(!title){toast("Konu başlığı boş olamaz.","err");return;}
    const data={title,subjectId:$("#tp-subj").value,examRelevance:parseInt($("#tp-er").value),
      estMinutes:clampNum($("#tp-em").value,10,600,60),status:$("#tp-st").value,
      confidence:parseInt($("#tp-cf").value),lastStudiedAt:$("#tp-ls").value||null,
      nextReviewAt:$("#tp-nr").value||null,resources:$("#tp-res").value.trim(),notes:$("#tp-notes").value.trim()};
    if(id){Object.assign(topicById(id),data);}
    else S.topics.push({id:uid(),parentId:parentId||null,qAttempted:0,qCorrect:0,...data});
    if(!persist())return;closeModal();render();toast(id?"Konu güncellendi.":"Konu eklendi.");
  },
  deleteTopic(id){
    const tp=topicById(id); if(!tp)return;
    const subs=S.topics.filter(t=>t.parentId===id);
    confirmDialog({title:"Konuyu sil",message:`<b>${esc(tp.title)}</b> silinecek.${subs.length?` Bağlı <b>${subs.length} alt konusu</b> da silinir.`:""} Soru ve oturum kayıtları geçmişte kalır.`,
      onConfirm:()=>{ const kill=new Set([id,...S.topics.filter(t=>t.parentId===id).map(t=>t.id)]);
        S.topics=S.topics.filter(t=>!kill.has(t.id));
        S.exams.forEach(e=>{const ids=examTopicIds(e);if(ids)e.topicIds=ids.filter(x=>!kill.has(x));});
        S.tasks.forEach(t=>{if(t.topicId&&kill.has(t.topicId))t.topicId=null;});
        if(!persist())return;render();toast("Konu silindi.");}});
  },
  topicDetail(id){
    const tp=topicById(id); if(!tp)return;
    const p=topicPrep(tp), subs=S.topics.filter(t=>t.parentId===id);
    const sess=S.sessions.filter(s=>s.topicId===id);
    const sessMin=Math.round(sess.reduce((a,s)=>a+s.elapsedMs,0)/60000);
    openModal({title:tp.title,wide:true,body:
      `<div class="row" style="margin-bottom:12px">${subjTag(tp.subjectId)}${statusBadge(tp.status)}
        <span class="badge b-mut">Öz-güven ${tp.confidence}/5</span>
        ${tp.examRelevance===3?'<span class="badge b-danger">Sınav için kritik</span>':""}
        ${tp.nextReviewAt&&tp.nextReviewAt<=todayKey()?'<span class="badge b-warn">Tekrar gecikmiş</span>':""}</div>
      <div class="stat-line"><span class="muted">Kayıtlı oturum</span><span class="v">${sess.length} · ${fmtDur(sessMin)}</span></div>
      <div class="stat-line"><span class="muted">Sorular (bu konuda)</span><span class="v">${p.qc} / ${p.qa}${p.qa?` · %${pct(p.qc,p.qa)}`:""}</span></div>
      <div class="stat-line"><span class="muted">Tahmini hazırlık</span><span class="v">%${p.score}</span></div>
      <div class="help" style="margin:4px 0 12px">Tahmin: konum durumu (%40) + öz-güven (%30)${p.acc!==null?" + soru doğruluğu (%30)":" (soru verisi yoksa öz-güven ağırlığı artar)"} — bilgi ölçümü değil, bir tahmindir.</div>
      ${tp.notes?`<div class="card" style="padding:10px 12px;background:var(--surface2);margin-bottom:10px"><div class="small muted">${esc(tp.notes)}</div></div>`:""}
      ${tp.resources?`<div class="small row" style="margin-bottom:10px"><i data-lucide="link" style="width:13px;height:13px;color:var(--accent)"></i>${esc(tp.resources)}</div>`:""}
      ${subs.length?`<div style="margin-bottom:10px"><b class="small">Alt konular</b>${subs.map(s=>`<div class="small row" style="padding:4px 0"><i data-lucide="corner-down-right" style="width:12px;height:12px;color:var(--faint)"></i>${esc(s.title)} ${statusBadge(s.status)}</div>`).join("")}</div>`:""}
      ${sess.length?`<b class="small">Son oturumlar</b>${sess.slice(-4).reverse().map(s=>`<div class="small row" style="padding:3px 0;color:var(--muted)">${fmtShort(dayKey(new Date(s.startedAt)))} · ${esc(SESSION_TYPES[s.type])} · ${fmtDur(Math.round(s.elapsedMs/60000))}${s.demo?' <span class="badge b-demo">DEMO</span>':""}</div>`).join("")}`:""}`,
      footer:`<button class="btn" onclick="closeModal();App.rescheduleReview('${id}')"><i data-lucide="calendar-clock"></i>Tekrar planla</button>
        <button class="btn" onclick="closeModal();App.topicModal('${id}')"><i data-lucide="pencil"></i>Düzenle</button>
        <button class="btn btn-primary" onclick="closeModal();App.startSessionModal('${tp.subjectId}','${id}')"><i data-lucide="play"></i>Çalışmaya başla</button>`});
  },

  /* --- Sınavlar --- */
  examModal(id){
    const ex=id?examById(id):null;
    if(ex&&!examTopicIds(ex)){toast("Sınavın konu listesi geçersiz; önce veriyi düzeltmeden düzenleyemezsin.","err");return;}
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    const sid=ex?.subjectId||subjs[0].id;
    openModal({title:ex?"Sınavı düzenle":"Yeni sınav",body:
      fld("Ders *",`<select id="ex-subj" onchange="App.renderExamTopics()">${subjs.map(s=>`<option value="${s.id}" ${sid===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Sınav başlığı *",`<input id="ex-title" value="${esc(ex?.title||"")}" maxlength="100" placeholder="örn. 1. Dönem 2. Yazılı">`)+
      `<div class="frow">${fld("Tarih *",`<input type="date" id="ex-date" value="${ex?.date||""}">`)}
      ${fld("Saat (isteğe bağlı)",`<input type="time" id="ex-time" value="${ex?.time||""}">`)}</div>`+
      `<div class="frow">${fld("Önem",`<select id="ex-imp">${[[1,"Yüksek"],[2,"Orta"],[3,"Düşük"]].map(([v,l])=>`<option value="${v}" ${(ex?.importance??2)===v?"selected":""}>${l}</option>`).join("")}</select>`)}
      ${fld("Hedef not",`<input id="ex-grade" value="${esc(ex?.targetGrade||"")}" maxlength="10">`)}</div>`+
      fld("Sınav kapsamı (kendi bilgine göre seç)",`<div class="chk-list" id="ex-topics"></div>`,`Kapsamı sen belirlediğin için eksik konu sayısı yalnızca seçtiklerinden hesaplanır.`)+
      fld("Notlar",`<textarea id="ex-notes" rows="2">${esc(ex?.notes||"")}</textarea>`),
      footer:`${ex?`<button class="btn btn-danger" onclick="closeModal();App.deleteExam('${ex.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveExam('${id||""}')">Kaydet</button>`,
      onMount:()=>App.renderExamTopics(ex?.topicIds||[])});
  },
  renderExamTopics(selected=[]){
    const sid=$("#ex-subj").value;
    const topics=S.topics.filter(t=>t.subjectId===sid);
    $("#ex-topics").innerHTML= topics.length? topics.map(t=>
      `<label class="chk-item"><input type="checkbox" value="${t.id}" ${selected.includes(t.id)?"checked":""}>
       <span style="flex:1">${esc(t.title)}</span>${statusBadge(t.status)}</label>`).join("")
     :`<div class="small muted" style="padding:10px">Bu derse ait konu yok. Önce konu ekleyebilirsin; kapsamı sonra da düzenleyebilirsin.</div>`;
  },
  saveExam(id){
    const title=$("#ex-title").value.trim(), date=$("#ex-date").value, sid=$("#ex-subj").value;
    if(!title){toast("Sınav başlığı boş olamaz.","err");return;}
    if(!date){toast("Sınav tarihi gerekli.","err");return;}
    if(date<addDaysKey(todayKey(),-3650)){toast("Geçersiz tarih.","err");return;}
    const topicIds=[...$$("#ex-topics input:checked")].map(x=>x.value);
    const data={subjectId:sid,title,date,time:$("#ex-time").value,importance:parseInt($("#ex-imp").value),
      targetGrade:$("#ex-grade").value.trim(),topicIds,notes:$("#ex-notes").value.trim()};
    if(id){Object.assign(examById(id),data);}
    else S.exams.push({id:uid(),...data});
    if(!persist())return;closeModal();render();toast(id?"Sınav güncellendi.":"Sınav eklendi.");
  },
  deleteExam(id){ confirmDialog({title:"Sınavı sil",message:"Bu sınav, geri sayımlardan ve takvimden kaldırılacak. Konular silinmez.",onConfirm:()=>{
    S.exams=S.exams.filter(e=>e.id!==id);if(!persist())return;render();toast("Sınav silindi.");}}); },
  openExamDetail(id){
    const ex=examById(id); if(!ex)return;
    const topicIds=examTopicIds(ex),inc=examIncomplete(ex),est=examEst(ex);
    const dl=daysUntilExam(ex),tot=topicIds?topicIds.length:0,incCount=inc?inc.length:0;
    const feas=est!==null&&est>dl*S.settings.dailyTargetMin;
    const ts=topicIds?topicIds.map(topicById).filter(Boolean):[];
    const summary = tot ? `<div class="stat-line"><span class="muted">Kapsam konuları</span><span class="v">${tot-incCount} / ${tot} hazır</span></div>
      <div class="stat-line"><span class="muted">Kalan tahmini çalışma</span><span class="v">${fmtDur(est)}</span></div>` : "";
    const warn = !topicIds?`<div class="help" role="alert">Sınavın konu listesi okunamıyor. Veri düzeltilene kadar kapsam hesaplaması kullanılamaz.</div>`:
      dl>=0 && feas ? `<div class="card" style="padding:10px 12px;margin-top:10px;border-color:var(--warn);background:var(--warn-dim)"><div class="small" style="color:var(--warn)"><b>Süre uyarısı:</b> kalan tahmin, günlük ${fmtDur(S.settings.dailyTargetMin)} hedefiyle ${dl} günde yetmiyor gibi görünüyor. Kritik konulara öncelik vermeyi, diğerlerini sonraki tekrarlara bırakmayı düşünebilirsin.</div></div>` : "";
    const topicList = !topicIds?"" : ts.length ? `<div style="margin-top:12px"><b class="small">Konular</b>${ts.map(t=>{const p=topicPrep(t);return `<div class="row small" style="padding:5px 0;gap:10px">
        <span style="flex:1;cursor:pointer" onclick="closeModal();App.topicDetail('${t.id}')">${esc(t.title)}</span>
        ${p.qa?`<span class="muted">${p.qc}/${p.qa} soru · %${pct(p.qc,p.qa)}</span>`:""}${statusBadge(t.status)}</div>`;}).join("")}</div>` : `<div class="help" style="margin-top:10px">Kapsam konusu seçilmemiş. Düzenle'den sınav konularını işaretleyebilirsin.</div>`;
    const notes = ex.notes ? `<div class="card" style="padding:10px 12px;background:var(--surface2);margin-top:10px"><div class="small muted">${esc(ex.notes)}</div></div>` : "";
    openModal({title:ex.title,wide:true,body:
      `<div class="row" style="margin-bottom:12px">${subjTag(ex.subjectId)}
        <span class="badge ${dl<0?"b-mut":dl<=S.settings.examWarnDays?"b-danger":"b-info"}">${dl<0?"Geçti":dl===0?"Bugün":dl+" gün kaldı"}</span>
        ${ex.importance===1?'<span class="badge b-danger">Yüksek öneme</span>':""}
        ${ex.targetGrade?`<span class="badge b-mut">Hedef ${esc(ex.targetGrade)}</span>`:""}</div>
      <div class="stat-line"><span class="muted">Tarih</span><span class="v">${fmtShort(ex.date)}${ex.time?" · "+esc(ex.time):""}</span></div>
      ${summary}
      ${warn}
      ${topicList}
      ${notes}`,
      footer:`<button class="btn" onclick="closeModal();gotoSubject('${ex.subjectId}')"><i data-lucide="library"></i>Dersin konuları</button>
        <button class="btn" onclick="closeModal();App.examModal('${ex.id}')"><i data-lucide="pencil"></i>Düzenle</button>
        <button class="btn btn-primary" onclick="closeModal();App.planForExam('${ex.id}')"><i data-lucide="calendar-plus"></i>Bugünün planına görev ekle</button>`});
  },
  planForExam(exId){
    const ex=examById(exId); if(!ex)return;
    if(!examTopicIds(ex)){toast("Sınavın konu listesi geçersiz; görev oluşturulamadı.","err");return;}
    const inc=examIncomplete(ex);
    if(!inc.length){toast("Bu sınavın kapsamında eksik konu kalmamış.","ok");return;}
    const t=inc[0];
    S.tasks.push({id:uid(),subjectId:ex.subjectId,topicId:t.id,title:t.title+" çalış ("+ex.title+")",
      date:todayKey(),estMinutes:Math.min(t.estMinutes||60,60),priority:ex.importance,status:"planli",type:"konu",createdAt:todayKey()});
    if(!persist())return;render();toast(`“${t.title}” bugünün planına eklendi. Kalan ${inc.length-1} konuyu Plan bölümünden sıraya diz.`,"ok",4500);
  },

  /* --- Oturumlar --- */
  startSessionModal(subjId,topicId,type){
    if(S.activeSession){toast("Zaten devam eden bir oturum var.","warn");
      App.finishSessionModal();return;}
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Oturum başlat",body:
      fld("Ders *",`<select id="ss-subj" onchange="App.fillTopicSelect('ss-topic',this.value)">${subjs.map(s=>`<option value="${s.id}" ${subjId===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Konu (isteğe bağlı)",`<select id="ss-topic"><option value="">—</option></select>`)+
      fld("Oturum türü",`<select id="ss-type">${Object.entries(SESSION_TYPES).map(([k,l])=>`<option value="${k}" ${(type||"konu")===k?"selected":""}>${l}</option>`).join("")}</select>`)+
      fld("Hedef süre (dk, isteğe bağlı)",`<input type="number" id="ss-plan" min="0" max="480" value="${S.settings.sessionLen}">`,"Kronometre zaman damgasıyla çalışır; sekme kapansa bile sayfa yenilendiğinde kaldığı yerden devam eder."),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.startSession()"><i data-lucide="play"></i>Başlat</button>`,
      onMount:()=>App.fillTopicSelect("ss-topic",subjId||$("#ss-subj").value,topicId)});
  },
  fillTopicSelect(selId,subjId,cur){
    const sel=$("#"+selId); if(!sel)return;
    const topics=subjId?S.topics.filter(t=>t.subjectId===subjId):[];
    sel.innerHTML=`<option value="">—</option>`+topics.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join("");
    if(cur)sel.value=cur;
  },
  startSession(){
    const startedAt=Date.now();
    const a={subjectId:$("#ss-subj").value,topicId:$("#ss-topic").value||null,type:$("#ss-type").value,
      plannedMin:clampNum($("#ss-plan").value,0,480,S.settings.sessionLen)||null,
      startedAt,runningSince:startedAt,accumulatedMs:0,pausedAt:null};
    S.activeSession=a; if(!persist())return;
    closeModal();render();
    toast("Oturum başladı. İyi çalışmalar!","ok");
  },
  togglePause(){ const a=S.activeSession; if(!a)return;
    const now=Date.now();
    let message;
    if(a.pausedAt){
      a.runningSince=now;
      a.pausedAt=null;
      message="Devam ediliyor.";
    } else {
      a.accumulatedMs=(a.accumulatedMs||0)+(now-(a.runningSince||a.startedAt||now));
      a.pausedAt=now;
      a.runningSince=null;
      message="Duraklatıldı; süre birikmiyor.";
    }
    if(!persist())return;
    render();toast(message); },
  cancelActive(){
    confirmDialog({title:"Oturumu iptal et",confirmText:"İptal et ve kaydetme",
      message:"Devam eden oturum hiçbir yere kaydedilmeden kapatılacak. Bu işlem geri alınamaz.",
      onConfirm:()=>{S.activeSession=null;if(!persist())return;render();toast("Oturum iptal edildi.");}});
  },
  finishSessionModal(){
    const a=S.activeSession; if(!a)return;
    const t=a.topicId?topicById(a.topicId):null;
    openModal({title:"Oturumu bitir",body:
      `<div class="card" style="padding:12px;background:var(--surface2);margin-bottom:14px">
        <div class="row"><i data-lucide="check-circle-2" style="color:var(--ok)"></i>
        <b>${esc(subjName(a.subjectId)||"—")}</b>${t?`<span class="muted">· ${esc(t.title)}</span>`:""}
        <span class="mono-num" style="margin-left:auto;font-size:18px;font-weight:700">${fmtClock(activeElapsed())}</span></div>
        ${a.pausedAt?'<div class="small" style="color:var(--warn);margin-top:6px">Oturum şu an duraklatılmış durumda; duraklatılan süre sayılmaz.</div>':""}</div>`+
      `<div class="frow">${fld("Çözülen soru sayısı",`<input type="number" id="fs-qa" min="0" max="500" value="0">`)}
      ${fld("Doğru sayısı",`<input type="number" id="fs-qc" min="0" max="500" value="0">`)}</div>`+
      `<div class="err-txt" id="fs-err">Doğru sayısı çözülen soruyu geçemez.</div>`+
      (t?fld("Bu konu için tekrar planla",`<select id="fs-rev"><option value="">Hayır</option>${REVIEW_OPTIONS.map(o=>`<option value="${o.d}" ${o.d===3?"selected":""}>${o.l}</option>`).join("")}<option value="custom">Özel tarih…</option></select><input type="date" id="fs-revd" style="display:none;margin-top:6px" onchange="" placeholder="">`):"")+
      fld("Kısa yansıma (isteğe bağlı)",`<textarea id="fs-notes" rows="2" placeholder="Neyi iyi anladım, nerede takıldım?"></textarea>`),
      footer:`<button class="btn btn-danger" onclick="closeModal();App.cancelActive()">Kaydetmeden at</button>
        <button class="btn btn-primary" id="fs-save" onclick="App.saveFinishedSession()"><i data-lucide="check"></i>Oturumu kaydet</button>`,
      onMount:()=>{ const rv=$("#fs-rev"); if(rv)rv.onchange=()=>{$("#fs-revd").style.display=rv.value==="custom"?"block":"none";}; }});
  },
  saveFinishedSession(){
    if(S.saving)return;
    const qa=clampNum($("#fs-qa").value,0,500,0),qc=clampNum($("#fs-qc").value,0,500,0);
    if(qc>qa){$("#fs-err").style.display="block";return;}
    S.saving=true;
    const a=S.activeSession; const end=Date.now();
    const elapsed=activeElapsed();
    S.sessions.push({id:uid(),subjectId:a.subjectId,topicId:a.topicId,type:a.type,
      startedAt:new Date(a.startedAt).toISOString(),endedAt:new Date(end).toISOString(),
      elapsedMs:Math.max(1000,elapsed),plannedMin:a.plannedMin||null,qAttempted:qa,qCorrect:qc,
      notes:$("#fs-notes").value.trim(),demo:false});
    const t=a.topicId?topicById(a.topicId):null;
    if(t){ t.lastStudiedAt=todayKey();
      if(t.status==="baslanmadi")t.status="calisiliyor";
      if(a.type==="tekrar")t.status=t.status==="ogrenildi"?"tekrar":t.status;
      const rv=$("#fs-rev")?$("#fs-rev").value:"";
      if(rv){ const dk=rv==="custom"?($("#fs-revd").value||addDaysKey(todayKey(),3)):addDaysKey(todayKey(),parseInt(rv));
        t.nextReviewAt=dk; } }
    S.activeSession=null; delete S.saving;
    if(!persist())return;
    closeModal();render();
    toast(`Oturum kaydedildi: ${fmtClock(elapsed)}.`,"ok");
  },
  manualSessionModal(){
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Elle oturum girişi",body:
      `<p class="small muted" style="margin-bottom:12px">Kronometre kullanmadan çalıştıysan süreyi buradan hızlıca kaydedebilirsin.</p>`+
      fld("Ders *",`<select id="ms-subj" onchange="App.fillTopicSelect('ms-topic',this.value)">${subjs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Konu",`<select id="ms-topic"><option value="">—</option></select>`)+
      `<div class="frow">${fld("Tür",`<select id="ms-type">${Object.entries(SESSION_TYPES).map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select>`)}
      ${fld("Süre (dk) *",`<input type="number" id="ms-min" min="1" max="600" value="30">`)}</div>`+
      `<div class="frow">${fld("Soru sayısı",`<input type="number" id="ms-qa" min="0" max="500" value="0">`)}
      ${fld("Doğru",`<input type="number" id="ms-qc" min="0" max="500" value="0">`)}</div>`+
      `<div class="err-txt" id="ms-err">Doğru sayısı soru sayısını geçemez.</div>`+
      fld("Not",`<input id="ms-notes" maxlength="200">`),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.saveManualSession()"><i data-lucide="check"></i>Kaydet</button>`,
      onMount:()=>App.fillTopicSelect("ms-topic",$("#ms-subj").value)});
  },
  saveManualSession(){
    if(S.saving)return;
    const min=clampNum($("#ms-min").value,1,600,0);
    if(!min){toast("Süre en az 1 dakika olmalı.","err");return;}
    const qa=clampNum($("#ms-qa").value,0,500,0),qc=clampNum($("#ms-qc").value,0,500,0);
    if(qc>qa){$("#ms-err").style.display="block";return;}
    S.saving=true;
    const sid=$("#ms-subj").value,tid=$("#ms-topic").value||null;
    const d=parseDay(todayKey()); d.setHours(20,0,0,0);
    S.sessions.push({id:uid(),subjectId:sid,topicId:tid,type:$("#ms-type").value,
      startedAt:new Date(d.getTime()-min*60000).toISOString(),endedAt:d.toISOString(),
      elapsedMs:min*60000,plannedMin:null,qAttempted:qa,qCorrect:qc,notes:$("#ms-notes").value.trim(),demo:false});
    const t=tid?topicById(tid):null;
    if(t){t.lastStudiedAt=todayKey();if(t.status==="baslanmadi")t.status="calisiliyor";
    }
    delete S.saving; if(!persist())return;
    closeModal();render();toast("Oturum kaydedildi.");
  },
  deleteSession(id){ confirmDialog({title:"Oturum kaydını sil",message:"Bu kayıt istatistiklerden de çıkarılır.",onConfirm:()=>{
    S.sessions=S.sessions.filter(s=>s.id!==id);if(!persist())return;render();toast("Kayıt silindi.");}}); },
  logQuestionsModal(){
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Soru çözümü kaydet",body:
      fld("Ders *",`<select id="lq-subj" onchange="App.fillTopicSelect('lq-topic',this.value)">${subjs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Konu (önerilir)",`<select id="lq-topic"><option value="">—</option></select>`)+
      `<div class="frow">${fld("Çözülen soru *",`<input type="number" id="lq-qa" min="1" max="500" value="10">`)}
      ${fld("Doğru *",`<input type="number" id="lq-qc" min="0" max="500" value="0">`)}</div>`+
      `<div class="err-txt" id="lq-err">Doğru sayısı çözülen soruyu geçemez.</div>`,
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.saveQuestions()"><i data-lucide="check"></i>Kaydet</button>`,
      onMount:()=>App.fillTopicSelect("lq-topic",$("#lq-subj").value)});
  },
  saveQuestions(){
    if(S.saving)return;
    const qa=clampNum($("#lq-qa").value,1,500,0),qc=clampNum($("#lq-qc").value,0,500,0);
    if(!qa){toast("Soru sayısı en az 1 olmalı.","err");return;}
    if(qc>qa){$("#lq-err").style.display="block";return;}
    S.saving=true;
    const tid=$("#lq-topic").value||null;
    const t=tid?topicById(tid):null;
    // Çözüm oturumu olarak da kaydolur: süre tahmini değil, "soru" tipi kayıt
    S.sessions.push({id:uid(),subjectId:$("#lq-subj").value,topicId:tid,type:"soru",
      startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),elapsedMs:0,plannedMin:null,
      qAttempted:qa,qCorrect:qc,notes:"",demo:false});
    if(t){t.lastStudiedAt=todayKey();
      if(t.status==="baslanmadi")t.status="calisiliyor";}
    delete S.saving; if(!persist())return;
    closeModal();render();
    toast(`${qa} soru kaydedildi · doğruluk %${pct(qc,qa)}.`,"ok");
  },

  /* --- Tekrar --- */
  reviewModal(topicId){
    const t=topicById(topicId); if(!t)return;
    openModal({title:"Tekrarı tamamla",body:
      `<p class="small muted" style="margin-bottom:12px"><b>${esc(t.title)}</b> tekrarını notları açmadan önce hatırlamayı dene. Sonra kendini değerlendir:</p>
      <div id="fb-row" class="row" style="gap:8px;margin-bottom:14px">
        ${Object.entries(FEEDBACK).map(([k,l])=>`<button class="btn" data-fb="${k}" onclick="document.querySelectorAll('#fb-row button').forEach(b=>b.style.borderColor='');this.style.borderColor='var(--accent)';document.getElementById('fb-val').value='${k}'" style="flex:1;justify-content:center">${l}</button>`).join("")}
      </div><input type="hidden" id="fb-val" value="zor">`+
      fld("Sonraki tekrar tarihi (öneri, düzenlenebilir)",`<input type="date" id="rv-next" value="${addDaysKey(todayKey(),7)}">`,
        "Kolaydı → aralık genişletilir, Zordu → 3 gün, Hatırlayamadım → 1 gün önerilir."),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.saveReview('${topicId}')"><i data-lucide="check"></i>Kaydet</button>`});
  },
  saveReview(topicId){
    const t=topicById(topicId); if(!t)return;
    const fb=$("#fb-val").value||"zor";
    const sug=fb==="kolay"?14:fb==="zor"?3:1;
    let next=$("#rv-next").value||addDaysKey(todayKey(),sug);
    t.nextReviewAt=next;
    if(fb==="hatirlayamadim")t.status="tekrar";
    if(fb==="kolay"&&t.confidence<5)t.confidence=Math.min(5,t.confidence+1);
    S.reviewLog.push({id:uid(),topicId,date:todayKey(),feedback:fb});
    if(!persist())return;closeModal();render();
    toast(`Tekrar kaydedildi. Sonraki tekrar: ${fmtShort(next)}.`,"ok");
  },
  rescheduleReview(topicId){
    const t=topicById(topicId); if(!t)return;
    openModal({title:"Tekrar tarihi",body:
      fld("Yeni tekrar tarihi",`<input type="date" id="rs-d" value="${t.nextReviewAt||addDaysKey(todayKey(),3)}">`),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.applyReschedule('${topicId}')">Kaydet</button>`});
  },
  applyReschedule(topicId){ const t=topicById(topicId);
    t.nextReviewAt=$("#rs-d").value||null; if(!persist())return;closeModal();render();toast("Tekrar tarihi güncellendi."); },
  schedulePickModal(){
    const topics=S.topics;
    if(!topics.length){toast("Önce konu ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Tekrar planla",body:
      fld("Konu",`<select id="sp-topic">${topics.map(t=>`<option value="${t.id}">${esc(t.title)} — ${esc(subjName(t.subjectId)||"")}</option>`).join("")}</select>`)+
      fld("Ne zaman?",`<select id="sp-when">${REVIEW_OPTIONS.map(o=>`<option value="${o.d}">${o.l}</option>`).join("")}<option value="custom">Özel tarih…</option></select>`)+
      `<input type="date" id="sp-date" style="display:none;margin-top:6px">`,
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.applySchedulePick()">Kaydet</button>`,
      onMount:()=>{$("#sp-when").onchange=e=>{$("#sp-date").style.display=e.target.value==="custom"?"block":"none";};}});
  },
  applySchedulePick(){
    const t=topicById($("#sp-topic").value); const w=$("#sp-when").value;
    t.nextReviewAt=w==="custom"?($("#sp-date").value||addDaysKey(todayKey(),3)):addDaysKey(todayKey(),parseInt(w));
    if(!persist())return;closeModal();render();toast("Tekrar planlandı: "+fmtShort(t.nextReviewAt)); },

  /* --- Veri --- */
  exportJSON(){
    const payload={app:"StudyOS",version:DATA_VERSION,exportedAt:new Date().toISOString(),data:S};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="studyos-yedek-"+todayKey()+".json"; a.click(); URL.revokeObjectURL(a.href);
    toast("Yedek dosyası indirildi.");
  },
  importJSON(input){
    const file=input.files&&input.files[0]; input.value="";
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      let parsed,validated;
      try{
        parsed=JSON.parse(reader.result);
        const data=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)&&parsed.data?parsed.data:parsed;
        validated=validateBackupState(data);
      }catch(e){
        toast(e instanceof SyntaxError?"Dosya geçerli bir JSON değil.":e.message||"Yedek doğrulanamadı.","err",6000);
        return;
      }
      const counts={ders:validated.subjects.length,konu:validated.topics.length,sınav:validated.exams.length,
        görev:validated.tasks.length,"oturum":validated.sessions.length,"tekrar kaydı":validated.reviewLog.length};
      openModal({title:"Yedeği içe aktar",body:
        `<p class="small muted" style="margin-bottom:12px">Dosyanın yapısı, alanları ve ilişkileri doğrulandı. İçe aktarma <b>mevcut tüm verini değiştirir</b> — üzerine yazma sessizce yapılmaz.</p>
        <div class="card" style="background:var(--surface2);padding:10px 14px">
        ${Object.entries(counts).map(([k,v])=>`<div class="stat-line"><span class="muted">${k}</span><span class="v mono-num">${v}</span></div>`).join("")}</div>
        ${parsed&&parsed.exportedAt?`<div class="help">Yedek tarihi: ${esc(new Date(parsed.exportedAt).toLocaleString("tr-TR"))}</div>`:""}`,
        footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
          <button class="btn btn-danger" id="imp-go"><i data-lucide="upload"></i>Değiştir ve içe aktar</button>`,
        onMount:()=>{$("#imp-go").onclick=()=>{
          S=validated;
          document.documentElement.dataset.theme=S.settings.theme;
          if(!persist())return;closeModal();render();toast("Yedek geri yüklendi.");};}});
    };
    reader.onerror=()=>toast("Yedek dosyası okunamadı; mevcut veriler değiştirilmedi.","err",6000);
    reader.readAsText(file);
  },
  exportCSV(){
    if(!S.sessions.length){toast("Dışa aktarılacak oturum yok.","warn");return;}
    const rows=[["Tarih","Ders","Konu","Tür","Süre (dk)","Soru","Doğru","Not","Kaynak"]];
    for(const s of [...S.sessions].sort((a,b)=>a.startedAt<b.startedAt?-1:1)){
      rows.push([dayKey(new Date(s.startedAt)),subjName(s.subjectId)||s.subjectName||"—",
        topicById(s.topicId)?.title||"—",SESSION_TYPES[s.type]||s.type,
        Math.round(s.elapsedMs/60000),s.qAttempted||0,s.qCorrect||0,(s.notes||"").replace(/[\n;]/g," "),
        s.demo?"DEMO":"gerçek"]);}
    const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="studyos-oturumlar-"+todayKey()+".csv"; a.click(); URL.revokeObjectURL(a.href);
    toast("CSV indirildi (Excel uyumlu, ; ayraçlı).");
  },
  removeDemo(){
    const n=S.sessions.filter(s=>s.demo).length;
    confirmDialog({title:"Demo verisini kaldır",confirmText:"Demo kayıtlarını sil",
      message:`Başlangıçta yüklenen <b>${n} demo oturumu</b> silinecek ve demo istatistikleri sıfırlanacak. Eklediğin dersler, konular ve kendi kayıtların korunur.`,
      onConfirm:()=>{S.sessions=S.sessions.filter(s=>!s.demo);S.settings.demoActive=false;
        if(!persist())return;render();toast("Demo verisi kaldırıldı; artık yalnızca kendi kayıtların gösteriliyor.");}});
  },
  wipeAll(){
    confirmDialog({title:"Tüm verileri sıfırla",confirmText:"Her şeyi sil",
      message:`<b>Dersler, konular, sınavlar, görevler, oturumlar ve tekrar geçmişi dahil her şey silinir</b> ve boş bir çalışma alanıyla başlanır. Bu işlem geri alınamaz — önce JSON yedek alman önerilir.`,
      onConfirm:()=>{S=blankState();if(!persist())return;render();toast("Çalışma alanı sıfırlandı.","ok");}});
  },
  shiftPlan, calNav, setRange, setAnaSubj,
};
window.App=App;

/* ---------- 19) Başlat ---------- */
document.documentElement.dataset.theme=S.settings.theme;
let rzT;
window.addEventListener("hashchange",()=>{ syncRouteFromHash(); render(); window.scrollTo({top:0}); });
window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(UI.route==="analytics")render();},200);});
syncRouteFromHash();
renderShell(); render();
if(!storageOK)setTimeout(()=>toast("Tarayıcı depolaması kullanılamıyor (gizli mod olabilir); veriler sayfa kapanınca kaybolacak.","warn",7000),800);
