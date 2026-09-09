/**
 * Fallback public advisor directory (student-facing contact list).
 * The live directory is the Firestore doc config/studentDirectory, published
 * automatically from the admin Advisors tab; this static list is only used
 * when that doc is missing or unreadable.
 * loginUsername matches Firestore `advisors` document id / bulletin login id.
 * Since the move to Google sign-in it is ALWAYS the prefix of the advisor's
 * real @ebhcs.org email (the account they sign in with).
 */
export const STUDENT_ADVISOR_DIRECTORY = [
    { name: 'Carol', role: 'Director', email: 'cbaglio@ebhcs.org', loginUsername: 'cbaglio' },
    { name: 'Leah', role: 'Coordinator/Educator', email: 'lgregory@ebhcs.org', loginUsername: 'lgregory' },
    { name: 'Carmen', role: 'Advisor', email: 'vlalin@ebhcs.org', loginUsername: 'vlalin' },
    { name: 'Fabiola', role: 'Advisor', email: 'fvaquerano@ebhcs.org', loginUsername: 'fvaquerano' },
    { name: 'Felipe', role: 'Advisor', email: 'fgallego@ebhcs.org', loginUsername: 'fgallego' },
    { name: 'Jerome', role: 'Advisor', email: 'jkiley@ebhcs.org', loginUsername: 'jkiley' },
    { name: 'Jorge', role: 'Advisor', email: 'rocha@ebhcs.org', loginUsername: 'rocha' },
    { name: 'Leidy', role: 'Advisor', email: 'lalzate@ebhcs.org', loginUsername: 'lalzate' },
    { name: 'Mike K.', role: 'Advisor', email: 'mkelsen@ebhcs.org', loginUsername: 'mkelsen' },
    { name: 'Simonetta', role: 'Advisor', email: 'spiergentili@ebhcs.org', loginUsername: 'spiergentili' }
];

/**
 * True when a title should sort above the plain advisors in the student
 * directory (Director, Coordinator/Educator, ...). The title is free text
 * typed on the Advisors tab, so compare case- and whitespace-insensitively:
 * a stray "advisor " must not read as a leadership title and jump to the top.
 * A blank title means Advisor, matching the default used when publishing.
 * @param {string} [role]
 */
export function isLeadershipRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return normalized !== '' && normalized !== 'advisor';
}

/**
 * Public contact email for an advisor row (matches student directory when possible).
 * @param {{ username: string, displayName?: string, email?: string }} advisor
 */
export function getPublicAdvisorEmail(advisor) {
    const username = (advisor.username || '').trim().toLowerCase();
    const displayName = (advisor.displayName || '').trim();
    const byLogin = STUDENT_ADVISOR_DIRECTORY.find((d) => d.loginUsername === username);
    if (byLogin) return byLogin.email;
    const byName = STUDENT_ADVISOR_DIRECTORY.find(
        (d) => d.name.toLowerCase() === displayName.toLowerCase()
    );
    if (byName) return byName.email;
    const raw = advisor.email && String(advisor.email).trim();
    if (raw) return raw;
    return `${username}@ebhcs.org`;
}
