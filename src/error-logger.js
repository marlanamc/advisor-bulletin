import { db } from './firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

const RECENT_ERRORS = new Map()
const DEDUPE_MS = 60_000
const MAX_MESSAGE = 500
const MAX_STACK = 2000

function getDayKey(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function getFingerprint(source, message) {
    return `${source}:${String(message || 'unknown').slice(0, 120)}`
}

function shouldLog(fingerprint) {
    const now = Date.now()
    const lastLoggedAt = RECENT_ERRORS.get(fingerprint)
    if (lastLoggedAt && now - lastLoggedAt < DEDUPE_MS) {
        return false
    }
    RECENT_ERRORS.set(fingerprint, now)
    return true
}

function writeClientError(event) {
    if (typeof db === 'undefined') {
        return
    }

    return addDoc(collection(db, 'errors'), {
        ...event,
        createdAt: serverTimestamp(),
        dayKey: getDayKey()
    }).catch(() => {})
}

function logClientError(source, payload) {
    const message = String(payload.message || 'Unknown error').slice(0, MAX_MESSAGE)
    if (!shouldLog(getFingerprint(source, message))) {
        return
    }

    writeClientError({
        type: payload.type,
        message,
        stack: String(payload.stack || '').slice(0, MAX_STACK),
        filename: String(payload.filename || '').slice(0, 200),
        lineno: payload.lineno ?? null,
        colno: payload.colno ?? null,
        source,
        page: `${window.location.pathname}${window.location.search}`.slice(0, 200),
        userAgent: String(navigator.userAgent || '').slice(0, 300)
    })
}

export function installClientErrorLogger(source) {
    if (typeof window === 'undefined' || window.__ebhcsErrorLoggerInstalled) {
        return
    }

    window.__ebhcsErrorLoggerInstalled = true

    window.addEventListener('error', (event) => {
        logClientError(source, {
            type: 'error',
            message: event.message || 'Unknown error',
            stack: event.error?.stack || '',
            filename: event.filename || '',
            lineno: event.lineno ?? null,
            colno: event.colno ?? null
        })
    })

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason
        logClientError(source, {
            type: 'unhandledrejection',
            message: reason?.message || String(reason || 'Unhandled rejection'),
            stack: reason?.stack || '',
            filename: '',
            lineno: null,
            colno: null
        })
    })
}
