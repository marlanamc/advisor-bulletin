const RESOURCE_CHIP_ACTION_LABELS = {
    'tenant rights': 'Get housing help',
    'worker rights': 'Get work help',
    'consumer protection': 'Report a problem',
    'legal help': 'Find legal help',
    'legal services': 'Find legal help',
    'free legal help': 'Find free legal help',
    'legal information': 'Learn your rights',
    'find legal help': 'Find legal help',
    'know your rights': 'Learn your rights',
    'legal consultation': 'Talk to a lawyer',
    'free consultation': 'Talk to a lawyer',
    'court help': 'Talk to a lawyer',
    'immigration help': 'Get immigration help',
    'immigrant support': 'Get immigration help',
    'refugee support': 'Get immigration help',
    'citizenship help': 'Apply for citizenship',
    'citizenship': 'Apply for citizenship',
    'food pantry': 'Get groceries',
    'emergency food pantry': 'Get emergency food',
    'free food': 'Get emergency food',
    'hot meals': 'Get a hot meal',
    'meals': 'Get a hot meal',
    'snap help': 'Apply for SNAP',
    'snap assistance': 'Apply for SNAP',
    'food benefits': 'Get food benefits',
    'mobile food pantry': 'Get groceries nearby',
    'low cost produce': 'Buy low-cost produce',
    'grocery bags': 'Get groceries',
    'housing help': 'Get housing help',
    'housing search': 'Get housing help',
    'rent help': 'Get rent help',
    'rental assistance': 'Get rent help',
    'utility help': 'Get utility help',
    'public housing': 'Apply for public housing',
    'family shelter': 'Find family shelter',
    'eviction defense': 'Get eviction help',
    'tenant organizing': 'Join tenant support',
    'childcare': 'Find childcare',
    'child care': 'Find childcare',
    'preschool': 'Find preschool',
    'free diapers': 'Get diapers',
    'baby supplies': 'Get baby supplies',
    'parent support': 'Get parent support',
    'parent resources': 'Get parent support',
    'family resource center': 'Get family support',
    'family support': 'Get family support',
    'job training': 'Get job training',
    'training programs': 'Get job training',
    'job search': 'Find a job program',
    'career support': 'Get career help',
    'resume help': 'Get career help',
    'interview prep': 'Practice job skills',
    'english classes': 'Take English classes',
    'english class': 'Take English classes',
    'esol': 'Take English classes',
    'conversation groups': 'Take English classes',
    'college': 'Go to college',
    'college advising': 'Go to college',
    'credential evaluation': 'Evaluate foreign diploma',
    'document translation': 'Translate documents',
    'health care': 'Get health care',
    'primary care': 'Get health care',
    'dental care': 'Get dental care',
    'get health insurance help': 'Get health insurance help',
    'health insurance help': 'Get insurance help',
    'insurance help': 'Get insurance help',
    'insurance': 'Get insurance help',
    'find a clinic': 'Find a clinic',
    'clinics': 'Find a clinic',
    'crisis hotline': 'Call crisis support',
    'trauma support': 'Get trauma support',
    'crisis support': 'Get crisis support',
    'mental health': 'Get crisis support',
    'tax help': 'Get tax help',
    'itin': 'Apply for an ITIN',
    'apply for itin': 'Apply for an ITIN',
    'itin application': 'Apply for an ITIN',
    'cash assistance': 'Get cash help',
    'clothing': 'Get clothes',
    'community help': 'Get community help',
    'public benefits': 'Find your benefits',
    'fuel help': 'Get fuel help',
    'benefits screening': 'Find your benefits',
    'financial coaching': 'Find your benefits',
    'wic help': 'Get food benefits',
    'unemployment help': 'Get cash help',
    'basic needs': 'Get basic needs',
    'utility bill advocacy': 'Get utility help',
    'citizenship & naturalization': 'Apply for citizenship',
    'snap': 'Apply for SNAP',
    'tax assistance': 'Get tax help',
    'youth programs': 'Find youth programs',
    'mbta reduced fare support': 'Get cheaper transit',
    'essentials': 'Get basic needs',
    'family programs': 'Get family support',
    'parenting education': 'Take parenting classes',
    'food help': 'Get food help',
    'food hotline': 'Call for food help',
    'family help': 'Get family support',
    'housing law': 'Get housing legal help',
    'immigration law': 'Get immigration legal help',
    'employment law': 'Get work legal help',
    'family law': 'Get family legal help',
    'civil rights': 'Learn your rights',
    'employment discrimination': 'Report work discrimination',
    'benefits': 'Find your benefits',
    'legal directory': 'Find legal help',
    'referral': 'Get a referral',
    'rapid rehousing': 'Get housing help',
    'violence prevention': 'Get safety support',
    'insurance enrollment': 'Get insurance help',
    'mental health support': 'Get mental health support'
};

