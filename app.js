// app.js — Nitishatakam MVP + Practice Set + Theme + Script switching + Recorder Compare
// - Practice set input supports: 1-10, 1,7,8, 2-5, 9, 12-14
// - Themes via <html data-theme="...">, persisted in localStorage
// - Script switching via Aksharamukha (lazy load)
// - Self-record & compare stored locally in IndexedDB (per verse + segment)
// - Robust for special verses (needsSplitPractice): singles stage uses p12+p34;
//   compare/record mapping: p1/p2->p12 and p3/p4->p34.

const verseSelect = document.getElementById("verseSelect");
const prevVerseBtn = document.getElementById("prevVerse");
const nextVerseBtn = document.getElementById("nextVerse");

const fullLine = document.getElementById("fullLine");
const meterBox = document.getElementById("meterBox");

const padaEls = [
  document.getElementById("pada1"),
  document.getElementById("pada2"),
  document.getElementById("pada3"),
  document.getElementById("pada4"),
];

const arthaSa = document.getElementById("arthaSa");
const meaningEn = document.getElementById("meaningEn");

const repSingle = document.getElementById("repSingle");
const repPairs = document.getElementById("repPairs");
const repFull = document.getElementById("repFull");
const speed = document.getElementById("speed");
const usePractice = document.getElementById("usePractice");

// value badges
const repSingleVal = document.getElementById("repSingleVal");
const repPairsVal = document.getElementById("repPairsVal");
const repFullVal = document.getElementById("repFullVal");
const speedVal = document.getElementById("speedVal");

// total plays indicator
const totalPlaysEl = document.getElementById("totalPlays");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// Single buttons (normal verses only)
const singleButtons = document.getElementById("singleButtons");
const playP1 = document.getElementById("playP1");
const playP2 = document.getElementById("playP2");
const playP3 = document.getElementById("playP3");
const playP4 = document.getElementById("playP4");

// Pair / full buttons
const playP12 = document.getElementById("playP12");
const playP34 = document.getElementById("playP34");
const playFull = document.getElementById("playFull");

const status = document.getElementById("status");
const player = document.getElementById("player");

// Practice set UI
const practiceSetInput = document.getElementById("practiceSet");
const applySetBtn = document.getElementById("applySet");
const clearSetBtn = document.getElementById("clearSet");
const setIndicator = document.getElementById("setIndicator");

// Theme UI
const themeSelect = document.getElementById("themeSelect");

// Script UI (must exist in index.html)
const scriptSelect = document.getElementById("scriptSelect");

// ---------- Compare UI (already in index.html) ----------
const compareBox = document.getElementById("compareBox");
const compareTake = document.getElementById("compareTake");
const recMine = document.getElementById("recMine");
const stopMine = document.getElementById("stopMine");
const playMine = document.getElementById("playMine");
const compareAB = document.getElementById("compareAB");
const clearMine = document.getElementById("clearMine");
const compareStatus = document.getElementById("compareStatus");

const compareEnabled =
  !!compareBox && !!compareTake && !!recMine && !!stopMine &&
  !!playMine && !!compareAB && !!clearMine && !!compareStatus;

// -------- State --------
let verses = [];
let current = null;
let stopRequested = false;

// Practice set state: array of verse indices in verses[]
let practiceSetIndices = []; // empty => not active

// ---------- UI helpers ----------
function setStatus(msg) { if (status) status.textContent = msg; }
function setCompareStatus(msg) { if (compareEnabled) compareStatus.textContent = msg; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// ---------- Theme ----------
function applyTheme(themeValue) {
  if (!themeValue || themeValue === "dark") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", themeValue);
  }
  localStorage.setItem("nitishatakam_theme", themeValue || "dark");
}
function initTheme() {
  if (!themeSelect) return;
  const saved = localStorage.getItem("nitishatakam_theme");
  if (saved) themeSelect.value = saved;
  applyTheme(themeSelect.value);
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
}

// ---------- Aksharamukha (lazy) ----------
let akInstance = null;
let akLoading = null;
const translitCache = new Map();

