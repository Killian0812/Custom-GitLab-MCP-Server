const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  gitlab: {
    apiUrl: process.env.GITLAB_API_URL,
    privateToken: process.env.GITLAB_PRIVATE_TOKEN,
    webhookSecret: process.env.GITLAB_WEBHOOK_SECRET,
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
};