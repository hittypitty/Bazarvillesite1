/* Floating WhatsApp chat widget — green bubble bottom-right; opens a small chat card
   ("Hi there 👋 …", "We typically reply within a few minutes") and sends the typed message to the shop's WhatsApp. */
(function(){
  "use strict";
  if(window.__bzWaChat) return; window.__bzWaChat = true;
  var SHOP = "Bazarville";
  function number(){
    try{ if(typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.whatsappNumber) return String(SETTINGS.whatsappNumber).replace(/\D/g,""); }catch(e){}
    return "919827869031";
  }
  var css = ''
  + '.bzwa{position:fixed;right:20px;bottom:20px;z-index:90;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
  + '.bzwa *{box-sizing:border-box}'
  + '.bzwa-fab{position:relative;width:60px;height:60px;border-radius:50%;border:0;background:#25d366;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 8px 22px rgba(37,211,102,.55);transition:transform .2s}'
  + '.bzwa-fab:hover{transform:scale(1.07)}'
  + '.bzwa-fab:before,.bzwa-fab:after{content:"";position:absolute;inset:0;border-radius:50%;background:rgba(37,211,102,.45);z-index:-1;animation:bzwaPulse 2.2s ease-out infinite}'
  + '.bzwa-fab:after{animation-delay:1.1s}'
  + '@keyframes bzwaPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}'
  + '.bzwa.open .bzwa-fab:before,.bzwa.open .bzwa-fab:after{animation:none;opacity:0}'
  + '.bzwa-fab svg{width:32px;height:32px;fill:#fff}'
  + '.bzwa-fab .bzwa-x{display:none;font-size:24px;line-height:1}'
  + '.bzwa.open .bzwa-fab svg{display:none}.bzwa.open .bzwa-fab .bzwa-x{display:block}'
  + '.bzwa-card{position:absolute;right:0;bottom:76px;width:350px;max-width:calc(100vw - 32px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.28);transform-origin:bottom right;transform:scale(.9) translateY(14px);opacity:0;pointer-events:none;transition:transform .22s cubic-bezier(.16,1,.3,1),opacity .18s}'
  + '.bzwa.open .bzwa-card{transform:none;opacity:1;pointer-events:auto}'
  + '.bzwa-head{position:relative;padding:26px 24px 44px;color:#fff;background:linear-gradient(135deg,#0b8793 0%,#25d366 100%)}'
  + '.bzwa-head h4{font-size:24px;font-weight:600;margin:0 0 6px}'
  + '.bzwa-head p{margin:0;font-size:15.5px;line-height:1.4;color:rgba(255,255,255,.88)}'
  + '.bzwa-reply{margin-top:14px!important;font-size:14px!important;color:#fff!important}'
  + '.bzwa-close{position:absolute;top:14px;right:16px;width:30px;height:30px;border:0;background:none;color:#fff;font-size:26px;line-height:1;cursor:pointer;opacity:.9}'
  + '.bzwa-wave{position:absolute;left:0;right:0;bottom:-1px;width:100%;height:22px;display:block}'
  + '.bzwa-body{padding:22px 20px 24px;min-height:120px;background:#fff}'
  + '.bzwa-msg{display:flex;gap:12px;align-items:center}'
  + '.bzwa-av{flex:none;width:44px;height:44px;border-radius:50%;background:#25d366;display:grid;place-items:center}'
  + '.bzwa-av svg{width:24px;height:24px;fill:#fff}'
  + '.bzwa-bub{background:#f0f2f7;color:#1c2333;border-radius:10px;padding:14px 18px;font-size:15px;line-height:1.4}'
  + '.bzwa-foot{border-top:1px solid #e6e8ee;display:flex;align-items:flex-end;gap:8px;padding:12px 14px;position:relative}'
  + '.bzwa-in{flex:1;border:0;outline:0;resize:none;font:inherit;font-size:15px;line-height:1.4;color:#1c2333;max-height:110px;min-height:44px;padding:8px 4px;background:transparent}'
  + '.bzwa-ic{flex:none;width:34px;height:34px;border:0;background:none;border-radius:50%;cursor:pointer;color:#4b5266;display:grid;place-items:center;font-size:21px}'
  + '.bzwa-ic:hover{background:#f0f2f7}.bzwa-ic svg{width:22px;height:22px;fill:currentColor}'
  + '.bzwa-emo{position:absolute;right:12px;bottom:62px;background:#fff;border:1px solid #e6e8ee;border-radius:12px;padding:8px;display:none;grid-template-columns:repeat(6,1fr);gap:2px;box-shadow:0 8px 24px rgba(0,0,0,.15)}'
  + '.bzwa-emo.on{display:grid}.bzwa-emo button{border:0;background:none;font-size:22px;cursor:pointer;border-radius:8px;padding:4px}.bzwa-emo button:hover{background:#f0f2f7}'
  + '.bzwa-msgs{max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}'
  + '.bzwa-row{display:flex;gap:10px;align-items:flex-end}.bzwa-row.me{justify-content:flex-end}'
  + '.bzwa-row .bzwa-av{width:34px;height:34px}.bzwa-row .bzwa-av svg{width:19px;height:19px}'
  + '.bzwa-bub{max-width:80%}.bzwa-row.me .bzwa-bub{background:#dcf8c6;border-bottom-right-radius:3px}.bzwa-row:not(.me) .bzwa-bub{border-bottom-left-radius:3px}'
  + '.bzwa-dots{display:inline-flex;gap:4px;padding:2px 0}.bzwa-dots i{width:7px;height:7px;border-radius:50%;background:#9aa1b4;animation:bzwaDot 1.1s infinite}.bzwa-dots i:nth-child(2){animation-delay:.18s}.bzwa-dots i:nth-child(3){animation-delay:.36s}'
  + '@keyframes bzwaDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}'
  + '.bzwa-chips{display:flex;flex-wrap:wrap;gap:7px;padding:2px 0 0 44px}.bzwa-chips button{border:1.5px solid #25d366;color:#0b8793;background:#fff;border-radius:99px;padding:7px 13px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}.bzwa-chips button:hover{background:#25d366;color:#fff}'
  + '.bzwa-go{display:block;width:calc(100% - 28px);margin:0 14px 12px;border:0;background:#25d366;color:#fff;border-radius:10px;padding:11px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}.bzwa-go:hover{background:#1ebe5b}'
  + '.bzwa-by{text-align:center;font-size:11px;color:#8a90a2;padding:0 0 8px}'
  + '@media(max-width:700px){.bzwa{right:14px;bottom:84px}.bzwa-fab{width:56px;height:56px}.bzwa-card{bottom:70px}}'
  + '@media print{.bzwa{display:none}}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var WA = '<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.12c-.25.69-1.45 1.32-2 1.4-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.9-4.27-5.05-4.47-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.6.84 2.05.91 2.2.08.15.13.32.03.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.13 1 2.09 1.31 2.39 1.46.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.07.12.07.72-.18 1.41z"/></svg>';
  var EMOJI = ["😀","😊","😍","👍","🙏","🎁","🎉","🔥","👋","👌","💼","📦"];

  /* ---- tiny rule-based assistant (only states things the site itself promises) ---- */
  var CHIPS = ["Bulk order", "Custom printing / logo", "Price & MOQ", "Delivery", "Talk to a person"];
  var KB = [
    {k:/\b(hi|hello|hey|namaste|hii+)\b/, a:"Namaste! 👋 Main Bazarville ka assistant hu. Bulk order, logo printing, price ya delivery — jo poochna ho poochiye."},
    {k:/(bulk|order|gifting|corporate|company|event|wedding|diwali)/, a:"Bulk aur corporate gifting hamara main kaam hai. Aap product, quantity aur kab tak chahiye bata dijiye — team quote aur design approval ke saath confirm karegi. 🎁"},
    {k:/(print|logo|brand|custom|embroider|design|uv)/, a:"Logo / branding har product pe available hai (printing options product page pe diye hote hain). Dispatch se pehle design approval aapko bheja jata hai. 🎨 Logo file WhatsApp pe bhej dijiye."},
    {k:/(price|rate|cost|kitna|kimat|moq|minimum|quantity|qty|pcs)/, a:"Price quantity ke hisaab se badalta hai — product page pe bulk tier table hota hai (jitna zyada quantity, utna kam rate). MOQ bhi har product pe likha hota hai. Prices GST ke bina hain. 💰"},
    {k:/(deliver|shipping|ship|dispatch|kab|time|days|courier|track)/, a:"Pan-India bulk shipping hoti hai. Exact timeline quantity aur design approval pe depend karti hai — team order confirm karte waqt bata degi. 🚚"},
    {k:/(gst|invoice|bill|tax)/, a:"Site pe dikhayi gayi prices GST exclusive hain. GST invoice order ke saath milta hai; details team confirm karegi. 🧾"},
    {k:/(sample|mockup|preview)/, a:"Sample / mockup ke liye apni requirement WhatsApp pe bhej dijiye, team batayegi. ✨"},
    {k:/(pay|payment|upi|bank|cod|cash|advance)/, a:"Payment ke tareeke (UPI / bank transfer / COD) order confirm karte waqt team batayegi. 💳"},
    {k:/(thank|thanks|shukriya|dhanyavad|ok|okay|theek|thik)/, a:"Aapka swagat hai! 😊 Aur kuch poochna ho to likhiye, ya neeche se WhatsApp pe seedha baat kar lijiye."},
    {k:/(person|human|call|talk|baat|agent|team|whatsapp|contact|number)/, a:"Zaroor! Neeche hare button se WhatsApp pe seedha team se baat kar sakte hain. 💬"}
  ];
  var DEFAULT_A = "Thik hai, note kar liya. 🙏 Is baare me poori detail ke liye neeche \"Continue on WhatsApp\" dabaiye — team seedha reply degi.";
  var CHIP_Q = {"Bulk order":"I want to place a bulk order", "Custom printing / logo":"Custom printing with my logo", "Price & MOQ":"What are the price and MOQ?", "Delivery":"How is the delivery?", "Talk to a person":"I want to talk to a person"};
  function reply(t){
    var low = t.toLowerCase();
    for(var i = 0; i < KB.length; i++) if(KB[i].k.test(low)) return KB[i].a;
    return DEFAULT_A;
  }

  var root = document.createElement("div"); root.className = "bzwa";
  root.innerHTML = ''
    + '<div class="bzwa-card" role="dialog" aria-label="Chat with ' + SHOP + '">'
    +   '<div class="bzwa-head"><button class="bzwa-close" aria-label="Close">×</button>'
    +     '<h4>Hi there 👋</h4><p>Welcome to ' + SHOP + '. Ask us anything 🎉</p><p class="bzwa-reply">We typically reply within a few minutes</p>'
    +     '<svg class="bzwa-wave" viewBox="0 0 350 22" preserveAspectRatio="none"><path d="M0 22V8c60 14 120 14 175 4S290-2 350 8v14z" fill="#fff"/></svg></div>'
    +   '<div class="bzwa-body"><div class="bzwa-msgs"></div></div>'
    +   '<div class="bzwa-foot"><textarea class="bzwa-in" rows="1" placeholder="Type your message…"></textarea>'
    +     '<button class="bzwa-ic bzwa-emoji" type="button" aria-label="Emoji">☺</button>'
    +     '<button class="bzwa-ic bzwa-send" type="button" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>'
    +     '<div class="bzwa-emo">' + EMOJI.map(function(e){ return '<button type="button">' + e + '</button>'; }).join("") + '</div></div>'
    +   '<button class="bzwa-go" type="button">💬 Continue on WhatsApp</button>'
    + '</div>'
    + '<button class="bzwa-fab" type="button" aria-label="Chat with us">' + WA + '<span class="bzwa-x">×</span></button>';
  document.body.appendChild(root);

  var input = root.querySelector(".bzwa-in"), emo = root.querySelector(".bzwa-emo"), msgs = root.querySelector(".bzwa-msgs");
  var log = [], started = false, chipsEl = null;
  function esc(t){ return String(t).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
  function scroll(){ msgs.scrollTop = msgs.scrollHeight; }
  function add(who, text){
    var r = document.createElement("div"); r.className = "bzwa-row" + (who === "me" ? " me" : "");
    r.innerHTML = (who === "me" ? "" : '<div class="bzwa-av">' + WA + '</div>') + '<div class="bzwa-bub">' + esc(text).replace(/\n/g, "<br>") + '</div>';
    msgs.appendChild(r); log.push((who === "me" ? "Me: " : SHOP + ": ") + text); scroll(); return r;
  }
  function botSay(text, delay){
    var r = document.createElement("div"); r.className = "bzwa-row";
    r.innerHTML = '<div class="bzwa-av">' + WA + '</div><div class="bzwa-bub"><span class="bzwa-dots"><i></i><i></i><i></i></span></div>';
    msgs.appendChild(r); scroll();
    setTimeout(function(){ r.remove(); add("bot", text); }, delay || 700);
  }
  function showChips(){
    chipsEl = document.createElement("div"); chipsEl.className = "bzwa-chips";
    chipsEl.innerHTML = CHIPS.map(function(c){ return '<button type="button">' + c + '</button>'; }).join("");
    chipsEl.addEventListener("click", function(e){ var b = e.target.closest("button"); if(b) userSay(CHIP_Q[b.textContent] || b.textContent); });
    msgs.appendChild(chipsEl); scroll();
  }
  function userSay(text){
    if(chipsEl){ chipsEl.remove(); chipsEl = null; }
    add("me", text); botSay(reply(text));
  }
  function open(on){
    root.classList.toggle("open", on);
    if(on){
      if(!started){
        started = true;
        add("bot", "Hello! 👋\nMain Bazarville ka assistant hu. Aap kis cheez me madad chahte hain?");
        setTimeout(showChips, 300);
      }
      setTimeout(function(){ input.focus(); }, 220);
    } else emo.classList.remove("on");
  }
  function fit(){ input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; }
  function send(){
    var t = input.value.trim(); if(!t) return;
    input.value = ""; fit(); userSay(t);
  }
  function toWhatsApp(){
    var t = (document.title || "").split("|")[0].trim();
    var lines = ["Hi " + SHOP + "!"];
    if(log.length){ lines.push("", "(Website chat)"); log.forEach(function(l){ if(/^Me: /.test(l)) lines.push(l.slice(4)); }); }
    else lines.push("I'd like to know more.");
    if(t && !/^home$/i.test(t) && /product|collection/i.test(location.pathname)) lines.push("", "Page: " + t + " — " + location.href);
    window.open("https://wa.me/" + number() + "?text=" + encodeURIComponent(lines.join("\n")), "_blank", "noopener");
  }
  root.querySelector(".bzwa-fab").addEventListener("click", function(){ open(!root.classList.contains("open")); });
  root.querySelector(".bzwa-close").addEventListener("click", function(){ open(false); });
  root.querySelector(".bzwa-send").addEventListener("click", send);
  root.querySelector(".bzwa-go").addEventListener("click", toWhatsApp);
  root.querySelector(".bzwa-emoji").addEventListener("click", function(){ emo.classList.toggle("on"); });
  emo.addEventListener("click", function(e){ var b = e.target.closest("button"); if(!b) return; input.value += b.textContent; input.focus(); fit(); emo.classList.remove("on"); });
  input.addEventListener("input", fit);
  input.addEventListener("keydown", function(e){ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); } });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") open(false); });
})();
