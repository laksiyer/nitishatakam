// app.js — Nitishatakam MVP (robust for special verses)
// - Prev/Next arrows
// - Live slider badges
// - Total plays estimate
// - Special verse mode: singles stage uses p12 + p34 (because you may not have p3/p4 files)
// - Tap-to-play routes p1/p2 -> p12 and p3/p4 -> p34 for special verses
// - Correct repeat semantics:
//    * Pāda repeat N: P1×N -> P2×N -> P3×N -> P4×N (special: P12×N -> P34×N)
//    * Pair repeat N: P12×N -> P34×N
// - NEW: P1/P2/P3/P4 buttons for normal verses only

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

// NEW single buttons
const singleButtons = document.getElementById("singleButtons");
const playP1 = document.getElementById("playP1");
const playP2 = document.getElementById("playP2");
const playP3 = document.getElementById("playP3");
const playP4 = document.getElementById("playP4");

// existing
const playP12 = document.getElementById("playP12");
const playP34 = document.getElementById("playP34");
const playFull = document.getElementById("playFull");

const status = document.getElementById("status");
const player = document.getElementById("player");

let verses = [];
let current = null;
let stopRequested = false;

// ---------- UI helpers ----------
function setStatus(msg) { status.textContent = msg; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

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
// For SPECIAL verses: singles = p12,p34  (matches your actual audio inventory)
function getSinglesSequence() {
  if (!current) return ["p1", "p2", "p3", "p4"];
  if (current.needsSplitPractice) return ["p12", "p34"];
  return ["p1", "p2", "p3", "p4"];
}

function audioFor(key) {
  if (!current) return null;
  if (key === "p12") return current.audio?.p12 || null;
  if (key === "p34") return current.audio?.p34 || null;
  return current.audio?.[key] || null;
}

// Total plays: (#singles units)*repSingle + (#pair units available)*repPairs + repFull
function computeTotalPlays() {
  if (!current) return 0;

  const nSingle = Number(repSingle.value);
  const nPairs = Number(repPairs.value);
  const nFull = Number(repFull.value);

  const singlesUnits = getSinglesSequence().length;
  const singlesPlays = singlesUnits * nSingle;

  const hasP12 = !!(current.available?.p12 && current.audio?.p12);
  const hasP34 = !!(current.available?.p34 && current.audio?.p34);
  const pairUnitsPerCycle = (hasP12 ? 1 : 0) + (hasP34 ? 1 : 0);
  const pairsPlays = pairUnitsPerCycle * nPairs;

  return singlesPlays + pairsPlays + nFull;
}

function updateRunSummary() {
  if (totalPlaysEl) totalPlaysEl.textContent = String(computeTotalPlays());
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

// NEW helper: play a unit key once
async function playUnit(key) {
  if (!current) return;
  stopRequested = false;
  const src = audioFor(key);
  if (!src) { setStatus("Audio missing."); return; }
  try {
    await playSrc(src);
    setStatus("Ready.");
  } catch (e) {
    setStatus(`Could not play. (${e.message})`);
  }
}

// ---------- practice runner ----------
async function runPractice() {
  if (!current) return;

  stopRequested = false;
  setStatus("Playing…");

  try {
    // 1) Singles stage (each unit repeats N times before moving to next)
    const seq = getSinglesSequence();
    for (const k of seq) {
      const src = audioFor(k);
      if (!src) continue;

      for (let i = 0; i < Number(repSingle.value); i++) {
        if (stopRequested) { setStatus("Stopped."); return; }
        await playSrc(src);
      }
    }

    // 2) Pairs stage (P12×N then P34×N)
    const pairKeys = ["p12", "p34"];
    for (const k of pairKeys) {
      const src = audioFor(k);
      if (!src) continue;

      for (let i = 0; i < Number(repPairs.value); i++) {
        if (stopRequested) { setStatus("Stopped."); return; }
        await playSrc(src);
      }
    }

    // 3) Full stage
    const fullSrc = current.audio?.full || null;
    for (let i = 0; i < Number(repFull.value); i++) {
      if (stopRequested) { setStatus("Stopped."); return; }
      await playSrc(fullSrc);
    }

    setStatus("Done.");
  } catch (e) {
    setStatus(`Could not play audio. Check file paths. (${e.message})`);
  }
}

function stopAll() {
  stopRequested = true;
  player.pause();
  setStatus("Stopped.");
}

// ---------- render ----------
function loadVerse(v) {
  current = v;

  meterBox.textContent = v.meter || "—";
  fullLine.textContent = v.full || "";

  const t = (usePractice.checked && v.practice) ? v.practice : v.text;
  padaEls.forEach((el, i) => {
    const key = "p" + (i + 1);
    el.textContent = t?.[key] || "";
  });

  arthaSa.textContent = v.gloss?.sa || "";
  meaningEn.textContent = v.gloss?.en || "";

  // Enable/disable pair buttons based on flags
  playP12.disabled = !(v.available?.p12 && v.audio?.p12);
  playP34.disabled = !(v.available?.p34 && v.audio?.p34);

  // NEW: show P1–P4 buttons only for normal verses (no clashes with verse 1)
  if (v.needsSplitPractice) {
    singleButtons.style.display = "none";
  } else {
    singleButtons.style.display = "flex";
    // Also disable individual buttons if audio missing (future-proof)
    playP1.disabled = !v.audio?.p1;
    playP2.disabled = !v.audio?.p2;
    playP3.disabled = !v.audio?.p3;
    playP4.disabled = !v.audio?.p4;
  }

  // Prev/Next buttons
  const idx = currentIndex();
  prevVerseBtn.disabled = (idx <= 0);
  nextVerseBtn.disabled = (idx >= verses.length - 1);

  updateSliderBadges();
  updateRunSummary();
  setStatus("Ready.");
}

// ---------- init ----------
async function init() {
  try {
    const resp = await fetch("data/verses.json");
    verses = await resp.json();

    verseSelect.innerHTML = "";
    verses.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = v.title || v.id;
      verseSelect.appendChild(opt);
    });

    if (verses.length > 0) selectVerseByIndex(0);
    else setStatus("No verses found in data/verses.json");
  } catch (e) {
    setStatus("Failed to load data/verses.json. Run local server and regenerate JSON.");
    return;
  }

  verseSelect.addEventListener("change", () => {
    const v = verses[verseSelect.selectedIndex];
    if (v) loadVerse(v);
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

  usePractice.addEventListener("change", () => { if (current) loadVerse(current); });

  startBtn.addEventListener("click", runPractice);
  stopBtn.addEventListener("click", stopAll);

  // NEW: Single buttons (only visible on normal verses)
  playP1.addEventListener("click", () => playUnit("p1"));
  playP2.addEventListener("click", () => playUnit("p2"));
  playP3.addEventListener("click", () => playUnit("p3"));
  playP4.addEventListener("click", () => playUnit("p4"));

  // Direct buttons (pairs/full)
  playP12.addEventListener("click", () => playUnit("p12"));
  playP34.addEventListener("click", () => playUnit("p34"));
  playFull.addEventListener("click", () => playUnit("full"));

  // Tap-to-play padas:
  // normal verse: p1->p1, p2->p2, p3->p3, p4->p4
  // special verse: p1/p2 -> p12, p3/p4 -> p34
  const canonical = ["p1", "p2", "p3", "p4"];
  padaEls.forEach((el, i) => {
    el.addEventListener("click", async () => {
      if (!current) return;
      stopRequested = false;

      let key = canonical[i];
      if (current.needsSplitPractice) {
        key = (i < 2) ? "p12" : "p34";
      }

      await playUnit(key);
    });
  });

  updateSliderBadges();
  updateRunSummary();
}

init();
