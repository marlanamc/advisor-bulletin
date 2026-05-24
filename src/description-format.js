function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function markdownToHtml(rawText) {
    if (!rawText) {
        return '';
    }

    return escapeHtml(rawText)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

export function htmlToMarkdown(root) {
    if (!root) {
        return '';
    }

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tag = node.tagName.toLowerCase();
        const inner = Array.from(node.childNodes).map(walk).join('');

        if (tag === 'strong' || tag === 'b') {
            return `**${inner}**`;
        }
        if (tag === 'em' || tag === 'i') {
            return `*${inner}*`;
        }
        if (tag === 'u') {
            return `++${inner}++`;
        }
        if (tag === 'br') {
            return '\n';
        }
        if (tag === 'div' || tag === 'p') {
            const trimmed = inner.replace(/\n+$/, '');
            return trimmed ? `${trimmed}\n` : '';
        }
        return inner;
    }

    return walk(root)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function syncEditorToTextarea(editor, textarea) {
    const markdown = htmlToMarkdown(editor);
    const maxLength = Number(textarea.maxLength) || 0;
    const nextValue = maxLength > 0 && markdown.length > maxLength
        ? markdown.slice(0, maxLength)
        : markdown;

    if (nextValue !== markdown) {
        editor.innerHTML = markdownToHtml(nextValue);
    }

    textarea.value = nextValue;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function refreshRichEditors(root = document) {
    root.querySelectorAll('[data-rich-editor]').forEach((editor) => {
        const textareaId = editor.dataset.richEditor;
        const textarea = textareaId ? document.getElementById(textareaId) : null;
        if (!textarea) {
            return;
        }

        editor.innerHTML = markdownToHtml(textarea.value || '');
        editor.classList.toggle('is-empty', !textarea.value.trim());
    });
}

function syncAllRichEditors(root = document) {
    root.querySelectorAll('[data-rich-editor]').forEach((editor) => {
        const textarea = document.getElementById(editor.dataset.richEditor || '');
        if (textarea) {
            syncEditorToTextarea(editor, textarea);
        }
    });
}

function applyEditorFormat(editor, format) {
    editor.focus();
    if (format === 'bold') {
        document.execCommand('bold', false, null);
    } else if (format === 'italic') {
        document.execCommand('italic', false, null);
    } else if (format === 'underline') {
        document.execCommand('underline', false, null);
    }
}

function createRichEditor(textarea) {
    const editor = document.createElement('div');
    editor.id = `${textarea.id}Editor`;
    editor.className = 'ap-rich-editor';
    editor.contentEditable = 'true';
    editor.role = 'textbox';
    editor.tabIndex = 0;
    editor.dataset.richEditor = textarea.id;
    editor.setAttribute('aria-multiline', 'true');

    if (textarea.placeholder) {
        editor.dataset.placeholder = textarea.placeholder;
    }

    const labelledBy = document.querySelector(`label[for="${textarea.id}"]`);
    if (labelledBy?.id) {
        editor.setAttribute('aria-labelledby', labelledBy.id);
    } else if (labelledBy) {
        if (!labelledBy.id) {
            labelledBy.id = `${textarea.id}Label`;
        }
        editor.setAttribute('aria-labelledby', labelledBy.id);
        labelledBy.setAttribute('for', editor.id);
    }

    textarea.classList.add('ap-rich-source');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.tabIndex = -1;

    const toolbar = textarea.parentElement?.querySelector(`[aria-controls="${textarea.id}"]`);
    if (toolbar) {
        toolbar.insertAdjacentElement('afterend', editor);
    } else {
        textarea.parentNode.insertBefore(editor, textarea);
    }
    editor.innerHTML = markdownToHtml(textarea.value || '');
    editor.classList.toggle('is-empty', !textarea.value.trim());

    const handleSync = () => {
        syncEditorToTextarea(editor, textarea);
        editor.classList.toggle('is-empty', !textarea.value.trim());
    };

    editor.addEventListener('input', handleSync);
    editor.addEventListener('blur', handleSync);

    editor.addEventListener('paste', (event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
        handleSync();
    });

    editor.addEventListener('keydown', (event) => {
        if (!(event.metaKey || event.ctrlKey)) {
            return;
        }
        if (event.key === 'b' || event.key === 'B') {
            event.preventDefault();
            applyEditorFormat(editor, 'bold');
            handleSync();
        } else if (event.key === 'i' || event.key === 'I') {
            event.preventDefault();
            applyEditorFormat(editor, 'italic');
            handleSync();
        } else if (event.key === 'u' || event.key === 'U') {
            event.preventDefault();
            applyEditorFormat(editor, 'underline');
            handleSync();
        }
    });

    return editor;
}

export function initDescriptionFormatToolbars(root = document) {
    root.querySelectorAll('[data-rich-toolbar]').forEach((toolbar) => {
        const targetId = toolbar.getAttribute('aria-controls') || toolbar.dataset.target;
        const textarea = targetId ? document.getElementById(targetId) : null;
        if (!textarea || textarea.tagName !== 'TEXTAREA') {
            return;
        }

        let editor = document.getElementById(`${textarea.id}Editor`);
        if (!editor) {
            editor = createRichEditor(textarea);
        }

        toolbar.querySelectorAll('[data-format]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                applyEditorFormat(editor, btn.dataset.format);
                syncEditorToTextarea(editor, textarea);
                editor.classList.toggle('is-empty', !textarea.value.trim());
            });
        });
    });

    const form = document.getElementById('bulletinForm');
    if (form && !form.dataset.richEditorsBound) {
        form.dataset.richEditorsBound = 'true';
        form.addEventListener('submit', () => {
            syncAllRichEditors(root);
        }, { capture: true });
    }
}
