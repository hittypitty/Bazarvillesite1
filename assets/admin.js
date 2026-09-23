/* ===================== BAZARVILLE ADMIN PANEL (Supabase-backed) ===================== */
document.addEventListener("DOMContentLoaded", async ()=>{

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

    renderDashboard();
    renderProductsTable();
    renderCollectionsGrid();
    renderEnquiriesTable();
    renderSettingsView();
    renderColorSwatches();
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
  }
  document.querySelectorAll("#adNav a[data-view]").forEach(a=>{
    a.addEventListener("click", (e)=>{ e.preventDefault(); location.hash = "#"+a.dataset.view; switchView(a.dataset.view); });
  });

  /* ---------- dashboard ---------- */
  function renderDashboard(){
    const el = document.querySelector("#adStats"); if(!el) return;
    const out = PRODUCTS.filter(p=>!p.stock).length;
    el.innerHTML = `
      <div class="ad-stat"><b>${PRODUCTS.length}</b><span>Total products</span></div>
      <div class="ad-stat"><b>${out}</b><span>Out of stock</span></div>
      <div class="ad-stat"><b>${COLLECTIONS.length}</b><span>Featured collections</span></div>
      <div class="ad-stat"><b>${new Set(PRODUCTS.map(p=>p.cat)).size}</b><span>Categories in use</span></div>`;
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
    el.innerHTML = `<tr><th></th><th>Product</th><th>Category</th><th>Starting price</th><th>MOQ</th><th>Stock</th><th></th></tr>` +
      PRODUCTS.map(p=>{
        const t = tierFor(p, p.moq);
        return `<tr>
          <td><img src="${(p.img&&p.img[0])||''}" alt=""></td>
          <td><b>${p.name}</b></td>
          <td>${p.cat}</td>
          <td>${money(t.price)}</td>
          <td>${p.moq} pcs</td>
          <td><span class="ad-badge ${p.stock?'in':'out'}">${p.stock?'In stock':'Out of stock'}</span></td>
          <td><div class="ad-row-actions">
            <button class="ad-icon-btn" title="Edit" onclick="AdminUI.editProduct(${p.id})">✏️</button>
            <button class="ad-icon-btn danger" title="Delete" onclick="AdminUI.deleteProduct(${p.id})">🗑️</button>
          </div></td>
        </tr>`;
      }).join("");
  }

  let editingProductId = null;
  let productImages = [];

  function productFormHtml(p){
    return `
    <div class="ad-form-grid">
      <div class="ad-field full"><label>Product name</label><input id="pf_name" value="${p?p.name.replace(/"/g,'&quot;'):''}"></div>
      <div class="ad-field"><label>Category</label><input id="pf_cat" value="${p?p.cat:''}" placeholder="e.g. T-Shirts"></div>
      <div class="ad-field"><label>Brand (internal, optional)</label><input id="pf_brand" value="${p&&p.brand?p.brand:''}"></div>
      <div class="ad-field"><label>Profession</label>
        <select id="pf_profession">${PROFESSIONS.map(pr=>`<option ${p&&p.profession===pr.name?'selected':''}>${pr.name}</option>`).join("")}</select>
      </div>
      <div class="ad-field"><label>Purpose</label>
        <select id="pf_purpose">${["Employee Gifting","Client Gifting","Event Merchandise","Promotional"].map(v=>`<option ${p&&p.purpose===v?'selected':''}>${v}</option>`).join("")}</select>
      </div>
      <div class="ad-field"><label>Occasion</label><input id="pf_occasion" value="${p?p.occasion:''}" placeholder="e.g. Diwali"></div>
      <div class="ad-field"><label>MOQ (pcs)</label><input id="pf_moq" type="number" value="${p?p.moq:10}"></div>
      <div class="ad-field"><label>Bulk enquiry threshold (pcs)</label><input id="pf_bulk" type="number" value="${p?p.bulk:25}"></div>
      <div class="ad-field"><label>Colours (comma-separated hex)</label><input id="pf_colors" value="${p?p.colors.join(","):"#1a1a1a,#c6f000"}"></div>
      <div class="ad-field"><label>Sizes (comma-separated)</label><input id="pf_sizes" value="${p?p.sizes.join(","):"Standard"}"></div>
      <div class="ad-field full ad-checkbox-row"><input type="checkbox" id="pf_stock" ${!p||p.stock?'checked':''}> <label>In stock</label></div>
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
        <div style="display:flex;gap:8px;margin-top:10px">
          <input type="url" id="pf_imgUrlInput" placeholder="Or paste an image link (e.g. Dropbox direct link ending ?dl=1)" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addImgUrlBtn">Add link</button>
        </div>
      </div>
    </div>`;
  }

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
      <div class="ad-img-thumb"><img src="${src}"><span class="rm" onclick="AdminUI.removeImg(${i})">✕</span></div>`).join("")
      + `<div class="ad-img-add" id="pf_addImgBtn">+</div>`;
    document.querySelector("#pf_addImgBtn").addEventListener("click", ()=>document.querySelector("#pf_imgInput").click());
  }
  AdminUI.removeImg = (i)=>{ productImages.splice(i,1); renderImgGrid(); };

  function openProductModal(p){
    editingProductId = p ? p.id : null;
    productImages = p ? p.img.slice() : [];
    workingTiers = p ? p.tiers.map(t=>({...t})) : [{min:p?p.moq:10, price:0}];
    document.querySelector("#productModalTitle").textContent = p ? "Edit Product" : "Add Product";
    document.querySelector("#productForm").innerHTML = productFormHtml(p);
    renderTierRows(workingTiers);
    renderImgGrid();
    document.querySelector("#pf_addTier").addEventListener("click", ()=>{ workingTiers.push({min:1,price:0}); renderTierRows(workingTiers); });
    document.querySelector("#pf_imgInput").addEventListener("change", async (e)=>{
      const status = document.querySelector("#pf_uploadStatus");
      const files = [...e.target.files];
      status.textContent = `Uploading ${files.length} image(s)…`;
      for(const file of files){
        try{
          const url = await BazDS.uploadImage(file, "products");
          productImages.push(url);
          renderImgGrid();
        }catch(err){
          status.textContent = "Upload failed: " + (err.message||"check Supabase Storage bucket/policy.");
          return;
        }
      }
      status.textContent = "";
    });
    // Paste a direct image link (Dropbox, Google Drive direct link, etc.)
    // instead of uploading — the file then lives wherever that link points,
    // not in Supabase Storage, so it doesn't count against its free quota.
    document.querySelector("#pf_addImgUrlBtn").addEventListener("click", ()=>{
      const input = document.querySelector("#pf_imgUrlInput");
      const url = input.value.trim();
      if(!url) return;
      if(!/^https?:\/\//i.test(url)){ alert("Please paste a full link starting with http:// or https://"); return; }
      productImages.push(url);
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
    const name = document.querySelector("#pf_name").value.trim();
    if(!name){ alert("Product name is required."); return; }
    if(!productImages.length){ alert("Add at least one product image."); return; }
    const data = {
      id: editingProductId || undefined,
      name,
      cat: document.querySelector("#pf_cat").value.trim() || "Uncategorised",
      profession: document.querySelector("#pf_profession").value,
      purpose: document.querySelector("#pf_purpose").value,
      occasion: document.querySelector("#pf_occasion").value.trim(),
      brand: document.querySelector("#pf_brand").value.trim() || null,
      moq: Number(document.querySelector("#pf_moq").value)||1,
      bulk: Number(document.querySelector("#pf_bulk").value)||1,
      stock: document.querySelector("#pf_stock").checked,
      colors: document.querySelector("#pf_colors").value.split(",").map(s=>s.trim()).filter(Boolean),
      sizes: document.querySelector("#pf_sizes").value.split(",").map(s=>s.trim()).filter(Boolean),
      tiers: workingTiers.filter(t=>t.min>0).sort((a,b)=>a.min-b.min),
      img: productImages
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
        <div style="display:flex;gap:8px;margin-top:10px">
          <input type="url" id="cf_imgUrlInput" placeholder="Or paste an image link (e.g. Dropbox direct link ending ?dl=1)" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="cf_addImgUrlBtn">Add link</button>
        </div>
      </div>`;
  }
  function renderCollImgGrid(){
    const el = document.querySelector("#cf_imgGrid");
    el.innerHTML = (collImage ? `<div class="ad-img-thumb"><img src="${collImage}"><span class="rm" onclick="AdminUI.removeCollImg()">✕</span></div>` : "")
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
    // Paste a direct image link instead of uploading (see product form note above)
    document.querySelector("#cf_addImgUrlBtn").addEventListener("click", ()=>{
      const input = document.querySelector("#cf_imgUrlInput");
      const url = input.value.trim();
      if(!url) return;
      if(!/^https?:\/\//i.test(url)){ alert("Please paste a full link starting with http:// or https://"); return; }
      collImage = url;
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

  /* ================= BRAND COLOUR THEME ================= */
  // 10 preset corporate-friendly accents, including a monochrome "Charcoal"
  // and "Silver" pair for a black/white-leaning look. Charcoal/Silver use
  // slightly-off shades (not pure #000/#fff) so text sitting on them, or on
  // the near-black/white surfaces elsewhere on the site, always stays
  // readable — applyBrandColor() (in script.js) also auto-picks light or
  // dark text for whichever colour is chosen.
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

  /* ================= ENQUIRIES ================= */
  async function renderEnquiriesTable(){
    const el = document.querySelector("#enquiriesTable"); if(!el) return;
    let enquiries = [];
    try{ enquiries = await BazDS.getEnquiries(); }catch(err){ console.error(err); }
    if(!enquiries.length){
      el.innerHTML = "";
      el.closest(".ad-table-wrap").innerHTML = `<p class="ad-enq-empty">No enquiries yet — they'll show up here as soon as a visitor uses the WhatsApp enquiry button on the live site.</p>`;
      return;
    }
    el.innerHTML = `<tr><th>Reference</th><th>Product</th><th>Quantity</th><th>Date</th></tr>` +
      enquiries.map(e=>`
        <tr>
          <td><b>${e.ref}</b></td>
          <td>${e.product_name || "—"}</td>
          <td>${e.quantity ? e.quantity+" pcs" : "—"}</td>
          <td>${new Date(e.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
        </tr>`).join("");
  }

  window.addEventListener("hashchange", ()=>switchView(location.hash.replace("#","")||"dashboard"));
});
