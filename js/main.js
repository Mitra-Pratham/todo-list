// import * as navabr from '../js/navbar.js';

// Status Pipe
// 1001 - To-do
// 1002 - Ongoing
// 1003 - Blocked
// 1004 - Completed
// 1005 - Archived

let taskArray = [];
const dbName = "TasksDB";
const storeName = "tasksData";


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

//--------------------event listeners-------------------------------------

//Creating and setting date lists
$('#todo-date-input').val(new Date().toISOString().slice(0, 10));

//+ button to create the date list
$('#todo-date-submit').on('click', function () {
    let inputDate = $('#todo-date-input').val();
    let inputDateName = new Date(inputDate).toLocaleDateString('en-us', { weekday: "long", year: "numeric", month: "short", day: "numeric" });
    let tempItem = {
        id: inputDate,
        name: inputDateName,
        taskList: [],
        statusCode: 1001
    }
    if (taskArray.some(e => e.id == inputDate) === false) {
        taskArray.push(tempItem);

        createUpdateDateList(taskArray, 'success', 'Date list successfully created!');
    }
    else {
        setMessageState('failure', 'Date list already exists!');

    }
});

//event listener to delete date list
$('#date-list-container').on('click', '.todo-date-delete', function () {
    let dateID = $(this).val();
    deleteDateList(dateID);
});

//+ button event listener to create the task item
// $('#date-list-container').on('click', '.todo-task-submit', function () {
//     let taskName = $(this).prev().children('.create-task-input').val().trim();
//     let dateID = $(this).prev().children('.create-task-input').attr('id').slice(11);
//     createTask(taskName, dateID,'','');
// });

//keydown 'enter' event listener to create the task item
$('#date-list-container').on('keydown', '.create-task-input', function (e) {
    let taskName = $(this).val().trim();
    let dateID = $(this).attr('id').slice(11);
    switch (e.keyCode) {
        case 13:
            {
                createTask(taskName, dateID, this, '');

            }
        default:
            break;
    }
});

//event listener to delete tasks from the delete button
$('#date-list-container').on('click', '.todo-task-delete', function () {
    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    deleteTasks(dateID, taskID);
});

//event listener to create the input field for editing the tasks
$('#date-list-container').on('click', '.todo-task-edit', function () {
    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    let value = $(this).parent().siblings('.task-name-container').find('.task-name').text().trim();
    let updateTaskName = `<input id="update-task-name" class="w-75" type="text" prevValue="${value}" dateID="${dateID}" taskID="${taskID}" value="${value}"></input>`
    $(this).parent().siblings('.task-name-container').find('.task-name').empty();
    $(this).parent().siblings('.task-name-container').find('.task-name').append(updateTaskName);
    $('#update-task-name').focus();
});

//event listener to take the input from the input field tasks from the edit button
$('#date-list-container').on('keydown', '#update-task-name', function (e) {
    if (e.keyCode == 13) {
        let tempTaskName = $(this).val().trim();
        let dateID = $(this).attr('dateid');
        let taskID = $(this).attr('taskid');
        updateTasks(dateID, taskID, tempTaskName, '', '');
        $(this).remove();
    }
    else if (e.keyCode == 27) {
        let prevValue = $(this).attr('prevvalue');
        $(this).parent().text(prevValue);
        $(this).remove();
    }
});


//event listener to create the input field for editing the tasks
$('#date-list-container').on('click', '.todo-task-check', function () {

    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    let statusCode = $(this).attr('statuscode');
    let newStatusCode = statusCode == 1001 ? 1004 : 1001;
    updateTasks(dateID, taskID, '', newStatusCode, '');

});

// //event listener to change the status field for tasks
// $('#date-list-container').on('change', '.task-status', function () {
//     let dateID = $(this).val().slice(5, 15);
//     let taskID = $(this).val().slice(16);
//     let placeholder = $(this).parent().siblings('.task-name').text();
//     updateTasks(dateID, taskID, tempTaskStatus);
// });



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

function bubbleSort(arr) {
    let n = arr.length;

    // Traverse through all array elements
    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - 1 - i; j++) {
            // Swap if element is greater than next index
            let prevDate = new Date(arr[j].id).getTime();
            let newDate = new Date(arr[j + 1].id).getTime();
            if (prevDate > newDate) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
            }
        }
    }

    return arr;
}

//function to render the date list HTML
function renderDateList(data) {

    taskArray = bubbleSort(data).reverse();


    $('#date-list-container').empty();
    let tempHtml = data.map(function (el) {
        return `
         <div id="date-item-${el.id}" class="mb-4 p-3 date-item">
                <div class="d-flex justify-content-between align-items-start mb-3">
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
    let tempHtml = data.map(function (el) {
        return `
         <div class="p-1">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <a class="btn btn-lite-sm btn-no-bg" href="#date-item-${el.id}">${el.name} <span class="text-body-tertiary"> (${renderTaskListCount(el.taskList)}/${el.taskList.length})</span></a>
                    </div>
                </div>
            </div>
        `
    });
    $(`#date-list-nav-container`).append(tempHtml);
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
{/* <button type="button" class="btn btn-sm btn-lite-bg ms-3 todo-task-submit" style="border: none;">
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
    <span class="task-name w-75">${el.name}</span>
    </div>
        <div class="d-flex">
        
            <button type="button" class="btn btn-lite-sm btn-lite-bg ms-2 todo-task-edit" value="${el.id}">
                <i class="fa-solid fa-pencil"></i>
                <span class="btn-title">Edit Task</span>
            </button>
            <button type="button" class="btn btn-lite-sm btn-lite-bg ms-2 todo-task-delete" value="${el.id}">
                <i class="fa-solid fa-trash"></i>
                <span class="btn-title">Delete Task</span>
            </button>
        </div>
    </li>
    `
}

//status dropdown
{/* <select class="form-select task-status" aria-label="Change Task Status" value="${el.id}">
            <option selected>${checkStatus(el.statusCode)}</option>
            ${renderStatus(el.statusCode)}
         </select> */}

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
                statusCode: statusCode ? statusCode: 1001,
                desc: desc ? desc: ''
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
                    taskDetails != '' ? el.taskDetails = taskDetails : '';
                }
                return el;
            });
        }
        return el;
    });

    createUpdateDateList(newData, 'success', 'Task Updated Successfully!');
}
    
    


//initialize the storage
initDB();
