/* ===================== BAZARVILLE — sample catalogue & interactions ===================== */
/* Mark body as JS-enabled immediately so scroll-reveal CSS (scoped to body.js-reveal)
   only ever hides content when this script is actually running to reveal it again. */
document.body.classList.add("js-reveal");

const img = (kw, seed) => `https://picsum.photos/seed/bzv${seed}/600/600`;

const DEFAULT_PRODUCTS = [
  {id:1,name:"Premium Cotton Polo Tee",cat:"T-Shirts",profession:"Corporate",purpose:"Employee Gifting",occasion:"Onboarding",brand:"Cello",moq:20,bulk:50,stock:true,
    img:[img("tshirt,polo",1),img("shirt,fold",11),img("apparel",21)],
    tiers:[{min:20,price:399},{min:50,price:349},{min:100,price:299},{min:500,price:259}],
    colors:["#1a1a1a","#c6f000","#2454a6","#fff"],sizes:["S","M","L","XL","XXL"]},
  {id:2,name:"Logo Embroidered Cap",cat:"Caps",profession:"Retail",purpose:"Promotional",occasion:"Store Launch",moq:50,bulk:100,stock:true,
    img:[img("cap,baseball",2),img("hat",12)],
    tiers:[{min:50,price:189},{min:100,price:159},{min:250,price:135}],
    colors:["#1a1a1a","#c6f000","#dc2634"],sizes:["Free Size"]},
  {id:3,name:"Steel Insulated Bottle 750ml",cat:"Bottles",profession:"IT / Tech",purpose:"Client Gifting",occasion:"Conference",brand:"Milton",moq:25,bulk:50,stock:true,
    img:[img("water,bottle,steel",3),img("flask",13)],
    tiers:[{min:25,price:449},{min:50,price:399},{min:100,price:349},{min:500,price:299}],
    colors:["#1a1a1a","#c6f000","#888"],sizes:["750ml"]},
  {id:4,name:"Canvas Tote Bag",cat:"Bags",profession:"Education",purpose:"Event Merchandise",occasion:"Annual Day",moq:50,bulk:100,stock:true,
    img:[img("tote,bag,canvas",4),img("bag",14)],
    tiers:[{min:50,price:99},{min:100,price:85},{min:500,price:69}],
    colors:["#efe6d8","#1a1a1a"],sizes:["Standard"]},
  {id:5,name:"6-in-1 Premium Pen Set",cat:"Corporate Gifts",profession:"Corporate",purpose:"Client Gifting",occasion:"Diwali",moq:20,bulk:50,stock:false,
    img:[img("pen,gift,set",5),img("stationery",15)],
    tiers:[{min:20,price:299},{min:50,price:259},{min:100,price:219}],
    colors:["#1a1a1a","#7c19e8"],sizes:["Standard"]},
  {id:6,name:"Ceramic Branded Mug",cat:"Mugs",profession:"Hospitality",purpose:"Client Gifting",occasion:"Anniversary",moq:30,bulk:75,stock:true,
    img:[img("ceramic,mug",6),img("coffee,mug",16)],
    tiers:[{min:30,price:149},{min:75,price:129},{min:200,price:109}],
    colors:["#fff","#1a1a1a","#c6f000"],sizes:["330ml"]},
  {id:7,name:"Laptop Backpack 30L",cat:"Bags",profession:"IT / Tech",purpose:"Employee Gifting",occasion:"Onboarding",moq:15,bulk:30,stock:true,
    img:[img("backpack,laptop",7),img("bagpack",17)],
    tiers:[{min:15,price:1199},{min:30,price:1049},{min:100,price:899}],
    colors:["#1a1a1a","#3a3a38"],sizes:["30L"]},
  {id:8,name:"Premium Diary & Pen Combo",cat:"Corporate Gifts",profession:"Corporate",purpose:"Client Gifting",occasion:"New Year",moq:25,bulk:50,stock:true,
    img:[img("diary,notebook",8),img("planner",18)],
    tiers:[{min:25,price:399},{min:50,price:349},{min:100,price:299}],
    colors:["#1a1a1a","#5c3a21"],sizes:["A5"]},
  {id:9,name:"Corporate Gift Hamper Box",cat:"Corporate Gifts",profession:"Corporate",purpose:"Client Gifting",occasion:"Diwali",moq:10,bulk:25,stock:true,
    img:[img("gift,box,hamper",9),img("giftbox",19)],
    tiers:[{min:10,price:899},{min:25,price:799},{min:100,price:699}],
    colors:["#c6f000","#1a1a1a"],sizes:["Standard"]},
  {id:10,name:"Metal Keychain with Logo",cat:"Keychains",profession:"Retail",purpose:"Promotional",occasion:"Store Launch",moq:100,bulk:200,stock:true,
    img:[img("keychain,metal",10),img("keyring",20)],
    tiers:[{min:100,price:59},{min:200,price:49},{min:1000,price:39}],
    colors:["#c0c0c0","#1a1a1a"],sizes:["Standard"]},
  {id:11,name:"Automatic Umbrella",cat:"Umbrellas",profession:"Hospitality",purpose:"Client Gifting",occasion:"Monsoon Launch",moq:25,bulk:50,stock:true,
    img:[img("umbrella",22),img("rain,umbrella",23)],
    tiers:[{min:25,price:349},{min:50,price:299},{min:100,price:259}],
    colors:["#1a1a1a","#2454a6","#c6f000"],sizes:["Standard"]},
  {id:12,name:"10000mAh Power Bank",cat:"Corporate Gifts",profession:"IT / Tech",purpose:"Employee Gifting",occasion:"Annual Day",moq:20,bulk:40,stock:false,
    img:[img("powerbank,tech",24),img("charger",25)],
    tiers:[{min:20,price:699},{min:40,price:629},{min:100,price:549}],
    colors:["#1a1a1a","#fff"],sizes:["10000mAh"]},
  {id:13,name:"Zip-Up Hoodie",cat:"T-Shirts",profession:"Education",purpose:"Event Merchandise",occasion:"Annual Day",moq:20,bulk:40,stock:true,
    img:[img("hoodie",26),img("sweatshirt",27)],
    tiers:[{min:20,price:799},{min:40,price:699},{min:100,price:599}],
    colors:["#1a1a1a","#63685f","#c6f000"],sizes:["S","M","L","XL"]},
  {id:14,name:"Magnetic Name Badge",cat:"Badges",profession:"Corporate",purpose:"Employee Gifting",occasion:"Onboarding",moq:50,bulk:100,stock:true,
    img:[img("nametag,badge",28),img("badge,id",29)],
    tiers:[{min:50,price:79},{min:100,price:65},{min:500,price:52}],
    colors:["#c0c0c0","#ffd700"],sizes:["Standard"]},
  {id:15,name:"Desk Organizer Set",cat:"Corporate Gifts",profession:"Corporate",purpose:"Employee Gifting",occasion:"Onboarding",moq:15,bulk:30,stock:true,
    img:[img("desk,organizer",30),img("office,desk",31)],
    tiers:[{min:15,price:549},{min:30,price:489},{min:100,price:419}],
    colors:["#5c3a21","#1a1a1a"],sizes:["Standard"]},
  {id:16,name:"Custom Cotton Cap (Snapback)",cat:"Caps",profession:"Education",purpose:"Event Merchandise",occasion:"Annual Day",moq:50,bulk:100,stock:true,
    img:[img("snapback,cap",32),img("cap,logo",33)],
    tiers:[{min:50,price:169},{min:100,price:145},{min:250,price:119}],
    colors:["#1a1a1a","#fff","#c6f000"],sizes:["Free Size"]}
];

const DEFAULT_COLLECTIONS = [
  {name:"Diwali Corporate Gifting",tag:"32 products",img:img("diwali,gift",40)},
  {name:"New Employee Welcome Kits",tag:"18 products",img:img("welcome,kit",41)},
  {name:"Tech Conference Swag",tag:"24 products",img:img("tech,conference",42)},
  {name:"Client Appreciation Hampers",tag:"15 products",img:img("hamper,gift",43)},
  {name:"Campus Annual Day Merch",tag:"21 products",img:img("college,event",44)},
  {name:"Hospitality Branding Kit",tag:"12 products",img:img("hotel,branding",45)},
  {name:"Retail Store Launch Pack",tag:"19 products",img:img("retail,store",46)},
  {name:"Healthcare Staff Essentials",tag:"14 products",img:img("healthcare,staff",47)},
];

