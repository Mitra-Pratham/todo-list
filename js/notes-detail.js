// ============================================================
// notes-detail.js — Notes page: rendering, CRUD, and sections
// ============================================================

import { TodoService } from "./todo-service.js";
import { auth } from "./firebase-config.js";
import { initAuth, getCurrentUser } from "./auth.js";
import { migrateData, getLocalNotes } from "./migration.js";

/** Reusable CSS class string for small toolbar buttons */
const TOOLBAR_BTN_CLASSES = 'btn btn-lite-sm btn-no-bg-gray';

/** Reference to the shared RTF toolbar builder (loaded via <script> before this module) */
const createRTFToolbar = window.createRTFToolbar;

/** Default HTML for a brand-new note page */
const DEFAULT_NOTE_HTML = '<div id="sections-area-default" class="sections-area"><h2>Welcome to Notes!</h2></div>';

/** Default note ID used when no pages exist yet */
const DEFAULT_NOTE_ID = 'notes-area-0000001';

// ─── App Initialisation ──────────────────────────────────────

/** Bootstrap the notes page: set up auth listeners and Firestore subscription. */
function initApp() {
    const onLogin = async (user) => {
        $('#failure-message').hide();

        // Migrate local IndexedDB notes to Firestore if present
        if (await migrateData(user.uid)) {
            const successDiv = $('#success-message');
            successDiv.html('<strong>Success!</strong> Migration complete! Your data is now in the cloud.');
            successDiv.show();
            setTimeout(() => successDiv.fadeOut(), 5000);
        }

        // Subscribe to real-time notes updates
        TodoService.subscribeNotes(user.uid, (notes) => {
            notesArray = notes;

            // Seed a default note if none exist yet
            if (!notesArray || notesArray.length === 0) {
                const defaultNote = {
                    id: DEFAULT_NOTE_ID,
                    name: 'Default',
                    status: 1001,
                    html: DEFAULT_NOTE_HTML,
                };
                TodoService.saveNote(user.uid, defaultNote);
                return; // Wait for next snapshot with the new note
            }

            // Determine which page to display
            const activePageId = $('#notes-detail-area').attr('value');
            let pageToShow = notesArray.find((n) => n.id === activePageId);

            if (!pageToShow) {
                pageToShow = notesArray.find((n) => n.id === pageDefaultID) || notesArray[0];
            }

            if (pageToShow) {
                createPageTabs(notesArray, pageToShow.id);

                // Avoid overwriting content while the user is actively editing
                const isFocused = $('#notes-detail-area').is(':focus');
                if (!isFocused || $('#notes-detail-area').attr('value') !== pageToShow.id) {
                    renderNotesDetailHTML(pageToShow);
                }
            }
        });
    };

    const onLogout = async () => {
        $('#failure-message').hide();

        try {
            // Ensure the RTF toolbar function is available
            if (typeof createRTFToolbar !== 'function' && typeof window.createRTFToolbar !== 'function') {
                console.error('notes-detail.js — createRTFToolbar is not defined, using fallback.');
                window.createRTFToolbar = () => '<div class="alert alert-danger">Toolbar error</div>';
            }

            const localNotes = await getLocalNotes();
            notesArray = localNotes;

            if (!notesArray || notesArray.length === 0) {
                notesArray = [{
                    id: DEFAULT_NOTE_ID,
                    name: 'Default',
                    status: 1001,
                    html: DEFAULT_NOTE_HTML,
                }];
            } else {
                // Show migration warning if local data exists
                const alertDiv = $('#failure-message');
                if (alertDiv.length) {
                    alertDiv.removeClass('alert-danger').addClass('alert-warning');
                    alertDiv.html('<strong>Attention!</strong> You have local data. Please <a href="#" id="migration-login-link" class="alert-link">login</a> to migrate data.');
                    alertDiv.show();

                    $('#migration-login-link').off('click').on('click', (event) => {
                        event.preventDefault();
                        document.getElementById('login-btn').click();
                    });
                }
            }

            // Render the first available page
            const activePageId = $('#notes-detail-area').attr('value');
            const pageToShow = notesArray.find((n) => n.id === activePageId) || notesArray[0];

            if (pageToShow) {
                renderNotesDetailHTML(pageToShow);
            } else {
                console.error('notes-detail.js — no page to show after logout.');
            }

            createPageTabs(notesArray, pageToShow?.id ?? null);
        } catch (error) {
            console.error('notes-detail.js — logout local-data flow failed:', error);
            notesArray = [];
            $('#notes-detail-container').empty();
            $('#notes-detail-pages-tab-container').empty();
        }
    };

    initAuth(onLogin, onLogout);
}