const RESOURCE_CHIP_ES = {
    'apply for citizenship': 'Solicitar ciudadanía',
    'apply for an itin': 'Solicitar un ITIN',
    'apply for public housing': 'Solicitar vivienda pública',
    'apply for snap': 'Solicitar SNAP',
    'buy low-cost produce': 'Comprar comida económica',
    'call crisis support': 'Llamar apoyo de crisis',
    'evaluate foreign diploma': 'Evaluar diploma extranjero',
    'find a clinic': 'Buscar una clínica',
    'find a job program': 'Buscar programa de empleo',
    'find childcare': 'Buscar cuidado infantil',
    'find family shelter': 'Buscar refugio familiar',
    'find free legal help': 'Buscar ayuda legal gratis',
    'find legal help': 'Buscar ayuda legal',
    'find preschool': 'Buscar preescolar',
    'find your benefits': 'Buscar beneficios',
    'get baby supplies': 'Conseguir cosas de bebé',
    'get career help': 'Ayuda con carrera',
    'get cash help': 'Ayuda en efectivo',
    'get clothes': 'Conseguir ropa',
    'get community help': 'Ayuda comunitaria',
    'get crisis support': 'Apoyo en crisis',
    'get dental care': 'Atención dental',
    'get diapers': 'Conseguir pañales',
    'get emergency food': 'Comida de emergencia',
    'get eviction help': 'Ayuda con desalojo',
    'get family support': 'Apoyo familiar',
    'get food benefits': 'Beneficios de comida',
    'get fuel help': 'Ayuda con calefacción',
    'get groceries': 'Conseguir comida',
    'get groceries nearby': 'Comida cerca de usted',
    'get health care': 'Atención médica',
    'get health insurance help': 'Ayuda con seguro médico',
    'get help with papers': 'Ayuda con papeles',
    'get housing help': 'Ayuda con vivienda',
    'get immigration help': 'Ayuda de inmigración',
    'get insurance help': 'Ayuda con seguro médico',
    'get job training': 'Capacitación laboral',
    'get parent support': 'Apoyo para padres',
    'get rent help': 'Ayuda con renta',
    'get tax help': 'Ayuda con impuestos',
    'get trauma support': 'Apoyo por trauma',
    'get utility help': 'Ayuda con luz/gas',
    'get work help': 'Ayuda con trabajo',
    'go to college': 'Ir a college',
    'apply to college': 'Solicitar college',
    'get training': 'Obtener capacitación',
    'join tenant support': 'Unirse a apoyo de inquilinos',
    'learn your rights': 'Conocer sus derechos',
    'practice job skills': 'Practicar habilidades laborales',
    'report a problem': 'Reportar un problema',
    'take english classes': 'Clases de inglés',
    'talk to a lawyer': 'Hablar con un abogado',
    'translate documents': 'Traducir documentos',
    'get basic needs': 'Conseguir artículos básicos',
    'find youth programs': 'Buscar programas juveniles',
    'get cheaper transit': 'Obtener transporte más barato',
    'take parenting classes': 'Clases de crianza',
    'get food help': 'Ayuda con comida',
    'call for food help': 'Llamar para ayuda con comida',
    'get housing legal help': 'Ayuda legal de vivienda',
    'get immigration legal help': 'Ayuda legal de inmigración',
    'get work legal help': 'Ayuda legal de trabajo',
    'get family legal help': 'Ayuda legal de familia',
    'report work discrimination': 'Reportar discriminación laboral',
    'get a referral': 'Obtener recomendación',
    'get safety support': 'Obtener apoyo de seguridad',
    'get mental health support': 'Apoyo de salud mental',
    'get a hot meal': 'Conseguir comida caliente'
};

