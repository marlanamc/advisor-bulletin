/* ============================================================
   Streamlined Post Composer — shared behavior
   One form per page; queries are document-global for simplicity.
   ============================================================ */
(function () {
  "use strict";

  // ── Category data ──────────────────────────────────────
  var CATS = {
    job:          { em:"💼", label:"Job Opportunity", chip:"Job",        bg:"#e8f0fe", fg:"#1e4db7" },
    training:     { em:"📚", label:"Training / Workshop", chip:"Training", bg:"#f0eeff", fg:"#7c3aed" },
    immigration:  { em:"🌎", label:"Immigration", chip:"Immigration",     bg:"#e6f7f0", fg:"#059669" },
    housing:      { em:"🏠", label:"Housing", chip:"Housing",             bg:"#fff1ec", fg:"#c2410c" },
    health:       { em:"❤️", label:"Health", chip:"Health",               bg:"#ffe9ee", fg:"#be123c" },
    food:         { em:"🍽️", label:"Food", chip:"Food",                   bg:"#fffbea", fg:"#b45309" },
    esol:         { em:"🗣️", label:"English Class (ESOL)", chip:"ESOL",   bg:"#e8f0fe", fg:"#1e4db7" },
    college:      { em:"🎓", label:"College & GED", chip:"College",       bg:"#f0eeff", fg:"#7c3aed" },
    money:        { em:"💵", label:"Money Help", chip:"Money Help",       bg:"#e6f7f0", fg:"#059669" },
    "career-fair":{ em:"🤝", label:"Career Fair", chip:"Career Fair",     bg:"#fff1ec", fg:"#c2410c" },
    announcement: { em:"📣", label:"Announcement", chip:"Announcement",   bg:"#f0f4f9", fg:"#3d5a80" }
  };
  // Primary categories shown as chips; rest behind "More"
  var PRIMARY = ["job","training","immigration","housing","health","announcement"];

  var TYPE_CHIP = {
    bulletin: { txt:"Bulletin",  em:"📌", bg:"#c7d9fd", fg:"#1e4db7" },
    resource: { txt:"Resource",  em:"🔗", bg:"#a7e8cc", fg:"#047857" },
    event:    { txt:"Calendar",  em:"📅", bg:"#fde68a", fg:"#b45309" }
  };

  var state = { type:"bulletin", category:"", image:null };

  function $(s, r){ return (r||document).querySelector(s); }
  function $all(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }

  // ── Build category picker ──────────────────────────────
  function buildCats() {
    var host = $("[data-cats]");
    if (!host) return;
    var showAll = host.getAttribute("data-cats") === "all";
    var keys = showAll ? Object.keys(CATS) : PRIMARY;
    host.innerHTML = "";
    keys.forEach(function (k) {
      var c = CATS[k];
      var b = document.createElement("button");
      b.type = "button"; b.className = "cx-cat"; b.dataset.cat = k;
      b.innerHTML = '<span class="cx-cat-em">'+c.em+'</span>'+c.chip;
      b.addEventListener("click", function(){ pickCat(k); });
      host.appendChild(b);
    });
    if (!showAll) {
      var more = document.createElement("button");
      more.type = "button"; more.className = "cx-cat cx-cat-more";
      more.innerHTML = "+ More topics";
      more.addEventListener("click", function(){
        host.setAttribute("data-cats","all"); buildCats();
        if (state.category) markCat();
      });
      host.appendChild(more);
    }
  }
  function pickCat(k){ state.category = k; markCat(); sync(); }
  function markCat(){
    $all("[data-cats] .cx-cat").forEach(function(b){
      var on = b.dataset.cat === state.category;
      b.classList.toggle("sel", on);
      if (on){ b.style.color = CATS[state.category].fg; b.style.background = CATS[state.category].bg; }
      else if (!b.classList.contains("cx-cat-more")){ b.style.color=""; b.style.background=""; }
    });
  }

  // ── Live preview sync ──────────────────────────────────
  function sync() {
    var title = (($("[data-f='title']")||{}).value || "").trim();
    var descEl = $("[data-f='desc']");
    var desc = descEl ? (descEl.value || descEl.textContent || "").trim() : "";
    var advisorEl = $("[data-f='advisor']");
    var advisor = advisorEl ? advisorEl.value : "Jorge";

    // chip = category if chosen, else type
    var chipEl = $("[data-p='chip']");
    if (chipEl) {
      if (state.category) {
        var c = CATS[state.category];
        chipEl.innerHTML = '<span>'+c.em+'</span> '+c.chip.toUpperCase();
        chipEl.style.background = c.bg; chipEl.style.color = c.fg;
        var bar = $("[data-p='chipbar']"); if (bar) bar.style.background = c.bg;
      } else {
        var t = TYPE_CHIP[state.type];
        chipEl.innerHTML = '<span>'+t.em+'</span> '+t.txt.toUpperCase();
        chipEl.style.background = t.bg; chipEl.style.color = t.fg;
        var bar2 = $("[data-p='chipbar']"); if (bar2) bar2.style.background = t.bg;
      }
    }
    var pt = $("[data-p='title']"); if (pt) pt.textContent = title || "Your post title appears here";
    var pd = $("[data-p='desc']");
    if (pd) {
      if (desc) { pd.textContent = desc; pd.style.opacity = ""; }
      else { pd.textContent = "A short description shows here so students know what it's about."; pd.style.opacity = ".55"; }
    }
    var pa = $("[data-p='author']");
    if (pa) pa.textContent = (advisor || "Advisor") + " · Just now";

    // meta chips from optional fields
    var meta = $("[data-p='meta']");
    if (meta) {
      meta.innerHTML = "";
      var date = ($("[data-f='date']")||{}).value;
      var loc  = (($("[data-f='location']")||{}).value || "").trim();
      var phone= (($("[data-f='phone']")||{}).value || "").trim();
      var link = (($("[data-f='link']")||{}).value || "").trim();
      function add(svg, txt){ var s=document.createElement("span"); s.className="cx-pmeta"; s.innerHTML=svg+" "+txt; meta.appendChild(s); }
      if (date) add("📅", fmtDate(date));
      if (loc)  add("📍", loc.length>16?loc.slice(0,16)+"…":loc);
      if (phone)add("📞", phone);
      if (link && !date && !loc && !phone) add("🔗", "Link");
    }
    updateProgress();
  }

  function fmtDate(v){
    try { var d=new Date(v+"T00:00"); return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
    catch(e){ return v; }
  }

  // ── Optional sections: filled state + completion ───────
  function refreshSectionStates(){
    $all(".cx-sec").forEach(function(sec){
      var filled = $all("input,textarea,select", sec).some(function(el){
        if (el.type==="file") return el.dataset.has==="1";
        return (el.value||"").trim() !== "";
      });
      sec.classList.toggle("filled", filled);
      var st = $(".cx-sec-state", sec);
      if (st && filled) st.textContent = "Added";
    });
  }
  function updateProgress(){
    var bar = $("[data-progress]"); if (!bar) return;
    var title = (($("[data-f='title']")||{}).value||"").trim();
    var descEl=$("[data-f='desc']"); var desc=descEl?(descEl.value||descEl.textContent||"").trim():"";
    var done = (title?1:0)+(desc?1:0)+(state.category?1:0);
    var fill = $("[data-progress-fill]");
    if (fill) fill.style.width = (done/3*100)+"%";
    bar.textContent = done<3 ? (done+" of 3 essentials" ) : "Ready to post ✓";
    bar.classList.toggle("ready", done>=3);
  }

  // ── Accordions ─────────────────────────────────────────
  function bindAccordions(){
    $all(".cx-sec-head").forEach(function(h){
      h.addEventListener("click", function(){
        h.closest(".cx-sec").classList.toggle("open");
      });
    });
  }

  // ── Type tabs ──────────────────────────────────────────
  function bindTypes(){
    $all("[data-type]").forEach(function(t){
      t.addEventListener("click", function(){
        $all("[data-type]").forEach(function(x){ x.classList.remove("active"); });
        t.classList.add("active");
        state.type = t.getAttribute("data-type");
        $all("[data-only]").forEach(function(el){
          var ok = el.getAttribute("data-only").split(" ").indexOf(state.type) > -1;
          el.classList.toggle("cx-hidden", !ok);
        });
        sync();
      });
    });
  }

  // ── Advisor avatar ─────────────────────────────────────
  function bindAdvisor(){
    var sel = $("[data-f='advisor']"); if (!sel) return;
    var ava = $("[data-advisor-ava]");
    function upd(){ if (ava) ava.textContent = (sel.value||"A").charAt(0).toUpperCase(); sync(); }
    sel.addEventListener("change", upd); upd();
  }

  // ── Image upload preview ───────────────────────────────
  function bindUploads(){
    $all("[data-upload]").forEach(function(zone){
      var input = $("input[type=file]", zone) || $(zone.getAttribute("data-upload"));
      if (!input) return;
      zone.addEventListener("click", function(e){ if (e.target.tagName!=="INPUT") input.click(); });
      input.addEventListener("change", function(){
        var f = input.files && input.files[0]; if (!f) return;
        input.dataset.has = "1";
        var r = new FileReader();
        r.onload = function(){
          var pimg = $("[data-p='img']");
          if (pimg && /^image/.test(f.type)) {
            pimg.style.backgroundImage = "url("+r.result+")";
            var ph = $(".ph", pimg); if (ph) ph.style.display = "none";
          }
          zone.classList.add("has-file");
          var nm = $("[data-upload-name]", zone); if (nm) nm.textContent = f.name;
          var th = $("[data-upload-thumb]", zone);
          if (th && /^image/.test(f.type)) { th.style.backgroundImage="url("+r.result+")"; th.style.display="block"; }
          refreshSectionStates();
        };
        r.readAsDataURL(f);
      });
    });
  }

  // ── boot ───────────────────────────────────────────────
  function boot(){
    buildCats();
    bindAccordions();
    bindTypes();
    bindAdvisor();
    bindUploads();
    $all("[data-f]").forEach(function(el){
      var ev = (el.tagName==="SELECT") ? "change" : "input";
      el.addEventListener(ev, function(){ sync(); refreshSectionStates(); });
    });
    // toolbar buttons are decorative wrappers around the textarea
    $all(".cx-tb").forEach(function(b){ b.addEventListener("click", function(e){ e.preventDefault(); }); });
    sync();
    updateProgress();
  }

  window.CX = { sync:sync, CATS:CATS, refreshSectionStates:refreshSectionStates, state:state };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
