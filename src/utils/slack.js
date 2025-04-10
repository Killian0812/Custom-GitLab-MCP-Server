const axios = require('axios');
const logger = require('./logger');
const config = require('../../config/config');

/**
 * Send a message to Slack
 * @param {Object} message - Message to send 
 * @returns {Promise<void>}
 */
const sendMessage = async (message) => {
  if (!config.slack.webhookUrl) {
    logger.warn('Slack webhook URL not configured, skipping notification');
    return;
  }

  try {
    await axios.post(config.slack.webhookUrl, message);
    logger.info('Slack notification sent successfully');
  } catch (error) {
    logger.error(`Error sending Slack notification: ${error.message}`);
  }
};

/**
 * Send an error message to Slack
 * @param {string} errorMessage - Error message to send
 * @returns {Promise<void>}
 */
const sendErrorMessage = async (errorMessage) => {
  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 GitLab MR Reviewer Error',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:* ${errorMessage}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Time:* ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  await sendMessage(message);
};

/**
 * Send a success notification about a completed review
 * @param {Object} reviewData - Data about the completed review
 * @returns {Promise<void>}
 */
const sendReviewCompletedNotification = async (reviewData) => {
  const { projectId, mergeRequestIid, recommendation } = reviewData;
  
  // Set emoji based on recommendation
  let emoji = '✅';
  if (recommendation === 'APPROVE WITH MINOR CHANGES') {
    emoji = '⚠️';
  } else if (recommendation === 'REQUEST CHANGES') {
    emoji = '❌';
  }
  
  const message = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} GitLab MR Review Completed`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Project ID:* ${projectId}\n*Merge Request:* !${mergeRequestIid}\n*Recommendation:* ${recommendation}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Time:* ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  await sendMessage(message);
};

module.exports = {
  sendMessage,
  sendErrorMessage,
  sendReviewCompletedNotification,
};