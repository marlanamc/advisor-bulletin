import './css/admin-shell.css'
import { mountEbhcsBrandLockups } from './ebhcs-brand-lockup.js'
import { auth } from './firebase-auth.js'
import { onAuthStateChanged } from 'firebase/auth'
import { verifyAdvisorAccess, recordAdvisorLogin, rejectSignIn } from './google-auth.js'

let portalMountPromise = null
let shellBooted = false

async function removePwaControlFromAdmin() {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(registrations.map((registration) => registration.unregister()))
        }

        if ('caches' in window) {
            const cacheNames = await caches.keys()
            await Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('ebhcs-bulletin-'))
                    .map((name) => caches.delete(name))
            )
        }
    } catch (error) {
        console.warn('[Admin] Could not clear PWA service worker state:', error)
    }
}

function setAuthView(view, message = 'Checking your session...') {
    const loadingEl = document.getElementById('authLoadingScreen')
    const loadingMsg = document.getElementById('authLoadingMessage')
    const loginRequired = document.getElementById('loginRequired')
    const adminPanel = document.getElementById('adminPanel')
    const logoutBtn = document.getElementById('logoutBtn')

    if (loadingMsg) {
        loadingMsg.textContent = message
    }

    if (view === 'loading') {
        if (loadingEl) {
            loadingEl.style.display = 'flex'
            loadingEl.setAttribute('aria-busy', 'true')
        }
        if (loginRequired) loginRequired.style.display = 'none'
        if (adminPanel) adminPanel.style.display = 'none'
        if (logoutBtn) logoutBtn.style.display = 'none'
        document.body.classList.remove('ap-portal-active')
        return
    }

    if (loadingEl) {
        loadingEl.style.display = 'none'
        loadingEl.setAttribute('aria-busy', 'false')
    }

    if (view === 'login') {
        if (loginRequired) loginRequired.style.display = 'grid'
        if (adminPanel) adminPanel.style.display = 'none'
        if (logoutBtn) logoutBtn.style.display = 'none'
        document.body.classList.remove('ap-portal-active')
        return
    }

    if (view === 'portal') {
        if (loginRequired) loginRequired.style.display = 'none'
    }
}

window.adminShell = {
    setAuthView,
}

function initAdminBrandLockups() {
    mountEbhcsBrandLockups()
}

function getUserDetails(user) {
    const username = user.email.split('@')[0]
    return {
        username,
        email: user.email,
        name: username,
    }
}

async function mountAdvisorPortal(userDetails) {
    if (!portalMountPromise) {
        setAuthView('loading', 'Opening advisor workspace...')
        portalMountPromise = Promise.all([
            import('./css/admin.css'),
            import('./css/admin-auth.css'),
            import('./css/advisor-portal-v2.css'),
            import('./firebase-admin.js'),
        ]).then(([, , , portal]) => portal.mountAdvisorPortal(userDetails))
    } else {
        const portal = await portalMountPromise
        if (userDetails && portal?.applyAuthenticatedUser) {
            await portal.applyAuthenticatedUser(userDetails)
        }
        return portal
    }

    return portalMountPromise
}

async function handleAuthenticatedUser(userDetails) {
    setAuthView('loading', 'Opening advisor workspace...')
    await mountAdvisorPortal(userDetails)
    import('./post-composer.js').then(({ mountPostComposer }) => mountPostComposer())
}

function handleSignedOut() {
    if (typeof window.adminPanel?.handleSignedOut === 'function') {
        window.adminPanel.handleSignedOut()
    } else {
        setAuthView('login')
    }
}

function bootShell() {
    if (shellBooted) return
    shellBooted = true

    removePwaControlFromAdmin()
    initAdminBrandLockups()
    setAuthView('loading')

    document.addEventListener('userAuthenticated', (event) => {
        handleAuthenticatedUser(event.detail).catch((error) => {
            console.error('Error opening advisor workspace:', error)
            setAuthView('login')
        })
    })

    auth.authStateReady().catch((error) => {
        console.error('Auth readiness error:', error)
        setAuthView('login')
    })

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            handleSignedOut()
            return
        }

        // Only @ebhcs.org accounts on the admin-managed advisor list may enter.
        // Anyone else (other school staff, personal Gmail) is signed back out
        // with an explanation. Security rules enforce the same thing server-side.
        const access = await verifyAdvisorAccess(user)
        if (!access.allowed) {
            setAuthView('login')
            await rejectSignIn(access.reason)
            return
        }

        recordAdvisorLogin(access.username, access.email)
        await handleAuthenticatedUser(getUserDetails(user))
    })
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootShell, { once: true })
} else {
    bootShell()
}
