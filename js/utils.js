// ============================================================
// utils.js — Shared utility helpers
// ============================================================

/** Regex matching http/https URLs in plain text */
export const URL_PATTERN = /(\b(https?):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;

// ─── Task ID Layout Constants ────────────────────────────────
// Task IDs follow the pattern: "Task-YYYY-MM-DD-<timestamp>"
//                                ^5   ^15   ^16→
/** Start index of the date portion within a task ID */
export const DATE_ID_START = 5;
/** End index (exclusive) of the date portion within a task ID */
export const DATE_ID_END = 15;
/** Start index of the unique task suffix within a task ID */
export const TASK_ID_OFFSET = 16;

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - untrusted string
 * @returns {string} escaped string safe for innerHTML
 */
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Validate that a string is a safe HTTP(S) URL.
 * Rejects javascript:, data:, and other dangerous protocols.
 * @param {string} str - URL string to validate
 * @returns {boolean}
 */
export function isValidURL(str) {
    try {
        const url = new URL(str);
        return ['http:', 'https:'].includes(url.protocol);
    } catch { return false; }
}

/**
 * Replace plain-text URLs with clickable anchor tags.
 * @param {string} text - raw text that may contain URLs
 * @returns {string} text with URLs wrapped in <a> tags
 */
export function replaceURLs(text) {
    if (!text) return text;
    return text.replace(URL_PATTERN, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