// Default Purpose/Occasion lists — shown on the live site's filters and in
// the admin product form's dropdowns. Admin can add more from the product
// form (see admin.js "+ Add new purpose/occasion") — those get saved into
// SETTINGS.purposes/occasions in Supabase and merged with these defaults.
const DEFAULT_PURPOSES = [
  "Client Gifts","Employee / Staff Gifts","Office & Workplace","Corporate Events",
  "Awards & Recognition","Onboarding / Joining Kits","Marketing & Promotion",
  "Branding & Corporate Identity","Conferences / Seminars / Workshops",
  "Dealer / Distributor Gifts","Employee Appreciation","Welcome / Gift Kits",
  "Festive Gifting","Travel / Utility Gifting","Team / Group Gifting"
];
const DEFAULT_OCCASIONS = [
  "Diwali","New Year","Holi","Raksha Bandhan","Christmas","Eid","Independence Day",
  "Republic Day","Company Anniversary","Annual Day","Product Launch","Corporate Events",
  "Conferences & Exhibitions","Employee Joining / Onboarding","Employee Recognition & Awards",
  "Employee Farewell","Client / Dealer Meets","Team Outings & Celebrations"
];

const DEFAULT_SETTINGS = {
  whatsappNumber: "919999999999",
  brandColor: "#c6f000",
  brandFont: "inter",
  animationLevel: "subtle",
  purposes: DEFAULT_PURPOSES,
  occasions: DEFAULT_OCCASIONS,
  customProfessions: [],
  heroImages: [
    "https://picsum.photos/seed/bzv101/500/620",
    "https://picsum.photos/seed/bzv102/450/560",
    "https://picsum.photos/seed/bzv103/400/500"
  ]
};

// Font presets for the admin "Site font" picker. Every family here is already
// preloaded via the Google Fonts <link> in every page's <head>, so switching
// is instant — nothing is fetched at runtime. admin.js reads this same list
// to render the swatches.
const FONT_PRESETS = [
  {id:"inter",        label:"Inter (Default)", body:'"Inter",system-ui,sans-serif',        heading:'"Plus Jakarta Sans","Inter",sans-serif'},
  {id:"poppins",       label:"Poppins",         body:'"Poppins",sans-serif',                heading:'"Poppins",sans-serif'},
  {id:"manrope",       label:"Manrope",         body:'"Manrope",sans-serif',                heading:'"Manrope",sans-serif'},
  {id:"sora",          label:"Sora",            body:'"Sora",sans-serif',                   heading:'"Sora",sans-serif'},
  {id:"work-sans",     label:"Work Sans",       body:'"Work Sans",sans-serif',              heading:'"Work Sans",sans-serif'},
  {id:"space-grotesk", label:"Space Grotesk",   body:'"Space Grotesk",sans-serif',          heading:'"Space Grotesk",sans-serif'}
];

// PRODUCTS/COLLECTIONS/SETTINGS are populated asynchronously from Supabase
// once the page loads (see the DOMContentLoaded handler near the bottom of
// this file). They start empty/default so nothing throws before that load
// finishes.
let PRODUCTS = [];
let COLLECTIONS = [];
let SETTINGS = DEFAULT_SETTINGS;

// BASE_PROFESSIONS is the built-in preset list (with icons). Admin can add
// further custom professions from the product form ("+ Add new profession")
// — those are saved as plain names in SETTINGS.customProfessions and merged
// in here with a generic icon. PROFESSIONS itself is a `let` (not `const`)
// so refreshProfessionsList() can recompute it once SETTINGS has loaded.
const BASE_PROFESSIONS = [
  {name:"Corporate",icon:"💼"},{name:"IT / Tech",icon:"💻"},{name:"Education",icon:"🎓"},
  {name:"Healthcare",icon:"🩺"},{name:"Retail",icon:"🛍️"},{name:"Hospitality",icon:"🏨"},
  {name:"Manufacturing",icon:"🏭"},{name:"Finance",icon:"📊"}
];
let PROFESSIONS = BASE_PROFESSIONS.slice();
function refreshProfessionsList(){
  const custom = (SETTINGS.customProfessions || []).filter(name =>
    name && !BASE_PROFESSIONS.some(p => p.name.toLowerCase() === name.toLowerCase())
  );
  PROFESSIONS = BASE_PROFESSIONS.concat(custom.map(name => ({name, icon:"🏷️"})));
}

// Admin can save a product as "draft" (e.g. mid-edit, not ready to show
// customers). Draft/Publish only ever hides a product from PUBLIC listing
// grids — the admin Products table always shows every product regardless
// of status, so this helper is only used in the public-facing render paths
// below, never applied to the shared PRODUCTS array itself.
function publishedProducts(){ return PRODUCTS.filter(p => (p.status||"published") === "published"); }

const money = n => "₹" + n.toLocaleString("en-IN");
function tierFor(p, qty){
  let applicable = p.tiers[0];
  for(const t of p.tiers){ if(qty >= t.min) applicable = t; }
  return applicable;
}
function ref(){ return "BZV-" + Math.random().toString(36).slice(2,6).toUpperCase() + Date.now().toString().slice(-4); }

/* ---------- broken image fallback ----------
   If a product's image link ever goes stale (expired Dropbox token, deleted
   file, etc.) a plain <img> just shows a blank/broken gap that's easy for a
   site visitor to miss. This swaps a failed image for a neutral inline-SVG
   "photo unavailable" placeholder so the gap is immediately visible instead
   of silently invisible — read-only, it never touches any stored data. */
const IMG_FALLBACK_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#f1f1ee"/>
    <g fill="none" stroke="#c7c7bd" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
      <rect x="70" y="110" width="260" height="190" rx="14"/>
      <circle cx="150" cy="170" r="22"/>
      <path d="M70 265l70-70 55 55 45-40 90 85"/>
    </g>
    <text x="200" y="335" font-family="Arial, sans-serif" font-size="20" fill="#9a9a90" text-anchor="middle">Photo unavailable</text>
  </svg>`
);
function imgFallback(el){
  if(!el || el.src === IMG_FALLBACK_SVG) return;
  el.src = IMG_FALLBACK_SVG;
  el.classList.add("img-fallback");
  el.alt = "Photo unavailable";
}
window.imgFallback = imgFallback;

/* ---------- product card ---------- */
function productCard(p){
  const t = tierFor(p, p.moq);
  return `<div class="pcard-wrap"><div class="pcard tilt">
    <span class="badge-stock ${p.stock?'in':'out'}">${p.stock?'In Stock':'Out of Stock'}</span>
    <a href="product.html?id=${p.id}"><div class="pimg"><img src="${p.img[0]}" alt="${p.name}" loading="lazy" onerror="imgFallback(this)"></div></a>
    <div class="pbody">
      <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
      <div class="pprice">${money(t.price)} <small>/ pc starting</small></div>
      <div class="pfoot">
        <span class="moqtag">MOQ ${p.moq} pcs</span>
        ${p.stock? `<a class="wa-mini" title="Quick WhatsApp enquiry" target="_blank" href="${waLink(p, p.bulk)}">🟢</a>` : `<a class="wa-mini" title="Check availability" target="_blank" href="${waLink(p, p.moq)}">🟢</a>`}
      </div>
    </div>
  </div></div>`;
}
function waLink(p, qty, printOpt){
  const t = tierFor(p, qty);
  const printLine = printOpt ? `%0APrinting option: ${printOpt}` : "";
  const msg = `Hi Bazarville! I'm interested in *${p.name}* (Ref: ${ref()}).%0AQuantity: ${qty} pcs%0AApplicable price: ${money(t.price)}/pc${printLine}%0APlease share more details.`;
  return `https://wa.me/${SETTINGS.whatsappNumber||"919999999999"}?text=${msg}`;
}

function renderGrid(target, list){
  const el = document.querySelector(target); if(!el) return;
  el.innerHTML = list.map(productCard).join("");
  attachTilt(el.querySelectorAll(".tilt"));
}

/* ---------- 3D tilt on mousemove ---------- */
function attachTilt(nodes){
  nodes.forEach(card=>{
    card.addEventListener("mousemove", e=>{
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left)/r.width - .5;
      const y = (e.clientY - r.top)/r.height - .5;
      const m = getTiltMult();
      card.style.transform = `rotateY(${x*4*m}deg) rotateX(${-y*4*m}deg) translateZ(4px)`;
    });
    card.addEventListener("mouseleave", ()=>{ card.style.transform = "rotateY(0) rotateX(0) translateZ(0)"; });
  });
}

/* ---------- collections ---------- */
function renderCollections(target, list=COLLECTIONS){
  const el = document.querySelector(target); if(!el) return;
  el.innerHTML = list.map(c=>`<a class="coll" href="collection.html?name=${encodeURIComponent(c.name)}"><img src="${c.img}" alt="${c.name}" loading="lazy"><div class="ov"><b>${c.name}</b><span>${c.tag}</span></div></a>`).join("");
}

