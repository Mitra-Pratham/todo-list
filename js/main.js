// ============================================================
// main.js — App entry point, rendering, and task CRUD operations
// ============================================================

import { initAuth, getCurrentUser } from "./auth.js";
import { TodoService } from "./todo-service.js";
import { hasLocalData, getLocalTasks, migrateData } from "./migration.js";

/** Firestore snapshot unsubscribe handle */
let unsubscribe;

/**
 * Previous snapshot data keyed by date-list ID, used for differential rendering.
 * @type {Map<string, object>}
 */
const previousDateListMap = new Map();

/** Debounce timer ID for snapshot-driven rendering */
let renderDebounceTimer = null;

/** Debounce delay in milliseconds for collapsing rapid Firestore snapshots */
const RENDER_DEBOUNCE_MS = 100;

// ─── Status Code Constants ───────────────────────────────────
const STATUS_TODO      = 1001;
const STATUS_ONGOING   = 1002;
const STATUS_BLOCKED   = 1003;
const STATUS_COMPLETED = 1004;
const STATUS_ARCHIVED  = 1005;

/** Map status codes to human-readable labels */
const STATUS_LABELS = {
    [STATUS_TODO]:      'To-Do',
    [STATUS_ONGOING]:   'Ongoing',
    [STATUS_BLOCKED]:   'Blocked',
    [STATUS_COMPLETED]: 'Completed',
    [STATUS_ARCHIVED]:  'Archived',
};

// ─── App Initialisation ──────────────────────────────────────

/** Bootstrap the app: set up auth listeners and Firestore subscriptions. */
function initApp() {
    initAuth(async (user) => {
        console.log("User logged in");

        // Migrate local IndexedDB data to Firestore if present
        if (await hasLocalData()) {
            const migrated = await migrateData(user.uid);
            if (migrated) {
                const successDiv = $('#success-message');
                successDiv.html('<strong>Success!</strong> Migration complete! Your data is now in the cloud.');
                successDiv.show();
                setTimeout(() => successDiv.fadeOut(), 5000);
            }
        }

        // Subscribe to real-time Firestore updates with debounced rendering
        unsubscribe = TodoService.subscribe(user.uid, (dateLists) => {
            debouncedRender(dateLists);
        });

        $('#failure-message').hide();

    }, async () => {
        console.log("User logged out");
        if (unsubscribe) unsubscribe();

        if (await hasLocalData()) {
            console.log("Found local data, displaying...");
            const localTasks = await getLocalTasks();
            taskArray = sortByDate(localTasks).reverse();
            renderDateList(localTasks);
            renderDateNav(localTasks);
            showMigrationWarning();
        } else {
            taskArray = [];
            renderDateList([]);
            renderDateNav([]);
        }
    });
}

/**
 * Debounce wrapper — collapses rapid consecutive snapshot callbacks
 * into a single render pass (e.g. when marking many tasks done at once).
 * @param {Array} dateLists - raw snapshot data from Firestore
 */
function debouncedRender(dateLists) {
    clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => {
        renderDateList(dateLists);
        renderDateNav(dateLists);
    }, RENDER_DEBOUNCE_MS);
}

