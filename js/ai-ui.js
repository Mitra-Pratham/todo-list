
import { AIService } from "./ai-service.js";
import { getCurrentUser } from "./auth.js";

// Initialize AI Service
const aiService = new AIService();

// UI Elements
const chatContainer = document.getElementById("ai-chat-messages");
const inputField = document.getElementById("ai-input");
const sendButton = document.getElementById("ai-send-btn");
const statusText = document.getElementById("ai-status-text");
const progressContainer = document.getElementById("ai-progress-container");
const progressBar = document.getElementById("ai-progress-bar");
const initBtnContainer = document.getElementById("ai-init-btn-container");
const initBtn = document.getElementById("ai-init-btn");
const imageInput = document.getElementById("ai-image-input");
const imageBtn = document.getElementById("image-upload-btn") || document.getElementById("ai-image-btn");
const imagePreviews = document.getElementById("ai-image-previews");
const resetBtn = document.getElementById("ai-reset-btn");

// State
let isAIReady = false;
let pendingImages = []; // Array of Blobs/Files

// --- Diagnostics Helper ---
async function getDetailedDiagnostics() {
    const report = {
        userAgent: navigator.userAgent,
        protocol: window.location.protocol,
        isSecureContext: window.isSecureContext,
        aiObject: !!window.ai,
        languageModelObject: !!(window.ai && window.ai.languageModel),
        globalLanguageModel: typeof LanguageModel !== 'undefined',
        modelObject: !!window.model,
        chromeAIObject: !!(window.chrome && window.chrome.ai),
        capabilities: null,
        availability: null,
        error: null
    };

    try {
        const ai = window.ai ?? (typeof LanguageModel !== 'undefined' ? { languageModel: LanguageModel } : null);
        if (ai?.languageModel) {
            if (typeof ai.languageModel.capabilities === 'function') {
                report.capabilities = await ai.languageModel.capabilities();
            }
            if (typeof ai.languageModel.availability === 'function') {
                report.availability = await ai.languageModel.availability();
            }
        }
    } catch (e) {
        report.error = e.message;
    }

    return report;
}

// --- Initialization ---

