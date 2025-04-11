import axios from "axios";

interface ReviewResult {
  score: number; // 0–10
  overallComment: string; // Single comment for the merge request
  specificComments: Array<{
    filePath: string;
    line: number;
    comment: string;
  }>; // Comments for discussion threads
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async reviewChanges(changes: any[]): Promise<ReviewResult> {
    const content = JSON.stringify(changes);
    if (content.length > 30000) {
      return {
        score: 0,
        overallComment:
          "The changeset is too large to review effectively. Score: 0",
        specificComments: [],
      };
    }
    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `
                You are a code reviewer. Analyze the provided code changes and return:
                1. A score (0–10) based on code quality, naming, and standards.
                2. A single overall comment summarizing the review.
                3. Specific comments (if any) for individual changes, including file path, line number, and comment text.
                Return the response as a JSON object with fields: score, overallComment, specificComments (array of { filePath, line, comment }).
                If no specific comments are needed, return an empty specificComments array.
              `,
            },
            {
              role: "user",
              content: content,
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

      const result = JSON.parse(response.data.choices[0].message.content);
      return {
        score: result.score,
        overallComment: `${result.overallComment} Score: ${result.score}`,
        specificComments: result.specificComments || [],
      };
    } catch (error) {
      console.error("Error while communicating with ChatGPT API:", error);
      throw new Error("Failed to review changes using ChatGPT API");
    }
  }
}

export const chatGptService = new ChatGptService();
