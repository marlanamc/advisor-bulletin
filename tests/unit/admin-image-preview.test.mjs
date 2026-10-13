import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Isolate the attachment methods from Firebase's browser-only bootstrap.
// Empty selections must only clear local state; no upload service is needed.
const source = readFileSync(new URL('../../src/admin-attachments.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace('export class AdminAttachmentMethods', 'class AdminAttachmentMethods');

for (const fieldName of ['image', 'imageEs', 'resourceLogo']) {
    for (const hasPreview of [false, true]) {
        test(`empty ${fieldName} selection clears state with preview ${hasPreview ? 'present' : 'absent'}`, async () => {
            const preview = hasPreview ? { innerHTML: '<img src="old.png">' } : null;
            let synced = 0;
            let flyerSynced = 0;
            let logoSynced = 0;
            const Methods = runInNewContext(`${source}\nAdminAttachmentMethods`, {
                document: { getElementById: () => preview },
                window: { syncAdminStudentPreview: () => { synced++; } },
            });
            const panel = new Methods();
            panel.syncFlyerUploadUI = () => { flyerSynced++; };
            panel.updateResourceIconGroupState = () => { logoSynced++; };
            const { pendingKey } = panel.getImageFieldConfig(fieldName);
            panel[pendingKey] = { dataUrl: 'old-image' };

            await panel.handleImagePreview({ target: { files: [] } }, fieldName);

            assert.equal(panel[pendingKey], null);
            if (preview) assert.equal(preview.innerHTML, '');
            assert.equal(synced, 1);
            assert.equal(flyerSynced, fieldName === 'image' ? 1 : 0);
            assert.equal(logoSynced, fieldName === 'resourceLogo' ? 1 : 0);
        });
    }
}