async function loadAksharamukha() {
  if (akInstance) return akInstance;
  if (akLoading) return akLoading;

  akLoading = new Promise((resolve, reject) => {
    if (window.Aksharamukha?.new) {
      window.Aksharamukha.new().then(inst => {
        akInstance = inst;
        resolve(inst);
      });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/aksharamukha@latest/dist/index.global.js";
    s.onload = async () => {
      try {
        akInstance = await window.Aksharamukha.new();
        resolve(akInstance);
      } catch (e) { reject(e); }
    };
    s.onerror = () => reject(new Error("Aksharamukha load failed"));
    document.head.appendChild(s);
  });

  return akLoading;
}

async function translit(text, toScript) {
  if (!text || !toScript || toScript === "Devanagari") return text;
  const key = `${toScript}::${text}`;
  if (translitCache.has(key)) return translitCache.get(key);
  const ak = await loadAksharamukha();
  const out = await ak.process("autodetect", toScript, text);
  translitCache.set(key, out);
  return out;
}

// ---------- Badges ----------
function updateSliderBadges() {
  repSingleVal.textContent = `${repSingle.value}×`;
  repPairsVal.textContent = `${repPairs.value}×`;
  repFullVal.textContent = `${repFull.value}×`;
  speedVal.textContent = `${Number(speed.value).toFixed(2)}×`;
}

// ---------- verse helpers ----------
function currentIndex() {
  if (!current) return -1;
  return verses.findIndex(v => v.id === current.id);
}
function selectVerseByIndex(idx) {
  if (!verses.length) return;
  const i = clamp(idx, 0, verses.length - 1);
  verseSelect.selectedIndex = i;
  loadVerse(verses[i]);
}

// For NORMAL verses: singles = p1,p2,p3,p4
// For SPECIAL verses: singles = p12,p34
function getSinglesSequence(v = current) {
  if (!v) return ["p1", "p2", "p3", "p4"];
  if (v.needsSplitPractice) return ["p12", "p34"];
  return ["p1", "p2", "p3", "p4"];
}

// Map segment keys for special verses:
// p1/p2 -> p12 ; p3/p4 -> p34
function normalizeKeyForVerse(key, v = current) {
  if (!v) return key;
  if (!v.needsSplitPractice) return key;
  if (key === "p1" || key === "p2") return "p12";
  if (key === "p3" || key === "p4") return "p34";
  return key; // p12/p34/full unchanged
}

// audioFor expects current.audio to already contain correct relative URLs
function audioFor(key) {
  if (!current) return null;
  if (key === "p12") return current.audio?.p12 || null;
  if (key === "p34") return current.audio?.p34 || null;
  if (key === "full") return current.audio?.full || null;
  return current.audio?.[key] || null;
}

function computeTotalPlaysForVerse(v) {
  if (!v) return 0;
  const nSingle = Number(repSingle.value);
  const nPairs = Number(repPairs.value);
  const nFull = Number(repFull.value);

  const isSpecial = !!v.needsSplitPractice;
  const singlesUnits = isSpecial ? 2 : 4;
  const singlesPlays = singlesUnits * nSingle;

  const hasP12 = !!(v.available?.p12 && v.audio?.p12);
  const hasP34 = !!(v.available?.p34 && v.audio?.p34);
  const pairUnitsPerCycle = (hasP12 ? 1 : 0) + (hasP34 ? 1 : 0);
  const pairsPlays = pairUnitsPerCycle * nPairs;

  return singlesPlays + pairsPlays + nFull;
}

function updateRunSummary() {
  const perVerse = computeTotalPlaysForVerse(current);
  if (practiceSetIndices.length > 0) {
    totalPlaysEl.textContent = String(perVerse * practiceSetIndices.length);
  } else {
    totalPlaysEl.textContent = String(perVerse);
  }
}

// ---------- Practice set parsing ----------
function parsePracticeSet(text, maxN) {
  const raw = (text || "").trim();
  if (!raw) return [];
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  const nums = [];

  for (const part of parts) {
    const r = part.replace(/\s+/g, "");
    if (/^\d+$/.test(r)) { nums.push(Number(r)); continue; }
    if (/^\d+-\d+$/.test(r)) {
      const [a, b] = r.split("-").map(Number);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      for (let k = lo; k <= hi; k++) nums.push(k);
      continue;
    }
    throw new Error(`Invalid token: "${part}"`);
  }

  const seen = new Set();
  const unique = [];
  for (const n of nums) {
    if (!Number.isFinite(n)) continue;
    if (n < 1 || n > maxN) continue;
    if (!seen.has(n)) { seen.add(n); unique.push(n); }
  }
  return unique;
}

function applyPracticeSetFromInput() {
  try {
    const wanted = parsePracticeSet(practiceSetInput.value, verses.length);
    if (wanted.length === 0) {
      practiceSetIndices = [];
      setIndicator.textContent = "";
      updateRunSummary();
      setStatus("Set empty. (Single-verse mode)");
      return;
    }
    practiceSetIndices = wanted.map(n => n - 1);
    const label = wanted.join(", ");
    setIndicator.textContent = `Practicing set: ${label} (${practiceSetIndices.length} verses)`;
    updateRunSummary();
    setStatus("Set applied.");
  } catch (e) {
    setStatus(`Set error: ${e.message}`);
  }
}

function clearPracticeSet() {
  practiceSetInput.value = "";
  practiceSetIndices = [];
  setIndicator.textContent = "";
  updateRunSummary();
  setStatus("Set cleared. (Single-verse mode)");
}

// ---------- audio ----------
async function playSrc(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error("Missing audio src"));

    player.pause();
    player.currentTime = 0;
    player.src = src;
    player.playbackRate = Number(speed.value);

    const onEnded = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Audio error / file not found")); };

    function cleanup() {
      player.removeEventListener("ended", onEnded);
      player.removeEventListener("error", onError);
    }

    player.addEventListener("ended", onEnded);
    player.addEventListener("error", onError);

    setStatus(`Playing: ${src}`);
    player.play().catch(err => { cleanup(); reject(err); });
  });
}

