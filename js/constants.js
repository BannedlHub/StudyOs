/*
 * Uygulama sabitlerini ve başlangıç ayar/model yardımcılarını içerir.
 * helpers.js dosyasına dayanır.
 * Depolama, durum ve görünümler tarafından kullanılır.
 */
"use strict";

/* ---------- 2) Sabitler & modeller ---------- */
const STORAGE_KEY="studyos-data"; const DATA_VERSION=1; const QUESTION_STATS_VERSION=1;
const SCHOOL_SCHEDULE_DB="studyos-media"; const SCHOOL_SCHEDULE_DB_VERSION=2;
const SCHOOL_SCHEDULE_STORE="assets"; const QUESTION_IMAGE_STORE="question-images"; const SCHOOL_SCHEDULE_KEY="weekly-schedule";
const QUESTION_SUBJECTS=["Matematik","Fizik","Kimya","Biyoloji","Diğer"];
const QUESTION_REASONS=["Konuyu bilmiyorum","Yöntem bulamadım","İşlem hatası","Dikkatsizlik","Diğer"];
const QUESTION_STATUSES=["Çözemedim","Tekrar çözeceğim","Öğrendim"];
const QUESTION_IMAGE_MAX_SIZE=15*1024*1024;
const TOPIC_STATUS={baslanmadi:"Başlanmadı",calisiliyor:"Çalışılıyor",tekrar:"Tekrar Gerekli",ogrenildi:"Öğrenildi"};
const SESSION_TYPES={konu:"Konu öğrenme",soru:"Soru çözümü",tekrar:"Tekrar",deneme:"Deneme sınavı",odev:"Ödev"};
const PRIOS={1:{l:"Yüksek",c:"var(--danger)"},2:{l:"Normal",c:"var(--warn)"},3:{l:"Düşük",c:"var(--faint)"}};
const SUBJ_COLORS=["#8d9bf0","#4cc38a","#dfb35d","#e26873","#6bb7e0","#c39be0","#7fd0c1","#e0937a"];
const REVIEW_OPTIONS=[{d:1,l:"Yarın"},{d:3,l:"3 gün sonra"},{d:7,l:"7 gün sonra"},{d:14,l:"14 gün sonra"}];
const FEEDBACK={kolay:"Kolaydı",zor:"Zordu",hatirlayamadim:"Hatırlayamadım"};

function defaultSettings(){return{ name:"",theme:"dark",weekStart:1,dailyTargetMin:180,dailyMaxMin:300,
  studyDays:[1,2,3,4,5,6],restDays:[0],sessionLen:40,breakLen:10,examWarnDays:5,dateStyle:"uzun",demoActive:true };}
function blankState(){return{ version:DATA_VERSION, questionStatsVersion:QUESTION_STATS_VERSION, settings:defaultSettings(), subjects:[],topics:[],exams:[],tasks:[],sessions:[],reviewLog:[],questionArchive:[],activeSession:null };}
