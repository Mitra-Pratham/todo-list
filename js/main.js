import { initAuth } from "./auth.js";
import { TodoService } from "./todo-service.js";
import { hasLocalData, getLocalTasks, migrateData } from "./migration.js";

let unsubscribe;

function initApp() {
    initAuth(async (user) => {
        console.log("User logged in:", user);

        // Check for local data and migrate if needed
        if (await hasLocalData()) {
            const migrated = await migrateData(user.uid);
            if (migrated) {
                const successDiv = $('#success-message');
                successDiv.html(`<strong>Success!</strong> Migration complete! Your data is now in the cloud.`);
                successDiv.show();
                setTimeout(() => successDiv.fadeOut(), 5000);
            }
        }

        unsubscribe = TodoService.subscribe(user.uid, (data) => {
            renderDateList(data);
            renderDateNav(data);
        });

        // Hide warning if user logs in
        $('#failure-message').hide();

    }, async () => {
        console.log("User logged out");
        if (unsubscribe) unsubscribe();

        // Check for local data
        if (await hasLocalData()) {
            console.log("Found local data, displaying...");
            const localTasks = await getLocalTasks();

            // Set global taskArray for other functions to use
            taskArray = bubbleSort(localTasks).reverse();

            // renderDateList expects the array, and internally sets taskArray but let's be safe
            // Actually renderDateList sets taskArray: taskArray = bubbleSort(data).reverse();
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

// Helper to show migration warning
function showMigrationWarning() {
    // Use the failure-message alert div, repurposed as a warning for migration
    const alertDiv = $('#failure-message');
    if (alertDiv.length) {
        alertDiv.removeClass('alert-danger').addClass('alert-warning');
        alertDiv.html(`<strong>Attention!</strong> You have local data. Please <a href="#" id="migration-login-link" class="alert-link">login</a> to migrate data.`);
        alertDiv.show();

        $('#migration-login-link').off('click').on('click', (e) => {
            e.preventDefault();
            document.getElementById('login-btn').click();
        });
    }
}

// Start the app
initApp();

///----------------functions---------------------------


//set status message function
function setMessageState(type, message) {
    $(`#${type}-message`).text(message);
    $(`#${type}-message`).show();
    setTimeout(() => {
        $(`#${type}-message`).hide();
    }, 4000);
}

//create and update date and task lists
//create and update date and task lists
// NOTE: This function is now only used for creating NEW date lists, not for general updates
// The reactive listener handles the UI updates.
async function createUpdateDateList(data, messageType, messageText) {
    // In the new reactive model, we don't manually render or save everything here.
    // We just trigger the service action.
    // However, for "Create Date List" button which passes the whole new array with the new date list:

    // Find the new item (it's the one not in Firestore yet, but here we are passed the whole array)
    // Actually, let's refactor the caller of this function to call TodoService directly.
    // But to keep it compatible for now, let's see where it's called.
    // It's called by deleteDateList, createTask, deleteTasks, updateTasks.

    // We should refactor those functions instead.
    // But if we must keep this signature for now:

    // For now, let's just show the message. The data update should happen via Service.
    setMessageState(messageType, messageText);
}

//function to render the date list HTML
function renderDateList(data) {

    taskArray = bubbleSort(data).reverse();


    $('#date-list-container').empty();
    let tempHtml = data.map(function (el) {
        return `
         <div id="date-item-${el.id}" class="mb-4 p-3 date-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-start">
                        <div class="d-grid">
                            <h4 class="mb-1">${el.name}</h4>
                            <p class="tasks-summary">${renderTaskListCount(el.taskList)} tasks completed out of ${el.taskList.length}</p>
                        </div>
                        <button type="button" class="btn btn-sm btn-no-bg-gray ms-2 todo-date-delete" value="${el.id}">
                            <i class="fa-solid fa-trash"></i>
                            <span class="btn-title">Delete Date List</span>
                        </button>
                    </div>
                    <div class="d-flex">
                        <div class="todo-input-form">
                            <input type="text" class="form-control create-task-input" id="todo-input-${el.id}" placeholder="Add Task" size="75">
                        </div>
                    </div>
                </div>
                
                <ul class="list-group">
                ${el.taskList.map((el) => renderTaskList(el)).join("")}
                </ul>
                <ul class="list-group drag-group mt-2">
                    <li class="list-group-item drag-group-item" ondrop="drop(event)" ondragover="allowDrop(event)" value="${el.id}">
                        Drop task here
                    </li>
                </ul>
            </div>
        `
    });
    $(`#date-list-container`).append(tempHtml);
}

//render the date list navigation
function renderDateNav(data) {
    $('#date-list-nav-container').empty();
    let prevYear;
    let yearHTML = data.map(function (year) {
        let tempDate = new Date(year.id);
        let tempYear = tempDate.getFullYear();
        if (prevYear != tempYear) {
            let prevMonth;
            let monthHTML = data.map(function (month) {
                let tempDate = new Date(month.id);
                let tempMonthName = tempDate.toLocaleString('default', { month: 'long' });
                let tempMonth = tempDate.getMonth();
                if (prevMonth != tempMonth) {
                    let dayHTML = data.map(function (date) {
                        let tempDate = new Date(date.id);
                        let today = new Date().toLocaleDateString('fr-CA'); //converts time to YYYY-MM-DD
                        let active = today === date.id ? true : false;
                        if (tempMonth === tempDate.getMonth()) {

                            return dayItem(date, active)
                        }
                    });
                    prevMonth = tempMonth;
                    return monthYearNavItem(month.id, tempMonthName, dayHTML, 2);
                }

            });
            prevYear = tempYear;
            return monthYearNavItem(year.id, tempYear, monthHTML, 0);
        }
    });

    $(`#date-list-nav-container`).append(yearHTML);
}

function dayItem(el, active) {
    return `
            <div class="d-flex align-items-center border-start ms-2 py-1">
                <a class="btn btn-lite-sm btn-no-bg text-start ms-2 ${active ? `btn-no-bg-gray-active` : ''}" href="#date-item-${el.id}">${el.name} <span class="text-body-tertiary"> (${renderTaskListCount(el.taskList)}/${el.taskList.length}) ${renderTaskListCount(el.taskList) != el.taskList.length ? `<span class="text-danger ms-1">⬤</span>` : ''}</span></a>
            </div>`
}

function monthYearNavItem(id, name, html, offset) {
    return `<div>
    <a class="btn btn-lite-sm btn-no-bg ms-${offset}" href="#date-item-${id}"">${name}</a>
    ${html.join('')}
    </div>`
}

//function to count completed vs incomplete tasks
function renderTaskListCount(taskList) {
    let count = 0;
    taskList.forEach(el => {
        if (el.statusCode == 1004) {
            count++;
        }
    });
    return count;
}

//label & add task button
// <label for="todo-input-${el.id}">Create task</label>
{/* <button type="button" class="btn btn-sm btn-no-bg-gray ms-3 todo-task-submit" style="border: none;">
                            <i class="fa-solid fa-plus"></i>
                        </button> */}

//function to render the task list HTML
function renderTaskList(el) {
    return `
    <li class="list-group-item d-flex align-items-center justify-content-between ${el.statusCode == 1001 ? '' : 'completed-task'}" draggable="true" ondragstart="drag(event)" value="${el.id}">
    <div class="task-name-container w-100">
        <button type="button" class="btn btn-sm btn-no-bg todo-task-check" value="${el.id}" statusCode="${el.statusCode}">
            <i class="fa-solid ${el.statusCode == 1001 ? 'fa-circle' : 'fa-circle-check'}"></i>
            <span class="btn-title">${el.statusCode == 1001 ? 'Mark As Complete' : 'Move to To-Do'}</span>
        </button>
        <button type="button" class="btn btn-lite-sm btn-no-bg-gray me-2 todo-task-detail ${el.desc.length > 1 ? 'text-primary' : ''}" value="${el.id}">
                <i class="fa-solid fa-up-right-from-square"></i>
                <span class="btn-title">View</span>
        </button>
    <span class="task-name w-75">${el.name}</span>
    </div>
        <div class="d-flex">
            <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-edit" value="${el.id}">
                <i class="fa-solid fa-pencil"></i>
                <span class="btn-title">Edit</span>
            </button>
            <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-delete" value="${el.id}">
                <i class="fa-solid fa-trash"></i>
                <span class="btn-title">Delete</span>
            </button>
        </div>
    </li>
    `
}

// --------- Task Notes Detail View -------------

function renderTaskDetailHTML(el) {
    return `
    <div id="task-detail-title-container" class="offcanvas-header border-bottom justify-content-between">
            <div class="d-flex flex-column task-detail-title w-100">
                <h5 class="offcanvas-title">${el.name}</h5>
                <p class="tasks-summary mb-0">${el.dateName}</p>
            </div>
            <div class="d-flex">
                <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-edit" value="${el.id}">
                <i class="fa-solid fa-pencil"></i>
                <span class="btn-title">Edit</span>
            </button>
            <button type="button" class="btn btn-lite-sm btn-no-bg-gray ms-2 todo-task-delete" value="${el.id}">
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
            <section id="task-notes-area" contenteditable="true" value="${el.id}">
                ${el.desc}
            </section>
        </div>
    </div>
    `
}

//status dropdown
/* <select class="form-select task-status" aria-label="Change Task Status" value="${el.id}">
            <option selected>${checkStatus(el.statusCode)}</option>
            ${renderStatus(el.statusCode)}
         </select> */

function renderStatus(el) {
    let tempHTML = '';
    for (let i = 1001; i < 1006; i++) {
        if (i != el) {
            tempHTML += `<option value="1">${checkStatus(i)}</option>`
        }
    }
    return tempHTML;
}

function checkStatus(el) {
    // 1001 - To-do
    // 1002 - Ongoing
    // 1003 - Blocked
    // 1004 - Completed
    // 1005 - Archived
    switch (el) {
        case 1001:
            return 'To-Do'
            break;
        case 1002:
            return 'Ongoing'
            break;
        case 1003:
            return 'Blocked'
            break;
        case 1004:
            return 'Completed'
            break;
        case 1005:
            return 'Archived'
            break;

        default:
            break;
    }
}

//function to delete date list
//function to delete date list
async function deleteDateList(dateID) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    try {
        await TodoService.deleteDateList(user.uid, dateID);
        setMessageState('success', 'Date list deleted successfully!');
    } catch (e) {
        setMessageState('failure', 'Error deleting date list');
    }
}

//Function to create tasks
//Function to create tasks
async function createTask(taskName, dateID, el, desc, statusCode) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    if (taskName === '') {
        setMessageState('failure', 'Task name cannot be empty.');
        return;
    }

    const newTask = {
        id: 'Task-' + dateID + "-" + Math.floor(Math.random() * 1000000000),
        name: taskName,
        statusCode: statusCode ? statusCode : 1001,
        desc: desc ? desc : ''
    };

    try {
        await TodoService.addTask(user.uid, dateID, newTask);
        setMessageState('success', 'Task created successfully!');
        //refocus the create task input
        let tempID = $(el).attr('id');
        $(`#${tempID}`).focus();
    } catch (e) {
        setMessageState('failure', 'Error creating task');
    }
}

//function to delete tasks
//function to delete tasks
async function deleteTasks(dateID, taskID) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    try {
        await TodoService.deleteTask(user.uid, dateID, taskID);
        setMessageState('success', 'Task Deleted Successfully!');
    } catch (e) {
        setMessageState('failure', 'Error deleting task');
    }
}

//function to update tasks
//function to update tasks
async function updateTasks(dateID, taskID, taskName, taskStatusCode, taskDetails) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    const updates = {};
    if (taskName !== '') updates.name = taskName;
    if (taskStatusCode !== '') updates.statusCode = taskStatusCode;
    if (taskDetails === true) updates.desc = $('#task-notes-area').html();

    try {
        await TodoService.updateTask(user.uid, dateID, taskID, updates);
        setMessageState('success', 'Task Updated Successfully!');
    } catch (e) {
        setMessageState('failure', 'Error updating task');
    }
}

