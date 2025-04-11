import axios from "axios";

class ChatGptService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.CHATGPT_API_URL || "https://api.openai.com/v1";
    this.apiKey = process.env.CHATGPT_API_KEY || "";

    if (!this.apiKey) {
      throw new Error("CHATGPT_API_KEY environment variable is not set");
    }
  }

  async reviewChanges(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    changes: any[]
  ): Promise<{ approved: boolean; comments: string[] }> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content:
                "You are a code reviewer. Analyze the following changes and provide feedback.",
            },
            {
              role: "user",
              content: JSON.stringify(changes),
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const comments = response.data.choices[0].message.content.split("\n");
      return {
        approved: comments.length === 0,
        comments,
      };
    } catch (error) {
      console.error("Error while communicating with ChatGPT API:", error);
      throw new Error("Failed to review changes using ChatGPT API");
    }
  }
}

export const chatGptService = new ChatGptService();
