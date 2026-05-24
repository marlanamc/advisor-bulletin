import '../style.css'
import '../enhanced-auth.js'
import '../firebase-admin.js'
import { mountEbhcsBrandLockups } from './ebhcs-brand-lockup.js'

function initAdminBrandLockups() {
    mountEbhcsBrandLockups()
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminBrandLockups)
} else {
    initAdminBrandLockups()
}