/* ---------- filters (products.html) ---------- */
function initFilters(){
  const grid = document.querySelector("#productGrid");
  if(!grid) return;

  // Build the Profession chips / Purpose / Occasion dropdowns from the live
  // taxonomy (PROFESSIONS + SETTINGS.purposes/occasions) instead of the
  // static placeholder options in products.html — so anything an admin adds
  // from the product form ("+ Add new purpose/occasion/profession") shows up
  // here automatically, with no HTML edits needed.
  const chipRow = document.querySelector(".chiprow");
  if(chipRow){
    chipRow.innerHTML = `<span class="fchip active" data-profession="All">All</span>` +
      PROFESSIONS.map(pr=>`<span class="fchip" data-profession="${pr.name}">${pr.name}</span>`).join("");
  }
  const purposeSelectEl = document.querySelector("#purposeSelect");
  if(purposeSelectEl){
    purposeSelectEl.innerHTML = `<option value="All">All purposes</option>` +
      (SETTINGS.purposes||DEFAULT_PURPOSES).map(v=>`<option value="${v}">${v}</option>`).join("");
  }
  const occasionSelectEl = document.querySelector("#occasionSelect");
  if(occasionSelectEl){
    occasionSelectEl.innerHTML = `<option value="All">All occasions</option>` +
      (SETTINGS.occasions||DEFAULT_OCCASIONS).map(v=>`<option value="${v}">${v}</option>`).join("");
  }

  const state = {profession:"All",purpose:"All",occasion:"All",qty:1,sort:"relevance",q:""};
  const params = new URLSearchParams(location.search);
  if(params.get("profession")) state.profession = params.get("profession");
  if(params.get("cat")) state.cat = params.get("cat");
  if(params.get("purpose")) state.purpose = params.get("purpose");
  if(params.get("occasion")) state.occasion = params.get("occasion");
  if(params.get("q")) state.q = params.get("q").trim();

  function apply(){
    let list = publishedProducts();
    if(state.cat) list = list.filter(p=>p.cat===state.cat);
    if(state.profession && state.profession!=="All") list = list.filter(p=>p.profession===state.profession);
    if(state.purpose && state.purpose!=="All") list = list.filter(p=>p.purpose===state.purpose);
    if(state.occasion && state.occasion!=="All") list = list.filter(p=>p.occasion===state.occasion);
    if(state.q){
      const needle = state.q.toLowerCase();
      list = list.filter(p=>{
        const haystacks = [p.name, p.cat, p.profession, ...(p.professions||[])];
        return haystacks.some(h=>h && h.toLowerCase().includes(needle));
      });
    }
    if(state.qty>1){
      list = list.filter(p=> tierFor(p, state.qty).price*state.qty <= (state.budget||999999));
    }
    if(state.sort==="price-asc") list.sort((a,b)=>tierFor(a,a.moq).price-tierFor(b,b.moq).price);
    if(state.sort==="price-desc") list.sort((a,b)=>tierFor(b,b.moq).price-tierFor(a,a.moq).price);
    if(state.sort==="moq-asc") list.sort((a,b)=>a.moq-b.moq);
    if(state.sort==="newest") list.sort((a,b)=>b.id-a.id);
    document.querySelector("#resultCount").textContent = list.length + " products";
    renderGrid("#productGrid", list);
  }

  document.querySelectorAll("[data-profession]").forEach(chip=>chip.addEventListener("click",()=>{
    document.querySelectorAll("[data-profession]").forEach(c=>c.classList.remove("active"));
    chip.classList.add("active"); state.profession = chip.dataset.profession; apply();
  }));
  const purposeSel = document.querySelector("#purposeSelect");
  if(purposeSel) purposeSel.addEventListener("change",()=>{ state.purpose = purposeSel.value; apply(); });
  const occasionSel = document.querySelector("#occasionSelect");
  if(occasionSel) occasionSel.addEventListener("change",()=>{ state.occasion = occasionSel.value; apply(); });
  const sortSel = document.querySelector("#sortSelect");
  if(sortSel) sortSel.addEventListener("change",()=>{ state.sort = sortSel.value; apply(); });
  const qtyInput = document.querySelector("#qtyFilter");
  const budgetInput = document.querySelector("#budgetFilter");
  if(qtyInput) qtyInput.addEventListener("input",()=>{ state.qty = Number(qtyInput.value)||1; apply(); });
  if(budgetInput) budgetInput.addEventListener("input",()=>{ state.budget = Number(budgetInput.value)||999999; apply(); });

  if(state.profession!=="All"){
    const activeChip = document.querySelector(`[data-profession="${state.profession}"]`);
    if(activeChip){ document.querySelectorAll("[data-profession]").forEach(c=>c.classList.remove("active")); activeChip.classList.add("active"); }
  }
  if(purposeSel && state.purpose) purposeSel.value = state.purpose;
  if(occasionSel && state.occasion) occasionSel.value = state.occasion;
  apply();

  const filterToggle = document.querySelector(".filter-toggle");
  const filtersPanel = document.querySelector(".filters");
  if(filterToggle && filtersPanel) filterToggle.addEventListener("click",()=>filtersPanel.classList.toggle("open"));
}

/* ---------- navbar search (present on every page's header) ----------
   Clicking the ⌕ button reveals an inline search input; Enter (or blur with
   text still in it) sends the visitor to products.html?q=... which
   initFilters() above reads and filters by on name/category/profession. On
   products.html itself it just re-runs the filter in place instead of
   reloading the page. */
function initNavSearch(){
  const btn = document.querySelector("#navSearchBtn");
  const input = document.querySelector("#navSearchInput");
  if(!btn || !input) return;

  const onProductsPage = /products\.html$/.test(location.pathname) || document.querySelector("#productGrid");
  const params = new URLSearchParams(location.search);
  const qParam = params.get("q");
  if(qParam){ input.value = qParam; input.classList.add("open"); }

  function openAndFocus(){
    input.classList.add("open");
    input.focus();
  }
  function runSearch(){
    const q = input.value.trim();
    if(!q) return;
    if(onProductsPage){
      // Already on the products listing — update the URL in place and reload
      // it so initFilters() re-runs and picks the new ?q= term up.
      const url = new URL(location.href);
      url.searchParams.set("q", q);
      location.href = url.toString();
    }else{
      location.href = "products.html?q=" + encodeURIComponent(q);
    }
  }

  btn.addEventListener("click", ()=>{
    if(!input.classList.contains("open")) openAndFocus();
    else runSearch();
  });
  input.addEventListener("keydown", (e)=>{
    if(e.key === "Enter"){ e.preventDefault(); runSearch(); }
    else if(e.key === "Escape"){ input.value=""; input.classList.remove("open"); input.blur(); }
  });
  input.addEventListener("blur", ()=>{
    if(!input.value.trim()) input.classList.remove("open");
  });
}

/* ---------- per-product SEO: <title>/meta description + JSON-LD Product schema.
   The JSON-LD block is what lets AI answer engines (and Google's rich results)
   read the price/availability/name correctly instead of guessing from prose. */
function applyProductSeo(p){
  const title = p.metaTitle || `${p.name} | Bazarville`;
  const desc = p.metaDescription || `${p.name} — bulk & corporate gifting from Bazarville. MOQ ${p.moq} pcs, quantity-based pricing, structured WhatsApp enquiry.`;
  document.title = title;
  let metaDesc = document.querySelector('meta[name="description"]');
  if(!metaDesc){ metaDesc = document.createElement("meta"); metaDesc.name = "description"; document.head.appendChild(metaDesc); }
  metaDesc.setAttribute("content", desc);

  let ld = document.querySelector('script[type="application/ld+json"]#pd-jsonld');
  if(!ld){ ld = document.createElement("script"); ld.type = "application/ld+json"; ld.id = "pd-jsonld"; document.head.appendChild(ld); }
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: desc,
    image: p.img,
    category: p.cat,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: Math.min(...p.tiers.map(t=>t.price)),
      highPrice: Math.max(...p.tiers.map(t=>t.price)),
      availability: p.stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  });
}

