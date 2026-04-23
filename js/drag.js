// ============================================================
// drag.js — Drag-and-drop handlers for moving tasks between dates
// ============================================================

import { moveTaskBetweenDates } from "./main.js";
import { DATE_ID_START, DATE_ID_END, TASK_ID_OFFSET } from "./utils.js";

/**
 * Allow a drop target to receive dragged items.
 * @param {DragEvent} event
 */
export function allowDrop(event) {
    event.preventDefault();
}

/**
 * Start dragging a task item — serialise its ID into the dataTransfer.
 * @param {DragEvent} event
 */
export function drag(event) {
    try {
        const dragPayload = { value: event.target.getAttribute('value') };
        event.dataTransfer.setData('text', JSON.stringify(dragPayload));
        document.querySelectorAll('.drag-group').forEach(el => el.style.display = '');
    } catch (error) {
        console.error('drag.js — drag start failed:', error);
    }
}

/**
 * Handle a task being dropped onto a new date list's drop zone.
 * Reads the serialised task ID, deletes it from the source date,
 * and re-creates it under the target date.
 * @param {DragEvent} event
 */
export async function drop(event) {
    event.preventDefault();

    try {
        const rawData = event.dataTransfer.getData('text');
        if (!rawData) return;

        const dragPayload = JSON.parse(rawData);
        const sourceTaskId = dragPayload.value.slice(TASK_ID_OFFSET);
        const sourceDateId = dragPayload.value.slice(DATE_ID_START, DATE_ID_END);
        const targetDateId = event.target.getAttribute('value');

        // Validate both IDs exist and are the same format (10-char date strings)
        if (!targetDateId || !sourceDateId || targetDateId.length !== sourceDateId.length) return;

        await moveTaskBetweenDates(sourceDateId, targetDateId, sourceTaskId);
    } catch (error) {
        console.error('drag.js — drop handler failed:', error);
    }

    document.querySelectorAll('.drag-group').forEach(el => el.style.display = 'none');
}

// ─── Delegated drag-and-drop listeners ───────────────────────

const dateListContainer = document.getElementById('date-list-container');

if (dateListContainer) {
    dateListContainer.addEventListener('dragstart', (e) => {
        const li = e.target.closest('.list-group-item[draggable="true"]');
        if (li && dateListContainer.contains(li)) drag(e);
    });

    dateListContainer.addEventListener('dragover', (e) => {
        const dropZone = e.target.closest('.drag-group-item');
        if (dropZone && dateListContainer.contains(dropZone)) allowDrop(e);
    });

    dateListContainer.addEventListener('drop', (e) => {
        const dropZone = e.target.closest('.drag-group-item');
        if (dropZone && dateListContainer.contains(dropZone)) {
            void drop(e);
        }
    });
}
