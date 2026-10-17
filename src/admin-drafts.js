// Manual-only private drafts. Never write on input, timers, or navigation.
import { auth, db } from './firebase.js'
import { collection, doc, setDoc, updateDoc, runTransaction, getDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore'

const readFile = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read an attachment.'));
    reader.readAsDataURL(file);
});

export class AdminDraftMethods {
    bindDraftEvents() {
        document.getElementById('saveDraftBtn')?.addEventListener('click', () => this.savePrivateDraft());
        document.getElementById('bulletinForm')?.addEventListener('input', () => { this.draftDirty = true; this.draftVersion = (this.draftVersion || 0) + 1; });
        window.addEventListener('beforeunload', event => {
            if (!this.draftDirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
        document.getElementById('myDraftsList')?.addEventListener('click', event => {
            const button = event.target.closest('button[data-draft-id]');
            if (!button) return;
            if (button.dataset.action === 'edit') this.openPrivateDraft(button.dataset.draftId);
            else this.deletePrivateDraft(button.dataset.draftId);
        });
    }

    setupDraftListener() {
        this.draftsUnsubscribe?.();
        this.drafts = [];
        this.renderMyDrafts();
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        // Single-field query needs no composite index. Published documents are
        // filtered locally, but Firestore authorizes the entire query by UID.
        this.draftsUnsubscribe = onSnapshot(query(collection(db, 'bulletins'), where('authorUid', '==', uid)), snapshot => {
            this.drafts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(d => d.privateDraft === true)
                .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
            this.renderMyDrafts();
        }, () => {
            document.getElementById('myDraftsList').textContent = 'Unable to load drafts. Please refresh and try again.';
        });
    }

    renderMyDrafts() {
        const list = document.getElementById('myDraftsList');
        if (!list) return;
        list.replaceChildren();
        if (!this.drafts?.length) { list.textContent = 'No drafts yet.'; return; }
        for (const draft of this.drafts) {
            const card = document.createElement('article');
            card.className = 'manage-card';
            const title = document.createElement('h3');
            title.textContent = draft.title || 'Untitled Draft';
            const date = document.createElement('p');
            date.textContent = `Last edited: ${draft.updatedAt?.toDate().toLocaleString() || 'Just now'}`;
            card.append(title, date);
            for (const [action, label, style] of [['edit', 'Continue Editing', 'edit-btn'], ['delete', 'Delete Draft', 'delete-btn']]) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = style;
                button.textContent = label;
                button.dataset.draftId = draft.id;
                button.dataset.action = action;
                card.append(button);
            }
            list.append(card);
        }
    }

    async savePrivateDraft() {
        if (this.isSubmitting || this.isEditMode || !auth.currentUser) return;
        this.isSubmitting = true;
        const button = document.getElementById('saveDraftBtn');
        button.disabled = true;
        try {
            window.PostComposer?.syncComposerBeforePreview();
            const form = document.getElementById('bulletinForm');
            const version = this.draftVersion;
            const fields = [];
            const files = [];
            for (const [name, value] of new FormData(form)) {
                if (typeof value === 'string') fields.push({ name, value });
                else if (value.size) files.push({ name, filename: value.name, type: value.type, data: await readFile(value) });
            }
            const draftData = { fields, files, mode: this.contentMode };
            // Private files stay inside the owner-protected document, never in
            // the publicly readable publication upload locations.
            if (new Blob([JSON.stringify(draftData)]).size > 900000) {
                throw new Error('This draft exceeds the 900 KB limit including attachments. Remove large attachments and add them when you publish. Your previous saved draft is unchanged.');
            }
            const ref = doc(db, 'bulletins', this.draftId || doc(collection(db, 'bulletins')).id);
            const data = {
                privateDraft: true, isActive: false, authorUid: auth.currentUser.uid,
                title: String(fields.find(field => field.name === (draftData.mode === 'resource' ? 'resourceTitleEn' : 'title'))?.value || '').trim(),
                draftData, updatedAt: serverTimestamp(),
            };
            if (this.draftId) await updateDoc(ref, data);
            else await setDoc(ref, { ...data, postedBy: this.getAuthPostedBy(), createdAt: serverTimestamp(), datePosted: serverTimestamp() });
            this.draftId = ref.id;
            this.draftDirty = this.draftVersion !== version;
            this.showTemporaryMessage('Saved to My Drafts. Only you can see it.', 'success');
        } catch (error) {
            this.showTemporaryMessage(error.message || 'Unable to save draft. Please try again.', 'error');
        } finally {
            this.isSubmitting = false;
            button.disabled = false;
        }
    }

    async openPrivateDraft(id) {
        if (this.isSubmitting) return;
        if (this.draftDirty && !window.confirm('Discard unsaved changes and open this draft?')) return;
        try {
            const snapshot = await getDoc(doc(db, 'bulletins', id));
            const draft = snapshot.data();
            if (!draft?.privateDraft || draft.authorUid !== auth.currentUser?.uid) throw new Error('Draft is unavailable.');
            this.resetForm({ stayOnCreate: true });
            this.showTab('post');
            this.contentMode = draft.draftData.mode;
            this.contentType = this.contentMode === 'resource' ? 'resource' : 'post';
            const form = document.getElementById('bulletinForm');
            const groups = new Map();
            for (const { name, value } of draft.draftData.fields) {
                if (!groups.has(name)) groups.set(name, []);
                groups.get(name).push(value);
            }
            for (const [name, values] of groups) {
                const elements = Array.from(form.elements).filter(el => el.name === name && el.type !== 'file');
                elements.forEach(el => {
                    if (el.type === 'checkbox' || el.type === 'radio') el.checked = values.includes(el.value);
                    else el.value = values[0];
                });
                if (!elements.length || values.length > 1) {
                    elements.forEach(el => el.remove());
                    values.forEach(value => {
                        const input = document.createElement('input');
                        input.type = 'hidden'; input.name = name; input.value = value;
                        if (['eventDates', 'eventSessionStartTimes', 'eventSessionEndTimes'].includes(name)) input.dataset.cxSession = '';
                        if (['hoursRowDay', 'hoursRowTime'].includes(name)) input.dataset.cxHoursRow = '';
                        form.append(input);
                    });
                }
            }
            window.PostComposer?.hydrateFromForm();
            for (const saved of draft.draftData.files) {
                const input = Array.from(form.elements).find(el => el.name === saved.name && el.type === 'file');
                if (!input) throw new Error('An attachment field could not be restored. Your saved draft is unchanged.');
                const bytes = Uint8Array.from(atob(saved.data.split(',')[1]), char => char.charCodeAt(0));
                const blob = new Blob([bytes], { type: saved.type });
                const transfer = new DataTransfer();
                transfer.items.add(new File([blob], saved.filename, { type: saved.type }));
                input.files = transfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            this.draftId = id;
            this.draftDirty = false;
            this.setSubmitButtonLabel('Publish');
            document.getElementById('cxTitle')?.focus();
        } catch (error) {
            this.showTemporaryMessage(error.message || 'Unable to open draft.', 'error');
        }
    }

    async deletePrivateDraft(id) {
        if (this.isSubmitting || !window.confirm('Delete this draft permanently?')) return;
        try {
            const ref = doc(db, 'bulletins', id);
            await runTransaction(db, async transaction => {
                const saved = (await transaction.get(ref)).data();
                if (!saved?.privateDraft || saved.authorUid !== auth.currentUser?.uid) throw new Error('Draft is unavailable.');
                transaction.delete(ref);
            });
            if (this.draftId === id) this.resetForm({ stayOnCreate: true });
            this.showTemporaryMessage('Draft deleted.', 'success');
        } catch (error) {
            this.showTemporaryMessage(error.message || 'Unable to delete draft.', 'error');
        }
    }
}
