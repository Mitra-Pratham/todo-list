let calendar = null;
let miniCalendar = null;
let isCalendarView = false;
let currentFilters = { todo: true, completed: true };
let allTaskData = [];
let googleCalendarEvents = [];
let showGoogleEvents = true;

// Google Calendar OAuth Configuration
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const GCAL_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

function getGoogleCalendarClientId() {
    return localStorage.getItem('gcal-client-id') || '';
}

function saveGoogleCalendarClientId(clientId) {
    localStorage.setItem('gcal-client-id', clientId);
}

function getGoogleCalendarToken() {
    const token = localStorage.getItem('gcal-token');
    if (!token) return null;
    try {
        const parsed = JSON.parse(token);
        // Check if token is expired
        if (parsed.expires_at && Date.now() > parsed.expires_at) {
            localStorage.removeItem('gcal-token');
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function saveGoogleCalendarToken(token) {
    // Add expiry time (1 hour from now)
    token.expires_at = Date.now() + (token.expires_in * 1000);
    localStorage.setItem('gcal-token', JSON.stringify(token));
}

function clearGoogleCalendarToken() {
    localStorage.removeItem('gcal-token');
}

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
    
    // Load Google Calendar events if authenticated
    loadGoogleCalendarEvents();
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

// Google Calendar OAuth Functions
async function initGoogleOAuth() {
    const clientId = getGoogleCalendarClientId();
    if (!clientId) return;

    // Load Google Identity Services library dynamically
    if (!window.google?.accounts?.oauth2) {
        await loadGoogleIdentityServices();
    }
}

function loadGoogleIdentityServices() {
    return new Promise((resolve, reject) => {
        if (window.google?.accounts?.oauth2) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function signInToGoogleCalendar() {
    const clientId = getGoogleCalendarClientId();
    if (!clientId) {
        updateGoogleCalendarStatus('Please configure Client ID first', 'warning');
        // Expand settings
        const settingsCollapse = document.getElementById('gcal-settings');
        new bootstrap.Collapse(settingsCollapse, { show: true });
        return;
    }

    try {
        await loadGoogleIdentityServices();
        
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GCAL_SCOPES,
            callback: (response) => {
                if (response.error) {
                    console.error('OAuth error:', response);
                    updateGoogleCalendarStatus('Authentication failed', 'danger');
                    return;
                }
                saveGoogleCalendarToken(response);
                updateGoogleCalendarUI();
                loadGoogleCalendarEvents();
            }
        });

        tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (error) {
        console.error('Google sign-in error:', error);
        updateGoogleCalendarStatus('Failed to initialize Google sign-in', 'danger');
    }
}

async function signOutFromGoogleCalendar() {
    const token = getGoogleCalendarToken();
    
    if (token?.access_token) {
        try {
            // Try to revoke using Google's API
            await loadGoogleIdentityServices();
            if (window.google?.accounts?.oauth2?.revoke) {
                google.accounts.oauth2.revoke(token.access_token, () => {
                    console.log('Token revoked');
                });
            }
        } catch (e) {
            console.log('Could not revoke token:', e);
        }
    }
    
    clearGoogleCalendarToken();
    googleCalendarEvents = [];
    updateGoogleCalendarUI();
    refreshCalendarEvents();
    updateGoogleCalendarStatus('Disconnected', 'muted');
}

async function loadGoogleCalendarEvents() {
    const token = getGoogleCalendarToken();
    if (!token || !showGoogleEvents) {
        googleCalendarEvents = [];
        return;
    }

    try {
        // Get date range: 1 month before current date to 1 year after
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const timeMax = new Date(now.getFullYear() + 1, now.getMonth(), 1).toISOString();

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${encodeURIComponent(timeMin)}&` +
            `timeMax=${encodeURIComponent(timeMax)}&` +
            `singleEvents=true&orderBy=startTime&maxResults=250`,
            {
                headers: {
                    'Authorization': `Bearer ${token.access_token}`
                }
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired
                clearGoogleCalendarToken();
                updateGoogleCalendarUI();
                return;
            }
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        googleCalendarEvents = (data.items || [])
            .filter(event => event.start && (event.start.dateTime || event.start.date) && event.summary !== 'Home')
            .map(event => ({
                id: `gcal-${event.id}`,
                title: event.summary || '(No title)',
                start: event.start.dateTime || event.start.date,
                end: event.end?.dateTime || event.end?.date,
                allDay: !event.start.dateTime,
                className: 'fc-event-google',
                extendedProps: {
                    isGoogleEvent: true,
                    description: event.description,
                    location: event.location,
                    htmlLink: event.htmlLink
                }
            }));
        
        refreshCalendarEvents();
        updateGoogleCalendarStatus(`${googleCalendarEvents.length} events loaded`, 'success');
    } catch (error) {
        console.error('Failed to load Google Calendar events:', error);
        updateGoogleCalendarStatus('Failed to load events', 'danger');
    }
}

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

    // Add Google Calendar events if enabled
    if (showGoogleEvents && googleCalendarEvents.length > 0) {
        calendar.addEventSource([...taskEvents, ...googleCalendarEvents]);
    } else {
        calendar.addEventSource(taskEvents);
    }
}

function updateGoogleCalendarStatus(message, type) {
    const statusEl = document.getElementById('gcal-status');
    if (!statusEl) return;

    if (message) {
        const iconMap = {
            success: 'fa-circle-check',
            warning: 'fa-exclamation-triangle',
            danger: 'fa-circle-xmark',
            muted: 'fa-circle-xmark'
        };
        statusEl.innerHTML = `<span class="text-${type}"><i class="fa-solid ${iconMap[type] || 'fa-info-circle'} me-1"></i>${message}</span>`;
    }
}

function updateGoogleCalendarUI() {
    const token = getGoogleCalendarToken();
    const signedOutEl = document.getElementById('gcal-signed-out');
    const signedInEl = document.getElementById('gcal-signed-in');
    const userEmailEl = document.getElementById('gcal-user-email');
    const showEventsCheckbox = document.getElementById('gcal-show-events');

    if (token) {
        signedOutEl?.classList.add('d-none');
        signedInEl?.classList.remove('d-none');
        if (userEmailEl) userEmailEl.textContent = 'Connected';
        if (showEventsCheckbox) showEventsCheckbox.checked = showGoogleEvents;
        updateGoogleCalendarStatus('Connected', 'success');
    } else {
        signedOutEl?.classList.remove('d-none');
        signedInEl?.classList.add('d-none');
        updateGoogleCalendarStatus('Not connected', 'muted');
    }
}

// Google Calendar Settings UI
function initGoogleCalendarSettings() {
    const clientIdInput = document.getElementById('gcal-client-id');
    const saveClientBtn = document.getElementById('gcal-save-client-btn');
    const signInBtn = document.getElementById('gcal-signin-btn');
    const signOutBtn = document.getElementById('gcal-signout-btn');
    const showEventsCheckbox = document.getElementById('gcal-show-events');

    // Load saved client ID
    const clientId = getGoogleCalendarClientId();
    if (clientIdInput && clientId) {
        clientIdInput.value = clientId;
    }

    // Save client ID
    saveClientBtn?.addEventListener('click', function () {
        const clientId = clientIdInput?.value.trim();
        if (clientId) {
            saveGoogleCalendarClientId(clientId);
            updateGoogleCalendarStatus('Client ID saved', 'success');
        }
    });

    // Sign in button
    signInBtn?.addEventListener('click', signInToGoogleCalendar);

    // Sign out button
    signOutBtn?.addEventListener('click', signOutFromGoogleCalendar);

    // Toggle show events
    showEventsCheckbox?.addEventListener('change', function () {
        showGoogleEvents = this.checked;
        refreshCalendarEvents();
    });

    // Update UI based on current state
    updateGoogleCalendarUI();
}

// Initialize settings when DOM is ready
document.addEventListener('DOMContentLoaded', initGoogleCalendarSettings);

window.updateCalendarEvents = updateCalendarEvents;
window.isCalendarView = () => isCalendarView;
