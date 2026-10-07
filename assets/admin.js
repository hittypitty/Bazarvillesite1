/* ===================== BAZARVILLE ADMIN PANEL (Supabase-backed) ===================== */
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
    document.body.classList.toggle("role-super", isSuper);
    document.querySelector("#roleBadge").textContent = isSuper ? `👑 ${admin.email}` : `🗂️ ${admin.email}`;
    if(!isSuper && ["settings","roles"].includes(location.hash.replace("#",""))) location.hash = "#dashboard";

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
    switchView(location.hash.replace("#","") || "dashboard");
  }

  /* ---------- view switching ---------- */
  function switchView(name){
    document.querySelectorAll(".ad-view").forEach(v=>v.style.display = "none");
    const target = document.querySelector("#view-"+name);
    if(target) target.style.display = "block"; else document.querySelector("#view-dashboard").style.display = "block";
    document.querySelectorAll("#adNav a[data-view]").forEach(a=>a.classList.toggle("active", a.dataset.view===name));
    if(name==="dashboard") renderDashboard();
    if(name==="enquiries") renderEnquiriesTable();
    if(name==="orders") renderOrdersTable();
    if(name==="quotes") renderQuotesTable();
    if(name==="inventory") renderInventoryView();
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

    table.innerHTML = `<tr><th></th><th></th><th>Product</th><th>Category</th><th>MOQ</th><th>Stock</th></tr>` +
      (list.length ? list.map(p=>`
        <tr>
          <td><input type="checkbox" class="inv-check" data-id="${p.id}" ${invChecked.has(p.id)?"checked":""}></td>
          <td><img src="${(p.img&&p.img[0])||''}" alt=""></td>
          <td><b>${p.name}</b></td>
          <td>${p.cat}</td>
          <td>${p.moq} pcs</td>
          <td><button type="button" class="ad-stock-toggle ${p.stock?'in':'out'}" data-id="${p.id}">${p.stock?'In stock':'Out of stock'}</button></td>
        </tr>`).join("") : `<tr><td colspan="6"><p class="ad-hint" style="margin:14px 0">No products match this search/filter.</p></td></tr>`);

    table.querySelectorAll(".inv-check").forEach(cb=>{
      cb.addEventListener("change", ()=>{
        const id = Number(cb.dataset.id);
        if(cb.checked) invChecked.add(id); else invChecked.delete(id);
        updateInvBulkButtons();
      });
    });
    table.querySelectorAll(".ad-stock-toggle").forEach(btn=>{
      btn.addEventListener("click", ()=> AdminUI.toggleStock(Number(btn.dataset.id)));
    });
    updateInvBulkButtons();
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

  /* ---------- Inventory sub-tabs: Stock List / POS Billing ---------- */
  document.querySelectorAll(".ad-inv-tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      document.querySelectorAll(".ad-inv-tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      const which = tab.dataset.invtab;
      document.querySelector("#invStockPanel").style.display = which==="stock" ? "block" : "none";
      document.querySelector("#invPosPanel").style.display = which==="pos" ? "block" : "none";
      if(which==="pos"){ renderPosProductList(); renderPosCart(); refreshPosHolds(); }
    });
  });

  /* ================= POS (counter billing) =================
     Lives inside the Inventory tab (not a separate page). A sale is a cart
     of {productId, name, color, qty, price, img} built from PRODUCTS —
     "Complete Sale" writes it to the same `orders` table as a normal
     checkout (tagged source:"pos") and best-effort deducts the chosen
     colour's tracked quantity (product.colorStock — POS-only, see
     add_pos.sql); "Hold Sale" parks the cart in pos_holds to resume later. */
  let posCart = [];
  let posSelection = {}; // productId -> {color, qty}
  let posHoldsCache = [];

  function renderPosProductList(){
    const wrap = document.querySelector("#posProductList"); if(!wrap) return;
    const q = (document.querySelector("#posProductSearch")?.value || "").trim().toLowerCase();
    const list = q ? PRODUCTS.filter(p=>(p.name||"").toLowerCase().includes(q) || (p.cat||"").toLowerCase().includes(q)) : PRODUCTS;
    wrap.innerHTML = list.length ? list.map(p=>{
      if(!posSelection[p.id]) posSelection[p.id] = {color: (p.colors&&p.colors[0])||"", qty:1};
      const sel = posSelection[p.id];
      const stockVal = (p.colorStock && sel.color && p.colorStock[sel.color]!=null) ? p.colorStock[sel.color] : "";
      return `
      <div class="ad-pos-card" data-id="${p.id}">
        <img src="${(p.img&&p.img[0])||''}" alt="">
        <div class="ad-pos-card-body">
          <b>${p.name}</b>
          <div class="ad-pos-swatches">
            ${(p.colors||[]).map(c=>`<span class="ad-pos-swatch ${c===sel.color?'active':''}" style="background:${c}" data-id="${p.id}" data-color="${c}" title="${c}"></span>`).join("") || `<span class="ad-hint" style="margin:0 0 6px">No colours on this product</span>`}
          </div>
          <div class="ad-pos-card-row">
            <input type="number" min="1" class="ad-pos-qty" data-id="${p.id}" value="${sel.qty}" title="Quantity">
            ${sel.color ? `<input type="number" min="0" class="ad-pos-stockval" data-id="${p.id}" data-color="${sel.color}" placeholder="Stock qty" value="${stockVal}" title="Set tracked stock for this colour (POS only)">` : ""}
            <button type="button" class="btn btn-outline btn-sm ad-pos-addbtn" data-id="${p.id}">+ Add</button>
          </div>
        </div>
      </div>`;
    }).join("") : `<p class="ad-hint">No products found.</p>`;
  }

  function renderPosCart(){
    const wrap = document.querySelector("#posCart"); if(!wrap) return;
    wrap.innerHTML = posCart.length ? posCart.map((item,i)=>`
      <div class="ad-pos-cart-row">
        <img src="${item.img||''}" alt="">
        <div class="ad-pos-cart-info">
          <b>${item.name}</b>
          <span>${item.color?`<i class="ad-pos-dot" style="background:${item.color}"></i>`:""}${item.qty} × ${money(item.price)}</span>
        </div>
        <b>${money(item.qty*item.price)}</b>
        <button type="button" class="ad-icon-btn danger ad-pos-removebtn" data-i="${i}" title="Remove">✕</button>
      </div>`).join("") : `<p class="ad-hint" style="margin:0">Cart is empty — add products from the left.</p>`;
    const total = posCart.reduce((s,it)=>s+it.qty*it.price,0);
    const totalEl = document.querySelector("#posTotal");
    if(totalEl) totalEl.innerHTML = posCart.length ? `<b>Total: ${money(total)}</b>` : "";
    const holdBtn = document.querySelector("#posHoldBtn"), completeBtn = document.querySelector("#posCompleteBtn");
    if(holdBtn) holdBtn.disabled = !posCart.length;
    if(completeBtn) completeBtn.disabled = !posCart.length;
  }

  function addToCart(productId){
    const p = PRODUCTS.find(x=>x.id===productId); if(!p) return;
    const sel = posSelection[productId] || {color:"", qty:1};
    const qty = Math.max(1, Number(sel.qty)||1);
    const t = tierFor(p, qty);
    posCart.push({productId, name:p.name, color:sel.color, qty, price:t.price, img:(p.img&&p.img[0])||""});
    renderPosCart();
  }

  async function savePosStock(productId, color, value){
    const p = PRODUCTS.find(x=>x.id===productId); if(!p || !color) return;
    const num = value==="" ? null : Math.max(0, Number(value)||0);
    p.colorStock = {...(p.colorStock||{})};
    if(num==null) delete p.colorStock[color]; else p.colorStock[color] = num;
    try{ await BazDS.upsertProduct(p); }
    catch(err){ alert("Could not save stock: " + (err.message||"")); }
  }

  async function holdSale(){
    if(!posCart.length) return;
    const nameInput = document.querySelector("#posCustomerName");
    const label = (nameInput.value.trim()) || ("Hold " + new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));
    const subtotal = posCart.reduce((s,it)=>s+it.qty*it.price,0);
    const btn = document.querySelector("#posHoldBtn");
    busy(btn, true, "Holding…");
    try{
      await BazDS.holdPosSale({label, items:posCart, subtotal});
      posCart = []; nameInput.value = "";
      renderPosCart();
      await refreshPosHolds();
    }catch(err){ alert("Could not hold sale: " + (err.message||"")); }
    finally{ busy(btn, false); }
  }

  async function completeSale(){
    if(!posCart.length) return;
    const customerName = document.querySelector("#posCustomerName").value.trim();
    const subtotal = posCart.reduce((s,it)=>s+it.qty*it.price,0);
    const btn = document.querySelector("#posCompleteBtn");
    busy(btn, true, "Completing…");
    try{
      await BazDS.createPosSale({
        customerName,
        items: posCart.map(it=>({name:it.name, color:it.color, qty:it.qty, price:it.price})),
        subtotal
      });
      // Best-effort: deduct from tracked colour stock wherever a quantity has
      // actually been set for that colour — never blocks the sale if it fails.
      for(const item of posCart){
        const p = PRODUCTS.find(x=>x.id===item.productId); if(!p || !item.color) continue;
        const current = (p.colorStock && p.colorStock[item.color]!=null) ? p.colorStock[item.color] : null;
        if(current==null) continue;
        p.colorStock = {...p.colorStock, [item.color]: Math.max(0, current-item.qty)};
        try{ await BazDS.upsertProduct(p); }catch(err){ console.error("POS stock deduction failed for", p.name, err); }
      }
      posCart = []; document.querySelector("#posCustomerName").value = "";
      renderPosCart(); renderPosProductList();
      try{ allOrdersCache = await BazDS.getOrders(); }catch(err){ console.error(err); }
      renderDashboard();
      alert("Sale completed.");
    }catch(err){ alert("Could not complete sale: " + (err.message||"")); }
    finally{ busy(btn, false); }
  }

  async function refreshPosHolds(){
    posHoldsCache = await BazDS.getPosHolds().catch(()=>[]);
    renderPosHolds();
  }
  function renderPosHolds(){
    const wrap = document.querySelector("#posHoldsList"); if(!wrap) return;
    wrap.innerHTML = posHoldsCache.length ? posHoldsCache.map(h=>`
      <div class="ad-pos-hold-row">
        <div><b>${h.label||"Held sale"}</b><br><span class="ad-hint" style="margin:0">${(h.items||[]).length} item(s), ${money(h.subtotal||0)}</span></div>
        <div class="ad-row-actions">
          <button type="button" class="btn btn-outline btn-sm ad-pos-resumebtn" data-id="${h.id}">Resume</button>
          <button type="button" class="ad-icon-btn danger ad-pos-deleteholdbtn" data-id="${h.id}" title="Delete">🗑️</button>
        </div>
      </div>`).join("") : `<p class="ad-hint" style="margin:0">No held sales.</p>`;
  }
  async function resumeHold(id){
    const h = posHoldsCache.find(x=>x.id===id); if(!h) return;
    if(posCart.length && !confirm("This replaces the sale you're currently building. Continue?")) return;
    posCart = (h.items||[]).slice();
    renderPosCart();
    try{ await BazDS.deletePosHold(id); }catch(err){ console.error(err); }
    await refreshPosHolds();
  }
  async function deleteHoldHandler(id){
    if(!confirm("Delete this held sale? This cannot be undone.")) return;
    try{ await BazDS.deletePosHold(id); await refreshPosHolds(); }
    catch(err){ alert("Could not delete: " + (err.message||"")); }
  }

  const posPanel = document.querySelector("#invPosPanel");
  if(posPanel){
    posPanel.addEventListener("click", (e)=>{
      const swatch = e.target.closest(".ad-pos-swatch");
      if(swatch){ const id=Number(swatch.dataset.id); posSelection[id] = posSelection[id]||{qty:1}; posSelection[id].color = swatch.dataset.color; renderPosProductList(); return; }
      const addBtn = e.target.closest(".ad-pos-addbtn");
      if(addBtn){ addToCart(Number(addBtn.dataset.id)); return; }
      const rmBtn = e.target.closest(".ad-pos-removebtn");
      if(rmBtn){ posCart.splice(Number(rmBtn.dataset.i),1); renderPosCart(); return; }
      const resumeBtn = e.target.closest(".ad-pos-resumebtn");
      if(resumeBtn){ resumeHold(Number(resumeBtn.dataset.id)); return; }
      const delHoldBtn = e.target.closest(".ad-pos-deleteholdbtn");
      if(delHoldBtn){ deleteHoldHandler(Number(delHoldBtn.dataset.id)); return; }
    });
    posPanel.addEventListener("change", (e)=>{
      if(e.target.classList.contains("ad-pos-qty")){
        const id = Number(e.target.dataset.id);
        posSelection[id] = posSelection[id]||{color:"",qty:1};
        posSelection[id].qty = Math.max(1, Number(e.target.value)||1);
      }
    });
    posPanel.addEventListener("focusout", (e)=>{
      if(e.target.classList.contains("ad-pos-stockval")){
        savePosStock(Number(e.target.dataset.id), e.target.dataset.color, e.target.value.trim());
      }
    });
  }
  const posSearchEl = document.querySelector("#posProductSearch");
  if(posSearchEl) posSearchEl.addEventListener("input", renderPosProductList);
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
    <div class="ad-form-grid">
      <div class="ad-field full"><label>Product name</label><input id="pf_name" value="${p?p.name.replace(/"/g,'&quot;'):''}"></div>
      <div class="ad-field"><label>Category</label><input id="pf_cat" value="${p?p.cat:''}" placeholder="e.g. T-Shirts"></div>
      <div class="ad-field"><label>Brand (internal, optional)</label><input id="pf_brand" value="${p&&p.brand?p.brand:''}"></div>
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
      <div class="ad-field"><label>MOQ (pcs)</label><input id="pf_moq" type="number" value="${p?p.moq:10}"></div>
      <div class="ad-field"><label>Bulk enquiry threshold (pcs)</label><input id="pf_bulk" type="number" value="${p?p.bulk:25}"></div>
      <div class="ad-field full">
        <label>Colours</label>
        <div class="ad-tag-group" id="pf_colorChips"></div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <input type="color" id="pf_colorPicker" value="#1a1a1a" style="width:44px;height:38px;padding:2px;border:1.5px solid var(--line);border-radius:8px;cursor:pointer">
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
      <div class="ad-field full">
        <label>Printing options <span class="ad-hint" style="display:inline">(optional — shown as a variant selector on the product page, e.g. Screen Print / Embroidery)</span></label>
        <div class="ad-tag-group" id="pf_printOptChips"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="pf_printOptInput" placeholder="e.g. Embroidery" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addPrintOptBtn">+ Add option</button>
        </div>
      </div>
      <div class="ad-field full"><h4 style="margin:6px 0 -4px">SEO (optional — shown in Google search results and the browser tab)</h4></div>
      <div class="ad-field full"><label>Meta title</label><input id="pf_metaTitle" value="${p&&p.metaTitle?p.metaTitle.replace(/"/g,'&quot;'):''}" placeholder="Defaults to the product name if left blank" maxlength="70"></div>
      <div class="ad-field full"><label>Meta description</label><input id="pf_metaDesc" value="${p&&p.metaDescription?p.metaDescription.replace(/"/g,'&quot;'):''}" placeholder="1-2 line summary shown under the title in Google" maxlength="160"></div>
      <div class="ad-field full"><label>URL slug</label><input id="pf_slug" value="${p&&p.slug?p.slug:''}" placeholder="e.g. steel-water-bottle-750ml (auto-generated from the name if left blank)"></div>
      <div class="ad-field ad-checkbox-row" style="align-self:end"><input type="checkbox" id="pf_stock" ${!p||p.stock?'checked':''}> <label>In stock</label></div>
      <div class="ad-field full">
        <label>Quantity-tier pricing</label>
        <div id="pf_tiers"></div>
        <button class="btn btn-outline btn-sm" id="pf_addTier" type="button">+ Add price tier</button>
      </div>
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
  let workingTrending = false;
  let workingSizes = [];
  let workingPrintOpts = [];
  let workingColorImages = {}; // {"#1a1a1a": ["url1","url2"]} — optional per-colour gallery override
  function renderColorChips(){
    const el = document.querySelector("#pf_colorChips"); if(!el) return;
    el.innerHTML = workingColors.map((c,i)=>`
      <span class="ad-tag-chip" style="background:${c}"><i></i>${c}<b onclick="AdminUI.removeColor(${i})">✕</b></span>`).join("") || `<span class="ad-hint" style="margin:0">No colours added yet</span>`;
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
  function renderPrintOptChips(){
    const el = document.querySelector("#pf_printOptChips"); if(!el) return;
    el.innerHTML = workingPrintOpts.map((s,i)=>`
      <span class="ad-tag-chip ad-tag-chip-plain">${s}<b onclick="AdminUI.removePrintOpt(${i})">✕</b></span>`).join("") || `<span class="ad-hint" style="margin:0">None yet — leave empty if this product only has one printing method</span>`;
  }
  window.AdminUI = window.AdminUI || {};
  AdminUI.removeColor = (i)=>{
    const c = workingColors[i];
    workingColors.splice(i,1);
    delete workingColorImages[c]; // drop that colour's images too — nothing to show them for any more
    productImageColors = productImageColors.map(tag=>tag===c?"":tag); // untag any main-gallery photo tagged with it
    renderColorChips();
  };
  AdminUI.removeColorImg = (ci, i)=>{
    const c = workingColors[ci];
    if(!confirm("Remove this photo from this colour? This can't be undone unless you re-add it, and it won't take effect until you click Save.")) return;
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
    if(!confirm("Remove this photo from the product? This can't be undone unless you re-add the image link/file, and it won't take effect until you click Save.")) return;
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
    workingColorImages = p && p.colorImages ? JSON.parse(JSON.stringify(p.colorImages)) : {};
    workingSizes = p ? p.sizes.slice() : ["Standard"];
    workingPrintOpts = p && p.printOptions ? p.printOptions.slice() : [];
    document.querySelector("#productModalTitle").textContent = p ? "Edit Product" : "Add Product";
    // Status lives in the modal's header line (next to the title), not in the
    // scrollable form body, so it's visible immediately without scrolling —
    // set its value here since the header markup is static (not rebuilt per-open).
    document.querySelector("#pf_status").value = (p && p.status === "draft") ? "draft" : "published";
    // Manual Trending override — same "lives in the header, not the
    // scrollable form body" reasoning as Status above.
    workingTrending = !!(p && p.trending);
    const trendingBtn = document.querySelector("#pf_trendingToggle");
    trendingBtn.classList.toggle("active", workingTrending);
    trendingBtn.onclick = ()=>{ workingTrending = !workingTrending; trendingBtn.classList.toggle("active", workingTrending); };
    document.querySelector("#productForm").innerHTML = productFormHtml(p);
    renderTierRows(workingTiers);
    renderImgGrid();
    renderColorChips();
    renderSizeChips();
    renderPrintOptChips();
    document.querySelector("#pf_addPrintOptBtn").addEventListener("click", ()=>{
      const input = document.querySelector("#pf_printOptInput");
      const val = input.value.trim();
      if(!val) return;
      if(!workingPrintOpts.some(s=>s.toLowerCase()===val.toLowerCase())) workingPrintOpts.push(val);
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
      if(!workingColors.includes(hex)) workingColors.push(hex);
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
    if(!professions.length){ alert("Select at least one profession."); return; }
    const purposes = [...document.querySelectorAll("#pf_purposes input:checked")].map(i=>i.value);
    if(!purposes.length){ alert("Select at least one purpose."); return; }
    const occasions = [...document.querySelectorAll("#pf_occasions input:checked")].map(i=>i.value);
    if(!workingColors.length){ alert("Add at least one colour."); return; }
    if(!workingSizes.length){ alert("Add at least one size."); return; }
    const data = {
      id: editingProductId || undefined,
      name,
      cat: document.querySelector("#pf_cat").value.trim() || "Uncategorised",
      professions,
      profession: professions[0],
      purposes,
      purpose: purposes[0],
      occasions,
      occasion: occasions[0] || "",
      brand: document.querySelector("#pf_brand").value.trim() || null,
      moq: Number(document.querySelector("#pf_moq").value)||1,
      bulk: Number(document.querySelector("#pf_bulk").value)||1,
      stock: document.querySelector("#pf_stock").checked,
      status: document.querySelector("#pf_status").value,
      trending: workingTrending,
      colors: workingColors.slice(),
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
      // Never save a product with zero valid tiers — every price display,
      // sort-by-price and the budget filter on the public site reads
      // tiers[0], and an empty array used to crash those features for
      // this product (and silently abort whatever list it was in).
      tiers: (()=>{
        const valid = workingTiers.filter(t=>t.min>0).sort((a,b)=>a.min-b.min);
        return valid.length ? valid : [{min:1, price:0}];
      })(),
      img: productImages,
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
      <p><b>Subtotal: ${money(o.subtotal||0)}</b> · Payment: ${(o.payment_method||"cod").replace("_"," ")}</p>
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
    const headers = parseLine(lines[0]).map(h=>h.toLowerCase().trim());
    return lines.slice(1).map(line=>{
      const cells = parseLine(line);
      const row = {};
      headers.forEach((h,i)=>{ row[h] = cells[i] !== undefined ? cells[i] : ""; });
      return row;
    });
  }

  const BULK_CSV_TEMPLATE = `name,category,professions,purpose,occasion,brand,moq,bulk_threshold,price_tiers,colors,sizes,images,stock,status
Premium Cotton Polo Tee,T-Shirts,Corporate|IT / Tech,Employee Gifting,Onboarding,Cello,20,50,"20:399|50:349|100:299",#1a1a1a|#c6f000,S|M|L|XL,https://example.com/img1.jpg|https://example.com/img2.jpg,TRUE,published
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
      if(!isExisting && !r.images) problems.push("missing images (required for new products only)");
      if(!r.professions) problems.push("missing professions");
      return {i, problems};
    }).filter(r=>r.problems.length);
    const validCount = rows.length - errors.length;
    let html = `<p class="ad-hint"><b>${rows.length}</b> row(s) found — <b>${validCount}</b> look valid and ready to upload.</p>`;
    if(errors.length){
      html += `<p class="ad-hint" style="color:#c0392b">${errors.length} row(s) will be skipped: ` +
        errors.map(e=>`row ${e.i+2} (${e.problems.join(", ")})`).join("; ") + `</p>`;
    }
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
      if(!r.name || !r.professions || (!existing && !r.images)) continue;
      const tiers = (r.price_tiers||"").split("|").filter(Boolean).map(t=>{
        const [min,price] = t.split(":"); return {min:Number(min)||1, price:Number(price)||0};
      });
      const data = {
        id: existing ? existing.id : undefined,
        name: r.name,
        cat: r.category || "Uncategorised",
        professions: r.professions.split("|").map(s=>s.trim()).filter(Boolean),
        profession: r.professions.split("|")[0].trim(),
        purpose: r.purpose || "Employee Gifting",
        occasion: r.occasion || "",
        brand: r.brand || null,
        moq: Number(r.moq) || 1,
        bulk: Number(r.bulk_threshold) || 1,
        stock: /^(true|yes|1)$/i.test(r.stock || "true"),
        status: /^draft$/i.test(r.status || "published") ? "draft" : "published",
        colors: (r.colors||"#1a1a1a").split("|").map(s=>s.trim()).filter(Boolean),
        sizes: (r.sizes||"Standard").split("|").map(s=>s.trim()).filter(Boolean),
        tiers: tiers.length ? tiers : [{min:Number(r.moq)||1, price:0}],
        // IMPORTANT (client requirement): bulk CSV must never be able to wipe
        // out a real product's photos. When updating an EXISTING product we
        // always keep its current images no matter what the CSV's `images`
        // column says (stale/placeholder/blank values are common on re-upload
        // for something like a price change). Only a brand-new product (no
        // existing match by name) takes its images from the CSV.
        img: existing ? existing.img : r.images.split("|").map(s=>s.trim()).filter(Boolean)
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
    reader.onload = ()=>{ bulkParsedRows = parseCsv(reader.result); renderBulkResults(bulkParsedRows); };
    reader.readAsText(file);
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
