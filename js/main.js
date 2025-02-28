// import * as navabr from '../js/navbar.js';

// Status Pipe
// 1001 - To-do
// 1002 - Ongoing
// 1003 - Blocked
// 1004 - Completed
// 1005 - Archived


//--------------DB Operations-------------------------

//Initialize IndexedDB

function initDB() {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = function (event) {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
        }
    };

    request.onsuccess = function () {
        console.log("IndexedDB initialized");
        loadTasksFromDB();
    };

    request.onerror = function () {
        console.error("Error initializing IndexedDB", request.error);
    };

}

//Save tasks to IndexedDB
function saveTasksToDB(data) {
    const request = indexedDB.open(dbName, 1);

    request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        //clear previous data
        store.clear();

        //add new data
        data.forEach((task) => {
            store.add(task);
        });

        transaction.oncomplete = function () {
            console.log("Tasks saved to IndexedDB");
        };

        transaction.onerror = function () {
            console.error("Error saving to IndexedDB", transaction.error);
        };
    }
}

//Load tasks from IndexedDB
function loadTasksFromDB() {
    const request = indexedDB.open(dbName, 1);

    request.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);

        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = function () {

            taskArray = [...getAllRequest.result];
            renderDateList(taskArray);
            renderDateNav(taskArray);
        };

        getAllRequest.onerror = function () {
            console.error("Error loading from IndexedDB", getAllRequest.error);
        };
    }
}

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
function createUpdateDateList(data, messageType, messageText) {
    renderDateList(data);
    renderDateNav(data);
    saveTasksToDB(data);
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
                        if (tempMonth === tempDate.getMonth()) {
                            return dayItem(date)
                        }
                    });
                    prevMonth = tempMonth;
                    return monthYearNavItem(month.id, tempMonthName,dayHTML,2);
                }

            });
            prevYear = tempYear;
            return monthYearNavItem(year.id, tempYear,monthHTML,0);
        }
    });

    $(`#date-list-nav-container`).append(yearHTML);
}

function dayItem(el){
    return `
            <div class="d-flex align-items-center border-start ms-2 py-1">
                <a class="btn btn-lite-sm btn-no-bg text-start ms-2" href="#date-item-${el.id}">${el.name} <span class="text-body-tertiary"> (${renderTaskListCount(el.taskList)}/${el.taskList.length}) ${renderTaskListCount(el.taskList) != el.taskList.length ? `<span class="text-danger ms-1">⬤</span>` : ''}</span></a>
            </div>`
}

function monthYearNavItem(id,name,html,offset){
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
            <div class="d-flex flex-column task-detail-title">
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
function deleteDateList(dateID) {
    let newData = taskArray.filter(el => el.id != dateID);
    createUpdateDateList(newData, 'success', 'Date list deleted successfully!');
}

//Function to create tasks
function createTask(taskName, dateID, el, desc, statusCode) {

    let createBoolean = false;

    let newData = taskArray.map(function (el) {
        if (el.id === dateID && taskName != '') {
            let tempObj = {
                id: 'Task-' + dateID + "-" + Math.floor(Math.random() * 1000000000),
                name: taskName,
                statusCode: statusCode ? statusCode : 1001,
                desc: desc ? desc : ''
            }

            el.taskList.push(tempObj);
            createBoolean = true;
        }
        return el;
    });
    if (createBoolean == true) {
        createUpdateDateList(newData, 'success', 'Task created successfully created!');
        //refocus the create task input
        let tempID = $(el).attr('id');
        $(`#${tempID}`).focus();
    }
    else if (!createBoolean && taskName == '') {
        setMessageState('failure', 'Task name cannot be empty.');
    }
}

//function to delete tasks
function deleteTasks(dateID, taskID) {

    let newData = taskArray.map(function (el) {
        if (el.id === dateID) {
            el.taskList = el.taskList.filter(el => el.id.slice(16) != taskID);
        }
        return el;
    });
    createUpdateDateList(newData, 'success', 'Task Deleted Successfully!');
}

//function to update tasks
function updateTasks(dateID, taskID, taskName, taskStatusCode, taskDetails) {

    let newData = taskArray.map(function (el) {

        if (el.id === dateID) {
            el.taskList = el.taskList.map(function (el) {

                if (el.id.slice(16) == taskID) {
                    taskName != '' ? el.name = taskName : '';
                    taskStatusCode != '' ? el.statusCode = taskStatusCode : '';
                    if (taskDetails == true) {
                        el.desc = $('#task-notes-area').html();
                    }
                }
                return el;
            });
        }
        return el;
    });

    createUpdateDateList(newData, 'success', 'Task Updated Successfully!');
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
initDB();

