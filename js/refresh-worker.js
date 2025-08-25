const LAST_VISIT_KEY = 'last-visit-timestamp';
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

// 1. Handle Initial Load & reset the page refresh key when auto-refreshed or manually refreshed
window.addEventListener('load', () => {
        console.log('Page was refreshed. Resetting timestamp.');
        localStorage.setItem(LAST_VISIT_KEY, new Date().getTime().toString());
        let date = new Date();
        let formattedDate = date.toISOString().split('T')[0];
        $('#todo-date-input').val(formattedDate); 
        if (!localStorage.getItem(LAST_VISIT_KEY)) {
        console.log('First visit. Setting initial timestamp.');
        localStorage.setItem(LAST_VISIT_KEY, new Date().getTime().toString());
    }
});

// 2. Handle Page Visibility and Timestamps, refresh page when the days since visit is greater than 1 to update the date list & perform background clean-up.
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        console.log('Tab is now visible. Checking timestamp.');
        const lastVisit = localStorage.getItem(LAST_VISIT_KEY);

        const now = new Date().getTime();

        if (lastVisit) {
            const timeSinceLastVisit = now - parseInt(lastVisit, 10);
            console.log(`Time since last visit: ${timeSinceLastVisit}ms`);
            console.log(timeSinceLastVisit, ONE_DAY_IN_MS);
            if (timeSinceLastVisit > ONE_DAY_IN_MS) {
                console.log('Time is over 1 day. Refreshing page');
                console.log('Executing refresh command.');
                window.location.reload();
            }
        }
    }
}

document.addEventListener('visibilitychange', handleVisibilityChange);