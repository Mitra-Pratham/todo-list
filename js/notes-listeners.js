// ============================================================
// notes-listeners.js — Event listeners for the Notes detail page
// ============================================================

import {
    createPage,
    deletePage,
    saveText,
    addSections,
    findPage,
    renderNotesDetailHTML,
} from "./notes-detail.js";
import { replaceURLs, escapeHTML, isValidURL } from "./utils.js";

// ─── Cached DOM references ───────────────────────────────────

const notesContainer = document.getElementById('notes-detail-container');

/**
 * Attach a delegated event listener to a parent element.
 * @param {string} eventType
 * @param {string} selector
 * @param {Function} handler - receives (event, matchedElement)
 */
function delegate(eventType, selector, handler) {
    notesContainer.addEventListener(eventType, (e) => {
        const target = e.target.closest(selector);
        if (target && notesContainer.contains(target)) {
            handler(e, target);
        }
    });
}

/** Helper: get the notes editor element */
function getEditor() {
    return document.getElementById('notes-detail-area');
}

/** Helper: toggle a toolbar sub-panel */
function togglePanel(panelId, toggleSelector) {
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
    document.querySelector(toggleSelector)?.classList.toggle('btn-no-bg-gray-active');
}

// ─── Auto-Save (debounced) ───────────────────────────────────

let _saveTimer = null;
// Save notes content when the editor loses focus (debounced 500ms)
delegate('focusout', '#notes-detail-area', () => {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        const editor = getEditor();
        if (editor) saveText(editor.getAttribute('value'), true, false);
    }, 500);
});

// ─── RTF Toolbar Toggles ────────────────────────────────────

// Toggle headings / colours / background pickers
delegate('mousedown', '.headings-box', (e) => {
    e.preventDefault();
    togglePanel('headings-box-container', '.headings-box');
});
delegate('mousedown', '.colors-box', (e) => {
    e.preventDefault();
    togglePanel('colors-box-container', '.colors-box');
});
delegate('mousedown', '.background-box', (e) => {
    e.preventDefault();
    togglePanel('background-box-container', '.background-box');
});

// ─── Selection Formatting Helper ─────────────────────────────

/**
 * Insert a styled DOM node at the current text selection.
 * @param {'heading'|'color'|'background'} formatType
 * @param {string} value - tag name (e.g. 'h2') or CSS colour value
 */
function insertFormattedNode(formatType, value) {
    try {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        let newElement = null;

        switch (formatType) {
            case 'heading':
                newElement = document.createElement(value);
                newElement.innerHTML = selection.toString();
                break;
            case 'color':
                newElement = document.createElement('span');
                newElement.innerText = selection.toString();
                newElement.style.color = value;
                break;
            case 'background':
                newElement = document.createElement('span');
                newElement.innerText = selection.toString();
                newElement.style.backgroundColor = value;
                break;
            default:
                return;
        }

        range.deleteContents();
        range.insertNode(newElement);
    } catch (error) {
        console.error('notes-listeners.js — insertFormattedNode failed:', error);
    }
}

// ─── Heading / Colour / Background Insertion ─────────────────

/** Helper: save + close panel after formatting action */
function saveAndClosePanel(panelId, toggleSelector) {
    const editor = getEditor();
    if (editor) saveText(editor.getAttribute('value'), true, false);
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = 'none';
    document.querySelector(toggleSelector)?.classList.remove('btn-no-bg-gray-active');
}

// Insert heading into notes area
delegate('mousedown', '#headings-box-container button', (e, el) => {
    e.preventDefault();
    const headingTag = el.getAttribute('value');
    const editor = getEditor();
    const isFocused = document.activeElement === editor;

    if (isFocused) {
        insertFormattedNode('heading', headingTag);
    } else if (editor) {
        editor.insertAdjacentHTML('beforeend', `<${headingTag}>Heading ${headingTag.slice(1, 2)}</${headingTag}>`);
    }

    saveAndClosePanel('headings-box-container', '.headings-box');
});

// Apply font colour to selected text
delegate('mousedown', '#colors-box-container button', (e, el) => {
    e.preventDefault();
    const editor = getEditor();
    if (document.activeElement === editor) {
        insertFormattedNode('color', el.getAttribute('value'));
    }
    saveAndClosePanel('colors-box-container', '.colors-box');
});

// Apply background colour to selected text
delegate('mousedown', '#background-box-container button', (e, el) => {
    e.preventDefault();
    const editor = getEditor();
    if (document.activeElement === editor) {
        insertFormattedNode('background', el.getAttribute('value'));
    }
    saveAndClosePanel('background-box-container', '.background-box');
});

// ─── Sections ────────────────────────────────────────────────

