// ============================================================
// refresh-worker.js — Auto-refresh the page after 24 h of inactivity
// ============================================================

/** localStorage key that stores the last-visit epoch timestamp */
const LAST_VISIT_KEY = 'last-visit-timestamp';

/** Threshold after which the page should reload (24 hours) */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * On every page load: record the current timestamp and set today's date
 * in the date-picker input so new date lists default to today.
 */
window.addEventListener('load', () => {
    const nowMs = Date.now().toString();
    localStorage.setItem(LAST_VISIT_KEY, nowMs);

    const todayISO = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('todo-date-input');
    if (dateInput) dateInput.value = todayISO;
});

/**
 * When the tab becomes visible again, check whether more than 24 hours
 * have elapsed since the last visit. If so, reload the page to pick up
 * fresh data and reset the date picker.
 */
function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;

    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    if (!lastVisit) return;

    const elapsed = Date.now() - parseInt(lastVisit, 10);
    if (elapsed > ONE_DAY_MS) {
        console.info(`refresh-worker.js — ${Math.round(elapsed / 3600000)}h since last visit, reloading.`);
        window.location.reload();
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);