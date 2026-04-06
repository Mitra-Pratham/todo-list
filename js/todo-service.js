// ============================================================
// todo-service.js — Firestore CRUD for date-lists, tasks & notes
// ============================================================

import { db } from "./firebase-config.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/** Firestore sub-collection name for to-do date lists */
const DATE_LISTS_COLLECTION = "dateLists";

/** Firestore sub-collection name for notes pages */
const NOTES_COLLECTION = "notes";

/**
 * Helper — returns a Firestore DocumentReference for a date list.
 * @param {string} userId
 * @param {string} dateId - e.g. "2026-04-06"
 */
const dateListRef = (userId, dateId) =>
    doc(db, "users", userId, DATE_LISTS_COLLECTION, dateId);

export const TodoService = {

    // ─── Notes Operations ────────────────────────────────────

    /**
     * Subscribe to real-time notes updates.
     * @param {string} userId
     * @param {Function} callback - receives an array of note objects
     * @returns {Function|undefined} Unsubscribe function
     */
    subscribeNotes(userId, callback) {
        if (!userId) return;

        const notesQuery = query(collection(db, "users", userId, NOTES_COLLECTION));

        return onSnapshot(notesQuery, (snapshot) => {
            const notes = [];
            snapshot.forEach((docSnap) => {
                notes.push(docSnap.data());
            });
            callback(notes);
        }, (error) => {
            console.error("TodoService.subscribeNotes — snapshot error:", error);
        });
    },

    /**
     * Create or update a note/page.
     * @param {string} userId
     * @param {{id: string, name: string, status: number, html: string}} note
     */
    async saveNote(userId, note) {
        if (!userId) return;
        try {
            await setDoc(doc(db, "users", userId, NOTES_COLLECTION, note.id), note);
        } catch (error) {
            console.error("TodoService.saveNote — failed:", error);
            throw error;
        }
    },

    /**
     * Delete a note/page.
     * @param {string} userId
     * @param {string} noteId
     */
    async deleteNote(userId, noteId) {
        if (!userId) return;
        try {
            await deleteDoc(doc(db, "users", userId, NOTES_COLLECTION, noteId));
        } catch (error) {
            console.error("TodoService.deleteNote — failed:", error);
            throw error;
        }
    },

    // ─── Todo Operations ─────────────────────────────────────

    /**
     * Subscribe to real-time date-list updates.
     * @param {string} userId
     * @param {Function} callback - receives an array of date-list objects
     * @returns {Function|undefined} Unsubscribe function
     */
    subscribe(userId, callback) {
        if (!userId) return;

        const listsQuery = query(collection(db, "users", userId, DATE_LISTS_COLLECTION));

        return onSnapshot(listsQuery, (snapshot) => {
            const dateLists = [];
            snapshot.forEach((docSnap) => {
                dateLists.push(docSnap.data());
            });
            callback(dateLists);
        }, (error) => {
            console.error("TodoService.subscribe — snapshot error:", error);
        });
    },

    /**
     * Get a single date list by ID.
     * @param {string} userId
     * @param {string} dateListId
     * @returns {Promise<Object|null>}
     */
    async getDateList(userId, dateListId) {
        if (!userId) return null;
        try {
            const docSnap = await getDoc(dateListRef(userId, dateListId));
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error) {
            console.error("TodoService.getDateList — failed:", error);
            throw error;
        }
    },

    /**
     * Create or overwrite a date list document.
     * @param {string} userId
     * @param {{id: string, name: string, taskList: Array, statusCode: number}} dateList
     */
    async saveDateList(userId, dateList) {
        if (!userId) return;
        try {
            await setDoc(dateListRef(userId, dateList.id), dateList);
        } catch (error) {
            console.error("TodoService.saveDateList — failed:", error);
            throw error;
        }
    },

    /**
     * Delete a date list document.
     * @param {string} userId
     * @param {string} dateListId
     */
    async deleteDateList(userId, dateListId) {
        if (!userId) return;
        try {
            await deleteDoc(dateListRef(userId, dateListId));
        } catch (error) {
            console.error("TodoService.deleteDateList — failed:", error);
            throw error;
        }
    },

    /**
     * Add a single task to a date list (read-modify-write).
     * @param {string} userId
     * @param {string} dateId
     * @param {{id: string, name: string, statusCode: number, desc: string}} task
     */
    async addTask(userId, dateId, task) {
        if (!userId) return;
        const ref = dateListRef(userId, dateId);

        try {
            const docSnap = await getDoc(ref);
            if (docSnap.exists()) {
                const dateList = docSnap.data();
                dateList.taskList.push(task);
                await setDoc(ref, dateList);
            }
        } catch (error) {
            console.error("TodoService.addTask — failed:", error);
            throw error;
        }
    },

    /**
     * Update fields on a single task inside a date list (read-modify-write).
     * @param {string} userId
     * @param {string} dateId
     * @param {string} taskId - the suffix portion of the full task ID
     * @param {Object} updates - key/value pairs to merge into the task
     */
    async updateTask(userId, dateId, taskId, updates) {
        if (!userId) return;
        const ref = dateListRef(userId, dateId);

        try {
            const docSnap = await getDoc(ref);
            if (docSnap.exists()) {
                const dateList = docSnap.data();
                const taskIndex = dateList.taskList.findIndex((t) => t.id.endsWith(taskId));
                if (taskIndex !== -1) {
                    dateList.taskList[taskIndex] = { ...dateList.taskList[taskIndex], ...updates };
                    await setDoc(ref, dateList);
                }
            }
        } catch (error) {
            console.error("TodoService.updateTask — failed:", error);
            throw error;
        }
    },

    /**
     * Delete a single task from a date list (read-modify-write).
     * @param {string} userId
     * @param {string} dateId
     * @param {string} taskId - the suffix portion of the full task ID
     */
    async deleteTask(userId, dateId, taskId) {
        if (!userId) return;
        const ref = dateListRef(userId, dateId);

        try {
            const docSnap = await getDoc(ref);
            if (docSnap.exists()) {
                const dateList = docSnap.data();
                dateList.taskList = dateList.taskList.filter((t) => !t.id.endsWith(taskId));
                await setDoc(ref, dateList);
            }
        } catch (error) {
            console.error("TodoService.deleteTask — failed:", error);
            throw error;
        }
    },

    /**
     * Batch-update multiple tasks within a single date list in ONE Firestore write.
     * Reads the document once, applies all updates, writes once — avoids N separate
     * snapshot triggers when marking many tasks done, etc.
     *
     * @param {string} userId
     * @param {string} dateId
     * @param {Array<{taskId: string, updates: Object}>} taskUpdates
     *        Each entry: { taskId (suffix), updates: { statusCode, name, … } }
     */
    async batchUpdateTasks(userId, dateId, taskUpdates) {
        if (!userId || !taskUpdates?.length) return;
        const ref = dateListRef(userId, dateId);

        try {
            const docSnap = await getDoc(ref);
            if (!docSnap.exists()) return;

            const dateList = docSnap.data();

            for (const { taskId, updates } of taskUpdates) {
                const index = dateList.taskList.findIndex((t) => t.id.endsWith(taskId));
                if (index !== -1) {
                    dateList.taskList[index] = { ...dateList.taskList[index], ...updates };
                }
            }

            await setDoc(ref, dateList);
        } catch (error) {
            console.error("TodoService.batchUpdateTasks — failed:", error);
            throw error;
        }
    },

    /**
     * Batch-delete multiple tasks within a single date list in ONE Firestore write.
     *
     * @param {string} userId
     * @param {string} dateId
     * @param {Array<string>} taskIds - array of task ID suffixes to remove
     */
    async batchDeleteTasks(userId, dateId, taskIds) {
        if (!userId || !taskIds?.length) return;
        const ref = dateListRef(userId, dateId);

        try {
            const docSnap = await getDoc(ref);
            if (!docSnap.exists()) return;

            const dateList = docSnap.data();
            const idsToRemove = new Set(taskIds);
            dateList.taskList = dateList.taskList.filter((t) => {
                const suffix = t.id.slice(16);
                return !idsToRemove.has(suffix);
            });

            await setDoc(ref, dateList);
        } catch (error) {
            console.error("TodoService.batchDeleteTasks — failed:", error);
            throw error;
        }
    }
};
