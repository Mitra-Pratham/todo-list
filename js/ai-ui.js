
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

// State
let isAIReady = false;

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
    console.log("Chrome AI Debug Report:", diag);

    // Use the robust check from aiService
    const availabilityStatus = await aiService.checkAvailability();
    console.log("Mapped Availability Status:", availabilityStatus);

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

    if (inputField) {
        inputField.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
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

// --- Chat Logic ---

async function handleSendMessage() {
    if (!isAIReady) {
        addMessageToUI("system", "Chrome AI is not ready yet. Please ensure it is enabled in your browser.");
        return;
    }

    const text = inputField.value.trim();
    if (!text) return;

    // Clear input
    inputField.value = "";

    // 1. Add User Message to UI
    addMessageToUI("user", text);

    // 2. Show Typing Indicator
    const typingId = showTypingIndicator();

    try {
        // 3. Call AI Service
        const response = await aiService.chat(text);

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
    console.log("Raw AI Response:", responseText);

    // 1. Extract commands from response
    // Commands are in format {{COMMAND: "arg1", "arg2"}}
    const commandRegex = /\{\{(CREATE_DATE_LIST|ADD_TASK):\s*"([^"]+)",\s*"([^"]+)"\}\}/g;

    let cleanText = responseText;
    let match;
    const commandsToExecute = [];

    while ((match = commandRegex.exec(responseText)) !== null) {
        const [fullMatch, cmdType, arg1, arg2] = match;
        commandsToExecute.push({ type: cmdType, arg1, arg2 });
        console.log("Found Command:", cmdType, "Args:", [arg1, arg2]);
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
        console.log("Executing structured command:", cmd.type, cmd.arg1, cmd.arg2);
        const result = await executeAppAction(cmd.type, cmd.arg1, cmd.arg2);
        // We don't necessarily need to tell the user the internal success, 
        // but we could show a small toast or log it.
        console.log("Action result:", result);
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

            if (window.createTask) {
                await window.createTask(taskText, dateStr, null, "", 1001);
                return `Added task "${taskText}"`;
            }
        }
        return "Unknown or unavailable action";
    } catch (e) {
        console.error("Action Error:", e);
        return "Error: " + e.message;
    }
}


// --- UI Helpers ---

function addMessageToUI(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("ai-message");

    if (sender === "user") msgDiv.classList.add("user-message");
    else if (sender === "assistant") msgDiv.classList.add("assistant-message");
    else msgDiv.classList.add("system-message");

    msgDiv.innerHTML = text.replace(/\n/g, "<br>");

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

// No auto-init footer, handled by main.js
