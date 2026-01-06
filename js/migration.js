import { TodoService } from "./todo-service.js";

const MIGRATION_KEY = 'todo_app_migrated';
const TASKS_DB_NAME = 'TasksDB';
const TASKS_STORE_NAME = 'tasksData';
const NOTES_DB_NAME = 'NotesDB';
const NOTES_STORE_NAME = 'notesData';

export function getIndexedDBData(dbName, storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onerror = (event) => {
            console.warn(`Could not open ${dbName}. It might not exist.`);
            resolve([]); // Resolve with empty array if DB doesn't exist
        };

        request.onsuccess = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                console.warn(`Store ${storeName} not found in ${dbName}.`);
                resolve([]);
                return;
            }

            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
                resolve(getAllRequest.result);
            };

            getAllRequest.onerror = () => {
                reject(getAllRequest.error);
            };
        };

        // Handle upgrade needed (if DB doesn't exist, this might trigger)
        request.onupgradeneeded = (event) => {
            event.target.transaction.abort();
            resolve([]);
        };
    });
}

export async function hasLocalData() {
    const tasks = await getIndexedDBData(TASKS_DB_NAME, TASKS_STORE_NAME);
    const notes = await getIndexedDBData(NOTES_DB_NAME, NOTES_STORE_NAME);
    return tasks.length > 0 || notes.length > 0;
}

export async function getLocalTasks() {
    return await getIndexedDBData(TASKS_DB_NAME, TASKS_STORE_NAME);
}

export async function getLocalNotes() {
    return await getIndexedDBData(NOTES_DB_NAME, NOTES_STORE_NAME);
}

async function migrateTasks(userId) {
    console.log('Migrating tasks...');
    const tasks = await getLocalTasks();

    if (tasks.length === 0) {
        console.log('No tasks to migrate.');
        return;
    }

    const promises = tasks.map(dateList => {
        let dateListId = dateList.id;
        if (typeof dateListId !== 'string') {
            dateListId = String(dateListId);
        }

        const cleanDateList = {
            id: dateListId,
            name: dateList.name,
            taskList: dateList.taskList || [],
            statusCode: dateList.statusCode || 1001
        };

        return TodoService.saveDateList(userId, cleanDateList);
    });

    await Promise.all(promises);
    console.log(`Migrated ${tasks.length} date lists.`);
}

async function migrateNotes(userId) {
    console.log('Migrating notes...');
    const notes = await getLocalNotes();

    if (notes.length === 0) {
        console.log('No notes to migrate.');
        return;
    }

    const promises = notes.map(note => {
        let noteId = note.id;
        if (typeof noteId !== 'string') {
            noteId = String(noteId);
        }

        const cleanNote = {
            id: noteId,
            html: note.html || '', // Fixed: was note.content
            name: note.name || 'Untitled',
            status: note.status || 1001
        };

        return TodoService.saveNote(userId, cleanNote);
    });

    await Promise.all(promises);
    console.log(`Migrated ${notes.length} notes.`);
}

export async function migrateData(userId) {
    if (localStorage.getItem(MIGRATION_KEY) === 'true') {
        console.log('Migration already performed.');
        return;
    }

    console.log('Starting migration...');

    try {
        await migrateTasks(userId);
        await migrateNotes(userId);

        // Cleanup local data
        console.log("Cleaning up local data...");
        await clearLocalData();

        localStorage.setItem(MIGRATION_KEY, 'true');
        console.log('Migration completed successfully!');
        return true; // Indicate success
    } catch (error) {
        console.error('Migration failed:', error);
        alert('Migration failed: ' + error.message);
        return false;
    }
}

function deleteDatabase(dbName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
            console.warn(`Delete of ${dbName} blocked.`);
            // We can't easily force close other connections here, so we just warn.
            // In a perfect world, we'd close the app's own connections first.
            resolve();
        };
    });
}

export async function clearLocalData() {
    try {
        await deleteDatabase(TASKS_DB_NAME);
        await deleteDatabase(NOTES_DB_NAME);
        console.log("Local databases deleted.");
    } catch (e) {
        console.error("Error clearing local data:", e);
    }
}