/* ---------- cart (localStorage — no backend needed until checkout) ---------- */
const CART_KEY = "bzv_cart";
function getCart(){ try{ return JSON.parse(localStorage.getItem(CART_KEY))||[]; }catch(e){ return []; } }
function setCart(items){
  try{ localStorage.setItem(CART_KEY, JSON.stringify(items)); }catch(e){ /* private browsing etc — cart just won't persist */ }
  renderCartBadge();
}
function addToCart(item){
  const cart = getCart();
  const existing = cart.find(c=>c.productId===item.productId && c.color===item.color && c.size===item.size && c.printOption===item.printOption);
  if(existing) existing.qty += item.qty; else cart.push(item);
  setCart(cart);
}
function updateCartQty(idx, qty){ const cart=getCart(); if(cart[idx]){ cart[idx].qty = Math.max(1, qty); setCart(cart); } }
function removeFromCart(idx){ const cart=getCart(); cart.splice(idx,1); setCart(cart); }
function cartCount(){ return getCart().reduce((s,c)=>s+c.qty,0); }
function cartSubtotal(){ return getCart().reduce((s,c)=>s+c.qty*c.price,0); }
function renderCartBadge(){
  document.querySelectorAll(".navactions").forEach(nav=>{
    let cartEl = nav.querySelector(".cartbtn");
    if(!cartEl){
      cartEl = document.createElement("a");
      cartEl.href = "cart.html"; cartEl.className = "cartbtn"; cartEl.title = "Cart";
      cartEl.innerHTML = `🛒<span class="cart-count"></span>`;
      nav.insertBefore(cartEl, nav.firstChild);
    }
    let acctEl = nav.querySelector(".accountbtn");
    if(!acctEl){
      acctEl = document.createElement("a");
      acctEl.href = "account.html"; acctEl.className = "accountbtn"; acctEl.title = "My Account";
      acctEl.textContent = "👤";
      nav.insertBefore(acctEl, cartEl);
    }
    const count = cartCount();
    const badge = cartEl.querySelector(".cart-count");
    badge.textContent = count>0 ? count : "";
    badge.style.display = count>0 ? "flex" : "none";
  });
}
function initCartPage(){
  const el = document.querySelector("#cart-root");
  if(!el) return;
  function render(){
    const cart = getCart();
    if(!cart.length){
      el.innerHTML = `<div class="empty-cart"><p>Your cart is empty.</p><a class="btn btn-lime" href="products.html">Browse Catalogue</a></div>`;
      return;
    }
    el.innerHTML = `
      <div class="cart-rows">${cart.map((c,i)=>`
        <div class="cart-row">
          <img src="${c.img}" alt="${c.name}">
          <div class="cart-row-info">
            <b>${c.name}</b>
            <span class="cart-row-meta">${[c.color,c.size,c.printOption].filter(Boolean).join(" • ")}</span>
            <span class="cart-row-price">${money(c.price)} / pc</span>
          </div>
          <div class="qtybox"><button data-act="minus" data-i="${i}">−</button><input type="number" value="${c.qty}" data-i="${i}" min="1"><button data-act="plus" data-i="${i}">+</button></div>
          <button class="ad-icon-btn danger cart-remove" data-i="${i}">✕</button>
        </div>`).join("")}</div>
      <div class="cart-summary">
        <div class="cart-total-row"><span>Subtotal (${cartCount()} pcs)</span><b>${money(cartSubtotal())}</b></div>
        <p class="ad-hint">Final pricing may adjust to quantity-tier rates at checkout.</p>
        <a class="btn btn-lime" style="width:100%" href="checkout.html">Proceed to Checkout →</a>
      </div>`;
    el.querySelectorAll("[data-act='minus']").forEach(b=>b.addEventListener("click",()=>{ const i=+b.dataset.i; updateCartQty(i, getCart()[i].qty-1); render(); }));
    el.querySelectorAll("[data-act='plus']").forEach(b=>b.addEventListener("click",()=>{ const i=+b.dataset.i; updateCartQty(i, getCart()[i].qty+1); render(); }));
    el.querySelectorAll(".cart-row input[type=number]").forEach(inp=>inp.addEventListener("change",()=>{ updateCartQty(+inp.dataset.i, Number(inp.value)||1); render(); }));
    el.querySelectorAll(".cart-remove").forEach(b=>b.addEventListener("click",()=>{ removeFromCart(+b.dataset.i); render(); }));
  }
  render();
}
function initCheckoutPage(){
  const form = document.querySelector("#checkoutForm");
  if(!form) return;
  const cart = getCart();
  const summaryEl = document.querySelector("#checkoutSummary");
  if(!cart.length){
    document.querySelector("#checkoutRoot").innerHTML = `<p>Your cart is empty. <a href="products.html">Browse the catalogue</a> first.</p>`;
    return;
  }
  if(summaryEl) summaryEl.innerHTML = `
    ${cart.map(c=>`<div class="checkout-line"><span>${c.name} × ${c.qty}</span><span>${money(c.qty*c.price)}</span></div>`).join("")}
    <div class="checkout-line total"><span>Total</span><span>${money(cartSubtotal())}</span></div>`;

  BazDS.getCurrentCustomer().then(cust=>{
    if(cust){
      document.querySelector("#co_name").value = cust.full_name || "";
      document.querySelector("#co_phone").value = cust.phone || "";
      document.querySelector("#co_email").value = cust.email || "";
    }
  }).catch(()=>{});

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Placing order…";
    try{
      const order = await BazDS.createOrder({
        customerName: document.querySelector("#co_name").value.trim(),
        customerPhone: document.querySelector("#co_phone").value.trim(),
        customerEmail: document.querySelector("#co_email").value.trim(),
        shippingAddress: document.querySelector("#co_address").value.trim(),
        paymentMethod: document.querySelector("input[name=paymethod]:checked").value,
        items: cart.map(c=>({productId:c.productId,name:c.name,qty:c.qty,price:c.price,color:c.color,size:c.size,printOption:c.printOption})),
        subtotal: cartSubtotal()
      });
      setCart([]);
      location.href = "order-confirmation.html?ref=" + encodeURIComponent(order.ref);
    }catch(err){
      alert("Could not place order: " + (err.message||"please try again."));
      btn.disabled = false; btn.textContent = "Place Order";
    }
  });
}
function initOrderConfirmPage(){
  const el = document.querySelector("#orderConfirmRoot");
  if(!el) return;
  const ref = new URLSearchParams(location.search).get("ref");
  el.querySelector("#ocRef").textContent = ref || "—";
}

