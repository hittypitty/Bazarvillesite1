/* Bazarville POS — standalone counter-billing terminal (pos.html).
   Uses the same Supabase data as Admin → Inventory → POS (orders with source "pos", pos_holds, products.color_stock),
   so stock, history and the dashboard stay in sync. */
(function(){
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money = n => "₹" + (Math.round((Number(n)||0)*100)/100).toLocaleString("en-IN", {maximumFractionDigits:2});
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

/* ---------------- state ---------------- */
let PRODUCTS = [], cart = [], payMode = "cash", activeCat = "", holds = [], posOrders = [];
let me = null, vSel = null, lastReceipt = null, editing = null;
const SKEY = "bz_pos_settings";
const DEFAULTS = {name:"Bazarville", tag:"Corporate gifting & custom printing", addr:"", phone:"9827869031", gstin:"", foot:"Thank you! Visit again.", paper:"80", autoReceipt:false, gstOn:false, gstRate:"18", gstMode:"excl"};
let S = Object.assign({}, DEFAULTS);
try{ Object.assign(S, JSON.parse(localStorage.getItem(SKEY)||"{}")); }catch(e){}
function saveS(){ try{ localStorage.setItem(SKEY, JSON.stringify(S)); }catch(e){} }

function toast(msg, type){
  const t = document.createElement("div"); t.className = "px-toast " + (type||""); t.textContent = msg;
  $("#toasts").appendChild(t); setTimeout(()=>t.remove(), type==="err" ? 6000 : 2600);
}
function busy(btn, on, txt){ if(!btn) return; if(on){ btn.dataset.t = btn.innerHTML; btn.innerHTML = txt; btn.disabled = true; } else { btn.innerHTML = btn.dataset.t || btn.innerHTML; btn.disabled = false; } }

/* ---------------- login ---------------- */
function allowed(a){
  if(!a) return false;
  if(a.role === "super" || a.role === "super_admin" || a.role === "admin" || a.role === "owner") return true;
  if(!Array.isArray(a.permissions)) return true;
  return a.permissions.includes("inventory");
}
async function boot(){
  document.body.className = "paper-" + S.paper;
  const a = await BazDS.getCurrentAdmin().catch(()=>null);
  if(a && allowed(a)) return start(a);
  $("#loginScreen").hidden = false;
  if(a && !allowed(a)) { $("#liErr").textContent = "Is account ko POS/Inventory ka access nahi hai."; }
}
$("#liBtn").addEventListener("click", async ()=>{
  const btn = $("#liBtn"); $("#liErr").textContent = "";
  busy(btn, true, "Signing in…");
  try{
    await BazDS.signIn($("#liEmail").value.trim(), $("#liPass").value);
    const a = await BazDS.getCurrentAdmin();
    if(!a) throw new Error("Is account ka admin profile nahi mila.");
    if(!allowed(a)) throw new Error("Is account ko POS/Inventory ka access nahi hai.");
    start(a);
  }catch(e){ $("#liErr").textContent = e.message || "Sign in nahi hua."; }
  finally{ busy(btn, false); }
});
$("#liPass").addEventListener("keydown", e => { if(e.key === "Enter") $("#liBtn").click(); });

async function start(a){
  me = a;
  $("#loginScreen").hidden = true; $("#app").hidden = false;
  applySettingsUI();
  tick(); setInterval(tick, 15000);
  window.addEventListener("online", netState); window.addEventListener("offline", netState); netState();
  try{ PRODUCTS = await BazDS.getProducts(); }catch(e){ console.error(e); toast("Products load nahi hue — internet check karo","err"); }
  renderCats(); renderGrid(); renderCart();
  await refreshHolds(); await refreshOrders(); newBillNo();
  $("#search").focus();
}
function tick(){
  const d = new Date();
  $("#clock").textContent = d.toLocaleString("en-IN",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
  $("#billDate").textContent = d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function netState(){ const n = $("#net"); n.textContent = navigator.onLine ? "● Online" : "● Offline"; n.classList.toggle("off", !navigator.onLine); }

/* ---------------- products ---------------- */
const isPos = o => o.source === "pos" || String(o.ref||"").startsWith("BZP-");
function stockTotal(p){
  const v = Object.values(p.colorStock||{}).filter(x=>x!=null && !isNaN(x)).map(Number);
  return v.length ? v.reduce((a,b)=>a+b,0) : null;
}
function stockKey(p, color){ const cs = p.colorStock||{}; return (color && cs[color]!=null) ? color : (cs._total!=null ? "_total" : null); }
function stockLeft(p, color){ const k = stockKey(p, color); return k ? Number(p.colorStock[k]) : null; }
function isOut(p){ const t = stockTotal(p); return p.stock === false || (t!=null && t<=0); }
function deductStock(p, color, qty){
  if(!p || !qty) return false;
  const cs = p.colorStock || {}, key = stockKey(p, color); if(!key) return false;
  const before = stockTotal(p);
  p.colorStock = {...cs, [key]: Math.max(0, Number(cs[key]) - qty)};
  const after = stockTotal(p);
  if(after<=0) p.stock = false; else if(before<=0 && after>0) p.stock = true;
  return true;
}
function tierPrice(p, qty){
  const tiers = (p.tiers||[]).filter(t=>t.price>0).sort((a,b)=>a.min-b.min);
  if(!tiers.length) return 0;
  let pick = tiers[0]; for(const t of tiers){ if(qty >= t.min) pick = t; } return pick.price;
}
const pName = s => String(s).split("::")[0];
const pExtra = s => { const x = parseFloat(String(s).split("::")[1]); return isFinite(x) ? x : 0; };
function colorLabel(p, hex){ return (p.colorNames && p.colorNames[hex]) || ""; }
function imgOf(p, color){ const ci = p.colorImages && color ? p.colorImages[color] : null; return (ci && ci[0]) || (p.img && p.img[0]) || ""; }

function renderCats(){
  const cats = [...new Set(PRODUCTS.map(p=>p.cat).filter(Boolean))].sort();
  $("#cats").innerHTML = ['<button data-c="" class="'+(activeCat===""?"active":"")+'">All</button>']
    .concat(cats.map(c=>`<button data-c="${esc(c)}" class="${activeCat===c?"active":""}">${esc(c)}</button>`)).join("");
}
$("#cats").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; activeCat = b.dataset.c; renderCats(); renderGrid(); });
function filtered(){
  const q = $("#search").value.trim().toLowerCase();
  return PRODUCTS.filter(p => (!activeCat || p.cat === activeCat) &&
    (!q || (p.name||"").toLowerCase().includes(q) || (p.cat||"").toLowerCase().includes(q) || String(p.id).includes(q) || (p.brand||"").toLowerCase().includes(q)));
}
function renderGrid(){
  const list = filtered();
  $("#grid").innerHTML = list.length ? list.map(p=>{
    const t = stockTotal(p), out = isOut(p), low = !out && t!=null && t<=5;
    const price = tierPrice(p, 1) || tierPrice(p, p.moq||1);
    return `<button class="px-prod ${out?"out":""}" data-id="${p.id}">
      <div class="px-prod-img" style="background-image:url('${esc(imgOf(p))}')">${out?'<span class="px-prod-badge out">Out of stock</span>':low?`<span class="px-prod-badge low">${t} left</span>`:""}</div>
      <div class="px-prod-info"><div class="px-prod-name">${esc(p.name)}</div>
      <div class="px-prod-meta">${esc(p.cat||"")}${t!=null&&!out&&!low?` · ${t} in stock`:""}</div>
      <div class="px-prod-price">${price?money(price):"Set price"}</div></div></button>`;
  }).join("") : '<div class="px-empty">Koi product nahi mila</div>';
}
$("#search").addEventListener("input", renderGrid);
$("#search").addEventListener("keydown", e => {
  if(e.key === "Enter"){ const l = filtered(); if(l[0]){ openProduct(l[0]); } }
  if(e.key === "Escape"){ e.target.value = ""; renderGrid(); }
});
$("#grid").addEventListener("click", e => { const b = e.target.closest(".px-prod"); if(!b) return; const p = PRODUCTS.find(x=>String(x.id)===b.dataset.id); if(p) openProduct(p); });

/* ---------------- variant picker ---------------- */
function openProduct(p){
  const colors = p.colors||[], sizes = p.sizes||[], prints = p.printOptions||[];
  if(colors.length<=1 && sizes.length<=1 && prints.length<=1){
    addLine(p, {color:colors[0]||"", size:sizes[0]||"", print:prints[0]?pName(prints[0]):"", extra:prints[0]?pExtra(prints[0]):0, qty:1}); return;
  }
  vSel = {p, color:colors[0]||"", size:sizes[0]||"", pi:0, qty:Math.max(1,p.moq?1:1)};
  $("#vName").textContent = p.name; renderVariant(); show("mVariant");
}
function renderVariant(){
  const {p} = vSel, colors = p.colors||[], sizes = p.sizes||[], prints = p.printOptions||[];
  let h = "";
  if(colors.length>1) h += `<div class="px-vlabel">Colour</div><div class="px-vopts">${colors.map(c=>`<button class="px-vopt ${c===vSel.color?"active":""}" data-c="${esc(c)}"><i class="px-dot" style="background:${esc(c)}"></i>${esc(colorLabel(p,c)||"")}</button>`).join("")}</div>`;
  if(sizes.length>1) h += `<div class="px-vlabel">Size</div><div class="px-vopts">${sizes.map(s=>`<button class="px-vopt ${s===vSel.size?"active":""}" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;
  if(prints.length>1) h += `<div class="px-vlabel">Printing</div><div class="px-vopts">${prints.map((s,i)=>`<button class="px-vopt ${i===vSel.pi?"active":""}" data-p="${i}">${esc(pName(s))}${pExtra(s)?` <small>+${money(pExtra(s))}</small>`:""}</button>`).join("")}</div>`;
  const left = stockLeft(p, vSel.color);
  h += `<div class="px-vlabel">Quantity</div><div class="px-vqty"><div class="px-step"><button data-q="-1">−</button><input id="vQty" type="number" min="1" value="${vSel.qty}"><button data-q="1">+</button></div>${left!=null?`<small class="px-hint">${left} in stock</small>`:""}</div>`;
  const ex = prints[vSel.pi] ? pExtra(prints[vSel.pi]) : 0, unit = (tierPrice(p, vSel.qty)||0) + ex;
  h += `<div class="px-vtotal">${money(unit)} × ${vSel.qty} = <b>${money(unit*vSel.qty)}</b></div>`;
  $("#vBody").innerHTML = h;
}
$("#vBody").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.c!=null) vSel.color = b.dataset.c;
  else if(b.dataset.s!=null) vSel.size = b.dataset.s;
  else if(b.dataset.p!=null) vSel.pi = +b.dataset.p;
  else if(b.dataset.q) vSel.qty = Math.max(1, vSel.qty + +b.dataset.q);
  else return;
  renderVariant();
});
$("#vBody").addEventListener("input", e => { if(e.target.id==="vQty"){ vSel.qty = Math.max(1, Math.floor(num(e.target.value))||1); const k = $("#vBody .px-vtotal"); const pr = (vSel.p.printOptions||[])[vSel.pi]; const u = (tierPrice(vSel.p,vSel.qty)||0)+(pr?pExtra(pr):0); k.innerHTML = `${money(u)} × ${vSel.qty} = <b>${money(u*vSel.qty)}</b>`; } });
$("#vAdd").addEventListener("click", () => {
  const {p} = vSel, pr = (p.printOptions||[])[vSel.pi];
  addLine(p, {color:vSel.color, size:vSel.size, print:pr&&(p.printOptions.length>1)?pName(pr):(pr?pName(pr):""), extra:pr?pExtra(pr):0, qty:vSel.qty});
  hide("mVariant");
});

