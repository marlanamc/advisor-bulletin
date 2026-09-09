/**
 * Security-rules tests for the Sep 2026 permission model.
 *
 * The model in one sentence: every advisor on the list has identical content
 * permissions (create, edit, delete any post or resource), and the ONE thing
 * an admin can do that a plain advisor cannot is add and remove people.
 *
 * These exist because the model was rewritten against a live database with
 * 175 bulletins — "it looked right" is not good enough for a rule that can
 * either lock out the whole team or hand a student write access.
 *
 * Run: npm run test:rules   (boots the Firestore emulator itself)
 */

import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

let testEnv;

/** Auth token shaped like a real Google Workspace sign-in. */
function workspaceToken(email, { verified = true } = {}) {
    return { email, email_verified: verified };
}

function ctx(email, opts) {
    return testEnv.authenticatedContext(email.split('@')[0], workspaceToken(email, opts)).firestore();
}

/** A minimally valid post, matching validateBulletinData(). */
function post(postedBy, overrides = {}) {
    return {
        type: 'post',
        advisorName: 'Someone',
        postedBy,
        isActive: true,
        title: 'A job opening',
        category: 'job',
        ...overrides,
    };
}

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'ebhcs-rules-test',
        firestore: {
            host: '127.0.0.1',
            port: 8080,
            rules: readFileSync('firestore.rules', 'utf8'),
        },
    });
});

after(async () => {
    if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    // Seed the roster: one admin, two plain advisors, and an existing post.
    await testEnv.withSecurityRulesDisabled(async (c) => {
        const db = c.firestore();
        await setDoc(doc(db, 'advisors/cbaglio'), { displayName: 'Carol', isAdmin: true, email: 'cbaglio@ebhcs.org' });
        await setDoc(doc(db, 'advisors/rocha'), { displayName: 'Jorge', isAdmin: false, email: 'rocha@ebhcs.org' });
        // No isAdmin field at all — must be treated as "not an admin", not an error.
        await setDoc(doc(db, 'advisors/vlalin'), { displayName: 'Carmen', email: 'vlalin@ebhcs.org' });
        await setDoc(doc(db, 'bulletins/p1'), post('rocha', { title: "Jorge's post" }));
        await setDoc(doc(db, 'bulletins/legacy'), post('admin', { title: 'Orphaned shared-login post' }));
    });
});

describe('content permissions are equal for every advisor', () => {
    test('an advisor can edit another advisor\'s post', async () => {
        const db = ctx('vlalin@ebhcs.org');
        await assertSucceeds(updateDoc(doc(db, 'bulletins/p1'), post('rocha', { title: 'Edited by Carmen' })));
    });

    test('an advisor can delete another advisor\'s post', async () => {
        const db = ctx('vlalin@ebhcs.org');
        await assertSucceeds(deleteDoc(doc(db, 'bulletins/p1')));
    });

    test('an advisor can edit the orphaned shared-login posts', async () => {
        const db = ctx('rocha@ebhcs.org');
        await assertSucceeds(updateDoc(doc(db, 'bulletins/legacy'), post('admin', { title: 'Reclaimed' })));
    });

    test('an admin has no extra content power — same as any advisor', async () => {
        const db = ctx('cbaglio@ebhcs.org');
        await assertSucceeds(updateDoc(doc(db, 'bulletins/p1'), post('rocha', { title: 'Edited by Carol' })));
    });

    test('authorship and timestamps stay immutable through an edit', async () => {
        const db = ctx('vlalin@ebhcs.org');
        await assertFails(updateDoc(doc(db, 'bulletins/p1'), post('vlalin', { title: 'Stealing credit' })));
    });

    test('a new post must be filed under the signed-in advisor', async () => {
        const db = ctx('rocha@ebhcs.org');
        await assertSucceeds(setDoc(doc(db, 'bulletins/new1'), post('rocha')));
        await assertFails(setDoc(doc(db, 'bulletins/new2'), post('vlalin')));
    });
});

/**
 * The rule budget, not the permission logic, is what has broken ordinary edits
 * on this project before: Firestore evaluates every `allow` statement and every
 * branch of a combined `||` regardless of short-circuiting, and blowing the
 * shared ~1000-expression ceiling surfaces as a bare "permission-denied" that
 * has nothing to do with permissions. These use the heaviest write the client
 * can actually produce — a resource carrying the maximum 5 action links and 7
 * hours rows — so a future rule addition trips a test instead of prod.
 */
describe('the heaviest legitimate write stays inside the rule budget', () => {
    const heavyResource = (postedBy) => ({
        type: 'resource',
        advisorName: 'Someone',
        postedBy,
        isActive: true,
        title: 'Housing Help Center',
        titleEn: 'Housing Help Center',
        titleEs: 'Centro de ayuda de vivienda',
        category: 'resource',
        resourceCategory: 'housing',
        resourceKind: 'organization',
        isPublished: true,
        isPinned: false,
        hideFromMainFeed: false,
        hasResourceLogo: true,
        lastVerified: '2026-09-09',
        resourceOrder: 42,
        url: 'https://example.org/housing',
        eventDates: [],
        actionLinks: Array.from({ length: 5 }, (_, i) => ({
            labelEn: `Action ${i + 1}`,
            labelEs: `Acción ${i + 1}`,
            url: `https://example.org/action-${i + 1}`,
        })),
        hoursRows: Array.from({ length: 7 }, (_, i) => ({
            day: `Day ${i + 1}`,
            time: '9:00 AM - 5:00 PM',
        })),
    });

    test('a plain advisor can create the heaviest resource', async () => {
        const db = ctx('vlalin@ebhcs.org');
        await assertSucceeds(setDoc(doc(db, 'bulletins/heavy1'), heavyResource('vlalin')));
    });

    test('a plain advisor can edit another advisor\'s heaviest resource', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'bulletins/heavy2'), heavyResource('rocha'));
        });
        const db = ctx('vlalin@ebhcs.org');
        await assertSucceeds(updateDoc(doc(db, 'bulletins/heavy2'), {
            ...heavyResource('rocha'),
            title: 'Housing Help Center (updated)',
        }));
    });

    test('a plain advisor can delete the heaviest resource', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'bulletins/heavy3'), heavyResource('rocha'));
        });
        await assertSucceeds(deleteDoc(doc(ctx('vlalin@ebhcs.org'), 'bulletins/heavy3')));
    });
});

