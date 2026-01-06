import { db } from "./firebase-config.js";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const COLLECTION_NAME = "dateLists";
const NOTES_COLLECTION_NAME = "notes";

export const TodoService = {
    // --- Notes Operations ---

    // Subscribe to real-time notes updates
    subscribeNotes(userId, callback) {
        if (!userId) return;

        const q = query(collection(db, "users", userId, NOTES_COLLECTION_NAME));

        return onSnapshot(q, (snapshot) => {
            const data = [];
            snapshot.forEach((doc) => {
                data.push(doc.data());
            });
            callback(data);
        }, (error) => {
            console.error("Error listening to notes changes: ", error);
        });
    },

    // Create or Update a Note/Page
    async saveNote(userId, note) {
        if (!userId) return;
        try {
            await setDoc(doc(db, "users", userId, NOTES_COLLECTION_NAME, note.id), note);
        } catch (e) {
            console.error("Error saving note: ", e);
            throw e;
        }
    },

    // Delete a Note/Page
    async deleteNote(userId, noteId) {
        if (!userId) return;
        try {
            await deleteDoc(doc(db, "users", userId, NOTES_COLLECTION_NAME, noteId));
        } catch (e) {
            console.error("Error deleting note: ", e);
            throw e;
        }
    },

    // --- Todo Operations ---

    // Subscribe to real-time updates
    subscribe(userId, callback) {
        if (!userId) return;

        const q = query(collection(db, "users", userId, COLLECTION_NAME));

        return onSnapshot(q, (snapshot) => {
            const data = [];
            snapshot.forEach((doc) => {
                data.push(doc.data());
            });
            callback(data);
        }, (error) => {
            console.error("Error listening to changes: ", error);
        });
    },

    // Create or Update a Date List (e.g. "Jan 6, 2025")
    async saveDateList(userId, dateList) {
        if (!userId) return;
        try {
            await setDoc(doc(db, "users", userId, COLLECTION_NAME, dateList.id), dateList);
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e;
        }
    },

    // Delete a Date List
    async deleteDateList(userId, dateListId) {
        if (!userId) return;
        try {
            await deleteDoc(doc(db, "users", userId, COLLECTION_NAME, dateListId));
        } catch (e) {
            console.error("Error deleting document: ", e);
            throw e;
        }
    },

    // Add a task to a specific Date List
    async addTask(userId, dateId, task) {
        if (!userId) return;
        const docRef = doc(db, "users", userId, COLLECTION_NAME, dateId);

        try {
            // We need to read the current document to append to the array
            // Firestore arrayUnion is simpler but doesn't support updating items easily later
            // So we'll read-modify-write for now, which is safer for this data structure
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                data.taskList.push(task);
                await setDoc(docRef, data);
            }
        } catch (e) {
            console.error("Error adding task: ", e);
            throw e;
        }
    },

    // Update a task
    async updateTask(userId, dateId, taskId, updates) {
        if (!userId) return;
        const docRef = doc(db, "users", userId, COLLECTION_NAME, dateId);

        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const taskIndex = data.taskList.findIndex(t => t.id.endsWith(taskId));
                if (taskIndex > -1) {
                    data.taskList[taskIndex] = { ...data.taskList[taskIndex], ...updates };
                    await setDoc(docRef, data);
                }
            }
        } catch (e) {
            console.error("Error updating task: ", e);
            throw e;
        }
    },

    // Delete a task
    async deleteTask(userId, dateId, taskId) {
        if (!userId) return;
        const docRef = doc(db, "users", userId, COLLECTION_NAME, dateId);

        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                data.taskList = data.taskList.filter(t => !t.id.endsWith(taskId));
                await setDoc(docRef, data);
            }
        } catch (e) {
            console.error("Error deleting task: ", e);
            throw e;
        }
    }
};
