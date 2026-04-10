// ============================================================
// listeners.js — Event listeners for the Todo list page
// ============================================================

import {
    taskArray,
    bsOffcanvas,
    createTask,
    deleteTasks,
    updateTasks,
    deleteDateList,
    findTask,
    setMessageState,
    renderTaskDetailHTML,
    getSelectedList,
    deleteSelectedList,
    doneSelectedList,
    markAllAsDone,
    createDateList,
    STATUS_TODO,
    STATUS_COMPLETED,
} from "./main.js";
import { replaceURLs, escapeHTML, isValidURL, DATE_ID_START, DATE_ID_END, TASK_ID_OFFSET } from "./utils.js";
import { createRTFToolbar } from "./notes-common.js";

//--------------------Cached DOM references---------------------

const dateListContainer = document.getElementById('date-list-container');
const detailContainer = document.getElementById('task-detail-container');
const dateInput = document.getElementById('todo-date-input');
const contextMenu = document.getElementById('context-menu');

/**
 * Attach a delegated event listener to a parent element.
 * @param {HTMLElement} parent
 * @param {string} eventType
 * @param {string} selector
 * @param {Function} handler - receives (event, matchedElement)
 */
function delegate(parent, eventType, selector, handler) {
    parent.addEventListener(eventType, (e) => {
        const target = e.target.closest(selector);
        if (target && parent.contains(target)) {
            handler(e, target);
        }
    });
}

//--------------------event listeners-------------------------------------

// ─── Create Popover toggle ──────────────────────────────────────
const createPopover = document.getElementById('create-popover');
const createToggleBtn = document.getElementById('create-toggle-btn');
if (createToggleBtn && createPopover) {
    createToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        createPopover.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!createPopover.contains(e.target) && !createToggleBtn.contains(e.target)) {
            createPopover.classList.add('hidden');
        }
    });
}

//Creating and setting date lists
dateInput.value = new Date().toISOString().slice(0, 10);

//+ button to create the date list
document.getElementById('todo-date-submit').addEventListener('click', () => {
    const inputDate = dateInput.value;
    const inputDateName = new Date(inputDate).toLocaleDateString('en-us', { weekday: "long", year: "numeric", month: "short", day: "numeric" });

    const alreadyExists = taskArray.some((dateItem) => dateItem.id === inputDate);
    if (!alreadyExists) {
        createDateList(inputDate, inputDateName);
    } else {
        setMessageState('failure', 'Date list already exists!');
    }
});

//event listener to delete date list
delegate(dateListContainer, 'click', '.todo-date-delete', (e, el) => {
    deleteDateList(el.value);
});

//event listener to mark all tasks as done
delegate(dateListContainer, 'click', '.mark-all-done-btn', (e, el) => {
    markAllAsDone(el.value);
});

//keydown 'enter' event listener to create the task item
delegate(dateListContainer, 'keydown', '.create-task-input', (e, el) => {
    if (e.key === 'Enter') {
        createTask(el.value.trim(), el.id.slice(11), el, '');
    }
});

//event listener to delete tasks from the delete button
function handleTaskDelete(e, el) {
    const val = el.value;
    deleteTasks(val.slice(DATE_ID_START, DATE_ID_END), val.slice(TASK_ID_OFFSET));
    bsOffcanvas.hide();
}
delegate(dateListContainer, 'click', '.todo-task-delete', handleTaskDelete);
delegate(detailContainer, 'click', '.todo-task-delete', handleTaskDelete);

//event listener to create the input field for editing the tasks
delegate(dateListContainer, 'click', '.todo-task-edit', (e, el) => {
    const val = el.value;
    const dateId = val.slice(DATE_ID_START, DATE_ID_END);
    const taskId = val.slice(TASK_ID_OFFSET);
    const nameSpan = el.closest('.flex')?.previousElementSibling?.querySelector('.task-name')
        || el.parentElement?.previousElementSibling?.querySelector('.task-name');
    if (!nameSpan) return;
    const currentName = nameSpan.textContent.trim();

    nameSpan.innerHTML = `<input id="update-task-name" class="w-3/4" type="text" prevValue='${escapeHTML(currentName)}' dateID='${dateId}' taskID='${taskId}' value='${escapeHTML(currentName)}'>`;
    document.getElementById('update-task-name')?.focus();
});

