// Break-glass owner account for firestore.rules / storage.rules.
//
// This is NOT the admin list. Since Sep 2026 an admin is any advisor whose
// advisors/{username} doc has isAdmin: true, toggled from the portal's
// Advisors tab — no code change or rules deploy needed to promote someone.
// Admins differ from plain advisors in exactly one way: they can add and
// remove people. Every content permission (create, edit, delete any post or
// resource) is equal for all advisors.
//
// The account below is only a recovery hatch: it always counts as an active
// advisor and an admin, so clearing the last isAdmin flag — or deleting your
// own advisor doc — can't permanently orphan the roster.
//
// scripts/check-admin-emails-sync.mjs (run by prebuild) fails the build if
// this list drifts from isOwnerAdmin in firestore.rules or the allowlist in
// storage.rules — change them together, then deploy rules (see DEPLOYMENT.md).
export const OWNER_ADMIN_EMAILS = [
    'mcreed@ebhcs.org',
];

export function isOwnerAdminEmail(email) {
    return OWNER_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}
