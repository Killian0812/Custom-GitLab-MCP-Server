import axios from "axios";

class ClaudeService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.CLAUDE_API_URL || "https://api.claude.ai/v1";
    this.apiKey = process.env.CLAUDE_API_KEY || "";

    if (!this.apiKey) {
      throw new Error("CLAUDE_API_KEY environment variable is not set");
    }
  }

  async reviewChanges(
    changes: any[]
  ): Promise<{ approved: boolean; comments: string[] }> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/review`,
        { changes },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error while communicating with Claude API:", error);
      throw new Error("Failed to review changes using Claude API");
    }
  }
}

export const claudeService = new ClaudeService();
