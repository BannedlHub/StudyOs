/*
 * Yerel depolama ve IndexedDB işlemlerini içerir.
 * constants.js dosyasına dayanır.
 * Başlangıç, ayarlar ve görsel kullanan görünümler tarafından kullanılır.
 */
"use strict";

function schoolScheduleRequest(action,value){
  return new Promise((resolve,reject)=>{
    let request,settled=false;
    const fail=error=>{if(!settled){settled=true;reject(error);}};
    try{request=indexedDB.open(SCHOOL_SCHEDULE_DB,SCHOOL_SCHEDULE_DB_VERSION);}
    catch(e){fail(e);return;}
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(SCHOOL_SCHEDULE_STORE))db.createObjectStore(SCHOOL_SCHEDULE_STORE,{keyPath:"key"});
      if(!db.objectStoreNames.contains(QUESTION_IMAGE_STORE))db.createObjectStore(QUESTION_IMAGE_STORE,{keyPath:"key"});
    };
    request.onerror=()=>fail(request.error||new Error("IndexedDB açılamadı."));
    request.onblocked=()=>fail(new Error("Medya deposu başka bir StudyOS sekmesinde açık. Diğer sekmeyi kapatıp yeniden deneyin."));
    request.onsuccess=()=>{
      const db=request.result;
      if(settled){db.close();return;}
      let tx,result;
      try{
        tx=db.transaction(SCHOOL_SCHEDULE_STORE,action==="get"?"readonly":"readwrite");
        const store=tx.objectStore(SCHOOL_SCHEDULE_STORE);
        const op=action==="get"?store.get(SCHOOL_SCHEDULE_KEY):
          action==="put"?store.put(value):store.delete(SCHOOL_SCHEDULE_KEY);
        op.onsuccess=()=>{result=op.result;};
        op.onerror=()=>fail(op.error||new Error("Okul programı depolama işlemi başarısız oldu."));
        tx.oncomplete=()=>{db.close();if(!settled){settled=true;resolve(result);}};
        tx.onerror=()=>{db.close();fail(tx.error||new Error("Okul programı depolama işlemi başarısız oldu."));};
        tx.onabort=()=>{db.close();fail(tx.error||new Error("Okul programı depolama işlemi iptal edildi."));};
      }catch(e){db.close();fail(e);}
    };
  });
}

function questionImageRequest(action,key,value){
  return new Promise((resolve,reject)=>{
    let request,settled=false;
    const fail=error=>{if(!settled){settled=true;reject(error);}};
    try{request=indexedDB.open(SCHOOL_SCHEDULE_DB,SCHOOL_SCHEDULE_DB_VERSION);}
    catch(error){fail(error);return;}
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(SCHOOL_SCHEDULE_STORE))db.createObjectStore(SCHOOL_SCHEDULE_STORE,{keyPath:"key"});
      if(!db.objectStoreNames.contains(QUESTION_IMAGE_STORE))db.createObjectStore(QUESTION_IMAGE_STORE,{keyPath:"key"});
    };
    request.onerror=()=>fail(request.error||new Error("IndexedDB açılamadı."));
    request.onblocked=()=>fail(new Error("Medya deposu başka bir StudyOS sekmesinde açık. Diğer sekmeyi kapatıp yeniden deneyin."));
    request.onsuccess=()=>{
      const db=request.result;
      if(settled){db.close();return;}
      let tx,result;
      try{
        tx=db.transaction(QUESTION_IMAGE_STORE,action==="get"?"readonly":"readwrite");
        const store=tx.objectStore(QUESTION_IMAGE_STORE);
        const op=action==="get"?store.get(key):action==="put"?store.put(value):store.delete(key);
        op.onsuccess=()=>{result=op.result;};
        op.onerror=()=>fail(op.error||new Error("Soru fotoğrafı depolama işlemi başarısız oldu."));
        tx.oncomplete=()=>{db.close();if(!settled){settled=true;resolve(result);}};
        tx.onerror=()=>{db.close();fail(tx.error||new Error("Soru fotoğrafı depolama işlemi başarısız oldu."));};
        tx.onabort=()=>{db.close();fail(tx.error||new Error("Soru fotoğrafı depolama işlemi iptal edildi."));};
      }catch(error){db.close();fail(error);}
    };
  });
}

function decodeImage(file){
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

function imageMimeFromHeader(header){
  const isPng=header.length>=8&&header[0]===0x89&&header[1]===0x50&&header[2]===0x4e&&header[3]===0x47&&
    header[4]===0x0d&&header[5]===0x0a&&header[6]===0x1a&&header[7]===0x0a;
  const isJpeg=header.length>=3&&header[0]===0xff&&header[1]===0xd8&&header[2]===0xff;
  const isWebp=header.length>=12&&String.fromCharCode(...header.subarray(0,4))==="RIFF"&&
    String.fromCharCode(...header.subarray(8,12))==="WEBP";
  return isPng?"image/png":isJpeg?"image/jpeg":isWebp?"image/webp":null;
}

async function validateImageFile(file,label){
  if(!file)return "Önce bir görsel seçin.";
  const mimeByExtension={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
  const extension=file.name.split(".").pop().toLowerCase(),expectedMime=mimeByExtension[extension];
  if(!expectedMime)return `${label} için yalnızca JPG, JPEG, PNG veya WebP yüklenebilir.`;
  if(file.type&&file.type.toLowerCase()!==expectedMime)return "Dosya uzantısı ile görsel türü eşleşmiyor.";
  if(file.size===0)return "Seçilen dosya boş.";
  if(file.size>QUESTION_IMAGE_MAX_SIZE)return `${label} en fazla 15 MB olabilir.`;
  try{
    const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const actualMime=imageMimeFromHeader(header);
    if(actualMime!==expectedMime)return "Dosyanın gerçek görsel biçimi uzantısıyla eşleşmiyor veya desteklenmiyor.";
    await decodeImage(file);
  }catch(error){
    return error?.message||"Dosya geçerli bir görsel olarak açılamadı.";
  }
  return null;
}

async function validateImportedQuestionImage(blob,mime){
  if(!(blob instanceof Blob)||blob.size===0||blob.size>QUESTION_IMAGE_MAX_SIZE)
    throw new Error("Yedekteki soru fotoğrafı boş veya 15 MB sınırını aşıyor.");
  if(!["image/jpeg","image/png","image/webp"].includes(mime)||blob.type!==mime)
    throw new Error("Yedekteki soru fotoğrafının biçimi geçersiz.");
  const header=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  if(imageMimeFromHeader(header)!==mime)throw new Error("Yedekteki soru fotoğrafının içeriği biçimiyle eşleşmiyor.");
  await decodeImage(blob);
}

function imageDataToBlob(data){
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(data);
  if(!match||match[2].length%4!==0)throw new Error("Yedekteki soru fotoğrafı geçerli bir Base64 görseli değil.");
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return {blob:new Blob([bytes],{type:match[1]}),mime:match[1]};
}

function blobToDataURL(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error||new Error("Soru fotoğrafı yedek için okunamadı."));
    reader.readAsDataURL(blob);
  });
}

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
    for(const k of["subjects","topics","exams","tasks","sessions","reviewLog","questionArchive"])
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
