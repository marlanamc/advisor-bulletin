import '../style.css'
import { initAppUpdateCheck } from './app-update.js'
import '../enhanced-auth.js'
import '../firebase-admin.js'

initAppUpdateCheck();
import { mountEbhcsBrandLockups } from './ebhcs-brand-lockup.js'

function initAdminBrandLockups() {
    mountEbhcsBrandLockups()
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminBrandLockups)
} else {
    initAdminBrandLockups()
}