/* ---------------- cart ---------------- */
function lineRate(l){ const p = PRODUCTS.find(x=>x.id===l.productId); return l.manual ? l.price : ((p?tierPrice(p,l.qty):l.base)||0) + (l.extra||0); }
function addLine(p, o){
  const key = [p.id,o.color,o.size,o.print].join("|");
  const left = stockLeft(p, o.color);
  let l = cart.find(x=>x.key===key);
  const newQty = (l?l.qty:0) + o.qty;
  if(isOut(p)) toast(`${p.name} stock me nahi dikh raha — phir bhi bill me add kiya`, "err");
  else if(left!=null && newQty>left) toast(`Sirf ${left} piece stock me hain`, "err");
  if(l){ l.qty = newQty; }
  else { l = {key, productId:p.id, name:p.name, color:o.color, size:o.size, print:o.print, extra:o.extra||0, qty:o.qty, img:imgOf(p,o.color), manual:false}; cart.push(l); }
  l.price = lineRate(l);
  renderCart();
  const box = $("#lines"); box.scrollTop = box.scrollHeight;
}
function renderCart(){
  $("#lines").innerHTML = cart.length ? cart.map((l,i)=>{
    const p = PRODUCTS.find(x=>x.id===l.productId);
    const v = [l.color?`<i class="px-dot" style="background:${esc(l.color)}"></i>${esc((p&&colorLabel(p,l.color))||"")}`:"", l.size&&l.size!=="Standard"?esc(l.size):"", l.print?esc(l.print):""].filter(Boolean).join(" · ");
    return `<div class="px-line">
      ${l.img?`<img src="${esc(l.img)}" alt="">`:'<div class="ph"></div>'}
      <div><div class="px-line-name">${esc(l.name)}</div>${v?`<div class="px-line-var">${v}</div>`:""}
        <div class="px-line-rate">${money(l.price)} /pc</div></div>
      <div class="px-line-right"><b>${money(l.qty*l.price)}</b>
        <div class="px-step"><button data-dec="${i}">−</button><input type="number" min="1" data-qty="${i}" value="${l.qty}"><button data-inc="${i}">+</button></div>
        <button class="px-rm" data-rm="${i}" title="Remove">🗑</button></div></div>`;
  }).join("") : '<div class="px-line-empty">Bill khali hai — left se product chuno ya search karke Enter dabao.</div>';
  totals();
}
$("#lines").addEventListener("click", e => {
  const g = a => e.target.closest("["+a+"]");
  let b;
  if(b = g("data-inc")) setQty(+b.dataset.inc, cart[+b.dataset.inc].qty+1);
  else if(b = g("data-dec")) setQty(+b.dataset.dec, cart[+b.dataset.dec].qty-1);
  else if(b = g("data-rm")){ cart.splice(+b.dataset.rm,1); renderCart(); }
});
$("#lines").addEventListener("change", e => {
  if(e.target.dataset.qty!=null) setQty(+e.target.dataset.qty, Math.floor(num(e.target.value)));
});
function setQty(i, q){ const l = cart[i]; if(!l) return; if(q<1){ cart.splice(i,1); renderCart(); return; } l.qty = q; l.price = lineRate(l); renderCart(); }
$("#editCancel").addEventListener("click", () => { resetBill(); toast("Edit cancel kiya"); });
$("#btnClear").addEventListener("click", () => { if(!cart.length) return; if(confirm("Poora bill clear karna hai?")){ resetBill(false); } });
$("#btnNote").addEventListener("click", () => { const n = $("#note"); n.hidden = !n.hidden; if(!n.hidden) n.focus(); });

