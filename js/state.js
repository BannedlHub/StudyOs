/*
 * Kalıcı uygulama verisi S ve arayüz durumu UI değerlerini başlatır.
 * storage.js ve demo.js dosyalarına dayanır.
 * Tüm uygulama modülleri kullanır.
 */
"use strict";

/* ---------- 5) Genel durum ---------- */
let S=loadState();
lastSavedStateJSON=JSON.stringify(S);
const UI={route:"overview",topicQ:"",topicSubj:"all",topicStatus:"all",topicSort:"exam",topicSel:new Set(),
  calY:new Date().getFullYear(),calM:new Date().getMonth(),plannerView:"hafta",plannerDate:todayKey(),
  anaRange:"7",anaFrom:addDaysKey(todayKey(),-29),anaTo:todayKey(),anaSubj:"all",
  schoolScheduleRequest:0,schoolScheduleUrl:null,schoolScheduleSaving:false,
  questionSubject:"all",questionTopic:"",questionStatus:"all",questionSearch:"",
  questionArchiveRender:0,questionArchiveUrls:[],questionModalUrl:null,questionModalRequest:0,
  backupImportRequest:0};
