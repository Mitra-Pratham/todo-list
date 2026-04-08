// ============================================================
// utils.js — Shared utility helpers
// ============================================================

/** Regex matching http/https URLs in plain text */
const URL_PATTERN = /(\b(https?):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;

/**
 * Replace plain-text URLs with clickable anchor tags.
 * @param {string} text - raw text that may contain URLs
 * @returns {string} text with URLs wrapped in <a> tags
 */
function replaceURLs(text) {
    if (!text) return text;
    return text.replace(URL_PATTERN, '<a href="$1" target="_blank">$1</a>');
}