function findTask(dateID, taskID) {
    let tempTask = '';
    let tempDateName = '';
    taskArray.find(el => {
        if (el.id === dateID) {
            tempDateName = el.name;
            el.taskList.find(el => {
                if (el.id.slice(16) === taskID) {
                    tempTask = el;
                }
            });
        }
    });
    tempTask.dateName = tempDateName;
    return tempTask;
}



//initialize the storage
// Expose functions to window for legacy scripts and HTML attributes
window.createTask = createTask;
window.deleteTasks = deleteTasks;
window.updateTasks = updateTasks;
window.deleteDateList = deleteDateList;
window.findTask = findTask;
window.setMessageState = setMessageState;
window.renderTaskDetailHTML = renderTaskDetailHTML; // Used in listeners.js

// New helper for creating date list from listeners.js
window.createDateList = async function (dateId, dateName) {
    const user = getCurrentUser();
    if (!user) return alert("Please login first");

    const newDateList = {
        id: dateId,
        name: dateName,
        taskList: [],
        statusCode: 1001
    };

    try {
        await TodoService.saveDateList(user.uid, newDateList);
        setMessageState('success', 'Date list successfully created!');
    } catch (e) {
        setMessageState('failure', 'Error creating date list');
    }
};

//initialize the storage
// initDB(); // Removed in favor of initApp()