export const SUGGESTED_RESOURCE_CHIPS_BY_CATEGORY = {
    food: [
        'Get groceries',
        'Get emergency food',
        'Get a hot meal',
        'Apply for SNAP',
        'Get food benefits',
        'Buy low-cost produce'
    ],
    housing: [
        'Get housing help',
        'Get rent help',
        'Get utility help',
        'Get eviction help',
        'Apply for public housing',
        'Find family shelter'
    ],
    'legal-aid': [
        'Find legal help',
        'Talk to a lawyer',
        'Learn your rights',
        'Get housing help',
        'Get work help',
        'Report a problem',
        'Get immigration help'
    ],
    immigration: [
        'Get immigration help',
        'Apply for citizenship',
        'Talk to a lawyer',
        'Get help with papers',
        'Find legal help'
    ],
    jobs: [
        'Get job training',
        'Find a job program',
        'Take English classes',
        'Get career help',
        'Practice job skills'
    ],
    college: [
        'Go to college',
        'Apply to college',
        'Get training',
        'Evaluate foreign diploma',
        'Translate documents'
    ],
    family: [
        'Get family support',
        'Find childcare',
        'Find preschool',
        'Get diapers',
        'Get clothes',
        'Get parent support',
        'Get baby supplies'
    ],
    health: [
        'Find a clinic',
        'Get health care',
        'Get dental care',
        'Get insurance help',
        'Get crisis support',
        'Call crisis support'
    ],
    money: [
        'Apply for SNAP',
        'Get cash help',
        'Get tax help',
        'Get fuel help',
        'Get utility help',
        'Find your benefits'
    ],
    esol: [
        'Take English classes',
        'Get job training',
        'Practice job skills'
    ],
    hse: [
        'Take English classes',
        'Get training',
        'Go to college'
    ]
};

function normalizeChipKey(label) {
    return String(label || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getActionResourceChipLabel(label) {
    const text = String(label || '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    return RESOURCE_CHIP_ACTION_LABELS[normalizeChipKey(text)] || text;
}

export function translateResourceChipEs(label) {
    const actionLabel = getActionResourceChipLabel(label);
    if (!actionLabel) return '';
    return RESOURCE_CHIP_ES[normalizeChipKey(actionLabel)] || actionLabel;
}

export function getSuggestedResourceChips(category) {
    return SUGGESTED_RESOURCE_CHIPS_BY_CATEGORY[category] || [];
}

export const MAX_RESOURCE_SERVICE_CHIPS = 6;

/**
 * @param {string | string[] | null | undefined} raw
 * @param {number} [max=MAX_RESOURCE_SERVICE_CHIPS]
 * @returns {string[]}
 */
export function parseResourceServiceChips(raw, max = MAX_RESOURCE_SERVICE_CHIPS) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((part) => String(part || '').trim()).filter(Boolean).slice(0, max);
    }
    return String(raw)
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, max);
}

/**
 * @param {string | string[] | null | undefined} raw
 * @returns {string}
 */
export function formatResourceServiceChipsInput(raw) {
    return parseResourceServiceChips(raw).join(', ');
}
