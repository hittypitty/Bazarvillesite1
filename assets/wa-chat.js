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
  + '.bzwa-by{text-align:center;font-size:11px;color:#8a90a2;padding:0 0 8px}'
  + '@media(max-width:700px){.bzwa{right:14px;bottom:84px}.bzwa-fab{width:56px;height:56px}.bzwa-card{bottom:70px}}'
  + '@media print{.bzwa{display:none}}';
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var WA = '<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.12c-.25.69-1.45 1.32-2 1.4-.51.08-1.15.11-1.86-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.9-4.27-5.05-4.47-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.6.84 2.05.91 2.2.08.15.13.32.03.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.13 1 2.09 1.31 2.39 1.46.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.35.07.12.07.72-.18 1.41z"/></svg>';
  var EMOJI = ["😀","😊","😍","👍","🙏","🎁","🎉","🔥","👋","👌","💼","📦"];

  var root = document.createElement("div"); root.className = "bzwa";
  root.innerHTML = ''
    + '<div class="bzwa-card" role="dialog" aria-label="Chat on WhatsApp">'
    +   '<div class="bzwa-head"><button class="bzwa-close" aria-label="Close">×</button>'
    +     '<h4>Hi there 👋</h4><p>Welcome to ' + SHOP + '. Ask us anything 🎉</p><p class="bzwa-reply">We typically reply within a few minutes</p>'
    +     '<svg class="bzwa-wave" viewBox="0 0 350 22" preserveAspectRatio="none"><path d="M0 22V8c60 14 120 14 175 4S290-2 350 8v14z" fill="#fff"/></svg></div>'
    +   '<div class="bzwa-body"><div class="bzwa-msg"><div class="bzwa-av">' + WA + '</div><div class="bzwa-bub">Hello! 👋<br>Bulk order, custom printing ya gifting ke baare me poochhein.</div></div></div>'
    +   '<div class="bzwa-foot"><textarea class="bzwa-in" rows="1" placeholder="Type your message…"></textarea>'
    +     '<button class="bzwa-ic bzwa-emoji" type="button" aria-label="Emoji">☺</button>'
    +     '<button class="bzwa-ic bzwa-send" type="button" aria-label="Send on WhatsApp"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>'
    +     '<div class="bzwa-emo">' + EMOJI.map(function(e){ return '<button type="button">' + e + '</button>'; }).join("") + '</div></div>'
    +   '<div class="bzwa-by">Chat opens in WhatsApp</div>'
    + '</div>'
    + '<button class="bzwa-fab" type="button" aria-label="Chat with us on WhatsApp">' + WA + '<span class="bzwa-x">×</span></button>';
  document.body.appendChild(root);

  var input = root.querySelector(".bzwa-in"), emo = root.querySelector(".bzwa-emo");
  function open(on){
    root.classList.toggle("open", on);
    if(on){
      if(!input.value){
        var t = (document.title || "").split("|")[0].trim();
        input.value = "Hi " + SHOP + "! " + (t && !/^home$/i.test(t) ? "I'm looking at \"" + t + "\" — " + location.href : "I'd like to know more.");
      }
      setTimeout(function(){ input.focus(); fit(); }, 220);
    } else emo.classList.remove("on");
  }
  function fit(){ input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 110) + "px"; }
  function send(){
    var msg = input.value.trim() || ("Hi " + SHOP + "!");
    window.open("https://wa.me/" + number() + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    input.value = ""; fit(); open(false);
  }
  root.querySelector(".bzwa-fab").addEventListener("click", function(){ open(!root.classList.contains("open")); });
  root.querySelector(".bzwa-close").addEventListener("click", function(){ open(false); });
  root.querySelector(".bzwa-send").addEventListener("click", send);
  root.querySelector(".bzwa-emoji").addEventListener("click", function(){ emo.classList.toggle("on"); });
  emo.addEventListener("click", function(e){ var b = e.target.closest("button"); if(!b) return; input.value += b.textContent; input.focus(); fit(); emo.classList.remove("on"); });
  input.addEventListener("input", fit);
  input.addEventListener("keydown", function(e){ if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); send(); } });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") open(false); });
})();
