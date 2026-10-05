// Publication order is independent of event dates and routine edits.
export function getPostPublicationMs(post) {
    const value = post?.datePosted || post?.createdAt;
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day).getTime();
    }
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function comparePostsNewestFirst(a, b) {
    return getPostPublicationMs(b) - getPostPublicationMs(a);
}
