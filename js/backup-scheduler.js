// ============================================================
// backup-scheduler.js — Daily auto-backup via File System Access API
// ============================================================

import { TodoService } from "./todo-service.js";
import { buildTaskCsvRows, stringifyCSV, getLocalDateInputValue } from "./task-helpers.js";

/** @type {string} localStorage key — whether auto-backup is enabled */
const LS_ENABLED_KEY = 'auto-backup-enabled';

/** @type {string} localStorage key — last backup date (YYYY-MM-DD) */
const LS_LAST_DATE_KEY = 'auto-backup-last-date';

/** IndexedDB database / store for persisting the directory handle across sessions */
const BACKUP_DB_NAME = 'BackupDB';
const BACKUP_STORE_NAME = 'backupConfig';
const DIR_HANDLE_KEY = 'backup-dir-handle';

// ─── IndexedDB Helpers (directory handle persistence) ────────

/**
 * Open (or create) the BackupDB IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openBackupDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(BACKUP_DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = /** @type {IDBOpenDBRequest} */ (e.target).result;
            if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
                db.createObjectStore(BACKUP_STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(/** @type {IDBOpenDBRequest} */ (e.target).result);
        request.onerror = (e) => reject(/** @type {IDBOpenDBRequest} */ (e.target).error);
    });
}

/**
 * Store a FileSystemDirectoryHandle in IndexedDB so it survives page reloads.
 * @param {FileSystemDirectoryHandle} handle
 * @returns {Promise<void>}
 */
async function storeDirHandle(handle) {
    const db = await openBackupDB();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
            tx.objectStore(BACKUP_STORE_NAME).put(handle, DIR_HANDLE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

/**
 * Retrieve the persisted FileSystemDirectoryHandle from IndexedDB.
 * @returns {Promise<FileSystemDirectoryHandle|null>}
 */
async function getDirHandle() {
    let db;
    try {
        db = await openBackupDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE_NAME, 'readonly');
            const req = tx.objectStore(BACKUP_STORE_NAME).get(DIR_HANDLE_KEY);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.error('backup-scheduler — getDirHandle failed:', error);
        return null;
    } finally {
        db?.close();
    }
}

/**
 * Remove the persisted directory handle from IndexedDB (used on disable).
 * @returns {Promise<void>}
 */
async function clearDirHandle() {
    let db;
    try {
        db = await openBackupDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE_NAME, 'readwrite');
            tx.objectStore(BACKUP_STORE_NAME).delete(DIR_HANDLE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error('backup-scheduler — clearDirHandle failed:', error);
    } finally {
        db?.close();
    }
}

// ─── Internal Helpers ────────────────────────────────────────

/**
 * Check whether auto-backup is enabled in localStorage.
 * Uses strict `=== 'true'` to avoid truthy coercion on string values.
 * @returns {boolean}
 */
function isEnabled() {
    return localStorage.getItem(LS_ENABLED_KEY) === 'true';
}

/**
 * Determine if a backup is due right now.
 * True when auto-backup is enabled AND the last-backup date differs from today.
 * @returns {boolean}
 */
function isBackupDue() {
    if (!isEnabled()) return false;
    const lastDate = localStorage.getItem(LS_LAST_DATE_KEY) ?? '';
    return lastDate !== getLocalDateInputValue();
}

/**
 * Build the CSV content string from all date lists in IndexedDB.
 * @returns {Promise<{csv: string, count: number}>} csv content and date-list count
 */
async function buildCsvContent() {
    const dateLists = await TodoService.getAllDateLists();
    if (!dateLists.length) return { csv: '', count: 0 };
    const csvRows = buildTaskCsvRows(dateLists);
    return { csv: stringifyCSV(csvRows), count: dateLists.length };
}

/**
 * Write a CSV file into the user's chosen backup directory via the
 * File System Access API. Returns false if the handle is missing or
 * permission was revoked so the caller can fall back.
 * @param {string} csvContent
 * @param {string} fileName
 * @returns {Promise<boolean>} true if written via directory handle
 */
async function writeToDirectory(csvContent, fileName) {
    const dirHandle = await getDirHandle();
    if (!dirHandle) return false;

    try {
        // queryPermission does not require a user gesture
        const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') return false;

        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();
        return true;
    } catch (error) {
        console.warn('backup-scheduler — directory write failed, will fallback:', error);
        return false;
    }
}

/**
 * Fallback download via a temporary anchor element.
 * Used when the stored directory handle is missing or permission was revoked.
 * @param {string} csvContent
 * @param {string} fileName
 */
function downloadViaAnchor(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Run the backup: build CSV, write to the chosen directory (or fallback
 * download), then stamp today's date. Silently logs errors — never shows
 * UI toasts for background work.
 * @returns {Promise<void>}
 */
async function runBackup() {
    try {
        const { csv, count } = await buildCsvContent();
        if (!count) {
            console.info('backup-scheduler — skipped: no date lists to back up.');
            return;
        }

        const fileName = 'todo-backup.csv';
        const written = await writeToDirectory(csv, fileName);

        if (!written) {
            downloadViaAnchor(csv, fileName);
        }

        localStorage.setItem(LS_LAST_DATE_KEY, getLocalDateInputValue());
        console.info(`backup-scheduler — auto-backup saved: ${fileName} (${written ? 'directory' : 'download'})`);
    } catch (error) {
        console.error('backup-scheduler — runBackup failed:', error);
    }
}

/**
 * Set the visual state and tooltip of the auto-backup toggle button.
 * Adds/removes `.auto-backup-active` and updates the `.btn-title` span
 * to show active status + the backup folder name.
 * @returns {Promise<void>}
 */
async function updateBackupIcon() {
    const btn = document.getElementById('auto-backup-btn');
    if (!btn) return;

    const enabled = isEnabled();
    btn.classList.toggle('auto-backup-active', enabled);

    const titleSpan = btn.querySelector('.btn-title');
    if (!titleSpan) return;

    if (!enabled) {
        titleSpan.textContent = 'Auto Backup';
        return;
    }

    // Show the folder name from the stored directory handle
    try {
        const dirHandle = await getDirHandle();
        const folderName = dirHandle?.name ?? 'unknown';
        titleSpan.textContent = `Auto Backup: ON \u2014 /${folderName}/`;
    } catch {
        titleSpan.textContent = 'Auto Backup: ON';
    }
}

// ─── Exported API ────────────────────────────────────────────

/**
 * Initialise the auto-backup scheduler.
 * Called once from `initApp()` after the UI has rendered.
 * - Syncs the toggle icon to the persisted state.
 * - Runs a backup immediately if one is due.
 * - Registers a `visibilitychange` listener for sub-24 h day-boundary crossings
 *   (the refresh-worker reloads after 24 h, but a shorter absence can still
 *   span midnight).
 * @returns {Promise<void>}
 */
export async function initAutoBackup() {
    await updateBackupIcon();

    if (isBackupDue()) {
        await runBackup();
    }

    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && isBackupDue()) {
            await runBackup();
        }
    });
}

