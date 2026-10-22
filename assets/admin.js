/* ===================== BAZARVILLE ADMIN PANEL (Supabase-backed) ===================== */
/* Show/hide password: every password box (login, add-user…) gets an eye button. */
(function(){
  function addEyes(root){
    (root||document).querySelectorAll('input[type=password]:not([data-eye])').forEach(inp=>{
      inp.dataset.eye="1";
      const w=document.createElement('div'); w.className='pw-wrap';
      inp.parentNode.insertBefore(w,inp); w.appendChild(inp);
      const b=document.createElement('button'); b.type='button'; b.className='pw-eye'; b.setAttribute('aria-label','Show password'); b.textContent='👁';
      b.addEventListener('click',()=>{ const show=inp.type==='password'; inp.type=show?'text':'password'; b.textContent=show?'🙈':'👁'; b.setAttribute('aria-label',show?'Hide password':'Show password'); });
      w.appendChild(b);
    });
  }
  const start=()=>{ addEyes(); new MutationObserver(()=>addEyes()).observe(document.body,{childList:true,subtree:true}); };
  if(document.body) start(); else document.addEventListener('DOMContentLoaded',start);
})();

document.addEventListener("DOMContentLoaded", async ()=>{

  // NOTE: these two preset lists are declared right here at the very top,
  // before anything else — including before the "resume an existing login"
  // check below. That check can call showShell() (which renders these
  // presets) before the rest of this function has finished running, and a
  // `const` declared further down wouldn't exist yet at that moment ("Cannot
  // access before initialization"), silently breaking the whole admin panel.
  // Keeping them here removes that timing trap entirely.
  const BRAND_PRESETS = [
    {name:"Lime",     hex:"#c6f000"},
    {name:"Ocean",     hex:"#2563eb"},
    {name:"Emerald",   hex:"#10b981"},
    {name:"Royal",     hex:"#7c3aed"},
    {name:"Crimson",   hex:"#dc2626"},
    {name:"Sunset",    hex:"#f97316"},
    {name:"Teal",      hex:"#0d9488"},
    {name:"Hot Pink",  hex:"#ec4899"},
    {name:"Charcoal",  hex:"#52525b"},
    {name:"Silver",    hex:"#cbd5e1"}
  ];
  const ANIM_LEVELS = [
    {id:"off",    label:"Off",              desc:"No hover-tilt or motion — fastest, most accessible."},
    {id:"subtle", label:"Subtle (Default)", desc:"Gentle hover-tilt and fade-in, as originally designed."},
    {id:"full",   label:"Full 3D",          desc:"Deeper hover-tilt, plus an idle 3D floating effect on product cards."}
  ];
  // Same timing trap again: showShell() reads these before the rest of this
  // function has run, so they must be declared up here too.
  const ALL_SECTIONS = [
    {id:"dashboard",   label:"📊 Dashboard"},
    {id:"products",    label:"📦 Products"},
    {id:"inventory",   label:"📋 Inventory (Stock, POS Billing, History)"},
    {id:"collections", label:"🗂️ Collections"},
    {id:"enquiries",   label:"💬 Enquiries / CRM"},
    {id:"orders",      label:"🛒 Orders"},
    {id:"quotes",      label:"📝 Quotes"},
    {id:"settings",    label:"⚙️ Site Settings"}
  ];
  let currentAdmin = null;
  // Same timing trap as the presets above: renderDashboard() (below) reads
  // the orders/quotes/enquiries caches, and showShell() can call it before
  // the `let` declarations that used to live further down this file would
  // otherwise have run yet — so they're declared here, up front, instead.
  let allOrdersCache = [];
  let allQuotesCache = [];
  let allEnquiriesCache = [];

  /* ---------- real Supabase Auth ---------- */
  const loginBtn = document.querySelector("#loginBtn");
  const loginError = document.createElement("p");
  loginError.style.cssText = "color:#c0392b;font-size:12.5px;margin-top:-8px;margin-bottom:14px;display:none";
  document.querySelector("#loginBtn").before(loginError);

  // Resume an existing Supabase session (e.g. page refresh) without re-login.
  const existing = await BazDS.getCurrentAdmin().catch(()=>null);
  if(existing) showShell(existing);

  loginBtn.addEventListener("click", async ()=>{
    const email = document.querySelector("#loginEmail").value.trim();
    const password = document.querySelector("#loginPassword").value;
    loginError.style.display = "none";
    loginBtn.disabled = true; loginBtn.textContent = "Signing in…";
    try{
      await BazDS.signIn(email, password);
      const admin = await BazDS.getCurrentAdmin();
      if(!admin){ throw new Error("Signed in, but no profile/role found for this account. Check the profiles table in Supabase."); }
      showShell(admin);
    }catch(err){
      loginError.textContent = err.message || "Could not sign in — check the email/password and that Supabase is configured (assets/supabase-config.js).";
      loginError.style.display = "block";
    }finally{
      loginBtn.disabled = false; loginBtn.textContent = "Sign In";
    }
  });

  document.querySelector("#logoutBtn").addEventListener("click", async ()=>{
    await BazDS.signOut();
    document.querySelector("#adminShell").style.display = "none";
    document.querySelector("#loginScreen").style.display = "grid";
  });

  async function showShell(admin){
    document.querySelector("#loginScreen").style.display = "none";
    document.querySelector("#adminShell").style.display = "grid";
    const isSuper = admin.role === "super_admin";
    currentAdmin = admin;
    document.body.classList.toggle("role-super", isSuper);
    document.querySelector("#roleBadge").textContent = isSuper ? `👑 ${BazDS.toUsername(admin.email)}` : `🗂️ ${admin.fullName||BazDS.toUsername(admin.email)}`;
    // Per-user section ticks (Users & Roles). permissions === null means the
    // database hasn't run add_user_permissions.sql yet — behave as before
    // (every non-super user keeps the old Catalog Manager access).
    document.querySelectorAll("#adNav a[data-view]").forEach(a=>{
      if(a.dataset.view==="roles") return; // controlled by .ad-super-only
      a.style.display = canView(a.dataset.view) ? "" : "none";
    });
    const reportsLink = document.querySelector('#adNav a[href="dashboard.html"]');
    if(reportsLink) reportsLink.style.display = canView("enquiries") ? "" : "none";
    const wanted = location.hash.replace("#","") || "dashboard";
    if(!canView(wanted)) location.hash = "#" + firstAllowedView();

    // Load the live catalogue for the admin panel itself (product/collection
    // lists, dashboard counts) — same Supabase data the public site reads.
    PRODUCTS = await BazDS.getProducts();
    COLLECTIONS = await BazDS.getCollections();
    SETTINGS = await BazDS.getSettings();
    // Same BazDS calls already used by the Orders/Quotes/Enquiries views
    // (renderOrdersTable/renderQuotesTable/renderEnquiriesTable) — reused here
    // (not a new query) so the dashboard's counts are correct as soon as it
    // opens, not just after the admin has visited those tabs once.
    try{ allOrdersCache = await BazDS.getOrders(); }catch(err){ console.error(err); allOrdersCache = []; }
    try{ allQuotesCache = await BazDS.getQuotes(); }catch(err){ console.error(err); allQuotesCache = []; }
    try{ allEnquiriesCache = await BazDS.getEnquiries(); }catch(err){ console.error(err); allEnquiriesCache = []; }

    renderDashboard();
    renderProductsTable();
    renderCollectionsGrid();
    renderEnquiriesTable();
    renderSettingsView();
    renderColorSwatches();
    renderFontSwatches();
    renderAnimationOptions();
    switchView(location.hash.replace("#","") || firstAllowedView());
  }

  /* ---------- view switching ---------- */
  function canView(view){
    if(!currentAdmin) return false;
    if(currentAdmin.role==="super_admin") return true;
    if(view==="roles") return false;
    if(!Array.isArray(currentAdmin.permissions)) return view!=="settings"; // legacy: pre-migration Catalog Manager
    return currentAdmin.permissions.includes(view);
  }
  function firstAllowedView(){
    const hit = ALL_SECTIONS.find(sec=>canView(sec.id));
    return hit ? hit.id : "dashboard";
  }

  function switchView(name){
    if(!canView(name) && !(name==="roles" && currentAdmin && currentAdmin.role==="super_admin")) name = firstAllowedView();
    document.querySelectorAll(".ad-view").forEach(v=>v.style.display = "none");
    const target = document.querySelector("#view-"+name);
    if(target) target.style.display = "block"; else document.querySelector("#view-dashboard").style.display = "block";
    document.querySelectorAll("#adNav a[data-view]").forEach(a=>a.classList.toggle("active", a.dataset.view===name));
    if(name==="dashboard") renderDashboard();
    if(name==="enquiries") renderEnquiriesTable();
    if(name==="orders") renderOrdersTable();
    if(name==="quotes") renderQuotesTable();
    if(name==="inventory") renderInventoryView();
    if(name==="roles") renderTeamTable();
  }
  document.querySelectorAll("#adNav a[data-view]").forEach(a=>{
    a.addEventListener("click", (e)=>{ e.preventDefault(); location.hash = "#"+a.dataset.view; switchView(a.dataset.view); });
  });

  /* ---------- dashboard ---------- */
  // One-line, rule-based insight for the top of the dashboard — plain JS
  // logic over the already-loaded PRODUCTS/allOrdersCache/allEnquiriesCache
  // arrays, no AI call and no extra Supabase query. Prefers a week-over-week
  // orders trend when there's enough order history to make that meaningful;
  // otherwise falls back to whichever of "pending enquiries" / "most
  // in-demand profession" is actually computable from the data in memory.
  function computeDashboardInsight(){
    const oneDay = 24*60*60*1000;
    const now = Date.now();
    const thisWeekStart = now - 7*oneDay;
    const prevWeekStart = now - 14*oneDay;
    const timeOf = o => new Date(o.created_at).getTime();
    const thisWeekOrders = allOrdersCache.filter(o=>o.created_at && timeOf(o) >= thisWeekStart);
    const prevWeekOrders = allOrdersCache.filter(o=>o.created_at && timeOf(o) >= prevWeekStart && timeOf(o) < thisWeekStart);

    // Only trust a week-over-week comparison once there's a reasonable spread
    // of order history to compare — otherwise a single day's orders (or all
    // orders sharing one timestamp, as in a fresh demo dataset) would produce
    // a misleading "up/down" swing.
    if(prevWeekOrders.length >= 2 && (thisWeekOrders.length + prevWeekOrders.length) >= 4){
      const diff = thisWeekOrders.length - prevWeekOrders.length;
      const pct = Math.round(Math.abs(diff)/prevWeekOrders.length*100);
      if(diff > 0) return `📈 Orders are up ${pct}% this week — ${thisWeekOrders.length} vs ${prevWeekOrders.length} last week.`;
      if(diff < 0) return `📉 Orders are down ${pct}% this week — ${thisWeekOrders.length} vs ${prevWeekOrders.length} last week.`;
      return `➡️ Orders are about the same this week as last week (${thisWeekOrders.length}).`;
    }

    const pendingEnquiries = allEnquiriesCache.filter(e=>(e.status||"new")==="new").length;
    if(pendingEnquiries > 0){
      return `📬 ${pendingEnquiries} enquir${pendingEnquiries===1?'y is':'ies are'} still pending a reply.`;
    }

    const profCounts = {};
    PRODUCTS.filter(p=>(p.status||"published")==="published").forEach(p=>{
      const k = p.profession || "Unspecified";
      profCounts[k] = (profCounts[k]||0) + 1;
    });
    const ranked = Object.entries(profCounts).sort((a,b)=>b[1]-a[1]);
    if(ranked.length){
      const [name,count] = ranked[0];
      return `🏷️ Most in-demand profession: ${name} (${count} product${count===1?'':'s'}).`;
    }
    return `👋 Add your first product to start seeing catalogue insights here.`;
  }

  function renderDashboard(){
    const el = document.querySelector("#adStats"); if(!el) return;
    const insightEl = document.querySelector("#adInsight");
    if(insightEl) insightEl.innerHTML = `<div class="ad-insight-strip">${computeDashboardInsight()}</div>`;
    const out = PRODUCTS.filter(p=>!p.stock).length;
    const drafts = PRODUCTS.filter(p=>(p.status||"published")==="draft").length;
    const published = PRODUCTS.length - drafts;
    el.innerHTML = `
      <div class="ad-stat"><b>${PRODUCTS.length}</b><span>Total products (${published} published, ${drafts} draft)</span></div>
      <div class="ad-stat"><b>${out}</b><span>Out of stock</span></div>
      <div class="ad-stat"><b>${allOrdersCache.length}</b><span><a href="#orders" onclick="event.stopPropagation()">Total orders</a></span></div>
      <div class="ad-stat"><b>${allQuotesCache.length}</b><span><a href="#quotes" onclick="event.stopPropagation()">Total quotes</a></span></div>`;

    const breakdownEl = document.querySelector("#adBreakdown");
    if(breakdownEl){
      const orderStatusCounts = {};
      allOrdersCache.forEach(o=>{ const s = o.status||"pending"; orderStatusCounts[s] = (orderStatusCounts[s]||0)+1; });
      const orderBreakdownHtml = Object.keys(orderStatusCounts).length
        ? Object.entries(orderStatusCounts).map(([s,n])=>`<span class="ad-badge ${s==='delivered'?'in':(s==='cancelled'?'out':'in')}" style="margin:0 6px 6px 0">${s}: ${n}</span>`).join("")
        : `<span class="ad-hint" style="margin:0">No orders yet.</span>`;

      const recentEnquiries = allEnquiriesCache.slice(0,5);
      const recentEnquiriesHtml = recentEnquiries.length
        ? `<ul class="ad-checklist">${recentEnquiries.map(e=>`<li>${e.company_name||e.ref||"—"} — ${e.product_name||"General enquiry"} <span class="ad-badge in" style="margin-left:6px">${e.status||"new"}</span></li>`).join("")}</ul>`
        : `<p class="ad-hint">No enquiries yet.</p>`;

      const recentOrders = allOrdersCache.slice(0,5);
      const recentOrdersHtml = recentOrders.length
        ? `<ul class="ad-checklist">${recentOrders.map(o=>`<li><b>${o.ref}</b> — ${o.customer_name||"—"} <span class="ad-badge in" style="margin-left:6px">${o.status||"pending"}</span></li>`).join("")}</ul>`
        : `<p class="ad-hint">No orders yet.</p>`;

      breakdownEl.innerHTML = `
        <div class="ad-dash-grid">
          <div class="ad-panel">
            <h3>Orders by status</h3>
            <div>${orderBreakdownHtml}</div>
          </div>
          <div class="ad-panel">
            <h3>Recent enquiries <a href="#enquiries" class="btn btn-outline btn-sm" style="float:right">View all</a></h3>
            ${recentEnquiriesHtml}
          </div>
          <div class="ad-panel">
            <h3>Recent orders <a href="#orders" class="btn btn-outline btn-sm" style="float:right">View all</a></h3>
            ${recentOrdersHtml}
          </div>
        </div>`;
    }
  }

  function busy(btn, isBusy, labelWhenBusy){
    if(!btn) return;
    btn.disabled = isBusy;
    if(isBusy){ btn.dataset.origText = btn.textContent; btn.textContent = labelWhenBusy || "Saving…"; }
    else if(btn.dataset.origText) btn.textContent = btn.dataset.origText;
  }

  /* ================= PRODUCTS ================= */
  function renderProductsTable(){
    const el = document.querySelector("#productsTable"); if(!el) return;
    el.innerHTML = `<tr><th></th><th>Product</th><th>Category</th><th>Starting price</th><th>MOQ</th><th>Stock</th><th>Status</th><th></th></tr>` +
      PRODUCTS.map(p=>{
        const t = tierFor(p, p.moq);
        const isDraft = (p.status||"published") === "draft";
        return `<tr>
          <td><img src="${(p.img&&p.img[0])||''}" alt=""></td>
          <td><b>${p.trending?'<span title="Marked Trending" style="color:var(--lime-deep)">★</span> ':''}${p.name}</b></td>
          <td>${p.cat}</td>
          <td>${money(t.price)}</td>
          <td>${p.moq} pcs</td>
          <td><span class="ad-badge ${p.stock?'in':'out'}">${p.stock?'In stock':'Out of stock'}</span></td>
          <td><span class="ad-badge ${isDraft?'out':'in'}">${isDraft?'Draft':'Published'}</span></td>
          <td><div class="ad-row-actions">
            <a class="ad-icon-btn" title="View on site" href="product.html?id=${p.id}" target="_blank" rel="noopener">👁️</a>
            <button class="ad-icon-btn" title="Edit" onclick="AdminUI.editProduct(${p.id})">✏️</button>
            <button class="ad-icon-btn danger" title="Delete" onclick="AdminUI.deleteProduct(${p.id})">🗑️</button>
          </div></td>
        </tr>`;
      }).join("");
  }

  /* ---------- stock QUANTITY ----------
     product.colorStock holds the numbers: one key per colour that has a quantity set, plus "_total" for
     products tracked as a single number (no colour split). Missing = not tracked (plain in/out flag only). */
  const STOCK_SQL_MSG = "Stock quantity DB me save nahi hui — Supabase SQL Editor me supabase/add_pos.sql run karo (products.color_stock column missing hai).";
  function stockWasStripped(saved){ return !!(saved && saved.__stripped && saved.__stripped.includes("color_stock") && saved.__stripped.includes("color_images")); }
  function stockTotal(p){
    const vals = Object.values(p.colorStock||{}).filter(v=>v!=null && !isNaN(v)).map(Number);
    return vals.length ? vals.reduce((s,v)=>s+v,0) : null;
  }
  /* Remove qty (negative qty = put back). Returns true if a tracked number was changed. Flips the
     in/out flag automatically when the tracked total hits 0 (and back when stock returns). */
  /* keys: "<colour>" | "<colour>|<size>" (size-wise) | "_total" */
  function stockKeyFor(cs, color, size){
    if(color && size && cs[color+"|"+size]!=null) return color+"|"+size;
    if(color && Object.keys(cs).some(k=>k.startsWith(color+"|"))) return null;
    return (color && cs[color]!=null) ? color : (cs._total!=null ? "_total" : null);
  }
  function deductStock(p, color, qty, size){
    if(!p || !qty) return false;
    const cs = p.colorStock || {};
    const key = stockKeyFor(cs, color, size);
    if(!key) return false;
    const before = stockTotal(p);
    p.colorStock = {...cs, [key]: Math.max(0, Number(cs[key]) - qty)};
    const after = stockTotal(p);
    if(after<=0) p.stock = false;
    else if(before<=0 && after>0) p.stock = true;
    return true;
  }
  function stockLeftLabel(p){
    const t = stockTotal(p);
    return t==null ? "" : ` · ${t} left`;
  }
  async function saveStockQty(id, key, value){
    const p = PRODUCTS.find(x=>x.id===id); if(!p) return;
    const cs = {...(p.colorStock||{})};
    if(value==="") delete cs[key]; else cs[key] = Math.max(0, Math.round(Number(value)||0));
    if(key.includes("|") && value!=="") delete cs[key.split("|")[0]];   // size-wise numbers replace the colour-wise one (no double counting)
    p.colorStock = cs;
    const t = stockTotal(p);
    if(t!=null) p.stock = t>0;
    try{ const sv = await BazDS.upsertProduct(p); if(stockWasStripped(sv)) posToast(STOCK_SQL_MSG,"error"); else posToast("Stock saved"); }
    catch(err){ posToast("Could not save stock: " + (err.message||""), "error"); }
    renderInventoryView(); renderProductsTable(); renderDashboard();
    if(typeof renderPosProductList==="function") renderPosProductList();
  }

  /* ================= INVENTORY ================= */
  // A faster, dedicated in-stock/out-of-stock control surface on top of the
  // same PRODUCTS array/`stock` boolean the Products tab and public site
  // already use — toggle one product in place, or check several and apply
  // a bulk update, without opening each product's full edit screen.
  let invChecked = new Set();
  function renderInventoryView(){
    const table = document.querySelector("#inventoryTable"); if(!table) return;
    const statsEl = document.querySelector("#invStats");
    const searchEl = document.querySelector("#invSearch");
    const filterEl = document.querySelector("#invFilter");
    const q = (searchEl && searchEl.value || "").trim().toLowerCase();
    const filter = (filterEl && filterEl.value) || "all";

    const inCount = PRODUCTS.filter(p=>p.stock).length;
    const outCount = PRODUCTS.length - inCount;
    if(statsEl) statsEl.innerHTML = `
      <div class="ad-stat"><b>${PRODUCTS.length}</b><span>Total products</span></div>
      <div class="ad-stat"><b>${inCount}</b><span>In stock</span></div>
      <div class="ad-stat"><b>${outCount}</b><span>Out of stock</span></div>`;

    let list = PRODUCTS.slice();
    if(q) list = list.filter(p=>(p.name||"").toLowerCase().includes(q) || (p.cat||"").toLowerCase().includes(q));
    if(filter==="in") list = list.filter(p=>p.stock);
    if(filter==="out") list = list.filter(p=>!p.stock);

    table.innerHTML = `<tr><th></th><th></th><th>Product</th><th>Category</th><th>Colours / Sizes</th><th>Total stock</th><th>Status</th><th></th></tr>` +
      (list.length ? list.map(p=>{
        const t = stockTotal(p);
        return `
        <tr>
          <td><input type="checkbox" class="inv-check" data-id="${p.id}" ${invChecked.has(p.id)?"checked":""}></td>
          <td><img src="${(p.img&&p.img[0])||''}" alt=""></td>
          <td><b>${p.name}</b><br><small class="ad-hint" style="margin:0">MOQ ${p.moq} pcs</small></td>
          <td>${p.cat}</td>
          <td class="inv-variants">${(p.colors||[]).map(c=>`<i class="pos-cart-dot" style="background:${c}" title="${(p.colorNames&&p.colorNames[c])||c}"></i>`).join("")}<div class="inv-sizes">${(p.sizes||[]).join(" · ")}</div></td>
          <td>${t==null?`<span class="inv-total muted">Not tracked</span>`:`<span class="inv-total ${t<=0?"zero":t<=5?"low":""}">${t} pcs</span>`}</td>
          <td><button type="button" class="ad-stock-toggle ${p.stock?'in':'out'}" data-id="${p.id}">${p.stock?'In stock':'Out of stock'}</button></td>
          <td><button type="button" class="btn btn-primary btn-sm inv-update-btn" data-id="${p.id}">✏️ Update stock</button></td>
        </tr>`;}).join("") : `<tr><td colspan="8"><p class="ad-hint" style="margin:14px 0">No products match this search/filter.</p></td></tr>`);
    table.querySelectorAll(".inv-update-btn").forEach(btn=>btn.addEventListener("click", ()=>openStockModal(Number(btn.dataset.id))));

    table.querySelectorAll(".inv-check").forEach(cb=>{
      cb.addEventListener("change", ()=>{
        const id = Number(cb.dataset.id);
        if(cb.checked) invChecked.add(id); else invChecked.delete(id);
        updateInvBulkButtons();
      });
    });
    table.querySelectorAll(".inv-qty-input").forEach(inp=>{
      inp.addEventListener("change", ()=> saveStockQty(Number(inp.dataset.id), inp.dataset.key, inp.value.trim()));
    });
    table.querySelectorAll(".ad-stock-toggle").forEach(btn=>{
      btn.addEventListener("click", ()=> AdminUI.toggleStock(Number(btn.dataset.id)));
    });
    updateInvBulkButtons();
  }
  /* ---------- Update-stock window: every colour × size of one product; type +10 / -5 and press Enter ---------- */
  let stockModalId = null;
  function stockCell(p, color, size){
    const cs = p.colorStock||{};
    if(color && size && cs[color+"|"+size]!=null) return {key: color+"|"+size, qty: Number(cs[color+"|"+size])};
    if(color && size) return {key: color+"|"+size, qty: Object.keys(cs).some(k=>k.startsWith(color+"|")) ? null : (cs[color]!=null ? Number(cs[color]) : (cs._total!=null ? null : null)), legacy: cs[color]!=null && !Object.keys(cs).some(k=>k.startsWith(color+"|"))};
    if(color) return {key: color, qty: cs[color]!=null ? Number(cs[color]) : null};
    return {key: "_total", qty: cs._total!=null ? Number(cs._total) : null};
  }
  function openStockModal(id){
    stockModalId = id; drawStockModal();
  }
  function drawStockModal(){
    const p = PRODUCTS.find(x=>x.id===stockModalId); if(!p) return;
    let ov = document.querySelector("#stockModalOverlay");
    if(!ov){
      ov = document.createElement("div"); ov.id = "stockModalOverlay"; ov.className = "stk-overlay";
      ov.addEventListener("click", e=>{ if(e.target===ov || e.target.closest("[data-stk-close]")){ ov.remove(); stockModalId = null; } });
      ov.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.classList.contains("stk-in")){ e.preventDefault(); applyStockDelta(e.target, 1); } });
      ov.addEventListener("click", e=>{
        const b = e.target.closest("[data-stk-sign]"); if(!b) return;
        const inp = b.parentElement.querySelector(".stk-in"); applyStockDelta(inp, Number(b.dataset.stkSign));
      });
      document.body.appendChild(ov);
    }
    const sizes = (p.sizes||[]).filter(Boolean), colors = (p.colors||[]);
    const sizeWise = sizes.length>1;
    const total = stockTotal(p);
    const row = (label, cell, color, size)=>`
      <div class="stk-row">
        <div class="stk-label">${label}</div>
        <div class="stk-cur ${cell.qty==null?"muted":cell.qty<=0?"zero":cell.qty<=5?"low":""}">${cell.qty==null?"—":cell.qty}</div>
        <div class="stk-edit" data-key="${cell.key}">
          <button type="button" class="stk-btn minus" data-stk-sign="-1" title="Minus">−</button>
          <input class="stk-in" type="number" min="1" inputmode="numeric" placeholder="qty" data-id="${p.id}" data-key="${cell.key}" ${cell.legacy?'data-legacy="1"':""}>
          <button type="button" class="stk-btn plus" data-stk-sign="1" title="Plus">+</button>
        </div>
      </div>`;
    let body = "";
    if(colors.length){
      body = colors.map(c=>{
        const nm = (p.colorNames&&p.colorNames[c]) || "";
        const head = `<span class="stk-dot" style="background:${c}"></span><b>${nm||c}</b>`;
        if(sizeWise){
          const sum = Object.entries(p.colorStock||{}).filter(([k,v])=>(k===c||k.startsWith(c+"|"))&&v!=null).reduce((a,[,v])=>a+Number(v),0);
          const tracked = Object.keys(p.colorStock||{}).some(k=>k===c||k.startsWith(c+"|"));
          const legacy = (p.colorStock||{})[c]!=null && !Object.keys(p.colorStock||{}).some(k=>k.startsWith(c+"|"));
          return `<section class="stk-colour"><div class="stk-chead">${head}<span class="stk-csum">${tracked?sum+" pcs":"Not tracked"}</span></div>
            ${legacy?`<p class="stk-note">Abhi is colour ka stock size-wise nahi hai (${(p.colorStock||{})[c]} pcs). Size me qty daaloge to ye size-wise ban jayega.</p>`:""}
            ${sizes.map(sz=>row(sz, stockCell(p,c,sz), c, sz)).join("")}</section>`;
        }
        return `<section class="stk-colour"><div class="stk-chead">${head}</div>${row("Stock", stockCell(p,c,""), c, "")}</section>`;
      }).join("");
    } else {
      body = `<section class="stk-colour">${row("Total stock", stockCell(p,"",""), "", "")}</section>`;
    }
    ov.innerHTML = `<div class="stk-modal" role="dialog">
      <div class="stk-head"><img src="${(p.img&&p.img[0])||''}" alt=""><div><h3>${p.name}</h3><small>${p.cat||""} · ${colors.length} colour${colors.length===1?"":"s"}${sizes.length?` · ${sizes.length} size${sizes.length===1?"":"s"}`:""}</small></div><button type="button" class="stk-x" data-stk-close>✕</button></div>
      <div class="stk-total"><span>Total stock</span><b>${total==null?"Not tracked":total+" pcs"}</b></div>
      <p class="stk-help">Number likho aur <b>Enter</b> dabao (ya + / − dabao). <b>+</b> se stock badhta hai, <b>−</b> se kam hota hai. Jaise Black me 10 aaye: <b>10</b> likho → Enter.</p>
      <div class="stk-body">${body}</div>
      <div class="stk-foot"><span class="stk-status" id="stkStatus"></span><button type="button" class="btn btn-outline btn-sm" data-stk-close>Done</button></div></div>`;
    const first = ov.querySelector(".stk-in"); if(first && !ov.dataset.focused){ ov.dataset.focused = "1"; }
  }
  async function applyStockDelta(inp, sign){
    if(!inp) return;
    const p = PRODUCTS.find(x=>x.id===Number(inp.dataset.id)); if(!p) return;
    const typed = Math.round(Number(inp.value));
    if(!typed){ inp.focus(); return; }
    const delta = sign===-1 ? -Math.abs(typed) : typed;                 // "−" button = minus; Enter/"+" = as typed (−5 also works)
    const key = inp.dataset.key, cs = {...(p.colorStock||{})};
    const cur = cs[key]!=null ? Number(cs[key]) : 0;
    const next = Math.max(0, cur + delta);
    const st = document.querySelector("#stkStatus"); if(st) st.textContent = "Saving…";
    const focusKey = key;
    // size-wise entry replaces a colour-wise number for that colour
    await saveStockQty(p.id, key, String(next));
    if(st) st.textContent = "";
    drawStockModal();
    const again = document.querySelector(`#stockModalOverlay .stk-in[data-key="${CSS.escape(focusKey)}"]`); if(again) again.focus();
  }
  function invQtyCellHtml(p){
    const cs = p.colorStock||{};
    const colors = (p.colors||[]);
    const sizes = (p.sizes||[]).filter(Boolean);
    if(colors.length && sizes.length>1){
      const total = stockTotal(p);
      return `<div class="inv-qty-colors inv-qty-sizewise">` + colors.map(c=>{
        const colSum = Object.entries(cs).filter(([k,v])=>(k===c||k.startsWith(c+"|"))&&v!=null).reduce((a,[,v])=>a+Number(v),0);
        return `<div class="inv-sz-colour"><div class="inv-sz-head"><i class="pos-cart-dot" style="background:${c}"></i><small>${(p.colorNames&&p.colorNames[c])||""}</small><b>${Object.keys(cs).some(k=>k===c||k.startsWith(c+"|"))?colSum+" pcs":""}</b></div>
          <div class="inv-sz-grid">${sizes.map(sz=>`<label class="inv-sz-cell"><span>${sz}</span><input type="number" min="0" class="inv-qty-input" data-id="${p.id}" data-key="${c}|${sz}" value="${cs[c+"|"+sz]!=null?cs[c+"|"+sz]:((cs[c]!=null&&!Object.keys(cs).some(k=>k.startsWith(c+"|")))?"":"")}" placeholder="—"></label>`).join("")}</div>
          ${(cs[c]!=null&&!Object.keys(cs).some(k=>k.startsWith(c+"|")))?`<div class="inv-sz-note">Abhi colour-wise ${cs[c]} pcs hai — size-wise bharoge to ye replace ho jayega</div>`:""}</div>`;
      }).join("") + `</div>${total!=null?`<div class="inv-qty-total">${total} left</div>`:`<div class="inv-qty-total muted">Not tracked</div>`}`;
    }
    if(colors.length){
      const total = stockTotal(p);
      return `<div class="inv-qty-colors">` + colors.map(c=>`
        <label class="inv-qty-row" title="${c}"><i class="pos-cart-dot" style="background:${c}"></i>
          <input type="number" min="0" class="inv-qty-input" data-id="${p.id}" data-key="${c}" value="${cs[c]!=null?cs[c]:""}" placeholder="—"></label>`).join("") +
        `</div>${total!=null?`<div class="inv-qty-total">${total} left</div>`:`<div class="inv-qty-total muted">Not tracked</div>`}`;
    }
    return `<input type="number" min="0" class="inv-qty-input inv-qty-single" data-id="${p.id}" data-key="_total" value="${cs._total!=null?cs._total:""}" placeholder="Qty">`;
  }
  function updateInvBulkButtons(){
    const any = invChecked.size > 0;
    const inBtn = document.querySelector("#invMarkInBtn"), outBtn = document.querySelector("#invMarkOutBtn");
    if(inBtn) inBtn.disabled = !any;
    if(outBtn) outBtn.disabled = !any;
  }
  window.AdminUI = window.AdminUI || {};
  AdminUI.toggleStock = async (id)=>{
    const p = PRODUCTS.find(x=>x.id===id); if(!p) return;
    const prevStock = p.stock;
    p.stock = !p.stock; // optimistic — flip immediately, roll back below on failure
    renderInventoryView(); renderProductsTable(); renderDashboard();
    try{ await BazDS.upsertProduct(p); }
    catch(err){ p.stock = prevStock; renderInventoryView(); renderProductsTable(); renderDashboard(); alert("Could not update stock: " + (err.message||"")); }
  };
  async function bulkSetStock(newStock){
    const ids = Array.from(invChecked);
    if(!ids.length) return;
    const btn = newStock ? document.querySelector("#invMarkInBtn") : document.querySelector("#invMarkOutBtn");
    busy(btn, true, "Updating…");
    const touched = ids.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
    const prevValues = touched.map(p=>p.stock);
    touched.forEach(p=>{ p.stock = newStock; });
    renderInventoryView(); renderProductsTable(); renderDashboard();
    try{
      await Promise.all(touched.map(p=>BazDS.upsertProduct(p)));
      invChecked.clear();
      renderInventoryView();
    }catch(err){
      touched.forEach((p,i)=>{ p.stock = prevValues[i]; });
      renderInventoryView(); renderProductsTable(); renderDashboard();
      alert("Could not update some products: " + (err.message||""));
    }finally{
      busy(btn, false);
    }
  }
  const invSearchEl = document.querySelector("#invSearch");
  if(invSearchEl) invSearchEl.addEventListener("input", renderInventoryView);
  const invFilterEl = document.querySelector("#invFilter");
  if(invFilterEl) invFilterEl.addEventListener("change", renderInventoryView);
  const invMarkInBtn = document.querySelector("#invMarkInBtn");
  if(invMarkInBtn) invMarkInBtn.addEventListener("click", ()=>bulkSetStock(true));
  const invMarkOutBtn = document.querySelector("#invMarkOutBtn");
  if(invMarkOutBtn) invMarkOutBtn.addEventListener("click", ()=>bulkSetStock(false));

  /* ---------- Inventory sub-tabs: Stock List / POS Billing / History ---------- */
  document.querySelectorAll(".ad-inv-tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      document.querySelectorAll(".ad-inv-tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.dataset.invtab;
      document.querySelector("#invStockPanel").style.display = which==="stock" ? "block" : "none";
      document.querySelector("#invPosPanel").style.display = which==="pos" ? "block" : "none";
      document.querySelector("#invHistoryPanel").style.display = which==="history" ? "block" : "none";
      if(which==="pos"){
        renderPosCats(); renderPosProductList(); renderPosCart(); refreshPosHolds();
        tickPosClock();
        const billNoEl = document.querySelector("#posBillNo");
        if(billNoEl && !billNoEl.value) resetPosBill();
      }
      if(which==="history") loadHistory();
    });
  });

  /* ================= POS (counter billing) =================
     Redesigned to match the reference POS layout Vikas sent (WhatsApp,
     10/10): a topbar (title, live date/time, Hold Sales / Recent Bills),
     a search + category-filtered product grid, and an editable bill panel
     on the right — bill no, a line-item table with an inline qty stepper,
     a note field, totals and Hold/Complete actions.
     A sale is still a cart of {productId, name, color, size, qty, price,
     img} built from PRODUCTS — "Complete Sale" writes it to the same
     `orders` table as a normal checkout (tagged source:"pos") and
     best-effort deducts the chosen colour's tracked quantity
     (product.colorStock — POS-only, see add_pos.sql, set from the Quick
     Add modal); "Hold Sale" parks the cart in pos_holds to resume later. */
  let posCart = [];
  let posHoldsCache = [];
  let posActiveCat = "";
  let posQaProduct = null;
  let posQaSel = {color:"", size:"", qty:1};
  let posRecentCache = [];

  function formatPosDateTime(d){
    return d.toLocaleDateString("en-IN",{weekday:"short", day:"2-digit", month:"short", year:"numeric"}) +
      ", " + d.toLocaleTimeString("en-IN",{hour:"numeric", minute:"2-digit", hour12:true});
  }
  // Shorter form (no weekday) for the narrow bill panel column, so it never
  // wraps awkwardly the way the full topbar format would at that width.
  function formatPosDateTimeShort(d){
    return d.toLocaleDateString("en-IN",{day:"2-digit", month:"short", year:"numeric"}) +
      ", " + d.toLocaleTimeString("en-IN",{hour:"numeric", minute:"2-digit", hour12:true});
  }
  function tickPosClock(){
    const now = new Date();
    const a = document.querySelector("#posDateTime"); if(a) a.textContent = formatPosDateTime(now);
    const b = document.querySelector("#posBillDateTime"); if(b) b.textContent = formatPosDateTimeShort(now);
  }
  setInterval(tickPosClock, 30000);

  async function nextPosBillNo(){
    try{
      const orders = await BazDS.getOrders();
      const posCount = orders.filter(o=>o.source==="pos").length;
      return "POS-" + String(posCount+1).padStart(6,"0");
    }catch(err){ return "POS-" + String(Date.now()).slice(-6); }
  }
  async function resetPosBill(){
    const billNoEl = document.querySelector("#posBillNo");
    if(billNoEl) billNoEl.value = await nextPosBillNo();
  }

  function renderPosCats(){
    const wrap = document.querySelector("#posCats"); if(!wrap) return;
    const cats = [...new Set(PRODUCTS.map(p=>p.cat).filter(Boolean))].sort();
    wrap.innerHTML = [`<button type="button" class="pos-cat-pill ${posActiveCat===""?'active':''}" data-cat="">All</button>`]
      .concat(cats.map(c=>`<button type="button" class="pos-cat-pill ${posActiveCat===c?'active':''}" data-cat="${c}">${c}</button>`))
      .join("");
  }

  function filteredPosProducts(){
    const q = (document.querySelector("#posProductSearch")?.value || "").trim().toLowerCase();
    return PRODUCTS.filter(p=>{
      if(posActiveCat && p.cat !== posActiveCat) return false;
      if(!q) return true;
      return (p.name||"").toLowerCase().includes(q) || (p.cat||"").toLowerCase().includes(q);
    });
  }

  /* POS unit price. tierFor() returns the tier whose Min qty the quantity reaches, and falls back to
     tiers[0] below the first Min qty. If that tier is ₹0 (e.g. a "1 pc → ₹0" placeholder row with the
     real price starting at 10), POS showed ₹0 until qty hit 10. Here a ₹0 result falls back to the
     nearest tier that actually has a price, so 1 pc is billed at the lowest real slab price. */
  /* Image for a colour variant: the product's per-colour gallery (Admin → Products → colour images)
     when that colour has one, else the main photo. */
  function posItemImg(p, color){
    const ci = p && p.colorImages && color ? p.colorImages[color] : null;
    return (ci && ci.length && ci[0]) || (p && p.img && p.img[0]) || "";
  }
  /* Non-blocking toast — POS used native alert()/confirm() popups (Vikas: "popups nahi chahiye"). */
  function posToast(msg, type){
    let host = document.querySelector("#adToastHost");
    if(!host){ host = document.createElement("div"); host.id = "adToastHost"; document.body.appendChild(host); }
    const t = document.createElement("div");
    t.className = "ad-toast " + (type==="error" ? "error" : "ok");
    t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(()=>t.classList.add("show"));
    setTimeout(()=>{ t.classList.remove("show"); setTimeout(()=>t.remove(), 350); }, type==="error" ? 4500 : 2200);
  }
  function posUnitPrice(p, qty){
    const t = tierFor(p, qty);
    if(t && t.price > 0) return t.price;
    const priced = (p && Array.isArray(p.tiers) ? p.tiers : []).filter(x=>x.price>0).sort((a,b)=>a.min-b.min);
    if(!priced.length) return 0;
    let pick = priced[0];
    for(const x of priced){ if(qty >= x.min) pick = x; }
    return pick.price;
  }
  function renderPosProductList(){
    const wrap = document.querySelector("#posProductList"); if(!wrap) return;
    const list = filteredPosProducts();
    wrap.innerHTML = list.length ? list.map(p=>{
      const t = {price: posUnitPrice(p, 1)};
      return `
      <div class="pos-product-card" data-id="${p.id}">
        <div class="pos-product-img"><img src="${(p.img&&p.img[0])||''}" alt="" loading="lazy"></div>
        <div class="pos-product-body">
          <b class="pos-product-name">${p.name}</b>
          <div class="pos-product-price">${money(t.price)}</div>
          <div class="pos-product-stock ${p.stock?'in':'out'}"><i></i>${p.stock?'In Stock':'Out of Stock'}${stockLeftLabel(p)}</div>
          <button type="button" class="btn btn-outline btn-sm pos-product-addbtn" data-id="${p.id}">+ Add</button>
        </div>
      </div>`;
    }).join("") : `<p class="ad-hint" style="grid-column:1/-1">No products found.</p>`;
  }

  /* ---------- Quick Add modal (colour / size / qty, opened by tapping a
     product card — the "+Add" button on the card itself skips straight to
     a 1-qty add with the default colour/size for a fast single tap) ---- */
  function quickAddDirect(productId){
    const p = PRODUCTS.find(x=>x.id===productId); if(!p) return;
    const color = (p.colors&&p.colors[0])||"", size = (p.sizes&&p.sizes[0])||"";
    const t = {price: posUnitPrice(p, 1)};
    posCart.push({productId:p.id, name:p.name, color, size, qty:1, price:t.price, img:posItemImg(p,color)});
    renderPosCart();
  }

  function openPosQuickAdd(productId){
    const p = PRODUCTS.find(x=>x.id===productId); if(!p) return;
    posQaProduct = p;
    posQaSel = {color:(p.colors&&p.colors[0])||"", size:(p.sizes&&p.sizes[0])||"", qty:1};
    renderPosQuickAdd();
    document.querySelector("#posQuickAddModalBackdrop").classList.add("show");
  }
  function closePosQuickAdd(){
    document.querySelector("#posQuickAddModalBackdrop").classList.remove("show");
    posQaProduct = null;
  }
  function renderPosQuickAdd(){
    const p = posQaProduct; if(!p) return;
    const t = {price: posUnitPrice(p, posQaSel.qty)};
    const stockVal = (p.colorStock && posQaSel.color && p.colorStock[posQaSel.color]!=null) ? p.colorStock[posQaSel.color] : "";
    document.querySelector("#posQuickAddBody").innerHTML = `
      <div class="pos-qa-top">
        <img class="pos-qa-img" src="${posItemImg(p,posQaSel.color)}" alt="">
        <div>
          <h3 class="pos-qa-name">${p.name}</h3>
          <div class="pos-qa-price">${money(t.price)}<small> / pc</small></div>
        </div>
      </div>
      ${(p.colors&&p.colors.length) ? `
      <label class="pos-qa-label">Colour</label>
      <div class="pos-qa-swatches">${p.colors.map(c=>`<span class="pos-qa-swatch ${c===posQaSel.color?'active':''}" style="background:${c}" data-color="${c}" title="${c}"></span>`).join("")}</div>
      <input type="number" min="0" id="posQaStockVal" class="pos-qa-stockinput" placeholder="Stock for this colour (optional)" value="${stockVal}">` : ""}
      ${(p.sizes&&p.sizes.length) ? `
      <label class="pos-qa-label">Size</label>
      <div class="pos-qa-sizes">${p.sizes.map(s=>`<button type="button" class="pos-qa-size ${s===posQaSel.size?'active':''}" data-size="${s}">${s}</button>`).join("")}</div>` : ""}
      <label class="pos-qa-label">Quantity</label>
      <div class="pos-qa-qtyrow">
        <button type="button" class="ad-icon-btn" id="posQaMinus">−</button>
        <span class="pos-qa-qtyval" id="posQaQtyVal">${posQaSel.qty}</span>
        <button type="button" class="ad-icon-btn" id="posQaPlus">+</button>
      </div>`;
    const addBtn = document.querySelector("#posQaAddBtn");
    if(addBtn) addBtn.textContent = `Add to Cart  ·  ${money(t.price*posQaSel.qty)}`;
  }
  const posQaBody = document.querySelector("#posQuickAddBody");
  if(posQaBody){
    posQaBody.addEventListener("click", (e)=>{
      const sw = e.target.closest(".pos-qa-swatch");
      if(sw){ posQaSel.color = sw.dataset.color; renderPosQuickAdd(); return; }
      const sz = e.target.closest(".pos-qa-size");
      if(sz){ posQaSel.size = sz.dataset.size; renderPosQuickAdd(); return; }
      if(e.target.closest("#posQaMinus")){ posQaSel.qty = Math.max(1, posQaSel.qty-1); renderPosQuickAdd(); return; }
      if(e.target.closest("#posQaPlus")){ posQaSel.qty = posQaSel.qty+1; renderPosQuickAdd(); return; }
    });
    posQaBody.addEventListener("focusout", (e)=>{
      if(e.target.id==="posQaStockVal" && posQaProduct) savePosStock(posQaProduct.id, posQaSel.color, e.target.value.trim());
    });
  }
  const posQaAddBtn = document.querySelector("#posQaAddBtn");
  if(posQaAddBtn) posQaAddBtn.addEventListener("click", ()=>{
    const p = posQaProduct; if(!p) return;
    const qty = Math.max(1, posQaSel.qty);
    const t = {price: posUnitPrice(p, qty)};
    posCart.push({productId:p.id, name:p.name, color:posQaSel.color, size:posQaSel.size, qty, price:t.price, img:posItemImg(p,posQaSel.color)});
    renderPosCart();
    closePosQuickAdd();
  });
  [document.querySelector("#closePosQuickAddModal"), document.querySelector("#cancelPosQuickAddBtn")].forEach(b=>{
    if(b) b.addEventListener("click", closePosQuickAdd);
  });

  async function savePosStock(productId, color, value){
    const p = PRODUCTS.find(x=>x.id===productId); if(!p || !color) return;
    const num = value==="" ? null : Math.max(0, Number(value)||0);
    p.colorStock = {...(p.colorStock||{})};
    if(num==null) delete p.colorStock[color]; else p.colorStock[color] = num;
    try{ await BazDS.upsertProduct(p); }
    catch(err){ posToast("Could not save stock: " + (err.message||""), "error"); }
  }

  /* ---------- the bill itself (right panel) ---------- */
  function variantLabel(item){
    const parts = [];
    if(item.color) parts.push(`<i class="pos-cart-dot" style="background:${item.color}"></i>`);
    if(item.size) parts.push(item.size);
    return parts.length ? parts.join(" ") : "—";
  }
  function renderPosCart(){
    const wrap = document.querySelector("#posCart"); if(!wrap) return;
    wrap.innerHTML = posCart.length ? posCart.map((item,i)=>`
      <tr class="pos-cart-row">
        <td class="pos-cart-prod"><img src="${item.img||''}" alt=""><span>${item.name}</span></td>
        <td class="pos-cart-variant">${variantLabel(item)}</td>
        <td><div class="pos-qty-stepper">
          <button type="button" class="pos-qty-minus" data-i="${i}" title="Decrease">−</button>
          <span>${item.qty}</span>
          <button type="button" class="pos-qty-plus" data-i="${i}" title="Increase">+</button>
        </div></td>
        <td class="pos-cart-total"><b>${money(item.qty*item.price)}</b></td>
        <td><button type="button" class="ad-icon-btn danger pos-cart-removebtn" data-i="${i}" title="Remove">🗑️</button></td>
      </tr>`).join("") : `<tr><td colspan="5"><p class="ad-hint" style="margin:0;text-align:center;padding:26px 0">Cart is empty — add products from the catalogue.</p></td></tr>`;
    const totalItems = posCart.reduce((s,it)=>s+it.qty,0);
    const total = posCart.reduce((s,it)=>s+it.qty*it.price,0);
    const itemsCountEl = document.querySelector("#posItemsCount"); if(itemsCountEl) itemsCountEl.textContent = posCart.length;
    const totalItemsEl = document.querySelector("#posTotalItems"); if(totalItemsEl) totalItemsEl.textContent = totalItems;
    const totalEl = document.querySelector("#posTotal"); if(totalEl) totalEl.textContent = money(total);
    const holdBtn = document.querySelector("#posHoldBtn"), completeBtn = document.querySelector("#posCompleteBtn");
    if(holdBtn) holdBtn.disabled = !posCart.length;
    if(completeBtn) completeBtn.disabled = !posCart.length;
  }
  function changeCartQty(i, delta){
    const item = posCart[i]; if(!item) return;
    const newQty = Math.max(1, item.qty + delta);
    if(newQty === item.qty) return;
    const p = PRODUCTS.find(x=>x.id===item.productId);
    item.qty = newQty;
    if(p) item.price = posUnitPrice(p, newQty); // recompute bulk-tier price at the new qty
    renderPosCart();
  }
  function clearCart(){
    if(!posCart.length) return;
    posCart = [];
    renderPosCart();
  }

  async function holdSale(){
    if(!posCart.length) return;
    const nameInput = document.querySelector("#posCustomerName");
    const noteInput = document.querySelector("#posOrderNote");
    const billNo = document.querySelector("#posBillNo")?.value || "";
    const label = (nameInput.value.trim()) || billNo || ("Hold " + new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));
    const subtotal = posCart.reduce((s,it)=>s+it.qty*it.price,0);
    const btn = document.querySelector("#posHoldBtn");
    busy(btn, true, "Holding…");
    try{
      await BazDS.holdPosSale({label, items:posCart, subtotal});
      posCart = []; nameInput.value = ""; if(noteInput) noteInput.value = "";
      const noteRow = document.querySelector("#posNoteRow"); if(noteRow) noteRow.style.display = "none";
      renderPosCart();
      await resetPosBill();
      await refreshPosHolds();
    }catch(err){ posToast("Could not hold sale: " + (err.message||""), "error"); }
    finally{ busy(btn, false); }
  }

  async function completeSale(){
    if(!posCart.length) return;
    const customerName = document.querySelector("#posCustomerName").value.trim();
    const noteInput = document.querySelector("#posOrderNote");
    const billNo = document.querySelector("#posBillNo")?.value || "";
    const note = (noteInput?.value||"").trim();
    const subtotal = posCart.reduce((s,it)=>s+it.qty*it.price,0);
    const btn = document.querySelector("#posCompleteBtn");
    busy(btn, true, "Completing…");
    try{
      await BazDS.createPosSale({
        customerName,
        items: posCart.map(it=>({productId:it.productId, name:it.name, color:it.color, size:it.size, qty:it.qty, price:it.price})),
        subtotal,
        notes: [billNo?`Bill No: ${billNo}`:"", note].filter(Boolean).join(" — ")
      });
      // Best-effort: take the sold qty off the tracked stock number (per colour, or the product's single
      // total) — and flip to Out of stock automatically at 0. Never blocks the sale if it fails.
      const soldTouched = new Set();
      for(const item of posCart){
        const p = PRODUCTS.find(x=>x.id===item.productId);
        if(deductStock(p, item.color, item.qty, item.size)) soldTouched.add(p);
      }
      let stockWarn = false;
      for(const p of soldTouched){
        try{ const sv = await BazDS.upsertProduct(p); if(stockWasStripped(sv)) stockWarn = true; }catch(err){ console.error("POS stock deduction failed for", p.name, err); stockWarn = true; }
      }
      renderInventoryView(); renderProductsTable();
      posCart = []; document.querySelector("#posCustomerName").value = "";
      if(noteInput) noteInput.value = "";
      const noteRow = document.querySelector("#posNoteRow"); if(noteRow) noteRow.style.display = "none";
      renderPosCart(); renderPosProductList();
      await resetPosBill();
      try{ allOrdersCache = await BazDS.getOrders(); }catch(err){ console.error(err); }
      renderDashboard();
      posToast("✅ Sale completed");
      if(stockWarn) posToast("Sale ho gayi, par stock minus nahi hua — "+STOCK_SQL_MSG,"error");
      else if(!soldTouched.size) posToast("Stock minus nahi hua: in products ki quantity Inventory me set nahi hai (Inventory → Qty bharo).","error");
    }catch(err){ posToast("Could not complete sale: " + (err.message||""), "error"); }
    finally{ busy(btn, false); }
  }

  /* ---------- Hold Sales modal ---------- */
  async function refreshPosHolds(){
    posHoldsCache = await BazDS.getPosHolds().catch(()=>[]);
    renderPosHolds();
    const pill = document.querySelector("#posHoldsCount");
    if(pill){
      if(posHoldsCache.length){ pill.textContent = posHoldsCache.length; pill.style.display = "inline-flex"; }
      else pill.style.display = "none";
    }
  }
  function renderPosHolds(){
    const wrap = document.querySelector("#posHoldsList"); if(!wrap) return;
    wrap.innerHTML = posHoldsCache.length ? posHoldsCache.map(h=>`
      <div class="pos-bill-row" data-id="${h.id}">
        <div><b>${h.label||"Held sale"}</b><span class="ad-hint" style="margin:0;display:block">${(h.items||[]).length} item(s) · ${money(h.subtotal||0)}</span></div>
        <div class="ad-row-actions">
          <button type="button" class="btn btn-outline btn-sm pos-resumebtn" data-id="${h.id}">Resume</button>
          <button type="button" class="ad-icon-btn danger pos-deleteholdbtn" data-id="${h.id}" title="Delete">🗑️</button>
        </div>
      </div>`).join("") : `<p class="ad-hint" style="margin:0">No held sales.</p>`;
  }
  async function resumeHold(id){
    const h = posHoldsCache.find(x=>x.id===id); if(!h) return;
    posCart = (h.items||[]).slice();
    renderPosCart();
    try{ await BazDS.deletePosHold(id); }catch(err){ console.error(err); }
    await refreshPosHolds();
    closePosHoldsModal();
  }
  async function deleteHoldHandler(id){
    try{ await BazDS.deletePosHold(id); await refreshPosHolds(); }
    catch(err){ posToast("Could not delete: " + (err.message||""), "error"); }
  }
  const posHoldsBtn = document.querySelector("#posHoldsBtn");
  if(posHoldsBtn) posHoldsBtn.addEventListener("click", async ()=>{ await refreshPosHolds(); document.querySelector("#posHoldsModalBackdrop").classList.add("show"); });
  const closePosHoldsModal = ()=>document.querySelector("#posHoldsModalBackdrop").classList.remove("show");
  [document.querySelector("#closePosHoldsModal"), document.querySelector("#cancelPosHoldsBtn")].forEach(b=>{ if(b) b.addEventListener("click", closePosHoldsModal); });
  const posHoldsModalBackdrop = document.querySelector("#posHoldsModalBackdrop");
  if(posHoldsModalBackdrop) posHoldsModalBackdrop.addEventListener("click", (e)=>{
    const resumeBtn = e.target.closest(".pos-resumebtn");
    if(resumeBtn){ resumeHold(Number(resumeBtn.dataset.id)); return; }
    const delBtn = e.target.closest(".pos-deleteholdbtn");
    if(delBtn){ deleteHoldHandler(Number(delBtn.dataset.id)); return; }
  });

  /* ---------- Recent Bills modal (completed POS sales — orders tagged
     source:"pos"; row click reuses the existing Order Detail modal) ---- */
  function posRecentRowHtml(o){
    const dt = new Date(o.created_at);
    const dateStr = dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) + ", " + dt.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit",hour12:true});
    return `<div class="pos-bill-row pos-bill-row-click" data-id="${o.id}">
      <div><b>${o.ref}</b><span class="ad-hint" style="margin:0;display:block">${o.customer_name||"Walk-in Customer"} · ${dateStr}</span></div>
      <div class="pos-bill-row-right">
        <b>${money(o.subtotal||0)}</b>
        <span class="pos-bill-chevron">›</span>
      </div>
    </div>`;
  }
  function renderPosRecent(){
    const wrap = document.querySelector("#posRecentList"); if(!wrap) return;
    const q = (document.querySelector("#posRecentSearch")?.value||"").trim().toLowerCase();
    const list = q ? posRecentCache.filter(o=>(o.ref||"").toLowerCase().includes(q) || (o.customer_name||"").toLowerCase().includes(q)) : posRecentCache;
    wrap.innerHTML = list.length ? list.map(posRecentRowHtml).join("") : `<p class="ad-hint" style="margin:0">No bills yet — completed POS sales will show up here.</p>`;
  }
  async function refreshPosRecent(){
    try{ const orders = await BazDS.getOrders(); posRecentCache = orders.filter(o=>o.source==="pos"); }
    catch(err){ console.error(err); posRecentCache = []; }
    renderPosRecent();
  }
  const posRecentBtn = document.querySelector("#posRecentBtn");
  if(posRecentBtn) posRecentBtn.addEventListener("click", async ()=>{ await refreshPosRecent(); document.querySelector("#posRecentModalBackdrop").classList.add("show"); });
  const closePosRecentModal = ()=>document.querySelector("#posRecentModalBackdrop").classList.remove("show");
  [document.querySelector("#closePosRecentModal"), document.querySelector("#cancelPosRecentBtn")].forEach(b=>{ if(b) b.addEventListener("click", closePosRecentModal); });
  const posRecentSearchEl = document.querySelector("#posRecentSearch");
  if(posRecentSearchEl) posRecentSearchEl.addEventListener("input", renderPosRecent);
  const posRecentModalBackdrop = document.querySelector("#posRecentModalBackdrop");
  if(posRecentModalBackdrop) posRecentModalBackdrop.addEventListener("click", (e)=>{
    const row = e.target.closest(".pos-bill-row-click");
    if(row){ closePosRecentModal(); AdminUI.openOrder(Number(row.dataset.id)); }
  });

  /* ---------- History (Inventory → History tab) ----------
     The "Recent Bills" popup above only shows a quick, unfiltered list
     while billing. This tab is the full picture: every completed POS bill
     (orders tagged source:"pos"), searchable by bill ref/customer and
     filterable by date range, with a CSV export — for looking back over a
     whole day/week's counter sales rather than just the last few. */
  let historyCache = [];
  async function loadHistory(){
    try{ allOrdersCache = await BazDS.getOrders(); }catch(err){ console.error(err); }
    historyCache = (allOrdersCache||[]).filter(o=>o.source==="pos")
      .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
    renderHistoryStats();
    renderHistoryTable();
  }
  function filteredHistory(){
    const q = (document.querySelector("#historySearch")?.value||"").trim().toLowerCase();
    const from = document.querySelector("#historyFrom")?.value || "";
    const to = document.querySelector("#historyTo")?.value || "";
    return historyCache.filter(o=>{
      if(q && !(((o.ref||"")+" "+(o.notes||"")+" "+(o.customer_name||"")+" "+(o.customer_phone||"")+" "+(Array.isArray(o.items)?o.items.map(i=>i.name).join(" "):"")).toLowerCase().includes(q))) return false;
      const d = o.created_at ? o.created_at.slice(0,10) : "";
      if(from && d < from) return false;
      if(to && d > to) return false;
      return true;
    });
  }
  function renderHistoryStats(){
    const el = document.querySelector("#historyStats"); if(!el) return;
    const list = filteredHistory();
    const revenue = list.reduce((s,o)=>s+(o.subtotal||0),0);
    const todayStr = new Date().toISOString().slice(0,10);
    const todayList = list.filter(o=>(o.created_at||"").slice(0,10)===todayStr);
    const todayRevenue = todayList.reduce((s,o)=>s+(o.subtotal||0),0);
    el.innerHTML = `
      <div class="ad-stat"><b>${list.length}</b><span>Bills${(document.querySelector("#historySearch")?.value||document.querySelector("#historyFrom")?.value||document.querySelector("#historyTo")?.value)?" (filtered)":""}</span></div>
      <div class="ad-stat"><b>${money(revenue)}</b><span>Revenue${(document.querySelector("#historySearch")?.value||document.querySelector("#historyFrom")?.value||document.querySelector("#historyTo")?.value)?" (filtered)":""}</span></div>
      <div class="ad-stat"><b>${todayList.length}</b><span>Bills today</span></div>
      <div class="ad-stat"><b>${money(todayRevenue)}</b><span>Revenue today</span></div>`;
  }
  function historyRowHtml(o){
    const items = Array.isArray(o.items) ? o.items : [];
    const itemCount = items.reduce((n,it)=>n+(it.qty||1),0);
    const bn = (/Bill No: (POS-\d+)/.exec(o.notes||"")||[])[1];
    const walk = !o.customer_name || o.customer_name==="Walk-in counter sale";
    const colName = it=>{ if(!it.color) return ""; const p = PRODUCTS.find(x=>String(x.id)===String(it.productId)); return (p&&p.colorNames&&p.colorNames[it.color]) || ""; };
    const lines = items.map(it=>{
      const v = [colName(it), it.size && it.size!=="Standard" ? it.size : ""].filter(Boolean).join(" · ");
      return `<div class="hist-item"><span>${it.name}${v?` <small>(${v})</small>`:""}</span><b>× ${it.qty||1}</b><span class="hist-amt">${money((it.qty||1)*(it.price||0))}</span></div>`;
    }).join("");
    return `<tr data-id="${o.id}">
      <td><b>${bn||o.ref}</b>${bn?`<br><small class="ad-hint" style="margin:0">${o.ref}</small>`:""}</td>
      <td>${walk?"Walk-in customer":o.customer_name}${o.customer_phone?`<br><small class="ad-hint" style="margin:0">📞 ${o.customer_phone}</small>`:""}<br><small class="ad-hint" style="margin:0">${(o.payment_method||"cash").toUpperCase()}</small></td>
      <td class="hist-items">${lines || `${itemCount} pcs`}<div class="hist-pcs">${itemCount} pcs</div></td>
      <td>${money(o.subtotal||0)}</td>
      <td>${new Date(o.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}, ${new Date(o.created_at).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit",hour12:true})}</td>
      <td class="ad-row-actions"><button class="ad-icon-btn" title="View bill" onclick="AdminUI.openOrder(${o.id})">👁️</button><button class="ad-icon-btn" title="Edit bill" onclick="AdminUI.editBill(${o.id})">✏️</button></td>
    </tr>`;
  }
  function renderHistoryTable(){
    // Note: unlike the Orders/Enquiries tables, this never replaces the
    // table wrapper's innerHTML with a plain empty-state message — doing
    // that would delete the <table id="historyTable"> element itself, and
    // once a bill gets completed in the same session there'd be no table
    // left for the next render to find (document.querySelector would
    // return null and silently no-op). Keeping the row inside the table
    // keeps #historyTable alive for the empty→filled transition.
    const el = document.querySelector("#historyTable"); if(!el) return;
    if(!historyCache.length){
      el.innerHTML = `<tr><td style="padding:28px 16px;text-align:center" class="ad-hint">No POS bills yet — completed counter sales will show up here.</td></tr>`;
      return;
    }
    const list = filteredHistory();
    el.innerHTML = `<tr><th>Bill No.</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th></th></tr>` +
      (list.length ? list.map(historyRowHtml).join("") : `<tr><td colspan="6"><p class="ad-hint" style="margin:0;text-align:center;padding:20px 0">No bills match this filter.</p></td></tr>`);
  }

  /* ---------- Edit a POS bill (Inventory → History → ✏️) ----------
     For corrections after the sale — e.g. 10 diaries were billed and 5 came back. Qty / price can be
     changed per line, a line can be removed, and the customer name edited. Colour stock is adjusted
     by the difference (returned pieces go back into stock, extra pieces are deducted). */
  let editingBill = null; // {id, orig:[items], rows:[{i,qty,price,removed}]}
  function findBillProduct(it){
    return PRODUCTS.find(x=>x.id===it.productId) || PRODUCTS.find(x=>x.name===it.name) || null;
  }
  function billEditTotal(){
    return editingBill.rows.reduce((s,r)=> r.removed ? s : s + (Number(r.qty)||0)*(Number(r.price)||0), 0);
  }
  function renderBillEdit(){
    const b = editingBill; if(!b) return;
    document.querySelector("#billEditBody").innerHTML = `
      <div class="ad-field"><label>Customer name</label><input id="be_name" value="${(b.customer||"").replace(/"/g,'&quot;')}" placeholder="Walk-in counter sale"></div>
      <div class="be-list">
        <div class="be-head"><span>Product</span><span>Qty</span><span>Price</span><span>Total</span><span></span></div>
        ${b.rows.map((r,idx)=>{
          const it = b.orig[r.i];
          const p = findBillProduct(it);
          // options = the product's colours/sizes, plus whatever the bill already has (in case it was since removed from the product)
          const colors = [...new Set([...(p&&p.colors||[]), ...(r.color?[r.color]:[])])];
          const sizes = [...new Set([...(p&&p.sizes||[]), ...(r.size?[r.size]:[])])];
          const variant = (colors.length || sizes.length) ? `<div class="be-variant">
              ${colors.length?`<span class="be-swatches">${colors.map(c=>`<span class="be-swatch ${c===r.color?'active':''}" data-color="${c}" style="background:${c}" title="${c}"></span>`).join("")}</span>`:""}
              ${sizes.length?`<select class="be-size"><option value="">Size</option>${sizes.map(sz=>`<option value="${sz}" ${sz===r.size?'selected':''}>${sz}</option>`).join("")}</select>`:""}
            </div>` : "";
          return `<div class="be-row ${r.removed?'removed':''}" data-idx="${idx}">
            <span class="be-name"><b>${it.name||"Item"}</b>${variant}${r.removed?`<small class="be-removed">Removed</small>`:""}</span>
            <input type="number" min="0" class="be-qty" value="${r.qty}" ${r.removed?"disabled":""}>
            <span class="be-priceval">${money(Number(r.price)||0)}</span>
            <b class="be-line">${r.removed?"—":money((Number(r.qty)||0)*(Number(r.price)||0))}</b>
            <button type="button" class="ad-icon-btn ${r.removed?'':'danger'} be-toggle" title="${r.removed?'Restore line':'Remove line'}">${r.removed?"↩️":"🗑️"}</button>
          </div>`;}).join("")}
      </div>
      <div class="be-total"><span>New total</span><b id="be_total">${money(billEditTotal())}</b></div>
      <p class="ad-hint" style="margin:8px 0 0">Stock is adjusted automatically for colours that have tracked stock.</p>
      <p class="ad-hint" id="be_error" style="color:#c0392b;display:none;margin:12px 0 0"></p>`;
  }
  AdminUI.editBill = (id)=>{
    const o = (allOrdersCache||[]).find(x=>x.id===id); if(!o) return;
    const orig = (o.items||[]).map(it=>({...it}));
    editingBill = {id, ref:o.ref, customer:(o.customer_name==="Walk-in counter sale"?"":o.customer_name)||"", orig,
      rows: orig.map((it,i)=>({i, qty:it.qty||1, price:it.price||0, color:it.color||"", size:it.size||"", removed:false}))};
    document.querySelector("#billEditTitle").textContent = "Edit Bill " + (o.ref||"");
    renderBillEdit();
    document.querySelector("#billEditModalBackdrop").classList.add("show");
  };
  const closeBillEdit = ()=>{ document.querySelector("#billEditModalBackdrop").classList.remove("show"); editingBill = null; };
  [document.querySelector("#closeBillEditModal"), document.querySelector("#cancelBillEditBtn")].forEach(b=>{ if(b) b.addEventListener("click", closeBillEdit); });
  const billEditBody = document.querySelector("#billEditBody");
  if(billEditBody){
    billEditBody.addEventListener("input", (e)=>{
      if(!editingBill) return;
      const row = e.target.closest(".be-row"); if(!row) return;
      const r = editingBill.rows[Number(row.dataset.idx)];
      if(e.target.classList.contains("be-qty")) r.qty = e.target.value;
      row.querySelector(".be-line").textContent = money((Number(r.qty)||0)*(Number(r.price)||0));
      document.querySelector("#be_total").textContent = money(billEditTotal());
    });
    billEditBody.addEventListener("change", (e)=>{
      if(!editingBill || !e.target.classList.contains("be-size")) return;
      editingBill.rows[Number(e.target.closest(".be-row").dataset.idx)].size = e.target.value;
    });
    billEditBody.addEventListener("click", (e)=>{
      const sw = e.target.closest(".be-swatch");
      if(sw && editingBill){
        editingBill.customer = document.querySelector("#be_name").value;
        editingBill.rows[Number(sw.closest(".be-row").dataset.idx)].color = sw.dataset.color;
        renderBillEdit(); return;
      }
      const t = e.target.closest(".be-toggle"); if(!t || !editingBill) return;
      editingBill.customer = document.querySelector("#be_name").value;
      const r = editingBill.rows[Number(t.closest(".be-row").dataset.idx)];
      r.removed = !r.removed; renderBillEdit();
    });
  }
  const saveBillEditBtn = document.querySelector("#saveBillEditBtn");
  if(saveBillEditBtn) saveBillEditBtn.addEventListener("click", async ()=>{
    const b = editingBill; if(!b) return;
    const err = document.querySelector("#be_error");
    const kept = b.rows.filter(r=>!r.removed && Number(r.qty)>0);
    if(!kept.length){ err.textContent = "Bill me kam se kam ek item rehna chahiye."; err.style.display = "block"; return; }
    const items = kept.map(r=>({...b.orig[r.i], color:r.color, size:r.size, qty:Math.round(Number(r.qty)), price:Number(r.price)||0}));
    const subtotal = items.reduce((s,it)=>s+it.qty*it.price,0);
    const customerName = document.querySelector("#be_name").value.trim();
    busy(saveBillEditBtn, true, "Saving…");
    try{
      await BazDS.updatePosSale(b.id, {customerName, items, subtotal});
      // stock: the original colour gets the old qty back, the (possibly new) colour is charged the new qty.
      // Only colours that have tracked stock are touched.
      const touched = new Set();
      const bump = (p, color, delta, size)=>{ if(deductStock(p, color, -delta, size)) touched.add(p); };
      b.rows.forEach(r=>{
        const it = b.orig[r.i], p = findBillProduct(it);
        const newQty = (r.removed || !(Number(r.qty)>0)) ? 0 : Math.round(Number(r.qty));
        bump(p, it.color, +(it.qty||1), it.size);
        bump(p, r.color, -newQty, r.size!=null ? r.size : it.size);
      });
      for(const p of touched){ try{ const sv = await BazDS.upsertProduct(p); if(stockWasStripped(sv)) posToast(STOCK_SQL_MSG,"error"); }catch(e){ console.error("Stock adjust failed for", p.name, e); } }
      closeBillEdit();
      await loadHistory(); renderPosProductList();
      try{ renderDashboard(); }catch(e){}
    }catch(e){ err.textContent = "Could not save: " + (e.message||e); err.style.display = "block"; }
    finally{ busy(saveBillEditBtn, false); }
  });

  function exportHistoryCsv(list){
    const header = ["Bill No.","Customer","Items","Total","Date"];
    const rows = list.map(o=>{
      const itemCount = (o.items||[]).reduce((n,it)=>n+(it.qty||1),0);
      return [o.ref, o.customer_name||"Walk-in Customer", itemCount, o.subtotal||0, new Date(o.created_at).toLocaleString("en-IN")];
    });
    const csv = [header, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bazarville-pos-history-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  [document.querySelector("#historySearch"), document.querySelector("#historyFrom"), document.querySelector("#historyTo")].forEach(el=>{
    if(el) el.addEventListener("input", ()=>{ renderHistoryStats(); renderHistoryTable(); });
  });
  const historyClearFilterBtn = document.querySelector("#historyClearFilterBtn");
  if(historyClearFilterBtn) historyClearFilterBtn.addEventListener("click", ()=>{
    const s = document.querySelector("#historySearch"), f = document.querySelector("#historyFrom"), t = document.querySelector("#historyTo");
    if(s) s.value = ""; if(f) f.value = ""; if(t) t.value = "";
    renderHistoryStats(); renderHistoryTable();
  });
  const historyExportBtn = document.querySelector("#historyExportBtn");
  if(historyExportBtn) historyExportBtn.addEventListener("click", ()=> exportHistoryCsv(filteredHistory()));

  /* ---------- catalogue / cart interactions + misc POS buttons ---------- */
  const posPanel = document.querySelector("#invPosPanel");
  if(posPanel){
    posPanel.addEventListener("click", (e)=>{
      const catPill = e.target.closest(".pos-cat-pill");
      if(catPill){ posActiveCat = catPill.dataset.cat || ""; renderPosCats(); renderPosProductList(); return; }
      const addBtn = e.target.closest(".pos-product-addbtn");
      if(addBtn){ quickAddDirect(Number(addBtn.dataset.id)); return; }
      const prodCard = e.target.closest(".pos-product-card");
      if(prodCard){ openPosQuickAdd(Number(prodCard.dataset.id)); return; }
      const qtyMinus = e.target.closest(".pos-qty-minus");
      if(qtyMinus){ changeCartQty(Number(qtyMinus.dataset.i), -1); return; }
      const qtyPlus = e.target.closest(".pos-qty-plus");
      if(qtyPlus){ changeCartQty(Number(qtyPlus.dataset.i), 1); return; }
      const rmBtn = e.target.closest(".pos-cart-removebtn");
      if(rmBtn){ posCart.splice(Number(rmBtn.dataset.i),1); renderPosCart(); return; }
    });
  }
  const posSearchEl = document.querySelector("#posProductSearch");
  if(posSearchEl) posSearchEl.addEventListener("input", renderPosProductList);
  const posEditBillNoBtn = document.querySelector("#posEditBillNoBtn");
  if(posEditBillNoBtn) posEditBillNoBtn.addEventListener("click", ()=>{
    const el = document.querySelector("#posBillNo"); if(!el) return;
    el.readOnly = !el.readOnly;
    if(!el.readOnly) el.focus();
  });
  const posAddNoteBtn = document.querySelector("#posAddNoteBtn");
  if(posAddNoteBtn) posAddNoteBtn.addEventListener("click", ()=>{
    const row = document.querySelector("#posNoteRow"); if(!row) return;
    row.style.display = row.style.display==="none" ? "flex" : "none";
    if(row.style.display==="flex") document.querySelector("#posOrderNote").focus();
  });
  const posClearCartBtn = document.querySelector("#posClearCartBtn");
  if(posClearCartBtn) posClearCartBtn.addEventListener("click", clearCart);
  const posHoldBtn = document.querySelector("#posHoldBtn");
  if(posHoldBtn) posHoldBtn.addEventListener("click", holdSale);
  const posCompleteBtn = document.querySelector("#posCompleteBtn");
  if(posCompleteBtn) posCompleteBtn.addEventListener("click", completeSale);

  let editingProductId = null;
  let productImages = [];
  // Parallel to productImages: "" (no colour tag — shows for every colour,
  // same as before) or one of workingColors' hex values. Tagging an image
  // here is a shortcut for the same thing the "Colour-specific images"
  // section below does — it just saves re-uploading the same photo there
  // when it's already sitting in the main gallery.
  let productImageColors = [];

  function productFormHtml(p){
    return `
    <div class="pf-layout">
      <div class="pf-main">
      <section class="pf-card ">
        <div class="pf-card-head"><span class="pf-num">1</span><div><h3>Basic Information</h3><p>Name, category and brand</p></div></div>
        <div class="ad-form-grid">
      <div class="ad-field full"><label>Product name</label><input id="pf_name" value="${p?p.name.replace(/"/g,'&quot;'):''}"></div>
      <div class="ad-field"><label>Category</label><input id="pf_cat" value="${p?p.cat:''}" placeholder="e.g. T-Shirts"></div>
      <div class="ad-field"><label>Brand (internal, optional)</label><input id="pf_brand" value="${p&&p.brand?p.brand:''}"></div>
        </div>
      </section>
      <details class="pf-card pf-acc ">
        <summary class="pf-card-head"><span class="pf-num">2</span><div><h3>Variants</h3><p>Colours and sizes of this product</p></div><span class="pf-chev">▾</span></summary>
        <div class="ad-form-grid pf-acc-body">
      <div class="ad-field full">
        <label>Colours</label>
        <div class="ad-tag-group" id="pf_colorChips"></div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <input type="color" id="pf_colorPicker" value="#1a1a1a" style="width:44px;height:38px;padding:2px;border:1.5px solid var(--line);border-radius:8px;cursor:pointer">
          <input type="text" id="pf_colorName" maxlength="30" placeholder="Colour name (e.g. Black) — shown on the site" style="flex:1;min-width:140px;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addColorBtn">+ Add colour</button>
        </div>
      </div>
      <div class="ad-field full">
        <label>Colour-specific images <span class="ad-hint" style="display:inline">(optional — when a customer clicks this colour on the product page, the photo gallery switches to these. A colour with none here just keeps showing the main product images above.)</span></label>
        <div id="pf_colorImageGroups"></div>
      </div>
      <div class="ad-field full">
        <label>Sizes</label>
        <div class="ad-tag-group" id="pf_sizeChips"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="pf_sizeInput" placeholder="e.g. XL" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addSizeBtn">+ Add size</button>
        </div>
      </div>
        </div>
      </details>
      <details class="pf-card pf-acc ">
        <summary class="pf-card-head"><span class="pf-num">3</span><div><h3>Pricing &amp; Order</h3><p>MOQ, bulk threshold, stock and quantity-tier prices</p></div><span class="pf-chev">▾</span></summary>
        <div class="ad-form-grid pf-acc-body">
      <div class="ad-field"><label>MOQ (pcs)</label><input id="pf_moq" type="number" value="${p?p.moq:10}"></div>
      <div class="ad-field"><label>Bulk enquiry threshold (pcs)</label><input id="pf_bulk" type="number" value="${p?p.bulk:25}"></div>
      <div class="ad-field ad-checkbox-row" style="align-self:end"><input type="checkbox" id="pf_stock" ${!p||p.stock?'checked':''}> <label>In stock</label></div>
      <div class="ad-field full">
        <label>Quantity-tier pricing</label>
        <div id="pf_tiers"></div>
        <button class="btn btn-outline btn-sm" id="pf_addTier" type="button">+ Add price tier</button>
      </div>
        </div>
      </details>
      <details class="pf-card pf-acc ">
        <summary class="pf-card-head"><span class="pf-num">4</span><div><h3>Who is it for?</h3><p>Profession, purpose and occasion tags (optional)</p></div><span class="pf-chev">▾</span></summary>
        <div class="ad-form-grid pf-acc-body">
      <div class="ad-field full">
        <label>Profession (select all that apply)</label>
        <div class="ad-chip-group" id="pf_professions">${professionCheckboxesHtml(p?p.professions:[])}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="pf_addProfessionInput" placeholder="e.g. Legal Firms" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addProfessionBtn">+ Add new profession</button>
        </div>
      </div>
      <div class="ad-field full">
        <label>Purpose (select all that apply)</label>
        <div class="ad-chip-group" id="pf_purposes">${purposeCheckboxesHtml(p?p.purposes:[])}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="pf_addPurposeInput" placeholder="e.g. Trade Show Giveaways" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;font-size:13px">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addPurposeBtn">+ Add new</button>
        </div>
      </div>
      <div class="ad-field full">
        <label>Occasion (select all that apply)</label>
        <div class="ad-chip-group" id="pf_occasions">${occasionCheckboxesHtml(p?p.occasions:[])}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="pf_addOccasionInput" placeholder="e.g. Women's Day" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;font-size:13px">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addOccasionBtn">+ Add new</button>
        </div>
      </div>
        </div>
      </details>
      <details class="pf-card pf-acc ">
        <summary class="pf-card-head"><span class="pf-num">5</span><div><h3>Product Details</h3><p>Printing options and the details table (optional)</p></div><span class="pf-chev">▾</span></summary>
        <div class="ad-form-grid pf-acc-body">
      <div class="ad-field full">
        <label>Printing options <span class="ad-hint" style="display:inline">(optional — shown on the product page, e.g. No Print / Custom Print. Type an extra ₹ per piece next to an option and the price on the product page goes up automatically when the customer picks it)</span></label>
        <div class="ad-tag-group" id="pf_printOptChips"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="pf_printOptInput" placeholder="e.g. Embroidery" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addPrintOptBtn">+ Add option</button>
        </div>
      </div>
      <div class="ad-field full">
        <label>Additional details <span class="ad-hint" style="display:inline">(optional — a "label : value" table shown on the product page, e.g. Material : Cotton, Capacity : 100 ml, Country of Origin : India)</span></label>
        <div id="pf_detailRows" class="ad-detail-rows"></div>
        <button class="btn btn-outline btn-sm" type="button" id="pf_addDetailBtn" style="margin-top:8px">+ Add detail row</button>
      </div>
        </div>
      </details>
      <details class="pf-card pf-acc ">
        <summary class="pf-card-head"><span class="pf-num">6</span><div><h3>SEO</h3><p>Shown in Google search results and the browser tab (optional)</p></div><span class="pf-chev">▾</span></summary>
        <div class="ad-form-grid pf-acc-body">
      <div class="ad-field full"><label>Meta title</label><input id="pf_metaTitle" value="${p&&p.metaTitle?p.metaTitle.replace(/"/g,'&quot;'):''}" placeholder="Defaults to the product name if left blank" maxlength="70"></div>
      <div class="ad-field full"><label>Meta description</label><input id="pf_metaDesc" value="${p&&p.metaDescription?p.metaDescription.replace(/"/g,'&quot;'):''}" placeholder="1-2 line summary shown under the title in Google" maxlength="160"></div>
      <div class="ad-field full"><label>URL slug</label><input id="pf_slug" value="${p&&p.slug?p.slug:''}" placeholder="e.g. steel-water-bottle-750ml (auto-generated from the name if left blank)"></div>
        </div>
      </details>
      </div>
      <div class="pf-side">
      <details class="pf-card pf-acc pf-card-side" open>
        <summary class="pf-card-head"><span class="pf-num">📷</span><div><h3>Product Images</h3><p>Main gallery — first image is the cover</p></div><span class="pf-chev">▾</span></summary>
        <div class="ad-form-grid pf-acc-body">
      <div class="ad-field full">
        <label>Product images</label>
        <div class="ad-img-grid" id="pf_imgGrid"></div>
        <input type="file" id="pf_imgInput" accept="image/*" multiple style="display:none">
        <p class="ad-hint" id="pf_uploadStatus" style="margin-top:8px"></p>
        <p class="ad-link-toggle" id="pf_imgLinkToggle" style="margin-top:10px;font-size:12.5px;color:var(--muted);cursor:pointer;text-decoration:underline">Paste a link instead (not recommended — links can stop working later; uploading here is permanent)</p>
        <div id="pf_imgLinkRow" style="display:none;gap:8px;margin-top:10px">
          <input type="url" id="pf_imgUrlInput" placeholder="Paste a direct image link (e.g. Dropbox link ending ?dl=1)" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addImgUrlBtn">Add link</button>
        </div>
      </div>
        </div>
      </details>
      <details class="pf-card pf-acc pf-card-side">
        <summary class="pf-card-head"><span class="pf-num">🔄</span><div><h3>360° / 3D View</h3><p>Optional — rotate and zoom on the product page</p></div><span class="pf-chev">▾</span></summary>
        <div class="ad-form-grid pf-acc-body">
      <div class="ad-field full">
        <label>360° / 3D view <span class="ad-hint" style="display:inline;margin-left:6px">(optional — shoppers can rotate, view from every angle and zoom)</span></label>
        <div class="ad-view360">
          <div class="ad-view360-col">
            <b>🔄 360° photos</b>
            <p class="ad-hint" style="margin:4px 0 8px">Upload the frames of a turntable shoot (e.g. 24–36 photos, in order — files are sorted by name).</p>
            <div class="ad-view360-strip" id="pf_spinStrip"></div>
            <input type="file" id="pf_spinInput" accept="image/*" multiple style="display:none">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              <button type="button" class="btn btn-outline btn-sm" id="pf_spinAddBtn">⬆ Upload frames</button>
              <button type="button" class="btn btn-outline btn-sm" id="pf_spinClearBtn">Clear</button>
            </div>
            <p class="ad-hint" id="pf_spinStatus" style="margin-top:6px"></p>
          </div>
          <div class="ad-view360-col">
            <b>🧊 3D model (.glb)</b>
            <p class="ad-hint" style="margin:4px 0 8px">Upload a .glb file (or paste its link). Shoppers can orbit it with the mouse/finger and zoom.</p>
            <input type="url" id="pf_modelUrl" placeholder="https://…/product.glb" style="width:100%;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
            <input type="file" id="pf_modelInput" accept=".glb,.gltf,model/gltf-binary" style="display:none">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              <button type="button" class="btn btn-outline btn-sm" id="pf_modelUploadBtn">⬆ Upload .glb</button>
              <button type="button" class="btn btn-outline btn-sm" id="pf_modelClearBtn">Remove</button>
            </div>
            <p class="ad-hint" id="pf_modelStatus" style="margin-top:6px"></p>
          </div>
        </div>
      </div>
        </div>
      </details>
      </div>
    </div>`;
  }

  /* ---------- Purpose / Occasion dropdowns (product form) ----------
     Options come from SETTINGS.purposes/occasions (editable — see the
     "+ Add new" buttons wired in openProductModal below) rather than a
     hardcoded list, so admin can grow these over time. If an existing
     product has a value that isn't in the current list (e.g. saved before
     a list was trimmed/renamed elsewhere), it's still shown as an extra
     option so editing that product never silently loses/changes its data. */
  function purposeCheckboxesHtml(selected){
    const sel = selected && selected.length ? selected : [];
    let list = (SETTINGS.purposes && SETTINGS.purposes.length) ? SETTINGS.purposes.slice() : [];
    // Keep any already-saved value visible even if it's since been removed
    // from the admin-editable list, so editing never silently drops it.
    sel.forEach(v=>{ if(!list.includes(v)) list.push(v); });
    return list.map(v=>`
      <label class="ad-chip-check"><input type="checkbox" value="${v.replace(/"/g,'&quot;')}" ${sel.includes(v)?'checked':''}><span>${v}</span></label>`).join("");
  }
  function occasionCheckboxesHtml(selected){
    const sel = selected && selected.length ? selected : [];
    let list = (SETTINGS.occasions && SETTINGS.occasions.length) ? SETTINGS.occasions.slice() : [];
    sel.forEach(v=>{ if(!list.includes(v)) list.push(v); });
    return list.map(v=>`
      <label class="ad-chip-check"><input type="checkbox" value="${v.replace(/"/g,'&quot;')}" ${sel.includes(v)?'checked':''}><span>${v}</span></label>`).join("");
  }

  /* ---------- profession multi-select (product form) ---------- */
  function professionCheckboxesHtml(selected){
    const sel = selected && selected.length ? selected : [];
    return PROFESSIONS.map(pr=>`
      <label class="ad-chip-check"><input type="checkbox" value="${pr.name}" ${sel.includes(pr.name)?'checked':''}><span>${pr.icon} ${pr.name}</span></label>`).join("");
  }

  /* ---------- colour / size tag chips (product form) ---------- */
  let workingColors = [];
  let workingColorNames = {}; // {"#1a1a1a": "Black"} — shown to customers on the site
  let workingTrending = false;
  let view360Frames = [];   // ordered image URLs of the 360° spin
  let model3dUrl = "";      // optional .glb URL
  let workingSizes = [];
  let workingPrintOpts = [];
  let workingDetails = []; // [{k:"Flavour", v:"Apricot"}] — the product page's "Additional Details" table
  let workingColorImages = {}; // {"#1a1a1a": ["url1","url2"]} — optional per-colour gallery override
  function renderColorChips(){
    const el = document.querySelector("#pf_colorChips"); if(!el) return;
    el.innerHTML = workingColors.map((c,i)=>`
      <span class="ad-tag-chip" style="background:${c}"><i></i>${c}<input class="ad-color-name" type="text" maxlength="30" placeholder="Colour name" value="${(workingColorNames[c]||"").replace(/"/g,"&quot;")}" onchange="AdminUI.setColorName(${i},this.value)"><b onclick="AdminUI.removeColor(${i})">✕</b></span>`).join("") || `<span class="ad-hint" style="margin:0">No colours added yet</span>`;
    renderColorImageGroups();
    // The main Product images grid's per-photo colour-tag dropdown lists the
    // current colours too, so it needs refreshing whenever the colour list
    // changes (a newly-added colour wouldn't otherwise appear as an option).
    if(document.querySelector("#pf_imgGrid")) renderImgGrid();
  }
  /* ---------- colour-specific images (optional, product form) ----------
     One mini image-grid per working colour. A colour with no images here
     just falls back to the product's main photos (see renderGallery() in
     script.js on the customer side). Upload/link mechanics mirror the main
     image grid's (BazDS.uploadImage / resolveWorkingImageUrl) but are scoped
     per colour into workingColorImages. */
  function renderColorImageGroups(){
    const el = document.querySelector("#pf_colorImageGroups"); if(!el) return;
    if(!workingColors.length){
      el.innerHTML = `<span class="ad-hint" style="margin:0">Add at least one colour above first.</span>`;
      return;
    }
    el.innerHTML = workingColors.map((c,ci)=>{
      const imgs = workingColorImages[c] || [];
      return `
      <div class="ad-color-img-group">
        <div class="ad-color-img-group-head"><span class="ad-swatch-sm" style="background:${c}"></span><b>${c}</b></div>
        <div class="ad-img-grid ad-img-grid-sm">
          ${imgs.map((src,i)=>`<div class="ad-img-thumb"><img src="${src}" onerror="this.closest('.ad-img-thumb').classList.add('broken')"><span class="rm" onclick="AdminUI.removeColorImg(${ci},${i})">✕</span></div>`).join("")}
          <div class="ad-img-add" data-color-upload="${ci}">+</div>
        </div>
        <p class="ad-link-toggle" style="margin-top:8px;font-size:12px;color:var(--muted);cursor:pointer;text-decoration:underline" data-color-link-toggle="${ci}">Paste a link instead (not recommended — links can stop working later)</p>
        <div style="display:none;gap:8px;margin-top:8px" data-color-link-row="${ci}">
          <input type="file" accept="image/*" multiple style="display:none" data-color-file-input="${ci}">
          <input type="url" placeholder="Paste a direct image link for this colour" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;font-size:13px" data-color-url-input="${ci}">
          <button class="btn btn-outline btn-sm" type="button" data-color-add-link="${ci}">Add link</button>
        </div>
      </div>`;
    }).join("");

    workingColors.forEach((c,ci)=>{
      const fileInput = el.querySelector(`[data-color-file-input="${ci}"]`);
      const addBtn = el.querySelector(`[data-color-upload="${ci}"]`);
      addBtn.addEventListener("click", ()=>fileInput.click());
      const linkToggle = el.querySelector(`[data-color-link-toggle="${ci}"]`);
      const linkRow = el.querySelector(`[data-color-link-row="${ci}"]`);
      linkToggle.addEventListener("click", ()=>{ linkRow.style.display = "flex"; linkToggle.style.display = "none"; });
      fileInput.addEventListener("change", async (e)=>{
        const files = [...e.target.files];
        for(const file of files){
          try{
            const url = await BazDS.uploadImage(file, "products");
            workingColorImages[c] = (workingColorImages[c]||[]).concat([url]);
            renderColorImageGroups();
          }catch(err){ alert("Upload failed: " + (err.message||"check Supabase Storage bucket/policy.")); }
        }
      });
      const urlInput = el.querySelector(`[data-color-url-input="${ci}"]`);
      const linkBtn = el.querySelector(`[data-color-add-link="${ci}"]`);
      linkBtn.addEventListener("click", async ()=>{
        let url = urlInput.value.trim();
        if(!url) return;
        if(!/^https?:\/\//i.test(url)){ alert("Please paste a full link starting with http:// or https://"); return; }
        linkBtn.disabled = true;
        const working = await resolveWorkingImageUrl(url);
        linkBtn.disabled = false;
        if(!working){ alert(BROKEN_LINK_MSG); return; }
        workingColorImages[c] = (workingColorImages[c]||[]).concat([working]);
        urlInput.value = "";
        renderColorImageGroups();
      });
    });
  }
  function renderSizeChips(){
    const el = document.querySelector("#pf_sizeChips"); if(!el) return;
    el.innerHTML = workingSizes.map((s,i)=>`
      <span class="ad-tag-chip ad-tag-chip-plain">${s}<b onclick="AdminUI.removeSize(${i})">✕</b></span>`).join("") || `<span class="ad-hint" style="margin:0">No sizes added yet</span>`;
  }
  // A printing option may carry an extra per-piece price, stored inside the same string as "Name::250" (no DB change needed).
  const poName = s=>String(s).split("::")[0];
  const poExtra = s=>{ const n = Number(String(s).split("::")[1]); return n>0 ? n : 0; };
  AdminUI.setPrintExtra = (i, v)=>{ const n = Math.max(0, Math.round(Number(v)||0)); workingPrintOpts[i] = poName(workingPrintOpts[i]) + (n? "::"+n : ""); };
  function renderDetailRows(){
    const el = document.querySelector("#pf_detailRows"); if(!el) return;
    const esc = t=>String(t||"").replace(/"/g,"&quot;");
    el.innerHTML = workingDetails.map((r,i)=>`
      <div class="ad-detail-row">
        <input type="text" placeholder="Label (e.g. Material)" value="${esc(r.k)}" data-i="${i}" data-f="k" maxlength="60">
        <input type="text" placeholder="Value (e.g. Cotton)" value="${esc(r.v)}" data-i="${i}" data-f="v" maxlength="160">
        <button type="button" class="ad-icon-btn danger" data-del="${i}" title="Remove row">✕</button>
      </div>`).join("") || `<span class="ad-hint" style="margin:0">No extra details yet — click "+ Add detail row"</span>`;
    el.querySelectorAll("input").forEach(inp=>inp.addEventListener("input", ()=>{ workingDetails[Number(inp.dataset.i)][inp.dataset.f] = inp.value; }));
    el.querySelectorAll("button[data-del]").forEach(b=>b.addEventListener("click", ()=>{ workingDetails.splice(Number(b.dataset.del),1); renderDetailRows(); }));
  }
  function renderPrintOptChips(){
    const el = document.querySelector("#pf_printOptChips"); if(!el) return;
    el.innerHTML = workingPrintOpts.map((s,i)=>`
      <span class="ad-tag-chip ad-tag-chip-plain">${poName(s)}<span class="po-extra">+ ₹<input type="number" min="0" value="${poExtra(s)||""}" placeholder="0" title="Extra price per piece for this option" onchange="AdminUI.setPrintExtra(${i},this.value)"> /pc</span><b onclick="AdminUI.removePrintOpt(${i})">✕</b></span>`).join("") || `<span class="ad-hint" style="margin:0">None yet — leave empty if this product only has one printing method</span>`;
  }
  window.AdminUI = window.AdminUI || {};
  AdminUI.setColorName = (i, v)=>{ const c = workingColors[i]; if(!c) return; v = String(v||'').trim(); if(v) workingColorNames[c] = v; else delete workingColorNames[c]; };
  AdminUI.removeColor = (i)=>{
    const c = workingColors[i];
    delete workingColorNames[c];
    workingColors.splice(i,1);
    delete workingColorImages[c]; // drop that colour's images too — nothing to show them for any more
    productImageColors = productImageColors.map(tag=>tag===c?"":tag); // untag any main-gallery photo tagged with it
    renderColorChips();
  };
  AdminUI.removeColorImg = (ci, i)=>{
    const c = workingColors[ci];
    workingColorImages[c].splice(i,1);
    renderColorImageGroups();
  };
  AdminUI.removeSize = (i)=>{ workingSizes.splice(i,1); renderSizeChips(); };
  AdminUI.removePrintOpt = (i)=>{ workingPrintOpts.splice(i,1); renderPrintOptChips(); };

  /* ---------- image link helpers (used by both product + collection forms) ----------
     A pasted link only works as an <img src> if it's a DIRECT file link. Two common
     mistakes: a Dropbox share link (ends ?dl=0 — opens an HTML preview page, not the
     file) and a Google Images search-result link (opens Google's page, not the photo).
     dropboxCandidates() builds every URL shape worth trying for a Dropbox link (see
     note below), and resolveWorkingImageUrl() tries them in order so we don't have to
     guess which one this particular link/account needs; testImageLoads is the raw
     "does this exact URL load as an image" check used underneath. */
  function slugify(str){
    return (str||"").toString().toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  /* Newer Dropbox "scl/fi/..." share links sometimes still return an HTML
     interstitial/redirect page from www.dropbox.com even with ?dl=1 appended —
     the classic fix (dl=0→dl=1) doesn't always work for these. Swapping the
     host to dl.dropboxusercontent.com serves the raw file directly in most
     cases, so we try both host variants (each with dl=1) instead of just one. */
  function dropboxCandidates(url){
    const withDl1 = u => /[?&]dl=1(&|$)/.test(u) ? u : (/[?&]dl=0(&|$)/.test(u) ? u.replace(/dl=0/, "dl=1") : u + (u.includes("?") ? "&" : "?") + "dl=1");
    const direct = url.replace(/^https?:\/\/(www\.)?dropbox\.com/i, "https://dl.dropboxusercontent.com");
    return [withDl1(direct), withDl1(url)];
  }
  function normalizeImageUrl(url){
    // kept for anything still calling this directly — first Dropbox candidate
    return /dropbox\.com/i.test(url) ? dropboxCandidates(url)[0] : url;
  }
  /** Tries every plausible URL shape for a pasted link and returns the first
   *  one that actually loads as an image, or null if none of them do. */
  async function resolveWorkingImageUrl(url){
    const candidates = /dropbox\.com/i.test(url) ? dropboxCandidates(url) : [url];
    for(const candidate of candidates){
      if(await testImageLoads(candidate)) return candidate;
    }
    return null;
  }
  function testImageLoads(url){
    return new Promise(resolve=>{
      const img = new Image();
      let done = false;
      img.onload = ()=>{ if(!done){ done=true; resolve(true); } };
      img.onerror = ()=>{ if(!done){ done=true; resolve(false); } };
      img.src = url;
      setTimeout(()=>{ if(!done){ done=true; resolve(false); } }, 9000);
    });
  }
  const BROKEN_LINK_MSG = "Ye link seedha image nahi khol raha. Google Images ka search-result link ya Dropbox ka plain share link (?dl=0) kaam nahi karega — photo par right-click karke \"Copy image address\" se seedha .jpg/.png link lo, ya Dropbox link ke end mein ?dl=1 laga kar try karo.";

  function renderTierRows(tiers){
    const el = document.querySelector("#pf_tiers");
    el.innerHTML = tiers.map((t,i)=>`
      <div class="ad-tier-row" data-i="${i}">
        <input type="number" placeholder="Min qty" value="${t.min}" class="tier-min">
        <input type="number" placeholder="Price ₹" value="${t.price}" class="tier-price">
        <button class="ad-icon-btn danger" type="button" onclick="AdminUI.removeTierRow(${i})">✕</button>
      </div>`).join("");
  }
  /* ---------- 360° / 3D view controls (product form) ---------- */
  function renderSpinStrip(){
    const strip = document.querySelector("#pf_spinStrip"); if(!strip) return;
    strip.innerHTML = view360Frames.length
      ? view360Frames.map((u,i)=>`<img src="${u}" alt="Frame ${i+1}" title="Frame ${i+1}">`).join("") + `<span class="ad-view360-count">${view360Frames.length} frames</span>`
      : `<span class="ad-hint" style="margin:0">No 360° frames yet.</span>`;
  }
  function initView360Controls(){
    renderSpinStrip();
    const modelInput = document.querySelector("#pf_modelUrl"); if(modelInput) modelInput.value = model3dUrl;
    const spinStatus = document.querySelector("#pf_spinStatus"), modelStatus = document.querySelector("#pf_modelStatus");
    document.querySelector("#pf_spinAddBtn").addEventListener("click", ()=>document.querySelector("#pf_spinInput").click());
    document.querySelector("#pf_spinInput").addEventListener("change", async (e)=>{
      const files = Array.from(e.target.files||[]).sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true}));
      e.target.value = "";
      if(!files.length) return;
      const urls = [];
      for(let i=0;i<files.length;i++){
        spinStatus.textContent = `Uploading frame ${i+1} of ${files.length}…`;
        try{ urls.push(await BazDS.uploadImage(files[i], "view360")); }
        catch(err){ spinStatus.textContent = "Upload failed: " + (err.message||""); return; }
      }
      view360Frames = view360Frames.concat(urls);
      spinStatus.textContent = `${urls.length} frame(s) added.`;
      renderSpinStrip();
    });
    document.querySelector("#pf_spinClearBtn").addEventListener("click", ()=>{ view360Frames = []; spinStatus.textContent = ""; renderSpinStrip(); });
    modelInput.addEventListener("input", ()=>{ model3dUrl = modelInput.value.trim(); });
    document.querySelector("#pf_modelUploadBtn").addEventListener("click", ()=>document.querySelector("#pf_modelInput").click());
    document.querySelector("#pf_modelInput").addEventListener("change", async (e)=>{
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if(!f) return;
      modelStatus.textContent = "Uploading 3D model…";
      try{ model3dUrl = await BazDS.uploadFile(f, "models"); modelInput.value = model3dUrl; modelStatus.textContent = "3D model uploaded ✓"; }
      catch(err){ modelStatus.textContent = "Upload failed: " + (err.message||"") + " (file too large? Supabase free plan allows ~50 MB)"; }
    });
    document.querySelector("#pf_modelClearBtn").addEventListener("click", ()=>{ model3dUrl = ""; modelInput.value = ""; modelStatus.textContent = ""; });
  }
  let workingTiers = [];
  window.AdminUI = window.AdminUI || {};
  AdminUI.removeTierRow = (i)=>{ workingTiers.splice(i,1); renderTierRows(workingTiers); };

  function renderImgGrid(){
    const el = document.querySelector("#pf_imgGrid");
    el.innerHTML = productImages.map((src,i)=>`
      <div class="ad-img-thumb-wrap">
        <div class="ad-img-thumb"><img src="${src}" onerror="this.closest('.ad-img-thumb-wrap').querySelector('.ad-img-thumb').classList.add('broken')"><span class="rm" onclick="AdminUI.removeImg(${i})">✕</span></div>
        ${workingColors.length ? `<select class="ad-img-color-tag" data-i="${i}" title="Tag this photo with a colour so it also shows in that colour's gallery">
          <option value="">No colour tag</option>
          ${workingColors.map(c=>`<option value="${c}" ${productImageColors[i]===c?"selected":""}>${c}</option>`).join("")}
        </select>` : ""}
      </div>`).join("")
      + `<div class="ad-img-add" id="pf_addImgBtn">+</div>`;
    document.querySelector("#pf_addImgBtn").addEventListener("click", ()=>document.querySelector("#pf_imgInput").click());
    el.querySelectorAll(".ad-img-color-tag").forEach(sel=>{
      sel.addEventListener("change", ()=>{ productImageColors[Number(sel.dataset.i)] = sel.value; });
    });
  }
  AdminUI.removeImg = (i)=>{
    productImages.splice(i,1); productImageColors.splice(i,1); renderImgGrid();
  };

  function openProductModal(p){
    editingProductId = p ? p.id : null;
    productImages = p ? p.img.slice() : [];
    // If this product already has colour-specific images saved, and one of
    // them happens to be a photo that's also sitting in the main gallery
    // (same URL), pre-fill that photo's colour tag to match — so editing an
    // existing product shows its current tagging instead of looking untagged.
    productImageColors = productImages.map(src=>{
      if(!p || !p.colorImages) return "";
      const match = Object.entries(p.colorImages).find(([,imgs])=>imgs.includes(src));
      return match ? match[0] : "";
    });
    // Guard against a product saved with no/empty tiers (shouldn't happen
    // after the save-time fallback below, but opening an older bad record
    // for editing shouldn't crash the admin panel either).
    workingTiers = (p && Array.isArray(p.tiers) && p.tiers.length) ? p.tiers.map(t=>({...t})) : [{min:p?p.moq||10:10, price:0}];
    workingColors = p ? p.colors.slice() : ["#1a1a1a","#c6f000"];
    workingColorNames = p && p.colorNames ? {...p.colorNames} : {};
    workingColorImages = p && p.colorImages ? JSON.parse(JSON.stringify(p.colorImages)) : {};
    workingSizes = p ? p.sizes.slice() : ["Standard"];
    workingPrintOpts = p && p.printOptions ? p.printOptions.slice() : [];
    workingDetails = p && Array.isArray(p.details) ? p.details.map(x=>({k:x.k,v:x.v})) : [];
    document.querySelector("#productModalTitle").textContent = p ? "Edit Product" : "Add Product";
    // Status lives in the modal's header line (next to the title), not in the
    // scrollable form body, so it's visible immediately without scrolling —
    // set its value here since the header markup is static (not rebuilt per-open).
    document.querySelector("#pf_status").value = (p && p.status === "draft") ? "draft" : "published";
    // Manual Trending override — same "lives in the header, not the
    // scrollable form body" reasoning as Status above.
    workingTrending = !!(p && p.trending);
    view360Frames = (p && Array.isArray(p.view360)) ? p.view360.slice() : [];
    model3dUrl = (p && p.model3d) || "";
    const trendingBtn = document.querySelector("#pf_trendingToggle");
    trendingBtn.classList.toggle("active", workingTrending);
    trendingBtn.onclick = ()=>{ workingTrending = !workingTrending; trendingBtn.classList.toggle("active", workingTrending); };
    document.querySelector("#productForm").innerHTML = productFormHtml(p);
    renderTierRows(workingTiers);
    renderImgGrid();
    renderColorChips();
    renderSizeChips();
    renderPrintOptChips();
    renderDetailRows();
    document.querySelector("#pf_addDetailBtn").addEventListener("click", ()=>{ workingDetails.push({k:"",v:""}); renderDetailRows(); const ins = document.querySelectorAll("#pf_detailRows input"); if(ins.length>1) ins[ins.length-2].focus(); });
    initView360Controls();
    document.querySelector("#pf_addPrintOptBtn").addEventListener("click", ()=>{
      const input = document.querySelector("#pf_printOptInput");
      const val = input.value.trim();
      if(!val) return;
      if(!workingPrintOpts.some(s=>String(s).split("::")[0].toLowerCase()===val.toLowerCase())) workingPrintOpts.push(val);
      input.value = "";
      renderPrintOptChips();
    });
    document.querySelector("#pf_printOptInput").addEventListener("keydown", (e)=>{
      if(e.key==="Enter"){ e.preventDefault(); document.querySelector("#pf_addPrintOptBtn").click(); }
    });
    /* ---------- + Add new profession / purpose / occasion ----------
       Each of these persists the new value into SETTINGS (via
       BazDS.updateSettings) so it shows up for every future product too —
       not just this one — and on the live site's filters. If the
       add_taxonomies.sql migration hasn't been run yet, updateSettings()
       throws a friendly "run this migration first" error (see data-store.js)
       which we just show via alert() rather than losing the typed value. */
    document.querySelector("#pf_addProfessionBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#pf_addProfessionInput");
      const val = input.value.trim();
      if(!val) return;
      if(PROFESSIONS.some(pr=>pr.name.toLowerCase()===val.toLowerCase())){
        input.value = ""; return; // already exists — just clear the box, nothing to add
      }
      const btn = document.querySelector("#pf_addProfessionBtn");
      busy(btn, true, "Adding…");
      try{
        SETTINGS.customProfessions = (SETTINGS.customProfessions||[]).concat([val]);
        await BazDS.updateSettings(SETTINGS);
        refreshProfessionsList();
        const checked = [...document.querySelectorAll("#pf_professions input:checked")].map(i=>i.value).concat([val]);
        document.querySelector("#pf_professions").innerHTML = professionCheckboxesHtml(checked);
        input.value = "";
      }catch(err){ alert(err.message || "Could not add profession."); }
      finally{ busy(btn, false); }
    });
    document.querySelector("#pf_addProfessionInput").addEventListener("keydown", (e)=>{
      if(e.key==="Enter"){ e.preventDefault(); document.querySelector("#pf_addProfessionBtn").click(); }
    });
    document.querySelector("#pf_addPurposeBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#pf_addPurposeInput");
      const val = input.value.trim();
      if(!val) return;
      const list = SETTINGS.purposes || [];
      if(list.some(v=>v.toLowerCase()===val.toLowerCase())){ input.value = ""; return; }
      const btn = document.querySelector("#pf_addPurposeBtn");
      busy(btn, true, "Adding…");
      try{
        SETTINGS.purposes = list.concat([val]);
        await BazDS.updateSettings(SETTINGS);
        const checked = [...document.querySelectorAll("#pf_purposes input:checked")].map(i=>i.value).concat([val]);
        document.querySelector("#pf_purposes").innerHTML = purposeCheckboxesHtml(checked);
        input.value = "";
      }catch(err){ alert(err.message || "Could not add purpose."); }
      finally{ busy(btn, false); }
    });
    document.querySelector("#pf_addPurposeInput").addEventListener("keydown", (e)=>{
      if(e.key==="Enter"){ e.preventDefault(); document.querySelector("#pf_addPurposeBtn").click(); }
    });
    document.querySelector("#pf_addOccasionBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#pf_addOccasionInput");
      const val = input.value.trim();
      if(!val) return;
      const list = SETTINGS.occasions || [];
      if(list.some(v=>v.toLowerCase()===val.toLowerCase())){ input.value = ""; return; }
      const btn = document.querySelector("#pf_addOccasionBtn");
      busy(btn, true, "Adding…");
      try{
        SETTINGS.occasions = list.concat([val]);
        await BazDS.updateSettings(SETTINGS);
        const checked = [...document.querySelectorAll("#pf_occasions input:checked")].map(i=>i.value).concat([val]);
        document.querySelector("#pf_occasions").innerHTML = occasionCheckboxesHtml(checked);
        input.value = "";
      }catch(err){ alert(err.message || "Could not add occasion."); }
      finally{ busy(btn, false); }
    });
    document.querySelector("#pf_addOccasionInput").addEventListener("keydown", (e)=>{
      if(e.key==="Enter"){ e.preventDefault(); document.querySelector("#pf_addOccasionBtn").click(); }
    });
    document.querySelector("#pf_addColorBtn").addEventListener("click", ()=>{
      const hex = document.querySelector("#pf_colorPicker").value;
      const nameEl = document.querySelector("#pf_colorName");
      if(!workingColors.includes(hex)) workingColors.push(hex);
      if(nameEl && nameEl.value.trim()){ workingColorNames[hex] = nameEl.value.trim(); }
      if(nameEl) nameEl.value = "";
      renderColorChips();
    });
    document.querySelector("#pf_addSizeBtn").addEventListener("click", ()=>{
      const input = document.querySelector("#pf_sizeInput");
      const val = input.value.trim();
      if(!val) return;
      if(!workingSizes.some(s=>s.toLowerCase()===val.toLowerCase())) workingSizes.push(val);
      input.value = "";
      renderSizeChips();
    });
    document.querySelector("#pf_sizeInput").addEventListener("keydown", (e)=>{
      if(e.key==="Enter"){ e.preventDefault(); document.querySelector("#pf_addSizeBtn").click(); }
    });
    document.querySelector("#pf_addTier").addEventListener("click", ()=>{
      // Suggest the next Min qty instead of always defaulting to 1 — leaving
      // every row at the same Min qty (all "1") was a real mistake admins
      // made: the price for a quantity only ever comes from ONE row (the
      // highest Min qty the customer's quantity qualifies for), so two rows
      // with the same Min qty aren't two price bands, just one row silently
      // overriding the other. Suggesting 1, then MOQ, then +10 each time
      // after that nudges towards distinct bands without forcing a value.
      const mins = workingTiers.map(t=>t.min);
      const suggestedMin = mins.length ? Math.max(...mins) + 10 : 1;
      workingTiers.push({min:suggestedMin, price:0});
      renderTierRows(workingTiers);
    });
    document.querySelector("#pf_imgInput").addEventListener("change", async (e)=>{
      const status = document.querySelector("#pf_uploadStatus");
      const files = [...e.target.files];
      status.textContent = `Uploading ${files.length} image(s)…`;
      for(const file of files){
        try{
          const url = await BazDS.uploadImage(file, "products");
          productImages.push(url);
          productImageColors.push("");
          renderImgGrid();
        }catch(err){
          status.textContent = "Upload failed: " + (err.message||"check Supabase Storage bucket/policy.");
          return;
        }
      }
      status.textContent = "";
    });
    document.querySelector("#pf_imgLinkToggle").addEventListener("click", ()=>{
      document.querySelector("#pf_imgLinkRow").style.display = "flex";
      document.querySelector("#pf_imgLinkToggle").style.display = "none";
    });
    // Paste a direct image link (Dropbox, Google Drive direct link, etc.)
    // instead of uploading — the file then lives wherever that link points,
    // not in Supabase Storage, so it doesn't count against its free quota.
    // We normalize known share-link patterns (Dropbox ?dl=0→?dl=1) and actually
    // try loading the image before saving it, so a broken link is caught right
    // here instead of only showing up as a broken thumbnail after save.
    document.querySelector("#pf_addImgUrlBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#pf_imgUrlInput");
      const btn = document.querySelector("#pf_addImgUrlBtn");
      const status = document.querySelector("#pf_uploadStatus");
      let url = input.value.trim();
      if(!url) return;
      if(!/^https?:\/\//i.test(url)){ alert("Please paste a full link starting with http:// or https://"); return; }
      btn.disabled = true; status.textContent = "Checking link…";
      const working = await resolveWorkingImageUrl(url);
      btn.disabled = false;
      if(!working){ status.textContent = ""; alert(BROKEN_LINK_MSG); return; }
      status.textContent = "";
      productImages.push(working);
      productImageColors.push("");
      input.value = "";
      renderImgGrid();
    });
    document.querySelector("#productModalBackdrop").classList.add("show");
  }
  function closeProductModal(){ document.querySelector("#productModalBackdrop").classList.remove("show"); }

  document.querySelector("#addProductBtn").addEventListener("click", ()=>openProductModal(null));
  document.querySelector("#closeProductModal").addEventListener("click", closeProductModal);
  document.querySelector("#cancelProductBtn").addEventListener("click", closeProductModal);

  AdminUI.editProduct = (id)=>{ const p = PRODUCTS.find(x=>x.id===id); if(p) openProductModal(p); };
  AdminUI.deleteProduct = async (id)=>{
    if(!confirm("Delete this product? This cannot be undone.")) return;
    try{
      await BazDS.deleteProduct(id);
      PRODUCTS = PRODUCTS.filter(p=>p.id!==id);
      renderProductsTable(); renderDashboard();
    }catch(err){ alert("Could not delete: " + err.message); }
  };

  const saveProductBtn = document.querySelector("#saveProductBtn");
  saveProductBtn.addEventListener("click", async ()=>{
    document.querySelectorAll("#pf_tiers .ad-tier-row").forEach((row,i)=>{
      workingTiers[i] = {
        min: Number(row.querySelector(".tier-min").value)||1,
        price: Number(row.querySelector(".tier-price").value)||0
      };
    });
    // Two (or more) tier rows with the SAME Min qty aren't two price bands —
    // only the last one actually applies, and the earlier ones' prices are
    // silently ignored. This has happened before (every row left at the
    // default "1" instead of being changed to 1/10/20/...), so catch it here
    // with the exact duplicate value(s) named, rather than let it quietly
    // save a product whose displayed price ends up ₹0.
    const minCounts = {};
    workingTiers.forEach(t=>{ minCounts[t.min] = (minCounts[t.min]||0)+1; });
    const dupeMins = Object.keys(minCounts).filter(m=>minCounts[m]>1);
    if(dupeMins.length){
      alert(`Quantity-tier pricing mein ${dupeMins.length>1?"ye Min qty values":"ye Min qty"} ek se zyada baar hai: ${dupeMins.join(", ")}. Har row ka Min qty alag hona chahiye (jaise 1, 10, 20) — warna sirf aakhri wali price hi count hogi aur baaki ignore ho jaayengi. Pehle inhe thik kar lo.`);
      return;
    }
    const name = document.querySelector("#pf_name").value.trim();
    if(!name){ alert("Product name is required."); return; }
    if(!productImages.length){ alert("Add at least one product image."); return; }
    const professions = [...document.querySelectorAll("#pf_professions input:checked")].map(i=>i.value);
    const purposes = [...document.querySelectorAll("#pf_purposes input:checked")].map(i=>i.value);
    const occasions = [...document.querySelectorAll("#pf_occasions input:checked")].map(i=>i.value);
    const data = {
      id: editingProductId || undefined,
      name,
      cat: document.querySelector("#pf_cat").value.trim() || "Uncategorised",
      professions,
      profession: professions[0] || "",
      purposes,
      purpose: purposes[0] || "",
      occasions,
      occasion: occasions[0] || "",
      brand: document.querySelector("#pf_brand").value.trim() || null,
      moq: Number(document.querySelector("#pf_moq").value)||1,
      bulk: Number(document.querySelector("#pf_bulk").value)||1,
      stock: document.querySelector("#pf_stock").checked,
      status: document.querySelector("#pf_status").value,
      trending: workingTrending,
      colors: workingColors.slice(),
      colorNames: Object.fromEntries(Object.entries(workingColorNames).filter(([k,v])=>workingColors.includes(k)&&v)),
      // Only keep entries for colours that are still selected and that
      // actually have at least one image — an empty/orphaned entry would
      // otherwise linger and mean nothing (renderGallery falls back to the
      // main images anyway when the array is empty).
      // Merge in photos tagged with a colour right in the main "Product
      // images" grid (productImageColors) with whatever the dedicated
      // "Colour-specific images" section already has (workingColorImages),
      // de-duplicating URLs so tagging a photo that's already listed there
      // doesn't create a repeat.
      colorImages: (()=>{
        const merged = {};
        workingColors.forEach(c=>{
          const fromSection = (workingColorImages[c]||[]).slice();
          const fromTags = productImages.filter((src,i)=>productImageColors[i]===c);
          const combined = [...fromSection, ...fromTags.filter(u=>!fromSection.includes(u))];
          if(combined.length) merged[c] = combined;
        });
        return merged;
      })(),
      sizes: workingSizes.slice(),
      printOptions: workingPrintOpts.slice(),
      details: workingDetails.map(x=>({k:String(x.k||'').trim(),v:String(x.v||'').trim()})).filter(x=>x.k&&x.v),
      // Never save a product with zero valid tiers — every price display,
      // sort-by-price and the budget filter on the public site reads
      // tiers[0], and an empty array used to crash those features for
      // this product (and silently abort whatever list it was in).
      tiers: (()=>{
        const valid = workingTiers.filter(t=>t.min>0).sort((a,b)=>a.min-b.min);
        return valid.length ? valid : [{min:1, price:0}];
      })(),
      img: productImages,
      // Not editable in this form — carry them over, otherwise every product edit would wipe the stock quantities.
      colorStock: ((editingProductId && PRODUCTS.find(x=>x.id===editingProductId)) || {}).colorStock || {},
      view360: view360Frames.slice(),
      model3d: model3dUrl || "",
      metaTitle: document.querySelector("#pf_metaTitle").value.trim(),
      metaDescription: document.querySelector("#pf_metaDesc").value.trim(),
      slug: document.querySelector("#pf_slug").value.trim() || slugify(name)
    };
    busy(saveProductBtn, true, "Saving…");
    try{
      const saved = await BazDS.upsertProduct(data);
      if(editingProductId) PRODUCTS = PRODUCTS.map(p=>p.id===editingProductId?saved:p);
      else PRODUCTS.push(saved);
      closeProductModal();
      if(saved.__stripped && saved.__stripped.length){
        const names = {trending:"Trending", view_360:"360° view", model_url:"3D model"};
        const lost = saved.__stripped.filter(c=>names[c]).map(c=>names[c]);
        if(lost.length) posToast(`Saved, but "${lost.join(", ")}" was NOT stored — run the matching SQL (supabase/add_trending.sql / add_360_view.sql) in Supabase first.`, "error");
      }
      renderProductsTable();
      renderDashboard();
    }catch(err){
      alert("Could not save product: " + (err.message||"check your Supabase connection and RLS policies."));
    }finally{
      busy(saveProductBtn, false);
    }
  });

  /* ================= COLLECTIONS ================= */
  function renderCollectionsGrid(){
    const el = document.querySelector("#collectionsGrid"); if(!el) return;
    el.innerHTML = COLLECTIONS.map((c,i)=>`
      <div class="ad-coll-card">
        <img src="${c.img||''}" alt="">
        <div class="ad-coll-card-body">
          <b>${c.name}</b><span>${c.tag}</span>
          <div class="ad-coll-card-actions">
            <button class="ad-icon-btn" onclick="AdminUI.editCollection(${i})">✏️</button>
            <button class="ad-icon-btn danger" onclick="AdminUI.deleteCollection(${i})">🗑️</button>
          </div>
        </div>
      </div>`).join("");
  }

  let editingColl = null;
  let collImage = "";

  function collectionFormHtml(c){
    return `
      <div class="ad-field"><label>Collection name</label><input id="cf_name" value="${c?c.name.replace(/"/g,'&quot;'):''}"></div>
      <div class="ad-field"><label>Tag / product count text</label><input id="cf_tag" value="${c?c.tag:'12 products'}"></div>
      <div class="ad-field"><label>Cover image</label>
        <div class="ad-img-grid" id="cf_imgGrid"></div>
        <input type="file" id="cf_imgInput" accept="image/*" style="display:none">
        <p class="ad-hint" id="cf_uploadStatus" style="margin-top:8px"></p>
        <p class="ad-link-toggle" id="cf_imgLinkToggle" style="margin-top:10px;font-size:12.5px;color:var(--muted);cursor:pointer;text-decoration:underline">Paste a link instead (not recommended — links can stop working later; uploading here is permanent)</p>
        <div id="cf_imgLinkRow" style="display:none;gap:8px;margin-top:10px">
          <input type="url" id="cf_imgUrlInput" placeholder="Paste a direct image link (e.g. Dropbox link ending ?dl=1)" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="cf_addImgUrlBtn">Add link</button>
        </div>
      </div>`;
  }
  function renderCollImgGrid(){
    const el = document.querySelector("#cf_imgGrid");
    el.innerHTML = (collImage ? `<div class="ad-img-thumb"><img src="${collImage}" onerror="this.closest('.ad-img-thumb').classList.add('broken')"><span class="rm" onclick="AdminUI.removeCollImg()">✕</span></div>` : "")
      + (collImage ? "" : `<div class="ad-img-add" id="cf_addImgBtn">+</div>`);
    const addBtn = document.querySelector("#cf_addImgBtn");
    if(addBtn) addBtn.addEventListener("click", ()=>document.querySelector("#cf_imgInput").click());
  }
  AdminUI.removeCollImg = ()=>{ collImage=""; renderCollImgGrid(); };

  function openCollectionModal(c, index){
    editingColl = c || null;
    collImage = c ? c.img : "";
    document.querySelector("#collectionModalTitle").textContent = c ? "Edit Collection" : "Add Collection";
    document.querySelector("#collectionForm").innerHTML = collectionFormHtml(c);
    renderCollImgGrid();
    document.querySelector("#cf_imgInput").addEventListener("change", async (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const status = document.querySelector("#cf_uploadStatus");
      status.textContent = "Uploading…";
      try{ collImage = await BazDS.uploadImage(file, "collections"); renderCollImgGrid(); status.textContent = ""; }
      catch(err){ status.textContent = "Upload failed: " + (err.message||""); }
    });
    document.querySelector("#cf_imgLinkToggle").addEventListener("click", ()=>{
      document.querySelector("#cf_imgLinkRow").style.display = "flex";
      document.querySelector("#cf_imgLinkToggle").style.display = "none";
    });
    // Paste a direct image link instead of uploading (see product form note above)
    document.querySelector("#cf_addImgUrlBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#cf_imgUrlInput");
      const btn = document.querySelector("#cf_addImgUrlBtn");
      const status = document.querySelector("#cf_uploadStatus");
      let url = input.value.trim();
      if(!url) return;
      if(!/^https?:\/\//i.test(url)){ alert("Please paste a full link starting with http:// or https://"); return; }
      btn.disabled = true; status.textContent = "Checking link…";
      const working = await resolveWorkingImageUrl(url);
      btn.disabled = false;
      if(!working){ status.textContent = ""; alert(BROKEN_LINK_MSG); return; }
      status.textContent = "";
      collImage = working;
      input.value = "";
      renderCollImgGrid();
    });
    document.querySelector("#collectionModalBackdrop").classList.add("show");
  }
  function closeCollectionModal(){ document.querySelector("#collectionModalBackdrop").classList.remove("show"); }

  document.querySelector("#addCollectionBtn").addEventListener("click", ()=>openCollectionModal(null));
  document.querySelector("#closeCollectionModal").addEventListener("click", closeCollectionModal);
  document.querySelector("#cancelCollectionBtn").addEventListener("click", closeCollectionModal);

  AdminUI.editCollection = (i)=>openCollectionModal(COLLECTIONS[i], i);
  AdminUI.deleteCollection = async (i)=>{
    if(!confirm("Delete this collection?")) return;
    const c = COLLECTIONS[i];
    try{
      await BazDS.deleteCollection(c.id);
      COLLECTIONS.splice(i,1);
      renderCollectionsGrid(); renderDashboard();
    }catch(err){ alert("Could not delete: " + err.message); }
  };

  const saveCollectionBtn = document.querySelector("#saveCollectionBtn");
  saveCollectionBtn.addEventListener("click", async ()=>{
    const name = document.querySelector("#cf_name").value.trim();
    if(!name){ alert("Collection name is required."); return; }
    if(!collImage){ alert("Add a cover image."); return; }
    const data = { id: editingColl?editingColl.id:undefined, name, tag: document.querySelector("#cf_tag").value.trim()||"", img: collImage, sort_order: editingColl?editingColl.sort_order:COLLECTIONS.length };
    busy(saveCollectionBtn, true, "Saving…");
    try{
      const saved = await BazDS.upsertCollection(data);
      if(editingColl) COLLECTIONS = COLLECTIONS.map(c=>c.id===editingColl.id?saved:c);
      else COLLECTIONS.push(saved);
      closeCollectionModal();
      renderCollectionsGrid();
      renderDashboard();
    }catch(err){
      alert("Could not save collection: " + (err.message||""));
    }finally{
      busy(saveCollectionBtn, false);
    }
  });

  /* ================= SETTINGS ================= */
  function renderSettingsView(){
    const waInput = document.querySelector("#settingsWaNumber");
    if(waInput) waInput.value = SETTINGS.whatsappNumber || "";
    const homeQInput = document.querySelector("#settingsHomeQuestions");
    if(homeQInput) homeQInput.value = (SETTINGS.homepageQuestions || []).join("\n");
    renderTrustedBrandsAdmin(); if(typeof renderHpAdmin === "function") renderHpAdmin();
    const row = document.querySelector("#heroUploadRow"); if(!row) return;
    row.innerHTML = [0,1,2].map(i=>`
      <div class="ad-hero-slot">
        <img src="${(SETTINGS.heroImages&&SETTINGS.heroImages[i])||''}" alt="">
        <input type="file" accept="image/*" data-slot="${i}">
        <p class="ad-hint" data-status="${i}" style="margin:6px 0 0"></p>
      </div>`).join("");
    row.querySelectorAll("input[type=file]").forEach(inp=>{
      inp.addEventListener("change", async (e)=>{
        const file = e.target.files[0]; if(!file) return;
        const slot = Number(inp.dataset.slot);
        const statusEl = row.querySelector(`[data-status="${slot}"]`);
        statusEl.textContent = "Uploading…";
        try{
          const url = await BazDS.uploadImage(file, "hero");
          SETTINGS.heroImages = SETTINGS.heroImages && SETTINGS.heroImages.length===3 ? SETTINGS.heroImages.slice() : ["","",""];
          SETTINGS.heroImages[slot] = url;
          await BazDS.updateSettings(SETTINGS);
          statusEl.textContent = "Saved.";
          renderSettingsView();
        }catch(err){ statusEl.textContent = "Upload failed: " + (err.message||""); }
      });
    });
  }
  const saveWaBtn = document.querySelector("#saveWaBtn");
  if(saveWaBtn) saveWaBtn.addEventListener("click", async ()=>{
    SETTINGS.whatsappNumber = document.querySelector("#settingsWaNumber").value.trim();
    busy(saveWaBtn, true, "Saving…");
    try{ await BazDS.updateSettings(SETTINGS); alert("WhatsApp number saved."); }
    catch(err){ alert("Could not save: " + err.message); }
    finally{ busy(saveWaBtn, false); }
  });

  /* ---------- Trusted by: brands + logos (Settings) ---------- */
  let editingBrand = -1;
  function renderTrustedBrandsAdmin(){
    const el = document.querySelector("#trustedBrandsList"); if(!el) return;
    const list = SETTINGS.trustedBrands || [];
    const esc = t=>String(t||"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    el.innerHTML = list.length ? list.map((b,i)=>`
      <div class="ad-brand-row">
        ${b.logo ? `<img src="${esc(b.logo)}" alt="">` : `<span class="ad-brand-noimg">No logo</span>`}
        <b>${esc(b.name)}${b.link?` <small class="ad-brand-link">🔗 ${esc(b.link)}</small>`:""}${b.details?`<small class="ad-brand-det">${esc(b.details)}</small>`:""}</b>
        <button type="button" class="ad-icon-btn" data-edit="${i}" title="Edit">✏️</button>
        <button type="button" class="ad-icon-btn danger" data-i="${i}" title="Remove">🗑️</button>
      </div>`).join("") : `<p class="ad-hint" style="margin:0 0 10px">No brands added yet.</p>`;
    el.querySelectorAll("button[data-i]").forEach(btn=>btn.addEventListener("click", async ()=>{
      const next = (SETTINGS.trustedBrands||[]).filter((_,i)=>i!==Number(btn.dataset.i));
      try{ await BazDS.updateTrustedBrands(next); SETTINGS.trustedBrands = next; editingBrand = -1; renderTrustedBrandsAdmin(); posToast("Brand removed"); }
      catch(err){ posToast(err.message||"Could not remove", "error"); }
    }));
    el.querySelectorAll("button[data-edit]").forEach(btn=>btn.addEventListener("click", ()=>{
      const b = (SETTINGS.trustedBrands||[])[Number(btn.dataset.edit)]; if(!b) return;
      editingBrand = Number(btn.dataset.edit);
      document.querySelector("#addBrandName").value = b.name||"";
      document.querySelector("#addBrandLink").value = b.link||"";
      document.querySelector("#addBrandDetails").value = b.details||"";
      document.querySelector("#addBrandBtn").textContent = "Save changes";
      document.querySelector("#addBrandStatus").textContent = "Editing — logo badalna ho to nayi file chuno, warna purana rahega.";
      document.querySelector("#addBrandName").focus();
    }));
  }
  const addBrandBtn = document.querySelector("#addBrandBtn");
  if(addBrandBtn) addBrandBtn.addEventListener("click", async ()=>{
    const nameEl = document.querySelector("#addBrandName"), fileEl = document.querySelector("#addBrandLogo"), status = document.querySelector("#addBrandStatus");
    const linkEl = document.querySelector("#addBrandLink"), detEl = document.querySelector("#addBrandDetails");
    const name = nameEl.value.trim(), file = fileEl.files && fileEl.files[0];
    const link = linkEl.value.trim(), details = detEl.value.trim();
    const editing = editingBrand >= 0 && (SETTINGS.trustedBrands||[])[editingBrand];
    if(!name && !file && !editing){ status.textContent = "Brand ka naam ya logo daalo."; return; }
    busy(addBrandBtn, true, "Saving…");
    try{
      let logo = editing ? (editing.logo||"") : "";
      if(file){ status.textContent = "Uploading logo…"; logo = await BazDS.uploadImage(file, "brands"); }
      const entry = {name, logo, link, details};
      const cur = (SETTINGS.trustedBrands||[]).slice();
      if(editing) cur[editingBrand] = entry; else cur.push(entry);
      await BazDS.updateTrustedBrands(cur);
      SETTINGS.trustedBrands = cur;
      editingBrand = -1;
      nameEl.value = ""; fileEl.value = ""; linkEl.value = ""; detEl.value = ""; status.textContent = "";
      addBrandBtn.textContent = "+ Add brand";
      renderTrustedBrandsAdmin(); posToast(editing ? "✅ Brand updated" : "✅ Brand added");
    }catch(err){ status.textContent = err.message || "Could not add brand"; }
    finally{ busy(addBrandBtn, false); }
  });

  /* ---------- Homepage sections: on/off + FAQ editor (Settings) ---------- */
  const DEFAULT_FAQS = [
    {q:"Is there a minimum order quantity?", a:"Yes — MOQ is set per product/SKU and shown clearly on every product page, alongside the quantity at which bulk enquiry support kicks in."},
    {q:"How does bulk pricing work?", a:"Pricing is quantity-aware — as you increase quantity on a product page, pricing automatically recalculates to the applicable slab, and the total updates live."},
    {q:"Can I pay online?", a:"Not in this phase. Bazarville is a discovery and enquiry platform — commercial discussion, customization and payment happen over WhatsApp with our team."},
    {q:"What if a product is out of stock?", a:"Out-of-stock pages stay live with similar product suggestions, and you can still raise a WhatsApp enquiry for availability or replenishment."}
  ];
  const DEFAULT_REVIEWS = [
    {name:"Riya Sharma", role:"HR Lead, Clearline IT", text:"We ordered 300 onboarding kits in two days flat — the WhatsApp enquiry with the reference number made follow-up painless.", link:"https://in.linkedin.com/company/bazarville"},
    {name:"Anil Mehta", role:"Procurement, Summit Edu", text:"The quantity-based pricing is exactly what procurement needs — no more back-and-forth on slab pricing.", link:"https://in.linkedin.com/company/bazarville"},
    {name:"Sana Iyer", role:"Admin Head, Vertex Health", text:"Shop by Profession helped us find relevant gifting options for our hospital staff in minutes.", link:"https://in.linkedin.com/company/bazarville"}
  ];
  let hpFaqs = [], hpRevs = [];
  function renderHpAdmin(){
    const hp = SETTINGS.homepage || {};
    const set = (id,v)=>{ const el = document.querySelector(id); if(el) el.checked = v; };
    set("#hpShowCollections", hp.showCollections !== false); set("#hpShowTrusted", hp.showTrusted !== false); set("#hpShowFaq", hp.showFaq !== false); set("#hpShowReviews", hp.showReviews !== false);
    hpRevs = (hp.reviews && hp.reviews.length ? hp.reviews : DEFAULT_REVIEWS).map(x=>({name:x.name, role:x.role||"", text:x.text, link:x.link||""}));
    drawHpRevs();
    hpFaqs = (hp.faqs && hp.faqs.length ? hp.faqs : DEFAULT_FAQS).map(x=>({q:x.q, a:x.a}));
    drawHpFaqs();
  }
  function drawHpRevs(){
    const el = document.querySelector("#hpRevList"); if(!el) return;
    const esc = t=>String(t||"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    el.innerHTML = hpRevs.length ? hpRevs.map((r,i)=>`
      <div class="ad-faq-row">
        <div class="ad-faq-fields">
          <input data-rn="${i}" value="${esc(r.name)}" placeholder="Name">
          <input data-rr="${i}" value="${esc(r.role)}" placeholder="Role, company">
          <textarea data-rt="${i}" rows="2" placeholder="Review text">${esc(r.text)}</textarea>
          <input data-rl="${i}" value="${esc(r.link)}" placeholder="LinkedIn link (optional)">
        </div>
        <button type="button" class="ad-icon-btn danger" data-rdel="${i}" title="Remove review">🗑️</button>
      </div>`).join("") : `<p class="ad-hint">Koi review nahi — website par default reviews dikhenge.</p>`;
  }
  function drawHpFaqs(){
    const el = document.querySelector("#hpFaqList"); if(!el) return;
    const esc = t=>String(t||"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    el.innerHTML = hpFaqs.length ? hpFaqs.map((f,i)=>`
      <div class="ad-faq-row">
        <div class="ad-faq-fields">
          <input data-hq="${i}" value="${esc(f.q)}" placeholder="Question">
          <textarea data-ha="${i}" rows="2" placeholder="Answer">${esc(f.a)}</textarea>
        </div>
        <button type="button" class="ad-icon-btn danger" data-hdel="${i}" title="Remove question">🗑️</button>
      </div>`).join("") : `<p class="ad-hint">Koi question nahi — website par default FAQs dikhenge.</p>`;
  }
  const hpList = document.querySelector("#hpFaqList");
  if(hpList){
    hpList.addEventListener("input", e=>{
      if(e.target.dataset.hq!=null) hpFaqs[+e.target.dataset.hq].q = e.target.value;
      if(e.target.dataset.ha!=null) hpFaqs[+e.target.dataset.ha].a = e.target.value;
    });
    hpList.addEventListener("click", e=>{
      const d = e.target.closest("[data-hdel]"); if(!d) return;
      hpFaqs.splice(+d.dataset.hdel, 1); drawHpFaqs();
    });
  }
  const revList = document.querySelector("#hpRevList");
  if(revList){
    revList.addEventListener("input", e=>{
      const d = e.target.dataset, f = {rn:"name", rr:"role", rt:"text", rl:"link"};
      for(const k in f) if(d[k]!=null) hpRevs[+d[k]][f[k]] = e.target.value;
    });
    revList.addEventListener("click", e=>{
      const d = e.target.closest("[data-rdel]"); if(!d) return;
      hpRevs.splice(+d.dataset.rdel, 1); drawHpRevs();
    });
  }
  const revAdd = document.querySelector("#hpRevAdd");
  if(revAdd) revAdd.addEventListener("click", ()=>{ hpRevs.push({name:"", role:"", text:"", link:""}); drawHpRevs(); const ins = document.querySelectorAll("#hpRevList [data-rn]"); if(ins.length) ins[ins.length-1].focus(); });
  const hpAdd = document.querySelector("#hpFaqAdd");
  if(hpAdd) hpAdd.addEventListener("click", ()=>{ hpFaqs.push({q:"", a:""}); drawHpFaqs(); const ins = document.querySelectorAll("#hpFaqList [data-hq]"); if(ins.length) ins[ins.length-1].focus(); });
  const hpSave = document.querySelector("#hpSave");
  if(hpSave) hpSave.addEventListener("click", async ()=>{
    const cfg = {
      showCollections: document.querySelector("#hpShowCollections").checked,
      showTrusted: document.querySelector("#hpShowTrusted").checked,
      showFaq: document.querySelector("#hpShowFaq").checked,
      showReviews: document.querySelector("#hpShowReviews").checked,
      reviews: hpRevs.map(r=>({name:r.name.trim(), role:r.role.trim(), text:r.text.trim(), link:r.link.trim()})).filter(r=>r.name && r.text),
      faqs: hpFaqs.map(f=>({q:f.q.trim(), a:f.a.trim()})).filter(f=>f.q && f.a)
    };
    const st = document.querySelector("#hpStatus");
    busy(hpSave, true, "Saving…");
    try{
      await BazDS.updateHomepage(cfg, SETTINGS.trustedBrands||[]);
      SETTINGS.homepage = cfg; renderHpAdmin();
      st.textContent = ""; posToast("✅ Homepage settings save ho gayi");
    }catch(err){ st.textContent = err.message || "Could not save"; posToast(err.message || "Could not save", "error"); }
    finally{ busy(hpSave, false); }
  });

  const saveHomeQuestionsBtn = document.querySelector("#saveHomeQuestionsBtn");
  if(saveHomeQuestionsBtn) saveHomeQuestionsBtn.addEventListener("click", async ()=>{
    const lines = document.querySelector("#settingsHomeQuestions").value.split("\n").map(s=>s.trim()).filter(Boolean);
    SETTINGS.homepageQuestions = lines;
    busy(saveHomeQuestionsBtn, true, "Saving…");
    try{ await BazDS.updateSettings(SETTINGS); alert("Homepage questions saved."); }
    catch(err){ alert("Could not save: " + err.message); }
    finally{ busy(saveHomeQuestionsBtn, false); }
  });

  /* ================= BRAND COLOUR THEME ================= */
  // 10 preset corporate-friendly accents, including a monochrome "Charcoal"
  // and "Silver" pair for a black/white-leaning look. Charcoal/Silver use
  // slightly-off shades (not pure #000/#fff) so text sitting on them, or on
  // the near-black/white surfaces elsewhere on the site, always stays
  // readable — applyBrandColor() (in script.js) also auto-picks light or
  // dark text for whichever colour is chosen. (BRAND_PRESETS itself is
  // declared at the very top of this file — see the note there.)
  function renderColorSwatches(){
    const el = document.querySelector("#colorGrid"); if(!el) return;
    const current = (SETTINGS.brandColor || "#c6f000").toLowerCase();
    el.innerHTML = BRAND_PRESETS.map(p=>`
      <div class="ad-color-swatch ${p.hex.toLowerCase()===current?'active':''}" data-hex="${p.hex}">
        <div class="sw-dot" style="background:${p.hex}"></div>
        <span>${p.name}</span>
      </div>`).join("");
    el.querySelectorAll(".ad-color-swatch").forEach(sw=>{
      sw.addEventListener("click", async ()=>{
        const hex = sw.dataset.hex;
        SETTINGS.brandColor = hex;
        applyBrandColor(hex); // instant preview in the admin panel itself
        el.querySelectorAll(".ad-color-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
        try{ await BazDS.updateSettings(SETTINGS); }
        catch(err){ alert("Could not save colour: " + err.message); }
      });
    });
  }

  /* ================= SITE FONT ================= */
  // FONT_PRESETS is defined once in script.js (also used to preload the
  // right Google Fonts on every page) — admin.js just renders swatches for it.
  function renderFontSwatches(){
    const el = document.querySelector("#fontGrid"); if(!el) return;
    const current = SETTINGS.brandFont || "inter";
    el.innerHTML = FONT_PRESETS.map(f=>`
      <div class="ad-font-swatch ${f.id===current?'active':''}" data-id="${f.id}" style="font-family:${f.heading}">
        <span class="fs-preview">Aa</span><span>${f.label}</span>
      </div>`).join("");
    el.querySelectorAll(".ad-font-swatch").forEach(sw=>{
      sw.addEventListener("click", async ()=>{
        const id = sw.dataset.id;
        SETTINGS.brandFont = id;
        applyBrandFont(id);
        el.querySelectorAll(".ad-font-swatch").forEach(s=>s.classList.remove("active"));
        sw.classList.add("active");
        try{ await BazDS.updateSettings(SETTINGS); }
        catch(err){ alert("Could not save font: " + err.message); }
      });
    });
  }

  /* ================= ANIMATION INTENSITY ================= */
  // (ANIM_LEVELS itself is declared at the very top of this file — see the note there.)
  function renderAnimationOptions(){
    const el = document.querySelector("#animGrid"); if(!el) return;
    const current = SETTINGS.animationLevel || "subtle";
    el.innerHTML = ANIM_LEVELS.map(a=>`
      <div class="ad-anim-opt ${a.id===current?'active':''}" data-id="${a.id}">
        <b>${a.label}</b><span>${a.desc}</span>
      </div>`).join("");
    el.querySelectorAll(".ad-anim-opt").forEach(opt=>{
      opt.addEventListener("click", async ()=>{
        const id = opt.dataset.id;
        SETTINGS.animationLevel = id;
        applyAnimationLevel(id);
        el.querySelectorAll(".ad-anim-opt").forEach(o=>o.classList.remove("active"));
        opt.classList.add("active");
        try{ await BazDS.updateSettings(SETTINGS); }
        catch(err){ alert("Could not save: " + err.message); }
      });
    });
  }

  /* ================= ENQUIRIES (mini-CRM: status + notes + follow-up) ================= */

  function enqRowHtml(e){
    return `
        <tr data-id="${e.id}">
          <td><b>${e.ref}</b>${e.source==="manual"?' <span class="ad-badge in" style="font-size:10px">manual</span>':''}</td>
          <td>${e.product_name || "—"}${e.company_name?`<br><span class="ad-hint" style="margin:0">${e.company_name}</span>`:''}</td>
          <td>${e.quantity ? e.quantity+" pcs" : "—"}</td>
          <td>${new Date(e.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
          <td>
            <select class="enq-status">
              <option value="new" ${e.status==="new"||!e.status?"selected":""}>New</option>
              <option value="contacted" ${e.status==="contacted"?"selected":""}>Contacted</option>
              <option value="qualified" ${e.status==="qualified"?"selected":""}>Qualified</option>
              <option value="quoted" ${e.status==="quoted"?"selected":""}>Quoted</option>
              <option value="won" ${e.status==="won"?"selected":""}>Won</option>
              <option value="lost" ${e.status==="lost"?"selected":""}>Lost</option>
              <option value="closed" ${e.status==="closed"?"selected":""}>Closed</option>
            </select>
          </td>
          <td><input type="date" class="enq-followup" value="${e.followup_at ? new Date(e.followup_at).toISOString().slice(0,10) : ""}" style="border:1.5px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit"></td>
          <td><input type="text" class="enq-notes" value="${(e.notes||"").replace(/"/g,'&quot;')}" placeholder="Add a note…" style="width:100%;border:1.5px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit"></td>
          <td><button class="ad-icon-btn" title="Save" onclick="AdminUI.saveEnquiryRow(${e.id})">💾</button></td>
        </tr>`;
  }

  AdminUI.saveEnquiryRow = async (id)=>{
    const row = document.querySelector(`#enquiriesTable tr[data-id="${id}"]`); if(!row) return;
    const status = row.querySelector(".enq-status").value;
    const followupVal = row.querySelector(".enq-followup").value;
    const notes = row.querySelector(".enq-notes").value;
    try{
      await BazDS.updateEnquiry(id, { status, notes, followupAt: followupVal ? new Date(followupVal).toISOString() : null });
      const cached = allEnquiriesCache.find(e=>e.id===id);
      if(cached){ cached.status = status; cached.notes = notes; cached.followup_at = followupVal ? new Date(followupVal).toISOString() : null; }
      const btn = row.querySelector(".ad-icon-btn");
      const orig = btn.textContent; btn.textContent = "✓"; setTimeout(()=>{ btn.textContent = orig; }, 1200);
    }catch(err){ alert("Could not save: " + err.message); }
  };

  function renderEnquiriesFromCache(){
    const el = document.querySelector("#enquiriesTable"); if(!el) return;
    const filterSel = document.querySelector("#enqStatusFilter");
    const filter = filterSel ? filterSel.value : "all";
    const list = filter==="all" ? allEnquiriesCache : allEnquiriesCache.filter(e=>(e.status||"new")===filter);
    if(!list.length){
      el.innerHTML = "";
      el.closest(".ad-table-wrap").innerHTML = `<p class="ad-enq-empty">No enquiries here yet — they'll show up as soon as a visitor uses the WhatsApp enquiry button on the live site, or try a different status filter above.</p>`;
      return;
    }
    el.innerHTML = `<tr><th>Reference</th><th>Product</th><th>Quantity</th><th>Date</th><th>Status</th><th>Follow-up</th><th>Notes</th><th></th></tr>` +
      list.map(enqRowHtml).join("");
  }

  function exportEnquiriesCsv(list){
    const header = ["Reference","Product","Quantity","Status","Follow-up date","Notes","Date"];
    const rows = list.map(e=>[
      e.ref, e.product_name||"", e.quantity||"", e.status||"new",
      e.followup_at ? new Date(e.followup_at).toLocaleDateString("en-IN") : "",
      e.notes||"", new Date(e.created_at).toLocaleString("en-IN")
    ]);
    const csv = [header, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bazarville-enquiries-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  let enquiryControlsBound = false;
  function bindEnquiryControlsOnce(){
    if(enquiryControlsBound) return;
    enquiryControlsBound = true;
    const filterSel = document.querySelector("#enqStatusFilter");
    const exportBtn = document.querySelector("#enqExportBtn");
    if(filterSel) filterSel.addEventListener("change", renderEnquiriesFromCache);
    if(exportBtn) exportBtn.addEventListener("click", ()=>{
      const filter = filterSel ? filterSel.value : "all";
      const list = filter==="all" ? allEnquiriesCache : allEnquiriesCache.filter(e=>(e.status||"new")===filter);
      exportEnquiriesCsv(list);
    });
  }

  async function renderEnquiriesTable(){
    const el = document.querySelector("#enquiriesTable"); if(!el) return;
    try{ allEnquiriesCache = await BazDS.getEnquiries(); }catch(err){ console.error(err); allEnquiriesCache = []; }
    bindEnquiryControlsOnce();
    renderEnquiriesFromCache();
  }

  /* ================= ADD LEAD (manual CRM entry) ================= */
  const leadModalBackdrop = document.querySelector("#leadModalBackdrop");
  const addLeadBtn = document.querySelector("#addLeadBtn");
  if(addLeadBtn) addLeadBtn.addEventListener("click", ()=>{
    ["#lf_product","#lf_company","#lf_qty","#lf_notes"].forEach(sel=>{ const el = document.querySelector(sel); if(el) el.value = ""; });
    leadModalBackdrop.classList.add("show");
  });
  [document.querySelector("#closeLeadModal"), document.querySelector("#cancelLeadBtn")].forEach(b=>{
    if(b) b.addEventListener("click", ()=>leadModalBackdrop.classList.remove("show"));
  });
  const saveLeadBtn = document.querySelector("#saveLeadBtn");
  if(saveLeadBtn) saveLeadBtn.addEventListener("click", async ()=>{
    const productName = document.querySelector("#lf_product").value.trim();
    const companyName = document.querySelector("#lf_company").value.trim();
    const quantity = Number(document.querySelector("#lf_qty").value) || null;
    const notes = document.querySelector("#lf_notes").value.trim();
    if(!productName && !companyName){ alert("Add at least a product/interest or a company/contact name."); return; }
    busy(saveLeadBtn, true, "Adding…");
    try{
      await BazDS.addManualLead({productName, companyName, quantity, notes});
      leadModalBackdrop.classList.remove("show");
      renderEnquiriesTable();
    }catch(err){ alert("Could not add lead: " + err.message); }
    finally{ busy(saveLeadBtn, false); }
  });

  /* ================= ORDERS ================= */
  const ORDER_STATUSES = ["pending","confirmed","dispatched","delivered","cancelled"];
  let editingOrderId = null;

  function orderRowHtml(o){
    const itemCount = (o.items||[]).reduce((n,it)=>n+(it.qty||1),0);
    return `<tr data-id="${o.id}">
      <td><b>${o.ref}</b></td>
      <td>${o.customer_name||"—"}<br><span class="ad-hint" style="margin:0">${o.customer_phone||""}</span></td>
      <td>${itemCount} pcs</td>
      <td>${money(o.subtotal||0)}</td>
      <td>${(o.payment_method||"cod").replace("_"," ")}</td>
      <td><span class="ad-badge ${o.status==='delivered'?'in':(o.status==='cancelled'?'out':'in')}">${o.status||"pending"}</span></td>
      <td>${new Date(o.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</td>
      <td><button class="ad-icon-btn" title="View / update" onclick="AdminUI.openOrder(${o.id})">👁️</button></td>
    </tr>`;
  }

  async function renderOrdersTable(){
    const el = document.querySelector("#ordersTable"); if(!el) return;
    try{ allOrdersCache = await BazDS.getOrders(); }catch(err){ console.error(err); allOrdersCache = []; }
    if(!allOrdersCache.length){
      el.innerHTML = "";
      el.closest(".ad-table-wrap").innerHTML = `<p class="ad-enq-empty">No orders yet — they'll show up here as soon as a customer checks out from the cart on the live site.</p>`;
      return;
    }
    el.innerHTML = `<tr><th>Reference</th><th>Customer</th><th>Items</th><th>Subtotal</th><th>Payment</th><th>Status</th><th>Date</th><th></th></tr>` +
      allOrdersCache.map(orderRowHtml).join("");
  }

  AdminUI.openOrder = (id)=>{
    const o = allOrdersCache.find(x=>x.id===id); if(!o) return;
    editingOrderId = id;
    const itemsHtml = (o.items||[]).map(it=>`<div class="ad-tier-row" style="grid-template-columns:1fr auto auto">
      <span>${it.name||it.productId||"Item"}${it.color?` — ${it.color}`:''}${it.size?` / ${it.size}`:''}${it.printOption?` / ${it.printOption}`:''}</span>
      <span>${it.qty||1} pcs</span><span>${money(it.price||0)}</span></div>`).join("") || "<p class='ad-hint'>No item detail stored.</p>";
    document.querySelector("#orderModalBody").innerHTML = `
      <p><b>${o.customer_name||"—"}</b> · ${o.customer_phone||""} ${o.customer_email?" · "+o.customer_email:""}</p>
      <p class="ad-hint">${o.shipping_address||""}</p>
      <div style="margin:14px 0">${itemsHtml}</div>
      <p><b>Subtotal: ${money(o.subtotal||0)}</b>${o.source==="pos"?"":` · Payment: ${(o.payment_method||"cod").replace("_"," ")}`}</p>
      <div class="ad-field"><label>Order status</label>
        <select id="of_status">${ORDER_STATUSES.map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join("")}</select>
      </div>
      <div class="ad-field full"><label>Internal notes</label><input id="of_notes" value="${(o.notes||"").replace(/"/g,'&quot;')}"></div>`;
    document.querySelector("#orderModalBackdrop").classList.add("show");
  };
  const closeOrderModal = ()=>document.querySelector("#orderModalBackdrop").classList.remove("show");
  [document.querySelector("#closeOrderModal"), document.querySelector("#cancelOrderBtn")].forEach(b=>{ if(b) b.addEventListener("click", closeOrderModal); });
  const saveOrderBtn = document.querySelector("#saveOrderBtn");
  if(saveOrderBtn) saveOrderBtn.addEventListener("click", async ()=>{
    if(!editingOrderId) return;
    const status = document.querySelector("#of_status").value;
    const notes = document.querySelector("#of_notes").value.trim();
    busy(saveOrderBtn, true, "Saving…");
    try{
      await BazDS.updateOrderStatus(editingOrderId, {status, notes});
      closeOrderModal();
      renderOrdersTable();
    }catch(err){ alert("Could not update order: " + err.message); }
    finally{ busy(saveOrderBtn, false); }
  });

  /* ================= TEAM / USERS & ROLES (Super Admin only) =================
     "+ Add User" creates a real Supabase login (see BazDS.createStaffUser) and
     stores which admin sections they may use as tick-marks in
     profiles.permissions; Row Level Security (supabase/add_user_permissions.sql)
     enforces those ticks on the database itself. */
  let teamCache = [];
  let editingUserId = null;

  function permSummary(u){
    if(u.role==="super_admin") return `<span class="ad-badge in">👑 Everything</span>`;
    const perms = Array.isArray(u.permissions) ? u.permissions : ALL_SECTIONS.filter(x=>x.id!=="settings").map(x=>x.id);
    if(!perms.length) return `<span class="ad-badge out">No access yet</span>`;
    return perms.map(id=>{ const sec = ALL_SECTIONS.find(x=>x.id===id); return `<span class="ad-perm-chip">${sec?sec.label.replace(/ \(.*\)/,""):id}</span>`; }).join("");
  }
  function teamRowHtml(u){
    const isMe = currentAdmin && u.email===currentAdmin.email;
    return `<tr data-id="${u.id}">
      <td><b>${u.fullName||"—"}</b>${isMe?` <span class="ad-badge in">You</span>`:""}<br><span class="ad-hint" style="margin:0">${BazDS.toUsername(u.email||"")}</span></td>
      <td>${u.role==="super_admin"?"👑 Super Admin":"🗂️ Team member"}</td>
      <td><div class="ad-perm-chips">${permSummary(u)}</div></td>
      <td><div class="ad-row-actions">
        <button class="ad-icon-btn" title="Edit access" data-teamact="edit" data-id="${u.id}">✏️</button>
        ${isMe?"":`<button class="ad-icon-btn danger" title="Remove access" data-teamact="remove" data-id="${u.id}">🗑️</button>`}
      </div></td>
    </tr>`;
  }
  async function renderTeamTable(){
    const el = document.querySelector("#teamTable"); if(!el) return;
    try{ teamCache = await BazDS.getTeam(); }
    catch(err){ el.innerHTML = `<tr><td><p class="ad-hint" style="margin:0;padding:18px 0;text-align:center">Could not load the team list — ${err.message||"only a Super Admin can see this."}</p></td></tr>`; return; }
    el.innerHTML = `<tr><th>User</th><th>Role</th><th>Can access</th><th></th></tr>` + teamCache.map(teamRowHtml).join("");
  }
  const teamTableEl = document.querySelector("#teamTable");
  if(teamTableEl) teamTableEl.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-teamact]"); if(!btn) return;
    const u = teamCache.find(x=>x.id===btn.dataset.id); if(!u) return;
    if(btn.dataset.teamact==="edit") openUserModal(u);
    if(btn.dataset.teamact==="remove") removeUser(u);
  });

  function renderPermGrid(selected){
    document.querySelector("#uf_perms").innerHTML = ALL_SECTIONS.map(sec=>`
      <label class="ad-perm-opt"><input type="checkbox" value="${sec.id}" ${selected.includes(sec.id)?"checked":""}><span>${sec.label}</span></label>`).join("");
  }
  function syncSuperToggle(){
    const isSuper = document.querySelector("#uf_super").checked;
    document.querySelector("#uf_permsWrap").classList.toggle("ad-perms-disabled", isSuper);
    document.querySelectorAll("#uf_perms input").forEach(i=>{ i.disabled = isSuper; });
  }
  function openUserModal(u){
    editingUserId = u ? u.id : null;
    const err = document.querySelector("#uf_error"); err.style.display = "none";
    document.querySelector("#userModalTitle").textContent = u ? "Edit User" : "Add User";
    document.querySelector("#saveUserBtn").textContent = u ? "Save Changes" : "Create User";
    document.querySelector("#uf_name").value = u ? u.fullName : "";
    const emailEl = document.querySelector("#uf_email"); emailEl.value = u ? BazDS.toUsername(u.email||"") : ""; emailEl.disabled = !!u;
    document.querySelector("#uf_password").value = "";
    document.querySelector("#uf_passwordField").style.display = u ? "none" : "block";
    const isMe = !!(u && currentAdmin && u.email===currentAdmin.email);
    const superEl = document.querySelector("#uf_super");
    superEl.checked = !!(u && u.role==="super_admin"); superEl.disabled = isMe; // can't demote yourself
    const startPerms = u ? (Array.isArray(u.permissions) ? u.permissions : ALL_SECTIONS.filter(x=>x.id!=="settings").map(x=>x.id)) : [];
    renderPermGrid(startPerms);
    syncSuperToggle();
    document.querySelector("#userModalBackdrop").classList.add("show");
  }
  const closeUserModal = ()=>document.querySelector("#userModalBackdrop").classList.remove("show");
  [document.querySelector("#closeUserModal"), document.querySelector("#cancelUserBtn")].forEach(b=>{ if(b) b.addEventListener("click", closeUserModal); });
  const addUserBtn = document.querySelector("#addUserBtn");
  if(addUserBtn) addUserBtn.addEventListener("click", ()=>openUserModal(null));
  const ufSuper = document.querySelector("#uf_super");
  if(ufSuper) ufSuper.addEventListener("change", syncSuperToggle);
  const ufSelectAll = document.querySelector("#uf_selectAll"), ufClearAll = document.querySelector("#uf_clearAll");
  if(ufSelectAll) ufSelectAll.addEventListener("click", ()=>document.querySelectorAll("#uf_perms input:not(:disabled)").forEach(i=>{ i.checked = true; }));
  if(ufClearAll) ufClearAll.addEventListener("click", ()=>document.querySelectorAll("#uf_perms input:not(:disabled)").forEach(i=>{ i.checked = false; }));

  const saveUserBtn = document.querySelector("#saveUserBtn");
  if(saveUserBtn) saveUserBtn.addEventListener("click", async ()=>{
    const errEl = document.querySelector("#uf_error");
    const showErr = (m)=>{ errEl.textContent = m; errEl.style.display = "block"; };
    errEl.style.display = "none";
    const fullName = document.querySelector("#uf_name").value.trim();
    const rawLogin = document.querySelector("#uf_email").value.trim();
    const email = rawLogin.includes("@") ? rawLogin : rawLogin.toLowerCase();
    const password = document.querySelector("#uf_password").value;
    const isSuper = document.querySelector("#uf_super").checked;
    const permissions = [...document.querySelectorAll("#uf_perms input:checked")].map(i=>i.value);
    if(!editingUserId){
      if(rawLogin.includes("@") ? !/^\S+@\S+\.\S+$/.test(rawLogin) : !/^[a-z0-9._-]{3,30}$/.test(email)) return showErr("Username 3-30 characters ka ho (a-z, 0-9, . _ -), ya poora email likho.");
      if(password.length < 6) return showErr("Password must be at least 6 characters.");
    }
    if(!isSuper && !permissions.length && !confirm("No sections are ticked — this user won't be able to open anything. Continue?")) return;
    busy(saveUserBtn, true, editingUserId ? "Saving…" : "Creating…");
    try{
      const role = isSuper ? "super_admin" : "catalog_manager";
      if(editingUserId) await BazDS.updateStaffProfile(editingUserId, {role, permissions, fullName});
      else await BazDS.createStaffUser({email: BazDS.toLoginEmail(email), password, fullName, role, permissions});
      closeUserModal();
      await renderTeamTable();
      if(!editingUserId) showLoginCard({name: fullName, role, email: BazDS.toUsername(BazDS.toLoginEmail(email)), password});
    }catch(err){ showErr(err.message || "Could not save this user."); }
    finally{ busy(saveUserBtn, false); }
  });
  /* Copy-ready login details for a newly created user — same layout the team shares on WhatsApp:
       Name / Role
       Username: email
       Password: ******                                                                      */
  function showLoginCard({name, role, email, password}){
    const url = location.origin + location.pathname;
    const text = `${name || (role==="super_admin" ? "Admin" : "Staff")}\nUsername: ${email}\nPassword: ${password}\nLogin: ${url}`;
    const old = document.querySelector("#loginCardOverlay"); if(old) old.remove();
    const ov = document.createElement("div"); ov.id = "loginCardOverlay";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.3)">
      <h3 style="margin:0 0 6px">✅ User ban gaya</h3>
      <p class="ad-hint" style="margin:0 0 10px">Ye details copy karke bhej do. Username se seedha login hoga. (Supabase me 'Confirm email' OFF hona chahiye, warna login nahi chalega.)</p>
      <pre id="loginCardText" style="white-space:pre-wrap;background:#f4f6ef;border-radius:10px;padding:12px;font:inherit;font-size:14.5px;line-height:1.6;margin:0 0 12px;user-select:all"></pre>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="lcCopy" type="button">📋 Copy</button>
        <a class="btn btn-outline btn-sm" id="lcWa" target="_blank" rel="noopener">💬 WhatsApp</a>
        <button class="btn btn-outline btn-sm" id="lcClose" type="button" style="margin-left:auto">Close</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.querySelector("#loginCardText").textContent = text;
    ov.querySelector("#lcWa").href = "https://wa.me/?text=" + encodeURIComponent(text);
    ov.querySelector("#lcCopy").addEventListener("click", async e=>{
      try{ await navigator.clipboard.writeText(text); e.target.textContent = "✅ Copied"; }
      catch(_){ const r = document.createRange(); r.selectNodeContents(ov.querySelector("#loginCardText")); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); e.target.textContent = "Select ho gaya — Ctrl+C"; }
    });
    ov.querySelector("#lcClose").addEventListener("click", ()=>ov.remove());
    ov.addEventListener("click", e=>{ if(e.target===ov) ov.remove(); });
  }
  async function removeUser(u){
    if(!confirm(`Remove admin access for ${u.fullName||u.email}? They will no longer be able to open the admin panel.`)) return;
    try{ await BazDS.removeStaffProfile(u.id); await renderTeamTable(); }
    catch(err){ alert("Could not remove: " + (err.message||"")); }
  }

  /* ================= QUOTES (CPQ) ================= */
  let quoteLineItems = [];

  function quoteRowHtml(q){
    const link = `${location.origin}${location.pathname.replace(/admin\.html$/,'')}quote.html?ref=${q.ref}`;
    return `<tr data-id="${q.id}">
      <td><b>${q.ref}</b></td>
      <td>${q.customer_name||"—"}<br><span class="ad-hint" style="margin:0">${q.customer_company||""}</span></td>
      <td>${money(q.subtotal||0)}</td>
      <td><span class="ad-badge ${q.status==='accepted'?'in':'out'}">${q.status||"draft"}</span></td>
      <td>${new Date(q.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</td>
      <td><a href="${link}" target="_blank" class="btn btn-outline btn-sm">🔗 Open link</a></td>
    </tr>`;
  }

  async function renderQuotesTable(){
    const el = document.querySelector("#quotesTable"); if(!el) return;
    try{ allQuotesCache = await BazDS.getQuotes(); }catch(err){ console.error(err); allQuotesCache = []; }
    if(!allQuotesCache.length){
      el.innerHTML = "";
      el.closest(".ad-table-wrap").innerHTML = `<p class="ad-enq-empty">No quotes yet — click "+ New Quote" above to build one for a customer.</p>`;
      return;
    }
    el.innerHTML = `<tr><th>Reference</th><th>Customer</th><th>Subtotal</th><th>Status</th><th>Date</th><th></th></tr>` +
      allQuotesCache.map(quoteRowHtml).join("");
  }

  function quoteFormHtml(){
    return `
      <div class="ad-form-grid">
        <div class="ad-field"><label>Customer name</label><input id="qf_name"></div>
        <div class="ad-field"><label>Company</label><input id="qf_company"></div>
        <div class="ad-field"><label>Phone</label><input id="qf_phone"></div>
        <div class="ad-field"><label>Email (optional)</label><input id="qf_email" type="email"></div>
        <div class="ad-field"><label>Valid until (optional)</label><input id="qf_validuntil" type="date"></div>
      </div>
      <h3>Line items</h3>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <select id="qf_productPick" style="flex:1">
          <option value="">— pick a product to add —</option>
          ${PRODUCTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
        <button class="btn btn-outline btn-sm" type="button" id="qf_addItemBtn">+ Add</button>
      </div>
      <div id="qf_items"></div>
      <p style="text-align:right;margin-top:10px"><b>Subtotal: <span id="qf_subtotal">₹0</span></b></p>
      <div class="ad-field full"><label>Notes (optional — shown to the customer)</label><input id="qf_notes"></div>`;
  }

  function renderQuoteItems(){
    const el = document.querySelector("#qf_items"); if(!el) return;
    el.innerHTML = quoteLineItems.map((it,i)=>`
      <div class="ad-tier-row" style="grid-template-columns:2fr 80px 100px auto">
        <span>${it.name}</span>
        <input type="number" min="1" value="${it.qty}" class="qi-qty" data-i="${i}" style="width:70px">
        <input type="number" min="0" value="${it.price}" class="qi-price" data-i="${i}" style="width:90px">
        <button class="ad-icon-btn danger" type="button" onclick="AdminUI.removeQuoteItem(${i})">✕</button>
      </div>`).join("") || `<p class="ad-hint">No items added yet.</p>`;
    el.querySelectorAll(".qi-qty").forEach(inp=>inp.addEventListener("input", ()=>{ quoteLineItems[Number(inp.dataset.i)].qty = Number(inp.value)||1; updateQuoteSubtotal(); }));
    el.querySelectorAll(".qi-price").forEach(inp=>inp.addEventListener("input", ()=>{ quoteLineItems[Number(inp.dataset.i)].price = Number(inp.value)||0; updateQuoteSubtotal(); }));
    updateQuoteSubtotal();
  }
  function updateQuoteSubtotal(){
    const sub = quoteLineItems.reduce((s,it)=>s+(it.qty*it.price),0);
    const el = document.querySelector("#qf_subtotal"); if(el) el.textContent = money(sub);
  }
  AdminUI.removeQuoteItem = (i)=>{ quoteLineItems.splice(i,1); renderQuoteItems(); };

  const quoteModalBackdrop = document.querySelector("#quoteModalBackdrop");
  const addQuoteBtn = document.querySelector("#addQuoteBtn");
  if(addQuoteBtn) addQuoteBtn.addEventListener("click", ()=>{
    quoteLineItems = [];
    document.querySelector("#quoteForm").innerHTML = quoteFormHtml();
    renderQuoteItems();
    document.querySelector("#qf_addItemBtn").addEventListener("click", ()=>{
      const sel = document.querySelector("#qf_productPick");
      const id = Number(sel.value); if(!id) return;
      const p = PRODUCTS.find(x=>x.id===id); if(!p) return;
      const t = tierFor(p, p.moq);
      quoteLineItems.push({productId:p.id, name:p.name, qty:p.moq||1, price:t.price||0});
      sel.value = "";
      renderQuoteItems();
    });
    quoteModalBackdrop.classList.add("show");
  });
  [document.querySelector("#closeQuoteModal"), document.querySelector("#cancelQuoteBtn")].forEach(b=>{
    if(b) b.addEventListener("click", ()=>quoteModalBackdrop.classList.remove("show"));
  });
  const saveQuoteBtn = document.querySelector("#saveQuoteBtn");
  if(saveQuoteBtn) saveQuoteBtn.addEventListener("click", async ()=>{
    const customerName = document.querySelector("#qf_name").value.trim();
    const customerPhone = document.querySelector("#qf_phone").value.trim();
    if(!customerName || !customerPhone){ alert("Customer name and phone are required."); return; }
    if(!quoteLineItems.length){ alert("Add at least one line item."); return; }
    const subtotal = quoteLineItems.reduce((s,it)=>s+(it.qty*it.price),0);
    busy(saveQuoteBtn, true, "Creating…");
    try{
      await BazDS.createQuote({
        customerName, customerPhone,
        customerCompany: document.querySelector("#qf_company").value.trim(),
        customerEmail: document.querySelector("#qf_email").value.trim(),
        validUntil: document.querySelector("#qf_validuntil").value || null,
        notes: document.querySelector("#qf_notes").value.trim(),
        items: quoteLineItems, subtotal
      });
      quoteModalBackdrop.classList.remove("show");
      renderQuotesTable();
    }catch(err){ alert("Could not create quote: " + err.message); }
    finally{ busy(saveQuoteBtn, false); }
  });

  /* ================= BULK CSV UPLOAD (products) ================= */
  // Minimal CSV parser: handles quoted fields with embedded commas ("like, this").
  // Multi-value fields (professions/colors/sizes/images) are pipe-separated inside
  // their own cell — e.g. "Corporate|IT / Tech" — so a plain comma split won't work.
  const normHeader = h => String(h||"").toLowerCase().trim().replace(/[\s\-]+/g,"_");
  const HDR_ALIAS = {product_name:"name", title:"name", product:"name", cat:"category", profession:"professions", colours:"colors", colour:"colors", color:"colors",
    size:"sizes", image:"images", image_urls:"images", photos:"images", qty:"stock_qty", quantity:"stock_qty", stock_quantity:"stock_qty", pieces:"stock_qty",
    mrp:"price", rate:"price", moq_pcs:"moq", printing:"print_options", print:"print_options", description:"details", specs:"details", bulk:"bulk_threshold"};
  const COLOR_NAMES = {black:"#1a1a1a", white:"#ffffff", red:"#dc2626", blue:"#2563eb", "royal blue":"#1d4ed8", "navy":"#1e3a8a", "navy blue":"#1e3a8a", "sky blue":"#38bdf8", green:"#16a34a", "mint green":"#86efac", "olive":"#6b7a2a", "bottle green":"#14532d",
    yellow:"#facc15", orange:"#f97316", pink:"#ec4899", purple:"#8b5cf6", lavender:"#c4b5fd", maroon:"#7f1d1d", brown:"#7c4a21", beige:"#e8dcc2", "sand beige":"#d9c7a0", cream:"#f5efe0", grey:"#9ca3af", gray:"#9ca3af", "charcoal":"#374151", silver:"#c0c0c0", gold:"#d4af37", lime:"#c6f000", teal:"#0d9488", turquoise:"#2dd4bf", wine:"#722f37", khaki:"#b5a26a", "off white":"#f8f5ee", natural:"#d8c3a5"};
  function parseColorToken(tok){
    tok = String(tok||"").trim(); if(!tok) return null;
    let hex = "", name = "";
    const m = tok.match(/^(#[0-9a-fA-F]{3,8})\s*[:=]\s*(.+)$/);
    if(m){ hex = m[1].toLowerCase(); name = m[2].trim(); }
    else if(/^#[0-9a-fA-F]{3,8}$/.test(tok)) hex = tok.toLowerCase();
    else { name = tok; hex = COLOR_NAMES[tok.toLowerCase()] || "#9ca3af"; }
    return {hex, name};
  }
  function normaliseRow(r){
    const o = {}; Object.keys(r).forEach(k=>{ const nk = HDR_ALIAS[normHeader(k)] || normHeader(k); const v = r[k]; o[nk] = (v==null ? "" : String(v)).trim(); });
    return o;
  }
  function parseCsv(text){
    const lines = text.replace(/\r\n/g,"\n").split("\n").filter(l=>l.trim().length);
    if(!lines.length) return [];
    function parseLine(line){
      const out = []; let cur = ""; let inQuotes = false;
      for(let i=0;i<line.length;i++){
        const c = line[i];
        if(inQuotes){
          if(c === '"'){ if(line[i+1] === '"'){ cur += '"'; i++; } else inQuotes = false; }
          else cur += c;
        } else {
          if(c === '"') inQuotes = true;
          else if(c === ","){ out.push(cur); cur = ""; }
          else cur += c;
        }
      }
      out.push(cur);
      return out.map(s=>s.trim());
    }
    const headers = parseLine(lines[0]).map(normHeader);
    return lines.slice(1).map(line=>{
      const cells = parseLine(line);
      const row = {};
      headers.forEach((h,i)=>{ row[h] = cells[i] !== undefined ? cells[i] : ""; });
      return row;
    });
  }

  const BULK_CSV_TEMPLATE = `name,category,professions,purposes,occasions,brand,moq,bulk_threshold,price,price_tiers,colors,sizes,print_options,details,stock_qty,images,stock,status
Premium Cotton Polo Tee,T-Shirts,Corporate|IT / Tech,Employee Gifting,Onboarding,Cello,20,50,,"20:399|50:349|100:299",Black|Lime|Royal Blue,S|M|L|XL,No Print|Custom Print::50,Fabric:Cotton|GSM:240,Black:40|Lime:15|Royal Blue:20,https://example.com/img1.jpg|https://example.com/img2.jpg,TRUE,published
Simple Steel Bottle,Drinkware,Corporate,Client Gifting,,,10,50,299,Silver,Standard,,Capacity:750 ml,25,https://example.com/bottle.jpg,TRUE,published
`;

  let bulkParsedRows = [];
  function renderBulkResults(rows){
    const el = document.querySelector("#bulkResults");
    const runBtn = document.querySelector("#runBulkBtn");
    if(!rows.length){ el.innerHTML = `<p class="ad-hint">No rows found in this file.</p>`; runBtn.disabled = true; return; }
    const errors = rows.map((r,i)=>{
      const problems = [];
      if(!r.name) problems.push("missing name");
      // Images are only required for brand-new products (no existing match by
      // name). Updating an existing product via CSV never touches its photos,
      // so a missing/blank images column there is fine — see runBulkUpload().
      const isExisting = r.name && PRODUCTS.some(p=>p.name.toLowerCase()===r.name.toLowerCase());
      return {i, problems};
    }).filter(r=>r.problems.length);
    const noImg = rows.map((r,i)=>({r,i})).filter(({r})=>r.name && !r.images && !PRODUCTS.some(p=>p.name.toLowerCase()===r.name.toLowerCase()));
    const validCount = rows.length - errors.length;
    let html = `<p class="ad-hint"><b>${rows.length}</b> row(s) found — <b>${validCount}</b> look valid and ready to upload.</p>`;
    if(errors.length){
      html += `<p class="ad-hint" style="color:#c0392b">${errors.length} row(s) will be skipped: ` +
        errors.map(e=>`row ${e.i+2} (${e.problems.join(", ")})`).join("; ") + `</p>`;
    }
    if(noImg.length) html += `<p class="ad-hint" style="color:#9a5b00">${noImg.length} naya product bina image ka hai (${noImg.slice(0,6).map(x=>x.r.name).join(", ")}${noImg.length>6?"…":""}) — ye <b>Draft</b> me save honge, photo baad me Edit se daalo.</p>`;
    el.innerHTML = html;
    runBtn.disabled = validCount === 0;
  }

  async function runBulkUpload(rows){
    const el = document.querySelector("#bulkResults");
    const runBtn = document.querySelector("#runBulkBtn");
    runBtn.disabled = true; runBtn.textContent = "Uploading…";
    let ok = 0, fail = 0; const failMsgs = [];
    for(const r of rows){
      const existing = r.name ? PRODUCTS.find(p=>p.name.toLowerCase()===r.name.toLowerCase()) : null;
      // Images are required only when creating a brand-new product — an
      // existing product's photos are never touched by CSV (see below), so a
      // missing images column must not skip an otherwise-valid update row.
      if(!r.name) continue;
      const tiers = (r.price_tiers||"").split("|").filter(Boolean).map(t=>{
        const [min,price] = t.split(":"); return {min:Number(min)||1, price:Number(price)||0};
      });
      if(!tiers.length && Number(r.price)) tiers.push({min:Number(r.moq)||1, price:Number(r.price)});
      const cols = (r.colors||"#1a1a1a").split("|").map(parseColorToken).filter(Boolean);
      const colorNames = {}; cols.forEach(c=>{ if(c.name) colorNames[c.hex] = c.name; });
      const colorHexes = cols.map(c=>c.hex);
      const profs = (r.professions||"Corporate").split("|").map(s=>s.trim()).filter(Boolean);
      const purposes = (r.purposes||r.purpose||"Employee Gifting").split("|").map(s=>s.trim()).filter(Boolean);
      const occasions = (r.occasions||r.occasion||"").split("|").map(s=>s.trim()).filter(Boolean);
      // stock_qty: a single number = total pieces, or "Red:10|Black:5" = per colour
      let colorStock = existing ? (existing.colorStock||{}) : {};
      if(r.stock_qty){
        if(/^\d+$/.test(r.stock_qty.trim())){ colorStock = colorHexes.length===1 ? {[colorHexes[0]]:Number(r.stock_qty)} : {_total:Number(r.stock_qty)}; }
        else {
          const cs = {}; r.stock_qty.split("|").forEach(t=>{ const i = t.lastIndexOf(":"); if(i<0) return; const key = t.slice(0,i).trim(), n = Number(t.slice(i+1)); if(isNaN(n)) return;
            const byName = cols.find(c=>c.name.toLowerCase()===key.toLowerCase() || c.hex===key.toLowerCase()); cs[byName?byName.hex:key] = n; });
          if(Object.keys(cs).length) colorStock = cs;
        }
      }
      const printOptions = (r.print_options||"").split("|").map(s=>s.trim()).filter(Boolean);
      const details = (r.details||"").split("|").map(t=>{ const i = t.indexOf(":"); return i<0 ? null : {k:t.slice(0,i).trim(), v:t.slice(i+1).trim()}; }).filter(x=>x&&x.k&&x.v);
      const imgList = (r.images||"").split("|").map(s=>s.trim()).filter(Boolean);
      const data = {
        id: existing ? existing.id : undefined,
        name: r.name,
        cat: r.category || "Uncategorised",
        professions: profs, profession: profs[0],
        purposes, purpose: purposes[0], occasions, occasion: occasions[0] || "",
        brand: r.brand || null,
        moq: Number(r.moq) || 1,
        bulk: Number(r.bulk_threshold) || 1,
        stock: /^(true|yes|1)$/i.test(r.stock || "true"),
        status: (/^draft$/i.test(r.status || "published") || (!existing && !imgList.length)) ? "draft" : "published",
        colors: colorHexes, colorNames: existing ? {...(existing.colorNames||{}), ...colorNames} : colorNames,
        printOptions: printOptions.length ? printOptions : (existing ? (existing.printOptions||[]) : []),
        details: details.length ? details : (existing ? (existing.details||[]) : []),
        sizes: (r.sizes||"Standard").split("|").map(s=>s.trim()).filter(Boolean),
        tiers: tiers.length ? tiers : [{min:Number(r.moq)||1, price:0}],
        // IMPORTANT (client requirement): bulk CSV must never be able to wipe
        // out a real product's photos. When updating an EXISTING product we
        // always keep its current images no matter what the CSV's `images`
        // column says (stale/placeholder/blank values are common on re-upload
        // for something like a price change). Only a brand-new product (no
        // existing match by name) takes its images from the CSV.
        img: existing ? existing.img : imgList,
        colorStock,
        view360: existing ? (existing.view360||[]) : [],
        model3d: existing ? (existing.model3d||"") : ""
      };
      try{
        const saved = await BazDS.upsertProduct(data);
        if(existing) PRODUCTS = PRODUCTS.map(p=>p.id===existing.id?saved:p);
        else PRODUCTS.push(saved);
        ok++;
      }catch(err){ fail++; failMsgs.push(`${r.name}: ${err.message}`); }
    }
    renderProductsTable(); renderDashboard();
    runBtn.textContent = "Upload Rows";
    el.innerHTML = `<p class="ad-hint"><b>${ok}</b> product(s) saved.${fail?` <b style="color:#c0392b">${fail} failed</b>: ${failMsgs.join("; ")}`:""}</p>`;
    bulkParsedRows = [];
  }

  /* ---------- Recheck image links (read-only diagnostic) ----------
     Goes through every current product's images and tries loading each one
     right now, reusing the same resolveWorkingImageUrl()/testImageLoads()
     logic used when a photo is pasted in. This NEVER writes anything back to
     a product or to Supabase — it's purely a report so the admin can catch a
     stale link (e.g. an expired Dropbox ?st= token) and fix it proactively
     via the normal Edit-product flow. */
  const recheckImagesBtn = document.querySelector("#recheckImagesBtn");
  if(recheckImagesBtn) recheckImagesBtn.addEventListener("click", async ()=>{
    const resultsEl = document.querySelector("#imageCheckResults");
    busy(recheckImagesBtn, true, "Checking…");
    if(resultsEl) resultsEl.innerHTML = `<p class="ad-hint">Checking ${PRODUCTS.length} product(s)' image links — this only reads, nothing is changed…</p>`;
    const broken = [];
    let checked = 0;
    for(const p of PRODUCTS){
      const imgs = p.img || [];
      const badForThisProduct = [];
      for(const url of imgs){
        if(!url) continue;
        const working = await resolveWorkingImageUrl(url);
        if(!working) badForThisProduct.push(url);
      }
      checked++;
      if(badForThisProduct.length) broken.push({product: p, urls: badForThisProduct});
    }
    busy(recheckImagesBtn, false);
    if(!resultsEl){
      alert(broken.length
        ? `${broken.length} product(s) have a broken image link:\n` + broken.map(b=>`- ${b.product.name}`).join("\n")
        : `All ${checked} product(s) checked — every image link loaded fine right now.`);
      return;
    }
    if(!broken.length){
      resultsEl.innerHTML = `<p class="ad-hint" style="color:#1a7a1a">✅ Checked ${checked} product(s) — every image link loaded fine right now.</p>`;
      return;
    }
    resultsEl.innerHTML = `
      <div class="ad-panel" style="border-color:#f3c6c6;margin-bottom:16px">
        <h3 style="color:#c0392b">⚠ ${broken.length} of ${checked} product(s) have a broken/unreachable image link right now</h3>
        <p class="ad-hint">Nothing has been changed — this is a diagnostic only. Fix these from each product's own Edit screen.</p>
        <ul class="ad-checklist">
          ${broken.map(b=>`<li><b>${b.product.name}</b> — ${b.urls.length} broken link(s): ${b.urls.map(u=>`<code style="word-break:break-all">${u}</code>`).join(", ")} <button class="ad-icon-btn" title="Edit product" onclick="AdminUI.editProduct(${b.product.id})">✏️</button></li>`).join("")}
        </ul>
      </div>`;
  });

  const bulkFileInput = document.querySelector("#bulkFileInput");
  if(bulkFileInput) bulkFileInput.addEventListener("change", (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    if(/\.(xlsx|xls)$/i.test(file.name)){
      if(typeof XLSX === "undefined"){ alert("Excel reader load nahi hua — internet check karo ya CSV use karo."); return; }
      reader.onload = ()=>{
        try{
          const wb = XLSX.read(reader.result, {type:"array"});
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:""});
          bulkParsedRows = rows.map(normaliseRow).filter(r=>Object.values(r).some(v=>v!==""));
        }catch(err){ alert("Excel file padh nahi paya: " + err.message); bulkParsedRows = []; }
        renderBulkResults(bulkParsedRows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = ()=>{ bulkParsedRows = parseCsv(reader.result).map(normaliseRow); renderBulkResults(bulkParsedRows); };
      reader.readAsText(file);
    }
  });
  const runBulkBtn = document.querySelector("#runBulkBtn");
  if(runBulkBtn) runBulkBtn.addEventListener("click", ()=>runBulkUpload(bulkParsedRows));
  const bulkTemplateLink = document.querySelector("#bulkTemplateLink");
  if(bulkTemplateLink) bulkTemplateLink.addEventListener("click", (e)=>{
    e.preventDefault();
    const blob = new Blob([BULK_CSV_TEMPLATE], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bazarville-bulk-upload-template.csv";
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  const bulkUploadBtn = document.querySelector("#bulkUploadBtn");
  const bulkModalBackdrop = document.querySelector("#bulkModalBackdrop");
  if(bulkUploadBtn) bulkUploadBtn.addEventListener("click", ()=>{
    bulkParsedRows = [];
    document.querySelector("#bulkResults").innerHTML = "";
    document.querySelector("#bulkFileInput").value = "";
    document.querySelector("#runBulkBtn").disabled = true;
    bulkModalBackdrop.classList.add("show");
  });
  const closeBulkModal = document.querySelector("#closeBulkModal");
  const cancelBulkBtn = document.querySelector("#cancelBulkBtn");
  [closeBulkModal, cancelBulkBtn].forEach(b=>{ if(b) b.addEventListener("click", ()=>bulkModalBackdrop.classList.remove("show")); });

  window.addEventListener("hashchange", ()=>switchView(location.hash.replace("#","")||"dashboard"));
});

/* Mobile: give every admin table cell its column title (data-label) so the CSS can show tables as stacked cards. */
(function(){
  function label(t){
    const heads = [...t.querySelectorAll("tr:first-child th, thead th")].map(h=>h.textContent.trim());
    if(!heads.length) return;
    t.querySelectorAll("tr").forEach(tr=>{
      [...tr.children].forEach((td,i)=>{ if(td.tagName==="TD" && td.dataset.label===undefined) td.dataset.label = heads[i]||""; });
    });
  }
  function run(){ document.querySelectorAll("table.ad-table").forEach(label); }
  function start(){
    run();
    let t = null;
    new MutationObserver(()=>{ clearTimeout(t); t = setTimeout(run, 60); }).observe(document.body, {childList:true, subtree:true});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

/* ---------- Typing helpers (Vikas/Arjun: spelling mistakes + wrong URLs in admin) ----------
   1) Every text box / text area gets the browser's spell-checker turned ON (red underline + right-click suggestions) in English.
   2) Link boxes (image links, 3D model, brand website…) are cleaned when you leave them: spaces removed, "htp://" / "http//"
      typos repaired, "www.site.com" gets https://, and a red hint shows if it still isn't a valid link. */
(function(){
  const isUrlField = el => /(url|link)/i.test(el.id||"") && !/Btn|Toggle|Row/i.test(el.id||"");
  function fixUrl(raw){
    let v = String(raw||"").trim().replace(/\s+/g,"");
    if(!v) return "";
    v = v.replace(/^h?tt?ps{0,2}:?\/{0,3}(?=[a-z0-9])/i, m=>/^http:/i.test(m)?"http://":"https://");
    if(!/^https?:\/\//i.test(v)) v = "https://" + v.replace(/^\/+/,"");
    return v;
  }
  function validUrl(v){ try{ const u = new URL(v); return /^https?:$/.test(u.protocol) && /\.[a-z]{2,}$/i.test(u.hostname); }catch(e){ return false; } }
  function setHint(el, msg){
    let h = el.nextElementSibling && el.nextElementSibling.classList && el.nextElementSibling.classList.contains("ad-url-hint") ? el.nextElementSibling : null;
    if(!msg){ if(h) h.remove(); el.style.borderColor = ""; return; }
    if(!h){ h = document.createElement("div"); h.className = "ad-url-hint"; el.insertAdjacentElement("afterend", h); }
    h.textContent = msg; el.style.borderColor = "#d93025";
  }
  function prep(root){
    root.querySelectorAll("input,textarea").forEach(el=>{
      if(el.dataset.typingPrepped) return;
      const t = (el.getAttribute("type")||"text").toLowerCase();
      if(!["text","search","textarea",""].includes(t) && el.tagName!=="TEXTAREA") return;
      el.dataset.typingPrepped = "1";
      if(isUrlField(el)){
        el.spellcheck = false; el.setAttribute("autocapitalize","off"); el.setAttribute("autocorrect","off");
        el.addEventListener("blur", ()=>{
          const raw = el.value; if(!raw.trim()){ setHint(el,""); return; }
          if(el.id==="pf_imgUrlInput"||el.id==="cf_imgUrlInput") { /* existing Dropbox/Google-link helper runs on its own button */ }
          const fixed = fixUrl(raw); if(fixed!==raw) el.value = fixed;
          setHint(el, validUrl(el.value) ? "" : "Ye link sahi nahi lag raha — poora link daalo (jaise https://example.com/photo.jpg)");
        });
        el.addEventListener("input", ()=>setHint(el,""));
      }else{
        el.spellcheck = true; el.setAttribute("lang","en"); el.setAttribute("autocorrect","on");
        if(!el.getAttribute("autocapitalize")) el.setAttribute("autocapitalize", el.tagName==="TEXTAREA"?"sentences":"words");
      }
    });
  }
  function start(){
    prep(document);
    let t = null;
    new MutationObserver(()=>{ clearTimeout(t); t = setTimeout(()=>prep(document), 80); }).observe(document.body, {childList:true, subtree:true});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
