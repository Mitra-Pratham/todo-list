//--------------------event listeners-------------------------------------

//Creating and setting date lists
$('#todo-date-input').val(new Date().toISOString().slice(0, 10));

//+ button to create the date list
$('#todo-date-submit').on('click', () => {
    const inputDate = $('#todo-date-input').val();
    const inputDateName = new Date(inputDate).toLocaleDateString('en-us', { weekday: "long", year: "numeric", month: "short", day: "numeric" });

    const alreadyExists = taskArray.some((dateItem) => dateItem.id === inputDate);
    if (!alreadyExists) {
        createDateList(inputDate, inputDateName);
    } else {
        setMessageState('failure', 'Date list already exists!');
    }
});

//event listener to delete date list
$('#date-list-container').on('click', '.todo-date-delete', function () {
    const dateId = $(this).val();
    deleteDateList(dateId);
});

//event listener to mark all tasks as done
$('#date-list-container').on('click', '.mark-all-done-btn', function () {
    const dateId = $(this).val();
    markAllAsDone(dateId);
});

//+ button event listener to create the task item
// $('#date-list-container').on('click', '.todo-task-submit', function () {
//     let taskName = $(this).prev().children('.create-task-input').val().trim();
//     let dateID = $(this).prev().children('.create-task-input').attr('id').slice(11);
//     createTask(taskName, dateID,'','');
// });

//keydown 'enter' event listener to create the task item
$('#date-list-container').on('keydown', '.create-task-input', function (e) {
    if (e.key === 'Enter') {
        const taskName = $(this).val().trim();
        const dateId = $(this).attr('id').slice(11);
        createTask(taskName, dateId, this, '');
    }
});

//event listener to delete tasks from the delete button
$('#date-list-container, #task-detail-container').on('click', '.todo-task-delete', function () {
    const dateId = $(this).val().slice(5, 15);
    const taskId = $(this).val().slice(16);
    deleteTasks(dateId, taskId);
    bsOffcanvas.hide(); //hide detail view or close detail view

});

//event listener to create the input field for editing the tasks
$('#date-list-container').on('click', '.todo-task-edit', function () {
    const dateId = $(this).val().slice(5, 15);
    const taskId = $(this).val().slice(16);
    const currentName = $(this).parent().siblings('.task-name-container').find('.task-name').text().trim();

    const editInput = `<input id="update-task-name" class="w-75" type="text" prevValue='${currentName}' dateID='${dateId}' taskID='${taskId}' value='${currentName}'>`;
    $(this).parent().siblings('.task-name-container').find('.task-name').empty();
    $(this).parent().siblings('.task-name-container').find('.task-name').append(editInput);
    $('#update-task-name').focus();
});

//event listener to create the input field for editing the tasks in the detail view
$('#task-detail-container').on('click', '.todo-task-edit', function () {
    const dateId = $(this).val().slice(5, 15);
    const taskId = $(this).val().slice(16);
    const currentName = $(this).parent().siblings('.task-detail-title').find('.offcanvas-title').text().trim();
    const editTextarea = `<textarea id="update-task-name" class="w-100" type="text" prevValue='${currentName}' dateID='${dateId}' taskID='${taskId}' value='${currentName}'>${currentName}</textarea>`;
    $(this).parent().siblings('.task-detail-title').find('.offcanvas-title').empty();
    $(this).parent().siblings('.task-detail-title').find('.offcanvas-title').append(editTextarea);
    $('#update-task-name').focus();
});

//event listener to take the input from the input field tasks from the edit button
$('#date-list-container, #task-detail-container').on('keydown', '#update-task-name', function (e) {
    if (e.key === 'Enter') {
        const newName = $(this).val().trim();
        const dateId = $(this).attr('dateid');
        const taskId = $(this).attr('taskid');
        updateTasks(dateId, taskId, newName, '', '');
        if ($(this).parent().hasClass('offcanvas-title')) {
            $(this).parent().html(replaceURLs(newName));
        }
        $(this).remove();
    } else if (e.key === 'Escape') {
        const previousValue = $(this).attr('prevvalue');
        $(this).parent().html(replaceURLs(previousValue));
        $(this).remove();
    }
});


//event listener to toggle checkbox completion
$('#date-list-container').on('click', '.todo-task-check', function () {
    const dateId = $(this).val().slice(5, 15);
    const taskId = $(this).val().slice(16);
    const statusCode = Number($(this).attr('statuscode'));
    const newStatusCode = statusCode === 1001 ? 1004 : 1001;
    updateTasks(dateId, taskId, '', newStatusCode, '');
});