async function playUnit(key) {
  if (!current) return;
  stopRequested = false;
  const norm = normalizeKeyForVerse(key, current);
  const src = audioFor(norm);
  if (!src) { setStatus("Audio missing."); return; }
  try {
    await playSrc(src);
    setStatus("Ready.");
  } catch (e) {
    setStatus(`Could not play. (${e.message})`);
  }
}

// ---------- practice runner ----------
async function runPracticeForCurrentVerse() {
  if (!current) return;

  // 1) Singles stage: each unit repeats N times before moving to next
  const seq = getSinglesSequence(current);
  for (const k of seq) {
    const src = audioFor(k);
    if (!src) continue;
    for (let i = 0; i < Number(repSingle.value); i++) {
      if (stopRequested) { setStatus("Stopped."); return; }
      await playSrc(src);
    }
  }

  // 2) Pairs stage: P12×N then P34×N
  for (const k of ["p12", "p34"]) {
    const src = audioFor(k);
    if (!src) continue;
    for (let i = 0; i < Number(repPairs.value); i++) {
      if (stopRequested) { setStatus("Stopped."); return; }
      await playSrc(src);
    }
  }

  // 3) Full stage
  const fullSrc = audioFor("full");
  for (let i = 0; i < Number(repFull.value); i++) {
    if (stopRequested) { setStatus("Stopped."); return; }
    await playSrc(fullSrc);
  }
}

async function runPractice() {
  if (!current) return;

  stopRequested = false;

  // SET MODE
  if (practiceSetIndices.length > 0) {
    setStatus("Set practice starting…");
    for (let s = 0; s < practiceSetIndices.length; s++) {
      if (stopRequested) { setStatus("Stopped."); return; }

      const idx = practiceSetIndices[s];
      const v = verses[idx];
      if (!v) continue;

      verseSelect.selectedIndex = idx;
      await loadVerse(v);

      setStatus(`Set: verse ${idx + 1} (${s + 1}/${practiceSetIndices.length})…`);
      await runPracticeForCurrentVerse();
    }
    setStatus("Done (set).");
    return;
  }

  // SINGLE-VERSE MODE
  setStatus("Playing…");
  await runPracticeForCurrentVerse();
  setStatus("Done.");
}

function stopAll() {
  stopRequested = true;
  player.pause();
  setStatus("Stopped.");
}

