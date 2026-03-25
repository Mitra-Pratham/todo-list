
export class AIService {
    constructor() {
        this.session = null;
        this.#sessionDate = null;
    }

    #sessionDate;

    /**
     * Resolve the Chrome AI LanguageModel API entry point.
     * @returns {{ languageModel: object } | null}
     */
    #getAI() {
        return window.ai
            ?? (typeof LanguageModel !== 'undefined' ? { languageModel: LanguageModel } : null);
    }

    /**
     * Check if Chrome AI is available and ready.
     * @returns {Promise<string>} - 'no', 'readily', or 'after-download'
     */
    async checkAvailability() {
        const ai = this.#getAI();

        if (!ai?.languageModel) {
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

        const ai = this.#getAI();

        if (!ai?.languageModel) {
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

            const options = {
                systemPrompt: `You are a helpful to-do list assistant.
Today: ${today} (${todayISO}). Tomorrow: ${tomorrowName} (${tomorrowISO}).

You MUST include command tags at the end of your response when the user asks to manage tasks.
Always use YYYY-MM-DD dates. For "today" use ${todayISO}, for "tomorrow" use ${tomorrowISO}.

Available commands:
{{CREATE_DATE_LIST: "YYYY-MM-DD", "Name of Date"}}
{{ADD_TASK: "YYYY-MM-DD", "Task Description"}}
{{UPDATE_TASK: "YYYY-MM-DD", "Old Task Name", "New Task Name"}}
{{MARK_DONE: "YYYY-MM-DD", "Task Name"}}
{{MARK_ALL_DONE: "YYYY-MM-DD"}}
{{MOVE_DATE_LIST: "SOURCE-YYYY-MM-DD", "TARGET-YYYY-MM-DD"}}

MOVE_DATE_LIST copies all tasks from the source date to the target date, then removes the source list.
You can use multiple tags in one response. If a user sends an image, extract tasks from it and use ADD_TASK tags.
Actions ONLY happen if you include these tags.`,

                initialPrompts: [
                    { role: 'user', content: 'Add a task to buy eggs today and create a list for tomorrow' },
                    { role: 'assistant', content: `Done! {{ADD_TASK: "${todayISO}", "buy eggs"}} {{CREATE_DATE_LIST: "${tomorrowISO}", "${tomorrowName}"}}` },
                    { role: 'user', content: 'Move today\'s tasks to tomorrow' },
                    { role: 'assistant', content: `Moved all tasks from today to tomorrow. {{MOVE_DATE_LIST: "${todayISO}", "${tomorrowISO}"}}` }
                ]
            };

            if (onProgress) {
                options.monitor = (m) => {
                    m.addEventListener("downloadprogress", (e) => {
                        onProgress(e.loaded, e.total);
                    });
                };
            }

            this.session = await ai.languageModel.create(options);
            this.#sessionDate = todayISO;
        } catch (error) {
            console.error("Failed to create Chrome AI session:", error);
            throw error;
        }
    }

    /**
     * Stream a chat response from the AI, invoking onChunk with each partial result.
     * @param {string} userMessage - The latest user message
     * @param {Blob[]} images - Optional array of image Blobs
     * @param {(chunk: string) => void} onChunk - Called with the cumulative text so far
     * @returns {Promise<string>} The complete response text
     */
    async chatStream(userMessage, images = [], onChunk = null, isRetry = false) {
        // Auto-recreate session if the date has changed (avoids stale "today" in system prompt)
        const currentDate = new Date().toLocaleDateString('en-CA');
        if (this.session && this.#sessionDate !== currentDate) {
            console.info("Date changed since session creation, refreshing session...");
            this.session.destroy();
            this.session = null;
        }

        if (!this.session) {
            await this.initSession();
        }

        try {
            // Build the prompt input — pass content directly, not wrapped in [{role, content}]
            let promptInput;

            if (images?.length > 0) {
                const content = images.map(blob => ({ type: 'image', value: blob }));
                if (userMessage) {
                    content.push({ type: 'text', value: userMessage });
                }
                promptInput = content;
            } else {
                promptInput = userMessage;
            }

            // Try streaming first, fall back to non-streaming prompt on failure
            try {
                const stream = this.session.promptStreaming(promptInput);
                let fullText = '';

                for await (const chunk of stream) {
                    fullText += chunk;
                    onChunk?.(fullText);
                }

                return fullText;
            } catch (streamError) {
                console.warn("promptStreaming failed, falling back to prompt():", streamError.message);
                const result = await this.session.prompt(promptInput);
                const responseText = typeof result === 'string' ? result : (result?.response ?? JSON.stringify(result));
                onChunk?.(responseText);
                return responseText;
            }
        } catch (error) {
            // Check for session destruction error and retry once
            if (!isRetry && (error.name === 'InvalidStateError' || error.message?.includes('destroyed'))) {
                console.warn("Session expired or destroyed. Re-initializing and retrying...");
                this.session = null;
                return this.chatStream(userMessage, images, onChunk, true);
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
