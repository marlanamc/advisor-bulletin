const HELP_SELECTOR = 'small.input-help, p.input-help';

function findLabelForHelp(helpEl) {
    const prev = helpEl.previousElementSibling;
    if (prev?.matches('label, summary, .ap-accordion-title, h3')) {
        return prev;
    }

    const group = helpEl.closest(
        '.form-group, .ap-category-picker-block, .ap-flyer-pdf-addon-copy, details.resource-action-links-field',
    );
    if (group) {
        const label = group.querySelector(':scope > label, :scope > summary, label[for]');
        if (label) return label;
    }

    if (helpEl.classList.contains('ap-spanish-translation-intro')) {
        return helpEl.closest('.ap-accordion-section')?.querySelector('.ap-accordion-title') || null;
    }

    return null;
}

function syncPopoverContent(fieldHelp) {
    const source = fieldHelp.querySelector('.field-help-source');
    const popover = fieldHelp.querySelector('.field-help-popover');
    if (!source || !popover) return;
    popover.innerHTML = source.innerHTML;
}

function closeAllFieldHelp(except = null) {
    document.querySelectorAll('.field-help.is-open').forEach((fieldHelp) => {
        if (fieldHelp === except) return;
        fieldHelp.classList.remove('is-open');
        const trigger = fieldHelp.querySelector('.field-help-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
}

function attachFieldHelpBehavior(fieldHelp) {
    const trigger = fieldHelp.querySelector('.field-help-trigger');
    if (!trigger || trigger.dataset.bound === 'true') return;
    trigger.dataset.bound = 'true';

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = fieldHelp.classList.contains('is-open');
        closeAllFieldHelp();
        if (isOpen) {
            return;
        }
        syncPopoverContent(fieldHelp);
        fieldHelp.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
    });

    fieldHelp.addEventListener('mouseenter', () => {
        if (!window.matchMedia('(hover: hover)').matches) return;
        syncPopoverContent(fieldHelp);
        fieldHelp.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
    });

    fieldHelp.addEventListener('mouseleave', () => {
        if (!window.matchMedia('(hover: hover)').matches) return;
        fieldHelp.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
    });
}

function convertHelpElement(helpEl) {
    if (!helpEl || helpEl.dataset.helpConverted === 'true') return;
    const helpText = helpEl.innerHTML.trim();
    if (!helpText) return;

    const label = findLabelForHelp(helpEl);
    if (!label) return;

    if (label.querySelector('.field-help')) {
        helpEl.dataset.helpConverted = 'true';
        helpEl.classList.add('field-help-source');
        helpEl.hidden = true;
        return;
    }

    helpEl.classList.add('field-help-source');
    helpEl.hidden = true;
    helpEl.dataset.helpConverted = 'true';

    const fieldHelp = document.createElement('span');
    fieldHelp.className = 'field-help';

    const popoverId = `field-help-${Math.random().toString(36).slice(2, 9)}`;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'field-help-trigger';
    trigger.setAttribute('aria-label', 'Show field help');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', popoverId);
    trigger.textContent = '?';

    const popover = document.createElement('div');
    popover.className = 'field-help-popover';
    popover.id = popoverId;
    popover.setAttribute('role', 'tooltip');
    popover.innerHTML = helpText;

    fieldHelp.append(trigger, popover, helpEl);
    label.appendChild(fieldHelp);
    attachFieldHelpBehavior(fieldHelp);
}

export function initAdminFieldHelp(root = document) {
    const scope = typeof root === 'string' ? document.querySelector(root) : root;
    if (!scope) return;

    scope.querySelectorAll(HELP_SELECTOR).forEach(convertHelpElement);

    if (!document.documentElement.dataset.fieldHelpBound) {
        document.documentElement.dataset.fieldHelpBound = 'true';
        document.addEventListener('click', (event) => {
            if (event.target.closest('.field-help')) return;
            closeAllFieldHelp();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeAllFieldHelp();
        });
    }
}