/** Show migration warning banner with login link. */
function showMigrationWarning() {
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

// Start the app
initApp();

// ─── UI Helpers ──────────────────────────────────────────────

/**
 * Show a success or failure toast message for 4 seconds.
 * @param {'success'|'failure'} type
 * @param {string} message
 */
function setMessageState(type, message) {
    const messageEl = $(`#${type}-message`);
    messageEl.text(message);
    messageEl.show();
    setTimeout(() => messageEl.hide(), 4000);
}

/**
 * Count how many tasks in a list have status "Completed".
 * @param {Array<{statusCode: number}>} tasks
 * @returns {number}
 */
function countCompletedTasks(tasks) {
    return tasks.filter((task) => task.statusCode === STATUS_COMPLETED).length;
}

/**
 * Get a human-readable label for a status code.
 * @param {number} statusCode
 * @returns {string}
 */
function getStatusLabel(statusCode) {
    return STATUS_LABELS[statusCode] ?? '';
}

// ─── Differential Rendering — Date Lists ─────────────────────

/**
 * Render the main date-list view. Uses differential updates:
 * only re-renders date lists that have actually changed.
 * @param {Array} dateLists - array of date-list objects from Firestore
 */
function renderDateList(dateLists) {
    taskArray = sortByDate(dateLists).reverse();

    const container = document.getElementById('date-list-container');
    const incomingIds = new Set(taskArray.map((dl) => dl.id));

    // Remove date lists that no longer exist
    for (const [existingId] of previousDateListMap) {
        if (!incomingIds.has(existingId)) {
            const existingEl = document.getElementById(`date-item-${existingId}`);
            if (existingEl) existingEl.remove();
            previousDateListMap.delete(existingId);
        }
    }

    // Add or update each date list
    for (const dateItem of taskArray) {
        const previousData = previousDateListMap.get(dateItem.id);
        const hasChanged = !previousData || JSON.stringify(previousData) !== JSON.stringify(dateItem);

        if (hasChanged) {
            const existingEl = document.getElementById(`date-item-${dateItem.id}`);
            const newMarkup = buildDateListHTML(dateItem);

            if (existingEl) {
                // Preserve input field focus state before replacing
                const inputEl = existingEl.querySelector('.create-task-input');
                const hadFocus = document.activeElement === inputEl;

                existingEl.outerHTML = newMarkup;

                // Restore focus after DOM replacement (value is intentionally not restored
                // so that a successful task-add clears the field as expected)
                if (hadFocus) {
                    const restoredInput = document.getElementById(`todo-input-${dateItem.id}`);
                    if (restoredInput) restoredInput.focus();
                }
            } else {
                // New date list — insert in sorted position
                const insertIndex = taskArray.indexOf(dateItem);
                const children = container.children;

                if (insertIndex >= children.length) {
                    container.insertAdjacentHTML('beforeend', newMarkup);
                } else {
                    children[insertIndex].insertAdjacentHTML('beforebegin', newMarkup);
                }
            }

            previousDateListMap.set(dateItem.id, JSON.parse(JSON.stringify(dateItem)));
        }
    }
}

/**
 * Build the full HTML string for a single date list card.
 * @param {{id: string, name: string, taskList: Array}} dateItem
 * @returns {string}
 */
function buildDateListHTML(dateItem) {
    const completedCount = countCompletedTasks(dateItem.taskList);
    const totalCount = dateItem.taskList.length;
    const allDone = completedCount === totalCount && totalCount > 0;
    const checkIconClass = allDone ? 'solid fa-check text-primary' : 'solid fa-check';

    const tasksMarkup = dateItem.taskList.map((task) => buildTaskHTML(task)).join('');

    return `
        <div id="date-item-${dateItem.id}" class="mb-4 p-3 date-item">
            <div class="d-flex justify-content-between align-items-start">
                <div class="d-flex align-items-start">
                    <div class="d-grid">
                        <h4 class="mb-1">${dateItem.name}</h4>
                        <div class="d-flex align-items-center mb-2">
                            <p class="tasks-summary mb-0">${completedCount} tasks completed out of ${totalCount}</p>
                            <button type="button" class="btn btn-sm btn-no-bg-gray ms-1 mark-all-done-btn" value="${dateItem.id}">
                                <i class="fa-${checkIconClass}"></i>
                                <span class="btn-title">Mark All As Complete</span>
                            </button>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-no-bg-gray ms-2 todo-date-delete" value="${dateItem.id}">
                        <i class="fa-solid fa-trash"></i>
                        <span class="btn-title">Delete Date List</span>
                    </button>
                </div>
                <div class="d-flex">
                    <div class="todo-input-form">
                        <input type="text" class="form-control create-task-input" id="todo-input-${dateItem.id}" placeholder="Add Task"
                            enterkeyhint="send" size="75">
                    </div>
                </div>
            </div>
            <ul class="list-group">
                ${tasksMarkup}
            </ul>
            <ul class="list-group drag-group mt-2">
                <li class="list-group-item drag-group-item" ondrop="drop(event)" ondragover="allowDrop(event)" value="${dateItem.id}">
                    Drop task here
                </li>
            </ul>
        </div>`;
}

/**
 * Build the HTML for a single task list item.
 * @param {{id: string, name: string, statusCode: number, desc: string}} task
 * @returns {string}
 */
function buildTaskHTML(task) {
    const isTodo = task.statusCode === STATUS_TODO;
    const completedClass = isTodo ? '' : 'completed-task';
    const checkIcon = isTodo ? 'fa-circle' : 'fa-circle-check';
    const checkLabel = isTodo ? 'Mark As Complete' : 'Move to To-Do';
    const hasNotes = task.desc && task.desc.length > 1;

    return `
        <li class="list-group-item d-flex align-items-center justify-content-between ${completedClass}"
            draggable="true" ondragstart="drag(event)" value="${task.id}" statuscode="${task.statusCode}">
            <div class="task-name-container w-100">
                <button type="button" class="btn btn-sm btn-no-bg todo-task-check" value="${task.id}" statusCode="${task.statusCode}">
                    <i class="fa-solid ${checkIcon}"></i>
                    <span class="btn-title">${checkLabel}</span>
                </button>
                <button type="button" class="btn btn-lite-sm btn-no-bg-gray me-2 todo-task-detail ${hasNotes ? 'text-primary' : ''}" value="${task.id}">
                    <i class="fa-solid fa-up-right-from-square"></i>
                    <span class="btn-title">View</span>
                </button>
                <span class="task-name w-75">${task.name}</span>
            </div>
            <div class="d-flex">
                <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-edit" value="${task.id}">
                    <i class="fa-solid fa-pencil"></i>
                    <span class="btn-title">Edit</span>
                </button>
                <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-delete" value="${task.id}">
                    <i class="fa-solid fa-trash"></i>
                    <span class="btn-title">Delete</span>
                </button>
            </div>
        </li>`;
}

// ─── Differential Rendering — Date Nav ───────────────────────

/**
 * Render the left-hand date navigation panel.
 * Uses single-pass year→month→day grouping instead of O(n³) nested maps.
 * @param {Array} dateLists
 */
function renderDateNav(dateLists) {
    const sorted = sortByDate(dateLists).reverse();
    const todayStr = new Date().toLocaleDateString('fr-CA'); // "YYYY-MM-DD"

    // Single-pass: group by year → month
    const yearGroups = new Map();

    for (const dateItem of sorted) {
        const dateObj = new Date(dateItem.id);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth();
        const monthName = dateObj.toLocaleString('default', { month: 'long' });

        if (!yearGroups.has(year)) {
            yearGroups.set(year, new Map());
        }
        const monthGroups = yearGroups.get(year);

        if (!monthGroups.has(month)) {
            monthGroups.set(month, { name: monthName, days: [] });
        }
        monthGroups.get(month).days.push(dateItem);
    }

    // Build nav HTML from grouped data
    const navParts = [];
    for (const [year, monthGroups] of yearGroups) {
        const monthParts = [];
        for (const [, { name: monthName, days }] of monthGroups) {
            const dayParts = days.map((dateItem) => {
                const isToday = dateItem.id === todayStr;
                return buildNavDayItem(dateItem, isToday);
            });

            const firstDayId = days[0].id;
            monthParts.push(`<div>
                <a class="btn btn-lite-sm btn-no-bg ms-2" href="#date-item-${firstDayId}">${monthName}</a>
                ${dayParts.join('')}
            </div>`);
        }

        const firstMonthDays = [...monthGroups.values()][0].days;
        navParts.push(`<div>
            <a class="btn btn-lite-sm btn-no-bg ms-0" href="#date-item-${firstMonthDays[0].id}">${year}</a>
            ${monthParts.join('')}
        </div>`);
    }

    const container = document.getElementById('date-list-nav-container');
    container.innerHTML = navParts.join('');
}

/**
 * Build HTML for a single day entry in the nav sidebar.
 * @param {{id: string, name: string, taskList: Array}} dateItem
 * @param {boolean} isToday
 * @returns {string}
 */
function buildNavDayItem(dateItem, isToday) {
    const completed = countCompletedTasks(dateItem.taskList);
    const total = dateItem.taskList.length;
    const incomplete = completed !== total;

    return `
        <div class="d-flex align-items-center border-start ms-2 py-1">
            <a class="btn btn-lite-sm btn-no-bg text-start ms-2 ${isToday ? 'btn-no-bg-gray-active' : ''}"
               href="#date-item-${dateItem.id}">
                ${dateItem.name}
                <span class="text-body-tertiary">
                    (${completed}/${total})${incomplete ? '<span class="text-danger ms-1">⬤</span>' : ''}
                </span>
            </a>
        </div>`;
}

// ─── Task Detail View ────────────────────────────────────────

/**
 * Build the offcanvas detail view HTML for a task.
 * @param {{id: string, name: string, desc: string, dateName: string}} task
 * @returns {string}
 */
function renderTaskDetailHTML(task) {
    return `
        <div id="task-detail-title-container" class="offcanvas-header border-bottom justify-content-between">
            <div class="d-flex flex-column task-detail-title w-100">
                <h5 class="offcanvas-title">${task.name}</h5>
                <p class="tasks-summary mb-0">${task.dateName}</p>
            </div>
            <div class="d-flex">
                <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-edit" value="${task.id}">
                    <i class="fa-solid fa-pencil"></i>
                    <span class="btn-title">Edit</span>
                </button>
                <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-delete" value="${task.id}">
                    <i class="fa-solid fa-trash"></i>
                    <span class="btn-title">Delete</span>
                </button>
                <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2" data-bs-dismiss="offcanvas" aria-label="Close">
                    <i class="fa-solid fa-xmark"></i>
                    <span class="btn-title">Close</span>
                </button>
            </div>
        </div>
        <div id="task-detail-body" class="offcanvas-body">
            ${createRTFToolbar()}
            <div id="task-notes-area-parent">
                <section id="task-notes-area" contenteditable="true" value="${task.id}">
                    ${task.desc}
                </section>
            </div>
        </div>`;
}

// ─── CRUD Operations ─────────────────────────────────────────

/**
 * Delete a date list from Firestore.
 * @param {string} dateId
 */
async function deleteDateList(dateId) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    try {
        await TodoService.deleteDateList(user.uid, dateId);
        setMessageState('success', 'Date list deleted successfully!');
    } catch (error) {
        console.error("deleteDateList — failed:", error);
        setMessageState('failure', 'Error deleting date list');
    }
}

