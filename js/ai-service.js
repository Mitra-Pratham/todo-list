
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
                console.log("Chrome AI availability() status:", status);
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
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const todayISO = new Date().toISOString().split('T')[0];
            const tomorrowDate = new Date();
            tomorrowDate.setDate(tomorrowDate.getDate() + 1);
            const tomorrowISO = tomorrowDate.toISOString().split('T')[0];
            const tomorrowName = tomorrowDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });


            const options = {
                systemPrompt: `You are a helpful to-do list assistant.
                Today's date is ${today} & today's ISO date is ${todayISO}.
                
                CRITICAL INSTRUCTION: If the user asks you to add a task or create a list, you MUST include a structured command tag at the very end of your response.
                
                The tags are:
                - {{CREATE_DATE_LIST: "YYYY-MM-DD", "Name of Date"}}
                - {{ADD_TASK: "YYYY-MM-DD", "Task Description"}}
                
                You MUST use the exact YYYY-MM-DD format for dates. For "today", use "${todayISO}".
                Actions will ONLY happen if you include these tags.`,

                initialPrompts: [
                    { role: 'user', content: 'Add a task to buy eggs today' },
                    { role: 'assistant', content: `I've added "buy eggs" to your tasks for today. {{ADD_TASK: "${todayISO}", "buy eggs"}}` },
                    { role: 'user', content: 'Create a list for January 25 for "Project Launch"' },
                    { role: 'assistant', content: `I've created a new date list for January 25th. {{CREATE_DATE_LIST: "2026-01-25", "Sunday, January 25, 2026"}}` },
                    { role: 'user', content: 'Create a list for tomorrow for "Project Launch"' },
                    { role: 'assistant', content: `I've created a new date list for tomorrow. {{CREATE_DATE_LIST: "${tomorrowISO}", "${tomorrowName}"}}` },
                    { role: 'user', content: 'Add "Prepare slides" to the January 25th list' },
                    { role: 'assistant', content: `Added "Prepare slides" to your list for January 25th. {{ADD_TASK: "2026-01-25", "Prepare slides"}}` }
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
        } catch (error) {
            console.error("Failed to create Chrome AI session:", error);
            throw error;
        }
    }

    /**
     * Chat with the AI.
     * @param {string} userMessage - The latest user message
     */
    async chat(userMessage) {
        if (!this.session) {
            await this.initSession();
        }

        try {
            const response = await this.session.prompt(userMessage);
            return response;
        } catch (error) {
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