/* ---------- customer account: signup/login + order & quote history ---------- */
function initAccountPage(){
  const root = document.querySelector("#account-root");
  if(!root) return;

  // Small inline SVGs for the redesigned auth form's input icons — no
  // external requests, purely decorative (aria-hidden).
  const ACCT_ICONS = {
    user: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 19.5c1.6-3.4 4.4-5 7.5-5s5.9 1.6 7.5 5"/></svg>',
    building: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="3" width="11" height="18"/><path d="M9 21v-4h2v4M8 7h1M8 11h1M11 7h1M11 11h1M15 10h5v11h-5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5l1.5-2 4 1.5v3c0 1-.9 1.8-1.9 1.6C11.7 18.7 5.3 12.3 4.4 5.4 4.2 4.4 5 3.5 6 3.5Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4.5 7l7.5 6 7.5-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>'
  };
  function acctField(label, icon, inputHtml){
    return `<div class="ad-field acct-input-group"><label>${label}</label><div class="acct-input-wrap">${ACCT_ICONS[icon]}${inputHtml}</div></div>`;
  }

  async function renderLoggedIn(cust){
    const [orders, allQuotes] = await Promise.all([
      BazDS.getOrders().catch(()=>[]),
      BazDS.getQuotes().catch(()=>[]) // RLS limits this to the customer's own quotes/orders automatically
    ]);
    root.innerHTML = `
      <div class="acct-header"><div><h2>Hi, ${cust.full_name || cust.email}</h2><p class="ad-hint">${cust.company_name||"No company name on file"}</p></div>
        <button class="btn btn-outline btn-sm" id="acctLogoutBtn">Log Out</button></div>
      <div class="ad-panel"><h3>Your details</h3>
        <div class="ad-form-grid">
          <div class="ad-field"><label>Full name</label><input id="acct_name" value="${cust.full_name||''}"></div>
          <div class="ad-field"><label>Company</label><input id="acct_company" value="${cust.company_name||''}"></div>
          <div class="ad-field"><label>Phone</label><input id="acct_phone" value="${cust.phone||''}"></div>
          <div class="ad-field"><label>GSTIN (optional)</label><input id="acct_gstin" value="${cust.gstin||''}"></div>
        </div>
        <button class="btn btn-primary btn-sm" id="acctSaveBtn" style="margin-top:10px">Save</button>
      </div>
      <div class="ad-panel"><h3>Your orders</h3>
        ${orders.length? `<div class="ad-table-wrap"><table class="ad-table"><tr><th>Ref</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr>
          ${orders.map(o=>`<tr><td>${o.ref}</td><td>${(o.items||[]).length} item(s)</td><td>${money(o.subtotal)}</td><td><span class="ad-badge in">${o.status}</span></td><td>${new Date(o.created_at).toLocaleDateString()}</td></tr>`).join("")}
        </table></div>` : `<p class="ad-hint">No orders yet.</p>`}
      </div>
      <div class="ad-panel"><h3>Quotes sent to you</h3>
        ${allQuotes.length? `<div class="ad-table-wrap"><table class="ad-table"><tr><th>Ref</th><th>Total</th><th>Status</th><th>Valid until</th><th></th></tr>
          ${allQuotes.map(q=>`<tr><td>${q.ref}</td><td>${money(q.subtotal)}</td><td><span class="ad-badge in">${q.status}</span></td><td>${q.valid_until||'—'}</td><td><a href="quote.html?ref=${q.ref}" target="_blank">View →</a></td></tr>`).join("")}
        </table></div>` : `<p class="ad-hint">No quotes yet.</p>`}
      </div>`;
    root.querySelector("#acctLogoutBtn").addEventListener("click", async ()=>{ await BazDS.customerSignOut(); location.reload(); });
    root.querySelector("#acctSaveBtn").addEventListener("click", async (e)=>{
      const btn = e.target; btn.disabled = true; btn.textContent = "Saving…";
      try{
        await BazDS.updateCustomer(cust.id, {
          fullName: root.querySelector("#acct_name").value.trim(),
          companyName: root.querySelector("#acct_company").value.trim(),
          phone: root.querySelector("#acct_phone").value.trim(),
          gstin: root.querySelector("#acct_gstin").value.trim()
        });
        btn.textContent = "Saved ✓";
      }catch(err){ alert("Could not save: "+err.message); btn.textContent = "Save"; }
      finally{ btn.disabled = false; }
    });
  }

  function renderLoggedOut(){
    root.innerHTML = `
      <div class="acct-card">
        <div class="acct-visual">
          <div class="acct-visual-badge"><img src="assets/logo.png" alt=""></div>
          <h3>Welcome to Bazarville</h3>
          <p>Track orders, revisit quotes and check out faster next time — all in one place.</p>
          <ul class="acct-visual-points">
            <li>Order history &amp; live status</li>
            <li>Quotes sent straight to you</li>
            <li>Faster checkout, saved details</li>
          </ul>
        </div>
        <div class="acct-panel">
          <div class="acct-tabs">
            <button class="acct-tab active" data-tab="login">Log In</button>
            <button class="acct-tab" data-tab="signup">Create Account</button>
          </div>
          <div class="acct-form" id="loginForm">
            ${acctField("Email", "email", `<input id="li_email" type="email" placeholder="you@company.com">`)}
            ${acctField("Password", "lock", `<input id="li_password" type="password" placeholder="••••••••">`)}
            <button class="btn btn-lime" id="loginSubmit" style="width:100%">Log In</button>
            <p class="ad-hint" id="loginError"></p>
          </div>
          <div class="acct-form" id="signupForm" style="display:none">
            ${acctField("Full name", "user", `<input id="su_name" placeholder="Your name">`)}
            ${acctField("Company name (optional)", "building", `<input id="su_company" placeholder="Company / organisation">`)}
            ${acctField("Phone", "phone", `<input id="su_phone" placeholder="10-digit mobile">`)}
            ${acctField("Email", "email", `<input id="su_email" type="email" placeholder="you@company.com">`)}
            ${acctField("Password", "lock", `<input id="su_password" type="password" placeholder="Create a password">`)}
            <button class="btn btn-lime" id="signupSubmit" style="width:100%">Create Account</button>
            <p class="ad-hint" id="signupError"></p>
          </div>
        </div>
      </div>`;
    root.querySelectorAll(".acct-tab").forEach(tab=>tab.addEventListener("click",()=>{
      root.querySelectorAll(".acct-tab").forEach(t=>t.classList.remove("active")); tab.classList.add("active");
      root.querySelector("#loginForm").style.display = tab.dataset.tab==="login" ? "block" : "none";
      root.querySelector("#signupForm").style.display = tab.dataset.tab==="signup" ? "block" : "none";
    }));
    root.querySelector("#loginSubmit").addEventListener("click", async ()=>{
      const errEl = root.querySelector("#loginError");
      try{
        await BazDS.customerSignIn(root.querySelector("#li_email").value.trim(), root.querySelector("#li_password").value);
        location.reload();
      }catch(err){ errEl.textContent = err.message||"Could not log in."; }
    });
    root.querySelector("#signupSubmit").addEventListener("click", async ()=>{
      const errEl = root.querySelector("#signupError");
      try{
        await BazDS.customerSignUp({
          email: root.querySelector("#su_email").value.trim(),
          password: root.querySelector("#su_password").value,
          fullName: root.querySelector("#su_name").value.trim(),
          companyName: root.querySelector("#su_company").value.trim(),
          phone: root.querySelector("#su_phone").value.trim()
        });
        errEl.style.color = "#5b8a00";
        errEl.textContent = "Account created — check your email to confirm, then log in.";
      }catch(err){ errEl.textContent = err.message||"Could not create account."; }
    });
  }

  BazDS.getCurrentCustomer().then(cust => cust ? renderLoggedIn(cust) : renderLoggedOut());
}