export async function initAIUI() {
    // 1. Origin Check (Secure Context)
    if (window.location.protocol === 'file:') {
        statusText.innerHTML = "<span class='text-danger'>Insecure Origin.</span> Chrome AI requires a local server (localhost) to run. Opening as a file will not work.";
        addMessageToUI("system", "<strong>Tip:</strong> Please run this app through a local web server (e.g. VS Code Live Server or Python -m http.server) to enable Chrome AI.");
        isAIReady = false;
        return;
    }

    const diag = await getDetailedDiagnostics();

    // Use the robust check from aiService
    const availabilityStatus = await aiService.checkAvailability();

    if (availabilityStatus === 'no') {
        // If it's no, but diag shows we have something, it might be a hardware/model issue
        if (diag.languageModelObject || diag.globalLanguageModel) {
            const errorMsg = diag.error ? `<br>Error: ${diag.error}` : "";
            statusText.innerHTML = `<span class='text-danger'>AI not available.</span> Check components.${errorMsg}`;
            addMessageToUI("system", "<strong>Crucial Step:</strong><br>1. Visit <code>chrome://components</code><br>2. Find <strong>Optimization Guide On Device Model</strong><br>3. Click <strong>Check for update</strong><br>4. Restart Chrome.");
        } else {
            statusText.innerHTML = "<span class='text-danger'>API Missing.</span> Chrome AI flags are likely not enabled.";
            addMessageToUI("system", "<strong>Troubleshooting:</strong><br>1. Go to <code>chrome://flags</code><br>2. Enable <strong>Prompt API for Gemini Nano</strong><br>3. Enable <strong>Enables optimization guide on-device model</strong> (Set to 'Enabled BypassPerfRequirement')<br>4. Restart Chrome.");
        }
        isAIReady = false;
        return;
    } else if (availabilityStatus === 'after-download') {
        statusText.innerHTML = "<span class='text-warning'>AI model required.</span> Click below to download.";
        initBtnContainer.classList.remove("d-none");
        isAIReady = false;
    } else {
        statusText.innerHTML = "<span class='text-success'>● Chrome AI Online</span>";
        isAIReady = true;
        try {
            await aiService.initSession();
        } catch (e) {
            statusText.innerText = "Error initializing AI session.";
        }
    }

    // Use property assignment instead of EventListener to avoid duplication
    if (sendButton) {
        sendButton.onclick = handleSendMessage;
    }

    if (imageBtn) {
        imageBtn.onclick = () => imageInput.click();
    }

    if (imageInput) {
        imageInput.onchange = (e) => handleImageFiles(e.target.files);
    }

    if (inputField) {
        inputField.onpaste = (e) => {
            const items = (e.clipboardData ?? e.originalEvent?.clipboardData)?.items;
            if (!items) return;
            const files = [];
            for (const item of items) {
                if (item.type.startsWith("image")) {
                    files.push(item.getAsFile());
                }
            }
            if (files.length > 0) {
                handleImageFiles(files);
            }
        };

        inputField.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        };
    }

    if (resetBtn) {
        resetBtn.onclick = async () => {
            if (confirm("Reset AI conversation history to fix any errors?")) {
                try {
                    await aiService.destroy(); // This will force a new session on next message
                    chatContainer.innerHTML = `
                        <div class="ai-message system-message text-muted small text-center mb-3">
                            Conversation history cleared. System prompt refreshed. How can I help you?
                        </div>
                    `;
                    pendingImages = [];
                    imagePreviews.innerHTML = "";
                    inputField.value = "";
                } catch (e) {
                    console.error("Reset failed:", e);
                }
            }
        };
    }

    if (initBtn) {
        initBtn.onclick = async () => {
            initBtn.disabled = true;
            initBtn.innerText = "Starting Download...";
            progressContainer.classList.remove("d-none");

            try {
                await aiService.initSession((loaded, total) => {
                    const progress = Math.round((loaded / total) * 100);
                    progressBar.style.width = `${progress}%`;
                    statusText.innerText = `Downloading Model: ${progress}%`;
                });

                isAIReady = true;
                initBtnContainer.classList.add("d-none");
                progressContainer.classList.add("d-none");
                statusText.innerHTML = "<span class='text-success'>● Chrome AI Online</span>";
                addMessageToUI("system", "Chrome AI model is now ready. How can I help you?");
            } catch (error) {
                statusText.innerHTML = `<span class='text-danger'>Download Failed: ${error.message}</span>`;
                initBtn.disabled = false;
                initBtn.innerText = "Retry Download";
            }
        };
    }
}

// --- Image Handling Helpers ---

function handleImageFiles(files) {
    for (const file of files) {
        if (pendingImages.length >= 5) {
            alert("Maximum 5 images allowed per message.");
            break;
        }
        pendingImages.push(file);
        renderImagePreview(file);
    }
    // Clear input so same file can be selected again
    if (imageInput) imageInput.value = "";
}

function renderImagePreview(file) {
    const objectUrl = URL.createObjectURL(file);
    const div = document.createElement("div");
    div.className = "ai-preview-item";
    div.innerHTML = `
        <img src="${objectUrl}" alt="Preview">
        <button class="ai-preview-remove" title="Remove">&times;</button>
    `;

    div.querySelector(".ai-preview-remove").onclick = () => {
        const index = pendingImages.indexOf(file);
        if (index > -1) pendingImages.splice(index, 1);
        URL.revokeObjectURL(objectUrl);
        div.remove();
    };

    imagePreviews.appendChild(div);
}

function clearPendingImages() {
    pendingImages = [];
    if (imagePreviews) {
        imagePreviews.querySelectorAll("img").forEach(img => {
            if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
        });
        imagePreviews.innerHTML = "";
    }
}

// --- Sanitization Helpers ---

/**
 * Escape HTML entities to prevent XSS when inserting into innerHTML.
 */
function sanitizeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Strip dangerous characters from AI-generated task names before passing to app functions.
 */
