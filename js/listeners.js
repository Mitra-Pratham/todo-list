//--------------------event listeners-------------------------------------

//Creating and setting date lists
$('#todo-date-input').val(new Date().toISOString().slice(0, 10));

//+ button to create the date list
$('#todo-date-submit').on('click', function () {
    let inputDate = $('#todo-date-input').val();
    let inputDateName = new Date(inputDate).toLocaleDateString('en-us', { weekday: "long", year: "numeric", month: "short", day: "numeric" });

    if (taskArray.some(e => e.id == inputDate) === false) {
        createDateList(inputDate, inputDateName);
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
$('#date-list-container, #task-detail-container').on('click', '.todo-task-delete', function () {
    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    deleteTasks(dateID, taskID);
    bsOffcanvas.hide(); //hide detail view or close detail view

});

//event listener to create the input field for editing the tasks
$('#date-list-container').on('click', '.todo-task-edit', function () {
    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    let value = $(this).parent().siblings('.task-name-container').find('.task-name').text().trim();

    let updateTaskName = `<input id="update-task-name" class="w-75" type="text" prevValue='${value}' dateID='${dateID}' taskID='${taskID}' value='${value}'></input>`
    $(this).parent().siblings('.task-name-container').find('.task-name').empty();
    $(this).parent().siblings('.task-name-container').find('.task-name').append(updateTaskName);
    $('#update-task-name').focus();
});

//event listener to create the input field for editing the tasks in the detail view
$('#task-detail-container').on('click', '.todo-task-edit', function () {
    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    let value = $(this).parent().siblings('.task-detail-title').find('.offcanvas-title').text().trim();
    let updateTaskName = `<textarea id="update-task-name" class="w-100" type="text" prevValue='${value}' dateID='${dateID}' taskID='${taskID}' value='${value}'>${value}</textarea>`
    $(this).parent().siblings('.task-detail-title').find('.offcanvas-title').empty();
    $(this).parent().siblings('.task-detail-title').find('.offcanvas-title').append(updateTaskName);
    $('#update-task-name').focus();
});

//event listener to take the input from the input field tasks from the edit button
$('#date-list-container, #task-detail-container').on('keydown', '#update-task-name', function (e) {
    if (e.keyCode == 13) {
        let tempTaskName = $(this).val().trim();
        let dateID = $(this).attr('dateid');
        let taskID = $(this).attr('taskid');
        updateTasks(dateID, taskID, tempTaskName, '', '');
        if ($(this).parent().hasClass('offcanvas-title')) {
            $(this).parent().text(tempTaskName);
        }
        $(this).remove();
    }
    else if (e.keyCode == 27) {
        let prevValue = $(this).attr('prevvalue');
        $(this).parent().text(prevValue);
        $(this).remove();
    }
});


//event listener to toggle checkbox completion
$('#date-list-container').on('click', '.todo-task-check', function () {
    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    let statusCode = $(this).attr('statuscode');
    let newStatusCode = statusCode == 1001 ? 1004 : 1001;
    updateTasks(dateID, taskID, '', newStatusCode, '');

});

//event listener to create the detail view
$('#date-list-container').on('click', '.todo-task-detail', function () {
    bsOffcanvas.show();
    let dateID = $(this).val().slice(5, 15);
    let taskID = $(this).val().slice(16);
    let newObj = findTask(dateID, taskID);
    $('#task-detail-container').empty();
    $('#task-detail-container').append(renderTaskDetailHTML(newObj));

});


//--------------------Task Notes/Detail View----------------

//headings box toggle
$('#task-detail-container').on('mousedown', '.headings-box', function (e) {
    e.preventDefault();
    $('.headings-box').toggleClass('btn-no-bg-gray-active');
    $('#headings-box-container').toggle();
});

//adding headings to notes area
$('#task-detail-container').on('mousedown', '#headings-box-container button', function (e) {
    e.preventDefault();
    let dateID = $('#task-notes-area').attr('value').slice(5, 15);
    let taskID = $('#task-notes-area').attr('value').slice(16);
    let heading = $(this).attr('value');
    let focus = $('#task-notes-area').is(':focus');
    if (focus === true) {
        let sel = window.getSelection();
        let range = sel.getRangeAt(0);
        let headingElement = document.createElement(`${heading}`);
        headingElement.innerHTML = `${sel.toString()}`;
        range.deleteContents();
        range.insertNode(headingElement);
    }
    else {
        let headingElement = `<${heading}>Heading ${heading.slice(1, 2)}</${heading}>`;
        $('#task-notes-area').append(headingElement);

    }
    updateTasks(dateID, taskID, '', '', true);
    $('#headings-box-container').hide();
    $('.headings-box').removeClass('btn-no-bg-gray-active');
});


//adding ordered list to notes area
$('#task-detail-container').on('click', '.ol-box', function (e) {
    let dateID = $('#task-notes-area').attr('value').slice(5, 15);
    let taskID = $('#task-notes-area').attr('value').slice(16);
    let olList = `<ol><li>An Item here</li></ol>`
    $('#task-notes-area').append(olList);
    updateTasks(dateID, taskID, '', '', true);
});

//adding unordered list to notes area
$('#task-detail-container').on('click', '.ul-box', function (e) {
    let dateID = $('#task-notes-area').attr('value').slice(5, 15);
    let taskID = $('#task-notes-area').attr('value').slice(16);
    let ulList = `<ul><li>An Item here</li></ul>`
    $('#task-notes-area').append(ulList);
    updateTasks(dateID, taskID, '', '', true);
});

//colors box toggle
$('#task-detail-container').on('click', '.colors-box', function () {
    $('.colors-box').toggleClass('btn-no-bg-gray-active');
    $('#colors-box-container').toggle();
});

//adding color to selected font
$('#task-detail-container').on('click', '#colors-box-container button', function (e) {
    let dateID = $('#task-notes-area').attr('value').slice(5, 15);
    let taskID = $('#task-notes-area').attr('value').slice(16);
    //get cursor position
    let sel = window.getSelection();
    let coloredText = document.createElement('span');
    coloredText.innerText = sel.toString();
    coloredText.style.color = $(this).val();
    sel.getRangeAt(0).deleteContents();
    sel.getRangeAt(0).insertNode(coloredText);
    updateTasks(dateID, taskID, '', '', true);
    $('#colors-box-container').hide();
    $('.colors-box').removeClass('btn-no-bg-gray-active');

});

//background box toggle
$('#task-detail-container').on('click', '.background-box', function () {
    $('.background-box').toggleClass('btn-no-bg-gray-active');
    $('#background-box-container').toggle();
});

//adding background color to selected font
$('#task-detail-container').on('click', '#background-box-container button', function (e) {
    let dateID = $('#task-notes-area').attr('value').slice(5, 15);
    let taskID = $('#task-notes-area').attr('value').slice(16);
    //get cursor position
    let sel = window.getSelection();
    let backgroundText = document.createElement('span');
    backgroundText.innerText = sel.toString();
    backgroundText.style.backgroundColor = $(this).val();
    sel.getRangeAt(0).deleteContents();
    sel.getRangeAt(0).insertNode(backgroundText);
    updateTasks(dateID, taskID, '', '', true);
    $('#background-box-container').hide();
    $('.background-box').removeClass('btn-no-bg-gray-active');

});

// save notes on blur
$('#task-detail-container').on('blur', '#task-notes-area', function () {
    let dateID = $('#task-notes-area').attr('value').slice(5, 15);
    let taskID = $('#task-notes-area').attr('value').slice(16);
    updateTasks(dateID, taskID, '', '', true);
});

//keypress listener here for notes area
$('#task-detail-container').on('keydown', '#task-notes-area', function (e) {
    //get cursor position
    let sel = window.getSelection();
    let range = sel.getRangeAt(0);


    switch (e.keyCode) {
        case 9:
            {
                e.preventDefault();
                //get cursor position - unordered lists
                let ulElement = document.createElement('ul');
                ulElement.innerHTML = '<li></li>'
                range.insertNode(ulElement);
                range.selectNodeContents(ulElement);
                sel.removeAllRanges();
                sel.addRange(range);
                break;
            }


        case 57:
            if (e.ctrlKey) {
                let sel = window.getSelection();
                let olElement = document.createElement('ol');
                olElement.innerHTML = '<li></li>'
                range.insertNode(olElement);
                range.selectNodeContents(olElement);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            break;

        case 75:
            if (e.ctrlKey) {
                e.preventDefault();
                //get cursor position
                let anchorTag = document.createElement('span');
                let anchorLink = prompt('please enter URL here', 'https://google.com');
                if (anchorLink) {
                    anchorTag.innerHTML = `<a href=${anchorLink} target="_blank">${sel.toString()}</a>`
                    range.deleteContents();
                    range.insertNode(anchorTag);
                }
            }
            break;

        default:
            break;
    }

});