/* ---------- public quote view (quote.html?ref=...) ---------- */
function initQuotePage(){
  const el = document.querySelector("#quote-root");
  if(!el) return;
  const ref = new URLSearchParams(location.search).get("ref");
  if(!ref){ el.innerHTML = `<p>No quote reference given.</p>`; return; }
  BazDS.getQuoteByRef(ref).then(q=>{
    if(!q){ el.innerHTML = `<p>Quote not found. Double-check the link, or contact Bazarville.</p>`; return; }
    el.innerHTML = `
      <div class="quote-head"><h2>Quotation ${q.ref}</h2><span class="ad-badge in">${q.status}</span></div>
      <p class="ad-hint">Prepared for ${q.customer_name}${q.customer_company? ' • '+q.customer_company:''}${q.valid_until? ' • Valid until '+q.valid_until:''}</p>
      <div class="ad-table-wrap"><table class="ad-table"><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        ${(q.items||[]).map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.qty*i.price)}</td></tr>`).join("")}
      </table></div>
      <div class="quote-total">Subtotal: <b>${money(q.subtotal)}</b></div>
      ${q.notes? `<p class="ad-hint">${q.notes}</p>`:""}
      <a class="btn btn-wa" style="margin-top:16px" target="_blank" href="https://wa.me/${SETTINGS.whatsappNumber||'919999999999'}?text=${encodeURIComponent('Hi Bazarville! I accept Quote '+q.ref+' for '+money(q.subtotal)+'. Please proceed.')}">🟢 Accept via WhatsApp</a>`;
  });
}

/* ---------- product detail page ---------- */
function initProductPage(){
  const el = document.querySelector("#pd-root");
  if(!el) return;
  const id = Number(new URLSearchParams(location.search).get("id")) || PRODUCTS[0].id;
  const p = PRODUCTS.find(x=>x.id===id) || PRODUCTS[0];
  applyProductSeo(p);

  el.innerHTML = `
    <div class="pd-layout">
      <div class="reveal-left">
        <div class="pd-gallery-main"><img id="mainImg" src="${p.img[0]}" alt="${p.name}" onerror="imgFallback(this)"></div>
        <div class="pd-thumbs">${p.img.map((src,i)=>`<img src="${src}" class="${i===0?'active':''}" data-src="${src}" onerror="imgFallback(this)">`).join("")}</div>
      </div>
      <div class="reveal-right">
        <span class="pd-cat">${p.profession}</span>
        <h1 class="pd-title">${p.name}</h1>
        <div class="pd-rating">★★★★★ 4.7 (${18+p.id} reviews) &nbsp;•&nbsp; ${p.stock? '<b style="color:#5b8a00">In Stock</b>' : '<b style="color:#c0392b">Out of Stock</b>'}</div>
        <div class="pd-price-box">
          <div class="pd-price" id="livePrice">${money(tierFor(p,p.moq).price)} <span>/ piece</span></div>
          <table class="tier-table" id="tierTable"><tr><th>Quantity</th><th>Price / pc</th></tr>
          ${p.tiers.map(t=>`<tr data-min="${t.min}"><td>${t.min}+ pcs</td><td>${money(t.price)}</td></tr>`).join("")}
          </table>
        </div>
        <div class="opt-title">Colour</div>
        <div class="swatches">${p.colors.map((c,i)=>`<span class="swatch ${i===0?'active':''}" style="background:${c}" data-c="${i}"></span>`).join("")}</div>
        <div class="opt-title">Size</div>
        <div class="sizerow">${p.sizes.map((s,i)=>`<span class="sizebtn ${i===0?'active':''}" data-s="${i}">${s}</span>`).join("")}</div>
        ${(p.printOptions&&p.printOptions.length)?`<div class="opt-title">Printing Option</div>
        <div class="sizerow" id="printOptRow">${p.printOptions.map((s,i)=>`<span class="sizebtn ${i===0?'active':''}" data-p="${i}">${s}</span>`).join("")}</div>`:""}
        <div class="opt-title">Quantity</div>
        <div class="qtybox"><button id="qMinus">−</button><input id="qtyInput" type="number" value="${p.moq}" min="1"><button id="qPlus">+</button></div>
        <div class="livecalc" id="liveCalc"></div>
        <div class="threshold-msg" id="thresholdMsg"></div>
        <div style="display:flex;gap:12px;margin-top:18px;flex-wrap:wrap">
          <button id="addToCartBtn" class="btn btn-primary" type="button">🛒 Add to Cart</button>
          <a id="waBtn" class="btn btn-wa" target="_blank" href="#">🟢 Send WhatsApp Enquiry</a>
        </div>
        <p class="ad-hint" id="cartAddedMsg" style="display:none;color:#5b8a00;font-weight:700">✓ Added to cart</p>
        <div class="pd-specs">
          <div class="pd-spec"><span>Customization</span><span>Logo / Branding available</span></div>
          <div class="pd-spec"><span>MOQ</span><span>${p.moq} pcs</span></div>
          <div class="pd-spec"><span>Bulk enquiry from</span><span>${p.bulk} pcs</span></div>
          <div class="pd-spec"><span>GST</span><span>Exclusive</span></div>
          <div class="pd-spec"><span>Suitable for</span><span>${p.purpose} • ${p.occasion}</span></div>
        </div>
      </div>
    </div>`;

  document.querySelectorAll(".pd-thumbs img").forEach(t=>t.addEventListener("click",()=>{
    document.querySelectorAll(".pd-thumbs img").forEach(x=>x.classList.remove("active"));
    t.classList.add("active"); document.querySelector("#mainImg").src = t.dataset.src;
  }));
  document.querySelectorAll(".swatch").forEach(s=>s.addEventListener("click",()=>{
    document.querySelectorAll(".swatch").forEach(x=>x.classList.remove("active")); s.classList.add("active");
  }));
  document.querySelectorAll("#printOptRow .sizebtn").forEach(s=>s.addEventListener("click",()=>{
    document.querySelectorAll("#printOptRow .sizebtn").forEach(x=>x.classList.remove("active")); s.classList.add("active");
  }));
  document.querySelectorAll(".sizerow:not(#printOptRow) .sizebtn").forEach(s=>s.addEventListener("click",()=>{
    document.querySelectorAll(".sizerow:not(#printOptRow) .sizebtn").forEach(x=>x.classList.remove("active")); s.classList.add("active");
  }));

  const qtyInput = document.querySelector("#qtyInput");
  function recalc(){
    let qty = Math.max(1, Number(qtyInput.value)||1);
    qtyInput.value = qty;
    const t = tierFor(p, qty);
    document.querySelector("#livePrice").innerHTML = `${money(t.price)} <span>/ piece</span>`;
    document.querySelector("#liveCalc").innerHTML = `${qty} pcs × ${money(t.price)} = <b>${money(qty*t.price)}</b> <span style="color:var(--muted)">(estimated, excl. GST)</span>`;
    document.querySelectorAll("#tierTable tr[data-min]").forEach(row=>{
      row.classList.toggle("active-tier", Number(row.dataset.min)===t.min);
    });
    const msgEl = document.querySelector("#thresholdMsg");
    const waBtn = document.querySelector("#waBtn");
    if(qty < p.bulk){
      msgEl.textContent = `Bulk enquiries start from ${p.bulk} pieces — increase quantity to unlock bulk pricing support.`;
    } else { msgEl.textContent = `✓ Bulk enquiry unlocked for this quantity.`; }
    const printOptEl = document.querySelector("#printOptRow .sizebtn.active");
    waBtn.href = waLink(p, qty, printOptEl ? printOptEl.textContent : "");
    waBtn.textContent = p.stock ? "🟢 Send WhatsApp Enquiry" : "🟢 Check Availability on WhatsApp";
  }
  document.querySelector("#qMinus").addEventListener("click",()=>{ qtyInput.value = Math.max(1,(Number(qtyInput.value)||1)-5); recalc(); });
  document.querySelector("#qPlus").addEventListener("click",()=>{ qtyInput.value = (Number(qtyInput.value)||1)+5; recalc(); });
  qtyInput.addEventListener("input", recalc);
  recalc();

  document.querySelector("#addToCartBtn").addEventListener("click", ()=>{
    const qty = Math.max(1, Number(qtyInput.value)||1);
    const t = tierFor(p, qty);
    const colorEl = document.querySelector(".swatches .swatch.active");
    const sizeEl = document.querySelector(".sizerow:not(#printOptRow) .sizebtn.active");
    const printEl = document.querySelector("#printOptRow .sizebtn.active");
    // colorEl.dataset.c holds the swatch's INDEX into p.colors (see the swatches
    // render above), not the hex value itself — look the real colour up by index
    // so the cart stores/shows the actual colour, not a stray "0"/"1".
    const colorVal = colorEl ? (p.colors[Number(colorEl.dataset.c)] || "") : "";
    addToCart({
      productId: p.id, name: p.name, img: p.img[0], qty, price: t.price,
      color: colorVal, size: sizeEl ? sizeEl.textContent : "",
      printOption: printEl ? printEl.textContent : ""
    });
    const msg = document.querySelector("#cartAddedMsg");
    msg.style.display = "block";
    setTimeout(()=>{ msg.style.display = "none"; }, 2000);
  });

  // similar products
  const similar = publishedProducts().filter(x=>x.cat===p.cat && x.id!==p.id).slice(0,4);
  const simEl = document.querySelector("#similarGrid");
  if(simEl) renderGrid("#similarGrid", similar.length? similar : publishedProducts().filter(x=>x.id!==p.id).slice(0,4));
}

/* ---------- galaxy page ---------- */
function initGalaxy(){
  const stage = document.querySelector("#galaxyStage");
  if(!stage) return;
  const scene = stage.querySelector(".orbit-scene");
  const ringMap = [
    {ring:".ring1", items:PROFESSIONS.slice(0,3), speed:0.10},
    {ring:".ring2", items:PROFESSIONS.slice(3,6), speed:-0.065},
    {ring:".ring3", items:PROFESSIONS.slice(6,8), speed:0.045}
  ];
  const colors = ["#7a9900","#c6f000","#4d6600","#9fc400"];
  const placed = []; // {el, ringEl, angle (radians), speed}

  ringMap.forEach(group=>{
    const ringEl = stage.querySelector(group.ring);
    group.items.forEach((prof,i)=>{
      const angle = (Math.PI*2/group.items.length)*i;
      const planet = document.createElement("div");
      planet.className = "planet";
      planet.style.background = colors[i%colors.length];
      planet.innerHTML = `<span>${prof.icon}</span><span class="planet-label">${prof.name}</span>`;
      planet.addEventListener("click", ()=>showProfession(prof));
      scene.appendChild(planet);
      placed.push({el:planet, ringEl, angle, speed:group.speed});
    });
  });

  // Plain 2D ellipse motion, animated with requestAnimationFrame — no CSS 3D
  // transforms involved anywhere, so it renders identically (and reliably)
  // on every browser/GPU instead of depending on nested perspective/preserve-3d,
  // which is what produced the washed-out/streaking artifacts before.
  let rx = {}, ry = {};
  function measure(){
    placed.forEach(p=>{
      if(!rx[p.ringEl.className]){
        const r = p.ringEl.getBoundingClientRect();
        rx[p.ringEl.className] = r.width/2;
        ry[p.ringEl.className] = r.height/2;
      }
    });
  }
  function remeasure(){ rx = {}; ry = {}; measure(); }
  measure();

  let last = performance.now();
  function tick(now){
    const dt = Math.min(64, now-last)/1000; last = now;
    placed.forEach(p=>{
      p.angle += p.speed*dt;
      const a = rx[p.ringEl.className], b = ry[p.ringEl.className];
      const x = a*Math.cos(p.angle), y = b*Math.sin(p.angle);
      p.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
      // subtle depth cue: planets toward the "front" (lower half) sit above the
      // sun and read slightly larger; ones toward the "back" tuck behind it
      const depth = (y/b + 1)/2; // 0 (back) .. 1 (front)
      p.el.style.zIndex = y > 0 ? 6 : 4;
      p.el.style.opacity = 0.94 + depth*0.06;
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  let resizeT;
  window.addEventListener("resize", ()=>{ clearTimeout(resizeT); resizeT = setTimeout(remeasure, 150); });

  // Plain, reliable mobile list — rendered unconditionally (cheap) and shown
  // instead of the 3D stage below the 700px breakpoint via CSS, so there is
  // no 3D-transform math involved on small screens at all.
  const mobileListEl = document.querySelector("#galaxyMobileList");
  if(mobileListEl){
    mobileListEl.innerHTML = PROFESSIONS.map(prof=>{
      const count = publishedProducts().filter(p=>p.profession===prof.name).length;
      const countLabel = count > 0 ? `${count} products` : "Explore products";
      return `<a class="gm-card" href="products.html?profession=${encodeURIComponent(prof.name)}">
        <div class="gm-icon">${prof.icon}</div><div><b>${prof.name}</b><span>${countLabel}</span></div></a>`;
    }).join("");
  }

  function showProfession(prof){
    const panel = document.querySelector("#galaxyPanel");
    const count = publishedProducts().filter(p=>p.profession===prof.name).length;
    panel.innerHTML = `<h3>${prof.icon} ${prof.name}</h3><p>${count>0 ? count+" curated products mapped to "+prof.name+" teams" : "Products for "+prof.name+" teams are being catalogued"} — from onboarding kits to client gifting essentials.</p>
      <a class="btn btn-lime" style="margin-top:14px" href="products.html?profession=${encodeURIComponent(prof.name)}">Explore ${prof.name} products →</a>`;
    panel.classList.add("show");
  }
}

/* (dark mode removed per client feedback — light theme only) */

/* ---------- generic scroll reveal ---------- */
function initReveal(){
  const targets = document.querySelectorAll(".reveal, .reveal-zoom, .reveal-left, .reveal-right");
  if(!targets.length || !("IntersectionObserver" in window)) { targets.forEach(t=>t.classList.add("in")); return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
  }, {threshold:.15, rootMargin:"0px 0px -60px 0px"});
  targets.forEach(t=>io.observe(t));
  // safety net: never leave content hidden indefinitely
  setTimeout(()=>{ targets.forEach(t=>t.classList.add("in")); }, 4000);
}

/* ---------- count-up stat numbers ---------- */
function initCounters(){
  const nums = document.querySelectorAll(".counter-num[data-target]");
  if(!nums.length || !("IntersectionObserver" in window)) return;
  const animate = (el)=>{
    const target = Number(el.dataset.target);
    const suffix = el.dataset.suffix || "";
    let cur = 0; const step = Math.max(1, Math.ceil(target/60));
    const t = setInterval(()=>{
      cur += step;
      if(cur >= target){ cur = target; clearInterval(t); }
      el.textContent = cur.toLocaleString("en-IN") + suffix;
    }, 22);
  };
  const done = new Set();
  const runOnce = (el)=>{ if(done.has(el)) return; done.add(el); animate(el); };
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ runOnce(e.target); io.unobserve(e.target); } });
  }, {threshold:.6});
  nums.forEach(n=>io.observe(n));
  // safety net: if a counter never crosses the visibility threshold (e.g. landed on via
  // an anchor jump), make sure it still shows its final value rather than staying at 0
  setTimeout(()=>{ nums.forEach(n=>{ if(!done.has(n)){ done.add(n); n.textContent = Number(n.dataset.target).toLocaleString("en-IN") + (n.dataset.suffix||""); } }); }, 4500);
}

/* ---------- parallax hero blobs (scroll) ---------- */
function initParallax(){
  const layers = document.querySelectorAll(".parallax-layer");
  if(!layers.length) return;
  window.addEventListener("scroll", ()=>{
    const y = window.scrollY;
    layers.forEach(l=>{
      const speed = Number(l.dataset.speed || 0.15);
      l.style.transform = `translateY(${y*speed}px)`;
    });
  }, {passive:true});
}

/* ---------- hero 3D mouse-tilt (cursor-driven depth) ---------- */
function initHeroTilt(){
  const hero = document.querySelector(".hero");
  const stack = document.querySelector(".hero-stack");
  if(!hero || !stack || window.matchMedia("(pointer: coarse)").matches) return; // skip on touch devices
  hero.addEventListener("mousemove", (e)=>{
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    const m = getTiltMult();
    stack.style.transform = `rotateY(${x*16*m}deg) rotateX(${-y*12*m}deg)`;
  });
  hero.addEventListener("mouseleave", ()=>{ stack.style.transform = "rotateY(0deg) rotateX(0deg)"; });
}

/* ---------- FAQ accordion ---------- */
function initFaq(){
  document.querySelectorAll(".faqitem").forEach(item=>{
    item.querySelector(".faqq").addEventListener("click", ()=>{
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faqitem").forEach(i=>i.classList.remove("open"));
      if(!isOpen) item.classList.add("open");
    });
  });
}

/* ---------- enquiry reporting dashboard — reads real rows from Supabase.
   RLS only lets signed-in admins read the enquiries table, so an
   anonymous visitor opening this page directly simply sees an empty/zero
   dashboard rather than real numbers — that's the database enforcing the
   access rule, not a bug here. */
async function initDashboard(){
  const root = document.querySelector("#dashRoot");
  if(!root) return;

  const allEnquiries = await BazDS.getEnquiries();
  const now = Date.now();
  const DAY = 86400000;

  // The 4 top stat cards are always fixed windows (today/7d/30d + latest),
  // regardless of the range picker below — that picker only scopes the
  // charts, activity feed and CSV export, so you can compare "today" against
  // a longer trend without the headline numbers moving under you.
  const todayCount = allEnquiries.filter(e=>now-new Date(e.created_at).getTime() < DAY).length;
  const weekCount = allEnquiries.filter(e=>now-new Date(e.created_at).getTime() < 7*DAY).length;
  const monthCount = allEnquiries.filter(e=>now-new Date(e.created_at).getTime() < 30*DAY).length;

  const statEls = document.querySelectorAll(".dash-card .dnum");
  if(statEls[0]) statEls[0].textContent = todayCount;
  if(statEls[1]) statEls[1].textContent = weekCount;
  if(statEls[2]) statEls[2].textContent = monthCount;
  if(statEls[3]) statEls[3].textContent = allEnquiries.length ? new Date(allEnquiries[0].created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—";
  document.querySelectorAll(".dash-card .dtrend").forEach((el,i)=>{ if(i<3) el.textContent = allEnquiries.length ? "from live enquiries" : "no enquiries logged yet"; });
  const latestLabel = document.querySelectorAll(".dash-card .dlabel")[3];
  if(latestLabel) latestLabel.textContent = "Latest enquiry";
  const latestTrend = document.querySelectorAll(".dash-card .dtrend")[3];
  if(latestTrend) latestTrend.textContent = allEnquiries.length ? `Ref ${allEnquiries[0].ref}` : "none yet";

  function renderRangeDependent(enquiries){
    // top enquired products, by product name recorded on the enquiry row
    const counts = {};
    enquiries.forEach(e=>{ const name = e.product_name || "Unknown product"; counts[name] = (counts[name]||0)+1; });
    const topProducts = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,val])=>({name,val}));
    const barEl = document.querySelector("#barChart");
    if(barEl){
      if(!topProducts.length){
        barEl.innerHTML = `<p style="color:var(--muted);font-size:13.5px">No enquiries in this range yet.</p>`;
      } else {
        const max = Math.max(...topProducts.map(p=>p.val));
        barEl.innerHTML = topProducts.map(p=>`
          <div class="bar-col"><span class="bar-val">${p.val}</span><div class="bar-fill" data-h="${(p.val/max*100).toFixed(0)}"></div><span class="bar-label">${p.name}</span></div>`).join("");
        setTimeout(()=>{ document.querySelectorAll(".bar-fill").forEach(b=>{ b.style.height = b.dataset.h + "%"; }); }, 200);
      }
    }

    // purpose split — look up each enquiry's product to find its purpose
    const purposeCounts = {};
    enquiries.forEach(e=>{
      const p = PRODUCTS.find(x=>x.id===e.product_id);
      const purpose = p ? p.purpose : "Other";
      purposeCounts[purpose] = (purposeCounts[purpose]||0)+1;
    });
    const donutColors = ["#c6f000","#9fc400","#5c7a00","#2d3a1a","#7a9900"];
    const purposeSplit = Object.entries(purposeCounts).map(([label,val],i)=>({label,val,color:donutColors[i%donutColors.length]}));
    const donutEl = document.querySelector("#donutChart");
    if(donutEl){
      if(!purposeSplit.length){
        donutEl.style.background = "var(--soft)";
        document.querySelector("#donutLegend").innerHTML = `<div style="color:var(--muted)">No enquiries in this range</div>`;
      } else {
        const total = purposeSplit.reduce((s,p)=>s+p.val,0);
        let acc = 0;
        const stops = purposeSplit.map(s=>{ const pct = s.val/total*100; const start=acc; acc+=pct; return `${s.color} ${start}% ${acc}%`; }).join(",");
        donutEl.style.background = `conic-gradient(${stops})`;
        document.querySelector("#donutLegend").innerHTML = purposeSplit.map(s=>`<div><i style="background:${s.color}"></i>${s.label} — ${Math.round(s.val/total*100)}%</div>`).join("");
      }
    }

    // recent activity — latest enquiries within the selected range
    const feedEl = document.querySelector("#activityFeed");
    if(feedEl){
      if(!enquiries.length){
        feedEl.innerHTML = `<p style="color:var(--muted);font-size:13.5px">Nothing in this range — widen it, or wait for new WhatsApp enquiries to come in.</p>`;
      } else {
        feedEl.innerHTML = enquiries.slice(0,8).map(e=>{
          const mins = Math.max(1, Math.round((now-new Date(e.created_at).getTime())/60000));
          const timeLabel = mins<60 ? `${mins} min ago` : mins<1440 ? `${Math.round(mins/60)} hr ago` : `${Math.round(mins/1440)} day(s) ago`;
          return `<div class="afeed-item"><div class="afeed-icon">💬</div><div><b>New WhatsApp enquiry received</b><span>Ref ${e.ref} • ${e.product_name||""}${e.quantity?" × "+e.quantity:""} • ${timeLabel}</span></div></div>`;
        }).join("");
      }
    }
  }

  function enquiriesInRange(days){
    if(!days) return allEnquiries; // "0" = all time
    const cutoff = now - days*DAY;
    return allEnquiries.filter(e=>new Date(e.created_at).getTime() >= cutoff);
  }

  function exportCsv(enquiries){
    const header = ["Reference","Product","Quantity","Status","Date"];
    const rows = enquiries.map(e=>[
      e.ref, e.product_name||"", e.quantity||"", e.status||"new",
      new Date(e.created_at).toLocaleString("en-IN")
    ]);
    const csv = [header, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bazarville-enquiries-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  const rangeSelect = document.querySelector("#dashRangeSelect");
  const exportBtn = document.querySelector("#dashExportBtn");
  const currentRange = ()=> enquiriesInRange(rangeSelect ? Number(rangeSelect.value) : 7);
  renderRangeDependent(currentRange());
  if(rangeSelect) rangeSelect.addEventListener("change", ()=>renderRangeDependent(currentRange()));
  if(exportBtn) exportBtn.addEventListener("click", ()=>exportCsv(currentRange()));
}

/* ---------- track enquiry demo ---------- */
function initTrack(){
  const form = document.querySelector("#trackForm");
  if(!form) return;
  form.addEventListener("submit", e=>{
    e.preventDefault();
    const val = document.querySelector("#trackInput").value.trim();
    const result = document.querySelector("#trackResult");
    if(!val){ return; }
    result.style.display = "block";
    document.querySelector("#trackRef").textContent = val.toUpperCase();
  });
}

/* ---------- collection detail page ---------- */
function initCollectionPage(){
  const root = document.querySelector("#collectionRoot");
  if(!root) return;
  const params = new URLSearchParams(location.search);
  const name = params.get("name") || "Diwali Corporate Gifting";
  const found = COLLECTIONS.find(c=>c.name===name) || COLLECTIONS[0];
  document.querySelector("#collName").textContent = found.name;
  document.querySelector("#collTag").textContent = found.tag;
  document.querySelector("#collImg").src = found.img;
  renderGrid("#collectionGrid", publishedProducts().slice(0, 8));
}

/* ---------- hero banner images (admin-editable via Settings) ---------- */
function initHeroImages(){
  const map = {heroImg1:0, heroImg2:1, heroImg3:2};
  Object.keys(map).forEach(id=>{
    const el = document.querySelector("#"+id);
    if(el && SETTINGS.heroImages && SETTINGS.heroImages[map[id]]) el.src = SETTINGS.heroImages[map[id]];
  });
}

/* ---------- brand colour theming (admin-editable via Settings) ----------
   The whole site only ever references two accent variables, --lime and
   --lime-deep (a darker shade for hover/shadow), plus --on-accent (the text
   colour to use on TOP of the accent — dark text on a light accent, white
   text on a dark one). Switching the whole site's colour is just computing
   these three from one chosen hex and setting them at the root — no other
   file needs to know a theme change happened. */
function hexToRgb(hex){
  hex = hex.replace("#","");
  if(hex.length===3) hex = hex.split("").map(c=>c+c).join("");
  const n = parseInt(hex,16);
  return {r:(n>>16)&255, g:(n>>8)&255, b:n&255};
}
function darken(hex, amount){
  const {r,g,b} = hexToRgb(hex);
  const f = c => Math.max(0, Math.round(c*(1-amount)));
  return `#${[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}
function relativeLuminance(hex){
  const {r,g,b} = hexToRgb(hex);
  const [R,G,B] = [r,g,b].map(v=>{ v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); });
  return .2126*R + .7152*G + .0722*B;
}
function applyBrandColor(hex){
  if(!hex) return;
  const root = document.documentElement.style;
  root.setProperty("--lime", hex);
  root.setProperty("--lime-deep", darken(hex, .2));
  root.setProperty("--on-accent", relativeLuminance(hex) > .5 ? "#1a1a1a" : "#ffffff");
}

