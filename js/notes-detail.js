import { initAuth, getCurrentUser } from './auth.js';
import { TodoService } from './todo-service.js';

// Initialize App
function initApp() {
    initAuth((user) => {
        if (user) {
            console.log("User logged in:", user.uid);
            // Subscribe to Notes
            TodoService.subscribeNotes(user.uid, (data) => {
                notesArray = data;

                // If no notes, create default
                if (notesArray.length === 0) {
                    let defaultID = `notes-area-0000001`;
                    let defaultHTML = `<div id="sections-area-default" class="sections-area"><h2>Welcome to Notes!</h2></div>`
                    let defaultNote = {
                        id: defaultID,
                        name: 'Default',
                        status: 1001,
                        html: defaultHTML
                    };
                    TodoService.saveNote(user.uid, defaultNote);
                    return; // Wait for next update
                }

                // Determine which page to show
                let activePageId = $('#notes-detail-area').attr('value');
                let pageToShow = notesArray.find(n => n.id === activePageId);

                if (!pageToShow) {
                    pageToShow = notesArray.find(n => n.id === pageDefaultID) || notesArray[0];
                }

                if (pageToShow) {
                    createPageTabs(notesArray, pageToShow.id);

                    // Check if we are currently editing this page
                    let isFocused = $('#notes-detail-area').is(':focus');
                    if (!isFocused || $('#notes-detail-area').attr('value') !== pageToShow.id) {
                        renderNotesDetailHTML(pageToShow);
                    }
                }
            });
        } else {
            console.log("User logged out");
            notesArray = [];
            $('#notes-detail-container').empty();
            $('#notes-detail-pages-tab-container').empty();
        }
    });
}

//Save notes to Firestore
// Helper to save a single note
function saveSingleNoteToDB(note) {
    const user = getCurrentUser();
    if (user) {
        TodoService.saveNote(user.uid, note);
    }
}

// Notes Status Pipe
// 1001 - Default
// 1002 - Active

///----------------functions---------------------------

function renderNotesDetailHTML(el) {
    $('#notes-detail-title').text(el.name);
    let tempHTML = `
    <div id="notes-detail-title-container" class="">
             ${createRTFToolbar()}
        </div>
        <div class="notes-detail-pages-container">
            <button id="createPage" class="btn btn-lite-sm-2x btn-no-bg-gray"><i class="fa-solid fa-file-lines"></i>
            <span class="btn-title">Add Page</span></button>
            <button id="importPage" class="btn btn-lite-sm-2x btn-no-bg-gray"><i class="fa-solid fa-upload"></i>
            <span class="btn-title">Import Page</span></button>
            <div id="notes-detail-pages-tab-container"></div>
        </div>
    <div id="notes-detail-body">
        <div id="notes-detail-area-parent">
        <div class="notes-detail-section-toggle-container"></div>
            <section id="notes-detail-area" contenteditable="true" value="${el.id}">
                ${el.html}
            </section>
        </div>
    </div>
    `
    $('#notes-detail-container').empty();
    $('#notes-detail-container').append(tempHTML);
    createPageTabs(notesArray, el.id);
    createSections();

}

function createSections() {

    let sectionsAreaArray = document.getElementsByClassName('sections-area');
    // let sectionsList = [];
    let sectionToggleContainer = [];
    for (let i = 0; i < sectionsAreaArray.length; i++) {
        let tempID = document.getElementsByClassName('sections-area')[i].id;
        let tempText = $('.sections-area h2').eq(i).text();
        let tempDisplay = document.getElementsByClassName('sections-area')[i].style.display;
        let sectionToggle = `<div class="btn btn-lite-sm btn-no-bg d-flex align-items-center justify-content-between text-start" tabindex="0" value="${tempID}" index=${i}>${tempText}
            <div class="">
                <button class="${commonButtonClasses} hide-section ${tempDisplay === 'none' ? 'section-hidden' : ''}">
                <i class="fa-solid ${tempDisplay === 'none' ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
               
            </div>
        </div>`
        sectionToggleContainer.push(sectionToggle);
    }

    let addButtons = `
    <div class="notes-area-section-toggle-heading-container d-flex align-items-center justify-content-between ">
        <h6>Sections</h6>
        <div class="notes-area-section-toggle-heading-icons">
            <button class="${commonButtonClasses} add-sections-box" value="up">
                <i class="fa-solid fa-square-caret-up"></i>
                <span class="btn-title">Add Section Top</span>
            </button>
            <button class="${commonButtonClasses} add-sections-box" value="down">
                <i class="fa-solid fa-square-caret-down"></i>
                <span class="btn-title">Add Section Bottom</span>
            </button>
        </div>
    </div>
    `
    //left section toggle
    $('.notes-detail-section-toggle-container').empty();
    $('.notes-detail-section-toggle-container').append(sectionToggleContainer);
    $('.notes-detail-section-toggle-container').prepend(addButtons);
}