/**
 * Create a new task under a date list.
 * @param {string} taskName
 * @param {string} dateId
 * @param {HTMLElement|null} inputElement - the input to re-focus after creation
 * @param {string} desc
 * @param {number} [statusCode=1001]
 */
async function createTask(taskName, dateId, inputElement, desc, statusCode) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    if (taskName === '') {
        setMessageState('failure', 'Task name cannot be empty.');
        return;
    }

    const newTask = {
        id: `Task-${dateId}-${Date.now()}`,
        name: replaceURLs(taskName),
        statusCode: statusCode || STATUS_TODO,
        desc: desc || '',
    };

    try {
        await TodoService.addTask(user.uid, dateId, newTask);
        setMessageState('success', 'Task created successfully!');
        // Clear and re-focus the input field so the user can keep adding tasks
        if (inputElement) {
            $(inputElement).val('').focus();
        }
    } catch (error) {
        console.error("createTask — failed:", error);
        setMessageState('failure', 'Error creating task');
    }
}

/**
 * Delete a single task from a date list.
 * @param {string} dateId
 * @param {string} taskId - suffix portion of the full task ID
 * @returns {Promise<boolean>} true if deleted successfully
 */
async function deleteTasks(dateId, taskId) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    try {
        await TodoService.deleteTask(user.uid, dateId, taskId);
        setMessageState('success', 'Task deleted successfully!');
        return true;
    } catch (error) {
        console.error("deleteTasks — failed:", error);
        setMessageState('failure', 'Error deleting task');
        return false;
    }
}

