var $ = function(i){ return document.getElementById(i); };
var S = { rate: 0.8, voice: "", color: "", rb: false, mode: "kana", se: "none", vol: 0.5 };
try { Object.assign(S, JSON.parse(localStorage.getItem("gojuonS") || "{}")); } catch (e) {}
function saveS(){ try { localStorage.setItem("gojuonS", JSON.stringify(S)); } catch (e) {} }

var buf = [], pos = 0, current = null, voice = null, jaVoices = [];
var textEl = $("text"), note = $("note");
function warn(m){ note.textContent = m; }

/* ---------- 音声 ---------- */
var SAY = { "っ": "あっ", "ー": "あー" };
var NUMR = ["ゼロ","いち","に","さん","よん","ご","ろく","なな","はち","きゅう"];
function pickVoice(){
  if (!("speechSynthesis" in window)) return;
  var all = speechSynthesis.getVoices(), sel = $("voice");
  jaVoices = all.filter(function(v){ return /^ja/i.test(v.lang); });
  sel.innerHTML = "";
  if (!jaVoices.length) {
    var o0 = document.createElement("option"); o0.textContent = "日本語音声なし"; sel.appendChild(o0);
    sel.disabled = true; voice = null; return;
  }
  jaVoices.forEach(function(v){
    var o = document.createElement("option"); o.value = v.voiceURI;
    o.textContent = v.name + (v.localService ? "" : "（オンライン）"); sel.appendChild(o);
  });
  voice = jaVoices.find(function(v){ return v.voiceURI === S.voice; })
    || jaVoices.find(function(v){ return /kyoko|o-ren|google|haruka|nanami|female/i.test(v.name); })
    || jaVoices[0];
  sel.value = voice.voiceURI; sel.disabled = false;
}
function speak(t, el, lang){
  if (!("speechSynthesis" in window)) { warn("このブラウザは音声読み上げに対応していません。"); return; }
  var busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy) speechSynthesis.cancel();
  if (!voice) pickVoice();
  if (current) current.classList.remove("playing");
  var u = new SpeechSynthesisUtterance(t);
  u.lang = lang || "ja-JP";
  if (!lang && voice) u.voice = voice;
  u.rate = S.rate;
  current = el;
  if (el) el.classList.add("playing");
  var done = function(){ if (el) el.classList.remove("playing"); };
  u.onend = done; u.onerror = done;
  if (busy) setTimeout(function(){ speechSynthesis.speak(u); }, 80); else speechSynthesis.speak(u);
}

/* ---------- 入力欄（カーソル付き） ---------- */
function drawText(){
  textEl.innerHTML = "";
  var caret = function(){ var c = document.createElement("span"); c.className = "caret"; textEl.appendChild(c); return c; };
  var cEl = null;
  buf.forEach(function(c, i){
    if (i === pos) cEl = caret();
    var s = document.createElement("span"); s.className = "ch"; s.dataset.i = i; s.textContent = c; textEl.appendChild(s);
  });
  if (pos === buf.length) cEl = caret();
  textEl.classList.toggle("empty", !buf.length);
  if (cEl && cEl.scrollIntoView) cEl.scrollIntoView({ block: "nearest" });
}
textEl.addEventListener("click", function(e){
  var s = e.target.closest(".ch");
  if (s) { var r = s.getBoundingClientRect(); pos = +s.dataset.i + (e.clientX > r.left + r.width / 2 ? 1 : 0); }
  else pos = buf.length;
  drawText();
});
function insert(c){ buf.splice(pos, 0, c); pos++; drawText(); }
$("bs").addEventListener("click", function(){ if (pos > 0) { buf.splice(pos - 1, 1); pos--; drawText(); } });
$("left").addEventListener("click", function(){ if (pos > 0) { pos--; drawText(); } });
$("right").addEventListener("click", function(){ if (pos < buf.length) { pos++; drawText(); } });
$("playAll").addEventListener("click", function(){
  var t = buf.join(""); if (!t) return;
  speak(t, this, /^[A-Za-z ]+$/.test(t) ? "en-US" : null);
});
$("clear").addEventListener("click", function(){
  buf = []; pos = 0; drawText(); if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (editIndex !== null) { setEdit(null); note.textContent = ""; }
});