describe('managing people is the only admin privilege', () => {
    test('an admin can add and remove advisors', async () => {
        const db = ctx('cbaglio@ebhcs.org');
        await assertSucceeds(setDoc(doc(db, 'advisors/newperson'), { displayName: 'New', isAdmin: false }));
        await assertSucceeds(deleteDoc(doc(db, 'advisors/rocha')));
    });

    test('a plain advisor cannot add or remove advisors', async () => {
        const db = ctx('rocha@ebhcs.org');
        await assertFails(setDoc(doc(db, 'advisors/newperson'), { displayName: 'New', isAdmin: false }));
        await assertFails(deleteDoc(doc(db, 'advisors/vlalin')));
    });

    test('a plain advisor cannot promote themselves to admin', async () => {
        const db = ctx('rocha@ebhcs.org');
        await assertFails(updateDoc(doc(db, 'advisors/rocha'), { isAdmin: true }));
    });

    test('an advisor doc with no isAdmin field is not an admin', async () => {
        const db = ctx('vlalin@ebhcs.org');
        await assertFails(setDoc(doc(db, 'advisors/newperson'), { displayName: 'New' }));
    });

    test('only admins can publish the student directory', async () => {
        const entry = { advisors: [{ name: 'Carol', role: 'Director', email: 'c@ebhcs.org', loginUsername: 'cbaglio' }] };
        await assertSucceeds(setDoc(doc(ctx('cbaglio@ebhcs.org'), 'config/studentDirectory'), entry));
        await assertFails(setDoc(doc(ctx('rocha@ebhcs.org'), 'config/studentDirectory'), entry));
    });

    test('every advisor can read the roster', async () => {
        await assertSucceeds(getDoc(doc(ctx('rocha@ebhcs.org'), 'advisors/cbaglio')));
    });
});

describe('the owner break-glass', () => {
    test('the owner is an admin with no advisor doc at all', async () => {
        const db = ctx('mcreed@ebhcs.org');
        await assertSucceeds(setDoc(doc(db, 'advisors/recovered'), { displayName: 'Recovered', isAdmin: true }));
    });

    test('the owner can still edit content with no advisor doc', async () => {
        const db = ctx('mcreed@ebhcs.org');
        await assertSucceeds(updateDoc(doc(db, 'bulletins/p1'), post('rocha', { title: 'Owner edit' })));
    });

    test('clearing every isAdmin flag cannot orphan the roster', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await setDoc(doc(c.firestore(), 'advisors/cbaglio'), { displayName: 'Carol', isAdmin: false });
        });
        await assertFails(setDoc(doc(ctx('cbaglio@ebhcs.org'), 'advisors/x'), { displayName: 'X' }));
        await assertSucceeds(setDoc(doc(ctx('mcreed@ebhcs.org'), 'advisors/cbaglio'), { displayName: 'Carol', isAdmin: true }));
    });
});

describe('people who should be shut out', () => {
    test('a removed advisor loses all write access immediately', async () => {
        await testEnv.withSecurityRulesDisabled(async (c) => {
            await deleteDoc(doc(c.firestore(), 'advisors/rocha'));
        });
        const db = ctx('rocha@ebhcs.org');
        await assertFails(setDoc(doc(db, 'bulletins/new3'), post('rocha')));
        await assertFails(updateDoc(doc(db, 'bulletins/p1'), post('rocha', { title: 'Still here?' })));
        await assertFails(deleteDoc(doc(db, 'bulletins/p1')));
    });

    test('an unverified email is rejected even with an advisor doc', async () => {
        const db = ctx('rocha@ebhcs.org', { verified: false });
        await assertFails(setDoc(doc(db, 'bulletins/new4'), post('rocha')));
        await assertFails(updateDoc(doc(db, 'bulletins/p1'), post('rocha', { title: 'Unverified' })));
    });

    test('an outside domain is rejected', async () => {
        const db = ctx('someone@gmail.com');
        await assertFails(setDoc(doc(db, 'bulletins/new5'), post('someone')));
        await assertFails(getDoc(doc(db, 'advisors/cbaglio')));
    });

    test('an anonymous student can read published content but write nothing', async () => {
        const db = testEnv.unauthenticatedContext().firestore();
        await assertSucceeds(getDoc(doc(db, 'bulletins/p1')));
        await assertSucceeds(getDoc(doc(db, 'config/studentDirectory')));
        await assertFails(setDoc(doc(db, 'bulletins/new6'), post('nobody')));
        await assertFails(deleteDoc(doc(db, 'bulletins/p1')));
        await assertFails(getDoc(doc(db, 'advisors/cbaglio')));
    });
});
