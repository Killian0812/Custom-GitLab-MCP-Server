import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file in the root directory
dotenv.config();

interface Config {
  env: string;
  port: number;
  gitlab: {
    apiUrl: string;
    privateToken: string;
    webhookSecret: string;
  };
  claude: {
    apiKey: string;
    model: string;
  };
  logger: {
    level: string;
  };
  slack: {
    webhookUrl: string;
  };
}

export const config: Config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  gitlab: {
    apiUrl: process.env.GITLAB_API_URL ?? '',
    privateToken: process.env.GITLAB_PRIVATE_TOKEN ?? '',
    webhookSecret: process.env.GITLAB_WEBHOOK_SECRET ?? '',
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY ?? '',
    model: process.env.CLAUDE_MODEL ?? 'claude-3-opus-20240229',
  },
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL ?? '',
  },
};
