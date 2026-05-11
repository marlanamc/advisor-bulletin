// data.js — sample bulletin posts + resources

const POSTS = [
  {
    id: 'p1',
    category: 'job',
    title: 'Hotel Housekeeping — Hyatt Boston',
    titleEs: 'Limpieza en Hotel — Hyatt Boston',
    summary: 'Full-time work. $22/hour. Free uniform. No experience needed.',
    summaryEs: 'Tiempo completo. $22/hora. Uniforme gratis. Sin experiencia.',
    advisor: 'Jorge',
    avatar: 'J',
    posted: '2h',
    deadline: 'Apply by Fri, May 15',
    deadlineEs: 'Aplica antes del vie 15 de mayo',
    deadlineUrgent: true,
    saved: false,
    actions: [
      { kind: 'call', label: 'Call hiring', sub: '617-555-0119' },
      { kind: 'link', label: 'Apply online', sub: 'hyatt.com/jobs' },
    ],
    tags: ['Full-time', 'No experience', 'East Boston'],
  },
  {
    id: 'p2',
    category: 'immigration',
    title: 'Free Citizenship Help — Saturday Clinic',
    titleEs: 'Ayuda Gratis para Ciudadanía — Sábado',
    summary: 'Lawyers help you fill out your N-400 form. Free and safe.',
    summaryEs: 'Abogados te ayudan con el formulario N-400. Gratis y seguro.',
    advisor: 'Marlie',
    avatar: 'M',
    posted: '6h',
    deadline: 'Saturday, May 17 · 10am',
    deadlineEs: 'Sábado 17 de mayo · 10am',
    deadlineUrgent: false,
    saved: true,
    actions: [
      { kind: 'directions', label: 'Get directions', sub: '312 Border St.' },
      { kind: 'call', label: 'Call to register', sub: '617-635-5114' },
    ],
    tags: ['Free', 'Walk-in OK', 'Spanish + Creole'],
  },
  {
    id: 'p3',
    category: 'training',
    title: 'CNA Class Starts in June',
    titleEs: 'Clase CNA empieza en junio',
    summary: 'Become a Certified Nursing Assistant. 8 weeks. Free for students.',
    summaryEs: 'Sé Asistente de Enfermería. 8 semanas. Gratis.',
    advisor: 'Fabiola',
    avatar: 'F',
    posted: '1d',
    deadline: 'Sign up by May 30',
    deadlineEs: 'Inscríbete antes del 30 de mayo',
    deadlineUrgent: false,
    saved: false,
    actions: [
      { kind: 'link', label: 'Sign up', sub: 'ebhcs.org/cna' },
      { kind: 'message', label: 'Ask Fabiola', sub: 'fabiola@ebhcs.org' },
    ],
    tags: ['Free', 'In-person', 'Evenings'],
  },
  {
    id: 'p4',
    category: 'announcement',
    title: 'School Closed Monday — Memorial Day',
    titleEs: 'Escuela Cerrada el Lunes — Memorial Day',
    summary: 'No classes Monday May 26. We come back Tuesday.',
    summaryEs: 'No hay clases el lunes 26 de mayo. Regresamos el martes.',
    advisor: 'Marlie',
    avatar: 'M',
    posted: '1d',
    deadline: null,
    deadlineUrgent: false,
    saved: false,
    actions: [],
    tags: ['Holiday'],
  },
  {
    id: 'p5',
    category: 'career-fair',
    title: 'Spring Career Fair — 30+ Employers',
    titleEs: 'Feria de Empleo de Primavera',
    summary: 'Bring your resume. Hospitals, hotels, and stores will be there.',
    summaryEs: 'Trae tu currículum. Hospitales, hoteles y tiendas estarán.',
    advisor: 'Carmen',
    avatar: 'C',
    posted: '2d',
    deadline: 'Thursday, May 22 · 4–7pm',
    deadlineEs: 'Jueves 22 · 4–7pm',
    deadlineUrgent: true,
    saved: false,
    actions: [
      { kind: 'directions', label: 'Get directions', sub: 'Suffolk Downs' },
      { kind: 'link', label: 'See employer list', sub: 'tap to view' },
    ],
    tags: ['Free', 'Walk-in', 'Bring ID'],
  },
  {
    id: 'p6',
    category: 'housing',
    title: 'Affordable Apartments — Section 8 Open',
    titleEs: 'Apartamentos Asequibles — Sección 8',
    summary: 'Boston is taking new applications. Closes in 2 weeks.',
    summaryEs: 'Boston acepta solicitudes nuevas. Cierra en 2 semanas.',
    advisor: 'Leidy',
    avatar: 'L',
    posted: '3d',
    deadline: 'Apply by May 22',
    deadlineEs: 'Aplica antes del 22 de mayo',
    deadlineUrgent: true,
    saved: false,
    actions: [
      { kind: 'link', label: 'Apply online', sub: 'bostonhousing.org' },
      { kind: 'call', label: 'Get help applying', sub: 'Call Leidy' },
    ],
    tags: ['Free help', 'Bilingual'],
  },
];

