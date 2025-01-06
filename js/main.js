// import * as navabr from '../js/navbar.js';

let taskArray = [];

$('#todo-date-input').val(new Date().toISOString().slice(0, 10));

$('#todo-date-submit').on('click', function () {
    let inputDate = $('#todo-date-input').val();
    let inputDateName = new Date(inputDate).toLocaleDateString('en-us', { weekday:"long", year:"numeric", month:"short", day:"numeric"});
    let tempItem = {
        id: inputDate,
        name: inputDateName,
        taskList: [],
    }
    if (taskArray.some(e => e.id == inputDate) === false) {
        taskArray.push(tempItem);
        renderDateList(taskArray);
        setMessageState('success', 'Date list successfully created!');
    }
    else {
        setMessageState('failure', 'Date list already exists!');

    }
})


function setMessageState(type, message) {
    $(`#${type}-message`).text(message);
    $(`#${type}-message`).show();
    setTimeout(() => {
        $(`#${type}-message`).hide();
    }, 4000);
}


//create the date and task list
function renderDateList(data){
    taskArray = data;
    $('#date-list-container').empty();
    let tempHtml = data.map(function (el){
        return `
         <div id="date-item-${el.id}" class="mb-4">
                <div class="d-flex align-items-center mb-3">
                    <h4 class="mb-0">${el.name}</h4>
                    <button type="button" class="btn btn-sm btn-outline-danger ms-2 todo-date-delete" style="border: none;" value="${el.id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="mb-3 d-flex align-items-end">
                    <div class="todo-input-form">
                        <label for="todo-input-${el.id}">Create task</label>
                        <input type="text" class="form-control create-task-input" id="todo-input-${el.id}" placeholder="Add Task">
                    </div>
                    <button type="button" class="btn btn-sm btn-primary ms-3 todo-task-submit" style="border: none;">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
                <ul class="list-group">
                ${el.taskList.map(renderTaskList).join("")}
                </ul>
            </div>
        `
    });
    $(`#date-list-container`).append(tempHtml);
}

//create the task list
function renderTaskList(el){
    return `
    <li class="list-group-item d-flex align-items-center justify-content-between">${el.name} 
        <div>
            <button type="button" class="btn btn-sm btn-outline-primary todo-task-edit" style="border: none;" value="${el.id}">
                <i class="fa-solid fa-pencil"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger ms-1 todo-task-delete" style="border: none;" value="${el.id}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    </li>
    `
}

//delete date list
$('#date-list-container').on('click', '.todo-date-delete', function(){
    let dateID = $(this).val();
    let newData = taskArray.filter(el => el.id != dateID);
    renderDateList(newData);
    setMessageState('success', 'Date list deleted successfully!');
});

//create task
$('#date-list-container').on('click', '.todo-task-submit', function(){
    let taskName = $(this).prev().children('.create-task-input').val().trim();
    let dateID = $(this).prev().children('.create-task-input').attr('id').slice(11);
    let createBoolean = false;
    
    let newData = taskArray.map(function(el){
        if(el.id === dateID && taskName !=''){
            let tempObj = {
                id:'Task-'+ dateID + "-" + el.taskList.length,
                name: taskName
            }
            
            el.taskList.push(tempObj);
            createBoolean = true;
        }
        return el;
    });
    if(createBoolean == true){
        renderDateList(newData);
        setMessageState('success', 'Task created successfully created!');
    }
    else if(!createBoolean && taskName == ''){
        setMessageState('failure', 'Task name cannot be empty.');
    }
});

//delete task list
$('#date-list-container').on('click', '.todo-task-delete', function(){
    let dateID = $(this).val().slice(5,15);
    let taskID = $(this).val().slice(5);
    
    let newData = taskArray.map(function(el){
        if(el.id === dateID){
            el.taskList = el.taskList.filter(el=>el.id.slice(5) != taskID);
        }
        return el;
    });
    
    renderDateList(newData);
    setMessageState('success', 'Task deleted successfully!');
});
