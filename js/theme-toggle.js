// Theme toggle — persists preference to localStorage
(function () {
    const STORAGE_KEY = 'theme';
    const root = document.documentElement;

    function getPreferred() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function apply(theme) {
        if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else {
            root.removeAttribute('data-theme');
        }
        // Swap icon
        const icon = document.querySelector('#theme-toggle-btn i');
        if (icon) {
            icon.className = theme === 'light'
                ? 'fa-solid fa-moon'
                : 'fa-solid fa-sun';
        }
    }

    // Apply immediately to avoid FOUC
    apply(getPreferred());

    // Attach toggle after DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        apply(getPreferred()); // re-apply to update icon once DOM is ready
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                const next = root.hasAttribute('data-theme') ? 'dark' : 'light';
                localStorage.setItem(STORAGE_KEY, next);
                apply(next);
            });
        }
    });
})();