// ─── Toaster / Persistence Helpers ───────────────────────────

/** Flash the "saved" toaster message for 3 seconds. */
function showSavedToaster() {
    $('#saved-box-message').show();
    setTimeout(() => $('#saved-box-message').hide(), 3000);
}

/**
 * Persist a single note object to Firestore and show the saved toaster.
 * @param {{id: string, name: string, status: number, html: string}} note
 */
function saveSingleNoteToDB(note) {
    const user = getCurrentUser();
    if (!user) return;

    TodoService.saveNote(user.uid, note)
        .then(() => showSavedToaster())
        .catch((error) => console.error('notes-detail.js — saveSingleNoteToDB failed:', error));
}

// ─── Rendering ───────────────────────────────────────────────

/**
 * Render the full notes detail view for a given page object.
 * @param {{id: string, name: string, html: string}} page
 */
function renderNotesDetailHTML(page) {
    $('#notes-detail-title').text(page.name);

    const detailHTML = `
        <div id="notes-detail-title-container">
            ${createRTFToolbar()}
        </div>
        <div class="notes-detail-pages-container">
            <button id="createPage" class="btn btn-lite-sm-2x btn-no-bg-gray">
                <i class="fa-solid fa-file-lines"></i>
                <span class="btn-title">Add Page</span>
            </button>
            <button id="importPage" class="btn btn-lite-sm-2x btn-no-bg-gray">
                <i class="fa-solid fa-upload"></i>
                <span class="btn-title">Import Page</span>
            </button>
            <div id="notes-detail-pages-tab-container"></div>
        </div>
        <div id="notes-detail-body">
            <div id="notes-detail-area-parent">
                <div class="notes-detail-section-toggle-container"></div>
                <section id="notes-detail-area" contenteditable="true" value="${page.id}">
                    ${page.html}
                </section>
            </div>
        </div>`;

    $('#notes-detail-container').empty().append(detailHTML);
    createPageTabs(notesArray, page.id);
    createSections();
}

// ─── Sections ────────────────────────────────────────────────

/** Build and render the section toggle sidebar from .sections-area elements. */
function createSections() {
    const sectionElements = document.getElementsByClassName('sections-area');
    const sectionToggles = [];

    for (let i = 0; i < sectionElements.length; i++) {
        const sectionId = sectionElements[i].id;
        const sectionTitle = $('.sections-area h2').eq(i).text();
        const isHidden = sectionElements[i].style.display === 'none';

        sectionToggles.push(`
            <div class="btn btn-lite-sm btn-no-bg d-flex align-items-center justify-content-between text-start"
                 tabindex="0" value="${sectionId}" index="${i}">
                ${sectionTitle}
                <div>
                    <button class="${TOOLBAR_BTN_CLASSES} hide-section ${isHidden ? 'section-hidden' : ''}">
                        <i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                </div>
            </div>`);
    }

    const addButtonsHTML = `
        <div class="notes-area-section-toggle-heading-container d-flex align-items-center justify-content-between">
            <h6>Sections</h6>
            <div class="notes-area-section-toggle-heading-icons">
                <button class="${TOOLBAR_BTN_CLASSES} add-sections-box" value="up">
                    <i class="fa-solid fa-square-caret-up"></i>
                    <span class="btn-title">Add Section Top</span>
                </button>
                <button class="${TOOLBAR_BTN_CLASSES} add-sections-box" value="down">
                    <i class="fa-solid fa-square-caret-down"></i>
                    <span class="btn-title">Add Section Bottom</span>
                </button>
            </div>
        </div>`;

    const container = $('.notes-detail-section-toggle-container');
    container.empty().append(sectionToggles);
    container.prepend(addButtonsHTML);
}

/**
 * Add a new section to the notes area (top or bottom).
 * @param {'up'|'down'} position
 */
function addSections(position) {
    const pageId = $('#notes-detail-area').attr('value');
    const sectionId = `sections-area-${Date.now()}`;
    const sectionHTML = `<div id="${sectionId}" class="sections-area"><h2>New Section</h2></div>`;

    if (position === 'up') {
        $('#notes-detail-area').prepend(sectionHTML);
    } else {
        $('#notes-detail-area').append(sectionHTML);
    }

    saveText(pageId, true, false);
}