/**
 * Update a single task's name, status, or description.
 * @param {string} dateId
 * @param {string} taskId - suffix portion of the full task ID
 * @param {string} taskName - new name (or '' to skip)
 * @param {number|string} taskStatusCode - new status (or '' to skip)
 * @param {boolean|string} taskDetails - true to save notes area HTML
 */
async function updateTasks(dateId, taskId, taskName, taskStatusCode, taskDetails) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    const updates = {};
    if (taskName !== '') updates.name = replaceURLs(taskName);
    if (taskStatusCode !== '') updates.statusCode = taskStatusCode;
    if (taskDetails === true) updates.desc = replaceURLs($('#task-notes-area').html());

    try {
        await TodoService.updateTask(user.uid, dateId, taskId, updates);
        setMessageState('success', 'Task updated successfully!');
        const taskObj = findTask(dateId, taskId);
        // Refresh the detail view with updated data
        $('#task-detail-container').empty();
        $('#task-detail-container').append(renderTaskDetailHTML(taskObj));
    } catch (error) {
        console.error("updateTasks — failed:", error);
        setMessageState('failure', 'Error updating task');
    }
}

/**
 * Find a task object within taskArray by dateId and taskId suffix.
 * @param {string} dateId
 * @param {string} taskId
 * @returns {{id: string, name: string, statusCode: number, desc: string, dateName: string}}
 */
function findTask(dateId, taskId) {
    let foundTask = null;
    let dateName = '';

    for (const dateItem of taskArray) {
        if (dateItem.id === dateId) {
            dateName = dateItem.name;
            for (const task of dateItem.taskList) {
                if (task.id.slice(16) === taskId) {
                    foundTask = task;
                    break;
                }
            }
            break;
        }
    }

    if (foundTask) {
        foundTask.dateName = dateName;
    }
    return foundTask;
}

// ─── Date List Creation ──────────────────────────────────────

/**
 * Create a new empty date list in Firestore.
 * @param {string} dateId - "YYYY-MM-DD"
 * @param {string} dateName - human-readable date name
 */
