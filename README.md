# GitLab MR Reviewer

An AI-powered GitLab Merge Request code reviewer that integrates with Anthropic's Claude models to provide automated code reviews and checklist compliance evaluation.

## Features

- Automatically reviews code when a merge request is opened or updated
- Analyzes code for style, quality, security issues, and best practices
- Evaluates MRs against a customized checklist based on team standards
- Provides detailed feedback on each file
- Gives an overall assessment with a final recommendation (APPROVE, APPROVE WITH MINOR CHANGES, REQUEST CHANGES)
- Can be triggered manually or via GitLab webhooks
- Sends notifications to Slack (optional)

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- GitLab account with API access
- Anthropic Claude API key

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd gitlab-mr-reviewer
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Copy the example environment file and update it with your configuration:
   ```
   cp .env.example .env
   ```

   Edit the `.env` file with your GitLab and Claude credentials.

## Configuration

Update the `.env` file with the following variables:

```
# GitLab Configuration
GITLAB_API_URL=https://gitlab.example.com/api/v4
GITLAB_PRIVATE_TOKEN=your_private_token_here
GITLAB_WEBHOOK_SECRET=your_webhook_secret_here

# Anthropic Claude Configuration
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-3-opus-20240229

# Application Configuration
PORT=3000
NODE_ENV=development

# Logging Configuration
LOG_LEVEL=info

# Slack Notification (optional)
SLACK_WEBHOOK_URL=your_slack_webhook_url_here
```

## MR Checklist

The tool evaluates merge requests against the following checklist:

1. Diff description is clear and complete
2. Trello card is linked
3. Version has been increased in version.json
4. Trello card has proper description
5. Proto files are updated if needed
6. Error handling with try-catch is properly implemented, with Slack notifications where appropriate
7. Functions are not over 50 lines (or have explanation if they are)
8. Merge request focuses on a single purpose (logic change or refactoring)
9. Null checks are implemented where needed (using lodash or other methods)
10. Code is concise and not unnecessarily verbose
11. Lambda functions are used instead of 1-2 loops where appropriate
12. Early returns are used where possible
13. Promise.all() is not used (as per team guidelines)
14. Localization strings are not mixed with code

These checklist items are customized based on the team's standards and are automatically evaluated for each merge request.

## Usage

### Starting the Service

```
npm start
```

For development with auto-reload:

```
npm run dev
```

### Setting Up GitLab Webhook

1. Go to your GitLab project or group
2. Navigate to Settings > Webhooks
3. Add a new webhook with the following settings:
   - URL: `https://your-server.com/api/gitlab`
   - Secret Token: The same value as `GITLAB_WEBHOOK_SECRET` in your `.env` file
   - Trigger: Check "Merge request events"
4. Click "Add webhook"

### Manually Triggering a Review

You can manually trigger a review by making a POST request to:

```
POST /api/review
Content-Type: application/json

{
  "projectId": 123,
  "mergeRequestIid": 456
}
```

## Code Review Process

When a merge request is created or updated, the service:

1. Fetches the merge request details from GitLab
2. Gets the list of changed files
3. Reviews each file using Claude
4. Evaluates the changes against the team's checklist
5. Provides an overall assessment of the changes
6. Posts comments on the merge request with the review findings and checklist compliance
7. Optionally approves the merge request if no issues are found
8. Sends a notification to Slack with the review status

## Claude Models

This project supports various Claude models:
- `claude-3-opus-20240229` (default) - Highest performance, most thorough code reviews
- `claude-3-sonnet-20240229` - Good balance of performance and speed
- `claude-3-haiku-20240307` - Fastest, but less comprehensive reviews

You can specify which model to use in the `.env` file.

## Customizing the Checklist

You can customize the checklist to match your team's standards by editing the `MR_CHECKLIST` constant in `src/services/claude.service.js`. The checklist evaluation functions can also be customized to better match your specific requirements.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.