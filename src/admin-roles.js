// Single source of truth for which accounts firestore.rules treats as
// privileged admins. scripts/check-admin-emails-sync.mjs (run by prebuild)
// fails the build if this list drifts from isPrivilegedAdvisor in
// firestore.rules — change both together, then deploy rules
// (see DEPLOYMENT.md).
export const PRIVILEGED_ADMIN_EMAILS = [
    'admin@ebhcs.org',
    'leah@ebhcs.org',
];

export function isPrivilegedAdminEmail(email) {
    return PRIVILEGED_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}