async function createDateList(dateId, dateName) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    try {
        const existing = await TodoService.getDateList(user.uid, dateId);
        if (existing) {
            setMessageState('success', 'Date list already exists.');
            return;
        }

        const newDateList = {
            id: dateId,
            name: dateName,
            taskList: [],
            statusCode: STATUS_TODO,
        };

        await TodoService.saveDateList(user.uid, newDateList);
        setMessageState('success', 'Date list successfully created!');
    } catch (error) {
        console.error("createDateList — failed:", error);
        setMessageState('failure', 'Error creating date list');
    }
}

// ─── Multi-Select & Bulk Operations ─────────────────────────

/**
 * Gather all Ctrl+click-selected task items.
 * @returns {Array<{dateId: string, taskId: string, statusCode: string}>}
 */
function getSelectedList() {
    const selected = [];
    $('.list-group-item-selected').each(function () {
        const value = $(this).attr('value');
        selected.push({
            dateId: value.slice(5, 15),
            taskId: value.slice(16),
            statusCode: $(this).attr('statuscode'),
        });
    });
    return selected;
}

/**
 * Batch-delete all selected tasks, grouped by date list for efficiency.
 */
async function deleteSelectedList() {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    $('#context-menu').hide();

    const selected = getSelectedList();
    if (!selected.length) return;

    // Group by dateId for batch operations
    const grouped = new Map();
    for (const { dateId, taskId } of selected) {
        if (!grouped.has(dateId)) grouped.set(dateId, []);
        grouped.get(dateId).push(taskId);
    }

    try {
        for (const [dateId, taskIds] of grouped) {
            await TodoService.batchDeleteTasks(user.uid, dateId, taskIds);
        }
        setMessageState('success', `Deleted ${selected.length} task(s) successfully!`);
    } catch (error) {
        console.error("deleteSelectedList — failed:", error);
        setMessageState('failure', 'Error deleting selected tasks');
    }

    $('.list-group-item-selected').removeClass('list-group-item-selected');
}

/**
 * Batch-toggle done/undone for all selected tasks, grouped by date list.
 */
async function doneSelectedList() {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    $('#context-menu').hide();

    const selected = getSelectedList();
    if (!selected.length) return;

    // Group by dateId for batch operations
    const grouped = new Map();
    for (const { dateId, taskId, statusCode } of selected) {
        if (!grouped.has(dateId)) grouped.set(dateId, []);
        const newStatus = Number(statusCode) === STATUS_TODO ? STATUS_COMPLETED : STATUS_TODO;
        grouped.get(dateId).push({ taskId, updates: { statusCode: newStatus } });
    }

    try {
        for (const [dateId, taskUpdates] of grouped) {
            await TodoService.batchUpdateTasks(user.uid, dateId, taskUpdates);
        }
        setMessageState('success', `Updated ${selected.length} task(s) successfully!`);
    } catch (error) {
        console.error("doneSelectedList — failed:", error);
        setMessageState('failure', 'Error updating selected tasks');
    }

    $('.list-group-item-selected').removeClass('list-group-item-selected');
}

/**
 * Mark all incomplete tasks in a date list as completed (single Firestore write).
 * @param {string} dateId
 */
async function markAllAsDone(dateId) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    const dateList = taskArray.find((dl) => dl.id === dateId);
    if (!dateList) return;

    // Collect tasks that are not yet completed
    const taskUpdates = dateList.taskList
        .filter((task) => task.statusCode !== STATUS_COMPLETED)
        .map((task) => ({ taskId: task.id.slice(16), updates: { statusCode: STATUS_COMPLETED } }));

    if (!taskUpdates.length) return;

    try {
        await TodoService.batchUpdateTasks(user.uid, dateId, taskUpdates);
        setMessageState('success', `Marked ${taskUpdates.length} task(s) as completed!`);
    } catch (error) {
        console.error("markAllAsDone — failed:", error);
        setMessageState('failure', 'Error marking tasks as completed');
    }
}

// ─── Window Exports (for legacy non-module scripts) ──────────

window.createTask = createTask;
window.deleteTasks = deleteTasks;
window.updateTasks = updateTasks;
window.deleteDateList = deleteDateList;
window.findTask = findTask;
window.setMessageState = setMessageState;
window.renderTaskDetailHTML = renderTaskDetailHTML;
window.getSelectedList = getSelectedList;
window.deleteSelectedList = deleteSelectedList;
window.doneSelectedList = doneSelectedList;
window.markAllAsDone = markAllAsDone;
window.createDateList = createDateList;