// ─── Page CRUD ───────────────────────────────────────────────

/**
 * Create a new notes page.
 * @param {string} [importedHTML] - pre-filled HTML content (for imports)
 * @param {string} [importedName] - pre-filled name (for imports)
 */
function createPage(importedHTML, importedName) {
    const pageName = importedName || prompt('Enter page name', `Page ${$('.page-tab').length + 1}`);
    if (pageName === null) return;

    const newPageId = `notes-area-${Date.now()}`;
    const newPage = {
        id: newPageId,
        name: pageName,
        status: 1001,
        html: importedHTML || `<div id="sections-area-default" class="sections-area"><h2>${pageName}</h2></div>`,
    };

    notesArray.push(newPage);
    saveSingleNoteToDB(newPage);
    renderNotesDetailHTML(newPage);
    createPageTabs(notesArray, newPageId);
}

/**
 * Build and render page tabs in the sidebar navigation.
 * @param {Array} pages - full notesArray
 * @param {string|null} activePageId - ID of the currently active page
 */
function createPageTabs(pages, activePageId) {
    const tabsHTML = pages.map((page) => {
        const isActive = activePageId === page.id ? 'btn-no-bg-gray-active' : '';
        const deleteButton = page.id === pageDefaultID
            ? ''
            : `<button class="${TOOLBAR_BTN_CLASSES} d-flex delete-page">Delete</button>`;

        return `
            <div class="position-relative d-flex align-items-center">
                <button id="${page.id}" class="${TOOLBAR_BTN_CLASSES} d-flex page-tab ${isActive}">
                    ${page.name}
                </button>
                <div value="${page.id}" class="task-box-ui-layout">
                    <button class="${TOOLBAR_BTN_CLASSES} d-flex rename-page">Rename</button>
                    <button class="${TOOLBAR_BTN_CLASSES} d-flex export-page">Export</button>
                    ${deleteButton}
                </div>
            </div>`;
    });

    $('#notes-detail-pages-tab-container').empty().append(tabsHTML);
}

/**
 * Delete a notes page after user confirmation.
 * @param {string} pageId
 */
function deletePage(pageId) {
    const confirmed = confirm('Are you sure you want to delete this page?');
    if (!confirmed) return;

    const activeTabId = $('#notes-detail-pages-tab-container .btn-no-bg-gray-active').attr('id');
    const fallbackId = activeTabId === pageId ? pageDefaultID : activeTabId;

    notesArray = notesArray.filter((page) => page.id !== pageId);

    const user = getCurrentUser();
    if (user) {
        TodoService.deleteNote(user.uid, pageId)
            .catch((error) => console.error('notes-detail.js — deletePage failed:', error));
    }

    createPageTabs(notesArray, fallbackId);
    const fallbackPage = findPage(fallbackId);
    if (fallbackPage) renderNotesDetailHTML(fallbackPage);
}

/**
 * Find a notes page object by ID.
 * @param {string} pageId
 * @returns {Object|undefined}
 */
function findPage(pageId) {
    return notesArray.find((page) => page.id === pageId);
}

// ─── Save Logic ──────────────────────────────────────────────

/**
 * Save the current notes editor content and/or rename a page.
 * @param {string} pageId
 * @param {boolean} shouldSaveHTML - true to persist the editor innerHTML
 * @param {string|false} newName - new page name, or false to keep current
 */
function saveText(pageId, shouldSaveHTML, newName) {
    const editorHTML = replaceURLs($('#notes-detail-area').html());

    notesArray = notesArray.map((page) => {
        if (page.id !== pageId) return page;
        return {
            id: page.id,
            name: newName === false ? page.name : newName,
            status: page.status,
            html: shouldSaveHTML === true ? editorHTML : page.html,
        };
    });

    const updatedNote = notesArray.find((n) => n.id === pageId);
    if (updatedNote) saveSingleNoteToDB(updatedNote);

    createSections();

    // Refresh tabs if the page was renamed
    if (newName !== false) {
        const activeTabId = $('#notes-detail-pages-tab-container .btn-no-bg-gray-active').attr('id');
        createPageTabs(notesArray, activeTabId);
    }
}

// ─── Window Exports (for non-module listener scripts) ────────

window.createPage = createPage;
window.deletePage = deletePage;
window.saveText = saveText;
window.addSections = addSections;
window.findPage = findPage;
window.renderNotesDetailHTML = renderNotesDetailHTML;

// Boot the notes page
initApp();