// ---------- render ----------
async function loadVerse(v) {
  current = v;

  const script = scriptSelect?.value || "Devanagari";

  meterBox.textContent = v.meter || "—";
  fullLine.textContent = await translit(v.full || "", script);

  const t = (usePractice.checked && v.practice) ? v.practice : v.text;
  for (let i = 0; i < 4; i++) {
    const key = "p" + (i + 1);
    const raw = t?.[key] || "";
    padaEls[i].textContent = await translit(raw, script);
  }

  arthaSa.textContent = v.gloss?.sa || "";
  meaningEn.textContent = v.gloss?.en || "";

  // Enable/disable pair buttons based on flags
  playP12.disabled = !(v.available?.p12 && v.audio?.p12);
  playP34.disabled = !(v.available?.p34 && v.audio?.p34);

  // Single buttons only for normal verses
  if (v.needsSplitPractice) {
    if (singleButtons) singleButtons.style.display = "none";
  } else {
    if (singleButtons) singleButtons.style.display = "flex";
    if (playP1) playP1.disabled = !v.audio?.p1;
    if (playP2) playP2.disabled = !v.audio?.p2;
    if (playP3) playP3.disabled = !v.audio?.p3;
    if (playP4) playP4.disabled = !v.audio?.p4;
  }

  // Prev/Next buttons
  const idx = currentIndex();
  prevVerseBtn.disabled = (idx <= 0);
  nextVerseBtn.disabled = (idx >= verses.length - 1);

  // Compare UI: adjust available segments + refresh button states
  if (compareEnabled) refreshCompareUI();

  updateSliderBadges();
  updateRunSummary();
  setStatus("Ready.");
}

// ---------- IndexedDB (recordings) ----------
const DB_NAME = "nitishatakam_recorder";
const DB_VER = 1;
const STORE = "takes";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const r = st.get(key);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

