// Canonical resource category lists. Single source of truth — any change here
// must be mirrored in firestore.rules (the `data.resourceCategory in [...]`
// whitelist on the resource document). The prebuild script
// `scripts/check-resource-categories-sync.mjs` enforces this.

// Categories shown as tiles in the student "Find Help" sidebar.
export const RESOURCE_TILE_CATEGORIES = [
  'jobs',
  'immigration',
  'housing',
  'food',
  'health',
  'family',
  'family-community',
  'money',
  'legal-aid',
  'hse',
  'college',
  'general',
];

// All categories an advisor may select when authoring a resource. Includes
// `esol`, which has full styling in RESOURCE_CATEGORY_CONFIG but is not
// rendered as a tile in the student sidebar (ESOL has its own surfaces).
// This is the set the Firestore rules whitelist must match.
//
// Listed as an explicit literal (not spread from RESOURCE_TILE_CATEGORIES)
// so scripts/check-resource-categories-sync.mjs can extract it with a simple
// regex without evaluating the JS.
export const AUTHORABLE_RESOURCE_CATEGORIES = [
  'immigration',
  'jobs',
  'housing',
  'health',
  'food',
  'family',
  'family-community',
  'hse',
  'college',
  'legal-aid',
  'money',
  'esol',
  'general',
];

export const RESOURCE_TILE_CATEGORY_SET = new Set(RESOURCE_TILE_CATEGORIES);
export const AUTHORABLE_RESOURCE_CATEGORY_SET = new Set(AUTHORABLE_RESOURCE_CATEGORIES);
