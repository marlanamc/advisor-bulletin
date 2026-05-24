export function wrapTextareaSelection(textarea, before, after, placeholder = 'text') {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end);
    const inner = selected || placeholder;
    const replacement = before + inner + after;

    textarea.value = value.slice(0, start) + replacement + value.slice(end);

    const newStart = start + before.length;
    const newEnd = newStart + inner.length;
    textarea.focus();
    textarea.setSelectionRange(newStart, newEnd);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function insertTextareaText(textarea, text) {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    textarea.value = value.slice(0, start) + text + value.slice(end);

    const pos = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function initDescriptionFormatToolbars(root = document) {
    root.querySelectorAll('[data-rich-toolbar]').forEach((toolbar) => {
        const targetId = toolbar.getAttribute('aria-controls') || toolbar.dataset.target;
        const textarea = targetId ? document.getElementById(targetId) : toolbar.nextElementSibling;
        if (!textarea || textarea.tagName !== 'TEXTAREA') return;

        toolbar.querySelectorAll('[data-format]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const format = btn.dataset.format;
                if (format === 'bold') {
                    wrapTextareaSelection(textarea, '**', '**', 'bold text');
                } else if (format === 'italic') {
                    wrapTextareaSelection(textarea, '*', '*', 'italic text');
                }
            });
        });

        toolbar.querySelectorAll('[data-insert]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                insertTextareaText(textarea, btn.dataset.insert || '');
            });
        });

        textarea.addEventListener('keydown', (event) => {
            if (!(event.metaKey || event.ctrlKey)) return;
            if (event.key === 'b' || event.key === 'B') {
                event.preventDefault();
                wrapTextareaSelection(textarea, '**', '**', 'bold text');
            } else if (event.key === 'i' || event.key === 'I') {
                event.preventDefault();
                wrapTextareaSelection(textarea, '*', '*', 'italic text');
            }
        });
    });
}
