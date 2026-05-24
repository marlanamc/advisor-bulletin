import{C as e,N as t,O as n,T as r,i,j as a,n as o,r as s,s as c,t as l,w as u,y as d}from"./feed-categories-DYSCHwY0.js";function f(){return{lightbox:document.getElementById(`imgLightbox`),lightboxImg:document.getElementById(`imgLightboxImg`),closeBtn:document.getElementById(`imgLightboxClose`),backdrop:document.getElementById(`imgLightboxBackdrop`),openBtn:document.getElementById(`imgLightboxOpenBtn`)}}function p(){let{lightbox:e}=f();return!!(e&&e.classList.contains(`open`))}function m(e){let{lightbox:t,lightboxImg:n,openBtn:r}=f();!t||!n||!e||(n.classList.remove(`is-tall`),n.src=e,r&&(r.href=e),t.classList.add(`open`),t.setAttribute(`aria-hidden`,`false`),document.body.style.overflow=`hidden`,n.onload=function(){n.naturalHeight/n.naturalWidth>1.2&&n.classList.add(`is-tall`)})}function h(){let{lightbox:e,lightboxImg:t}=f();!e||!t||(e.classList.remove(`open`),e.setAttribute(`aria-hidden`,`true`),document.body.classList.contains(`modal-open`)||(document.body.style.overflow=``),t.src=``,t.classList.remove(`is-tall`))}function g(){let{lightbox:e,closeBtn:t,backdrop:n}=f();e&&(document.addEventListener(`click`,e=>{let t=e.target.closest(`.lightbox-trigger`);!t||!t.dataset.lightboxSrc||(e.preventDefault(),e.stopPropagation(),m(t.dataset.lightboxSrc))}),t&&t.addEventListener(`click`,h),n&&n.addEventListener(`click`,h),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&p()&&(e.stopImmediatePropagation(),h())},!0),window.openImageLightbox=m,window.closeImageLightbox=h,window.isImageLightboxOpen=p)}s(`student`);var _=new Set([`card_view`,`detail_open`,`link_click`,`pdf_open`,`share_click`,`category_click`,`resource_open`]);function v(e=new Date){return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,`0`)}-${String(e.getDate()).padStart(2,`0`)}`}function y(){let e=navigator.userAgent;return/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(e)?`tablet`:/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(e)?`mobile`:`desktop`}function b(e,n={}){if(!_.has(e)||c===void 0)return Promise.resolve();let r={action:e,createdAt:t(),dayKey:v(),source:`student`,device:y(),contentType:n.contentType||(e===`category_click`?`category`:`post`)};return n.postId&&(r.postId=String(n.postId).slice(0,160)),n.category&&(r.category=String(n.category).slice(0,80)),d(a(c,`analyticsEvents`),r).catch(e=>{console.debug(`Student analytics skipped:`,e&&e.code?e.code:e)})}window.trackStudentEvent=b;var x=[];function S(e){return[...x,...e||[]]}var C={immigration:{labelEn:`Immigration`,labelEs:`Inmigración`,icon:`globe`,color:`#0d9488`},jobs:{labelEn:`Jobs`,labelEs:`Empleos`,icon:`briefcase`,color:`#24498f`},housing:{labelEn:`Housing`,labelEs:`Vivienda`,icon:`home`,color:`#df6b4a`},health:{labelEn:`Health`,labelEs:`Salud`,icon:`heart`,color:`#df477f`},food:{labelEn:`Food`,labelEs:`Comida`,icon:`food`,color:`#2f934f`},family:{labelEn:`Child Care`,labelEs:`Cuidado de niños`,icon:`family`,color:`#c99035`},esol:{labelEn:`English class`,labelEs:`Inglés`,icon:`abc`,color:`#8050d1`},hse:{labelEn:`GED / HSE`,labelEs:`Equivalencia escolar`,icon:`abc`,color:`#2563eb`},college:{labelEn:`College & Careers`,labelEs:`Universidad y carreras`,icon:`graduation`,color:`#0a1d3a`},"legal-aid":{labelEn:`Legal Help`,labelEs:`Ayuda legal`,icon:`scale`,color:`#7c3aed`},money:{labelEn:`Financial Help`,labelEs:`Ayuda financiera`,icon:`money`,color:`#1fa77e`},announcement:{labelEn:`Announcements`,labelEs:`Anuncios`,icon:`megaphone`,color:`#317dea`}},w=[`immigration`,`jobs`,`housing`,`health`,`food`],T=[`jobs`,`immigration`,`housing`,`health`,`food`,`family`,`hse`,`college`,`legal-aid`,`money`],E={all:{icon:`✨`,title:`Main Feed`,description:`New help, classes, jobs, and community support from your advisors.`,chips:[`New`,`Free help`,`This week`]},housing:{icon:`🏠`,title:`Housing Help`,description:`Find apartments, shelters, rent help, and housing support.`,chips:[`Emergency Housing`,`Apartments`,`Rent Help`,`Tenant Rights`]},job:{icon:`💼`,title:`Job Posts`,description:`See advisor posts about job openings, hiring notices, resumes, and career support.`,chips:[`Hiring Now`,`Resume Help`,`Career Support`]},jobs:{icon:`💼`,title:`Job Posts`,description:`See advisor posts about job openings, hiring notices, resumes, and career support.`,chips:[`Hiring Now`,`Resume Help`,`Career Support`]},immigration:{icon:`🌎`,title:`Immigration Help`,description:`Find legal help, citizenship support, and trusted local organizations.`,chips:[`Citizenship`,`Legal Help`,`Know Your Rights`,`Green Card`]},health:{icon:`❤️`,title:`Health Support`,description:`Find clinics, health information, mental health support, and care nearby.`,chips:[`Clinics`,`Mental Health`,`Insurance`,`Urgent Help`]},food:{icon:`🥕`,title:`Food Help`,description:`Find food pantries, meal programs, and grocery help for families.`,chips:[`Food Pantry`,`Meals`,`Delivery`,`Family Help`]},esol:{icon:`📘`,title:`Free Classes`,description:`Find English classes, adult education, GED, and student support.`,chips:[`English Class`,`GED`,`Conversation`,`Career English`]},college:{icon:`🎓`,title:`College Pathways`,description:`Find college, GED, certificates, and next-step education support.`,chips:[`GED`,`Certificates`,`Financial Aid`,`College Help`]},money:{icon:`💵`,title:`Money Help`,description:`Find financial coaching, benefits, tax help, and low-cost support.`,chips:[`Benefits`,`Tax Help`,`Budgeting`,`Free Support`]},childcare:{icon:`👨‍👩‍👧`,title:`Family Support`,description:`Find child care, family programs, youth support, and parent help.`,chips:[`Child Care`,`Family Programs`,`Youth`,`Parent Help`]},family:{icon:`👨‍👩‍👧`,title:`Family Support`,description:`Find child care, family programs, youth support, and parent help.`,chips:[`Child Care`,`Family Programs`,`Youth`,`Parent Help`]},training:{icon:`🧰`,title:`Training Posts`,description:`See advisor posts about workshops, skills training, certificates, and programs.`,chips:[`Workshops`,`Certificates`,`Career Skills`,`Programs`]},"career-fair":{icon:`📍`,title:`Career Fairs`,description:`Find hiring events, job fairs, and places to meet employers.`,chips:[`Hiring Events`,`Employers`,`Resume`,`Interviews`]},announcement:{icon:`📢`,title:`Announcements`,description:`School news, reminders, and general updates from your advisors.`,chips:[`School News`,`Reminders`,`Updates`,`Events`]}},D={shield:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M32 5 13 13v16c0 13.5 8 24.8 19 30 11-5.2 19-16.5 19-30V13L32 5Z"/>
            <path fill="#ffc857" d="m25 32 5 5 10-12 5 4-14 17-11-10 5-4Z"/>
        </svg>
    `,briefcase:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M18 22h28c5 0 8 3 8 8v18c0 5-3 8-8 8H18c-5 0-8-3-8-8V30c0-5 3-8 8-8Z"/>
            <path fill="#fff" d="M24 20c0-5 3-8 8-8s8 3 8 8v4h-7v-4c0-1-.3-1.4-1-1.4s-1 .4-1 1.4v4h-7v-4Z"/>
            <path fill="#dce3ec" d="M10 34h44v9H10z"/>
            <circle cx="32" cy="39" r="4.2" fill="#ffc857"/>
        </svg>
    `,home:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M10 31 32 11l22 20v23H10V31Z"/>
            <path fill="#df6b4a" d="M26 39c0-3.3 2.7-6 6-6s6 2.7 6 6v15H26V39Z"/>
            <circle cx="34.5" cy="46" r="1.7" fill="#ffc857"/>
        </svg>
    `,heart:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M32 55C18 44 11 35.8 11 25.5 11 17 17.7 11 25.3 11c4.2 0 7.2 2 8.7 4.2C35.5 13 38.5 11 42.7 11 50.3 11 57 17 57 25.5 57 35.8 50 44 32 55Z"/>
            <path fill="#df477f" d="M28 23h8v9h9v8h-9v9h-8v-9h-9v-8h9v-9Z"/>
        </svg>
    `,food:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M17 22h30l-4 30H21l-4-30Z"/>
            <path fill="#fff" d="M24 21c.6-6 4-9 8-9s7.4 3 8 9h-6c-.4-2.4-1-3-2-3s-1.6.6-2 3h-6Z"/>
            <path fill="#2f934f" d="M21 22h22l-.8 6H21.8L21 22Z" opacity=".22"/>
            <circle cx="32" cy="39" r="6.2" fill="#df6b4a"/>
        </svg>
    `,family:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="26" cy="18" r="8" fill="#fff"/>
            <circle cx="47" cy="25" r="7" fill="#fff"/>
            <path fill="#fff" d="M10 53c1-10.5 7.2-16.5 16-16.5S41 42.5 42 53H10Z"/>
            <path fill="#fff" d="M39 53c.8-7.5 4.9-12 10.5-12S59.2 45.5 60 53H39Z"/>
        </svg>
    `,abc:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M12 14h37c5.5 0 9 3.5 9 9v16c0 5.5-3.5 9-9 9H31L18 59V48h-6c-5.5 0-9-3.5-9-9V23c0-5.5 3.5-9 9-9Z"/>
            <text x="13" y="38" fill="#8050d1" font-family="Arial, sans-serif" font-size="18" font-weight="900">ABC</text>
            <circle cx="52" cy="52" r="7.5" fill="#c9b5ff"/>
        </svg>
    `,graduation:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M4 25 32 13l28 12-28 12L4 25Z"/>
            <path fill="#fff" d="M17 33v13c8.5 5.4 21.5 5.4 30 0V33l-15 6.5L17 33Z"/>
            <path fill="#ffc857" d="M53 28h5v19h-5z"/>
            <circle cx="55.5" cy="29" r="4.2" fill="#ffc857"/>
        </svg>
    `,handshake:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M9 34c8-2 15-4 22-6 3-1 6 0 8 2l5 5c3 3 1 8-3 8H25c-6 0-11-2-16-5v-4Z"/>
            <path fill="#fff" d="M55 34c-8-2-15-4-22-6-3-1-6 0-8 2l-5 5c-3 3-1 8 3 8h16c6 0 11-2 16-5v-4Z" opacity=".95"/>
            <circle cx="32" cy="37" r="7" fill="#f08b1f"/>
            <circle cx="32" cy="37" r="3" fill="#fff"/>
        </svg>
    `,money:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M14 20c8-5 28-5 36 0v27c-8 5-28 5-36 0V20Z"/>
            <text x="27" y="30" fill="#1fa77e" font-family="Arial, sans-serif" font-size="19" font-weight="900">$</text>
        </svg>
    `,megaphone:`
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M9 28 44 13v38L9 36v-8Z"/>
            <rect x="40" y="26" width="16" height="14" rx="4" fill="#fff"/>
            <circle cx="58" cy="33" r="5" fill="#ffc857"/>
        </svg>
    `,scale:`
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4v15.5"></path>
            <path d="M7 7.5h10"></path>
            <path d="m7 7.5-3 5h6l-3-5Z"></path>
            <path d="m17 7.5-3 5h6l-3-5Z"></path>
            <path d="M8.5 20.5h7"></path>
        </svg>
    `,globe:`
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M3.75 12h16.5"></path>
            <path d="M12 3.75c2.75 2.55 4.25 5.3 4.25 8.25S14.75 17.7 12 20.25c-2.75-2.55-4.25-5.3-4.25-8.25S9.25 6.3 12 3.75Z"></path>
        </svg>
    `},O=class t{constructor(){this.currentUser=null,this.bulletins=[],this.filteredPosts=[],this.lastHashHighlight=null,this.currentView=`feed`,this.currentFeedCategory=`all`,this.currentResourceCategory=`all`,this.resourceSearchQuery=``,this.resourceSortMode=`default`,this.datesViewMode=`list`,this.isSearchLayerOpen=!1,this.trackedCardViews=new Set,this.handleHashChange=this.handleHashRouting.bind(this),this.handleDescriptionToggle=this.handleDescriptionToggle.bind(this),this.init()}init(){this.currentCalendarMonth=new Date().getMonth(),this.currentCalendarYear=new Date().getFullYear(),this.bindEvents(),this.loadBulletins(),this.checkAutoLogin(),this.setupRealtimeListener(),this.switchView(`feed`,{skipRender:!0,preserveDetail:!0}),this.closeSearchLayer({preserveScroll:!0,silent:!0}),window.addEventListener(`hashchange`,this.handleHashChange)}static CACHE_KEY=`ebhcs_bulletins_v1`;static CACHE_TTL=1800*1e3;_readCache(){try{let e=sessionStorage.getItem(t.CACHE_KEY);if(!e)return null;let{ts:n,bulletins:r}=JSON.parse(e);return Date.now()-n>t.CACHE_TTL?null:r}catch{return null}}_writeCache(e){try{sessionStorage.setItem(t.CACHE_KEY,JSON.stringify({ts:Date.now(),bulletins:e}))}catch{}}setupRealtimeListener(){let t=this._readCache();t&&t.length>0&&(this.bulletins=t,this.populateAdvisorFilters(),this.renderResourceCategoryFilters(),this.displayBulletins()),e(r(a(c,`bulletins`),n(`isActive`,`==`,!0),u(`datePosted`,`desc`)),e=>{this.bulletins=[],e.forEach(e=>{this.bulletins.push({id:e.id,...this.normalizeBulletin(e.data())})}),this._writeCache(this.bulletins),this.populateAdvisorFilters(),this.renderResourceCategoryFilters(),this.displayBulletins()},e=>{console.error(`Error loading bulletins:`,e);let t=document.getElementById(`bulletinGrid`);t&&(t.innerHTML=`<div class="feed-load-error" role="alert"><p>Could not load posts. Check your connection and try again.</p><p class="empty-state-bilingual">No se pudieron cargar las publicaciones. Comprueba tu conexión.</p></div>`)})}normalizeBulletin(e){let t=e.type||`post`,n={...e,type:t};return t===`resource`&&(n.isPublished=e.isPublished!==!1),n.dateType===`sessions`&&(Array.isArray(e.eventDates)&&e.eventDates.length?n.eventDates=e.eventDates.map(e=>String(e).split(`T`)[0].trim()).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e)).sort():e.eventDate?n.eventDates=[String(e.eventDate).split(`T`)[0]]:n.eventDates=[],n.eventDate=n.eventDates[0]||e.eventDate||``),n}getBulletinEventDates(e){return e?e.dateType===`sessions`?Array.isArray(e.eventDates)&&e.eventDates.length?e.eventDates.map(e=>String(e).split(`T`)[0].trim()).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e)).sort():e.eventDate?[String(e.eventDate).split(`T`)[0]]:[]:e.eventDate?[String(e.eventDate).split(`T`)[0]]:e.startDate?[String(e.startDate).split(`T`)[0]]:e.deadline?[String(e.deadline).split(`T`)[0]]:[]:[]}formatEventDatesDisplay(e){if(e.dateType===`sessions`){let t=this.getBulletinEventDates(e);if(!t.length)return null;let n=t.map(e=>{let t=this.parseStoredYmdLocal(e);return t?t.toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`}):e}),r=e.startTime?` · ${e.startTime}`:``;return n.length===1?`${n[0]}${r}`:n.length===2?`${n[0]} & ${n[1]}${r}`:`${n.length} sessions${r}`}return e.deadline?`Apply by ${(this.parseStoredYmdLocal(String(e.deadline).split(`T`)[0])||new Date(e.deadline)).toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`})}`:e.eventDate?(this.parseStoredYmdLocal(String(e.eventDate).split(`T`)[0])||new Date(e.eventDate)).toLocaleDateString(`en-US`,{weekday:`long`,month:`short`,day:`numeric`})+(e.startTime?` · ${e.startTime}`:``):null}formatSessionDatesDetailLabel(e){let t=this.getBulletinEventDates(e);if(!t.length)return``;let n=t.map(e=>{let t=this.parseStoredYmdLocal(e);return t?t.toLocaleDateString(`en-US`,{weekday:`long`,month:`short`,day:`numeric`}):e}),r=this.formatTimeRange(e.startTime,e.endTime),i=r?` · ${r}`:``;return n.length===1?`${n[0]}${i}`:`${n.length} sessions: ${n.join(`, `)}${i}`}bulletinHasCalendarDates(e){return!!(e.deadline||e.eventDate||e.startDate||e.dateType===`sessions`&&Array.isArray(e.eventDates)&&e.eventDates.length)}populateAdvisorFilters(){let e=[...new Set(this.getPostBulletins(this.bulletins).map(e=>e.advisorName).filter(e=>e))];e.sort();let t=document.getElementById(`postedByChips`);t&&(t.innerHTML=``,e.forEach(e=>{let n=document.createElement(`button`);n.className=`filter-chip postedby-chip`,n.setAttribute(`data-postedby`,e),n.textContent=`👤 ${e}`,n.addEventListener(`click`,e=>this.toggleFilterChip(e.target,`postedby`)),t.appendChild(n)}))}bindEvents(){document.querySelectorAll(`[data-app-view]`).forEach(e=>{e.addEventListener(`click`,t=>{e.tagName===`A`&&t.preventDefault();let n=e.getAttribute(`data-app-view`);n&&(this.switchView(n),e.hasAttribute(`data-scroll-home`)&&window.scrollTo({top:0,behavior:`smooth`}))})});let e=document.getElementById(`searchInput`),t=document.getElementById(`searchBtn`),n=document.getElementById(`clearFilters`);e&&e.addEventListener(`input`,()=>this.applyFilters()),t&&t.addEventListener(`click`,()=>this.applyFilters()),n&&n.addEventListener(`click`,()=>this.clearFilters());let r=document.getElementById(`heroSearchInput`),i=document.getElementById(`heroSearchBtn`),a=()=>{e&&r&&(e.value=r.value),this.applyFilters()};r&&(r.addEventListener(`input`,a),r.addEventListener(`keydown`,e=>{e.key===`Enter`&&a()})),i&&i.addEventListener(`click`,a);let o=document.getElementById(`desktopTopbarSearchInput`),s=document.getElementById(`desktopTopbarSearchBtn`),c=()=>{e&&o&&(e.value=o.value),r&&o&&(r.value=o.value),this.applyFilters()};o&&(o.addEventListener(`input`,c),o.addEventListener(`keydown`,e=>{e.key===`Enter`&&c()})),s&&s.addEventListener(`click`,c),document.querySelectorAll(`[data-lang-switch]`).forEach(e=>{e.addEventListener(`click`,()=>this.updateSearchPlaceholder())}),document.querySelectorAll(`.feed-popular-chip`).forEach(t=>{t.addEventListener(`click`,()=>{let n=t.getAttribute(`data-search-term`)||``;r&&(r.value=n),e&&(e.value=n),o&&(o.value=n),this.applyFilters()})}),document.querySelectorAll(`.cat-chip[data-cat-filter]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-cat-filter`)||`all`;this.setFeedCategory(t)})});let l=document.getElementById(`toggleFilters`);l&&l.addEventListener(`click`,()=>{this.toggleFiltersPanel()});let u=document.getElementById(`mobileSearchTrigger`);u&&u.addEventListener(`click`,()=>this.toggleSearchLayer()),document.querySelectorAll(`[data-close-search-layer]`).forEach(e=>{e.addEventListener(`click`,()=>this.closeSearchLayer())});let d=document.getElementById(`closeSearchLayer`);d&&d.addEventListener(`click`,()=>this.closeSearchLayer()),document.querySelectorAll(`.sl-cat-btn[data-cat-filter]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-cat-filter`)||`all`;this.setFeedCategory(t),this.updateSearchLayerCatState(t),this.closeSearchLayer()})}),this.selectedCategories=[],this.selectedPostedDates=[],this.selectedDeadlines=[],this.selectedClassTypes=[],this.selectedPostedBy=[],document.querySelectorAll(`.filter-chip[data-category]`).forEach(e=>{e.addEventListener(`click`,e=>this.toggleFilterChip(e.target,`category`))}),document.querySelectorAll(`.filter-chip[data-posted]`).forEach(e=>{e.addEventListener(`click`,e=>this.toggleFilterChip(e.target,`posted`))}),document.querySelectorAll(`.filter-chip[data-deadline]`).forEach(e=>{e.addEventListener(`click`,e=>this.toggleFilterChip(e.target,`deadline`))}),document.querySelectorAll(`.filter-chip[data-classtype]`).forEach(e=>{e.addEventListener(`click`,e=>this.toggleFilterChip(e.target,`classtype`))}),document.querySelectorAll(`.filter-chip[data-postedby]`).forEach(e=>{e.addEventListener(`click`,e=>this.toggleFilterChip(e.target,`postedby`))});let f=document.getElementById(`showExpiredToggle`);f&&f.addEventListener(`change`,()=>this.applyFilters());let p=document.getElementById(`resourceCategoryFilters`);p&&p.addEventListener(`click`,e=>{let t=e.target.closest(`.resource-category-chip, .resource-category-tile`);if(!t)return;let n=t.getAttribute(`data-resource-category`)||`all`;n!==`all`&&b(`category_click`,{category:n,contentType:`category`}),this.openResourceShortcut(n)}),document.addEventListener(`click`,e=>{let t=e.target.closest(`[data-resource-shortcut]`);if(!t)return;let n=t.getAttribute(`data-resource-shortcut`);n&&(b(`category_click`,{category:n,contentType:`category`}),this.openResourceShortcut(n))});let m=document.getElementById(`feedCategoryClear`);m&&m.addEventListener(`click`,()=>this.setFeedCategory(`all`)),this.setupResourceDetailSheet(),document.addEventListener(`click`,e=>{let t=e.target.closest(`[data-analytics-action]`);t&&b(t.getAttribute(`data-analytics-action`),{postId:t.getAttribute(`data-analytics-post-id`)||``,category:t.getAttribute(`data-analytics-category`)||``,contentType:t.getAttribute(`data-analytics-content-type`)||`post`})});let h=document.getElementById(`closeBulletinDetail`);h&&h.addEventListener(`click`,()=>this.closeBulletinDetail());let g=document.getElementById(`bulletinDetailModal`);g&&g.addEventListener(`click`,e=>{e.target===g&&this.closeBulletinDetail()}),document.addEventListener(`keydown`,e=>{if(e.key===`Escape`){if(typeof window.isImageLightboxOpen==`function`&&window.isImageLightboxOpen())return;if(this.isSearchLayerOpen){this.closeSearchLayer();return}let e=document.getElementById(`catDetailSheet`);if(e&&e.classList.contains(`open`)){this.closeResourceDetailSheet();return}let t=document.getElementById(`bulletinDetailModal`);t&&t.style.display===`flex`&&this.closeBulletinDetail()}}),document.addEventListener(`click`,this.handleDescriptionToggle),this.setupResourceSort(),this.setupCopyLinks(),this.setupBackToTop(),document.querySelectorAll(`[data-dates-view]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-dates-view`);t&&(this.datesViewMode=t,this.renderCalendar(this.filteredPosts.length>0?this.filteredPosts:this.getPostBulletins(this.bulletins)))})});let _=window.matchMedia(`(min-width: 768px)`).matches;window.addEventListener(`resize`,()=>{let e=window.matchMedia(`(min-width: 768px)`).matches;e!==_&&(_=e,this.renderResourcesSections(this.getPublishedResources()))});let v=window.matchMedia(`(min-width: 1024px)`).matches;window.addEventListener(`resize`,()=>{let e=window.matchMedia(`(min-width: 1024px)`).matches;e!==v&&(v=e,this.renderCalendar(this.filteredPosts.length>0?this.filteredPosts:this.getPostBulletins(this.bulletins)))})}setupResourceDetailSheet(){let e=document.getElementById(`catDetailSheet`),t=document.getElementById(`catDetailBackdrop`),n=document.getElementById(`catDetailBack`),r=document.getElementById(`catDetailClose`);if(!e)return;[n,r,t].forEach(e=>{e&&e.addEventListener(`click`,()=>this.closeResourceDetailSheet())}),document.addEventListener(`click`,e=>{e.target.closest(`#catDetailClose, #catDetailBack, #catDetailBackdrop`)&&(e.preventDefault(),e.stopPropagation(),this.closeResourceDetailSheet())},!0),e.addEventListener(`click`,e=>{let t=e.target.closest(`[data-cat-show-all]`);if(!t)return;let n=t.getAttribute(`data-cat-show-all`);n&&this.openResourceDetailSheet(n,{showAll:!0})});let i=0,a=0,o=!1,s=null,c=()=>{o=!1,s=null,e.style.removeProperty(`--cat-sheet-drag-y`),e.classList.remove(`is-dragging`)};e.addEventListener(`pointerdown`,t=>{window.matchMedia(`(max-width: 767px)`).matches&&(t.target.closest(`button, a`)||t.target.closest(`.cat-detail-topbar`)&&(s=t.pointerId,i=t.clientY,a=t.clientY,o=!0,e.classList.add(`is-dragging`),e.setPointerCapture(s)))});let l=t=>{i=t,a=t,o=!0,s=`fallback`,e.classList.add(`is-dragging`)},u=t=>{if(!o)return;a=t;let n=Math.max(0,a-i);e.style.setProperty(`--cat-sheet-drag-y`,`${n}px`)},d=()=>{if(!o)return;let e=Math.max(0,a-i);c(),e>78&&this.closeResourceDetailSheet()};e.addEventListener(`mousedown`,e=>{window.matchMedia(`(max-width: 767px)`).matches&&(e.target.closest(`button, a`)||e.target.closest(`.cat-detail-topbar`)&&l(e.clientY))}),document.addEventListener(`mousemove`,e=>{s===`fallback`&&u(e.clientY)}),document.addEventListener(`mouseup`,()=>{s===`fallback`&&d()}),e.addEventListener(`touchstart`,e=>{window.matchMedia(`(max-width: 767px)`).matches&&(e.target.closest(`button, a`)||e.target.closest(`.cat-detail-topbar`)&&l(e.touches[0].clientY))},{passive:!0}),document.addEventListener(`touchmove`,e=>{s!==`fallback`||e.touches.length===0||u(e.touches[0].clientY)},{passive:!0}),document.addEventListener(`touchend`,()=>{s===`fallback`&&d()});let f=t=>{if(!o||t.pointerId!==s)return;a=t.clientY;let n=Math.max(0,a-i);e.style.setProperty(`--cat-sheet-drag-y`,`${n}px`)},p=e=>{if(!o||e.pointerId!==s)return;let t=Math.max(0,a-i);c(),t>78&&this.closeResourceDetailSheet()};e.addEventListener(`pointermove`,f),e.addEventListener(`pointerup`,p),document.addEventListener(`pointermove`,f),document.addEventListener(`pointerup`,p),e.addEventListener(`pointercancel`,c)}setupResourceSort(){let e=document.querySelectorAll(`.resource-sort-btn`);e.forEach(t=>{t.addEventListener(`click`,()=>{e.forEach(e=>e.classList.remove(`active`)),t.classList.add(`active`),this.resourceSortMode=t.dataset.sort,this.renderResourceList(this.getPublishedResources())})})}setupCopyLinks(){document.addEventListener(`click`,async e=>{let t=e.target.closest(`.resource-copy-btn`);if(!t)return;e.preventDefault(),e.stopPropagation();let n=t.dataset.url;try{await navigator.clipboard.writeText(n),t.classList.add(`copied`),setTimeout(()=>{t.classList.remove(`copied`)},2e3)}catch(e){console.error(`Failed to copy:`,e)}})}setupBackToTop(){let e=document.getElementById(`backToTop`);if(!e)return;let t=!1,n=()=>{let n=window.scrollY>400;e.classList.toggle(`visible`,n),t=!1};window.addEventListener(`scroll`,()=>{t||=(requestAnimationFrame(n),!0)},{passive:!0}),e.addEventListener(`click`,()=>{window.scrollTo({top:0,behavior:`smooth`})})}switchView(e,t={}){[`feed`,`calendar`,`resources`,`about`,`advisors`].includes(e)&&(this.currentView=e,document.body.setAttribute(`data-current-view`,e),e===`advisors`&&this.renderStudentAdvisorDirectory(),window.matchMedia(`(max-width: 768px)`).matches&&window.scrollTo({top:0,behavior:`smooth`}),document.querySelectorAll(`[data-view-panel]`).forEach(t=>{t.classList.toggle(`active`,t.getAttribute(`data-view-panel`)===e)}),document.querySelectorAll(`[data-app-view]`).forEach(t=>{let n=t.getAttribute(`data-app-view`)===e;t.classList.toggle(`active`,n),t.setAttribute(`aria-pressed`,String(n)),t.classList.contains(`mobile-tab`)&&t.setAttribute(`aria-current`,n?`page`:`false`)}),e!==`feed`&&!t.preserveDetail&&this.closeBulletinDetail(!1),e!==`feed`&&e!==`resources`&&this.closeSearchLayer({preserveScroll:!0,silent:!0}),this.syncHeaderSearchButton(),this.updateSearchPlaceholder(),!t.skipRender&&e!==`advisors`&&(this.filteredPosts.length>0||this.bulletins.length===0?this.displayBulletins(this.filteredPosts):this.applyFilters()))}getAdvisorInitials(e=``){return e.trim().split(/\s+/).map(e=>e[0]||``).join(``).slice(0,2).toUpperCase()}getAdvisorAvatarColor(e,t=i.length){let n=Math.max(Number(t)||1,1),r=Math.round(e*360/n)%360,a=r>=45&&r<=70;return{background:`hsl(${r} ${a?48:38}% ${a?74:68}%)`,color:`hsl(${r} 36% 28%)`}}renderStudentAdvisorDirectory(){let e=document.getElementById(`advisorsDirectoryList`);e&&(e.innerHTML=i.map((e,t)=>{let n=this.escapeHtml(e.name),r=this.escapeHtml(e.role),a=this.escapeHtml(e.email||``),o=this.escapeHtml(this.getAdvisorInitials(e.name)),s=this.getAdvisorAvatarColor(t,i.length);return`
                <article class="advisor-dir-card">
                    <div class="advisor-dir-avatar" style="background:${s.background};color:${s.color}" aria-hidden="true">${o}</div>
                    <div class="advisor-dir-card-body">
                        <h2 class="advisor-dir-name">${n}</h2>
                        <p class="advisor-dir-role">${r}</p>
                    </div>
                    <a class="advisor-dir-email-btn" href="mailto:${a}" aria-label="Email ${n} at ${a}">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                            <path d="m3 7 9 6 9-6"></path>
                        </svg>
                        <span class="en-text">Email</span>
                        <span class="es-text">Correo</span>
                    </a>
                </article>
            `}).join(``))}displayBulletins(e=null){if(e===null){this.applyFilters();return}let t=e.filter(e=>!this.isResourceBulletin(e)),n=this.getPublishedResources();this.filteredPosts=t,this.updateFeedCategoryHeader(),this.updateActiveCategoryState(),this.updateResultsInfo(t);let r=t.filter(e=>!this.isCalendarEventBulletin(e));this.renderFeed(r),this.renderCalendar(t),this.renderHomeUpcomingEvents(t),this.renderResourcesSections(n),this.syncHeaderSearchButton(),this.handleHashRouting()}updateResultsInfo(e){let t=document.getElementById(`resultsInfo`);if(!t)return;let n=document.getElementById(`searchInput`),r=n?n.value.trim():``;if((this.currentFeedCategory||`all`)!==`all`&&!r&&this.selectedPostedDates.length===0&&this.selectedDeadlines.length===0&&this.selectedClassTypes.length===0&&this.selectedPostedBy.length===0){t.style.display=`none`;return}if(this.areFiltersApplied()){t.textContent=`Showing ${e.length} of ${this.getPostBulletins(this.bulletins).length} bulletins`,t.style.display=`block`;return}t.style.display=`none`}updateFeedCategoryHeader(){let e=document.getElementById(`feedCategoryHeader`),t=document.getElementById(`feedCategoryIcon`),n=document.getElementById(`feedCategoryKicker`),r=document.getElementById(`feedCategoryTitle`),i=document.getElementById(`feedCategoryDescription`),a=document.getElementById(`feedCategoryChips`),o=document.getElementById(`feedCategoryResources`);if(!e||!t||!n||!r||!i||!a||!o)return;let s=this.currentFeedCategory||`all`,c=E[s]||E.all;e.hidden=s===`all`,t.textContent=c.icon,n.textContent=`Showing: ${c.title}`,r.textContent=c.title,i.textContent=c.description,a.innerHTML=c.chips.map(e=>`<span>${this.escapeHtml(e)}</span>`).join(``),o.innerHTML=``,o.hidden=!0}createFeedCategoryResourcesHtml(e){if(e===`all`)return``;let t=e===`job`?`jobs`:e===`childcare`?`family`:e,n=this.getPublishedResources().filter(e=>this.resourceMatchesCategory(e,t)).slice(0,3);return n.length===0?`
                <div class="feed-category-resource-empty">
                    <strong>No help links listed yet for this topic.</strong>
                    <span>Ask your advisor — they can point you to trusted places.</span>
                </div>
            `:`
            <div class="feed-category-resource-heading">
                <span>Trusted places nearby</span>
                <small>Call or visit for free help</small>
            </div>
            <div class="feed-category-resource-grid">
                ${n.map(e=>this.createFeedCategoryResourceCard(e)).join(``)}
            </div>
        `}createFeedCategoryResourceCard(e){let{titleEn:t}=this.getResourceTitles(e),n=e.description?this.escapeHtml(e.description):``,r=this.getResourceUrl(e),i=e.phone||``,a=e.tel||(i?`tel:${i.replace(/[^0-9+]/g,``)}`:``),o=e.address||``,s=e.mapUrl||(o?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o)}`:``),c=a||(r===`#`?s:r),l=a?`Call`:r===`#`?`Directions`:`Website`;return`
            <article class="feed-category-resource-card">
                <h3>${this.escapeHtml(t)}</h3>
                ${n?`<p>${n}</p>`:``}
                ${o?`<small>${this.escapeHtml(o)}</small>`:``}
                <div class="feed-category-resource-actions">
                    ${c?`<a href="${this.escapeAttribute(c)}" ${c.startsWith(`http`)?`target="_blank" rel="noopener"`:``}>${l}</a>`:``}
                    ${s?`<a href="${this.escapeAttribute(s)}" target="_blank" rel="noopener">Directions</a>`:``}
                </div>
            </article>
        `}updateSearchLayerCatState(e){let t=this.normalizeFeedCategory(e);document.querySelectorAll(`.sl-cat-btn[data-cat-filter]`).forEach(e=>{let n=e.getAttribute(`data-cat-filter`),r=n===`all`?t===`all`:this.normalizeFeedCategory(n)===t;e.classList.toggle(`active`,r)})}updateActiveCategoryState(){let e=this.currentFeedCategory||`all`;document.querySelectorAll(`.cat-chip[data-cat-filter]`).forEach(t=>{let n=this.normalizeFeedCategory(t.getAttribute(`data-cat-filter`)||`all`);t.classList.toggle(`active`,n===e||e===`all`&&n===`all`)}),document.querySelectorAll(`.story-bubble[data-app-view-cat]`).forEach(t=>{let n=this.normalizeFeedCategory(t.getAttribute(`data-app-view-cat`)||`all`);t.classList.toggle(`active`,n===e),t.setAttribute(`aria-pressed`,String(n===e))})}toggleSearchLayer(){this.isSearchLayerOpen?this.closeSearchLayer():this.openSearchLayer()}openSearchLayer(){this.currentView!==`feed`&&this.switchView(`feed`,{skipRender:!0,preserveDetail:!0}),this.isSearchLayerOpen=!0;let e=document.getElementById(`searchLayer`);e&&(e.classList.add(`open`),e.setAttribute(`aria-hidden`,`false`)),document.body.classList.add(`search-layer-open`),this.syncHeaderSearchButton(),window.matchMedia(`(max-width: 768px)`).matches&&window.setTimeout(()=>{document.getElementById(`searchInput`)?.focus()},180)}closeSearchLayer(e={}){this.isSearchLayerOpen=!1;let t=document.getElementById(`searchLayer`);t&&(t.classList.remove(`open`),t.setAttribute(`aria-hidden`,`true`)),document.body.classList.remove(`search-layer-open`),e.silent||this.syncHeaderSearchButton()}syncHeaderSearchButton(){let e=document.getElementById(`mobileSearchTrigger`);if(!e)return;let t=this.currentView===`feed`||this.currentView===`resources`;e.hidden=!t;let n=this.currentView===`resources`?this.resourceSearchQuery&&this.resourceSearchQuery.trim()!==``:this.areFiltersApplied();e.classList.toggle(`active`,t&&(this.isSearchLayerOpen||n)),e.setAttribute(`aria-expanded`,t&&this.isSearchLayerOpen?`true`:`false`)}updateSearchPlaceholder(){let e=document.getElementById(`searchInput`),t=document.getElementById(`desktopTopbarSearchInput`),n=document.getElementById(`mobileInlineSearchInput`),r=document.body.getAttribute(`data-lang`)===`ES`,i=this.currentView===`resources`,a=i?r?`Busca ayuda...`:`Search help...`:r?`Busca ayuda, anuncios y eventos...`:`Search for help, announcements, and events...`,o=i?r?`Busca ayuda...`:`Search help...`:r?`¿Con qué necesitas ayuda?`:`What do you need help with?`;t&&(t.placeholder=a),[e,n].filter(Boolean).forEach(e=>{e.placeholder=o})}renderFeed(e){let t=document.getElementById(`bulletinGrid`),n=document.getElementById(`feedEmptyState`);if(!(!t||!n)){if(e.length===0){t.innerHTML=``,n.innerHTML=this.areFiltersApplied()?`<h3>No bulletins found</h3><p>Try adjusting your search or filter criteria.</p>`:`<h3>No bulletins posted yet</h3><p>Advisors can log in to post job opportunities, training sessions, and important announcements.</p>`,n.style.display=`block`;return}n.style.display=`none`,t.innerHTML=e.map((e,t)=>this.createBulletinCard(e,t)).join(``),this.trackRenderedCardViews(e)}}trackRenderedCardViews(e){e.forEach(e=>{!e.id||this.trackedCardViews.has(e.id)||(this.trackedCardViews.add(e.id),b(`card_view`,{postId:e.id,category:e.category,contentType:e.type||`post`}))})}renderCalendar(e){let t=document.getElementById(`bulletinCalendar`),n=document.getElementById(`calendarEmptyState`),r=document.getElementById(`bulletinCalendarDesktopGrid`);if(!t||!n)return;let i=S(e),a=i.filter(e=>this.bulletinHasCalendarDates(e));if(a.length===0){t.innerHTML=``,r&&(r.innerHTML=``),n.style.display=`block`;return}n.style.display=`none`,this.updateDatesViewToggle(),window.matchMedia(`(min-width: 1024px)`).matches?(t.innerHTML=this.createDatesListView(a),r&&(r.innerHTML=this.createCalendarView(i,{navigatorMode:!0}),this.bindCalendarDayScroll(r))):(t.innerHTML=this.datesViewMode===`calendar`?this.createCalendarView(i):this.createDatesListView(a),r&&(r.innerHTML=``))}bindCalendarDayScroll(e){e.querySelectorAll(`[data-calendar-day]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.getAttribute(`data-calendar-day`);if(!t)return;let n=document.querySelector(`[data-list-date="${t}"]`);if(!n)return;let r=parseInt(getComputedStyle(document.documentElement).getPropertyValue(`--app-header-offset`)||`70`,10),i=window.scrollY+n.getBoundingClientRect().top-r-16;window.scrollTo({top:Math.max(0,i),behavior:`smooth`}),n.classList.add(`list-card-pulse`),setTimeout(()=>n.classList.remove(`list-card-pulse`),1400)})})}renderHomeUpcomingEvents(e){let t=document.getElementById(`homeUpcomingEvents`);if(!t)return;let n=new Date;n.setHours(0,0,0,0);let r=S(e).flatMap(e=>{if(e.dateType===`sessions`)return this.getBulletinEventDates(e).map(t=>({bulletin:e,rawDate:t,timestamp:this.getTimestampValue(t)}));let t=e.eventDate||e.startDate||e.deadline;return[{bulletin:e,rawDate:t,timestamp:this.getTimestampValue(t)}]}).filter(e=>e.timestamp&&e.timestamp>=n.getTime()).sort((e,t)=>e.timestamp-t.timestamp).slice(0,3);if(r.length===0){t.innerHTML=`<div class="side-empty">Events with dates will appear here.</div>`;return}t.innerHTML=r.map(({bulletin:e,rawDate:t,timestamp:n})=>{let r=new Date(n),i=r.toLocaleDateString(`en-US`,{month:`short`}).toUpperCase(),a=r.toLocaleDateString(`en-US`,{day:`numeric`}),o=[r.toLocaleDateString(`en-US`,{weekday:`long`}),e.startTime||``].filter(Boolean).join(` · `);return`
                <button class="side-event" type="button" onclick="window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${e.id}')">
                    <div class="side-date"><span>${i}</span><strong>${a}</strong></div>
                    <div>
                        <p class="side-event-title">${this.escapeHtml(e.title||`Upcoming event`)}</p>
                        <p class="side-event-meta">${this.escapeHtml(o||`Date posted`)}</p>
                    </div>
                    <span class="side-event-arrow" aria-hidden="true">›</span>
                </button>
            `}).join(``)}updateDatesViewToggle(){document.querySelectorAll(`[data-dates-view]`).forEach(e=>{let t=e.getAttribute(`data-dates-view`)===this.datesViewMode;e.classList.toggle(`active`,t),e.setAttribute(`aria-pressed`,String(t))})}renderResourcesSections(e){let t=this.getStoryBubbleResources(e);this.renderResourceStoryRow(`headerResourceStoryRow`,`headerResourceEmpty`,t),this.renderResourceStoryRow(`feedDesktopResourceRow`,null,t),this.renderResourceStoryRow(`resourceStoryRow`,`resourceStoryEmpty`,t),this.renderResourceStoryRow(`resourceStoryRowPage`,null,t),this.renderHeroResources(e),this.renderResourceCategoryFilters(),this.renderResourceList(e),document.querySelector(`.resources-desktop-layout`)&&this.renderResourcesDesktop(e)}renderHeroResources(e){let t=document.getElementById(`heroResourcesGrid`);if(!t)return;let n=new Set;e.forEach(e=>{let t=this.getResourceCategoryKey(e);t&&n.add(t)}),t.innerHTML=(n.size>0?Array.from(n):w).map(e=>{let t=C[e];if(!t)return``;let n=D[t.icon]||D.globe;return`
                <button
                    type="button"
                    class="hero-resource-card resource-${e}"
                    data-resource-category="${e}"
                    aria-label="View ${t.labelEn} help"
                >
                    <span class="hero-resource-icon" aria-hidden="true">
                        ${n}
                    </span>
                    <span class="hero-resource-label">
                        ${t.labelEn}
                        <small>${t.labelEs}</small>
                    </span>
                </button>
            `}).join(``)||`<p class="hero-resources-empty">No help links available yet.</p>`,t.querySelectorAll(`.hero-resource-card`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.resourceCategory;this.openResourceShortcut(t)})})}renderResourceStoryRow(e,t,n){let r=document.getElementById(e);if(!r)return;if(r.innerHTML=n.map(e=>this.createResourceStoryBubble(e)).join(``),!t){r.style.display=n.length>0?`flex`:`none`;return}let i=document.getElementById(t);if(!i)return;let a=n.length>0;r.style.display=a?`flex`:`none`,i.style.display=a?`none`:`block`}renderResourceCategoryFilters(){let e=document.getElementById(`resourceCategoryFilters`);if(!e)return;let t=this.getPublishedResources();e.innerHTML=T.map(e=>{let n=C[e];if(!n)return``;let r=t.filter(t=>this.getResourceCategoryKey(t)===e).length,i=D[n.icon]||D.globe,a=this.getResourceCountNoun(r,`en`),o=this.getResourceCountNoun(r,`es`);return`
            <button
                type="button"
                class="resource-category-tile resource-tile-${e}"
                data-resource-category="${e}"
                aria-label="${this.escapeAttribute(`${n.labelEn} / ${n.labelEs}, ${r} ${a}`)}"
            >
                <span class="resource-category-tile-icon" style="background:${n.color}" aria-hidden="true">
                    ${i}
                </span>
                <span class="resource-category-tile-copy">
                    <strong>
                        <span class="en-text">${this.escapeHtml(n.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(n.labelEs)}</span>
                    </strong>
                    <small>
                        <span class="en-text">${r} ${a}</span>
                        <span class="es-text">${r} ${o}</span>
                    </small>
                </span>
            </button>
        `}).join(``)}renderResourceList(e){let t=document.getElementById(`resourcesList`),n=document.getElementById(`resourceEmptyState`),r=document.getElementById(`resourceSortBar`);if(!t||!n)return;if(!(this.currentResourceCategory&&this.currentResourceCategory!==`all`||this.resourceSearchQuery&&this.resourceSearchQuery.trim()!==``)){t.innerHTML=``,t.style.display=`none`,t.setAttribute(`aria-hidden`,`true`),n.style.display=`none`,r&&(r.hidden=!0);return}t.style.display=``,t.setAttribute(`aria-hidden`,`false`),r&&(r.hidden=!1);let i=this.currentResourceCategory===`all`?e:e.filter(e=>this.resourceMatchesCategory(e,this.currentResourceCategory));if(i=this.filterResourcesBySearch(i,this.resourceSearchQuery),i=this.sortResources(i,this.resourceSortMode),i.length===0){t.innerHTML=``,t.style.display=`none`,n.innerHTML=this.resourceSearchQuery&&this.resourceSearchQuery.trim()!==``?`<h3>No results found</h3><p>Try a different search term or clear filters.</p><p class="empty-state-bilingual">No se encontraron resultados. Pruebe un término diferente o borre los filtros.</p>`:e.length===0?`<h3>No help links published yet</h3><p>Advisors can add quick links in the admin portal so they appear here for students.</p>`:`<h3>No help links in this category</h3><p>Try another category to see more support links.</p>`,n.style.display=`block`;return}n.style.display=`none`,t.innerHTML=i.map(e=>this.createResourceCard(e)).join(``)}filterResourcesBySearch(e,t){if(!t||t.trim()===``)return e;let n=t.toLowerCase().trim();return e.filter(e=>{let{titleEn:t,titleEs:r}=this.getResourceTitles(e),i=e.description||``,a=this.getResourceCategoryKey(e);return t.toLowerCase().includes(n)||r.toLowerCase().includes(n)||i.toLowerCase().includes(n)||a.toLowerCase().includes(n)})}isResourceFree(e){if(e.isFree===!0||e.free===!0)return!0;let t=[e.highlights,e.description,e.title,e.titleEn,e.titleEs].join(` `).toLowerCase();return/\bfree\b|\bgratis\b|\bgratuito\b/.test(t)}isResourceWalkIn(e){if(e.isWalkIn===!0||e.walkIn===!0)return!0;let t=[e.highlights,e.description,e.title,e.titleEn,e.titleEs].join(` `).toLowerCase();return/walk[\s-]?in|sin cita|drop[\s-]?in/.test(t)}isResourceSpanishSpoken(e){if(Array.isArray(e.languages)){let t=e.languages.join(` `).toLowerCase();if(/spanish|español|espanol/.test(t))return!0}if(e.bilingual===!0)return!0;let t=[e.highlights,e.description].join(` `).toLowerCase();return/spanish|español|espanol|se habla/.test(t)}isResourceOpenNow(e){let t=(e.hours||e.hoursOfOperation||e.schedule||``).toLowerCase().trim();if(!t)return!1;if(/24\/7|open 24/.test(t))return!0;let n=new Date,r=n.getDay(),i=n.getHours()*60+n.getMinutes(),a={sun:0,sunday:0,mon:1,monday:1,tue:2,tues:2,tuesday:2,wed:3,wednesday:3,thu:4,thur:4,thurs:4,thursday:4,fri:5,friday:5,sat:6,saturday:6},o=e=>{let t=e.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);if(!t)return null;let n=parseInt(t[1],10),r=parseInt(t[2]||`0`,10),i=(t[3]||``).toLowerCase();return i===`pm`&&n!==12&&(n+=12),i===`am`&&n===12&&(n=0),n*60+r},s=t.split(/[,;|]/);for(let e of s){let t=e.match(/([a-z]+(?:[\s-][a-z]+)?)[:\s]*([\d:]+\s*(?:am|pm)?)\s*[-–]\s*([\d:]+\s*(?:am|pm)?)/i);if(!t)continue;let n=t[1].trim().toLowerCase(),s=o(t[2]),c=o(t[3]);if(s===null||c===null)continue;let l=n.split(/[-–]/).map(e=>a[e.trim()]),u=l[0]??-1,d=l[1]??u;if(u!==-1&&!(r<u||r>d)){if(c>s){if(i>=s&&i<c)return!0}else if(i>=s||i<c)return!0}}return!1}getResourceBadgesHtml(e){let t=[];return this.isResourceFree(e)&&t.push(`<span class="badge badge--free"><span class="en-text">Free</span><span class="es-text">Gratis</span></span>`),this.isResourceWalkIn(e)&&t.push(`<span class="badge badge--walkin"><span class="en-text">Walk-in</span><span class="es-text">Sin cita</span></span>`),this.isResourceOpenNow(e)?t.push(`<span class="badge badge--open"><span class="en-text">Open now</span><span class="es-text">Abierto</span></span>`):(e.hours||e.hoursOfOperation)&&t.push(`<span class="badge badge--closed"><span class="en-text">Closed</span><span class="es-text">Cerrado</span></span>`),t.length===0?``:`<div class="resource-badges-container">${t.join(``)}</div>`}formatCompactAddress(e=``){let t=e.split(`,`).map(e=>e.trim()).filter(Boolean);return t.length>=2?`${t[0]} · ${t[1].replace(/\s+[A-Z]{2}(\s+\d{5}(?:-\d{4})?)?$/i,``).trim()||t[1]}`:e.trim()}getResourceSheetSubtitle(e){let{titleEn:t}=this.getResourceTitles(e),n=(e.company||``).trim(),r=(e.address||``).trim(),i=r?this.formatCompactAddress(r):``;if(i)return n&&n!==t?`${n} · ${i.split(` · `).pop()}`:i;if(n&&n!==t)return n;let a=(e.description||``).trim();if(!a)return``;if(a.length<=72)return a;let o=a.slice(0,72),s=o.lastIndexOf(` `);return`${(s>40?o.slice(0,s):o).trim()}…`}getResourceCountNoun(e,t=`en`){return t===`es`?e===1?`recurso`:`recursos`:e===1?`resource`:`resources`}getResourceCountText(e,t=`en`){return`${e} ${this.getResourceCountNoun(e,t)}`}renderResourcesDesktop(e){let t=document.getElementById(`desktopCategoryNav`),n=document.getElementById(`resourcesDesktopSections`),r=document.getElementById(`resourceDesktopEmptyState`);if(!t||!n)return;let i=document.getElementById(`searchInput`)?.value||document.getElementById(`desktopTopbarSearchInput`)?.value||``,a=this.filterResourcesBySearch(e,i),o={};T.forEach(e=>{o[e]=[]}),a.forEach(e=>{let t=this.getResourceCategoryKey(e);o[t]&&o[t].push(e)}),t.innerHTML=T.map(e=>{let t=C[e];if(!t)return``;let n=(o[e]||[]).length,r=D[t.icon]||D.globe;return`
                <button
                    type="button"
                    class="desktop-cat-btn"
                    data-desktop-cat="${e}"
                    style="--topic-color:${t.color}20;--topic-text:${t.color}"
                    aria-label="${this.escapeAttribute(t.labelEn+` / `+t.labelEs)}"
                >
                    <span class="desktop-cat-icon" style="background:${t.color}" aria-hidden="true">${r}</span>
                    <span class="desktop-cat-label">
                        <span class="en-text">${this.escapeHtml(t.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(t.labelEs)}</span>
                    </span>
                    ${n>0?`<span class="desktop-cat-count" style="background:${t.color}20;color:${t.color}">${n}</span>`:``}
                </button>
            `}).join(``),t.querySelectorAll(`.desktop-cat-btn`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.desktopCat;if(!n)return;let r=document.getElementById(`desktop-section-${n}`);if(r){let n=parseInt(getComputedStyle(document.documentElement).getPropertyValue(`--app-header-offset`)||`70`,10),i=window.scrollY+r.getBoundingClientRect().top-n-16;window.scrollTo({top:Math.max(0,i),behavior:`smooth`}),t.querySelectorAll(`.desktop-cat-btn`).forEach(e=>e.classList.remove(`active`)),e.classList.add(`active`)}})});let s=T.filter(e=>(o[e]||[]).length>0);if(s.length===0){n.innerHTML=``,r&&(r.style.display=`block`);return}r&&(r.style.display=`none`),n.innerHTML=s.map(e=>{let t=C[e];if(!t)return``;let n=o[e],r=n.slice(0,3),i=n.length>3,a=D[t.icon]||D.globe,s=r.map(e=>this.createResourceDetailCard(e,t,{compact:!1})).join(``),c=i?`
                <button class="cat-org-show-all desktop-section-see-all" type="button"
                    data-desktop-show-all="${this.escapeAttribute(e)}"
                    style="--cat-accent:${t.color}">
                    <span class="en-text">See all ${this.escapeHtml(t.labelEn.toLowerCase())} — ${this.getResourceCountText(n.length,`en`)}</span>
                    <span class="es-text">Ver ${this.getResourceCountText(n.length,`es`)}</span>
                    <span aria-hidden="true">&rarr;</span>
                </button>
            `:``;return`
                <section class="desktop-resource-section" id="desktop-section-${e}" style="--cat-accent:${t.color}">
                    <div class="desktop-section-header">
                        <span class="desktop-section-icon" style="background:${t.color}" aria-hidden="true">${a}</span>
                        <div class="desktop-section-title-group">
                            <h2 class="desktop-section-title">
                                <span class="en-text">${this.escapeHtml(t.labelEn)}</span>
                                <span class="es-text">${this.escapeHtml(t.labelEs)}</span>
                            </h2>
                            <p class="desktop-section-count">
                                <span class="en-text">${this.getResourceCountText(n.length,`en`)}</span>
                                <span class="es-text">${this.getResourceCountText(n.length,`es`)}</span>
                            </p>
                        </div>
                    </div>
                    <div class="desktop-section-grid">
                        ${s}
                    </div>
                    ${c}
                </section>
            `}).join(``),n.querySelectorAll(`[data-desktop-show-all]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.desktopShowAll;t&&this.openResourceDetailSheet(t,{showAll:!0})})})}handleResourceSpeech(e,t){if(!window.speechSynthesis)return;if(t.classList.contains(`speaking`)){window.speechSynthesis.cancel(),t.classList.remove(`speaking`),t.setAttribute(`aria-label`,`Read aloud`);return}window.speechSynthesis.cancel(),document.querySelectorAll(`.resource-audio-btn.speaking`).forEach(e=>{e.classList.remove(`speaking`),e.setAttribute(`aria-label`,`Read aloud`)});let n=document.documentElement.getAttribute(`data-lang`)===`ES`||document.body.classList.contains(`lang-es`)?`es-US`:`en-US`,r=new SpeechSynthesisUtterance(e);r.lang=n;let i=window.speechSynthesis.getVoices(),a=i.find(e=>e.lang===n)||i.find(e=>e.lang.startsWith(n.split(`-`)[0]));a&&(r.voice=a),t.classList.add(`speaking`),t.setAttribute(`aria-label`,`Stop reading`),r.onend=()=>{t.classList.remove(`speaking`),t.setAttribute(`aria-label`,`Read aloud`)},r.onerror=()=>{t.classList.remove(`speaking`),t.setAttribute(`aria-label`,`Read aloud`)},window.speechSynthesis.speak(r)}sortResources(e,t){let n=[...e];switch(t){case`newest`:return n.sort((e,t)=>{let n=this.getTimestampValue(e.datePosted||e.createdAt);return this.getTimestampValue(t.datePosted||t.createdAt)-n});case`az`:return n.sort((e,t)=>{let{titleEn:n}=this.getResourceTitles(e),{titleEn:r}=this.getResourceTitles(t);return n.localeCompare(r)});default:return n.sort((e,t)=>{let n=this.getResourceOrder(e),r=this.getResourceOrder(t);return n===r?this.getTimestampValue(t.datePosted||t.createdAt)-this.getTimestampValue(e.datePosted||e.createdAt):n-r})}}switchResourceCategory(e){this.currentResourceCategory=e,this.renderResourcesSections(this.getPublishedResources())}openResourceShortcut(e){let t={job:`jobs`,childcare:`family`,money:`money`,esol:`esol`,college:`college`,"legal-aid":`legal-aid`}[e]||e;this.openResourceDetailSheet(t)}setFeedCategory(e=`all`){let t=this.normalizeFeedCategory(e);this.currentView!==`feed`&&this.switchView(`feed`,{skipRender:!0,preserveDetail:!0}),this.currentFeedCategory=t,this.selectedCategories=t===`all`?[]:[t],this.updateFeedCategoryHeader(),this.updateActiveCategoryState(),this.updateSearchLayerCatState(t),this.updateFilterCount(),this.applyFilters()}normalizeFeedCategory(e){return o(e)}openResourceDetailSheet(e,t={}){let n=C[e],r=document.getElementById(`catDetailSheet`),i=document.getElementById(`catDetailTitle`),a=document.getElementById(`catDetailIcon`),o=document.getElementById(`catOrgList`);if(!n||!r||!o)return;let s=this.getPublishedResources().filter(t=>this.getResourceCategoryKey(t)===e),c=window.matchMedia(`(max-width: 767px)`).matches,l=!t.showAll,u=l?s.slice(0,3):s,d=D[n.icon]||D.globe;i&&(i.innerHTML=`
                <span class="en-text">${this.escapeHtml(n.labelEn)}</span>
                <span class="es-text">${this.escapeHtml(n.labelEs)}</span>
                <small>
                    <span class="en-text">${this.getResourceCountText(s.length,`en`)}</span>
                    <span class="es-text">${this.getResourceCountText(s.length,`es`)}</span>
                </small>
            `),a&&(a.style.background=n.color,a.innerHTML=d),r.style.setProperty(`--cat-accent`,n.color);let f=l&&s.length>u.length?this.createResourceSheetShowAllButton(e,n,s.length):``;o.innerHTML=u.length>0?u.map(e=>this.createResourceDetailCard(e,n,{compact:c})).join(``):`
            <div class="cat-org-empty">
                <strong>No help links listed yet.</strong>
                <span>Ask your advisor for trusted places nearby.</span>
            </div>
        `;let p=document.getElementById(`catSheetFooter`);p&&(p.innerHTML=f,p.style.display=f?``:`none`),this.resourceSheetCloseTimer&&=(window.clearTimeout(this.resourceSheetCloseTimer),null),r.classList.add(`open`),r.classList.toggle(`cat-detail-sheet--bottom`,c),r.classList.toggle(`cat-detail-sheet--desktop`,!c),r.classList.toggle(`cat-detail-sheet--expanded`,!l),r.setAttribute(`aria-hidden`,`false`),document.body.classList.add(`resource-sheet-open`);let m=r.querySelector(`.cat-detail-scroll`);m&&(m.scrollTop=0)}closeResourceDetailSheet(){let e=document.getElementById(`catDetailSheet`);if(e){let t=e.classList.contains(`cat-detail-sheet--bottom`),n=e.classList.contains(`cat-detail-sheet--desktop`);e.classList.remove(`open`,`is-dragging`),e.setAttribute(`aria-hidden`,`true`),e.style.removeProperty(`--cat-sheet-drag-y`),t||n?(this.resourceSheetCloseTimer&&window.clearTimeout(this.resourceSheetCloseTimer),this.resourceSheetCloseTimer=window.setTimeout(()=>{this.resourceSheetCloseTimer=null,e.classList.contains(`open`)||e.classList.remove(`cat-detail-sheet--bottom`,`cat-detail-sheet--desktop`,`cat-detail-sheet--expanded`)},280)):e.classList.remove(`cat-detail-sheet--bottom`,`cat-detail-sheet--desktop`,`cat-detail-sheet--expanded`)}document.body.classList.remove(`resource-sheet-open`)}createResourceSheetShowAllButton(e,t,n){return`
            <button class="cat-org-show-all" type="button" data-cat-show-all="${this.escapeAttribute(e)}" style="--cat-accent:${t.color}">
                <span class="en-text">See all ${this.escapeHtml(t.labelEn.toLowerCase())} — ${this.getResourceCountText(n,`en`)}</span>
                <span class="es-text">Ver ${this.getResourceCountText(n,`es`)}</span>
                <span aria-hidden="true">&rarr;</span>
            </button>
        `}createResourceDetailCard(e,t,n={}){let{titleEn:r}=this.getResourceTitles(e),i=n.compact===!0,a=i?this.getResourceSheetSubtitle(e):e.description||``,o=a?this.escapeHtml(a):``,s=this.getResourceUrl(e),c=e.websiteLabel||this.formatLinkLabel(s,this.getResourceCategoryKey(e)),l=e.phone||``,u=e.tel||(l?`tel:${l.replace(/[^0-9+]/g,``)}`:``),d=e.address||``,f=e.mapUrl||(d?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d)}`:``),p=Array.isArray(e.languages)?e.languages:this.parseResourceHighlights(e.highlights),m=p.length>0?`<div class="cat-org-langs">${p.slice(0,5).map(e=>`<span class="cat-org-lang-tag">${this.escapeHtml(e)}</span>`).join(``)}</div>`:``,h=l&&u?`<a href="${this.escapeAttribute(u)}" class="cat-org-btn cat-org-btn--call">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                    <span><strong>Call</strong><small>${this.escapeHtml(l)}</small></span>
                </a>`:``,g=s&&s!==`#`?`<a href="${this.escapeAttribute(s)}" target="_blank" rel="noopener" class="cat-org-btn cat-org-btn--website">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                    <span><strong>Website</strong><small>${this.escapeHtml(c)}</small></span>
                </a>`:``,_=f?`<a href="${this.escapeAttribute(f)}" target="_blank" rel="noopener" class="cat-org-btn cat-org-btn--directions">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    <span><strong>Directions</strong><small>${this.escapeHtml(d)}</small></span>
                </a>`:``,v=n.compact?h||g||_:``,y=[h,g||_].filter(Boolean).length,b=e.resourceLogo?`<div class="cat-org-logo"><img src="${this.escapeAttribute(e.resourceLogo)}" alt="${this.escapeAttribute(r)} logo" loading="lazy"></div>`:``,x=i?``:this.getResourceBadgesHtml(e);return`
            <article class="cat-org-card" style="--cat-accent:${t.color}">
                ${b}
                <div class="cat-org-main">
                    <h3 class="cat-org-name">${this.escapeHtml(r)}</h3>
                    ${x}
                    ${o?`<p class="cat-org-description">${o}</p>`:``}
                </div>
                ${!i&&d?`<p class="cat-org-address">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#758299" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    ${this.escapeHtml(d)}
                </p>`:``}
                ${m}
                <div class="cat-org-actions ${y===1||g&&h&&!_?`cat-org-actions--stack`:``}">
                    ${n.compact?v:`${h}${g||_}`}
                </div>
            </article>
        `}scrollElementBelowHeader(e,t={}){if(!e)return;let n=document.querySelector(`header`),r=n?n.getBoundingClientRect().height:0,i=t.gap??20,a=window.scrollY+e.getBoundingClientRect().top-r-i;window.scrollTo({top:Math.max(0,a),behavior:t.behavior||`smooth`})}getStoryBubbleResources(e){let t=[];return w.forEach(e=>{let n=C[e];n&&t.push({id:`bubble-${e}`,type:`resource`,title:n.labelEn,titleEn:n.labelEn,titleEs:n.labelEs,category:`resource`,resourceCategory:e,resourceIcon:n.icon,isPreviewBubble:!0})}),t}createResourceStoryBubble(e){let{titleEn:t,titleEs:n}=this.getResourceTitles(e),r=e.isPreviewBubble===!0,i=this.getResourceCategoryKey(e),a=this.getResourceUrl(e),o=this.escapeHtml(e.description||``);if(r)return`
                <button
                    type="button"
                    class="resource-story-bubble preview-story-bubble story-${i}"
                    data-resource-shortcut="${this.escapeAttribute(i)}"
                    title="${this.escapeAttribute(`${t} / ${n}`)}"
                    aria-label="${this.escapeAttribute(`${t} / ${n}`)}"
                >
                    <span class="resource-story-ring">
                        <span class="resource-story-icon" aria-hidden="true">
                            ${this.getResourceIconSvg(e)}
                        </span>
                    </span>
                    <span class="resource-story-copy">
                        <strong>${this.escapeHtml(t)}</strong>
                        <small>${this.escapeHtml(n)}</small>
                    </span>
                </button>
            `;let s=e.resourceLogo||``,c=s?`<img src="${this.escapeAttribute(s)}" alt="" class="resource-story-logo" loading="lazy">`:`<span class="resource-story-icon" aria-hidden="true">${this.getResourceIconSvg(e)}</span>`,l=s?`resource-story-ring resource-story-ring--logo`:`resource-story-ring`;return`
            <a
                class="resource-story-bubble story-${i}"
                href="${this.escapeAttribute(a)}"
                target="_blank"
                rel="noopener"
                title="${this.escapeAttribute(t)}"
                aria-label="${this.escapeAttribute(`${t} / ${n}`)}"
            >
                <span class="${l}">
                    ${c}
                </span>
                <span class="resource-story-copy">
                    <strong>${this.escapeHtml(t)}</strong>
                    <small>${this.escapeHtml(n)}</small>
                </span>
                ${o?`<span class="sr-only">${o}</span>`:``}
            </a>
        `}createResourceCard(e){let{titleEn:t,titleEs:n}=this.getResourceTitles(e),r=this.getResourceCategoryKey(e),i=this.getResourceCategoryConfig(e),a=e.description?this.escapeHtml(e.description):``,o=this.getResourceUrl(e),s=e.resourceLogo||``,c=this.parseResourceHighlights(e.highlights),l=c.length>0?`<span class="resource-card-highlights">
                ${c.map(e=>`<span class="resource-card-highlight">${this.escapeHtml(e)}</span>`).join(``)}
               </span>`:``,u=s?`<img src="${this.escapeAttribute(s)}" alt="" class="resource-card-logo" loading="lazy">`:this.getResourceIconSvg(e),d=s?`resource-card-icon resource-card-icon--logo`:`resource-card-icon`;return`
            <div class="resource-card-wrapper">
                <a
                    class="resource-card resource-card-${r}"
                    href="${this.escapeAttribute(o)}"
                    target="_blank"
                    rel="noopener"
                    data-analytics-action="resource_open"
                    data-analytics-post-id="${this.escapeAttribute(e.id||``)}"
                    data-analytics-category="${this.escapeAttribute(r)}"
                    data-analytics-content-type="resource"
                    aria-label="${this.escapeAttribute(`${t} / ${n}`)}"
                >
                    <span class="${d}" aria-hidden="true">
                        ${u}
                    </span>
                    <span class="resource-card-body">
                        <span class="resource-card-category">
                            <span class="resource-card-category-pill">${this.escapeHtml(i.labelEn)}</span>
                            <span class="resource-card-category-pill">${this.escapeHtml(i.labelEs)}</span>
                        </span>
                        <span class="resource-card-title">${this.escapeHtml(t)}</span>
                        <span class="resource-card-subtitle">${this.escapeHtml(n)}</span>
                        ${a?`<span class="resource-card-description">${a}</span>`:``}
                        ${l}
                    </span>
                    <span class="resource-card-link" aria-hidden="true">Open</span>
                </a>
                <button
                    type="button"
                    class="resource-copy-btn"
                    data-url="${this.escapeAttribute(o)}"
                    aria-label="Copy link"
                    title="Copy link"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                </button>
            </div>
        `}parseResourceHighlights(e){return e?Array.isArray(e)?e.slice(0,3):typeof e==`string`?e.split(`,`).map(e=>e.trim()).filter(Boolean).slice(0,3):[]:[]}getPostBulletins(e=this.bulletins){return e.filter(e=>!this.isResourceBulletin(e))}isCalendarEventBulletin(e){if(!e||this.isResourceBulletin(e))return!1;let t=e.dateType;if(t!==`event`&&t!==`range`&&t!==`sessions`)return!1;let n=!!((e.description||``).trim()||(e.company||``).trim()||(e.contact||``).trim()||(e.eventLink||``).trim()||e.image||e.pdfUrl);return e.category===`announcement`&&!n}getPublishedResources(){return[...this.bulletins].filter(e=>this.isResourceBulletin(e)&&e.isPublished!==!1).sort((e,t)=>{if(+!!e.isPinned!=+!!t.isPinned)return!!t.isPinned-+!!e.isPinned;let n=this.getResourceOrder(e),r=this.getResourceOrder(t);return n===r?this.getTimestampValue(t.datePosted||t.createdAt)-this.getTimestampValue(e.datePosted||e.createdAt):n-r})}isResourceBulletin(e){return e&&e.type===`resource`}getResourceOrder(e){if(e.resourceOrder===``||e.resourceOrder===null||e.resourceOrder===void 0)return 2**53-1;let t=Number(e.resourceOrder);return Number.isFinite(t)?t:2**53-1}parseStoredYmdLocal(e){if(!e||typeof e!=`string`)return null;let t=e.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!t)return null;let n=Number(t[1]),r=Number(t[2])-1,i=Number(t[3]),a=new Date(n,r,i);return Number.isNaN(a.getTime())?null:a}getTimestampValue(e){if(!e)return 0;if(typeof e.toDate==`function`)return e.toDate().getTime();if(typeof e==`string`){let t=this.parseStoredYmdLocal(e);if(t)return t.getTime()}let t=new Date(e);return Number.isNaN(t.getTime())?0:t.getTime()}formatPostedDate(e){let t=this.getTimestampValue(e);return t?new Date(t).toLocaleDateString():`Recently posted`}getResourceCategoryKey(e){return C[e.resourceCategory]?e.resourceCategory:`resource`}getResourceCategoryKeys(e){let t=[e.resourceCategory,e.category,...Array.isArray(e.categories)?e.categories:[],...Array.isArray(e.tags)?e.tags:[]];return typeof e.categories==`string`&&t.push(...e.categories.split(`,`)),typeof e.tags==`string`&&t.push(...e.tags.split(`,`)),[...new Set(t.filter(Boolean).map(e=>{let t=this.normalizeFeedCategory(String(e).trim().toLowerCase());return t===`job`?`jobs`:t===`childcare`?`family`:t}).filter(Boolean))]}resourceMatchesCategory(e,t){let n=this.normalizeFeedCategory(t),r=n===`job`?`jobs`:n===`childcare`?`family`:n;return this.getResourceCategoryKeys(e).includes(r)}getBulletinCategoryKeys(e){let t=[e.category,e.classType,...Array.isArray(e.categories)?e.categories:[],...Array.isArray(e.tags)?e.tags:[]];typeof e.categories==`string`&&t.push(...e.categories.split(`,`)),typeof e.tags==`string`&&t.push(...e.tags.split(`,`));let n=t.filter(Boolean).map(e=>this.normalizeFeedCategory(String(e).trim().toLowerCase())).filter(e=>e&&e!==`all`);return[...new Set(n)]}bulletinMatchesCategory(e,t){let n=this.normalizeFeedCategory(t);return this.getBulletinCategoryKeys(e).includes(n)}getResourceCategoryConfig(e){return C[this.getResourceCategoryKey(e)]||{labelEn:`Resource`,labelEs:`Recurso`,icon:`globe`}}getResourceTitles(e){let t=this.getResourceCategoryConfig(e),n=e.titleEn||e.title||t.labelEn;return{titleEn:n,titleEs:e.titleEs||e.subtitle||t.labelEs||n}}getResourceUrl(e){let t=(e.url||e.eventLink||``).trim();return t?/^https?:\/\//i.test(t)?t:`https://${t}`:`#`}getResourceIconSvg(e){let t=this.getResourceCategoryConfig(e);return D[e.resourceIcon&&e.resourceIcon!==`auto`?e.resourceIcon:t.icon]||D.globe}handleHashRouting(){let e=window.location.hash;if(e&&e.startsWith(`#bulletin-`)){let t=e.replace(`#bulletin-`,``);this.currentView!==`feed`&&this.switchView(`feed`,{skipRender:!0,preserveDetail:!0}),this.focusBulletinFromHash(),this.showBulletinDetail(t)}else this.closeBulletinDetail(!1)}focusBulletinFromHash(){let e=window.location.hash;if(!e||!e.startsWith(`#bulletin-`))return;let t=document.querySelector(e);t&&(t.classList.add(`hash-highlight`),t.scrollIntoView({behavior:`smooth`,block:`center`}),setTimeout(()=>{t.classList.remove(`hash-highlight`)},2800),this.lastHashHighlight=e)}showBulletinDetail(e){let t=document.getElementById(`bulletinDetailModal`),n=document.getElementById(`bulletinDetailBody`);if(!t||!n)return;let r=this.getPostBulletins(this.bulletins).find(t=>t.id===e)||x.find(t=>t.id===e);r?(r.isSchoolCalendarAnchor||b(`detail_open`,{postId:r.id,category:r.category,contentType:r.type||`post`}),n.innerHTML=this.renderBulletinDetail(r)):n.innerHTML=`<div class="detail-card"><p>This bulletin is no longer available.</p></div>`,t.style.display=`flex`,t.setAttribute(`aria-hidden`,`false`),document.body.classList.add(`modal-open`)}closeBulletinDetail(e=!0){let t=document.getElementById(`bulletinDetailModal`);t&&(t.style.display=`none`,t.setAttribute(`aria-hidden`,`true`),document.body.classList.remove(`modal-open`),e&&window.location.hash.startsWith(`#bulletin-`)&&history.replaceState(null,``,window.location.pathname+window.location.search))}showDayEvents(e){let t=document.getElementById(`bulletinDetailModal`),n=document.getElementById(`bulletinDetailBody`);if(!t||!n)return;let r=e.map(e=>{let t=this.isBulletinExpired(e);return`
                <div class="day-event-item ${t?`expired`:``}" onclick="event.stopPropagation(); bulletinBoard.showBulletinDetail('${e.id}')">
                    <div class="day-event-header">
                        <h3 class="day-event-title">${this.escapeHtml(e.title)}</h3>
                        <span class="category-badge category-${e.category}">${this.getCategoryDisplay(e.category)}</span>
                    </div>
                    ${e.description?`<p class="day-event-description">${this.escapeHtml(e.description.substring(0,150))}${e.description.length>150?`...`:``}</p>`:``}
                    <p class="day-event-meta">Posted by ${this.escapeHtml(e.advisorName)}</p>
                    ${t?`<span class="expired-label">EXPIRED</span>`:``}
                </div>
            `}).join(``);n.innerHTML=`
            <div class="detail-card">
                <h2 style="margin-bottom: 20px;">Events on this day (${e.length})</h2>
                <div class="day-events-list">
                    ${r}
                </div>
                <div class="detail-actions" style="margin-top: 24px;">
                    <button type="button" class="close-btn" onclick="window.bulletinBoard.closeBulletinDetail()">Close</button>
                </div>
            </div>
        `,t.style.display=`flex`,t.setAttribute(`aria-hidden`,`false`),document.body.classList.add(`modal-open`)}showDayEventsByIds(e){let t=e.map(e=>this.bulletins.find(t=>t.id===e)).filter(Boolean);this.showDayEvents(t)}getCatMeta(e){return{job:{accent:`#1e40af`,tint:`#dbeafe`,grad:`linear-gradient(145deg,#bfdbfe 0%,#dbeafe 100%)`,label:`Jobs`,labelEs:`Empleos`,badge:`JOBS`,emoji:`💼`},training:{accent:`#7b4ec7`,tint:`#ede9fe`,grad:`linear-gradient(145deg,#ddd6fe 0%,#ede9fe 100%)`,label:`Training`,labelEs:`Capacitación`,badge:`FREE`,emoji:`📚`},college:{accent:`#4338ca`,tint:`#e0e7ff`,grad:`linear-gradient(145deg,#c7d2fe 0%,#e0e7ff 100%)`,label:`College`,labelEs:`Universidad`,badge:`APPLY`,emoji:`🎓`},immigration:{accent:`#0d8a7a`,tint:`#ccfbf1`,grad:`linear-gradient(145deg,#99f6e4 0%,#ccfbf1 100%)`,label:`Immigration`,labelEs:`Inmigración`,badge:`FREE`,emoji:`🌍`},housing:{accent:`#b91c1c`,tint:`#fee2e2`,grad:`linear-gradient(145deg,#fca5a5 0%,#fecaca 100%)`,label:`Housing`,labelEs:`Vivienda`,badge:`FREE HELP`,emoji:`🏠`},health:{accent:`#be185d`,tint:`#fce7f3`,grad:`linear-gradient(145deg,#f9a8d4 0%,#fce7f3 100%)`,label:`Health`,labelEs:`Salud`,badge:`FREE`,emoji:`❤️`},food:{accent:`#166534`,tint:`#dcfce7`,grad:`linear-gradient(145deg,#86efac 0%,#dcfce7 100%)`,label:`Food`,labelEs:`Comida`,badge:`FREE`,emoji:`🍎`},childcare:{accent:`#92400e`,tint:`#fef3c7`,grad:`linear-gradient(145deg,#fde68a 0%,#fef3c7 100%)`,label:`Family`,labelEs:`Familia`,badge:`FREE`,emoji:`👨‍👩‍👧`},esol:{accent:`#6d28d9`,tint:`#ede9fe`,grad:`linear-gradient(145deg,#c4b5fd 0%,#ede9fe 100%)`,label:`ESOL`,labelEs:`Inglés`,badge:`FREE`,emoji:`🗣️`},"career-fair":{accent:`#b45309`,tint:`#ffedd5`,grad:`linear-gradient(145deg,#fed7aa 0%,#ffedd5 100%)`,label:`Career Fair`,labelEs:`Feria de Empleo`,badge:`FREE`,emoji:`🤝`},money:{accent:`#065f46`,tint:`#d1fae5`,grad:`linear-gradient(145deg,#6ee7b7 0%,#d1fae5 100%)`,label:`Money Help`,labelEs:`Ayuda Económica`,badge:`FREE`,emoji:`💰`},announcement:{accent:`#0284c7`,tint:`#e0f2fe`,grad:`linear-gradient(145deg,#bae6fd 0%,#e0f2fe 100%)`,label:`Announcements`,labelEs:`Anuncios`,badge:`INFO`,emoji:`📢`},resource:{accent:`#0e7490`,tint:`#cffafe`,grad:`linear-gradient(145deg,#a5f3fc 0%,#cffafe 100%)`,label:`Resource`,labelEs:`Recurso`,badge:`INFO`,emoji:`🔗`}}[e]||{accent:`#475569`,tint:`#f1f5f9`,grad:`linear-gradient(145deg,#e2e8f0 0%,#f1f5f9 100%)`,label:e,labelEs:e,badge:`INFO`,emoji:`📌`}}getCardIconSvg(e){let t={job:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,immigration:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,housing:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,health:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,food:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,esol:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,training:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,college:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,"career-fair":`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,money:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,childcare:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,announcement:`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`};return t[e]||t.announcement}createHeroSvg(e){let t={job:{top:`#7eb1ff`,bot:`#e1e9f7`,sun:`#ffc857`,fg1:`#1f3d7a`,fg2:`#5a7bb7`},training:{top:`#b89bea`,bot:`#ece4f9`,sun:`#fff`,fg1:`#7b4ec7`,fg2:`#c4afe7`},college:{top:`#a5b4fc`,bot:`#e0e7ff`,sun:`#ffc857`,fg1:`#4338ca`,fg2:`#818cf8`},immigration:{top:`#5fc4b3`,bot:`#cfeee8`,sun:`#fff`,fg1:`#0d8a7a`,fg2:`#7fd4c6`},housing:{top:`#f0a78f`,bot:`#fbdcd1`,sun:`#fff8eb`,fg1:`#d96a4a`,fg2:`#f5b7a3`},health:{top:`#f0a3bd`,bot:`#fbd6e3`,sun:`#fff`,fg1:`#e0497d`,fg2:`#f0a3bd`},food:{top:`#7cc795`,bot:`#cfead9`,sun:`#ffc857`,fg1:`#2d8a4a`,fg2:`#9bd5af`},childcare:{top:`#e0bb7a`,bot:`#f5e3c4`,sun:`#fff`,fg1:`#c08a3e`,fg2:`#e0bb7a`},esol:{top:`#b89bea`,bot:`#ece4f9`,sun:`#fff`,fg1:`#7b4ec7`,fg2:`#c4afe7`},"career-fair":{top:`#f5c285`,bot:`#fbe6cc`,sun:`#fff`,fg1:`#e88a2a`,fg2:`#f5c285`},money:{top:`#6dcfa9`,bot:`#cfeee0`,sun:`#ffc857`,fg1:`#1aa37a`,fg2:`#9fdcc4`},announcement:{top:`#7dd3fc`,bot:`#e0f2fe`,sun:`#fff8eb`,fg1:`#0284c7`,fg2:`#bae6fd`},resource:{top:`#67e8f9`,bot:`#cffafe`,sun:`#fff8eb`,fg1:`#0e7490`,fg2:`#a5f3fc`}},n=t[e]||t.announcement,r=`hg-${e}-${Math.random().toString(36).slice(2,6)}`;return`<svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%" preserveAspectRatio="xMidYMid slice">
            <defs><linearGradient id="${r}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${n.top}"/><stop offset="100%" stop-color="${n.bot}"/></linearGradient></defs>
            <rect width="400" height="160" fill="url(#${r})"/>
            <circle cx="320" cy="44" r="22" fill="${n.sun}" opacity="0.9"/>
            <path d="M0 110 Q80 88 160 104 T320 104 T480 100 L480 160 L0 160 Z" fill="${n.fg1}"/>
            <path d="M0 128 Q100 112 200 122 T400 118 L400 160 L0 160 Z" fill="${n.fg2}"/>
        </svg>`}createBulletinCard(e,t=0){let n=this.getCatMeta(e.category),r=e.deadline&&this.isDeadlineClose(e.deadline),i=this.isBulletinExpired(e),a=this.formatPostedDate(e.datePosted),o=e.title||``,s=o.length>40?o.substring(0,38)+`…`:o,c=e.description||``,l=c.length>110?c.substring(0,108)+`…`:c,u=this.formatEventDatesDisplay(e),d=`window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${e.id}')`,f=!e.image&&t%7==0?`pc--featured`:``,p=(document.body.getAttribute(`data-lang`)||`EN`)===`ES`&&e.imageEs?e.imageEs:e.image,m=!!p,h=`
      <div class="pc__chip-bar" style="--chip-accent:${n.accent};--chip-tint:${n.tint}">
        <div class="pc__chips" role="list" aria-label="Post labels">
          ${i?`<span class="pc__chip pc__chip--expired" role="listitem">⏰ Expired</span>`:``}
          <span class="pc__chip pc__chip--category" role="listitem">
            <span class="pc__chip-emoji" aria-hidden="true">${n.emoji}</span>
            <span class="en-text">${this.escapeHtml(n.label.toUpperCase())}</span>
            <span class="es-text">${this.escapeHtml(n.labelEs.toUpperCase())}</span>
          </span>
        </div>
      </div>`;return`
    <article class="pc ${f} ${i?`pc--expired`:``}" id="bulletin-${e.id}" data-bulletin-id="${e.id}" onclick="${d}" role="button" tabindex="0" style="cursor:pointer">
      ${h}
      <div class="pc__top ${m?`pc__top--image`:``}" style="background:${m?`#f8fafc`:n.grad}">
        ${m?`<div class="pc__image-stage"><img class="pc__poster-image" src="${this.escapeAttribute(p)}" alt=""></div>`:`<div class="pc__icon-wrap"><div class="pc__icon-box" style="background:${n.accent}">${this.getCardIconSvg(e.category)}</div></div>
        <div class="pc__title-overlay">${this.escapeHtml(s)} —</div>`}
      </div>

      <div class="pc__body">
        <h3 class="pc__title">${this.escapeHtml(o)}</h3>
        <p class="pc__desc">${this.escapeHtml(l)}</p>

        ${u?`
        <div class="pc__date ${r&&!i?`pc__date--urgent`:``}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>${this.escapeHtml(u)}</span>
        </div>`:``}

        <div class="pc__footer">
          <div class="pc__foot-left">
            <span class="pc__foot-name">${this.escapeHtml(e.advisorName||`Advisor`)} · ${a}</span>
          </div>
          <span class="pc__open-btn" style="color:${n.accent}">Open →</span>
        </div>
      </div>
    </article>
        `}_unused_createBulletinCard_v1(e){this.formatPostedDate(e.datePosted),e.deadline&&this.isDeadlineClose(e.deadline);let t=this.isBulletinExpired(e);return this.renderFormattedDescription(e.description||``,e.id,!0),`
            <div class="bulletin-card ${t?`expired-bulletin`:``}" id="bulletin-v1-${e.id}">
                ${t?`<div class="expired-banner">EXPIRED</div>`:``}
                <div class="bulletin-actions">
                    <div class="bulletin-action-buttons">
                        ${e.pdfUrl?`
                            <button type="button" class="pdf-btn" title="View PDF document" aria-label="View PDF document for ${this.escapeHtml(e.title)}" onclick="window.bulletinBoard.openPdfFromBulletin('${e.id}')">
                                📄 View PDF
                            </button>
                        `:``}
                        <button class="share-btn" onclick="shareBulletin('${e.id}', '${this.escapeHtml(e.title).replace(/'/g,`&#39;`)}')">
                            📤 Share
                        </button>
                    </div>
                </div>
            </div>
        `}renderBulletinDetail(e){let t=this.getCatMeta(e.category),n=this.formatPostedDate(e.datePosted),r=this.getDetailImportantDate(e),i=r&&r.kind===`deadline`&&this.isDeadlineClose(r.raw),a=this.isBulletinExpired(e),o=(e.advisorName||`?`).charAt(0).toUpperCase(),s=r&&(r.kind===`event`||r.kind===`start`),c=e.isSchoolCalendarAnchor?`<strong>School Calendar</strong>`:s?`<strong>${this.escapeHtml(e.advisorName||`Advisor`)}</strong>`:`<strong>${this.escapeHtml(e.advisorName||`Advisor`)}</strong> · ${n}`,l=e.description?this.renderFormattedDescription(e.description,`${e.id}-detail`):``,u=[e.classType?this.getClassTypeDisplay(e.classType):``,e.company||``,e.eventLocation||``].filter(Boolean).slice(0,3),d=this.getDetailContactAction(e),f=this.hasDetailInfoGridContent(e),p=(document.body.getAttribute(`data-lang`)||`EN`)===`ES`&&e.imageEs?e.imageEs:e.image,m=p?`<button type="button" class="post-detail-hero-zoom lightbox-trigger" data-lightbox-src="${this.escapeAttribute(p)}" aria-label="View full size flyer">
                <img class="post-detail-hero-image" src="${this.escapeAttribute(p)}" alt="">
                <span class="post-detail-hero-zoom-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>
                    <span class="en-text">Tap to zoom</span>
                    <span class="es-text">Toca para ampliar</span>
                </span>
            </button>`:`<div class="post-detail-hero-art" style="--detail-accent:${t.accent};--detail-tint:${t.tint}">
                <div class="post-detail-sun"></div>
                <div class="post-detail-wave post-detail-wave-one"></div>
                <div class="post-detail-wave post-detail-wave-two"></div>
                <div class="post-detail-icon" style="background:${t.accent}">${this.getCardIconSvg(e.category)}</div>
            </div>`;return`
            <article class="post-detail-page" style="--detail-accent:${t.accent};--detail-tint:${t.tint}">
                <section class="post-detail-hero ${e.image?`post-detail-hero--image`:`post-detail-hero--art-only`}" aria-hidden="true">
                    ${m}
                </section>
                <section class="post-detail-panel">
                    <p class="post-detail-category" style="color:${t.accent}">
                        <span class="en-text">${this.escapeHtml(t.label.toUpperCase())}</span>
                        <span class="es-text">${this.escapeHtml(t.labelEs.toUpperCase())}</span>
                    </p>
                    <h2>${this.escapeHtml(e.title||``)}</h2>
                    ${a?`<p class="post-detail-expired">Expired</p>`:``}
                    <div class="post-detail-author">
                        <span class="post-detail-avatar" style="background:${t.accent}">${this.escapeHtml(o)}</span>
                        <span>${c}</span>
                    </div>
                    ${r?`
                        <div class="post-detail-date ${i&&!a?`post-detail-date--urgent`:``}">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                            <span>
                                <strong>Important date</strong>
                                <small>${this.escapeHtml(r.label)}</small>
                            </span>
                        </div>
                    `:``}
                    ${l?`<div class="post-detail-description">${l}</div>`:``}
                    
                    ${f?`
                        <div class="post-detail-info-grid" style="margin-top: 24px; display: grid; gap: 16px; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                            ${e.address?`
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${t.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Location</strong><span style="font-size: 0.95rem;">${this.escapeHtml(e.address)}</span></div>
                                </div>
                            `:``}
                            
                            ${e.hours?`
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${t.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Hours</strong><span style="font-size: 0.95rem;">${this.escapeHtml(e.hours)}</span></div>
                                </div>
                            `:``}

                            ${e.languages&&(Array.isArray(e.languages)?e.languages.length>0:e.languages)?`
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${t.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg></div>
                                    <div>
                                        <strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Languages</strong>
                                        <div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
                                            ${this.getLanguageTagsHtml(e.languages)}
                                        </div>
                                    </div>
                                </div>
                            `:``}
                        </div>
                    `:``}

                    ${u.length?`<div class="post-detail-tags">${u.map(e=>`<span>${this.escapeHtml(e)}</span>`).join(``)}</div>`:``}
                    ${e.contact?`<div class="post-detail-contact-note">${this.escapeHtml(e.contact).replace(/\n/g,`<br>`)}</div>`:``}
                    <div class="post-detail-actions">
                        ${d?`
                            <a href="${this.escapeAttribute(d.href)}" class="post-detail-action post-detail-action--primary">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                                <span><strong>${this.escapeHtml(d.label)}</strong><small>${this.escapeHtml(d.value)}</small></span>
                            </a>
                        `:``}
                        ${e.pdfUrl?`
                            <button type="button" class="post-detail-action post-detail-action--outline" onclick="window.bulletinBoard.openPdfFromBulletin('${e.id}')">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
                                <span><strong>View PDF</strong><small>Open attachment</small></span>
                            </button>
                        `:``}
                        ${e.eventLink?`
                            <a href="${this.escapeAttribute(e.eventLink)}" target="_blank" rel="noopener" class="post-detail-action post-detail-action--outline" data-analytics-action="link_click" data-analytics-post-id="${this.escapeAttribute(e.id)}" data-analytics-category="${this.escapeAttribute(e.category)}" data-analytics-content-type="post">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                                <span><strong>${this.escapeHtml(this.getDetailLinkActionLabel(e.category))}</strong><small>${this.escapeHtml(this.getDisplayHost(e.eventLink))}</small></span>
                            </a>
                        `:``}
                        <button type="button" class="post-detail-action post-detail-action--share" onclick="shareBulletin('${e.id}','${this.escapeHtml(e.title||``).replace(/'/g,`&#39;`)}')">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
                            <strong>Share with a friend</strong>
                        </button>
                    </div>
                </section>
            </article>
        `}getDetailImportantDate(e){if(e.dateType===`sessions`){let t=this.expandBulletinDateItems(e);if(!t.length)return null;let n=new Date;n.setHours(0,0,0,0);let r=t.filter(e=>e.date>=n).sort((e,t)=>e.date.getTime()-t.date.getTime())[0]||t[t.length-1];return{raw:r.rawDate,date:r.date,kind:r.kind,label:this.formatSessionDatesDetailLabel(e)}}let t=this.getDatesListItem(e);return t?{raw:t.rawDate,date:t.date,kind:t.kind,label:t.label}:null}getDetailContactAction(e){let t=[e.phone||``,e.contact].filter(Boolean).join(` `).match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);if(!t)return null;let n=t[0].replace(/\s+/g,` `).trim(),r=n.replace(/[^0-9+]/g,``),i=e.phoneMode||`call`,a=`Call`,o=`tel:${r}`;return i===`text`?(a=`Text`,o=`sms:${r}`):i===`both`&&(a=`Call or Text`),e.category===`job`&&(a=i===`text`?`Text hiring`:`Call hiring`),{href:o,label:a,value:n}}getLanguageTagsHtml(e){if(!e)return``;let t=Array.isArray(e)?e:String(e).split(`,`).map(e=>e.trim()).filter(Boolean),n={ENG:`English`,ESP:`Español`,POR:`Português`,KRE:`Kreyòl (Haitian Creole)`,ARA:`Arabic`,VIE:`Vietnamese`,CHI:`Chinese`};return t.map(e=>{let t=e.toUpperCase(),r=n[t]||t;return`
                <span title="${this.escapeAttribute(r)}" style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 800; font-family: inherit; cursor: help;">
                    ${this.escapeHtml(t)}
                </span>
            `}).join(``)}hasDetailInfoGridContent(e){return e?(e.address||``).trim()||(e.hours||``).trim()?!0:(Array.isArray(e.languages)?e.languages:String(e.languages||``).split(`,`).map(e=>e.trim()).filter(Boolean)).length>0:!1}getDetailLinkActionLabel(e){return{job:`Apply online`,training:`Sign up online`,college:`Apply online`,"career-fair":`Event details`,resource:`Open resource`,announcement:`More info`}[e]||`Open link`}getDisplayHost(e){if(!e)return``;try{return new URL(e).hostname.replace(/^www\./,``)}catch{return e.replace(/^https?:\/\//,``).replace(/^www\./,``).split(`/`)[0]}}_unused_renderBulletinDetail_v1(e){let t=this.isBulletinExpired(e);return`
            <article class="detail-card ${t?`expired-bulletin`:``}" id="detail-${e.id}">
                ${t?`<div class="expired-banner">EXPIRED</div>`:``}
                <div class="detail-header">
                    <div>
                        <div class="detail-title">${this.escapeHtml(e.title)}</div>
                    </div>
                    <span class="category-badge category-${e.category}">${this.getCategoryDisplay(e.category)}</span>
                </div>

                ${e.image?`
                    <div class="detail-image">
                        <img class="lightbox-trigger" data-lightbox-src="${e.image}" src="${e.image}" alt="Bulletin image for ${this.escapeHtml(e.title)}">
                    </div>
                `:``}

                <div class="detail-body">
                    ${e.description?this.renderFormattedDescription(e.description,`${e.id}-detail`):``}

                        ${e.company?`
                            <p><strong>Organization:</strong> ${this.escapeHtml(e.company)}</p>
                        `:``}

                        ${e.eventTime?`
                            <p><strong>Time:</strong> ${this.escapeHtml(this.formatEventTime(e.eventTime))}</p>
                        `:``}

                        ${e.classType?`
                            <p><strong>Class Type:</strong> ${this.getClassTypeDisplay(e.classType)}</p>
                        `:``}

                        ${e.contact?`
                            <p><strong>Contact:</strong><br>${this.escapeHtml(e.contact).replace(/\n/g,`<br>`)}</p>
                        `:``}

                        ${e.eventLink?`
                            <p><strong>Link:</strong> <a href="${this.escapeAttribute(e.eventLink)}" target="_blank" rel="noopener">${this.escapeHtml(this.formatLinkLabel(e.eventLink,e.category))}</a></p>
                        `:``}
                    </div>

                <div class="detail-meta">
                    ${this.renderDetailDateInfo(e)}
                    <div><strong>Posted:</strong> ${postedDate}</div>
                </div>

                <div class="detail-actions">
                    <button type="button" class="close-btn" onclick="window.bulletinBoard.closeBulletinDetail()">Close</button>
                    ${e.pdfUrl?`
                        <button type="button" class="pdf-btn" title="View PDF" onclick="window.bulletinBoard.openPdfFromBulletin('${e.id}')">
                            📄 PDF
                        </button>
                    `:``}
                    <button type="button" class="share-btn" onclick="shareBulletin('${e.id}', '${this.escapeHtml(e.title).replace(/'/g,`&#39;`)}')">📤 Share</button>
                </div>
            </article>
        `}applyFilters(){let e=document.getElementById(`searchInput`),t=e?e.value.toLowerCase().trim():``;if(this.currentView===`resources`){this.resourceSearchQuery=t,this.renderResourceList(this.getPublishedResources()),this.syncHeaderSearchButton();return}let n=this.getPostBulletins(this.bulletins);if(this.selectedCategories.length>0&&(n=n.filter(e=>this.selectedCategories.some(t=>this.bulletinMatchesCategory(e,t)))),this.selectedPostedDates.length>0){let e=new Date,t=new Date(e.getFullYear(),e.getMonth(),e.getDate());n=n.filter(e=>this.selectedPostedDates.some(n=>{let r=new Date(e.datePosted.toDate?e.datePosted.toDate():e.datePosted),i=new Date(r.getFullYear(),r.getMonth(),r.getDate()),a=t.getTime()-i.getTime(),o=Math.floor(a/(1e3*3600*24));switch(n){case`today`:return o===0;case`thisweek`:return o<=7&&o>=0;case`lastweek`:return o>7&&o<=14;case`thismonth`:return o<=30&&o>=0;case`lastmonth`:return o>30&&o<=60;default:return!0}}))}if(this.selectedDeadlines.length>0){let e=new Date,t=new Date(e.getFullYear(),e.getMonth(),e.getDate());n=n.filter(e=>this.selectedDeadlines.some(n=>{if(n===`nodate`)return!e.deadline;if(!e.deadline)return!1;let r=(this.parseStoredYmdLocal(String(e.deadline).split(`T`)[0])||new Date(e.deadline)).getTime()-t.getTime(),i=Math.ceil(r/(1e3*3600*24));switch(n){case`soon`:return i<=7&&i>=0;case`thisweek`:return i<=7&&i>=0;case`thismonth`:return i<=30&&i>=0;default:return!0}}))}this.selectedClassTypes.length>0&&(n=n.filter(e=>this.selectedClassTypes.includes(e.classType))),this.selectedPostedBy.length>0&&(n=n.filter(e=>this.selectedPostedBy.includes(e.advisorName))),t&&(n=n.filter(e=>{let n=(e.description||``).toLowerCase(),r=(e.company||``).toLowerCase(),i=(e.contact||``).toLowerCase(),a=(e.eventLink||``).toLowerCase(),o=(e.advisorName||``).toLowerCase();return(e.title||``).toLowerCase().includes(t)||n.includes(t)||r.includes(t)||i.includes(t)||a.includes(t)||o.includes(t)}));let r=document.getElementById(`showExpiredToggle`);r&&r.checked||(n=n.filter(e=>!this.isBulletinExpired(e))),this.displayBulletins(n)}clearFilters(){let e=document.getElementById(`searchInput`),t=document.getElementById(`heroSearchInput`),n=document.getElementById(`desktopTopbarSearchInput`);if(e&&(e.value=``),t&&(t.value=``),n&&(n.value=``),this.currentView===`resources`){this.resourceSearchQuery=``,this.renderResourceList(this.getPublishedResources()),this.syncHeaderSearchButton();return}this.currentFeedCategory=`all`,this.selectedCategories=[],this.selectedPostedDates=[],this.selectedDeadlines=[],this.selectedClassTypes=[],this.selectedPostedBy=[];let r=document.getElementById(`showExpiredToggle`);r&&(r.checked=!1),document.querySelectorAll(`.filter-chip`).forEach(e=>{e.classList.remove(`active`)}),this.updateFilterCount(),this.updateFeedCategoryHeader(),this.updateActiveCategoryState(),this.updateSearchLayerCatState(`all`),this.displayBulletins(),this.updateToggleFiltersLabel(!1)}toggleFiltersPanel(){let e=document.getElementById(`filterControls`);e&&(e.style.display===`none`?(e.style.display=`block`,this.updateToggleFiltersLabel(!0)):(e.style.display=`none`,this.updateToggleFiltersLabel(!1)))}toggleFilterChip(e,t){e.classList.toggle(`active`);let n=e.dataset[t];if(t===`category`){let e=this.selectedCategories.indexOf(n);e>-1?this.selectedCategories.splice(e,1):this.selectedCategories.push(n)}else if(t===`posted`){let e=this.selectedPostedDates.indexOf(n);e>-1?this.selectedPostedDates.splice(e,1):this.selectedPostedDates.push(n)}else if(t===`deadline`){let e=this.selectedDeadlines.indexOf(n);e>-1?this.selectedDeadlines.splice(e,1):this.selectedDeadlines.push(n)}else if(t===`classtype`){let e=this.selectedClassTypes.indexOf(n);e>-1?this.selectedClassTypes.splice(e,1):this.selectedClassTypes.push(n)}else if(t===`postedby`){let e=this.selectedPostedBy.indexOf(n);e>-1?this.selectedPostedBy.splice(e,1):this.selectedPostedBy.push(n)}this.updateFilterCount(),this.applyFilters()}updateFilterCount(){let e=this.selectedCategories.length+this.selectedPostedDates.length+this.selectedDeadlines.length+this.selectedClassTypes.length+this.selectedPostedBy.length,t=document.getElementById(`filterCount`),n=document.getElementById(`activeFiltersCount`),r=document.getElementById(`toggleFilters`);t&&n&&(t.textContent=e,n.style.display=e>0?`inline`:`none`),r&&(e>0?r.classList.add(`active`):r.classList.remove(`active`))}updateToggleFiltersLabel(e){let t=document.getElementById(`toggleFilters`);if(!t)return;let n=`
            <span id="activeFiltersCount" class="active-filters-count" style="${this.getActiveFilterCount()>0?``:`display: none;`}">
                (<span id="filterCount">${this.getActiveFilterCount()}</span>)
            </span>
        `;t.innerHTML=`<span>🔧</span> ${e?`Hide Filters`:`Filters`} ${n}`}getActiveFilterCount(){return this.selectedCategories.length+this.selectedPostedDates.length+this.selectedDeadlines.length+this.selectedClassTypes.length+this.selectedPostedBy.length}areFiltersApplied(){let e=this.selectedCategories.length>0,t=this.selectedPostedDates.length>0,n=this.selectedDeadlines.length>0,r=this.selectedClassTypes.length>0,i=this.selectedPostedBy.length>0,a=document.getElementById(`searchInput`).value.trim()!==``,o=document.getElementById(`showExpiredToggle`),s=o&&o.checked;return e||t||n||r||i||a||s}loadBulletins(){}getCategoryDisplay(e){return l(e)}getClassTypeDisplay(e){return{esol:`ESOL (English for Speakers of Other Languages)`,hse:`HSE (High School Equivalency)`,famlit:`FamLit (Family Literacy)`}[e]||e}isDeadlineClose(e){let t=this.parseStoredYmdLocal(String(e).split(`T`)[0])||new Date(e),n=new Date,r=t.getTime()-n.getTime(),i=Math.ceil(r/(1e3*3600*24));return i<=7&&i>=0}isBulletinExpired(e){let t=new Date;if(e.startDate&&e.endDate){let n=this.parseStoredYmdLocal(String(e.endDate).split(`T`)[0])||new Date(e.endDate);return new Date(n.getFullYear(),n.getMonth(),n.getDate(),23,59,59)<t}if(e.dateType===`sessions`){let n=this.getBulletinEventDates(e);if(!n.length)return!1;let r=n[n.length-1];if(e.endTime)return new Date(`${r}T${e.endTime}:00`)<t;let i=this.parseStoredYmdLocal(r)||new Date(r);return new Date(i.getFullYear(),i.getMonth(),i.getDate(),23,59,59)<t}if(e.eventDate&&e.endTime)return new Date(`${e.eventDate}T${e.endTime}:00`)<t;if(e.eventDate&&!e.endTime){let n=this.parseStoredYmdLocal(String(e.eventDate).split(`T`)[0])||new Date(e.eventDate);return new Date(n.getFullYear(),n.getMonth(),n.getDate(),23,59,59)<t}if(e.deadline){let n=this.parseStoredYmdLocal(String(e.deadline).split(`T`)[0])||new Date(e.deadline);return new Date(n.getFullYear(),n.getMonth(),n.getDate(),23,59,59)<t}return!1}escapeHtml(e){let t=document.createElement(`div`);return t.textContent=e,t.innerHTML}dataUrlToBlobUrl(e){try{return fetch(e).then(e=>e.blob()).then(e=>URL.createObjectURL(e))}catch(t){return console.error(`Error converting data URL to blob URL:`,t),e}}async openPdfFromBulletin(e){try{console.log(`=== PDF OPENING DEBUG START ===`),console.log(`Opening PDF for bulletin ID:`,e),console.log(`Total bulletins loaded:`,this.bulletins.length);let t=this.bulletins.find(t=>t.id===e);if(console.log(`Found bulletin:`,t?`YES`:`NO`),!t)throw console.error(`Bulletin not found in this.bulletins array`),Error(`Bulletin not found.`);if(!t.pdfUrl)throw console.error(`No PDF URL in bulletin object`),Error(`PDF not found for this bulletin.`);if(b(`pdf_open`,{postId:t.id,category:t.category,contentType:t.type||`post`}),console.log(`Found bulletin with PDF URL:`,t.pdfUrl),t.pdfUrl&&t.pdfUrl.startsWith(`data:`)){if(console.log(`Processing base64 data URL, length:`,t.pdfUrl.length),!window.fetch||!window.URL||!window.URL.createObjectURL)throw Error(`Your browser does not support PDF viewing. Please try a modern browser.`);console.log(`Attempting to fetch data URL...`);let e=await fetch(t.pdfUrl);console.log(`Fetch response status:`,e.status),console.log(`Fetch response ok:`,e.ok);let n=await e.blob();console.log(`Blob created, size:`,n.size,`type:`,n.type);let r=URL.createObjectURL(n);console.log(`Created blob URL:`,r),console.log(`Attempting to open new window...`);let i=window.open(r,`_blank`);if(setTimeout(()=>{URL.revokeObjectURL(r),console.log(`Blob URL revoked`)},1e4),!i)throw Error(`Popup blocked. Please allow popups for this site.`)}else{if(console.log(`Opening Firebase Storage URL directly`),!window.open(t.pdfUrl,`_blank`))throw Error(`Popup blocked. Please allow popups for this site.`);console.log(`New window opened successfully`)}console.log(`=== PDF OPENING DEBUG END ===`)}catch(e){console.error(`=== PDF OPENING ERROR ===`),console.error(`Error opening PDF:`,e),console.error(`Error stack:`,e.stack),alert(`Failed to open PDF: `+e.message)}}async openPdfFromDataUrl(e){try{console.log(`Opening PDF from data URL, length:`,e.length);let t=await(await fetch(e)).blob(),n=URL.createObjectURL(t);console.log(`Created blob URL:`,n);let r=window.open(n,`_blank`);if(setTimeout(()=>{URL.revokeObjectURL(n)},1e4),!r)throw Error(`Popup blocked. Please allow popups for this site.`)}catch(e){console.error(`Error opening PDF:`,e),alert(`Failed to open PDF. Please try again or check your browser settings.`)}}escapeAttribute(e){let t=document.createElement(`div`);return t.textContent=e||``,t.innerHTML.replace(/"/g,`&quot;`).replace(/'/g,`&#39;`)}formatLinkLabel(e,t){return e?{job:`Job Posting Link`,training:`Training Link`,college:`College/University Link`,"career-fair":`Event Link`,announcement:`More Information`,resource:`Resource Link`}[t]||`More Information`:``}formatEventTime(e){if(!e)return``;try{let[t,n]=e.split(`:`),r=parseInt(t,10),i=n||`00`;if(isNaN(r))return e;let a=r>=12?`PM`:`AM`;return r%=12,r===0&&(r=12),`${r}:${i.padStart(2,`0`)} ${a}`}catch{return e}}renderFormattedDescription(e,t,n=!1){if(!e)return``;let r=document.createElement(`div`);r.textContent=e||``;let i=r.innerHTML,a=this.applyInlineFormatting(i).split(/\n{2,}/).map(e=>`<p>${e.replace(/\n/g,`<br>`)}</p>`).join(``);if(!n)return`<div class="description-content expanded">${a}</div>`;let o=t;return`
            <div class="description-wrapper" data-bulletin="${o}">
                <div class="description-content">${a}</div>
                <button type="button" class="toggle-description" data-bulletin="${o}" aria-expanded="false">Read more</button>
            </div>
        `}formatRichText(e){let t=document.createElement(`div`);return t.textContent=e||``,this.applyInlineFormatting(t.innerHTML)}applyInlineFormatting(e){return(e||``).replace(/\*\*(.+?)\*\*/g,`<strong>$1</strong>`).replace(/\*(.+?)\*/g,`<em>$1</em>`).replace(/`(.+?)`/g,`<code>$1</code>`)}handleDescriptionToggle(e){let t=e.target.closest(`.toggle-description`);if(!t)return;let n=t.getAttribute(`data-bulletin`);n&&this.showBulletinDetail(n)}renderDateInfo(e){if(e.dateType&&(e.eventDate||e.eventDates&&e.eventDates.length||e.startDate&&e.endDate))return this.renderNewDateInfo(e);if(e.deadline){let t=this.isDeadlineClose(e.deadline);return`
                <div class="meta-item ${t?`deadline-warning`:``}">
                    <strong>Deadline:</strong> ${this.formatDateLocal(e.deadline)}
                    ${t?` (Soon!)`:``}
                </div>
            `}return``}renderNewDateInfo(e){let t=e.dateType,n=``;if(t===`deadline`){let t=this.isDeadlineClose(e.eventDate);n=`
                <div class="meta-item ${t?`deadline-warning`:``}">
                    <strong>Application Deadline:</strong> ${this.formatDateLocal(e.eventDate)}
                    ${t?` (Soon!)`:``}
                </div>
            `}else if(t===`event`){let t=this.isDeadlineClose(e.eventDate),r=this.formatTimeRange(e.startTime,e.endTime);n=`
                <div class="meta-item ${t?`deadline-warning`:``}">
                    <strong>Event Date:</strong> ${this.formatDateLocal(e.eventDate)}${r?` at ${r}`:``}
                    ${t?` (Soon!)`:``}
                </div>
            `}else if(t===`range`&&e.startDate&&e.endDate){let t=this.formatTimeRange(e.startTime,e.endTime);n=`
                <div class="meta-item">
                    <strong>Event Dates:</strong> ${this.formatDateLocal(e.startDate)} - ${this.formatDateLocal(e.endDate)}${t?` at ${t}`:``}
                </div>
            `}else if(t===`sessions`&&e.eventDates?.length){let t=e.eventDates.map(e=>this.formatDateLocal(e)).join(`, `),r=this.formatTimeRange(e.startTime,e.endTime);n=`
                <div class="meta-item">
                    <strong>Session Dates:</strong> ${t}${r?` at ${r}`:``}
                </div>
            `}if(e.eventLocation&&(t===`event`||t===`range`||t===`sessions`)){let t=e.eventLocation===`in-person`?`In-Person`:e.eventLocation===`online`?`Online`:e.eventLocation===`hybrid`?`Hybrid (In-Person & Online)`:e.eventLocation;n+=`
                <div class="meta-item">
                    <strong>Format:</strong> ${t}
                </div>
            `}return n}renderDetailDateInfo(e){if(e.dateType&&(e.eventDate||e.eventDates&&e.eventDates.length||e.startDate&&e.endDate)){let t=e.dateType,n=``;if(t===`deadline`){let t=this.isDeadlineClose(e.eventDate);n=`<div><strong>Application Deadline:</strong> <span class="${t?`deadline-warning`:``}">${this.formatDateLocal(e.eventDate)}${t?` (Soon!)`:``}</span></div>`}else if(t===`event`){let t=this.isDeadlineClose(e.eventDate),r=this.formatTimeRange(e.startTime,e.endTime);n=`<div><strong>Event Date:</strong> <span class="${t?`deadline-warning`:``}">${this.formatDateLocal(e.eventDate)}${r?` at ${r}`:``}${t?` (Soon!)`:``}</span></div>`}else if(t===`range`&&e.startDate&&e.endDate){let t=this.formatTimeRange(e.startTime,e.endTime);n=`<div><strong>Event Dates:</strong> ${this.formatDateLocal(e.startDate)} - ${this.formatDateLocal(e.endDate)}${t?` at ${t}`:``}</div>`}else if(t===`sessions`&&e.eventDates?.length){let t=this.formatTimeRange(e.startTime,e.endTime);n=`<div><strong>Session Dates:</strong> ${e.eventDates.map(e=>this.formatDateLocal(e)).join(`, `)}${t?` at ${t}`:``}</div>`}if(e.eventLocation&&(t===`event`||t===`range`||t===`sessions`)){let t=e.eventLocation===`in-person`?`In-Person`:e.eventLocation===`online`?`Online`:e.eventLocation===`hybrid`?`Hybrid (In-Person & Online)`:e.eventLocation;n+=`<div><strong>Format:</strong> ${t}</div>`}return n}if(e.deadline){let t=this.isDeadlineClose(e.deadline);return`
                <div><strong>Deadline:</strong> <span class="${t?`deadline-warning`:``}">${this.formatDateLocal(e.deadline)}${t?` (Soon!)`:``}</span></div>
            `}return``}formatDateLocal(e){if(!e)return``;let t=String(e).split(`T`)[0].trim(),n=this.parseStoredYmdLocal(t);if(n)return n.toLocaleDateString();let r=new Date(e);return Number.isNaN(r.getTime())?``:r.toLocaleDateString()}formatTimeRange(e,t){return!e&&!t?``:e&&t?`${this.formatTime(e)} - ${this.formatTime(t)}`:e?this.formatTime(e):``}formatTime(e){if(!e)return``;let[t,n]=e.split(`:`),r=parseInt(t),i=r>=12?`PM`:`AM`;return`${r%12||12}:${n} ${i}`}createBulletinListItem(e){let t=new Date(e.datePosted?.toDate?e.datePosted.toDate():e.datePosted).toLocaleDateString(),n=e.deadline&&this.isDeadlineClose(e.deadline),r=this.isBulletinExpired(e),i=this.renderFormattedDescription(e.description||``,e.id,!0);return`
            <div class="bulletin-list-item ${r?`expired-bulletin`:``}">
                ${r?`<div class="expired-banner">EXPIRED</div>`:``}
                <div class="bulletin-list-category">
                    <span class="category-badge category-${e.category}">
                        ${this.getCategoryDisplay(e.category)}
                    </span>
                </div>

                <div class="bulletin-list-content">
                    <div class="bulletin-list-header">
                        <div class="bulletin-list-title">${this.escapeHtml(e.title)}</div>
                    </div>

                    <div class="bulletin-list-description">
                        ${i}
                    </div>

                    <div class="bulletin-list-meta">
                        ${e.company?`
                            <div class="bulletin-list-meta-item">
                                <strong>Organization:</strong> ${this.escapeHtml(e.company)}
                            </div>
                        `:``}

                        ${e.classType?`
                            <div class="bulletin-list-meta-item">
                                <strong>Class Type:</strong> ${this.getClassTypeDisplay(e.classType)}
                            </div>
                        `:``}

                        ${e.contact?`
                            <div class="bulletin-list-meta-item">
                                <strong>Contact:</strong> ${this.escapeHtml(e.contact).replace(/\n/g,`<br>`)}
                            </div>
                        `:``}

                        ${e.eventLink?`
                            <div class="bulletin-list-meta-item">
                                <strong>Link:</strong> <a href="${this.escapeAttribute(e.eventLink)}" target="_blank" rel="noopener">${this.escapeHtml(this.formatLinkLabel(e.eventLink,e.category))}</a>
                            </div>
                        `:``}

                        ${this.renderDateInfo(e)}

                        ${e.deadline?`
                            <div class="bulletin-list-meta-item ${n?`deadline-warning`:``}">
                                <strong>Deadline:</strong> ${this.formatDateLocal(e.deadline)}
                                ${n?` (Soon!)`:``}
                            </div>
                        `:``}

                        <div class="bulletin-list-meta-item">
                            <strong>Posted:</strong> ${t}
                        </div>

                        <div class="bulletin-list-meta-item">
                            <strong>By:</strong> ${this.escapeHtml(e.advisorName)}
                        </div>
                    </div>

                    <div class="bulletin-list-actions">
                        ${e.pdfUrl?`
                            <button type="button" class="pdf-btn" aria-label="View PDF document for ${this.escapeHtml(e.title)}" onclick="window.bulletinBoard.openPdfFromBulletin('${e.id}')">
                                📄 View PDF
                            </button>
                        `:``}
                        <button type="button" class="share-btn" onclick="shareBulletin('${e.id}', '${this.escapeHtml(e.title||``).replace(/'/g,`&#39;`)}')">
                            📤 Share
                        </button>
                    </div>
                </div>
            </div>
        `}createDatesListView(e){let t=e.flatMap(e=>this.expandBulletinDateItems(e)).filter(Boolean).sort((e,t)=>e.date.getTime()-t.date.getTime()),n=[{key:`this-week`,labelEn:`This week`,labelEs:`Esta semana`,items:[]},{key:`next-week`,labelEn:`Next week`,labelEs:`Próxima semana`,items:[]},{key:`upcoming`,labelEn:`Upcoming`,labelEs:`Próximos`,items:[]},{key:`past`,labelEn:`Past dates`,labelEs:`Fechas pasadas`,items:[]}],r=new Date,i=new Date(r.getFullYear(),r.getMonth(),r.getDate()),a=new Date(i);a.setDate(i.getDate()+(6-i.getDay())),a.setHours(23,59,59,999);let o=new Date(a);o.setDate(a.getDate()+7),t.forEach(e=>{e.date<i?n[3].items.push(e):e.date<=a?n[0].items.push(e):e.date<=o?n[1].items.push(e):n[2].items.push(e)});let s=n.filter(e=>e.items.length>0);return s.length===0?``:`
            <div class="dates-list-view">
                ${s.map(e=>`
                    <section class="dates-list-group" aria-label="${this.escapeAttribute(e.labelEn)}">
                        <h2>
                            <span class="en-text">${this.escapeHtml(e.labelEn)}</span>
                            <span class="es-text">${this.escapeHtml(e.labelEs)}</span>
                        </h2>
                        <div class="dates-list-items">
                            ${e.items.map(e=>this.createDatesListCard(e)).join(``)}
                        </div>
                    </section>
                `).join(``)}
            </div>
        `}expandBulletinDateItems(e){if(e.dateType===`sessions`){let t=this.getBulletinEventDates(e);return t.map((n,r)=>{let i=this.parseDateOnly(n);return i?{bulletin:e,rawDate:n,date:i,kind:`event`,label:this.getDatesListLabel(e,i,`event`,{sessionIndex:r+1,sessionTotal:t.length})}:null}).filter(Boolean)}let t=this.getDatesListItem(e);return t?[t]:[]}getDatesListItem(e){let t=``,n=`date`;if(e.dateType===`deadline`&&e.eventDate?(t=e.eventDate,n=`deadline`):e.dateType===`event`&&e.eventDate?(t=e.eventDate,n=`event`):e.dateType===`range`&&e.startDate?(t=e.startDate,n=`start`):e.eventDate?(t=e.eventDate,n=`event`):e.startDate?(t=e.startDate,n=`start`):e.deadline&&(t=e.deadline,n=`deadline`),!t)return null;let r=this.parseDateOnly(t);return r?{bulletin:e,rawDate:t,date:r,kind:n,label:this.getDatesListLabel(e,r,n)}:null}parseDateOnly(e){if(!e)return null;if(e instanceof Date)return e;if(typeof e.toDate==`function`)return e.toDate();let t=String(e),n=t.includes(`T`)?new Date(t):new Date(`${t}T12:00:00`);return Number.isNaN(n.getTime())?null:n}getDatesListLabel(e,t,n,r={}){let i=t.toLocaleDateString(`en-US`,{weekday:`short`,month:`short`,day:`numeric`}),a=t.toLocaleDateString(`en-US`,{weekday:`long`,month:`short`,day:`numeric`}),o=this.formatTimeRange(e.startTime,e.endTime);return n===`deadline`?`Apply by ${i}`:n===`start`?`Starts ${i}${o?` · ${o}`:``}`:r.sessionTotal>1?`${a} (Session ${r.sessionIndex} of ${r.sessionTotal})${o?` · ${o}`:``}`:`${a}${o?` · ${o}`:``}`}createDatesListCard(e){let{bulletin:t,date:n,kind:r,label:i}=e,a=this.getCatMeta(t.category),o=t.title||``,s=r===`deadline`?`BY`:n.toLocaleDateString(`en-US`,{month:`short`}).toUpperCase(),c=n.getDate(),l=r===`deadline`?`#f08b1f`:a.accent;return`
            <article
                class="dates-list-card"
                data-list-date="${`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,`0`)}-${String(n.getDate()).padStart(2,`0`)}`}"
                style="--date-accent:${a.accent};--date-tint:${a.tint};--date-dot:${l}"
                role="button"
                tabindex="0"
                onclick="window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${this.escapeAttribute(t.id)}')"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${this.escapeAttribute(t.id)}')}"
            >
                <div class="dates-list-badge" aria-hidden="true">
                    <span>${this.escapeHtml(s)}</span>
                    <strong>${c}</strong>
                </div>
                <div class="dates-list-copy">
                    <p class="dates-list-category" style="color:${a.accent}">
                        <span class="en-text">${this.escapeHtml(a.label.toUpperCase())}</span>
                        <span class="es-text">${this.escapeHtml(a.labelEs.toUpperCase())}</span>
                    </p>
                    <h3>${this.escapeHtml(o)}</h3>
                    <p class="dates-list-label">${this.escapeHtml(i)}</p>
                </div>
                <span class="dates-list-dot" aria-hidden="true"></span>
            </article>
        `}createCalendarView(e,t={}){let n=t.navigatorMode===!0,r=e.filter(e=>this.bulletinHasCalendarDates(e)),i={};r.forEach(e=>{(e.dateType===`sessions`?this.getBulletinEventDates(e):[e.eventDate||e.startDate||e.deadline].filter(Boolean)).forEach(t=>{let n=new Date(String(t).split(`T`)[0]+`T12:00:00`);if(Number.isNaN(n.getTime()))return;let r=n.toDateString();i[r]||(i[r]=[]),i[r].push(e)})});let a=new Date,o=this.currentCalendarMonth===void 0?a.getMonth():this.currentCalendarMonth,s=this.currentCalendarYear===void 0?a.getFullYear():this.currentCalendarYear,c=new Date(s,o,1),l=new Date(s,o+1,0).getDate(),u=c.getDay(),d=`
            <div class="monthly-calendar">
                <div class="calendar-header">
                    <button class="calendar-nav-btn" onclick="bulletinBoard.previousMonth()" title="Previous Month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15,18 9,12 15,6"></polyline>
                        </svg>
                    </button>
                    <h2 class="calendar-month">${[`January`,`February`,`March`,`April`,`May`,`June`,`July`,`August`,`September`,`October`,`November`,`December`][o]} ${s}</h2>
                    <button class="calendar-nav-btn" onclick="bulletinBoard.nextMonth()" title="Next Month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="calendar-weekdays">
                    ${[`Sun`,`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`].map(e=>`<div class="calendar-weekday">${e}</div>`).join(``)}
                </div>
                <div class="calendar-days">
        `;for(let e=0;e<u;e++)d+=`<div class="calendar-day empty"></div>`;for(let e=1;e<=l;e++){let t=new Date(s,o,e),r=i[t.toDateString()]||[],c=t.toDateString()===a.toDateString(),l=`${s}-${String(o+1).padStart(2,`0`)}-${String(e).padStart(2,`0`)}`;d+=this.createMonthlyCalendarDay(e,r,c,{navigatorMode:n,isoDate:l})}return d+=`
                </div>
            </div>
        `,d}createMonthlyCalendarDay(e,t,n,r={}){let{navigatorMode:i=!1,isoDate:a=``}=r,o=t.length,s=o>0,c=s&&!i?`onclick="bulletinBoard.showDayEventsByIds(${JSON.stringify(t.map(e=>e.id))})"`:``,l=s&&i?`data-calendar-day="${a}"`:``;return`
            <div class="calendar-day ${n?`today`:``} ${s?`has-bulletins`:``}"
                 data-bulletin-count="${o}"
                 ${l}
                 ${c}
                 style="${s?`cursor: pointer;`:``}">
                <div class="calendar-day-number">
                    <span>${e}</span>
                    ${o>0?`<span class="event-count-badge">${o}</span>`:``}
                </div>
                <div class="calendar-day-content">
                    ${s?`
                        <div class="calendar-bulletins">
                            ${t.slice(0,3).map(e=>this.createMonthlyBulletinItem(e)).join(``)}
                            ${t.length>3?`<div class="more-bulletins">+${t.length-3} more</div>`:``}
                        </div>
                    `:``}
                </div>
                ${n?`<div class="today-indicator"></div>`:``}
            </div>
        `}createCalendarDay(e,t){let n=e.toDateString()===new Date().toDateString(),r=e.toLocaleDateString(`en-US`,{weekday:`short`}),i=e.getDate();return`
            <div class="calendar-day ${n?`today`:``}">
                <div class="calendar-day-header">
                    <div class="calendar-day-date">${i}</div>
                    <div class="calendar-day-weekday">${r}</div>
                </div>
                <div class="calendar-day-bulletins">
                    ${t.map(e=>this.createCalendarBulletinItem(e)).join(``)}
                </div>
                ${n?`<div class="today-badge">Today</div>`:``}
            </div>
        `}createMonthlyBulletinItem(e){let t=e.deadline&&this.isDeadlineClose(e.deadline),n=``;return e.dateType&&e.eventDate?n=this.formatDateLocal(e.eventDate):e.deadline&&(n=this.formatDateLocal(e.deadline)),`
            <div class="monthly-bulletin-item" onclick="bulletinBoard.showBulletinDetail('${e.id}')">
                <div class="monthly-bulletin-category category-${e.category}"></div>
                <div class="monthly-bulletin-title">${this.escapeHtml(e.title)}</div>
                ${n?`
                    <div class="monthly-bulletin-deadline ${t?`deadline-warning`:``}">
                        ${n}
                    </div>
                `:``}
            </div>
        `}createCalendarBulletinItem(e){let t=e.deadline&&this.isDeadlineClose(e.deadline),n=``;return e.dateType&&e.eventDate?n=this.formatDateLocal(e.eventDate):e.deadline&&(n=this.formatDateLocal(e.deadline)),`
            <div class="calendar-bulletin-item">
                <div class="calendar-bulletin-title">${this.escapeHtml(e.title)}</div>
                <div class="calendar-bulletin-category">${this.getCategoryDisplay(e.category)}</div>
                <div class="calendar-bulletin-description">${this.escapeHtml(e.description||``).substring(0,100)}${e.description&&e.description.length>100?`...`:``}</div>
                <div class="calendar-bulletin-meta">
                    ${n?`
                        <div class="calendar-bulletin-deadline ${t?`deadline-warning`:``}">
                            ${n}
                            ${t?` (Soon!)`:``}
                        </div>
                    `:``}
                </div>
            </div>
        `}checkAutoLogin(){}previousMonth(){this.currentCalendarMonth--,this.currentCalendarMonth<0&&(this.currentCalendarMonth=11,this.currentCalendarYear--),console.log(`📅 Previous month:`,this.currentCalendarMonth,this.currentCalendarYear),this.displayBulletins()}nextMonth(){this.currentCalendarMonth++,this.currentCalendarMonth>11&&(this.currentCalendarMonth=0,this.currentCalendarYear++),console.log(`📅 Next month:`,this.currentCalendarMonth,this.currentCalendarYear),this.displayBulletins()}};function k(e,t){if(window.bulletinBoard){let t=window.bulletinBoard.bulletins.find(t=>t.id===e);b(`share_click`,{postId:e,category:t?t.category:``,contentType:t&&t.type||`post`})}A(t,`${window.location.origin}${window.location.pathname}#bulletin-${e}`)}function A(e,t){N();let n=document.createElement(`div`);n.className=`share-modal`,n.innerHTML=`
        <div class="share-modal-content">
            <h3>Share This Opportunity</h3>
            <div class="share-options">
                <button onclick="shareVia('whatsapp', '${encodeURIComponent(e)}', '${encodeURIComponent(t)}')" class="share-option whatsapp">
                    📱 WhatsApp
                </button>
                <button onclick="shareVia('facebook', '${encodeURIComponent(e)}', '${encodeURIComponent(t)}')" class="share-option facebook">
                    📘 Facebook
                </button>
                <button onclick="shareVia('email', '${encodeURIComponent(e)}', '${encodeURIComponent(t)}')" class="share-option email">
                    ✉️ Email
                </button>
                <button onclick="shareVia('sms', '${encodeURIComponent(e)}', '${encodeURIComponent(t)}')" class="share-option sms">
                    💬 Text Message
                </button>
            </div>
            <div class="share-link">
                <input type="text" value="${t}" id="shareLink" readonly>
                <button onclick="copyLink()" class="copy-btn">Copy Link</button>
            </div>
            <button onclick="closeShareModal()" class="close-share">Close</button>
        </div>
    `,document.body.appendChild(n)}function j(e,t,n){let r={whatsapp:`https://wa.me/?text=${t}%20${n}`,facebook:`https://www.facebook.com/sharer/sharer.php?u=${n}`,email:`mailto:?subject=${t}&body=Check out this opportunity: ${n}`,sms:`sms:?body=${t} ${n}`};window.open(r[e],`_blank`),N()}function M(){let e=document.getElementById(`shareLink`);e.select(),e.setSelectionRange(0,99999);try{document.execCommand(`copy`);let e=document.querySelector(`.copy-btn`);e.textContent=`Copied!`,e.style.background=`#27ae60`,setTimeout(()=>{e.textContent=`Copy Link`,e.style.background=``},2e3)}catch(e){console.error(`Copy failed:`,e)}}function N(){let e=document.querySelector(`.share-modal`);e&&e.remove()}window.shareBulletin=k,window.shareVia=j,window.copyLink=M,window.closeShareModal=N;var P;document.addEventListener(`DOMContentLoaded`,()=>{P=new O,window.bulletinBoard=P}),g();