/* ---------- かな：フリックキー ---------- */
var KANA = ["あいうえお","かきくけこ","さしすせそ","たちつてと","なにぬねの","はひふへほ","まみむめも","や「ゆ」よ","らりるれろ","MOD","わをんーっ","、。？！…"];
var CYC = ["あぁ","いぃ","うぅゔ","えぇ","おぉ","やゃ","ゆゅ","よょ","わゎ","つっづ","かが","きぎ","くぐ","けげ","こご","さざ","しじ","すず","せぜ","そぞ","ただ","ちぢ","てで","とど","はばぱ","ひびぴ","ふぶぷ","へべぺ","ほぼぽ"];
var NEXT = {};
CYC.forEach(function(s){ var a = Array.from(s); a.forEach(function(c, i){ NEXT[c] = a[(i + 1) % a.length]; }); });
var DIRC = ["c","l","u","r","d"];
function sayChar(c, el){
  if (!c || /[「」、。？！…]/.test(c)) return;
  speak(SAY[c] || c, el);
}
var padK = $("padK");
KANA.forEach(function(s, i){
  var k = document.createElement("button"); k.type = "button"; k.className = "key";
  k.style.setProperty("--h", (i * 30) % 360);
  if (s === "MOD") {
    k.classList.add("mod"); k.textContent = "小 ゛ ゜"; k.setAttribute("aria-label", "小文字・濁点・半濁点");
    k.addEventListener("click", function(){
      var c = buf[pos - 1], n = NEXT[c];
      if (!n) return;
      buf[pos - 1] = n; drawText();
      sayChar(/[ゃゅょぁぃぅぇぉゎ]/.test(n) && pos > 1 ? buf[pos - 2] + n : n, k);
    });
    padK.appendChild(k); return;
  }
  k.classList.add("fk");
  var cs = Array.from(s), spans = [];
  cs.forEach(function(c, j){ var sp = document.createElement("span"); sp.className = DIRC[j]; sp.textContent = c; k.appendChild(sp); spans.push(sp); });
  k.setAttribute("aria-label", cs[0] + "行（フリックで" + cs.slice(1).join("・") + "）");
  var st = null;
  function mark(n){ spans.forEach(function(sp, j){ sp.classList.toggle("sel", j === n); }); st.n = n; }
  k.addEventListener("pointerdown", function(e){
    st = { x: e.clientX, y: e.clientY, n: 0 };
    try { k.setPointerCapture(e.pointerId); } catch (x) {}
    mark(0); e.preventDefault();
  });
  k.addEventListener("pointermove", function(e){
    if (!st) return;
    var dx = e.clientX - st.x, dy = e.clientY - st.y, n = 0;
    if (Math.hypot(dx, dy) > 22) n = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 3) : (dy < 0 ? 2 : 4);
    if (n !== st.n) mark(n);
  });
  k.addEventListener("pointerup", function(){
    if (!st) return;
    var c = cs[st.n]; spans.forEach(function(sp){ sp.classList.remove("sel"); }); st = null;
    if (c) { insert(c); sayChar(c, k); }
  });
  k.addEventListener("pointercancel", function(){ st = null; spans.forEach(function(sp){ sp.classList.remove("sel"); }); });
  k.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  padK.appendChild(k);
});

/* ---------- 数字 ---------- */
var padN = $("padN");
for (var d = 0; d < 10; d++) (function(d){
  var k = document.createElement("button"); k.type = "button"; k.className = "key big";
  k.style.setProperty("--h", d * 36); k.textContent = d; k.setAttribute("aria-label", d + "（" + NUMR[d] + "）");
  k.addEventListener("click", function(){ insert(String(d)); speak(NUMR[d], k); });
  padN.appendChild(k);
})(d);

/* ---------- ABC ---------- */
var padA = $("padA"), upper = true, abcKeys = [];
for (var a = 0; a < 26; a++) (function(a){
  var k = document.createElement("button"); k.type = "button"; k.className = "key big";
  k.style.setProperty("--h", a * 14);
  k.addEventListener("click", function(){ var L = k.textContent; insert(L); speak(L, k, "en-US"); });
  padA.appendChild(k); abcKeys.push(k);
})(a);
function labelABC(){ abcKeys.forEach(function(k, a){ var L = String.fromCharCode(65 + a); k.textContent = upper ? L : L.toLowerCase(); }); }
var sp = document.createElement("button"); sp.type = "button"; sp.className = "key mod"; sp.textContent = "空白";
sp.addEventListener("click", function(){ insert(" "); });
var cs2 = document.createElement("button"); cs2.type = "button"; cs2.className = "key mod"; cs2.textContent = "Aa";
cs2.setAttribute("aria-label", "大文字・小文字の切り替え");
cs2.addEventListener("click", function(){ upper = !upper; labelABC(); });
padA.appendChild(sp); padA.appendChild(cs2); labelABC();

