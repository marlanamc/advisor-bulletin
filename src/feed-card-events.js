// Single delegated click/keydown handler for #bulletinGrid cards. Bound once
// at bootstrap so cards stay interactive no matter which renderer filled the
// grid (static snapshot, cached bulletins, or live Firestore) — innerHTML
// swaps replace the cards but never the grid element these listeners live on.

function activateCard(card) {
    const id = card.getAttribute('data-bulletin-id');
    if (!id) return;
    window.__ebhcsPendingBulletinId = id;
    window.location.hash = `bulletin-${id}`;
    if (window.bulletinBoard?.showBulletinDetail) {
        window.bulletinBoard.showBulletinDetail(id);
    }
}

function onGridClick(event) {
    const card = event.target.closest('[data-bulletin-id]');
    if (!card) return;
    activateCard(card);
}

function onGridKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('[data-bulletin-id]');
    if (!card) return;
    event.preventDefault();
    activateCard(card);
}

export function initBulletinGridEvents() {
    const grid = document.getElementById('bulletinGrid');
    if (!grid || grid.dataset.cardEventsBound === 'true') return;
    grid.dataset.cardEventsBound = 'true';
    grid.addEventListener('click', onGridClick);
    grid.addEventListener('keydown', onGridKeydown);
}
