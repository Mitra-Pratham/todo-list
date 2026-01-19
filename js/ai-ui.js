
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
        const ai = window.ai || (typeof LanguageModel !== 'undefined' ? { languageModel: LanguageModel } : null);
        if (ai && ai.languageModel) {
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
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            const files = [];
            for (const item of items) {
                if (item.type.indexOf("image") !== -1) {
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

async function handleImageFiles(files) {
    for (const file of files) {
        if (pendingImages.length >= 5) {
            alert("Maximum 5 images allowed per message.");
            break;
        }
        const referenceImage = new Blob([file], { type: file.type });
        pendingImages.push(referenceImage);
        renderImagePreview(file);
    }
    // Clear input so same file can be selected again
    if (imageInput) imageInput.value = "";
}

function renderImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const div = document.createElement("div");
        div.className = "ai-preview-item";
        div.innerHTML = `
            <img src="${e.target.result}" alt="Preview">
            <button class="ai-preview-remove" title="Remove">&times;</button>
        `;

        div.querySelector(".ai-preview-remove").onclick = () => {
            const index = pendingImages.indexOf(file);
            if (index > -1) pendingImages.splice(index, 1);
            div.remove();
        };

        imagePreviews.appendChild(div);
    };
    reader.readAsDataURL(file);
}

function clearPendingImages() {
    pendingImages = [];
    if (imagePreviews) imagePreviews.innerHTML = "";
}

// --- Chat Logic ---

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

    // 2. Show Typing Indicator
    const typingId = showTypingIndicator();

    try {
        // 3. Call AI Service with multimodal input
        const response = await aiService.chat(text, imagesToSend);

        removeTypingIndicator(typingId);

        if (!response) {
            throw new Error("No response from Chrome AI");
        }

        // 4. Process Response and Parse Commands
        processAIResponse(response);

    } catch (error) {
        removeTypingIndicator(typingId);
        addMessageToUI("system", "Error: " + error.message);
        console.error(error);
    }
}

async function processAIResponse(responseText) {
    // const responseText = response; // Removed this incorrect line

    // 1. Extract commands from response
    // Commands are in format {{COMMAND: "arg1", "arg2"}}
    const commandRegex = /\{\{(CREATE_DATE_LIST|ADD_TASK):\s*"([^"]+)",\s*"([^"]+)"\}\}/g;

    let cleanText = responseText;
    let match;
    const commandsToExecute = [];

    while ((match = commandRegex.exec(responseText)) !== null) {
        const [fullMatch, cmdType, arg1, arg2] = match;
        commandsToExecute.push({ type: cmdType, arg1, arg2 });
        // console.log("Found Command:", cmdType, "Args:", [arg1, arg2]);
        // Remove the command tag from the visible text for the user
        cleanText = cleanText.replace(fullMatch, "");
    }

    if (commandsToExecute.length === 0) {
        console.warn("No structured commands found in AI response.");
    }

    // 2. Add message to UI (cleaned of command tags)
    addMessageToUI("assistant", cleanText.trim());

    // 3. Execute identified commands
    for (const cmd of commandsToExecute) {
        // console.log("Executing structured command:", cmd.type, cmd.arg1, cmd.arg2);
        const result = await executeAppAction(cmd.type, cmd.arg1, cmd.arg2);
        // We don't necessarily need to tell the user the internal success, 
        // but we could show a small toast or log it.
        // console.log("Action result:", result);
    }
}

// --- App Actions (Parsing Fallback for Tool Calling) ---

async function executeAppAction(type, arg1, arg2) {
    const user = getCurrentUser();
    if (!user) {
        addMessageToUI("system", "Please log in to perform actions.");
        return "User not logged in";
    }

    try {
        if (type === "CREATE_DATE_LIST") {
            const dateStr = arg1;
            const dateName = arg2;
            if (window.createDateList) {
                await window.createDateList(dateStr, dateName);
                return `Created list for ${dateName}`;
            }
        } else if (type === "ADD_TASK") {
            const dateStr = arg1;
            const taskText = arg2;

            // Ensure dateStr (YYYY-MM-DD) is treated as local time
            // By adding 'T00:00:00' we avoid the default behavior of parsing YYYY-MM-DD as UTC
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dateName = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            // We'll rely on createDateList's internal check to avoid overwriting
            if (window.createDateList) {
                await window.createDateList(dateStr, dateName);
            }

            await window.createTask(taskText, dateStr, null, "", 1001);
            return `Added task "${taskText}" to ${dateName}`;
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
        textSpan.innerHTML = formatAIResponse(text);
        msgDiv.appendChild(textSpan);
    }

    if (images && images.length > 0) {
        const grid = document.createElement("div");
        grid.className = "ai-image-grid";

        images.forEach(blob => {
            const img = document.createElement("img");
            const reader = new FileReader();
            reader.onload = (e) => img.src = e.target.result;
            reader.readAsDataURL(blob);
            grid.appendChild(img);
        });

        msgDiv.appendChild(grid);
    }

    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const id = "typing-" + Date.now();
    const div = document.createElement("div");
    div.id = id;
    div.className = "typing-indicator ms-2 mb-3";
    div.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatContainer.appendChild(div);
    scrollToBottom();
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Format AI response text with basic markdown and line breaks.
 */
function formatAIResponse(text) {
    if (!text) return "";

    // Bold: **text** -> <strong>text</strong>
    let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
}

// No auto-init footer, handled by main.js