// Add a section above or below the notes area
delegate('click', '.add-sections-box', (e, el) => {
    addSections(el.getAttribute('value'));
});

// ─── Page Management ─────────────────────────────────────────

// Create a new page
delegate('click', '#createPage', () => {
    createPage();
});

// Import a page from a local file
delegate('click', '#importPage', async () => {
    try {
        const [fileHandle] = await window.showOpenFilePicker();
        const file = await fileHandle.getFile();
        const fileName = fileHandle.name.slice(0, fileHandle.name.lastIndexOf('.'));
        const contents = await file.text();
        createPage(contents, fileName);
    } catch (error) {
        console.error('notes-listeners.js — file import failed:', error);
    }
});

// Navigate to a page tab
delegate('click', '.page-tab', (e, el) => {
    const pageObj = findPage(el.id);
    renderNotesDetailHTML(pageObj);
});

// Right-click context menu for page tabs
delegate('contextmenu', '.page-tab', (e, el) => {
    e.preventDefault();
    const menuEl = el.nextElementSibling;
    const isOpen = menuEl?.classList.contains('section-open');
    // Close all open menus
    document.querySelectorAll('.section-open').forEach(m => {
        m.style.display = 'none';
        m.classList.remove('section-open');
    });
    if (!isOpen && menuEl) {
        menuEl.style.display = '';
        menuEl.classList.add('section-open');
    }
});

// Delete a page
delegate('click', '.delete-page', (e, el) => {
    const pageId = el.parentElement.getAttribute('value');
    deletePage(pageId);
});

// Rename a page
delegate('click', '.rename-page', (e, el) => {
    const pageId = el.parentElement.getAttribute('value');
    const currentName = el.parentElement.previousElementSibling?.textContent.trim() || '';
    const newName = prompt('Rename the page', currentName);
    if (newName !== null) {
        saveText(pageId, false, newName);
    }
});

// ─── File Export ─────────────────────────────────────────────

/**
 * Show a "Save As" dialog and return the file handle.
 * @param {string} suggestedName
 * @returns {Promise<FileSystemFileHandle>}
 */
async function getNewFileHandle(suggestedName) {
    const options = {
        suggestedName,
        startIn: 'downloads',
        types: [{
            description: 'HTML Files',
            accept: { 'text/plain': ['.html'] },
        }],
    };
    return await window.showSaveFilePicker(options);
}

/**
 * Write string contents to a file handle.
 * @param {FileSystemFileHandle} fileHandle
 * @param {string} contents
 */
async function writeFile(fileHandle, contents) {
    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
}

// Export the current page as an HTML file
delegate('click', '.export-page', (e, el) => {
    const pageId = el.parentElement.getAttribute('value');
    const pageObj = findPage(pageId);
    const pageName = el.parentElement.previousElementSibling?.textContent.trim() || '';

    getNewFileHandle(pageName)
        .then((handle) => {
            writeFile(handle, pageObj.html);
            document.querySelectorAll('.section-open').forEach(m => {
                m.style.display = 'none';
                m.classList.remove('section-open');
            });
        })
        .catch((error) => {
            console.error('notes-listeners.js — export failed:', error);
        });
});

// ─── Notes Keyboard Shortcuts ────────────────────────────────

delegate('keydown', '#notes-detail-area', (e) => {
    try {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);

        // Tab → insert unordered list
        if (e.key === 'Tab') {
            e.preventDefault();
            const ulElement = document.createElement('ul');
            ulElement.innerHTML = '<li></li>';
            range.insertNode(ulElement);
            range.selectNodeContents(ulElement);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // Ctrl+9 → insert ordered list
        if (e.ctrlKey && e.key === '9') {
            const olElement = document.createElement('ol');
            olElement.innerHTML = '<li></li>';
            range.insertNode(olElement);
            range.selectNodeContents(olElement);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // Ctrl+K → convert selection to hyperlink
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            const linkUrl = prompt('Please enter URL here', 'https://google.com');
            if (linkUrl && isValidURL(linkUrl)) {
                const linkWrapper = document.createElement('span');
                linkWrapper.innerHTML = `<a href="${escapeHTML(linkUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(selection.toString())}</a>`;
                range.deleteContents();
                range.insertNode(linkWrapper);
            } else if (linkUrl) {
                alert('Invalid URL. Only http and https URLs are allowed.');
            }
        }

        // Ctrl+` → convert selection to code block
        if (e.ctrlKey && e.key === '`') {
            e.preventDefault();
            const codeElement = document.createElement('code');
            codeElement.innerHTML = selection.toString();
            range.deleteContents();
            range.insertNode(codeElement);
        }
    } catch (error) {
        console.error('notes-listeners.js — keydown handler failed:', error);
    }
});