//event listener to create the input field for editing the tasks in the detail view
delegate(detailContainer, 'click', '.todo-task-edit', (e, el) => {
    const val = el.value;
    const dateId = val.slice(DATE_ID_START, DATE_ID_END);
    const taskId = val.slice(TASK_ID_OFFSET);
    const titleEl = detailContainer.querySelector('.offcanvas-title');
    if (!titleEl) return;
    const currentName = titleEl.textContent.trim();

    titleEl.innerHTML = `<textarea id="update-task-name" class="w-full" type="text" prevValue='${escapeHTML(currentName)}' dateID='${dateId}' taskID='${taskId}' value='${escapeHTML(currentName)}'>${escapeHTML(currentName)}</textarea>`;
    document.getElementById('update-task-name')?.focus();
});

//event listener to take the input from the input field tasks from the edit button
function handleEditKeydown(e, el) {
    if (e.key === 'Enter') {
        const newName = el.value.trim();
        const dateId = el.getAttribute('dateid');
        const taskId = el.getAttribute('taskid');
        updateTasks(dateId, taskId, newName, '', '');
        if (el.parentElement.classList.contains('offcanvas-title')) {
            el.parentElement.innerHTML = replaceURLs(newName);
        }
        el.remove();
    } else if (e.key === 'Escape') {
        const previousValue = el.getAttribute('prevvalue');
        el.parentElement.innerHTML = replaceURLs(previousValue);
    }
}
delegate(dateListContainer, 'keydown', '#update-task-name', handleEditKeydown);
delegate(detailContainer, 'keydown', '#update-task-name', handleEditKeydown);

//event listener to toggle checkbox completion
delegate(dateListContainer, 'click', '.todo-task-check', (e, el) => {
    const val = el.value;
    const statusCode = Number(el.getAttribute('statuscode'));
    const newStatusCode = statusCode === STATUS_TODO ? STATUS_COMPLETED : STATUS_TODO;
    updateTasks(val.slice(DATE_ID_START, DATE_ID_END), val.slice(TASK_ID_OFFSET), '', newStatusCode, '');
});

//event listener to create the detail view
delegate(dateListContainer, 'click', '.todo-task-detail', (e, el) => {
    bsOffcanvas.show();
    const val = el.value;
    const taskObj = findTask(val.slice(DATE_ID_START, DATE_ID_END), val.slice(TASK_ID_OFFSET));
    detailContainer.innerHTML = renderTaskDetailHTML(taskObj);
});

// event listener to select multiple tasks
delegate(dateListContainer, 'click', '.list-group-item', (e, el) => {
    if (e.ctrlKey) {
        el.classList.toggle('list-group-item-selected');
    }
});

// Open context menu on right-click
delegate(dateListContainer, 'contextmenu', '.list-group-item', (e) => {
    e.preventDefault();
    contextMenu.style.display = '';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
});

// Dismiss context menu when clicking anywhere outside it
document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) {
        contextMenu.style.display = 'none';
    }
});

//--------------------Task Notes/Detail View----------------

// Helper to toggle visibility of a toolbar sub-panel
function togglePanel(panelId, toggleSelector) {
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
    document.querySelector(toggleSelector)?.classList.toggle('btn-no-bg-gray-active');
}

//headings box toggle
delegate(detailContainer, 'mousedown', '.headings-box', (e) => {
    e.preventDefault();
    togglePanel('headings-box-container', '.headings-box');
});

//adding headings to notes area
delegate(detailContainer, 'mousedown', '#headings-box-container button', (e, el) => {
    e.preventDefault();
    const { dateId, taskId } = getNotesTaskIds();
    const headingTag = el.getAttribute('value');
    const notesArea = document.getElementById('task-notes-area');
    const isFocused = document.activeElement === notesArea;

    if (isFocused) {
        try {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const headingEl = document.createElement(headingTag);
            headingEl.innerHTML = selection.toString();
            range.deleteContents();
            range.insertNode(headingEl);
        } catch (error) {
            console.error('listeners.js — heading insert failed:', error);
        }
    } else if (notesArea) {
        notesArea.insertAdjacentHTML('beforeend', `<${headingTag}>Heading ${headingTag.slice(1, 2)}</${headingTag}>`);
    }

    updateTasks(dateId, taskId, '', '', true);
    const hBox = document.getElementById('headings-box-container');
    if (hBox) hBox.style.display = 'none';
    document.querySelector('.headings-box')?.classList.remove('btn-no-bg-gray-active');
});

