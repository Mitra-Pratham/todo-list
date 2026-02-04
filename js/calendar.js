let calendar = null;
let miniCalendar = null;
let isCalendarView = false;
let currentFilters = { todo: true, completed: true };
let allTaskData = [];

function initCalendar() {
    const calendarEl = document.getElementById('fullcalendar');

    const calendarOptions = {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
        },
        buttonText: {
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'List'
        },
        height: 'auto',
        navLinks: true,
        editable: false,
        dayMaxEvents: 3,
        eventClick: function (info) {
            const taskId = info.event.id;
            const dateId = info.event.extendedProps.dateId;
            openTaskDetail(dateId, taskId);
        },
        dateClick: function (info) {
            if (miniCalendar) {
                miniCalendar.gotoDate(info.date);
            }
        },
        eventDidMount: function (info) {
            if (info.event.extendedProps.statusCode === 1004) {
                info.el.classList.add('fc-event-completed');
            }
            // Add tooltip with full title
            const startTime = info.event.start ? new Date(info.event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
$(info.el).append(`<span class="btn-title">${startTime} ${info.event.title}</span>`);
            
        },
        datesSet: function (info) {
            if (miniCalendar) {
                miniCalendar.gotoDate(info.view.currentStart);
            }
        },
        moreLinkClick: function (info) {
            calendar.setOption('dayMaxEvents', false);
            calendar.render();
            return 'none';
        }
    };

    calendar = new FullCalendar.Calendar(calendarEl, calendarOptions);

    calendar.render();
    initMiniCalendar();
    initFilters();
}

function initMiniCalendar() {
    const miniCalendarEl = document.getElementById('mini-calendar');

    miniCalendar = new FullCalendar.Calendar(miniCalendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next'
        },
        height: 'auto',
        dayHeaderFormat: { weekday: 'narrow' },
        fixedWeekCount: false,
        showNonCurrentDates: true,
        dateClick: function (info) {
            if (calendar) {
                calendar.gotoDate(info.date);
            }
        }
    });

    miniCalendar.render();
}

function initFilters() {
    const filterAll = document.getElementById('filter-all');
    const filterTodo = document.getElementById('filter-todo');
    const filterCompleted = document.getElementById('filter-completed');

    filterAll.addEventListener('change', function () {
        const checked = this.checked;
        filterTodo.checked = checked;
        filterCompleted.checked = checked;
        currentFilters.todo = checked;
        currentFilters.completed = checked;
        applyFilters();
    });

    filterTodo.addEventListener('change', function () {
        currentFilters.todo = this.checked;
        updateFilterAllState();
        applyFilters();
    });

    filterCompleted.addEventListener('change', function () {
        currentFilters.completed = this.checked;
        updateFilterAllState();
        applyFilters();
    });
}

function updateFilterAllState() {
    const filterAll = document.getElementById('filter-all');
    filterAll.checked = currentFilters.todo && currentFilters.completed;
}

function applyFilters() {
    refreshCalendarEvents();
}

function updateCalendarEvents(data) {
    allTaskData = data;
    if (!calendar) return;
    refreshCalendarEvents();
}

function toggleCalendarView() {
    const dateContainer = document.getElementById('date-parent-container');
    const calendarContainer = document.getElementById('calendar-container');
    const toggleBtn = document.getElementById('calendar-toggle-btn');

    isCalendarView = !isCalendarView;

    if (isCalendarView) {
        dateContainer.classList.add('d-none');
        calendarContainer.classList.remove('d-none');
        toggleBtn.innerHTML = '<i class="fa-solid fa-list me-2"></i>List View';

        if (!calendar) {
            initCalendar();
        }
        updateCalendarEvents(taskArray);
        calendar.updateSize();
    } else {
        dateContainer.classList.remove('d-none');
        calendarContainer.classList.add('d-none');
        toggleBtn.innerHTML = '<i class="fa-solid fa-calendar-days me-2"></i>Calendar';
    }
}

function openTaskDetail(dateId, taskId) {
    const task = window.findTask(dateId, taskId.slice(16));
    if (task) {
        $('#task-detail-container').empty();
        $('#task-detail-container').append(window.renderTaskDetailHTML(task));
        bsOffcanvas.show();
    }
}

function scrollToDateList(dateStr) {
    toggleCalendarView();
    setTimeout(() => {
        const dateElement = document.getElementById(`date-item-${dateStr}`);
        if (dateElement) {
            dateElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

document.getElementById('calendar-toggle-btn').addEventListener('click', toggleCalendarView);

function refreshCalendarEvents() {
    if (!calendar) return;
    
    calendar.removeAllEvents();
    
    // Add task events
    const taskEvents = allTaskData.flatMap(dateList =>
        dateList.taskList
            .filter(task => {
                if (task.statusCode === 1004) return currentFilters.completed;
                return currentFilters.todo;
            })
            .map(task => ({
                id: task.id,
                title: task.name,
                start: dateList.id,
                allDay: true,
                className: task.statusCode === 1004 ? 'fc-event-completed' : 'fc-event-todo',
                extendedProps: {
                    dateId: dateList.id,
                    statusCode: task.statusCode,
                    desc: task.desc
                }
            }))
    );

    calendar.addEventSource(taskEvents);
}

window.updateCalendarEvents = updateCalendarEvents;
window.isCalendarView = () => isCalendarView;