/* ---------- brand font (admin-editable via Settings) ---------- */
function applyBrandFont(id){
  const preset = FONT_PRESETS.find(f=>f.id===id) || FONT_PRESETS[0];
  document.documentElement.style.setProperty("--font-body", preset.body);
  document.documentElement.style.setProperty("--font-heading", preset.heading);
}

/* ---------- animation intensity (admin-editable via Settings) ----------
   "off"/"full" toggle a body class (CSS in style.css does the heavy lifting —
   killing transitions, or adding the idle 3D card float). --tilt-mult is read
   by attachTilt/initHeroTilt below to scale the mouse-driven tilt depth. */
function applyAnimationLevel(level){
  document.body.classList.remove("anim-off","anim-full");
  if(level==="off") document.body.classList.add("anim-off");
  if(level==="full") document.body.classList.add("anim-full");
  document.documentElement.style.setProperty("--tilt-mult", level==="off" ? "0" : level==="full" ? "1.8" : "1");
}
function getTiltMult(){
  const v = getComputedStyle(document.documentElement).getPropertyValue("--tilt-mult").trim();
  return v ? parseFloat(v) || 1 : 1;
}

/* ---------- shared: nav + ticker duplication + init ---------- */
document.addEventListener("DOMContentLoaded", async ()=>{
  document.querySelectorAll(".ticker").forEach(t=>{ if(!t.dataset.doubled){ t.innerHTML += t.innerHTML; t.dataset.doubled = "1"; } });

  const menuBtn = document.querySelector(".menu-btn");
  const links = document.querySelector(".links");
  if(menuBtn && links) menuBtn.addEventListener("click", ()=>{
    const open = links.style.display === "flex";
    links.style.cssText = open ? "" : "display:flex;flex-direction:column;position:absolute;top:82px;left:0;right:0;background:var(--surface);padding:18px 6%;gap:16px;border-bottom:1px solid var(--line);box-shadow:0 14px 24px rgba(0,0,0,.08);z-index:59";
  });

  // Load the live catalogue from Supabase. If it's not configured yet (fresh
  // clone of this project) or the network call fails, fall back to the
  // built-in demo data so the site never shows up blank.
  try{
    const [products, collections, settings] = await Promise.all([
      BazDS.getProducts(), BazDS.getCollections(), BazDS.getSettings()
    ]);
    PRODUCTS = products.length ? products : DEFAULT_PRODUCTS;
    COLLECTIONS = collections.length ? collections : DEFAULT_COLLECTIONS;
    SETTINGS = (settings && settings.whatsappNumber) ? settings : DEFAULT_SETTINGS;
  }catch(err){
    console.error("Could not load live data from Supabase — showing built-in demo data instead.", err);
    PRODUCTS = DEFAULT_PRODUCTS; COLLECTIONS = DEFAULT_COLLECTIONS; SETTINGS = DEFAULT_SETTINGS;
  }
  refreshProfessionsList(); // merge any admin-added custom professions into PROFESSIONS before initGalaxy/initFilters run
  applyBrandColor(SETTINGS.brandColor);
  applyBrandFont(SETTINGS.brandFont);
  applyAnimationLevel(SETTINGS.animationLevel);
  const footerWaLink = document.querySelector("#footerWaLink");
  if(footerWaLink) footerWaLink.href = `https://wa.me/${SETTINGS.whatsappNumber||"919999999999"}?text=${encodeURIComponent("Hi Bazarville! I'd like to know more.")}`;

  // each page only has some of these roots present — guard clauses handle that — but
  // run every init in its own try/catch too, so one page's issue can never cascade
  // and silently break unrelated features (reveal, menu) on the same page.
  renderCartBadge();
  const inits = [()=>renderGrid("#bestGrid", publishedProducts().slice(0,4)), ()=>renderCollections("#collGrid"),
    initFilters, initProductPage, initGalaxy, initDashboard, initTrack, initCollectionPage,
    initFaq, initParallax, initHeroTilt, initHeroImages, initReveal, initCounters,
    initCartPage, initCheckoutPage, initOrderConfirmPage, initAccountPage, initQuotePage, initNavSearch];
  inits.forEach(fn=>{ try{ fn(); } catch(err){ console.error("Bazarville init error:", fn.name, err); } });

  // fire-and-forget enquiry logging — never blocks the WhatsApp redirect itself
  document.addEventListener("click", (e)=>{
    const link = e.target.closest(".wa-mini, #waBtn");
    if(!link || !link.href) return;
    try{
      const url = new URL(link.href);
      const text = decodeURIComponent(url.searchParams.get("text")||"");
      const refMatch = text.match(/Ref:\s*([A-Z0-9]+)/);
      const qtyMatch = text.match(/Quantity:\s*(\d+)/);
      const nameMatch = text.match(/\*(.+?)\*/);
      if(refMatch) BazDS.logEnquiry({ ref:refMatch[1], productName:nameMatch?nameMatch[1]:"", quantity:qtyMatch?Number(qtyMatch[1]):null });
    }catch(err){ /* non-fatal — logging must never break the enquiry link itself */ }
  });

  const searchForm = document.querySelector("#heroSearch");
  if(searchForm) searchForm.addEventListener("submit", e=>{
    e.preventDefault();
    const v = document.querySelector("#heroSearchInput").value.trim();
    location.href = "products.html" + (v? "?q="+encodeURIComponent(v) : "");
  });
});