const RESOURCES = [
  // Jobs
  { id: 'r1', cat: 'job', name: 'MassHire East Boston', desc: 'Free help finding a job. Resume help in Spanish.', address: '180 Border St', phone: '617-557-5000', url: 'masshire.org', languages: ['EN', 'ES'] },
  { id: 'r2', cat: 'job', name: 'JVS Boston Job Search', desc: 'Free job coach. They help you for as long as you need.', phone: '617-399-3131', url: 'jvs-boston.org', languages: ['EN', 'ES', 'PT'] },
  { id: 'r3', cat: 'job', name: 'Indeed.com', desc: 'Search jobs near you. Free. No account needed.', url: 'indeed.com' },

  // Immigration
  { id: 'r4', cat: 'immigration', name: 'Project Citizenship', desc: 'Free help with your citizenship paperwork.', phone: '617-694-5949', url: 'projectcitizenship.org', languages: ['EN', 'ES', 'HT', 'PT'] },
  { id: 'r5', cat: 'immigration', name: 'East Boston Ecumenical', desc: 'Free legal help. Walk-ins on Tuesday.', address: '50 Meridian St', phone: '617-567-3092', languages: ['EN', 'ES'] },
  { id: 'r6', cat: 'immigration', name: 'MIRA Coalition', desc: 'Help with green card, asylum, and citizenship.', phone: '617-350-5480', url: 'miracoalition.org', languages: ['EN', 'ES', 'HT', 'PT', 'AR'] },

  // Housing
  { id: 'r7', cat: 'housing', name: 'Boston Housing Authority', desc: 'Apply for affordable apartments and Section 8.', phone: '617-988-4000', url: 'bostonhousing.org', languages: ['EN', 'ES'] },
  { id: 'r8', cat: 'housing', name: 'Metro Housing Boston', desc: 'Help with rent if you might lose your home.', phone: '617-859-0400', url: 'metrohousingboston.org', languages: ['EN', 'ES', 'HT'] },

  // Health
  { id: 'r9', cat: 'health', name: 'East Boston Neighborhood Health', desc: 'Doctor visits. Free or low cost. No insurance OK.', address: '10 Gove St', phone: '617-569-5800', url: 'ebnhc.org', languages: ['EN', 'ES', 'PT', 'AR'] },
  { id: 'r10', cat: 'health', name: 'MassHealth (free insurance)', desc: 'Free health insurance for low-income families.', phone: '800-841-2900', url: 'mass.gov/masshealth', languages: ['EN', 'ES'] },

  // Food
  { id: 'r11', cat: 'food', name: 'East Boston Soup Kitchen', desc: 'Free hot meals. Tuesday & Thursday 5pm.', address: '54 Saratoga St', phone: '617-569-2538' },
  { id: 'r12', cat: 'food', name: 'Greater Boston Food Bank', desc: 'Find a free food pantry near you.', phone: '617-427-5200', url: 'gbfb.org', languages: ['EN', 'ES'] },
  { id: 'r13', cat: 'food', name: 'SNAP / Food Stamps', desc: 'Money for food. Apply online or by phone.', phone: '877-382-2363', url: 'mass.gov/snap', languages: ['EN', 'ES'] },

  // Childcare / Family
  { id: 'r14', cat: 'childcare', name: 'EEC Childcare Help', desc: 'Free or low-cost daycare for working parents.', phone: '617-988-2400', url: 'mass.gov/eec', languages: ['EN', 'ES'] },
  { id: 'r15', cat: 'childcare', name: 'WIC Program', desc: 'Free food and milk for moms and kids under 5.', phone: '800-942-1007', languages: ['EN', 'ES'] },

  // ESOL / English
  { id: 'r16', cat: 'esol', name: 'EBHCS ESOL Classes', desc: 'Free English classes. Day and evening.', address: '312 Border St', phone: '617-635-5114', url: 'ebhcs.org' },
  { id: 'r17', cat: 'esol', name: 'USA Learns (online)', desc: 'Free English on your phone. No login needed.', url: 'usalearns.org' },

  // College / GED
  { id: 'r18', cat: 'college', name: 'Bunker Hill Community College', desc: 'Affordable college near East Boston.', phone: '617-228-2000', url: 'bhcc.edu', languages: ['EN', 'ES'] },
  { id: 'r19', cat: 'college', name: 'EBHCS HSE/GED Class', desc: 'Get your high school diploma. Free class.', phone: '617-635-5114', url: 'ebhcs.org/hse' },

  // Money / benefits
  { id: 'r20', cat: 'money', name: 'Free Tax Help (VITA)', desc: 'Free help filing taxes. Bilingual.', phone: '800-906-9887', url: 'irs.gov/vita', languages: ['EN', 'ES', 'PT'] },
  { id: 'r21', cat: 'money', name: 'Heating Help (LIHEAP)', desc: 'Help paying winter heating bills.', phone: '617-357-6012', url: 'mass.gov/heating' },
];

const CATEGORIES_ORDER = [
  'job', 'immigration', 'housing', 'health', 'food',
  'childcare', 'esol', 'college', 'money', 'career-fair'
];

const LANGS = [
  { code: 'EN', label: 'English' },
  { code: 'ES', label: 'Español' },
  { code: 'HT', label: 'Kreyòl' },
  { code: 'PT', label: 'Português' },
  { code: 'AR', label: 'العربية' },
];

Object.assign(window, { POSTS, RESOURCES, CATEGORIES_ORDER, LANGS });