/* ---------------- totals ---------------- */
let T = {sub:0, disc:0, gst:0, round:0, total:0};
function totals(){
  const sub = cart.reduce((s,l)=>s+l.qty*l.price,0);
  let disc = num($("#discVal").value);
  disc = $("#discType").value === "pct" ? sub*Math.min(100,disc)/100 : Math.min(sub, disc);
  const taxable = Math.max(0, sub - disc), gstOn = $("#gstOn").checked, r = num($("#gstRate").value), mode = $("#gstMode").value;
  let gst = 0, total = taxable;
  if(gstOn){ if(mode==="excl"){ gst = taxable*r/100; total = taxable+gst; } else { gst = taxable - taxable/(1+r/100); } }
  const grand = Math.round(total), round = grand - total;
  T = {sub, disc, gst, round, total:grand};
  $("#tSub").textContent = money(sub); $("#tDisc").textContent = "−" + money(disc);
  $("#tGst").textContent = money(gst); $("#tRound").textContent = (round>=0?"+":"−") + money(Math.abs(round));
  $("#roundRow").hidden = Math.abs(round) < 0.005;
  $("#tTotal").textContent = money(grand);
  const qty = cart.reduce((s,l)=>s+l.qty,0);
  $("#itemsCount").textContent = cart.length; $("#mCount").textContent = qty; $("#mTotal").textContent = money(grand);
  $("#mbar").hidden = !cart.length || window.innerWidth>820;
  $("#btnHold").disabled = $("#btnPay").disabled = !cart.length;
  quickCash(); change();
}
["discVal","discType","gstOn","gstRate","gstMode"].forEach(id => $("#"+id).addEventListener("input", () => { if(id.startsWith("gst")){ S.gstOn=$("#gstOn").checked; S.gstRate=$("#gstRate").value; S.gstMode=$("#gstMode").value; saveS(); } totals(); }));
$("#gstRate").addEventListener("change", ()=>$("#gstRate").dispatchEvent(new Event("input")));
$("#gstMode").addEventListener("change", ()=>$("#gstMode").dispatchEvent(new Event("input")));