/* ---------- ページ切り替え ---------- */
function setMode(m){
  S.mode = m; saveS();
  $("padK").hidden = m !== "kana"; $("padN").hidden = m !== "num"; $("padA").hidden = m !== "abc";
  $("modeSeg").querySelectorAll("button").forEach(function(b){ b.setAttribute("aria-pressed", b.dataset.v === m ? "true" : "false"); });
}
$("modeSeg").addEventListener("click", function(e){ var b = e.target.closest("button"); if (b) setMode(b.dataset.v); });

/* ---------- 登録した単語 ---------- */
var MAX = 10, words = [], editIndex = null, wlist = $("wlist");
try {
  var stored = JSON.parse(localStorage.getItem("gojuonWords") || "[]");
  if (Array.isArray(stored)) words = stored.filter(function(w){ return typeof w === "string" && w; }).slice(0, MAX);
} catch (e) {}
function saveWords(){ try { localStorage.setItem("gojuonWords", JSON.stringify(words)); } catch (e) {} }
function renderWords(){
  wlist.innerHTML = "";
  words.forEach(function(w, i){
    var chip = document.createElement("span"); chip.className = "chip" + (i === editIndex ? " editing" : "");
    var b = document.createElement("button"); b.type = "button"; b.className = "word"; b.dataset.i = i; b.textContent = w;
    var ed = document.createElement("button"); ed.type = "button"; ed.className = "edit"; ed.dataset.i = i; ed.textContent = "✎"; ed.setAttribute("aria-label", w + "を編集");
    var x = document.createElement("button"); x.type = "button"; x.className = "del"; x.dataset.i = i; x.textContent = "×"; x.setAttribute("aria-label", w + "を削除");
    chip.appendChild(b); chip.appendChild(ed); chip.appendChild(x); wlist.appendChild(chip);
  });
  $("wcount").textContent = words.length + "/" + MAX;
}
function setEdit(i){ editIndex = i; $("overwrite").hidden = (i === null); renderWords(); }
$("overwrite").addEventListener("click", function(){
  var t = buf.join("");
  if (editIndex === null) return;
  if (!t) return warn("上書きする内容が空です。");
  var dup = words.indexOf(t);
  if (dup !== -1 && dup !== editIndex) return warn("「" + t + "」はすでに登録されています。");
  words[editIndex] = t; saveWords(); note.textContent = ""; setEdit(null);
});
$("save").addEventListener("click", function(){
  var t = buf.join("");
  if (!t) return warn("登録する文字を、先に入力欄へ入れてください。");
  if (words.indexOf(t) !== -1) return warn("「" + t + "」はすでに登録されています。");
  if (words.length >= MAX) return warn("登録は" + MAX + "個までです。不要な単語の×で消してください。");
  words.push(t); saveWords(); renderWords(); note.textContent = "";
});
wlist.addEventListener("click", function(e){
  var w = e.target.closest(".word"), x = e.target.closest(".del"), ed = e.target.closest(".edit");
  if (w) speak(words[+w.dataset.i], w);
  else if (ed) {
    var i = +ed.dataset.i; buf = Array.from(words[i]); pos = buf.length; drawText(); setEdit(i);
    note.textContent = "「" + words[i] + "」を編集中：文字をタップでカーソル移動 →「上書き」で更新";
  } else if (x) {
    askDel(+x.dataset.i);
  }
});

/* ---------- 設定 ---------- */
function hexInk(h){
  var n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#14213d" : "#ffffff";
}
function applyColor(){
  var kb = $("kb");
  if (S.color) { kb.style.setProperty("--key", S.color); kb.style.setProperty("--keyink", hexInk(S.color)); $("color").value = S.color; }
  else { kb.style.removeProperty("--key"); kb.style.removeProperty("--keyink"); }
  kb.classList.toggle("rb", !!S.rb && !S.color);
  $("rb").checked = !!S.rb;
}
["#ffffff","#ffe8a3","#bfe3ff","#c9f0c9","#ffd0d9","#2c4a8c"].forEach(function(c){
  var b = document.createElement("button"); b.type = "button"; b.className = "sw"; b.style.background = c; b.setAttribute("aria-label", "色 " + c);
  b.addEventListener("click", function(){ S.color = c; saveS(); applyColor(); });
  $("sws").appendChild(b);
});
$("color").addEventListener("input", function(){ S.color = this.value; saveS(); applyColor(); });
$("colorReset").addEventListener("click", function(){ S.color = ""; saveS(); applyColor(); });
$("rb").addEventListener("change", function(){ S.rb = this.checked; if (S.rb) S.color = ""; saveS(); applyColor(); });
$("rate").value = S.rate;
$("rate").addEventListener("input", function(){ S.rate = parseFloat(this.value); saveS(); });
$("voice").addEventListener("change", function(){
  voice = jaVoices.find(function(v){ return v.voiceURI === this.value; }, this) || voice;
  S.voice = this.value; saveS(); speak("こんにちは", null);
});
$("setBtn").addEventListener("click", function(){ $("set").hidden = false; });
$("setClose").addEventListener("click", function(){ $("set").hidden = true; });
$("set").addEventListener("click", function(e){ if (e.target === this) this.hidden = true; });
document.addEventListener("keydown", function(e){ if (e.key === "Escape") $("set").hidden = true; });