function addSections(val) {
    let pageID = $('#notes-detail-area').attr('value');
    let randomID = `sections-area-${Date.now()}`
    let sectionsList = `
    <div id="${randomID}" class="sections-area"><h2>New Section</h2></div>`
    val === 'up' ? $('#notes-detail-area').prepend(sectionsList) : $('#notes-detail-area').append(sectionsList);
    saveText(pageID, true, false);
}

//creating a page
function createPage(text, fileName) {
    let tempObj = {}
    let tempID;
    let tempName = fileName ? fileName : prompt('Enter page name', `Page ${$('.page-tab').length + 1}`);
    if (tempName != null) {
        tempID = `notes-area-${Date.now()}`,
            tempObj = {
                id: tempID,
                name: tempName,
                status: 1001,
                html: text ? text : `<div id="sections-area-default" class="sections-area"><h2>${tempName}</h2></div>`
            }
        notesArray.push(tempObj);
        saveSingleNoteToDB(tempObj);
        renderNotesDetailHTML(tempObj);
        createPageTabs(notesArray, tempID);
    }
}

//create the page tabs on the page nav
function createPageTabs(items, id) {
    let tempHTML = items.map(el => {
        return `
        <div class="position-relative d-flex align-items-center">
            <button id="${el.id}" class="${commonButtonClasses} d-flex page-tab ${id === el.id ? 'btn-no-bg-gray-active' : ''}">${el.name}
        </button>
        <div value="${el.id}" class="task-box-ui-layout">
            <button class="${commonButtonClasses} d-flex rename-page">Rename</button>
            <button class="${commonButtonClasses} d-flex export-page">Export</button>
            ${el.id === pageDefaultID ? '' : `<button class="${commonButtonClasses} d-flex delete-page">Delete
            </button>`}
        </div>
        
        </div>
        `
    });
    $('#notes-detail-pages-tab-container').empty();
    $('#notes-detail-pages-tab-container').append(tempHTML);
}

//creating a page
function deletePage(id) {
    let input = confirm('Are you sure you want to delete this page?');
    let activeID = $('#notes-detail-pages-tab-container .btn-no-bg-gray-active').attr('id');
    let isActive = activeID === id ? pageDefaultID : activeID;
    if (input === true) {
        let tempArray = notesArray.filter(el => el.id != id);

        const user = getCurrentUser();
        if (user) {
            TodoService.deleteNote(user.uid, id);
        }

        notesArray = tempArray;
        createPageTabs(notesArray, isActive);
        let newObj = findPage(isActive);
        renderNotesDetailHTML(newObj);
    }
}

//finding a page
function findPage(id) {
    let tempItem = notesArray.find(el => el.id === id)
    return tempItem;
}

//saving the html
function saveText(pageID, pageHTML, pageName) {
    let pageHTMLVal = $('#notes-detail-area').html();
    let tempArray = notesArray.map(function (el) {
        if (el.id === pageID) {
            let tempObj = {
                id: el.id,
                name: pageName === false ? el.name : pageName,
                status: el.status,
                html: pageHTML === true ? pageHTMLVal : el.html
            }
            return tempObj;
        }
        else {
            return el
        }
    });

    // Find the updated note and save it
    const updatedNote = tempArray.find(n => n.id === pageID);
    if (updatedNote) {
        saveSingleNoteToDB(updatedNote);
    }

    createSections();
    notesArray = tempArray;
    //show toaster on save
    $('#saved-box-message').show();
    setTimeout(() => {
        $('#saved-box-message').hide();
    }, 3000);
    if (pageName !== false) {
        let activeID = $('#notes-detail-pages-tab-container .btn-no-bg-gray-active').attr('id');
        createPageTabs(notesArray, activeID);
    }
}


// Make functions global for listeners
window.createPage = createPage;
window.deletePage = deletePage;
window.saveText = saveText;
window.addSections = addSections;
window.findPage = findPage;
window.renderNotesDetailHTML = renderNotesDetailHTML;

initApp();