/* ---------------- payment ---------------- */
$("#modes").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return; payMode = b.dataset.m;
  $$("#modes button").forEach(x=>x.classList.toggle("active", x===b));
  $("#cashBox").hidden = payMode !== "cash"; change();
});
function quickCash(){
  const t = T.total; if(!t){ $("#quickCash").innerHTML = ""; return; }
  const opts = new Set([t]); [50,100,200,500,1000,2000].forEach(d => opts.add(Math.ceil(t/d)*d));
  $("#quickCash").innerHTML = [...opts].sort((a,b)=>a-b).slice(0,5).map(v=>`<button data-v="${v}">${v===t?"Exact":money(v)}</button>`).join("");
}
$("#quickCash").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; $("#received").value = b.dataset.v; change(); });
$("#received").addEventListener("input", change);
function change(){
  const r = num($("#received").value), el = $("#tChange");
  if(!r){ $("#changeLbl").textContent = "Change"; el.textContent = money(0); el.className = ""; return; }
  const d = r - T.total;
  $("#changeLbl").textContent = d >= 0 ? "Change to return" : "Balance due";
  el.textContent = money(Math.abs(d)); el.className = d >= 0 ? "ok" : "due";
}

/* ---------------- bill number / reset ---------------- */
function newBillNo(){
  let max = 0;
  posOrders.forEach(o => { const m = /POS-(\d+)/.exec(o.notes||""); if(m) max = Math.max(max, +m[1]); });
  max = Math.max(max, posOrders.length);
  $("#billNo").textContent = "POS-" + String(max+1).padStart(6,"0");
}
function setEditing(o){
  editing = o;
  $("#editBar").hidden = !o;
  if(o) $("#editLabel").textContent = "Editing " + ((/Bill No: (POS-\d+)/.exec(o.notes||"")||[])[1] || o.ref);
  $("#btnPay").innerHTML = o ? "💾 Save changes <small>F12</small>" : "✅ Complete Sale <small>F12</small>";
}
function loadForEdit(o){
  if(cart.length && !editing && !confirm("Current bill replace ho jayega. Continue?")) return;
  const r = receiptFromOrder(o);
  cart = r.items.map(i => ({...i, key:[i.productId,i.color,i.size,i.print].join("|"), manual:true, extra:0, img:imgOf(PRODUCTS.find(x=>x.id===i.productId)||{}, i.color)}));
  setEditing(o);
  $("#billNo").textContent = r.billNo;
  $("#custName").value = r.customer || ""; $("#custPhone").value = r.phone || "";
  $("#discType").value = "amt"; $("#discVal").value = r.disc || "";
  $("#gstOn").checked = r.gstOn; if(r.gstOn){ $("#gstRate").value = String(r.gstRate); $("#gstMode").value = r.gstMode; }
  payMode = r.mode || "cash"; $$("#modes button").forEach(x=>x.classList.toggle("active", x.dataset.m===payMode)); $("#cashBox").hidden = payMode!=="cash";
  $("#received").value = r.received || "";
  renderCart(); hide("mList");
  if(window.innerWidth<=820) $("#billPanel").classList.add("open");
  toast("✏️ Bill edit mode — badlav karke 'Save changes' dabao");
}
function resetBill(){
  setEditing(null);
  cart = []; $("#custName").value = $("#custPhone").value = $("#note").value = $("#discVal").value = $("#received").value = "";
  $("#note").hidden = true; $("#billPanel").classList.remove("open");
  renderCart(); newBillNo();
}
async function refreshOrders(){ try{ posOrders = (await BazDS.getOrders()).filter(isPos); }catch(e){ posOrders = []; } }