//adding ordered list to notes area
delegate(detailContainer, 'click', '.ol-box', () => {
    const { dateId, taskId } = getNotesTaskIds();
    document.getElementById('task-notes-area')?.insertAdjacentHTML('beforeend', '<ol><li>An Item here</li></ol>');
    updateTasks(dateId, taskId, '', '', true);
});

//adding unordered list to notes area
delegate(detailContainer, 'click', '.ul-box', () => {
    const { dateId, taskId } = getNotesTaskIds();
    document.getElementById('task-notes-area')?.insertAdjacentHTML('beforeend', '<ul><li>An Item here</li></ul>');
    updateTasks(dateId, taskId, '', '', true);
});

//colors box toggle
delegate(detailContainer, 'click', '.colors-box', () => {
    togglePanel('colors-box-container', '.colors-box');
});

//adding color to selected font
delegate(detailContainer, 'click', '#colors-box-container button', (e, el) => {
    const { dateId, taskId } = getNotesTaskIds();
    try {
        const selection = window.getSelection();
        const colorSpan = document.createElement('span');
        colorSpan.innerText = selection.toString();
        colorSpan.style.color = el.value;
        selection.getRangeAt(0).deleteContents();
        selection.getRangeAt(0).insertNode(colorSpan);
    } catch (error) {
        console.error('listeners.js — font colour failed:', error);
    }
    updateTasks(dateId, taskId, '', '', true);
    const cBox = document.getElementById('colors-box-container');
    if (cBox) cBox.style.display = 'none';
    document.querySelector('.colors-box')?.classList.remove('btn-no-bg-gray-active');
});

//background box toggle
delegate(detailContainer, 'click', '.background-box', () => {
    togglePanel('background-box-container', '.background-box');
});

//adding background color to selected font
delegate(detailContainer, 'click', '#background-box-container button', (e, el) => {
    const { dateId, taskId } = getNotesTaskIds();
    try {
        const selection = window.getSelection();
        const bgSpan = document.createElement('span');
        bgSpan.innerText = selection.toString();
        bgSpan.style.backgroundColor = el.value;
        selection.getRangeAt(0).deleteContents();
        selection.getRangeAt(0).insertNode(bgSpan);
    } catch (error) {
        console.error('listeners.js — background colour failed:', error);
    }
    updateTasks(dateId, taskId, '', '', true);
    const bBox = document.getElementById('background-box-container');
    if (bBox) bBox.style.display = 'none';
    document.querySelector('.background-box')?.classList.remove('btn-no-bg-gray-active');
});

// save notes on blur
delegate(detailContainer, 'focusout', '#task-notes-area', () => {
    const { dateId, taskId } = getNotesTaskIds();
    updateTasks(dateId, taskId, '', '', true);
});

//keypress listener here for notes area
delegate(detailContainer, 'keydown', '#task-notes-area', (e) => {
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
            const linkUrl = prompt('please enter URL here', 'https://google.com');
            if (linkUrl && isValidURL(linkUrl)) {
                const linkWrapper = document.createElement('span');
                linkWrapper.innerHTML = `<a href="${escapeHTML(linkUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(selection.toString())}</a>`;
                range.deleteContents();
                range.insertNode(linkWrapper);
            } else if (linkUrl) {
                alert('Invalid URL. Only http and https URLs are allowed.');
            }
        }
    } catch (error) {
        console.error('listeners.js — notes keydown handler failed:', error);
    }
});

/**
 * Helper — extract dateId and taskId from the task-notes-area value attribute.
 * @returns {{dateId: string, taskId: string}}
 */
function getNotesTaskIds() {
    const value = document.getElementById('task-notes-area')?.getAttribute('value') || '';
    return { dateId: value.slice(DATE_ID_START, DATE_ID_END), taskId: value.slice(TASK_ID_OFFSET) };
}

// Context menu delegated listeners (replaces inline onclick handlers)
document.getElementById('ctx-done-btn')?.addEventListener('click', () => doneSelectedList());
document.getElementById('ctx-delete-btn')?.addEventListener('click', () => deleteSelectedList());