//event listener to create the detail view
$('#date-list-container').on('click', '.todo-task-detail', function () {
    bsOffcanvas.show();
    const dateId = $(this).val().slice(5, 15);
    const taskId = $(this).val().slice(16);
    const taskObj = findTask(dateId, taskId);
    $('#task-detail-container').empty();
    $('#task-detail-container').append(renderTaskDetailHTML(taskObj));
});

// event listener to select multiple tasks
$('#date-list-container').on('click', '.list-group-item', function (e) {
    if (e.ctrlKey) {
        $(this).toggleClass('list-group-item-selected');
    } else {
        console.log('Clicked without Ctrl key.');
    }
});

// Open context menu on right-click
$('#date-list-container').on('contextmenu', '.list-group-item', function (e) {
    e.preventDefault();
    $('#context-menu').show().css({
        left: e.pageX,
        top: e.pageY
    });
});

// Dismiss context menu when clicking anywhere outside it
$(document).on('click', function (e) {
    if (!$(e.target).closest('#context-menu').length) {
        $('#context-menu').hide();
    }
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
    const { dateId, taskId } = getNotesTaskIds();
    const headingTag = $(this).attr('value');
    const isFocused = $('#task-notes-area').is(':focus');

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
    } else {
        const headingMarkup = `<${headingTag}>Heading ${headingTag.slice(1, 2)}</${headingTag}>`;
        $('#task-notes-area').append(headingMarkup);
    }

    updateTasks(dateId, taskId, '', '', true);
    $('#headings-box-container').hide();
    $('.headings-box').removeClass('btn-no-bg-gray-active');
});

//adding ordered list to notes area
$('#task-detail-container').on('click', '.ol-box', function () {
    const { dateId, taskId } = getNotesTaskIds();
    $('#task-notes-area').append('<ol><li>An Item here</li></ol>');
    updateTasks(dateId, taskId, '', '', true);
});

//adding unordered list to notes area
$('#task-detail-container').on('click', '.ul-box', function () {
    const { dateId, taskId } = getNotesTaskIds();
    $('#task-notes-area').append('<ul><li>An Item here</li></ul>');
    updateTasks(dateId, taskId, '', '', true);
});

//colors box toggle
$('#task-detail-container').on('click', '.colors-box', function () {
    $('.colors-box').toggleClass('btn-no-bg-gray-active');
    $('#colors-box-container').toggle();
});

//adding color to selected font
$('#task-detail-container').on('click', '#colors-box-container button', function () {
    const { dateId, taskId } = getNotesTaskIds();
    try {
        const selection = window.getSelection();
        const colorSpan = document.createElement('span');
        colorSpan.innerText = selection.toString();
        colorSpan.style.color = $(this).val();
        selection.getRangeAt(0).deleteContents();
        selection.getRangeAt(0).insertNode(colorSpan);
    } catch (error) {
        console.error('listeners.js — font colour failed:', error);
    }
    updateTasks(dateId, taskId, '', '', true);
    $('#colors-box-container').hide();
    $('.colors-box').removeClass('btn-no-bg-gray-active');
});

//background box toggle
$('#task-detail-container').on('click', '.background-box', function () {
    $('.background-box').toggleClass('btn-no-bg-gray-active');
    $('#background-box-container').toggle();
});

//adding background color to selected font
$('#task-detail-container').on('click', '#background-box-container button', function () {
    const { dateId, taskId } = getNotesTaskIds();
    try {
        const selection = window.getSelection();
        const bgSpan = document.createElement('span');
        bgSpan.innerText = selection.toString();
        bgSpan.style.backgroundColor = $(this).val();
        selection.getRangeAt(0).deleteContents();
        selection.getRangeAt(0).insertNode(bgSpan);
    } catch (error) {
        console.error('listeners.js — background colour failed:', error);
    }
    updateTasks(dateId, taskId, '', '', true);
    $('#background-box-container').hide();
    $('.background-box').removeClass('btn-no-bg-gray-active');
});

// save notes on blur
$('#task-detail-container').on('blur', '#task-notes-area', function () {
    const { dateId, taskId } = getNotesTaskIds();
    updateTasks(dateId, taskId, '', '', true);
});

//keypress listener here for notes area
$('#task-detail-container').on('keydown', '#task-notes-area', function (e) {
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
            if (linkUrl) {
                const linkWrapper = document.createElement('span');
                linkWrapper.innerHTML = `<a href="${linkUrl}" target="_blank">${selection.toString()}</a>`;
                range.deleteContents();
                range.insertNode(linkWrapper);
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
    const value = $('#task-notes-area').attr('value');
    return { dateId: value.slice(5, 15), taskId: value.slice(16) };
}