/* ---------------- hold / recall ---------------- */
async function refreshHolds(){
  holds = await BazDS.getPosHolds().catch(()=>[]);
  const c = $("#holdsCount"); c.textContent = holds.length; c.hidden = !holds.length;
}
$("#btnHold").addEventListener("click", holdSale);
async function holdSale(){
  if(!cart.length) return;
  const btn = $("#btnHold"); busy(btn, true, "…");
  try{
    const label = $("#custName").value.trim() || $("#billNo").textContent;
    await BazDS.holdPosSale({label, items:cart.map(({key,...r})=>r), subtotal:T.total});
    toast("⏸ Bill hold par rakh diya"); resetBill(); await refreshHolds();
  }catch(e){ toast("Hold nahi hua: " + (e.message||""), "err"); }
  finally{ busy(btn, false); $("#btnHold").disabled = !cart.length; }
}
function openHolds(){
  $("#lTitle").textContent = "⏸ Held bills";
  $("#lBody").innerHTML = holds.length ? holds.map(h=>{
    const items = Array.isArray(h.items)?h.items:[];
    return `<div class="px-li"><div><b>${esc(h.label||"Held bill")}</b><small>${items.reduce((s,i)=>s+i.qty,0)} pcs · ${money(h.subtotal)} · ${new Date(h.created_at).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</small></div>
      <div class="px-li-actions"><button class="px-btn px-btn-primary" data-recall="${h.id}">Recall</button><button class="px-btn px-btn-outline" data-del="${h.id}">🗑</button></div></div>`;
  }).join("") : '<div class="px-empty">Koi held bill nahi hai</div>';
  show("mList");
}
$("#btnHolds").addEventListener("click", openHolds);
$("#lBody").addEventListener("click", async e => {
  const rc = e.target.closest("[data-recall]"), dl = e.target.closest("[data-del]"), rp = e.target.closest("[data-reprint]"), ed = e.target.closest("[data-edit]");
  if(rc){
    const h = holds.find(x=>String(x.id)===rc.dataset.recall); if(!h) return;
    if(cart.length && !confirm("Current bill replace ho jayega. Continue?")) return;
    cart = (h.items||[]).map(i => ({...i, key:[i.productId,i.color,i.size,i.print].join("|"), base:i.price}));
    $("#custName").value = /^POS-\d+$/.test(h.label||"") ? "" : (h.label||"");
    try{ await BazDS.deletePosHold(h.id); }catch(err){ console.error(err); }
    await refreshHolds(); hide("mList"); renderCart();
  }else if(dl){
    if(!confirm("Ye held bill delete karna hai?")) return;
    try{ await BazDS.deletePosHold(dl.dataset.del); }catch(err){ toast("Delete nahi hua","err"); }
    await refreshHolds(); openHolds();
  }else if(ed){
    const o = posOrders.find(x=>String(x.id)===ed.dataset.edit); if(o) loadForEdit(o);
  }else if(rp){
    const o = posOrders.find(x=>String(x.id)===rp.dataset.reprint); if(o){ hide("mList"); showReceipt(receiptFromOrder(o)); }
  }
});

