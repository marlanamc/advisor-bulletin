/**
 * Canonical public advisor directory (student-facing contact list).
 * loginUsername matches Firestore `advisors` document id / bulletin login id.
 */
export const STUDENT_ADVISOR_DIRECTORY = [
    { name: 'Leah', role: 'Coordinator/Educator', email: 'lgregory@ebhcs.org', loginUsername: 'leah' },
    { name: 'Carmen', role: 'Advisor', email: 'vlalin@ebhcs.org', loginUsername: 'carmen' },
    { name: 'Fabiola', role: 'Advisor', email: 'fvaquerano@ebhcs.org', loginUsername: 'fabiola' },
    { name: 'Felipe', role: 'Advisor', email: 'fgallego@ebhcs.org', loginUsername: 'felipe' },
    { name: 'Jerome', role: 'Advisor', email: 'jkiley@ebhcs.org', loginUsername: 'jerome' },
    { name: 'Jorge', role: 'Advisor', email: 'rocha@ebhcs.org', loginUsername: 'jorge' },
    { name: 'Leidy', role: 'Advisor', email: 'lalzate@ebhcs.org', loginUsername: 'leidy' },
    { name: 'Mike K.', role: 'Advisor', email: 'mkelsen@ebhcs.org', loginUsername: 'mike' },
    { name: 'Simonetta', role: 'Advisor', email: 'spiergentili@ebhcs.org', loginUsername: 'simonetta' }
];

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
