// ============================================================
// drag.js — Drag-and-drop handlers for moving tasks between dates
// ============================================================

/**
 * Allow a drop target to receive dragged items.
 * @param {DragEvent} event
 */
function allowDrop(event) {
    event.preventDefault();
}

/**
 * Start dragging a task item — serialise its ID into the dataTransfer.
 * @param {DragEvent} event
 */
function drag(event) {
    try {
        const dragPayload = { value: $(event.target).attr('value') };
        event.dataTransfer.setData('text', JSON.stringify(dragPayload));
        $('.drag-group').show();
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
function drop(event) {
    event.preventDefault();

    try {
        const rawData = event.dataTransfer.getData('text');
        if (!rawData) return;

        const dragPayload = JSON.parse(rawData);
        const sourceTaskId = dragPayload.value.slice(16);
        const sourceDateId = dragPayload.value.slice(5, 15);
        const targetDateId = $(event.target).attr('value');

        // Validate both IDs exist and are the same format (10-char date strings)
        if (!targetDateId || !sourceDateId || targetDateId.length !== sourceDateId.length) return;

        const sourceTask = findTask(sourceDateId, sourceTaskId);
        if (!sourceTask) return;

        deleteTasks(sourceDateId, sourceTaskId);
        createTask(sourceTask.name, targetDateId, '', sourceTask.desc, sourceTask.statusCode);
    } catch (error) {
        console.error('drag.js — drop handler failed:', error);
    }

    $('.drag-group').hide();
}