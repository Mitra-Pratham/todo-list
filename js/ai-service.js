
export class AIService {
    constructor() {
        this.session = null;
    }

    /**
     * Check if Chrome AI is available and ready.
     * @returns {Promise<string>} - 'no', 'readily', or 'after-download'
     */
    async checkAvailability() {
        const ai = window.ai || (typeof LanguageModel !== 'undefined' ? { languageModel: LanguageModel } : null);

        if (!ai || !ai.languageModel) {
            return 'no';
        }

        try {
            // New static availability() method (Chrome 140+)
            if (typeof ai.languageModel.availability === 'function') {
                const status = await ai.languageModel.availability();
                if (status === 'available') return 'readily';
                if (status === 'downloadable' || status === 'downloading') return 'after-download';
                return 'no';
            }

            // Older capabilities() method
            if (typeof ai.languageModel.capabilities === 'function') {
                const capabilities = await ai.languageModel.capabilities();
                return capabilities.available;
            }
        } catch (e) {
            console.error("AI availability check failed:", e);
        }

        return 'no';
    }

    /**
     * Initialize a new chat session.
     * @param {Function} onProgress - Callback for download progress (loaded, total)
     */
    async initSession(onProgress) {
        if (this.session) return;

        const ai = window.ai || (typeof LanguageModel !== 'undefined' ? { languageModel: LanguageModel } : null);

        if (!ai || !ai.languageModel) {
            throw new Error("Chrome AI API not found.");
        }

        try {
            // Use local date for everything to avoid UTC-mismatch discrepancies
            const now = new Date();
            const today = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const todayISO = now.toLocaleDateString('en-CA'); // Gets YYYY-MM-DD in local time

            const tomorrowDate = new Date(now);
            tomorrowDate.setDate(now.getDate() + 1);
            const tomorrowISO = tomorrowDate.toLocaleDateString('en-CA');
            const tomorrowName = tomorrowDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });


            // Dummy 1x1 pixel image for few-shot examples
            const dummyImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
            const dummyBlob = await (await fetch(`data:image/png;base64,${dummyImageBase64}`)).blob();

            const options = {
                systemPrompt: `You are a helpful to-do list assistant.
                Today's date is ${today}.
                Current ISO date: ${todayISO}.
                Tomorrow's date will be ${tomorrowName} (${tomorrowISO}).
                
                CRITICAL INSTRUCTION: If the user asks you to add a task or create a list, you MUST include a structured command tag at the very end of your response.
                
                The tags are:
                - {{CREATE_DATE_LIST: "YYYY-MM-DD", "Name of Date"}}
                - {{ADD_TASK: "YYYY-MM-DD", "Task Description"}}
                
                You MUST use the exact YYYY-MM-DD format for dates. For "today", use ${todayISO}. For "tomorrow", use ${tomorrowISO}.
                Actions will ONLY happen if you include these tags.`,

                initialPrompts: [
                    { role: 'user', content: [{ type: 'text', value: 'Add a task to buy eggs today' }] },
                    { role: 'assistant', content: [{ type: 'text', value: `I've added "buy eggs" to your tasks for today. {{ADD_TASK: "${todayISO}", "buy eggs"}}` }] },
                    { role: 'user', content: [{ type: 'text', value: 'Create a list for January 25 for "Project Launch"' }] },
                    { role: 'assistant', content: [{ type: 'text', value: `I've created a new date list for January 25th. {{CREATE_DATE_LIST: "2026-01-25", "Sunday, January 25, 2026"}}` }] },
                    { role: 'user', content: [{ type: 'text', value: 'Create a list for tomorrow for "Project Launch"' }] },
                    { role: 'assistant', content: [{ type: 'text', value: `I've created a new date list for tomorrow. {{CREATE_DATE_LIST: "${tomorrowISO}", "${tomorrowName}"}}` }] },
                    { role: 'user', content: [{ type: 'text', value: 'Add "Prepare slides" to the January 25th list' }] },
                    { role: 'assistant', content: [{ type: 'text', value: `Added "Prepare slides" to your list for January 25th. {{ADD_TASK: "2026-01-25", "Prepare slides"}}` }] },
                    { role: 'user', content: [{ type: 'text', value: 'Add tasks to buy milk, walk dog, and read book today' }] },
                    { role: 'assistant', content: [{ type: 'text', value: `I've added those items to your list. {{ADD_TASK: "${todayISO}", "buy milk"}} {{ADD_TASK: "${todayISO}", "walk dog"}} {{ADD_TASK: "${todayISO}", "read book"}}` }] },
                    { role: 'user', content: [{ type: 'text', value: 'Extract tasks from this image for today' }, { type: 'image', value: dummyBlob }] },
                    { role: 'assistant', content: [{ type: 'text', value: `I see a list of items. I'll add them for you. {{ADD_TASK: "${todayISO}", "Buy groceries"}} {{ADD_TASK: "${todayISO}", "Call mom"}} {{ADD_TASK: "${todayISO}", "Schedule dentist"}}` }] }
                ],
                expectedInputs: [
                    { type: "text", languages: ["en"] },
                    // { type: "audio" },
                    { type: "image" },
                ],
                expectedOutputs: [{ type: "text", languages: ["en"] }]

            };

            if (onProgress) {
                options.monitor = (m) => {
                    m.addEventListener("downloadprogress", (e) => {
                        onProgress(e.loaded, e.total);
                    });
                };
            }

            this.session = await ai.languageModel.create(options);
        } catch (error) {
            console.error("Failed to create Chrome AI session:", error);
            throw error;
        }
    }

    /**
     * Chat with the AI.
     * @param {string} userMessage - The latest user message
     * @param {Blob[]} images - Optional array of image Blobs
     */
    async chat(userMessage, images = [], isRetry = false) {
        if (!this.session) {
            await this.initSession();
        }

        try {
            const content = [];

            // Add images if any
            if (images && images.length > 0) {
                for (const blob of images) {
                    content.push({ type: 'image', value: blob });
                }
            }

            // Add text part
            if (userMessage) {
                content.push({ type: 'text', value: userMessage });
            }

            // Always use the explicit structure for consistency in multimodal sessions
            const result = await this.session.prompt([{
                role: 'user',
                content: content
            }]);

            // Handle different potential return types from Prompt API
            const responseText = typeof result === 'string' ? result : (result.response || JSON.stringify(result));
            return responseText;
        } catch (error) {
            // Check for session destruction error and retry once
            if (!isRetry && (error.name === 'InvalidStateError' || error.message.includes('destroyed'))) {
                console.warn("Session expired or destroyed. Re-initializing and retrying...");
                this.session = null;
                // Recursive retry with isRetry = true
                return this.chat(userMessage, images, true);
            }

            console.error("Chrome AI Prompt Error:", error);
            throw error;
        }
    }

    /**
     * Destroy session to free up resources.
     */
    async destroy() {
        if (this.session) {
            this.session.destroy();
            this.session = null;
        }
    }
}

// Exporting dummy TOOLS for architecture consistency, though we use structured prompting here
export const TOOLS_DEFINITION = [];