/* ---------------- complete sale ---------------- */
$("#btnPay").addEventListener("click", completeSale);
async function completeSale(){
  if(!cart.length) return;
  if(payMode==="cash" && num($("#received").value) && num($("#received").value) < T.total && !confirm("Received amount total se kam hai. Phir bhi complete karein?")) return;
  const btn = $("#btnPay"); busy(btn, true, "Saving…");
  const billNo = $("#billNo").textContent, cust = $("#custName").value.trim(), phone = $("#custPhone").value.trim();
  const rec = {billNo, date:new Date().toISOString(), customer:cust, phone,
    items: cart.map(l=>({productId:l.productId, name:l.name, color:l.color, size:l.size, print:l.print, qty:l.qty, price:l.price})),
    sub:T.sub, disc:T.disc, gstOn:$("#gstOn").checked, gstRate:num($("#gstRate").value), gstMode:$("#gstMode").value, gst:T.gst, round:T.round, total:T.total,
    mode:payMode, received:payMode==="cash"?num($("#received").value):0, note:$("#note").value.trim()};
  rec.change = rec.received ? Math.max(0, rec.received - rec.total) : 0;
  const notes = [`Bill No: ${billNo}`, rec.disc?`Discount: ₹${r2(rec.disc)}`:"", rec.gstOn?`GST ${rec.gstRate}% (${rec.gstMode==="excl"?"extra":"incl"}): ₹${r2(rec.gst)}`:"", rec.round?`Round: ₹${r2(rec.round)}`:"", rec.received?`Received: ₹${r2(rec.received)}`:"", rec.note].filter(Boolean).join(" | ");
  const old = editing;
  try{
    if(old) await BazDS.updatePosSale(old.id, {customerName:cust, customerPhone:phone, items:rec.items, subtotal:rec.total, paymentMethod:payMode, notes});
    else await BazDS.createPosSale({customerName:cust, customerPhone:phone, items:rec.items, subtotal:rec.total, paymentMethod:payMode, notes});
  }catch(e){ toast((old?"Bill save nahi hua: ":"Sale save nahi hui: ") + (e.message||""), "err"); busy(btn,false); return; }
  /* stock: best-effort, never blocks the sale */
  const touched = new Set();
  if(old){ // only the difference vs the old bill moves stock
    const delta = {};
    const add = (it, sgn) => { const k = it.productId+"|"+(it.color||""); delta[k] = (delta[k]||0) + sgn*it.qty; };
    (Array.isArray(old.items)?old.items:[]).forEach(i=>add(i,-1)); rec.items.forEach(i=>add(i,1));
    for(const [k,d] of Object.entries(delta)){ if(!d) continue; const [pid,color] = k.split("|"); const p = PRODUCTS.find(x=>String(x.id)===pid); if(deductStock(p, color, d)) touched.add(p); }
  } else for(const l of cart){ const p = PRODUCTS.find(x=>x.id===l.productId); if(deductStock(p, l.color, l.qty)) touched.add(p); }
  let warn = false;
  for(const p of touched){ try{ const sv = await BazDS.upsertProduct(p); if(sv && sv.__stripped && sv.__stripped.includes("color_stock") && sv.__stripped.includes("color_images")) warn = true; }catch(e){ warn = true; console.error(e); } }
  if(warn) toast("Sale ho gayi, par stock minus nahi hua — internet/Supabase check karo","err");
  busy(btn, false);
  await refreshOrders(); resetBill(); renderGrid();
  lastReceipt = rec;
  if(S.autoReceipt) showReceipt(rec);
  else toast((old?"✅ Bill update ho gaya — ":"✅ Sale complete — ")+rec.billNo+" · "+money(rec.total),"ok");
}
const r2 = n => Math.round(n*100)/100;