function sanitizeTaskInput(str) {
    if (!str) return "";
    return str.replace(/[<>"]/g, "");
}

// --- Chat Logic ---

/**
 * Create an empty assistant message bubble for streaming text into.
 */
function createAssistantBubble() {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("ai-message", "assistant-message");

    // Typing indicator shown until first chunk arrives
    const typingDiv = document.createElement("div");
    typingDiv.className = "typing-indicator";
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    msgDiv.appendChild(typingDiv);

    const textSpan = document.createElement("span");
    textSpan.classList.add("d-none");
    msgDiv.appendChild(textSpan);

    chatContainer.appendChild(msgDiv);
    scrollToBottom();
    return { msgDiv, textSpan, typingDiv };
}

async function handleSendMessage() {
    if (!isAIReady) {
        addMessageToUI("system", "Chrome AI is not ready yet. Please ensure it is enabled in your browser.");
        return;
    }

    const text = inputField.value.trim();
    const imagesToSend = [...pendingImages];

    if (!text && imagesToSend.length === 0) return;

    // Clear UI inputs
    inputField.value = "";
    clearPendingImages();

    // 1. Add User Message to UI
    addMessageToUI("user", text, imagesToSend);

    // 2. Create assistant bubble for streaming (shows typing dots)
    const { msgDiv, textSpan, typingDiv } = createAssistantBubble();

    try {
        // 3. Stream AI response into the bubble
        const fullResponse = await aiService.chatStream(text, imagesToSend, (chunk) => {
            // Swap typing indicator for text on first chunk
            if (!typingDiv.classList.contains("d-none")) {
                typingDiv.classList.add("d-none");
                textSpan.classList.remove("d-none");
            }
            textSpan.innerHTML = formatAIResponse(chunk);
            scrollToBottom();
        });

        if (!fullResponse) {
            throw new Error("No response from Chrome AI");
        }

        // 4. Process final response — strip commands from display and execute them
        await processAIResponse(fullResponse, textSpan);

    } catch (error) {
        typingDiv.classList.add("d-none");
        textSpan.classList.remove("d-none");
        textSpan.innerHTML = formatAIResponse("Error: " + error.message);
        msgDiv.classList.remove("assistant-message");
        msgDiv.classList.add("system-message");
        console.error(error);
    }
}

async function processAIResponse(responseText, textSpan) {
    // Regex patterns for all command types
    const cmd3Args = /\{\{(UPDATE_TASK):\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\}\}/g;
    const cmd2Args = /\{\{(CREATE_DATE_LIST|ADD_TASK|MARK_DONE|MOVE_DATE_LIST):\s*"([^"]+)",\s*"([^"]+)"\}\}/g;
    const cmd1Arg = /\{\{(MARK_ALL_DONE):\s*"([^"]+)"\}\}/g;

    const commandsToExecute = [];

    // Extract 3-arg commands (UPDATE_TASK)
    for (const [, cmdType, arg1, arg2, arg3] of responseText.matchAll(cmd3Args)) {
        commandsToExecute.push({ type: cmdType, arg1, arg2, arg3 });
    }

    // Extract 2-arg commands (CREATE_DATE_LIST, ADD_TASK, MARK_DONE)
    for (const [, cmdType, arg1, arg2] of responseText.matchAll(cmd2Args)) {
        commandsToExecute.push({ type: cmdType, arg1, arg2 });
    }

    // Extract 1-arg commands (MARK_ALL_DONE)
    for (const [, cmdType, arg1] of responseText.matchAll(cmd1Arg)) {
        commandsToExecute.push({ type: cmdType, arg1 });
    }

    // Strip all command tags from display text in one pass
    const allCmdRegex = /\{\{(?:CREATE_DATE_LIST|ADD_TASK|UPDATE_TASK|MARK_DONE|MARK_ALL_DONE|MOVE_DATE_LIST):[^}]*\}\}/g;
    const cleanText = responseText.replace(allCmdRegex, "").trim();

    // Update the displayed message with cleaned text
    if (textSpan) {
        textSpan.innerHTML = formatAIResponse(cleanText);
    }

    // Execute commands — batch-deduplicate createDateList calls per response
    const ensuredDates = new Set();
    for (const cmd of commandsToExecute) {
        await executeAppAction(cmd.type, cmd.arg1, cmd.arg2, cmd.arg3, ensuredDates);
    }
}

// --- App Actions ---

async function executeAppAction(type, arg1, arg2, arg3, ensuredDates) {
    const user = getCurrentUser();
    if (!user) {
        addMessageToUI("system", "Please log in to perform actions.");
        return "User not logged in";
    }

    try {
        if (type === "CREATE_DATE_LIST") {
            const dateStr = arg1;
            const dateName = sanitizeTaskInput(arg2);
            if (window.createDateList) {
                await window.createDateList(dateStr, dateName);
                ensuredDates?.add(dateStr);
                return `Created list for ${dateName}`;
            }
        } else if (type === "ADD_TASK") {
            const dateStr = arg1;
            const taskText = sanitizeTaskInput(arg2);

            // Ensure dateStr (YYYY-MM-DD) is treated as local time
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dateName = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // Batch-deduplicate: only ensure date list once per response
            if (window.createDateList && !ensuredDates?.has(dateStr)) {
                await window.createDateList(dateStr, dateName);
                ensuredDates?.add(dateStr);
            }

            await window.createTask(taskText, dateStr, null, "", 1001);
            return `Added task "${taskText}" to ${dateName}`;
        } else if (type === "UPDATE_TASK") {
            const dateStr = arg1;
            const oldName = arg2;
            const newName = sanitizeTaskInput(arg3);

            const taskInfo = window.findTaskByName?.(dateStr, oldName);
            if (taskInfo) {
                await window.updateTasks(taskInfo.dateID, taskInfo.taskID, newName, '', '');
                return `Renamed "${oldName}" to "${newName}"`;
            }
            return `Task "${oldName}" not found on ${dateStr}`;
        } else if (type === "MARK_DONE") {
            const dateStr = arg1;
            const taskName = arg2;

            const taskInfo = window.findTaskByName?.(dateStr, taskName);
            if (taskInfo) {
                await window.updateTasks(taskInfo.dateID, taskInfo.taskID, '', 1004, '');
                return `Marked "${taskName}" as done`;
            }
            return `Task "${taskName}" not found on ${dateStr}`;
        } else if (type === "MARK_ALL_DONE") {
            const dateStr = arg1;
            if (window.markAllAsDone) {
                await window.markAllAsDone(dateStr);
                return `Marked all tasks on ${dateStr} as done`;
            }
        } else if (type === "MOVE_DATE_LIST") {
            const sourceDate = arg1;
            const targetDate = arg2;

            // Look up source tasks from the global taskArray
            const sourceDateList = window.taskArray?.find(d => d.id === sourceDate);
            if (!sourceDateList?.taskList?.length) {
                return `No tasks found on ${sourceDate} to move`;
            }

            // Ensure target date list exists
            const targetObj = new Date(targetDate + 'T00:00:00');
            const targetName = targetObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (window.createDateList) {
                await window.createDateList(targetDate, targetName);
            }

            // Copy each task to the target date
            for (const task of sourceDateList.taskList) {
                await window.createTask(task.name, targetDate, null, task.desc || "", task.statusCode || 1001);
            }

            // Delete the source date list
            if (window.deleteDateList) {
                await window.deleteDateList(sourceDate);
            }

            return `Moved ${sourceDateList.taskList.length} tasks from ${sourceDate} to ${targetDate}`;
        }
        return "Unknown or unavailable action";
    } catch (e) {
        console.error("Action Error:", e);
        return "Error: " + e.message;
    }
}


// --- UI Helpers ---

/**
 * Add a message bubble to the chat container.
 * @param {'user'|'assistant'|'system'} sender 
 * @param {string} text 
 * @param {Blob[]} images - Optional images to display
 */
function addMessageToUI(sender, text, images = []) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("ai-message");

    if (sender === "user") msgDiv.classList.add("user-message");
    else if (sender === "assistant") msgDiv.classList.add("assistant-message");
    else msgDiv.classList.add("system-message");

    if (text) {
        const textSpan = document.createElement("span");
        // System messages contain trusted HTML; user/assistant text is sanitized via formatAIResponse
        textSpan.innerHTML = sender === "system" ? text : formatAIResponse(text);
        msgDiv.appendChild(textSpan);
    }

    if (images?.length > 0) {
        const grid = document.createElement("div");
        grid.className = "ai-image-grid";

        for (const blob of images) {
            const img = document.createElement("img");
            img.src = URL.createObjectURL(blob);
            grid.appendChild(img);
        }

        msgDiv.appendChild(grid);
    }

    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Format AI response text with basic markdown and line breaks.
 * Escapes HTML entities first to prevent XSS.
 */
function formatAIResponse(text) {
    if (!text) return "";

    // Escape HTML entities first
    let formatted = sanitizeHTML(text);

    // Bold: **text** -> <strong>text</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
}

// No auto-init footer, handled by main.js
