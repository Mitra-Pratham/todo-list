
import { AIService, TOOLS_DEFINITION } from "./ai-service.js";
import { getCurrentUser } from "./auth.js";

// Initialize AI Service
const aiService = new AIService(localStorage.getItem("gemini_api_key") || "");

// UI Elements
const chatContainer = document.getElementById("ai-chat-messages");
const inputField = document.getElementById("ai-input");
const sendButton = document.getElementById("ai-send-btn");
const apiKeyInput = document.getElementById("gemini-api-key");
const saveApiKeyBtn = document.getElementById("save-api-key");

// State
let chatHistory = [];
// Chat history format for Gemini API: { role: 'user'|'model'|'function', parts: [...] }

// --- Initialization ---

export function initAIUI() {
    if (localStorage.getItem("gemini_api_key")) {
        apiKeyInput.value = localStorage.getItem("gemini_api_key");
    }

    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener("click", () => {
            const key = apiKeyInput.value.trim();
            if (key) {
                localStorage.setItem("gemini_api_key", key);
                aiService.setApiKey(key);
                alert("API Key saved!");
            }
        });
    }

    if (sendButton) {
        sendButton.addEventListener("click", handleSendMessage);
    }

    if (inputField) {
        inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }
}

// --- Chat Logic ---

async function handleSendMessage() {
    const text = inputField.value.trim();
    if (!text) return;

    // Clear input
    inputField.value = "";

    // 0. Initialize System Context if new chat
    if (chatHistory.length === 0) {
        const today = new Date();
        const dateString = today.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        chatHistory.push({
            role: "user",
            parts: [{ text: `System Context: Today's date is ${dateString}. Use this to resolve relative dates like "today", "tomorrow", "next Monday", etc.` }]
        });
        chatHistory.push({
            role: "model",
            parts: [{ text: `Understood. Today is ${dateString}.` }]
        });
    }

    // 1. Add User Message to UI and History
    addMessageToUI("user", text);
    chatHistory.push({ role: "user", parts: [{ text: text }] });

    // 2. Show Typing Indicator
    const typingId = showTypingIndicator();

    try {
        // 3. Call AI Service
        const responseData = await aiService.chat(chatHistory.slice(0, -1), text, TOOLS_DEFINITION); // Send previous history + current msg

        removeTypingIndicator(typingId);

        if (!responseData.candidates || responseData.candidates.length === 0) {
            throw new Error("No response from AI");
        }

        const candidate = responseData.candidates[0];
        const modelParts = candidate.content.parts;

        // 4. Process Response
        await processModelResponse(modelParts);

    } catch (error) {
        removeTypingIndicator(typingId);
        let errorMsg = error.message;
        if (errorMsg.includes("quota") || errorMsg.includes("429")) {
            errorMsg = "⚠️ **Rate Limit Exceeded**<br>You are sending messages too quickly for the free tier. Please wait a minute and try again.";
        } else {
            errorMsg = "Error: " + errorMsg;
        }
        addMessageToUI("system", errorMsg);
        console.error(error);
    }
}

async function processModelResponse(parts) {
    if (!parts || parts.length === 0) {
        return;
    }

    // Add model response to history
    chatHistory.push({ role: "model", parts: parts });

    // Check for function calls
    // Handle case where parts might be undefined or missing specific fields
    const functionCalls = parts.filter(part => part.functionCall);
    const textParts = parts.filter(part => part.text).map(p => p.text).join("\n");

    if (textParts) {
        addMessageToUI("assistant", textParts);
    }

    if (functionCalls.length > 0) {
        // Handle Tool Calls
        const typingId = showTypingIndicator();
        try {
            const functionResponses = [];

            for (const call of functionCalls) {
                const fnCall = call.functionCall;
                console.log("Executing tool:", fnCall.name, fnCall.args);

                const result = await executeTool(fnCall.name, fnCall.args);

                functionResponses.push({
                    functionResponse: {
                        name: fnCall.name,
                        response: { result: result }
                    }
                });
            }

            removeTypingIndicator(typingId);

            // SAVE the function response to history so the conversation state is valid for future turns
            chatHistory.push({
                role: "function",
                parts: functionResponses
            });

            // Send tool outputs back to model
            // We pass chatHistory.slice(0, -1) because sendToolResponse appends the last function response itself
            // and we just added it to chatHistory. 
            // Alternatively, we could just pass chatHistory WITHOUT the new item, but we needed to save it.
            // So: save it first, then slice it out for the call.
            const responseData = await aiService.sendToolResponse(chatHistory.slice(0, -1), functionResponses, TOOLS_DEFINITION);

            if (!responseData.candidates || responseData.candidates.length === 0) {
                throw new Error("No response after tool execution");
            }

            const candidate = responseData.candidates[0];
            await processModelResponse(candidate.content.parts);

        } catch (error) {
            removeTypingIndicator(typingId);
            addMessageToUI("system", "Error executing action: " + error.message);
        }
    }
}

// --- Tool Execution ---

async function executeTool(name, args) {
    const user = getCurrentUser();
    if (!user) {
        return "Error: User not logged in. Please ask the user to log in first.";
    }

    try {
        if (name === "create_date_list") {
            const dateStr = args.date_string;
            const dateName = args.date_name;
            // Use the global window.createDateList helper which handles the object structure and services
            if (window.createDateList) {
                await window.createDateList(dateStr, dateName);
                return `Successfully created list for ${dateName} (${dateStr})`;
            } else {
                return "Error: createDateList function not found in window";
            }

        } else if (name === "add_task") {
            const dateStr = args.date_string;
            const taskText = args.task_text;

            // Use global window.createTask helper
            if (window.createTask) {
                // createTask(taskName, dateID, el, desc, statusCode)
                // We pass null for 'el' since there's no UI element triggering this directly
                await window.createTask(taskText, dateStr, null, "", 1001);
                return `Successfully added task "${taskText}" to list ${dateStr}`;
            } else {
                return "Error: createTask function not found in window";
            }
        }

        return "Error: Unknown tool";
    } catch (e) {
        return `Error executing tool ${name}: ${e.message}`;
    }
}


// --- UI Helpers ---

function addMessageToUI(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("ai-message");

    if (sender === "user") msgDiv.classList.add("user-message");
    else if (sender === "assistant") msgDiv.classList.add("assistant-message");
    else msgDiv.classList.add("system-message");

    // Simple markdown-ish rendering for code blocks if needed, but for now just text
    // Replace newlines with <br>
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
