// ============================================================
// calendar.js — FullCalendar integration for the todo list app
// ============================================================

import { taskArray, bsOffcanvas, findTask, renderTaskDetailHTML } from "./main.js";
import { TASK_ID_OFFSET } from "./utils.js";

/** Main FullCalendar instance */
let calendar = null;

/** Sidebar mini-calendar instance */
let miniCalendar = null;

/** Whether the calendar view is currently active (vs. list view) */
let isCalendarView = false;

/** Active filter state for calendar events */
const currentFilters = { todo: true, completed: true };

/** Cached task data used to populate calendar events */
let allTaskData = [];

/** Status code constant for completed tasks */
const COMPLETED_STATUS = 1004;

// ─── Main Calendar ───────────────────────────────────────────

/** Initialise the main FullCalendar instance with all options. */
function initCalendar() {
    const calendarEl = document.getElementById('fullcalendar');

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        },
        buttonText: { today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'List' },
        height: 'auto',
        navLinks: true,
        editable: false,
        dayMaxEvents: 3,

        eventClick: (info) => {
            openTaskDetail(info.event.extendedProps.dateId, info.event.id);
        },

        dateClick: (info) => {
            if (miniCalendar) miniCalendar.gotoDate(info.date);
        },

        eventDidMount: (info) => {
            if (info.event.extendedProps.statusCode === COMPLETED_STATUS) {
                info.el.classList.add('fc-event-completed');
            }
            const startTime = info.event.start
                ? new Date(info.event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : '';
            info.el.insertAdjacentHTML('beforeend', `<span class="btn-title">${startTime} ${info.event.title}</span>`);
        },

        datesSet: (info) => {
            if (miniCalendar) miniCalendar.gotoDate(info.view.currentStart);
        },

        moreLinkClick: () => {
            calendar.setOption('dayMaxEvents', false);
            calendar.render();
            return 'none';
        },
    });

    calendar.render();
    initMiniCalendar();
    initFilters();
}

// ─── Mini Calendar ───────────────────────────────────────────

/** Initialise the sidebar mini-calendar. */
function initMiniCalendar() {
    const miniCalendarEl = document.getElementById('mini-calendar');

    miniCalendar = new FullCalendar.Calendar(miniCalendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev', center: 'title', right: 'next' },
        height: 'auto',
        dayHeaderFormat: { weekday: 'narrow' },
        fixedWeekCount: false,
        showNonCurrentDates: true,
        dateClick: (info) => {
            if (calendar) calendar.gotoDate(info.date);
        },
    });

    miniCalendar.render();
}

// ─── Filters ─────────────────────────────────────────────────

/** Bind change listeners to the filter checkboxes. */
function initFilters() {
    const filterAll = document.getElementById('filter-all');
    const filterTodo = document.getElementById('filter-todo');
    const filterCompleted = document.getElementById('filter-completed');

    filterAll.addEventListener('change', function () {
        const isChecked = this.checked;
        filterTodo.checked = isChecked;
        filterCompleted.checked = isChecked;
        currentFilters.todo = isChecked;
        currentFilters.completed = isChecked;
        refreshCalendarEvents();
    });

    filterTodo.addEventListener('change', function () {
        currentFilters.todo = this.checked;
        updateFilterAllState();
        refreshCalendarEvents();
    });

    filterCompleted.addEventListener('change', function () {
        currentFilters.completed = this.checked;
        updateFilterAllState();
        refreshCalendarEvents();
    });
}

/** Sync the "All" checkbox with the individual filter states. */
function updateFilterAllState() {
    const filterAll = document.getElementById('filter-all');
    filterAll.checked = currentFilters.todo && currentFilters.completed;
}

// ─── Calendar Data & Events ──────────────────────────────────

/**
 * Update the cached task data and refresh calendar events.
 * @param {Array} dateLists - array of date-list objects
 */
function updateCalendarEvents(dateLists) {
    allTaskData = dateLists;
    if (!calendar) return;
    refreshCalendarEvents();
}

/** Clear and re-populate calendar events from cached task data, respecting filters. */
function refreshCalendarEvents() {
    if (!calendar) return;

    calendar.removeAllEvents();

    const filteredEvents = allTaskData.flatMap((dateList) =>
        dateList.taskList
            .filter((task) => {
                if (task.statusCode === COMPLETED_STATUS) return currentFilters.completed;
                return currentFilters.todo;
            })
            .map((task) => ({
                id: task.id,
                title: task.name,
                start: dateList.id,
                allDay: true,
                className: task.statusCode === COMPLETED_STATUS ? 'fc-event-completed' : 'fc-event-todo',
                extendedProps: {
                    dateId: dateList.id,
                    statusCode: task.statusCode,
                    desc: task.desc,
                },
            }))
    );

    calendar.addEventSource(filteredEvents);
}

// ─── View Toggle ─────────────────────────────────────────────

/** Switch between list view and calendar view. */
function toggleCalendarView() {
    const dateContainer = document.getElementById('date-parent-container');
    const calendarContainer = document.getElementById('calendar-container');
    const toggleBtn = document.getElementById('calendar-toggle-btn');

    isCalendarView = !isCalendarView;

    if (isCalendarView) {
        dateContainer.classList.add('hidden');
        calendarContainer.classList.remove('hidden');
        toggleBtn.classList.add('active');

        if (!calendar) initCalendar();
        updateCalendarEvents(taskArray);
        calendar.updateSize();
    } else {
        dateContainer.classList.remove('hidden');
        calendarContainer.classList.add('hidden');
        toggleBtn.classList.remove('active');
    }
}

/**
 * Open the task detail offcanvas from a calendar event click.
 * @param {string} dateId
 * @param {string} taskId - full task ID (includes date prefix)
 */
function openTaskDetail(dateId, taskId) {
    try {
        const task = findTask(dateId, taskId.slice(TASK_ID_OFFSET));
        if (task) {
            const detailEl = document.getElementById('task-detail-container');
            detailEl.innerHTML = renderTaskDetailHTML(task);
            bsOffcanvas.show();
        }
    } catch (error) {
        console.error('calendar.js — openTaskDetail failed:', error);
    }
}

/**
 * Switch to list view and scroll to a specific date list.
 * @param {string} dateStr - "YYYY-MM-DD"
 */
function scrollToDateList(dateStr) {
    toggleCalendarView();
    setTimeout(() => {
        const dateElement = document.getElementById(`date-item-${dateStr}`);
        if (dateElement) {
            dateElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

// Bind the toggle button
document.getElementById('calendar-toggle-btn').addEventListener('click', toggleCalendarView);

// ─── Exports ─────────────────────────────────────────────────

export { updateCalendarEvents, isCalendarView };
