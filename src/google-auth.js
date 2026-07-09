import { db, auth } from './firebase-auth.js'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { isPrivilegedAdminEmail } from './admin-roles.js'

// Google Workspace sign-in for the EBHCS Advisor Portal.
//
// Access is enforced in two layers:
//   1. The Google account picker is scoped to ebhcs.org (the `hd` parameter),
//      and any non-@ebhcs.org account that slips through is signed out here.
//   2. Only accounts with an advisors/{username} doc — managed on the
//      Advisors tab — pass verifyAdvisorAccess. Other school staff can
//      authenticate but are signed out with a friendly message, and
//      firestore.rules/storage.rules deny them everything server-side.

const ORG_DOMAIN = 'ebhcs.org'

export function getUsernameFromEmail(email) {
    return String(email || '').toLowerCase().split('@')[0]
}

function isOrgEmail(email) {
    return typeof email === 'string' && email.toLowerCase().endsWith(`@${ORG_DOMAIN}`)
}

/**
 * Decide whether a signed-in Firebase user may use the portal.
 * Returns { allowed, username, email, reason } — reason is a user-facing
 * message when allowed is false.
 */
export async function verifyAdvisorAccess(user) {
    const email = (user?.email || '').toLowerCase()
    const username = getUsernameFromEmail(email)

    if (!isOrgEmail(email)) {
        return {
            allowed: false,
            username,
            email,
            reason: `Please sign in with your @${ORG_DOMAIN} school Google account.`
        }
    }

    if (isPrivilegedAdminEmail(email)) {
        return { allowed: true, username, email }
    }

    try {
        const advisorSnap = await getDoc(doc(db, 'advisors', username))
        if (advisorSnap.exists()) {
            return { allowed: true, username, email }
        }
    } catch (error) {
        // Security rules deny this read for non-advisors, so permission-denied
        // means the same thing as "no advisor doc". Anything else (offline,
        // timeout) shouldn't silently lock a real advisor out — surface it.
        if (error?.code !== 'permission-denied') {
            console.error('Error verifying advisor access:', error)
            return {
                allowed: false,
                username,
                email,
                reason: 'Could not verify your advisor access. Check your connection and try again.'
            }
        }
    }

    return {
        allowed: false,
        username,
        email,
        reason: `${email} isn't on the advisor list. Ask an admin to add you on the Advisors tab, then sign in again.`
    }
}

/** Record the sign-in time; best-effort, never blocks login. */
export async function recordAdvisorLogin(username, email) {
    try {
        await setDoc(doc(db, 'users', username), {
            email,
            lastLogin: serverTimestamp()
        }, { merge: true })
    } catch (error) {
        console.error('Error recording login time:', error)
    }
}

export function showLoginError(message) {
    const errorDiv = document.getElementById('loginError')
    if (!errorDiv) return
    errorDiv.textContent = message
    errorDiv.style.display = message ? 'block' : 'none'
}

/** Sign the user out and leave an explanation on the login card. */
export async function rejectSignIn(reason) {
    try {
        await signOut(auth)
    } catch (error) {
        console.error('Sign-out error:', error)
    }
    // signOut triggers onAuthStateChanged(null), which re-renders the login
    // view; queue the message so that re-render can't wipe it.
    setTimeout(() => showLoginError(reason), 0)
}

async function handleGoogleSignIn() {
    const button = document.getElementById('googleSignInBtn')
    showLoginError('')
    if (button) button.disabled = true

    try {
        const provider = new GoogleAuthProvider()
        // hd scopes the account picker to the school Workspace. It is a UI
        // hint only — verifyAdvisorAccess (run from onAuthStateChanged) and
        // the security rules are the real enforcement.
        provider.setCustomParameters({ hd: ORG_DOMAIN, prompt: 'select_account' })
        await signInWithPopup(auth, provider)
        // onAuthStateChanged in admin.js takes over: it verifies advisor
        // access and either opens the portal or signs the account back out.
    } catch (error) {
        if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') {
            console.error('Google sign-in error:', error)
            const message = error?.code === 'auth/popup-blocked'
                ? 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
                : 'Sign-in failed. Please try again, or email mcreed@ebhcs.org for help.'
            showLoginError(message)
        }
    } finally {
        if (button) button.disabled = false
    }
}

function initGoogleAuth() {
    const button = document.getElementById('googleSignInBtn')
    if (button) {
        button.addEventListener('click', handleGoogleSignIn)
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleAuth, { once: true })
} else {
    initGoogleAuth()
}
