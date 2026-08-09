// Resource logos live in their own collection instead of inline on the
// bulletin document. The board's single real-time query
// (collection('bulletins')) loads every active post/resource/event on every
// visit; logos as base64 there added several MB to that one query. Storing
// them separately means the board query stays lean and logos are fetched
// once per session in a single batched read.
//
// Firebase Storage would be the cleaner home for these, but this project's
// billing account is disabled, so Storage uploads fail outright. Firestore
// documents don't require billing on the free Spark plan, so that's the
// constraint this collection works within.
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

const COLLECTION = 'resourceLogos'

/** Returns a Map of bulletinId -> dataUrl for every stored resource logo. */
export async function fetchAllResourceLogos(db) {
    const snapshot = await getDocs(collection(db, COLLECTION))
    const map = new Map()
    snapshot.forEach((docSnap) => {
        const dataUrl = docSnap.data()?.dataUrl
        if (typeof dataUrl === 'string' && dataUrl) {
            map.set(docSnap.id, dataUrl)
        }
    })
    return map
}

export async function setResourceLogo(db, bulletinId, dataUrl) {
    await setDoc(doc(db, COLLECTION, bulletinId), {
        dataUrl,
        updatedAt: serverTimestamp(),
    })
}

export async function deleteResourceLogo(db, bulletinId) {
    await deleteDoc(doc(db, COLLECTION, bulletinId))
}

/** Merges a fetched logo map onto bulletin items in place (resourceLogo field). */
export function applyResourceLogos(items, logoMap) {
    if (!logoMap || !logoMap.size) return false
    let changed = false
    items.forEach((item) => {
        if (item.type === 'resource' && item.hasResourceLogo && logoMap.has(item.id)) {
            item.resourceLogo = logoMap.get(item.id)
            changed = true
        }
    })
    return changed
}
