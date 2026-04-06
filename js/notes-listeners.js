// ============================================================
// notes-listeners.js — Event listeners for the Notes detail page
// ============================================================

// ─── Auto-Save ───────────────────────────────────────────────

// Save notes content when the editor loses focus
$('#notes-detail-container').on('blur', '#notes-detail-area', function () {
    const pageId = $('#notes-detail-area').attr('value');
    saveText(pageId, true, false);
});

// ─── RTF Toolbar Toggles ────────────────────────────────────

// Toggle headings / colours / background pickers
$('#notes-detail-container').on('mousedown', '.headings-box, .colors-box, .background-box', function (e) {
    e.preventDefault();
    if ($(this).hasClass('headings-box')) {
        $('.headings-box').toggleClass('btn-no-bg-gray-active');
        $('#headings-box-container').toggle();
    } else if ($(this).hasClass('colors-box')) {
        $('.colors-box').toggleClass('btn-no-bg-gray-active');
        $('#colors-box-container').toggle();
    } else if ($(this).hasClass('background-box')) {
        $('.background-box').toggleClass('btn-no-bg-gray-active');
        $('#background-box-container').toggle();
    }
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

// Insert heading into notes area
$('#notes-detail-container').on('mousedown', '#headings-box-container button', function (e) {
    e.preventDefault();
    const headingTag = $(this).attr('value');
    const isFocused = $('#notes-detail-area').is(':focus');

    if (isFocused) {
        insertFormattedNode('heading', headingTag);
    } else {
        const headingMarkup = `<${headingTag}>Heading ${headingTag.slice(1, 2)}</${headingTag}>`;
        $('#notes-detail-area').append(headingMarkup);
    }

    const pageId = $('#notes-detail-area').attr('value');
    saveText(pageId, true, false);
    $('#headings-box-container').hide();
    $('.headings-box').removeClass('btn-no-bg-gray-active');
});

// Apply font colour to selected text
$('#notes-detail-container').on('mousedown', '#colors-box-container button', function (e) {
    e.preventDefault();
    const colorValue = $(this).attr('value');
    const isFocused = $('#notes-detail-area').is(':focus');

    if (isFocused) {
        insertFormattedNode('color', colorValue);
    }

    const pageId = $('#notes-detail-area').attr('value');
    saveText(pageId, true, false);
    $('#colors-box-container').hide();
    $('.colors-box').removeClass('btn-no-bg-gray-active');
});

// Apply background colour to selected text
$('#notes-detail-container').on('mousedown', '#background-box-container button', function (e) {
    e.preventDefault();
    const bgValue = $(this).attr('value');
    const isFocused = $('#notes-detail-area').is(':focus');

    if (isFocused) {
        insertFormattedNode('background', bgValue);
    }

    const pageId = $('#notes-detail-area').attr('value');
    saveText(pageId, true, false);
    $('#background-box-container').hide();
    $('.background-box').removeClass('btn-no-bg-gray-active');
});

// ─── Sections ────────────────────────────────────────────────

// Add a section above or below the notes area
$('#notes-detail-container').on('click', '.add-sections-box', function () {
    const position = $(this).attr('value');
    addSections(position);
});

// ─── Page Management ─────────────────────────────────────────

// Create a new page
$('#notes-detail-container').on('click', '#createPage', () => {
    createPage();
});

// Import a page from a local file
$('#notes-detail-container').on('click', '#importPage', async function () {
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
$('#notes-detail-container').on('click', '.page-tab', function () {
    const pageId = $(this).attr('id');
    const pageObj = findPage(pageId);
    renderNotesDetailHTML(pageObj);
});

// Right-click context menu for page tabs
$('#notes-detail-container').on('contextmenu', '.page-tab', function (e) {
    e.preventDefault();
    const menuEl = $(this).next();
    const isOpen = menuEl.hasClass('section-open');
    $('.section-open').hide().removeClass('section-open');
    if (!isOpen) {
        menuEl.show().addClass('section-open');
    }
});

// Delete a page
$('#notes-detail-container').on('click', '.delete-page', function () {
    const pageId = $(this).parent().attr('value');
    deletePage(pageId);
});

// Rename a page
$('#notes-detail-container').on('click', '.rename-page', function () {
    const pageId = $(this).parent().attr('value');
    const currentName = $(this).parent().prev().text().trim();
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
$('#notes-detail-container').on('click', '.export-page', function () {
    const pageId = $(this).parent().attr('value');
    const pageObj = findPage(pageId);
    const pageName = $(this).parent().prev().text().trim();

    getNewFileHandle(pageName)
        .then((handle) => {
            writeFile(handle, pageObj.html);
            $('.section-open').hide().removeClass('section-open');
        })
        .catch((error) => {
            console.error('notes-listeners.js — export failed:', error);
        });
});

// ─── Notes Keyboard Shortcuts ────────────────────────────────

$('#notes-detail-container').on('keydown', '#notes-detail-area', function (e) {
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
            if (linkUrl) {
                const linkWrapper = document.createElement('span');
                linkWrapper.innerHTML = `<a href="${linkUrl}" target="_blank">${selection.toString()}</a>`;
                range.deleteContents();
                range.insertNode(linkWrapper);
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