/* ---------------- receipt ---------------- */
function receiptFromOrder(o){
  const n = o.notes||"", g = re => { const m = re.exec(n); return m ? parseFloat(m[1].replace(/,/g,"")) : 0; };
  const items = Array.isArray(o.items)?o.items:[], sub = items.reduce((s,i)=>s+i.qty*i.price,0);
  const gm = /GST (\d+(?:\.\d+)?)% \((extra|incl)\)/.exec(n);
  return {billNo:(/Bill No: (POS-\d+)/.exec(n)||[])[1] || o.ref, date:o.created_at, customer:o.customer_name==="Walk-in counter sale"?"":o.customer_name, phone:o.customer_phone||"",
    items, sub, disc:g(/Discount: ₹(-?[\d.,]+)/), gstOn:!!gm, gstRate:gm?+gm[1]:0, gstMode:gm?(gm[2]==="extra"?"excl":"incl"):"excl", gst:g(/GST [^:]*: ₹(-?[\d.,]+)/), round:g(/Round: ₹(-?[\d.,]+)/),
    total:o.subtotal, mode:o.payment_method||"cash", received:g(/Received: ₹(-?[\d.,]+)/), change:0, note:""};
}
function receiptHTML(r){
  const d = new Date(r.date), mode = {cash:"Cash",upi:"UPI",card:"Card",bank:"Bank transfer",credit:"Credit (due)"}[r.mode]||r.mode;
  const rows = r.items.map(i=>{
    const p = PRODUCTS.find(x=>x.id===i.productId);
    const v = [i.color?(p&&colorLabel(p,i.color))||"":"", i.size&&i.size!=="Standard"?i.size:"", i.print||""].filter(Boolean).join(", ");
    return `<tr><td>${esc(i.name)}${v?`<br><span class="s">${esc(v)}</span>`:""}</td><td class="n">${i.qty}</td><td class="n">${r2(i.price)}</td><td class="n">${r2(i.qty*i.price)}</td></tr>`;
  }).join("");
  const line = (a,b,c) => `<div class="t ${c||""}"><span>${a}</span><span>${b}</span></div>`;
  return `<h2>${esc(S.name)}</h2>
    ${S.tag?`<div class="c s">${esc(S.tag)}</div>`:""}${S.addr?`<div class="c s">${esc(S.addr).replace(/\n/g,"<br>")}</div>`:""}
    <div class="c s">${S.phone?"Ph: "+esc(S.phone):""}${S.gstin?" · GSTIN: "+esc(S.gstin):""}</div>
    <hr><div class="t s"><span>Bill: <b>${esc(r.billNo)}</b></span><span>${d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})} ${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span></div>
    ${r.customer||r.phone?`<div class="s">Customer: ${esc(r.customer)} ${esc(r.phone)}</div>`:""}
    <hr><table><tr><th>Item</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amt</th></tr>${rows}</table><hr>
    ${line("Subtotal", r2(r.sub))}${r.disc?line("Discount","−"+r2(r.disc)):""}
    ${r.gstOn?line(`GST ${r.gstRate}% ${r.gstMode==="excl"?"":"(incl.)"}`, r2(r.gst)):""}${r.round?line("Round off",(r.round>0?"+":"")+r2(r.round)):""}
    <hr>${line("TOTAL","₹"+r2(r.total),"g")}
    ${r.note?`<div class="s">Note: ${esc(r.note)}</div>`:""}
    <hr><div class="c s">${esc(S.foot||"")}</div><div class="c s">Bill by Bazarville POS</div>`;
}
function showReceipt(r){ lastReceipt = r; $("#receipt").innerHTML = receiptHTML(r); show("mReceipt"); }
$("#rPrint").addEventListener("click", () => window.print());
$("#rNew").addEventListener("click", () => { hide("mReceipt"); $("#search").focus(); });
$("#rWa").addEventListener("click", () => {
  const r = lastReceipt; if(!r) return;
  let ph = (r.phone||"").replace(/\D/g,""); if(!ph) ph = (prompt("Customer ka WhatsApp number (10 digit):")||"").replace(/\D/g,""); if(!ph) return;
  if(ph.length===10) ph = "91"+ph;
  const L = [`*${S.name}*`, S.addr||"", `Bill: ${r.billNo}  (${new Date(r.date).toLocaleDateString("en-IN")})`, ""];
  r.items.forEach(i => L.push(`${i.name}${i.size&&i.size!=="Standard"?" ("+i.size+")":""} × ${i.qty} = ₹${r2(i.qty*i.price)}`));
  L.push("");
  if(r.disc) L.push(`Discount: −₹${r2(r.disc)}`);
  if(r.gstOn) L.push(`GST ${r.gstRate}%: ₹${r2(r.gst)}`);
  L.push(`*Total: ₹${r2(r.total)}*`, "", S.foot||"Thank you!");
  window.open("https://wa.me/"+ph+"?text="+encodeURIComponent(L.filter(x=>x!==undefined).join("\n")), "_blank", "noopener");
});

/* ---------------- recent bills + today report ---------------- */
$("#btnRecent").addEventListener("click", async () => {
  await refreshOrders();
  $("#lTitle").textContent = "🧾 Recent bills";
  const billRows = list => list.length ? list.map(o=>`<div class="px-li"><div><b>${esc((/Bill No: (POS-\d+)/.exec(o.notes||"")||[])[1]||o.ref)}</b> · ${money(o.subtotal)}<small>${esc(o.customer_name||"")} · ${esc(o.payment_method||"cash")} · ${new Date(o.created_at).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</small></div>
    <div class="px-li-actions"><button class="px-btn px-btn-outline" data-edit="${o.id}">✏️ Edit</button><button class="px-btn px-btn-outline" data-reprint="${o.id}">🖨 Reprint</button></div></div>`).join("") : '<div class="px-empty">Koi bill nahi mila</div>';
  $("#lBody").innerHTML = '<input id="billSearch" placeholder="Bill no. ya customer search karo…" style="margin-bottom:10px"><div id="billRows"></div>';
  const draw = () => { const q = $("#billSearch").value.trim().toLowerCase(); $("#billRows").innerHTML = billRows(posOrders.filter(o => !q || ((o.notes||"")+" "+(o.customer_name||"")+" "+(o.ref||"")).toLowerCase().includes(q)).slice(0,60)); };
  $("#billSearch").addEventListener("input", draw); draw();
  show("mList");
});
$("#btnReport").addEventListener("click", async () => {
  await refreshOrders();
  const today = new Date().toDateString(), list = posOrders.filter(o=>new Date(o.created_at).toDateString()===today);
  const total = list.reduce((s,o)=>s+(+o.subtotal||0),0), pcs = list.reduce((s,o)=>s+(Array.isArray(o.items)?o.items.reduce((a,i)=>a+i.qty,0):0),0);
  const by = {}; list.forEach(o => { const m = o.payment_method||"cash"; by[m] = (by[m]||0) + (+o.subtotal||0); });
  const top = {}; list.forEach(o => (o.items||[]).forEach(i => top[i.name] = (top[i.name]||0) + i.qty));
  const best = Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("#lTitle").textContent = "📊 Aaj ki sale";
  $("#lBody").innerHTML = `<div class="px-stats"><div class="px-stat"><b>${money(total)}</b><span>Total sale</span></div><div class="px-stat"><b>${list.length}</b><span>Bills</span></div><div class="px-stat"><b>${pcs}</b><span>Pieces</span></div></div>
    <div class="px-vlabel">Payment mode ke hisaab se</div><table class="px-bymode">${Object.entries(by).map(([m,v])=>`<tr><td>${esc(m)}</td><td>${money(v)}</td></tr>`).join("")||'<tr><td>Aaj koi sale nahi</td><td></td></tr>'}</table>
    ${best.length?`<div class="px-vlabel">Top products</div><table class="px-bymode">${best.map(([n,q])=>`<tr><td>${esc(n)}</td><td>${q} pcs</td></tr>`).join("")}</table>`:""}
    <button class="px-btn px-btn-outline px-btn-block" id="rptPrint" style="margin-top:10px">🖨 Print summary</button>`;
  show("mList");
  $("#rptPrint").onclick = () => { $("#receipt").innerHTML = `<h2>${esc(S.name)}</h2><div class="c s">Daily summary — ${new Date().toLocaleDateString("en-IN")}</div><hr>
    <div class="t"><span>Bills</span><span>${list.length}</span></div><div class="t"><span>Pieces</span><span>${pcs}</span></div>${Object.entries(by).map(([m,v])=>`<div class="t"><span>${esc(m)}</span><span>₹${r2(v)}</span></div>`).join("")}<hr><div class="t g"><span>TOTAL</span><span>₹${r2(total)}</span></div>`; window.print(); };
});

