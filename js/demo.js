/*
 * İlk açılışta kullanılan örnek veriyi üretir.
 * helpers.js ve constants.js dosyalarına dayanır.
 * state.js başlangıç verisi yokken kullanır.
 */
"use strict";

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

/* backup* yardımcıları her alanın tipini, sınırını ve biçimini tek noktada doğrular.
   Doğrulama başarısızsa ortak hata üretir; bozuk veya birbiriyle tutarsız yedek uygulama durumuna karışmaz. */
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
/* Önce alanları tek tek doğrular, sonra kimlik ve ders/konu ilişkilerini çapraz kontrol eder.
   İçe aktarma ancak tamamı tutarlı bir durum döndürünce başlayabilir; mevcut kayıt kısmi yedekle ezilmez. */
function validateBackupState(input){
  if(!input||typeof input!=="object"||Array.isArray(input))backupError("ana kayıt nesnesi eksik.");
  for(const key of ["subjects","topics","sessions"])
    if(!Array.isArray(input[key]))backupError(key+" listesi eksik.");
  for(const key of ["exams","tasks","reviewLog"])
    if(input[key]!=null&&!Array.isArray(input[key]))backupError(key+" listesi geçersiz.");
  if(input.questionArchive!=null&&!Array.isArray(input.questionArchive))backupError("soru arşivi listesi geçersiz.");
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
  result.questionArchive=(input.questionArchive||[]).map((item,i)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))backupError("arşiv sorusu geçersiz.");
    const label="Arşiv sorusu "+(i+1),subject=backupText(item.subject,label+" dersi",30);
    if(!QUESTION_SUBJECTS.includes(subject))backupError(label+" dersi tanınmıyor.");
    const reason=backupText(item.reason,label+" nedeni",40),status=backupText(item.status,label+" durumu",30);
    if(!QUESTION_REASONS.includes(reason))backupError(label+" çözüm nedeni tanınmıyor.");
    if(!QUESTION_STATUSES.includes(status))backupError(label+" durumu tanınmıyor.");
    const imageId=item.imageId==null?null:backupId(item.imageId,label+" fotoğraf kimliği");
    const imageData=item.imageData==null?null:backupText(item.imageData,label+" fotoğrafı",Math.ceil(QUESTION_IMAGE_MAX_SIZE*4/3)+64);
    if((imageId&&!imageData)||(!imageId&&imageData))backupError(label+" fotoğraf verisi eksik veya eşleşmiyor.");
    if(imageData&&(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(imageData)||
      imageData.split(",")[1].length%4!==0))backupError(label+" fotoğraf verisi geçersiz.");
    return {...item,id:uniqueId(item.id,label),subject,
      topic:backupText(item.topic,label+" konusu",120),
      reason,notes:backupText(item.notes,label+" notu",5000,true),
      solution:backupText(item.solution,label+" çözümü",5000,true),
      createdAt:backupTimestamp(item.createdAt,label+" oluşturulma zamanı"),
      status,imageId,imageData};
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
