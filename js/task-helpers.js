// ============================================================
// task-helpers.js — Pure task/date/CSV helpers shared by UI and tests
// ============================================================

// ─── Status Code Constants ───────────────────────────────────
// Defined here (not main.js) so todo-service.js can import without circular deps.

/** Default status for new tasks and date lists */
export const STATUS_TODO = 1001;

/** CSV header for task export/import. */
export const TASK_CSV_HEADERS = Object.freeze([
    'date_id',
    'date_name',
    'task_id',
    'task_name',
    'status_code',
    'description',
]);

/**
 * Decode common HTML entities and numeric character references.
 * Keeps task names as plain text at rest instead of escaped HTML fragments.
 * @param {string} value
 * @returns {string}
 */
export function decodeHTMLEntities(value) {
    const named = new Map([
        ['amp', '&'],
        ['lt', '<'],
        ['gt', '>'],
        ['quot', '"'],
        ['apos', "'"],
        ['nbsp', '\u00A0'],
    ]);

    return String(value ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
        const lower = entity.toLowerCase();
        if (lower.startsWith('#x')) {
            const codePoint = Number.parseInt(lower.slice(2), 16);
            return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
        }
        if (lower.startsWith('#')) {
            const codePoint = Number.parseInt(lower.slice(1), 10);
            return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
        }
        return named.get(lower) ?? match;
    });
}

/**
 * Normalize a task name to plain text for storage.
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeTaskName(name) {
    return decodeHTMLEntities(String(name ?? ''));
}

/**
 * Normalize a task record while preserving user content.
 * Repairs encoded entity names and ensures desc is always a string.
 * @param {object} task
 * @returns {object}
 */
export function normalizeTaskRecord(task) {
    return {
        ...task,
        name: normalizeTaskName(task?.name),
        desc: String(task?.desc ?? ''),
    };
}

/**
 * Return a YYYY-MM-DD string using local date fields instead of UTC.
 * @param {Date} [date]
 * @returns {string}
 */
export function getLocalDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Build the human-readable title used for a date list.
 * @param {string} dateId
 * @returns {string}
 */
export function formatDateListName(dateId) {
    const [year, month, day] = String(dateId).split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Clone a task for a target date while preserving content and metadata.
 * Task IDs are regenerated so the task continues to encode its owning date.
 * @param {object} task
 * @param {string} targetDateId
 * @param {number} uniqueId
 * @returns {object}
 */
export function cloneTaskForDate(task, targetDateId, uniqueId) {
    const normalized = normalizeTaskRecord(task);
    return {
        ...normalized,
        id: `Task-${targetDateId}-${uniqueId}`,
    };
}

/**
 * Convert date lists into CSV rows. Each returned row is an array of fields.
 * @param {Array<object>} dateLists
 * @returns {Array<Array<string | number>>}
 */
export function buildTaskCsvRows(dateLists) {
    const rows = [TASK_CSV_HEADERS];

    for (const dateList of dateLists) {
        if (!dateList.taskList?.length) {
            rows.push([dateList.id, dateList.name, '', '', '', '', '']);
            continue;
        }

        for (const task of dateList.taskList) {
            const normalized = normalizeTaskRecord(task);
            rows.push([
                dateList.id,
                dateList.name,
                normalized.id,
                normalized.name,
                normalized.statusCode ?? STATUS_TODO,
                normalized.desc,
            ]);
        }
    }

    return rows;
}

/**
 * RFC 4180 CSV field escaping.
 * @param {*} value
 * @returns {string}
 */
export function csvEscape(value) {
    const s = String(value ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
}

/**
 * Serialize CSV rows into an RFC 4180 string.
 * @param {Array<Array<string | number>>} rows
 * @returns {string}
 */
export function stringifyCSV(rows) {
    return rows
        .map((row) => row.map((v) => csvEscape(v)).join(','))
        .join('\n');
}

/**
 * Turn parsed CSV rows into date-list records.
 * Accepts both the new header with desc_format and the legacy 6-column shape.
 * @param {Array<Array<string>>} rows
 * @returns {Array<object>}
 */
export function buildDateListsFromCsvRows(rows) {
    if (!rows?.length) return [];

    const [headerRow, ...dataRows] = rows;
    const headerMap = new Map(headerRow.map((name, index) => [name, index]));
    const hasNamedHeader = headerMap.has('date_id');
    const dateLists = new Map();

    for (const row of dataRows) {
        const dateId = hasNamedHeader ? row[headerMap.get('date_id')] : row[0];
        if (!dateId) continue;

        const dateName = hasNamedHeader ? row[headerMap.get('date_name')] : row[1];
        const taskId = hasNamedHeader ? row[headerMap.get('task_id')] : row[2];
        const taskName = hasNamedHeader ? row[headerMap.get('task_name')] : row[3];
        const statusCode = hasNamedHeader ? row[headerMap.get('status_code')] : row[4];
        const desc = hasNamedHeader ? row[headerMap.get('description')] : row[5];

        if (!dateLists.has(dateId)) {
            dateLists.set(dateId, {
                id: dateId,
                name: dateName || formatDateListName(dateId),
                taskList: [],
                statusCode: STATUS_TODO,
            });
        }

        if (taskId && taskName) {
            dateLists.get(dateId).taskList.push({
                id: taskId,
                name: normalizeTaskName(taskName),
                statusCode: Number(statusCode) || STATUS_TODO,
                desc: String(desc ?? ''),
            });
        }
    }

    return [...dateLists.values()];
}
