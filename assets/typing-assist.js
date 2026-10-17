/* Admin typing assistant — spelling suggestions + auto-capitalisation for text boxes.
   - While you type, each finished word is checked against a built-in English + gifting dictionary (assets/words-en.js).
     A misspelt word shows a small bar under the box: "Did you mean … ?" with one-tap fixes, Ignore, and "Add" (adds the
     word to your own dictionary, remembered in this browser).
   - Capitalisation is fixed when you leave the box: names/titles become Title Case, sentences start with a capital letter.
   Link / number / search / code boxes are left alone. */
(function(){
  "use strict";
  var WORDS = (window.__BZ_WORDS || "").split(" ").filter(Boolean);
  if(!WORDS.length) return;
  var RANK = Object.create(null);
  WORDS.forEach(function(w, i){ RANK[w] = i; });
  var BY_LEN = {};
  WORDS.forEach(function(w){ (BY_LEN[w.length] = BY_LEN[w.length] || []).push(w); });

  var MINE = {};
  try{ JSON.parse(localStorage.getItem("bz_my_words") || "[]").forEach(function(w){ MINE[w] = 1; }); }catch(e){}
  function saveMine(){ try{ localStorage.setItem("bz_my_words", JSON.stringify(Object.keys(MINE))); }catch(e){} }

  var SKIP_ID = /slug|search|ref|sku|code|phone|number|email|pass|url|link|hex|color|colour|qty|price|moq|bulk|stock|date|time|otp|gst|pin/i;
  var NAME_ID = /name|title|label/i;
  var SMALL = {a:1,an:1,and:1,as:1,at:1,but:1,by:1,for:1,in:1,of:1,on:1,or:1,the:1,to:1,with:1,from:1};

  function eligible(el){
    if(!el || el.dataset.noAssist) return false;
    if(el.tagName === "TEXTAREA") return !SKIP_ID.test(el.id || "");
    if(el.tagName !== "INPUT") return false;
    var t = (el.getAttribute("type") || "text").toLowerCase();
    if(t !== "text" && t !== "") return false;
    return !SKIP_ID.test(el.id || "");
  }
  function nameLike(el){ return el.tagName === "INPUT" && (NAME_ID.test(el.id || "") || el.dataset.f === "k"); }

  /* ----- edit distance (Damerau–Levenshtein, bounded) ----- */
  function dist(a, b, max){
    var la = a.length, lb = b.length;
    if(Math.abs(la - lb) > max) return max + 1;
    var prev2 = null, prev = [], cur, i, j;
    for(j = 0; j <= lb; j++) prev[j] = j;
    for(i = 1; i <= la; i++){
      cur = [i]; var rowMin = i;
      for(j = 1; j <= lb; j++){
        var cost = a.charCodeAt(i-1) === b.charCodeAt(j-1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + cost);
        if(i > 1 && j > 1 && a.charCodeAt(i-1) === b.charCodeAt(j-2) && a.charCodeAt(i-2) === b.charCodeAt(j-1)) v = Math.min(v, prev2[j-2] + 1);
        cur[j] = v; if(v < rowMin) rowMin = v;
      }
      if(rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }
  function known(w){ return RANK[w] !== undefined || MINE[w] || RANK[w.replace(/'s$/, "")] !== undefined; }
  function stem(w){ // allow simple plurals / -ing / -ed forms of known words
    if(w.length > 3 && /s$/.test(w) && known(w.slice(0, -1))) return true;
    if(w.length > 4 && /es$/.test(w) && known(w.slice(0, -2))) return true;
    if(w.length > 5 && /ing$/.test(w) && (known(w.slice(0, -3)) || known(w.slice(0, -3) + "e"))) return true;
    if(w.length > 4 && /ed$/.test(w) && (known(w.slice(0, -2)) || known(w.slice(0, -1)))) return true;
    if(w.length > 4 && /(er|ly)$/.test(w) && known(w.slice(0, -2))) return true;
    return false;
  }
  function isMisspelt(raw){
    if(raw.length < 3) return false;
    if(/[0-9_@./\\#]/.test(raw)) return false;
    if(raw === raw.toUpperCase()) return false;            // acronyms: GST, MOQ, USB
    var w = raw.toLowerCase();
    return !(known(w) || stem(w));
  }
  function suggest(raw){
    var w = raw.toLowerCase(), max = w.length <= 4 ? 1 : 2, out = [];
    for(var l = w.length - max; l <= w.length + max; l++){
      var list = BY_LEN[l]; if(!list) continue;
      for(var i = 0; i < list.length; i++){
        var d = dist(w, list[i], max);
        if(d <= max) out.push({w: list[i], d: d, r: RANK[list[i]]});
      }
    }
    out.sort(function(a, b){ return a.d - b.d || a.r - b.r; });
    var first = raw.charAt(0) === raw.charAt(0).toUpperCase() && raw.charAt(0) !== raw.charAt(0).toLowerCase();
    return out.slice(0, 4).map(function(o){ return first ? o.w.charAt(0).toUpperCase() + o.w.slice(1) : o.w; });
  }

  /* ----- word finding ----- */
  var WORD_RE = /[A-Za-z][A-Za-z']*/g;
  function findBad(text, from){
    var m, res = [];
    WORD_RE.lastIndex = 0;
    while((m = WORD_RE.exec(text))){
      var start = m.index, end = start + m[0].length, w = m[0].replace(/'+$/, "");
      if(start < (from || 0)) continue;
      var before = text.charAt(start - 1), after = text.charAt(end);
      if(/[0-9@\/._-]/.test(before) || /[0-9@\/_]/.test(after)) continue;   // part of a URL / code / measurement
      if(isMisspelt(w)) res.push({word: w, start: start, end: start + w.length});
    }
    return res;
  }

  /* ----- capitalisation ----- */
  function titleCase(s){
    var first = true;
    return s.replace(/[A-Za-z][A-Za-z'’]*/g, function(w, off){
      var isFirst = first; first = false;
      if(/[0-9]/.test(s.slice(off, off + w.length + 1)) ) return w;
      if(w === w.toUpperCase() && w.length > 1) return w;                       // keep acronyms
      var lw = w.toLowerCase();
      if(!isFirst && SMALL[lw]) return lw;
      if(/[A-Z]/.test(w.slice(1)) ) return w;                                  // keep mixed case such as iPhone, PrintX
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    });
  }
  function sentenceCase(s){
    return s.replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, function(_, a, b){ return a + b.toUpperCase(); }).replace(/\bi\b(?=[\s'.,!?]|$)/g, "I");
  }
  function fixCaps(el){
    var v = el.value; if(!v) return;
    var n = nameLike(el) ? titleCase(v) : sentenceCase(v);
    if(n !== v){ el.value = n; el.dispatchEvent(new Event("input", {bubbles: true})); el.dispatchEvent(new Event("change", {bubbles: true})); }
  }

  /* ----- suggestion bar ----- */
  var bar = null, barFor = null;
  function ensureBar(){
    if(bar) return bar;
    bar = document.createElement("div");
    bar.id = "bzSuggest"; bar.className = "bz-suggest"; bar.hidden = true;
    bar.addEventListener("mousedown", function(e){ e.preventDefault(); });      // keep focus in the text box
    document.body.appendChild(bar);
    return bar;
  }
  function hideBar(){ if(bar) bar.hidden = true; barFor = null; }
  function place(el){
    var r = el.getBoundingClientRect();
    bar.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + "px";
    bar.style.top = (r.bottom + 4) + "px";
    bar.style.maxWidth = Math.min(420, window.innerWidth - 16) + "px";
  }
  function replaceRange(el, s, e, text){
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    var pos = s + text.length;
    try{ el.setSelectionRange(pos, pos); }catch(_){}
    el.dispatchEvent(new Event("input", {bubbles: true}));
  }
  function show(el, bad){
    var sg = suggest(bad.word);
    var b = ensureBar();
    b.innerHTML = "";
    var lab = document.createElement("span"); lab.className = "bz-s-label";
    lab.textContent = "“" + bad.word + "” — " + (sg.length ? "did you mean:" : "no suggestion");
    b.appendChild(lab);
    sg.forEach(function(s){
      var c = document.createElement("button"); c.type = "button"; c.className = "bz-s-chip"; c.textContent = s;
      c.addEventListener("click", function(){ replaceRange(el, bad.start, bad.end, s); hideBar(); el.focus(); check(el, true); });
      b.appendChild(c);
    });
    var add = document.createElement("button"); add.type = "button"; add.className = "bz-s-act"; add.textContent = "Add";
    add.title = "Add this word to my dictionary";
    add.addEventListener("click", function(){ MINE[bad.word.toLowerCase()] = 1; saveMine(); hideBar(); el.focus(); check(el, true); });
    var ign = document.createElement("button"); ign.type = "button"; ign.className = "bz-s-act"; ign.textContent = "Ignore";
    ign.addEventListener("click", function(){ el.__ignore = el.__ignore || {}; el.__ignore[bad.word.toLowerCase()] = 1; hideBar(); el.focus(); });
    b.appendChild(add); b.appendChild(ign);
    barFor = el; place(el); b.hidden = false;
  }
  function check(el, all){
    if(!eligible(el)){ hideBar(); return; }
    var text = el.value, caret = typeof el.selectionStart === "number" ? el.selectionStart : text.length;
    var bads = findBad(text).filter(function(b){
      if(el.__ignore && el.__ignore[b.word.toLowerCase()]) return false;
      if(all) return true;
      return b.end < caret || (b.end === caret && false);                         // only finished words, not the one being typed
    });
    if(!bads.length){ if(barFor === el) hideBar(); return; }
    show(el, bads[0]);
  }

  var timer = null;
  document.addEventListener("input", function(e){
    var el = e.target; if(!eligible(el)) return;
    clearTimeout(timer);
    timer = setTimeout(function(){ if(document.activeElement === el) check(el, false); }, 350);
  }, true);
  document.addEventListener("focusin", function(e){ if(eligible(e.target)) check(e.target, false); else if(!(bar && bar.contains(e.target))) hideBar(); });
  document.addEventListener("focusout", function(e){
    var el = e.target; if(!eligible(el)) return;
    fixCaps(el);
    setTimeout(function(){ if(document.activeElement !== el && !(bar && bar.contains(document.activeElement))) hideBar(); }, 150);
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") hideBar();
    if(e.key === "Enter" && eligible(e.target) && e.target.tagName === "INPUT") fixCaps(e.target);
  }, true);
  window.addEventListener("scroll", function(){ if(barFor) place(barFor); }, true);
  window.addEventListener("resize", function(){ if(barFor) place(barFor); });
})();
