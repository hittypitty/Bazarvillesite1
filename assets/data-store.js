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
    const {images, ...rest} = row;
    return {...rest, img: images || [], professions: row.professions && row.professions.length ? row.professions : (row.profession ? [row.profession] : [])};
  }
  function appToDb(p){
    const {img, ...rest} = p;
    return {...rest, images: img || [], profession: (p.professions && p.professions[0]) || p.profession || "", professions: p.professions || (p.profession ? [p.profession] : [])};
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
    const query = id
      ? sb.from("products").update(row).eq("id", id)
      : sb.from("products").insert(row);
    const { data, error } = await query.select().single();
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

  const SETTINGS_FALLBACK = { whatsappNumber:"919999999999", heroImages:[], brandColor:"#c6f000", brandFont:"inter", animationLevel:"subtle" };

  async function getSettings(){
    const sb = getClient(); if(!sb) return SETTINGS_FALLBACK;
    const { data, error } = await sb.from("settings").select("*").eq("id",1).single();
    if(error){ console.error("getSettings:", error.message); return SETTINGS_FALLBACK; }
    return {
      whatsappNumber: data.whatsapp_number,
      heroImages: data.hero_images || [],
      brandColor: data.brand_color || "#c6f000",
      brandFont: data.brand_font || "inter",
      animationLevel: data.animation_level || "subtle"
    };
  }

  async function updateSettings(settings){
    const sb = getClient(); if(!sb) return false;
    const { error } = await sb.from("settings").update({
      whatsapp_number: settings.whatsappNumber,
      hero_images: settings.heroImages,
      brand_color: settings.brandColor,
      brand_font: settings.brandFont,
      animation_level: settings.animationLevel
    }).eq("id",1);
    if(error){ console.error("updateSettings:", error.message); throw error; }
    return true;
  }

  async function logEnquiry({ref, productId, productName, quantity}){
    const sb = getClient(); if(!sb) return false;
    const { error } = await sb.from("enquiries").insert({ ref, product_id:productId, product_name:productName, quantity });
    if(error) console.error("logEnquiry:", error.message); // non-fatal — never block the WhatsApp redirect on this
    return !error;
  }

  /** Uploads a File to Storage and returns its public URL. folder is just a
   *  path prefix for organisation, e.g. "products" or "collections". */
  async function uploadImage(file, folder){
    const sb = getClient(); if(!sb) throw new Error("Supabase not configured");
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g,"")}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl:"3600", upsert:false });
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
    const { error } = await sb.from("enquiries").update(row).eq("id", id);
    if(error){ console.error("updateEnquiry:", error.message); throw error; }
    return true;
  }

  return {
    getProducts, upsertProduct, deleteProduct,
    getCollections, upsertCollection, deleteCollection,
    getSettings, updateSettings,
    logEnquiry, getEnquiries, updateEnquiry, uploadImage,
    signIn, signOut, getCurrentAdmin
  };
})();