/**
 * Toggle auto-backup on/off.
 * When enabling: opens a native directory picker (startIn: 'downloads') so
 * the user picks or creates a subfolder for backups. Chrome blocks top-level
 * system folders (Downloads, Documents, etc.) but allows any subfolder within
 * them. The directory handle is persisted in IndexedDB; subsequent daily
 * backups overwrite todo-backup.csv inside the chosen folder.
 * If the user cancels the picker, the toggle is aborted.
 * When disabling: clears the stored directory handle.
 * @returns {Promise<void>}
 */
export async function toggleAutoBackup() {
    const newState = !isEnabled();

    if (newState) {
        // Opens inside Downloads so the user can pick/create a subfolder
        /** @type {FileSystemDirectoryHandle} */
        let dirHandle;
        try {
            dirHandle = await window.showDirectoryPicker({
                id: 'todo-backup',
                mode: 'readwrite',
                startIn: 'downloads',
            });
        } catch (error) {
            // User cancelled the picker or API unavailable — abort enable
            console.info('backup-scheduler — directory picker cancelled or unavailable:', error.name);
            return;
        }

        try {
            await storeDirHandle(dirHandle);
        } catch (error) {
            console.error('backup-scheduler — failed to persist directory handle:', error);
            return;
        }

        localStorage.setItem(LS_ENABLED_KEY, 'true');
        await updateBackupIcon();
        await runBackup();
    } else {
        localStorage.setItem(LS_ENABLED_KEY, 'false');
        await clearDirHandle();
        await updateBackupIcon();
    }
}
