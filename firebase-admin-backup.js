// Creating a backup to restore the correct ending
// The file should end with:

}

// Global functions for HTML onclick handlers
function showTab(tabName) {
    adminPanel.showTab(tabName);
}

// Keyboard accessibility for tabs
function handleTabKeydown(event, tabName) {
    switch (event.key) {
        case 'Enter':
        case ' ':
            event.preventDefault();
            showTab(tabName);
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
            event.preventDefault();
            const tabs = document.querySelectorAll('.tab-btn');
            const currentIndex = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
            const nextIndex = event.key === 'ArrowRight'
                ? (currentIndex + 1) % tabs.length
                : (currentIndex - 1 + tabs.length) % tabs.length;
            tabs[nextIndex].focus();
            tabs[nextIndex].click();
            break;
    }
}

function previewBulletin() {
    adminPanel.previewBulletin();
}

function closePreview() {
    adminPanel.closePreview();
}

function submitFromPreview() {
    adminPanel.submitFromPreview();
}

// Initialize the admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new FirebaseAdminPanel();
});

// Expose for global access
window.adminPanel = adminPanel;