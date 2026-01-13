
export class AIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    async chat(history, userMessage, tools) {
        if (!this.apiKey) {
            throw new Error("API Key not set");
        }

        const url = `${this.baseUrl}?key=${this.apiKey}`;

        // Construct the request body
        const contents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: msg.parts // expect parts to be an array of objects
        }));

        // Add the new user message
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        const requestBody = {
            contents: contents,
            tools: [{
                function_declarations: tools
            }]
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Unknown error from Gemini API");
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw error;
        }
    }

    async sendToolResponse(history, functionResponses, tools) {
        if (!this.apiKey) {
            throw new Error("API Key not set");
        }

        const url = `${this.baseUrl}?key=${this.apiKey}`;

        // Construct request body with history (which includes the function call) 
        // and the new function response
        const requestBody = {
            contents: [
                ...history,
                {
                    role: "function",
                    parts: functionResponses
                }
            ],
            tools: [{
                function_declarations: tools
            }]
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Unknown error from Gemini API");
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Gemini API Tool Response Error:", error);
            throw error;
        }
    }
}

export const TOOLS_DEFINITION = [
    {
        name: "create_date_list",
        description: "Create a new to-do list for a specific date.",
        parameters: {
            type: "object",
            properties: {
                date_string: {
                    type: "string",
                    description: "The date for the list (e.g., '2025-01-20'). Format as YYYY-MM-DD if possible."
                },
                date_name: {
                    type: "string",
                    description: "The name of the list (e.g.,'Jan 20, 2025'). Format as MMM DD, YYYY if possible."
                }
            },
            required: ["date_string", "date_name"]
        }
    },
    {
        name: "add_task",
        description: "Add a task to a specific date list. If the list doesn't exist, you should create it first.",
        parameters: {
            type: "object",
            properties: {
                date_string: {
                    type: "string",
                    description: "The date of the list to add the task to."
                },
                task_text: {
                    type: "string",
                    description: "The content of the task."
                }
            },
            required: ["date_string", "task_text"]
        }
    }
];