async function dbSet(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const r = st.put(val, key);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

async function dbDel(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const r = st.delete(key);
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

function takeKeyForCurrent(seg) {
  return `${current?.id || "unknown"}::${seg}`;
}

// ---------- Recorder / Compare ----------
let mediaStream = null;
let recorder = null;
let chunks = [];
let isRecording = false;

function getSelectedCompareSeg() {
  if (!compareEnabled) return "full";
  const chosen = compareTake.value || "full";
  return normalizeKeyForVerse(chosen, current);
}

function referenceSrcForSeg(seg) {
  if (seg === "full") return audioFor("full");
  return audioFor(seg);
}

async function ensureMic() {
  if (mediaStream) return mediaStream;
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return mediaStream;
}

async function startRecording() {
  if (!compareEnabled || isRecording) return;
  if (!current) return;

  const seg = getSelectedCompareSeg();
  setCompareStatus(`Recording: ${seg}…`);

  try {
    const stream = await ensureMic();
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      isRecording = false;
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      await dbSet(takeKeyForCurrent(seg), blob);
      setCompareStatus(`Saved: ${seg}`);
      await refreshCompareUI();
    };
    recorder.start();
    isRecording = true;

    recMine.disabled = true;
    stopMine.disabled = false;
  } catch (e) {
    setCompareStatus(`Mic error: ${e.message}`);
  }
}

async function stopRecording() {
  if (!compareEnabled || !isRecording || !recorder) return;
  recorder.stop();
  recMine.disabled = false;
  stopMine.disabled = true;
}

async function playMineTake() {
  if (!compareEnabled || !current) return;
  const seg = getSelectedCompareSeg();
  const blob = await dbGet(takeKeyForCurrent(seg));
  if (!blob) { setCompareStatus("No recording yet."); return; }
  const url = URL.createObjectURL(blob);
  try {
    await playSrc(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

async function clearMineTake() {
  if (!compareEnabled || !current) return;
  const seg = getSelectedCompareSeg();
  await dbDel(takeKeyForCurrent(seg));
  setCompareStatus(`Cleared: ${seg}`);
  await refreshCompareUI();
}

async function compareABRun() {
  if (!compareEnabled || !current) return;
  const seg = getSelectedCompareSeg();

  const ref = referenceSrcForSeg(seg);
  const blob = await dbGet(takeKeyForCurrent(seg));
  if (!ref) { setCompareStatus("Reference audio missing."); return; }
  if (!blob) { setCompareStatus("Record your take first."); return; }

  setCompareStatus(`A→B: ${seg}`);

  // A: reference
  await playSrc(ref);

  // short pause
  await new Promise(r => setTimeout(r, 250));

  // B: mine
  const url = URL.createObjectURL(blob);
  try {
    await playSrc(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  setCompareStatus("Ready.");
}

async function refreshCompareUI() {
  if (!compareEnabled || !current) return;

  // Disable impossible options for special verses:
  // show options, but disable those that map to missing audio.
  const isSpecial = !!current.needsSplitPractice;

  // For special: p1/p2 map to p12; p3/p4 map to p34. We allow selecting them,
  // but their true availability depends on p12/p34 existing.
  const optList = Array.from(compareTake.options);

  for (const opt of optList) {
    const raw = opt.value;
    const mapped = normalizeKeyForVerse(raw, current);
    const ref = referenceSrcForSeg(mapped);
    opt.disabled = !ref; // if reference missing, no point
  }

  // Now update buttons based on whether "mine" exists
  const seg = getSelectedCompareSeg();
  const blob = await dbGet(takeKeyForCurrent(seg));

  playMine.disabled = !blob;
  clearMine.disabled = !blob;
  compareAB.disabled = !(blob && referenceSrcForSeg(seg));

  // recording buttons state
  recMine.disabled = isRecording;
  stopMine.disabled = !isRecording;

  if (!blob) setCompareStatus("Ready. (Record a take)");
  else setCompareStatus("Ready.");
}

// ---------- init ----------
async function init() {
  initTheme();
  updateSliderBadges();

  // Script preference
  if (scriptSelect) {
    const savedScript = localStorage.getItem("nitishatakam_script");
    if (savedScript) scriptSelect.value = savedScript;
    scriptSelect.addEventListener("change", async () => {
      localStorage.setItem("nitishatakam_script", scriptSelect.value);
      translitCache.clear();
      if (current) await loadVerse(current);
    });
  }

  try {
    const resp = await fetch("data/verses.json", { cache: "no-store" });
    verses = await resp.json();

    verseSelect.innerHTML = "";
    verses.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.title || v.id;
      verseSelect.appendChild(opt);
    });

    if (verses.length > 0) await loadVerse(verses[0]);
    else setStatus("No verses found in data/verses.json");
  } catch (e) {
    setStatus("Failed to load data/verses.json. Run local server and regenerate JSON.");
    return;
  }

  verseSelect.addEventListener("change", async () => {
    const v = verses[verseSelect.selectedIndex];
    if (v) await loadVerse(v);
  });

  prevVerseBtn.addEventListener("click", () => {
    const idx = currentIndex();
    if (idx > 0) selectVerseByIndex(idx - 1);
  });

  nextVerseBtn.addEventListener("click", () => {
    const idx = currentIndex();
    if (idx >= 0 && idx < verses.length - 1) selectVerseByIndex(idx + 1);
  });

  window.addEventListener("keydown", (e) => {
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if (tag === "select" || tag === "input" || tag === "textarea") return;
    if (e.key === "ArrowLeft") prevVerseBtn.click();
    if (e.key === "ArrowRight") nextVerseBtn.click();
  });

  [repSingle, repPairs, repFull, speed].forEach(el => {
    el.addEventListener("input", () => {
      updateSliderBadges();
      updateRunSummary();
    });
  });

  usePractice.addEventListener("change", async () => { if (current) await loadVerse(current); });

  startBtn.addEventListener("click", () => runPractice().catch(() => {}));
  stopBtn.addEventListener("click", stopAll);

  // Audio buttons
  playP1?.addEventListener("click", () => playUnit("p1"));
  playP2?.addEventListener("click", () => playUnit("p2"));
  playP3?.addEventListener("click", () => playUnit("p3"));
  playP4?.addEventListener("click", () => playUnit("p4"));

  playP12.addEventListener("click", () => playUnit("p12"));
  playP34.addEventListener("click", () => playUnit("p34"));
  playFull.addEventListener("click", () => playUnit("full"));

  // Tap-to-play padas (same mapping logic)
  const canonical = ["p1", "p2", "p3", "p4"];
  padaEls.forEach((el, i) => {
    el.addEventListener("click", () => playUnit(canonical[i]));
  });

  // Practice set
  applySetBtn?.addEventListener("click", applyPracticeSetFromInput);
  clearSetBtn?.addEventListener("click", clearPracticeSet);

  // Theme
  themeSelect?.addEventListener("change", () => applyTheme(themeSelect.value));

  // Compare events
  if (compareEnabled) {
    compareTake.addEventListener("change", () => refreshCompareUI());
    recMine.addEventListener("click", startRecording);
    stopMine.addEventListener("click", stopRecording);
    playMine.addEventListener("click", playMineTake);
    compareAB.addEventListener("click", () => compareABRun().catch(() => {}));
    clearMine.addEventListener("click", clearMineTake);
    refreshCompareUI();
  }

  updateRunSummary();
  setStatus("Loaded.");
}

init();
