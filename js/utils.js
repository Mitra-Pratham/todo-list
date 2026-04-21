// ============================================================
// utils.js — Shared utility helpers
// ============================================================

// ─── JSDoc Type Definitions ──────────────────────────────────

/**
 * @typedef {Object} Task
 * @property {string}  id         - e.g. "Task-2026-04-21-1713700000000"
 * @property {string}  name       - display name (plain text, may contain linkified URLs)
 * @property {number}  statusCode - 1001=Todo, 1002=Ongoing, 1003=Blocked, 1004=Completed, 1005=Archived
 * @property {string}  desc       - rich HTML content for the detail/notes area
 * @property {string}  [dateName] - human-readable date label (transient, set by findTask)
 */

/**
 * @typedef {Object} DateList
 * @property {string}  id         - "YYYY-MM-DD"
 * @property {string}  name       - human-readable date string
 * @property {Task[]}  taskList
 * @property {number}  statusCode
 */

/**
 * @typedef {Object} NotePage
 * @property {string}  id     - e.g. "notes-area-0000001"
 * @property {string}  name   - page title
 * @property {number}  status - 1001 default
 * @property {string}  html   - rich HTML content
 */

// ─── Constants ───────────────────────────────────────────────

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

// ─── Plain-Text Helpers ──────────────────────────────────────

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
 * Only safe on plain-text strings — NEVER call on HTML innerHTML.
 * @param {string} text - raw text that may contain URLs
 * @returns {string} text with URLs wrapped in <a> tags
 */
export function replaceURLs(text) {
    if (!text) return text;
    return text.replace(URL_PATTERN, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// ─── Rich-HTML Sanitization ──────────────────────────────────

/** Allowed tags in rich-text content (lowercase). */
const ALLOWED_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'div', 'span', 'a',
    'ul', 'ol', 'li',
    'code', 'pre', 'br', 'hr',
    'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'img', 'blockquote',
]);

/** Per-tag attribute allowlists; `'*'` key = global attrs allowed on every tag. */
const ALLOWED_ATTRS = /** @type {Record<string, Set<string>>} */ ({
    '*':   new Set(['id', 'class', 'style']),
    'a':   new Set(['href', 'target', 'rel']),
    'img': new Set(['src', 'alt', 'width', 'height']),
});

/** CSS properties allowed inside inline `style` attributes. */
const SAFE_STYLE_PROPS = new Set([
    'color', 'background-color', 'background',
    'display', 'text-align', 'font-weight', 'font-style', 'text-decoration',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
]);

/**
 * Sanitize an inline `style` attribute value, keeping only safe properties.
 * @param {string} raw - e.g. "color:red; position:absolute; onerror:alert(1)"
 * @returns {string} sanitized style string
 */
function sanitizeStyle(raw) {
    try {
        const el = document.createElement('span');
        el.style.cssText = raw;
        /** @type {string[]} */
        const safe = [];
        for (let i = 0; i < el.style.length; i++) {
            const prop = el.style[i];
            if (SAFE_STYLE_PROPS.has(prop)) {
                safe.push(`${prop}:${el.style.getPropertyValue(prop)}`);
            }
        }
        return safe.join(';');
    } catch {
        return '';
    }
}

/**
 * Check whether an `href` or `src` value uses a safe protocol.
 * @param {string} value
 * @returns {boolean}
 */
function isSafeURL(value) {
    try {
        const url = new URL(value, globalThis.location?.href);
        return ['http:', 'https:', 'mailto:'].includes(url.protocol);
    } catch {
        return false;
    }
}

/**
 * Recursively walk a DOM node, keeping only allowed tags/attrs/styles.
 * Unsafe nodes are replaced by their children (text is preserved).
 * @param {Node} node
 * @param {DocumentFragment} out - target fragment to append safe nodes to
 */
function walkNode(node, out) {
    if (node.nodeType === Node.TEXT_NODE) {
        out.appendChild(document.createTextNode(node.textContent ?? ''));
        return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = /** @type {Element} */ (node);
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
        // Unwrap: keep children, discard the tag itself
        for (const child of [...el.childNodes]) {
            walkNode(child, out);
        }
        return;
    }

    const safeEl = document.createElement(tag);

    // Copy allowed attributes
    const globalAttrs = ALLOWED_ATTRS['*'];
    const tagAttrs = ALLOWED_ATTRS[tag];

    for (const attr of el.attributes) {
        const name = attr.name.toLowerCase();

        // Block all event handlers
        if (name.startsWith('on')) continue;

        const isGlobal = globalAttrs?.has(name);
        const isTagSpecific = tagAttrs?.has(name);
        if (!isGlobal && !isTagSpecific) continue;

        if (name === 'style') {
            const cleaned = sanitizeStyle(attr.value);
            if (cleaned) safeEl.setAttribute('style', cleaned);
        } else if (name === 'href' || name === 'src') {
            if (isSafeURL(attr.value)) {
                safeEl.setAttribute(name, attr.value);
                if (name === 'href') {
                    safeEl.setAttribute('target', '_blank');
                    safeEl.setAttribute('rel', 'noopener noreferrer');
                }
            }
        } else {
            safeEl.setAttribute(name, attr.value);
        }
    }

    // Recurse into children
    for (const child of [...el.childNodes]) {
        walkNode(child, safeEl);
    }

    out.appendChild(safeEl);
}

/**
 * Sanitize a rich-HTML string through a DOM-based allowlist walker.
 * Safe for contenteditable innerHTML, imported files, and MCP payloads.
 *
 * @param {string} html - untrusted HTML string
 * @returns {string} sanitized HTML string
 */
export function sanitizeRichHTML(html) {
    if (!html) return html ?? '';

    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const fragment = document.createDocumentFragment();

        for (const child of [...doc.body.childNodes]) {
            walkNode(child, fragment);
        }

        const wrapper = document.createElement('div');
        wrapper.appendChild(fragment);
        return wrapper.innerHTML;
    } catch (error) {
        console.error('utils.js — sanitizeRichHTML failed:', error);
        return escapeHTML(html);
    }
}

// ─── Rich-Content Detection ─────────────────────────────────

/** Tags whose mere presence counts as meaningful content. */
const MEDIA_TAGS = new Set(['img', 'hr', 'video', 'audio', 'canvas', 'svg']);

/**
 * Check whether an HTML string contains meaningful visible content.
 * Handles empty editors that produce residual `<br>`, `<div><br></div>`, etc.
 *
 * @param {string | null | undefined} html
 * @returns {boolean} true if the HTML has visible text or media elements
 */
export function hasRichContent(html) {
    if (!html) return false;

    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Check for text content
        if (doc.body.textContent?.trim().length) return true;

        // Check for media/visual elements
        for (const tag of MEDIA_TAGS) {
            if (doc.body.querySelector(tag)) return true;
        }

        return false;
    } catch {
        // Fallback: simple string length check
        return html.trim().length > 1;
    }
}