/* ---------------- shop settings ---------------- */
function applySettingsUI(){
  $("#shopNameTop").textContent = S.name; $("#shopTagTop").textContent = S.tag || "Counter billing";
  document.title = S.name + " POS";
  $("#gstOn").checked = !!S.gstOn; $("#gstRate").value = S.gstRate; $("#gstMode").value = S.gstMode;
  document.body.className = "paper-" + S.paper;
}
$("#btnSettings").addEventListener("click", () => {
  $("#sName").value = S.name; $("#sTag").value = S.tag; $("#sAddr").value = S.addr; $("#sPhone").value = S.phone; $("#sGstin").value = S.gstin; $("#sFoot").value = S.foot; $("#sPaper").value = S.paper; $("#sAuto").checked = !!S.autoReceipt;
  show("mSettings");
});
$("#sSave").addEventListener("click", () => {
  S = Object.assign(S, {name:$("#sName").value.trim()||"Bazarville", tag:$("#sTag").value.trim(), addr:$("#sAddr").value.trim(), phone:$("#sPhone").value.trim(), gstin:$("#sGstin").value.trim(), foot:$("#sFoot").value.trim(), paper:$("#sPaper").value, autoReceipt:$("#sAuto").checked});
  saveS(); applySettingsUI(); hide("mSettings"); toast("✅ Shop details save ho gayi","ok");
});

/* ---------------- modal helpers, shortcuts, misc ---------------- */
function show(id){ $("#"+id).hidden = false; }
function hide(id){ $("#"+id).hidden = true; }
$$(".px-modal").forEach(m => { m.addEventListener("click", e => { if(e.target===m || e.target.closest("[data-close]")) m.hidden = true; }); });
$("#mbar").addEventListener("click", () => $("#billPanel").classList.add("open"));
$("#btnFull").addEventListener("click", () => { if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); });
window.addEventListener("resize", totals);
document.addEventListener("keydown", e => {
  if($("#app").hidden) return;
  if(e.key === "Escape"){ const open = $$(".px-modal").find(m=>!m.hidden); if(open){ open.hidden = true; return; } $("#billPanel").classList.remove("open"); return; }
  const k = e.key;
  if(k==="F2"){ e.preventDefault(); $("#search").focus(); $("#search").select(); }
  else if(k==="F4"){ e.preventDefault(); holdSale(); }
  else if(k==="F5"){ e.preventDefault(); openHolds(); }
  else if(k==="F6"){ e.preventDefault(); $("#btnRecent").click(); }
  else if(k==="F7"){ e.preventDefault(); $("#btnReport").click(); }
  else if(k==="F8"){ e.preventDefault(); $("#discVal").focus(); $("#discVal").select(); }
  else if(k==="F9"){ e.preventDefault(); $("#btnSettings").click(); }
  else if(k==="F12" || (k==="Enter" && (e.ctrlKey||e.metaKey))){ e.preventDefault(); if(!$("#btnPay").disabled && $$(".px-modal").every(m=>m.hidden)) completeSale(); }
});
window.addEventListener("beforeunload", e => { if(cart.length){ e.preventDefault(); e.returnValue = ""; } });

boot();
})();