/* ---------- フルスクリーン ---------- */
var FSMSG = "この端末ではフルスクリーンにできません。共有メニューの「ホーム画面に追加」で全画面アプリとして使えます。";
$("fsBtn").addEventListener("click", function(){
  var dc = document, el = dc.documentElement;
  try {
    if (dc.fullscreenElement || dc.webkitFullscreenElement) { (dc.exitFullscreen || dc.webkitExitFullscreen).call(dc); return; }
    var r = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!r) return warn(FSMSG);
    var p = r.call(el);
    if (p && p.catch) p.catch(function(){ warn(FSMSG); });
  } catch (e) { warn(FSMSG); }
});

/* ---------- 初期化 ---------- */
if ("speechSynthesis" in window) {
  pickVoice(); speechSynthesis.addEventListener("voiceschanged", pickVoice);
  var tries = 0, iv = setInterval(function(){ if (jaVoices.length || ++tries > 20) { clearInterval(iv); return; } pickVoice(); }, 300);
}
var delIdx = null;
function askDel(j){ delIdx = j; $("cmsg").textContent = "「" + words[j] + "」を削除しますか？"; $("cdlg").hidden = false; $("cno").focus(); }
function closeDel(){ $("cdlg").hidden = true; delIdx = null; }
$("cno").addEventListener("click", closeDel);
$("cdlg").addEventListener("click", function(e){ if (e.target === this) closeDel(); });
document.addEventListener("keydown", function(e){ if (e.key === "Escape") closeDel(); });
$("cyes").addEventListener("click", function(){
  var j = delIdx; closeDel();
  if (j === null || j >= words.length) return;
  words.splice(j, 1); saveWords();
  if (editIndex === j) setEdit(null); else { if (editIndex !== null && j < editIndex) editIndex--; renderWords(); }
});
/* ---------- 効果音 ---------- */
var AC = null;
function ac(){
  if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function tone(f1, f2, dur, type, g, delay){
  var c = ac(), v = g * S.vol; if (!c || v < 0.001) return;
  var t = c.currentTime + (delay || 0), o = c.createOscillator(), a = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t);
  if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  a.gain.setValueAtTime(v, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(a); a.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
var SE = [
  ["none", "なし", function(){}],
  ["pon", "ぽん", function(){ tone(520, 780, 0.14, "sine", 0.7); }],
  ["pi", "ピッ", function(){ tone(1400, 1400, 0.07, "square", 0.25); }],
  ["click", "カチッ", function(){ tone(260, 120, 0.05, "triangle", 0.8); }],
  ["pop", "ぷにっ", function(){ tone(300, 900, 0.1, "sine", 0.7); }],
  ["kira", "きらきら", function(){ tone(1318, 1318, 0.18, "sine", 0.5); tone(1760, 1760, 0.22, "sine", 0.5, 0.08); }],
  ["drum", "ドン", function(){ tone(180, 50, 0.2, "sine", 0.9); }]
];
function playSE(id){ for (var i = 0; i < SE.length; i++) if (SE[i][0] === id) { SE[i][2](); return; } }
SE.forEach(function(s){ var o = document.createElement("option"); o.value = s[0]; o.textContent = s[1]; $("se").appendChild(o); });
$("se").value = S.se;
$("vol").value = S.vol;
$("se").addEventListener("change", function(){ S.se = this.value; saveS(); playSE(S.se); });
$("vol").addEventListener("input", function(){ S.vol = parseFloat(this.value); saveS(); });
$("vol").addEventListener("change", function(){ playSE(S.se); });
document.addEventListener("pointerdown", function(e){ if (e.target.closest && e.target.closest(".key")) playSE(S.se); }, true);

applyColor(); setMode(S.mode || "kana"); renderWords(); drawText();
