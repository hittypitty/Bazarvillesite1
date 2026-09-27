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
    el.innerHTML = `<tr><th></th><th>Product</th><th>Category</th><th>Starting price</th><th>MOQ</th><th>Stock</th><th>Status</th><th></th></tr>` +
      PRODUCTS.map(p=>{
        const t = tierFor(p, p.moq);
        const isDraft = (p.status||"published") === "draft";
        return `<tr>
          <td><img src="${(p.img&&p.img[0])||''}" alt=""></td>
          <td><b>${p.name}</b></td>
          <td>${p.cat}</td>
          <td>${money(t.price)}</td>
          <td>${p.moq} pcs</td>
          <td><span class="ad-badge ${p.stock?'in':'out'}">${p.stock?'In stock':'Out of stock'}</span></td>
          <td><span class="ad-badge ${isDraft?'out':'in'}">${isDraft?'Draft':'Published'}</span></td>
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
      <div class="ad-field full">
        <label>Profession (select all that apply)</label>
        <div class="ad-chip-group" id="pf_professions">${professionCheckboxesHtml(p?p.professions:[])}</div>
      </div>
      <div class="ad-field"><label>Purpose</label>
        <select id="pf_purpose">${["Employee Gifting","Client Gifting","Event Merchandise","Promotional"].map(v=>`<option ${p&&p.purpose===v?'selected':''}>${v}</option>`).join("")}</select>
      </div>
      <div class="ad-field"><label>Occasion</label><input id="pf_occasion" value="${p?p.occasion:''}" placeholder="e.g. Diwali"></div>
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
        <label>Sizes</label>
        <div class="ad-tag-group" id="pf_sizeChips"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input type="text" id="pf_sizeInput" placeholder="e.g. XL" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addSizeBtn">+ Add size</button>
        </div>
      </div>
      <div class="ad-field"><label>Status</label>
        <select id="pf_status">
          <option value="published" ${(!p||(p.status||'published')==='published')?'selected':''}>Published (visible on live site)</option>
          <option value="draft" ${p&&p.status==='draft'?'selected':''}>Draft (hidden from customers)</option>
        </select>
      </div>
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
        <div style="display:flex;gap:8px;margin-top:10px">
          <input type="url" id="pf_imgUrlInput" placeholder="Or paste an image link (e.g. Dropbox direct link ending ?dl=1)" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit">
          <button class="btn btn-outline btn-sm" type="button" id="pf_addImgUrlBtn">Add link</button>
        </div>
      </div>
    </div>`;
  }

  /* ---------- profession multi-select (product form) ---------- */
  function professionCheckboxesHtml(selected){
    const sel = selected && selected.length ? selected : [];
    return PROFESSIONS.map(pr=>`
      <label class="ad-chip-check"><input type="checkbox" value="${pr.name}" ${sel.includes(pr.name)?'checked':''}><span>${pr.icon} ${pr.name}</span></label>`).join("");
  }

  /* ---------- colour / size tag chips (product form) ---------- */
  let workingColors = [];
  let workingSizes = [];
  function renderColorChips(){
    const el = document.querySelector("#pf_colorChips"); if(!el) return;
    el.innerHTML = workingColors.map((c,i)=>`
      <span class="ad-tag-chip" style="background:${c}"><i></i>${c}<b onclick="AdminUI.removeColor(${i})">✕</b></span>`).join("") || `<span class="ad-hint" style="margin:0">No colours added yet</span>`;
  }
  function renderSizeChips(){
    const el = document.querySelector("#pf_sizeChips"); if(!el) return;
    el.innerHTML = workingSizes.map((s,i)=>`
      <span class="ad-tag-chip ad-tag-chip-plain">${s}<b onclick="AdminUI.removeSize(${i})">✕</b></span>`).join("") || `<span class="ad-hint" style="margin:0">No sizes added yet</span>`;
  }
  window.AdminUI = window.AdminUI || {};
  AdminUI.removeColor = (i)=>{ workingColors.splice(i,1); renderColorChips(); };
  AdminUI.removeSize = (i)=>{ workingSizes.splice(i,1); renderSizeChips(); };

  /* ---------- image link helpers (used by both product + collection forms) ----------
     A pasted link only works as an <img src> if it's a DIRECT file link. Two common
     mistakes: a Dropbox share link (ends ?dl=0 — opens an HTML preview page, not the
     file) and a Google Images search-result link (opens Google's page, not the photo).
     normalizeImageUrl fixes the Dropbox case automatically; testImageLoads actually
     tries loading it so we can warn immediately instead of silently saving a dead link. */
  function normalizeImageUrl(url){
    if(/dropbox\.com/i.test(url)){
      if(/[?&]dl=0(&|$)/.test(url)) return url.replace(/dl=0/, "dl=1");
      if(!/[?&]dl=1(&|$)/.test(url)) return url + (url.includes("?") ? "&" : "?") + "dl=1";
    }
    return url;
  }
  function testImageLoads(url){
    return new Promise(resolve=>{
      const img = new Image();
      let done = false;
      img.onload = ()=>{ if(!done){ done=true; resolve(true); } };
      img.onerror = ()=>{ if(!done){ done=true; resolve(false); } };
      img.src = url;
      setTimeout(()=>{ if(!done){ done=true; resolve(false); } }, 6000);
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
      <div class="ad-img-thumb"><img src="${src}" onerror="this.closest('.ad-img-thumb').classList.add('broken')"><span class="rm" onclick="AdminUI.removeImg(${i})">✕</span></div>`).join("")
      + `<div class="ad-img-add" id="pf_addImgBtn">+</div>`;
    document.querySelector("#pf_addImgBtn").addEventListener("click", ()=>document.querySelector("#pf_imgInput").click());
  }
  AdminUI.removeImg = (i)=>{ productImages.splice(i,1); renderImgGrid(); };

  function openProductModal(p){
    editingProductId = p ? p.id : null;
    productImages = p ? p.img.slice() : [];
    workingTiers = p ? p.tiers.map(t=>({...t})) : [{min:p?p.moq:10, price:0}];
    workingColors = p ? p.colors.slice() : ["#1a1a1a","#c6f000"];
    workingSizes = p ? p.sizes.slice() : ["Standard"];
    document.querySelector("#productModalTitle").textContent = p ? "Edit Product" : "Add Product";
    document.querySelector("#productForm").innerHTML = productFormHtml(p);
    renderTierRows(workingTiers);
    renderImgGrid();
    renderColorChips();
    renderSizeChips();
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
      url = normalizeImageUrl(url);
      btn.disabled = true; status.textContent = "Checking link…";
      const ok = await testImageLoads(url);
      btn.disabled = false;
      if(!ok){ status.textContent = ""; alert(BROKEN_LINK_MSG); return; }
      status.textContent = "";
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
    const professions = [...document.querySelectorAll("#pf_professions input:checked")].map(i=>i.value);
    if(!professions.length){ alert("Select at least one profession."); return; }
    if(!workingColors.length){ alert("Add at least one colour."); return; }
    if(!workingSizes.length){ alert("Add at least one size."); return; }
    const data = {
      id: editingProductId || undefined,
      name,
      cat: document.querySelector("#pf_cat").value.trim() || "Uncategorised",
      professions,
      profession: professions[0],
      purpose: document.querySelector("#pf_purpose").value,
      occasion: document.querySelector("#pf_occasion").value.trim(),
      brand: document.querySelector("#pf_brand").value.trim() || null,
      moq: Number(document.querySelector("#pf_moq").value)||1,
      bulk: Number(document.querySelector("#pf_bulk").value)||1,
      stock: document.querySelector("#pf_stock").checked,
      status: document.querySelector("#pf_status").value,
      colors: workingColors.slice(),
      sizes: workingSizes.slice(),
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
    // Paste a direct image link instead of uploading (see product form note above)
    document.querySelector("#cf_addImgUrlBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#cf_imgUrlInput");
      const btn = document.querySelector("#cf_addImgUrlBtn");
      const status = document.querySelector("#cf_uploadStatus");
      let url = input.value.trim();
      if(!url) return;
      if(!/^https?:\/\//i.test(url)){ alert("Please paste a full link starting with http:// or https://"); return; }
      url = normalizeImageUrl(url);
      btn.disabled = true; status.textContent = "Checking link…";
      const ok = await testImageLoads(url);
      btn.disabled = false;
      if(!ok){ status.textContent = ""; alert(BROKEN_LINK_MSG); return; }
      status.textContent = "";
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
  let allEnquiriesCache = [];

  function enqRowHtml(e){
    return `
        <tr data-id="${e.id}">
          <td><b>${e.ref}</b></td>
          <td>${e.product_name || "—"}</td>
          <td>${e.quantity ? e.quantity+" pcs" : "—"}</td>
          <td>${new Date(e.created_at).toLocaleString("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</td>
          <td>
            <select class="enq-status">
              <option value="new" ${e.status==="new"||!e.status?"selected":""}>New</option>
              <option value="contacted" ${e.status==="contacted"?"selected":""}>Contacted</option>
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
      if(!r.images) problems.push("missing images");
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
      if(!r.name || !r.images || !r.professions) continue;
      const tiers = (r.price_tiers||"").split("|").filter(Boolean).map(t=>{
        const [min,price] = t.split(":"); return {min:Number(min)||1, price:Number(price)||0};
      });
      const existing = PRODUCTS.find(p=>p.name.toLowerCase()===r.name.toLowerCase());
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
        img: r.images.split("|").map(s=>s.trim()).filter(Boolean)
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
