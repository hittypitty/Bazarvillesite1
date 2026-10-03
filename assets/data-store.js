/* ===================== BAZARVILLE — Supabase-backed data layer =====================
   Single place the rest of the site talks to for data. Everything here is
   async (returns Promises) because it now hits a real Supabase database
   instead of localStorage — script.js and admin.js await these calls.

   Field-name note: the app (script.js/admin.js) uses `img` for a product's
   image array everywhere, but the database column is `images` (clearer in
   SQL). This file is the only place that translates between the two, so
   nothing else in the codebase needs to know or care. */
const BazDS = (function(){
  const BUCKET = "bazarville-media";
  let client = null;

  function getClient(){
    if(client) return client;
    if(typeof supabase === "undefined"){
      console.error("Supabase JS library not loaded — check the <script> tag order in this page's <head>.");
      return null;
    }
    if(!SUPABASE_URL || SUPABASE_URL.includes("YOUR-PROJECT")){
      console.error("Supabase not configured yet — fill in assets/supabase-config.js with your project URL and anon key.");
      return null;
    }
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
  }

  function dbToApp(row){
    const {images, print_options, meta_title, meta_description, color_images, ...rest} = row;
    return {
      ...rest,
      img: images || [],
      // Optional per-colour gallery override — e.g. {"#1a1a1a":["url1"]}. A
      // colour missing here (or predating the add_color_images.sql migration)
      // just falls back to `img` above, so nothing changes for any existing
      // product until an admin deliberately assigns colour-specific photos.
      colorImages: color_images || {},
      professions: row.professions && row.professions.length ? row.professions : (row.profession ? [row.profession] : []),
      // Purpose/Occasion: same "array is the source of truth, singular kept for
      // backward compatibility" pattern as profession/professions above. If a
      // product predates the add_multi_purpose_occasion.sql migration (or that
      // migration hasn't been run yet), row.purposes/occasions will be
      // undefined/empty — fall back to the single legacy value so nothing
      // appears to lose its purpose/occasion.
      purposes: row.purposes && row.purposes.length ? row.purposes : (row.purpose ? [row.purpose] : []),
      occasions: row.occasions && row.occasions.length ? row.occasions : (row.occasion ? [row.occasion] : []),
      printOptions: print_options || [],
      metaTitle: meta_title || "",
      metaDescription: meta_description || ""
    };
  }
  function appToDb(p){
    const {img, printOptions, metaTitle, metaDescription, colorImages, ...rest} = p;
    return {
      ...rest,
      images: img || [],
      color_images: colorImages || {},
      profession: (p.professions && p.professions[0]) || p.profession || "",
      professions: p.professions || (p.profession ? [p.profession] : []),
      purpose: (p.purposes && p.purposes[0]) || p.purpose || "",
      occasion: (p.occasions && p.occasions[0]) || p.occasion || "",
      purposes: p.purposes || (p.purpose ? [p.purpose] : []),
      occasions: p.occasions || (p.occasion ? [p.occasion] : []),
      print_options: printOptions || [],
      meta_title: metaTitle || "",
      meta_description: metaDescription || ""
    };
  }

  async function getProducts(){
    const sb = getClient(); if(!sb) return [];
    const { data, error } = await sb.from("products").select("*").order("id");
    if(error){ console.error("getProducts:", error.message); return []; }
    return data.map(dbToApp);
  }

  async function upsertProduct(product){
    const sb = getClient(); if(!sb) return null;
    const row = appToDb(product);
    const id = row.id;
    delete row.id; // the "id" column is an identity column the DB assigns — it
                   // can never be sent in an insert/update payload, or Postgres
                   // rejects it with "cannot insert a non-DEFAULT value into
                   // column id". Editing an existing product goes through
                   // .update().eq("id", id) instead, which targets the row by
                   // id without ever writing to that column.
    const runQuery = (r) => (id ? sb.from("products").update(r).eq("id", id) : sb.from("products").insert(r));
    // Columns that only exist once their matching migration has been run —
    // add_multi_purpose_occasion.sql (purposes/occasions) and
    // add_color_images.sql (color_images). On a database where NONE of these
    // migrations have been run yet, Supabase reports them missing ONE AT A
    // TIME (one error per save attempt, naming only the first column it hit),
    // so a single strip-and-retry isn't enough — it fixes the first missing
    // column, then immediately fails again on the next one. Loop instead:
    // keep stripping whichever migratable column the latest error names and
    // retrying, until the save succeeds or the error is something else
    // entirely (a real problem, not a missing-migration one).
    const MIGRATABLE_COLUMNS = ["purposes","occasions","color_images"];
    let safeRow = {...row};
    let stripped = [];
    let data, error;
    for(let attempt = 0; attempt <= MIGRATABLE_COLUMNS.length; attempt++){
      ({data, error} = await runQuery(safeRow).select().single());
      if(!error) break;
      const col = MIGRATABLE_COLUMNS.find(c => !stripped.includes(c) && new RegExp(`'${c}'|${c}\\b`, "i").test(error.message));
      if(!col) break; // not a missing-migration error (or nothing left to strip) — surface it as-is
      delete safeRow[col];
      stripped.push(col);
    }
    if(stripped.length && !error){
      // Saved fine (minus whichever newer field(s) need their migration) —
      // just warn in the console rather than failing the save in the admin UI.
      console.warn(`Product saved, but these newer fields couldn't be saved because their migration hasn't been run yet in Supabase: ${stripped.join(", ")}. Run the matching .sql file(s) from the supabase/ folder in the Supabase SQL Editor.`);
    }
    if(error){ console.error("upsertProduct:", error.message); throw error; }
    return dbToApp(data);
  }

  async function deleteProduct(id){
    const sb = getClient(); if(!sb) return false;
    const { error } = await sb.from("products").delete().eq("id", id);
    if(error){ console.error("deleteProduct:", error.message); throw error; }
    return true;
  }

  async function getCollections(){
    const sb = getClient(); if(!sb) return [];
    const { data, error } = await sb.from("collections").select("*").order("sort_order");
    if(error){ console.error("getCollections:", error.message); return []; }
    return data.map(c => ({ name:c.name, tag:c.tag, img:c.image_url, id:c.id, sort_order:c.sort_order }));
  }

  async function upsertCollection(coll){
    const sb = getClient(); if(!sb) return null;
    const row = { name: coll.name, tag: coll.tag, image_url: coll.img, sort_order: coll.sort_order || 0 };
    // same identity-column rule as products — never send "id" in the payload.
    const query = coll.id
      ? sb.from("collections").update(row).eq("id", coll.id)
      : sb.from("collections").insert(row);
    const { data, error } = await query.select().single();
    if(error){ console.error("upsertCollection:", error.message); throw error; }
    return { name:data.name, tag:data.tag, img:data.image_url, id:data.id, sort_order:data.sort_order };
  }

  async function deleteCollection(id){
    const sb = getClient(); if(!sb) return false;
    const { error } = await sb.from("collections").delete().eq("id", id);
    if(error){ console.error("deleteCollection:", error.message); throw error; }
    return true;
  }

  // Default Purpose/Occasion lists — kept here too (duplicated from script.js's
  // DEFAULT_PURPOSES/DEFAULT_OCCASIONS) so getSettings() always returns a full,
  // usable list even before the add_taxonomies.sql migration has been run
  // (i.e. the settings row's purposes/occasions/custom_professions columns
  // don't exist yet, or exist but are still empty on a fresh row).
  const DEFAULT_PURPOSES_FALLBACK = [
    "Client Gifts","Employee / Staff Gifts","Office & Workplace","Corporate Events",
    "Awards & Recognition","Onboarding / Joining Kits","Marketing & Promotion",
    "Branding & Corporate Identity","Conferences / Seminars / Workshops",
    "Dealer / Distributor Gifts","Employee Appreciation","Welcome / Gift Kits",
    "Festive Gifting","Travel / Utility Gifting","Team / Group Gifting"
  ];
  const DEFAULT_OCCASIONS_FALLBACK = [
    "Diwali","New Year","Holi","Raksha Bandhan","Christmas","Eid","Independence Day",
    "Republic Day","Company Anniversary","Annual Day","Product Launch","Corporate Events",
    "Conferences & Exhibitions","Employee Joining / Onboarding","Employee Recognition & Awards",
    "Employee Farewell","Client / Dealer Meets","Team Outings & Celebrations"
  ];
  const DEFAULT_HOMEPAGE_QUESTIONS_FALLBACK = [
    "What can I get under ₹500?",
    "What can I get under ₹5,000?",
    "Best gifts for employee onboarding?",
    "Diwali gifting ideas on a budget?",
    "What's trending for client gifting?",
    "How can we help you today?"
  ];

  const SETTINGS_FALLBACK = {
    whatsappNumber:"919827869031", heroImages:[], brandColor:"#c6f000", brandFont:"inter", animationLevel:"subtle",
    purposes: DEFAULT_PURPOSES_FALLBACK, occasions: DEFAULT_OCCASIONS_FALLBACK, customProfessions: [],
    homepageQuestions: DEFAULT_HOMEPAGE_QUESTIONS_FALLBACK
  };

  async function getSettings(){
    const sb = getClient(); if(!sb) return SETTINGS_FALLBACK;
    const { data, error } = await sb.from("settings").select("*").eq("id",1).single();
    if(error){ console.error("getSettings:", error.message); return SETTINGS_FALLBACK; }
    return {
      whatsappNumber: data.whatsapp_number,
      heroImages: data.hero_images || [],
      brandColor: data.brand_color || "#c6f000",
      brandFont: data.brand_font || "inter",
      animationLevel: data.animation_level || "subtle",
      // these columns only exist after their respective migration has been
      // run — fall back to the defaults so the site/admin still work either way
      purposes: (data.purposes && data.purposes.length) ? data.purposes : DEFAULT_PURPOSES_FALLBACK,
      occasions: (data.occasions && data.occasions.length) ? data.occasions : DEFAULT_OCCASIONS_FALLBACK,
      customProfessions: data.custom_professions || [],
      homepageQuestions: (data.homepage_questions && data.homepage_questions.length) ? data.homepage_questions : DEFAULT_HOMEPAGE_QUESTIONS_FALLBACK
    };
  }

  async function updateSettings(settings){
    const sb = getClient(); if(!sb) return false;
    const fullRow = {
      whatsapp_number: settings.whatsappNumber,
      hero_images: settings.heroImages,
      brand_color: settings.brandColor,
      brand_font: settings.brandFont,
      animation_level: settings.animationLevel,
      purposes: settings.purposes || DEFAULT_PURPOSES_FALLBACK,
      occasions: settings.occasions || DEFAULT_OCCASIONS_FALLBACK,
      custom_professions: settings.customProfessions || [],
      homepage_questions: settings.homepageQuestions || DEFAULT_HOMEPAGE_QUESTIONS_FALLBACK
    };
    let { error } = await sb.from("settings").update(fullRow).eq("id",1);
    if(error && /(purposes|occasions|custom_professions|homepage_questions)['"]?\s*column|column.*(purposes|occasions|custom_professions|homepage_questions)/i.test(error.message)){
      // The relevant migration (add_taxonomies.sql or add_homepage_questions.sql)
      // hasn't been run on this database yet — Supabase's actual error reads
      // "Could not find the 'homepage_questions' column of 'settings' in the
      // schema cache", column name BEFORE the word "column", so the original
      // pattern that only matched "column ... x" never actually fired. Retry
      // without the missing-column fields so brand colour/font/WhatsApp-number/
      // hero-image saves still work — then surface a clear, actionable error
      // instead of a cryptic "column not found" one.
      const { purposes, occasions, custom_professions, homepage_questions, ...safeRow } = fullRow;
      const retry = await sb.from("settings").update(safeRow).eq("id",1);
      if(retry.error){ console.error("updateSettings:", retry.error.message); throw retry.error; }
      const migrationErr = new Error("Baaki settings save ho gayi, lekin ye field save karne ke liye pehle zaroori migration (.sql file) Supabase SQL Editor me run karna hoga.");
      migrationErr.migrationNeeded = true;
      throw migrationErr;
    }
    if(error){ console.error("updateSettings:", error.message); throw error; }
    return true;
  }

  async function logEnquiry({ref, productId, productName, quantity}){
    const sb = getClient(); if(!sb) return false;
    const { error } = await sb.from("enquiries").insert({ ref, product_id:productId, product_name:productName, quantity });
    if(error) console.error("logEnquiry:", error.message); // non-fatal — never block the WhatsApp redirect on this
    return !error;
  }

  /** Header "WhatsApp Enquiry" form submission — a best-effort CRM copy, kept
   *  separate from logEnquiry (which is tied to a specific product page) since
   *  this one carries the customer's own name/phone/email/deadline, which the
   *  enquiries table has no dedicated columns for, so they're folded into
   *  `notes` as a readable block rather than needing a schema migration.
   *  Never blocks or fails the WhatsApp redirect this is called alongside. */
  async function submitGeneralEnquiry({name, phone, email, product, quantity, deadline}){
    const sb = getClient(); if(!sb) return false;
    const ref = "BZV-" + Math.random().toString(36).slice(2,8).toUpperCase();
    const notesLines = [
      `Name: ${name}`, `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      deadline ? `Deadline: ${deadline}` : null
    ].filter(Boolean);
    const { error } = await sb.from("enquiries").insert({
      ref, product_name: product || "", quantity: quantity || null,
      notes: notesLines.join("\n"), source: "whatsapp_form", status: "new"
    });
    if(error) console.error("submitGeneralEnquiry:", error.message);
    return !error;
  }

  /** Uploads a File to Storage and returns its public URL. folder is just a
   *  path prefix for organisation, e.g. "products" or "collections". */
  /* Shopify-style auto-optimize: resize to a sane max dimension and re-encode as
     JPEG/WebP at ~82% quality in the browser, before it ever leaves the device.
     No paid CDN/image-transform add-on needed — this alone typically cuts a
     4-6MB phone-camera photo down to a few hundred KB with no visible quality
     loss on a product-card/gallery size image. Falls back to the original file
     untouched if anything goes wrong (corrupt image, browser without canvas
     support, etc.) so an upload never hard-fails because of this step. */
  const MAX_DIMENSION = 1600;
  const JPEG_QUALITY = 0.82;
  function optimizeImage(file){
    return new Promise(resolve=>{
      if(!file.type || !file.type.startsWith("image/") || file.type === "image/svg+xml"){
        resolve(file); return; // vector/unknown files pass through untouched
      }
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;
        if(width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size < 400*1024){
          resolve(file); return; // already small enough, don't bother re-encoding
        }
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(blob => {
          if(!blob){ resolve(file); return; }
          const newName = file.name.replace(/\.\w+$/, outType === "image/png" ? ".png" : ".jpg");
          resolve(new File([blob], newName, { type: outType }));
        }, outType, JPEG_QUALITY);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  }

  async function uploadImage(file, folder){
    const sb = getClient(); if(!sb) throw new Error("Supabase not configured");
    const optimized = await optimizeImage(file);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${optimized.name.replace(/[^a-zA-Z0-9.\-_]/g,"")}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, optimized, { cacheControl:"3600", upsert:false });
    if(error){ console.error("uploadImage:", error.message); throw error; }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  /* ---------- auth ---------- */
  async function signIn(email, password){
    const sb = getClient(); if(!sb) throw new Error("Supabase not configured");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error) throw error;
    return data.user;
  }
  async function signOut(){
    const sb = getClient(); if(!sb) return;
    await sb.auth.signOut();
  }
  /** Returns {email, role} for the signed-in user, or null if not signed in. */
  async function getCurrentAdmin(){
    const sb = getClient(); if(!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    if(!session) return null;
    const { data, error } = await sb.from("profiles").select("email, role").eq("id", session.user.id).single();
    if(error){ console.error("getCurrentAdmin:", error.message); return null; }
    return data;
  }

  /** opts.since: ISO timestamp — only enquiries on/after this are returned. */
  async function getEnquiries(opts){
    const sb = getClient(); if(!sb) return [];
    let q = sb.from("enquiries").select("*").order("created_at",{ascending:false}).limit(500);
    if(opts && opts.since) q = q.gte("created_at", opts.since);
    const { data, error } = await q;
    if(error){ console.error("getEnquiries:", error.message); return []; }
    return data;
  }

  /** Admin follow-up mini-CRM: update an enquiry's status/notes/follow-up date. */
  async function updateEnquiry(id, fields){
    const sb = getClient(); if(!sb) return false;
    const row = {};
    if("status" in fields) row.status = fields.status;
    if("notes" in fields) row.notes = fields.notes;
    if("followupAt" in fields) row.followup_at = fields.followupAt;
    if("companyName" in fields) row.company_name = fields.companyName;
    const { error } = await sb.from("enquiries").update(row).eq("id", id);
    if(error){ console.error("updateEnquiry:", error.message); throw error; }
    return true;
  }

  /** Admin CRM: manually add a lead that didn't come through the website
   *  (a phone call, a walk-in, an email) — same table as website enquiries,
   *  just flagged source:'manual' so it's easy to tell apart in reports. */
  async function addManualLead({productName, companyName, quantity, notes}){
    const sb = getClient(); if(!sb) return null;
    const ref = "BZV-" + Math.random().toString(36).slice(2,8).toUpperCase();
    const { data, error } = await sb.from("enquiries").insert({
      ref, product_name: productName || "", company_name: companyName || "",
      quantity: quantity || null, notes: notes || "", source: "manual", status: "new"
    }).select().single();
    if(error){ console.error("addManualLead:", error.message); throw error; }
    return data;
  }

  /* ---------- customer accounts (separate from admin auth above) ---------- */
  async function customerSignUp({email, password, fullName, companyName, phone}){
    const sb = getClient(); if(!sb) throw new Error("Supabase not configured");
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { account_type: "customer", full_name: fullName, company_name: companyName, phone } }
    });
    if(error) throw error;
    return data.user;
  }
  async function customerSignIn(email, password){ return signIn(email, password); }
  async function customerSignOut(){ return signOut(); }
  /** Returns the logged-in customer's profile row, or null if not signed in
   *  as a customer (an admin session correctly returns null here too). */
  async function getCurrentCustomer(){
    const sb = getClient(); if(!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    if(!session) return null;
    const { data, error } = await sb.from("customers").select("*").eq("id", session.user.id).single();
    if(error) return null; // not a customer account (e.g. an admin is signed in) — not an error
    return data;
  }
  async function updateCustomer(id, fields){
    const sb = getClient(); if(!sb) return false;
    const row = {};
    if("fullName" in fields) row.full_name = fields.fullName;
    if("companyName" in fields) row.company_name = fields.companyName;
    if("gstin" in fields) row.gstin = fields.gstin;
    if("phone" in fields) row.phone = fields.phone;
    const { error } = await sb.from("customers").update(row).eq("id", id);
    if(error){ console.error("updateCustomer:", error.message); throw error; }
    return true;
  }

  /* ---------- orders (cart → checkout) ---------- */
  async function createOrder(order){
    const sb = getClient(); if(!sb) throw new Error("Supabase not configured");
    const { data: { session } } = await sb.auth.getSession();
    const ref = "BZO-" + Math.random().toString(36).slice(2,8).toUpperCase();
    const row = {
      ref,
      customer_id: session ? session.user.id : null,
      customer_name: order.customerName, customer_phone: order.customerPhone,
      customer_email: order.customerEmail || "", shipping_address: order.shippingAddress,
      items: order.items, subtotal: order.subtotal,
      payment_method: order.paymentMethod || "cod", notes: order.notes || ""
    };
    const { data, error } = await sb.from("orders").insert(row).select().single();
    if(error){ console.error("createOrder:", error.message); throw error; }
    return data;
  }
  /** No args (admin, sees all) or {mine:true} (logged-in customer, sees own). */
  async function getOrders(opts){
    const sb = getClient(); if(!sb) return [];
    let q = sb.from("orders").select("*").order("created_at",{ascending:false});
    const { data, error } = await q;
    if(error){ console.error("getOrders:", error.message); return []; }
    return data;
  }
  async function updateOrderStatus(id, fields){
    const sb = getClient(); if(!sb) return false;
    const row = { updated_at: new Date().toISOString() };
    if("status" in fields) row.status = fields.status;
    if("paymentStatus" in fields) row.payment_status = fields.paymentStatus;
    if("notes" in fields) row.notes = fields.notes;
    const { error } = await sb.from("orders").update(row).eq("id", id);
    if(error){ console.error("updateOrderStatus:", error.message); throw error; }
    return true;
  }

  /* ---------- quotes (CPQ) ---------- */
  async function createQuote(quote){
    const sb = getClient(); if(!sb) throw new Error("Supabase not configured");
    const ref = "BZQ-" + Math.random().toString(36).slice(2,8).toUpperCase();
    const row = {
      ref, customer_name: quote.customerName, customer_company: quote.customerCompany,
      customer_phone: quote.customerPhone, customer_email: quote.customerEmail || "",
      items: quote.items, subtotal: quote.subtotal, valid_until: quote.validUntil || null,
      notes: quote.notes || "", status: "draft"
    };
    const { data, error } = await sb.from("quotes").insert(row).select().single();
    if(error){ console.error("createQuote:", error.message); throw error; }
    return data;
  }
  async function getQuotes(){
    const sb = getClient(); if(!sb) return [];
    const { data, error } = await sb.from("quotes").select("*").order("created_at",{ascending:false});
    if(error){ console.error("getQuotes:", error.message); return []; }
    return data;
  }
  async function getQuoteByRef(ref){
    const sb = getClient(); if(!sb) return null;
    const { data, error } = await sb.from("quotes").select("*").eq("ref", ref).single();
    if(error){ console.error("getQuoteByRef:", error.message); return null; }
    return data;
  }
  async function updateQuoteStatus(id, status){
    const sb = getClient(); if(!sb) return false;
    const { error } = await sb.from("quotes").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if(error){ console.error("updateQuoteStatus:", error.message); throw error; }
    return true;
  }

  return {
    getProducts, upsertProduct, deleteProduct,
    getCollections, upsertCollection, deleteCollection,
    getSettings, updateSettings,
    logEnquiry, submitGeneralEnquiry, getEnquiries, updateEnquiry, addManualLead, uploadImage,
    signIn, signOut, getCurrentAdmin,
    customerSignUp, customerSignIn, customerSignOut, getCurrentCustomer, updateCustomer,
    createOrder, getOrders, updateOrderStatus,
    createQuote, getQuotes, getQuoteByRef, updateQuoteStatus
  };
})();
