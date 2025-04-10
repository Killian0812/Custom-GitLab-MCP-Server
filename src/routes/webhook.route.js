const express = require('express');
const codeReviewService = require('../services/code-review.service');
const gitlabService = require('../services/gitlab.service');
const logger = require('../utils/logger');
const config = require('../../config/config');

const router = express.Router();

/**
 * Route for GitLab webhook
 */
router.post('/gitlab', async (req, res) => {
  try {
    // Verify GitLab webhook token
    const token = req.headers['x-gitlab-token'];
    if (!gitlabService.verifyWebhookSignature(token, config.gitlab.webhookSecret)) {
      logger.warn('Invalid GitLab webhook token');
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Process the webhook asynchronously
    process.nextTick(async () => {
      try {
        await codeReviewService.handleMergeRequestWebhook(req.body);
      } catch (error) {
        logger.error(`Error processing webhook: ${error.message}`);
      }
    });

    // Respond immediately
    return res.status(202).json({ message: 'Webhook received and being processed' });
  } catch (error) {
    logger.error(`Error in webhook route: ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Route to manually trigger a code review
 */
router.post('/review', async (req, res) => {
  try {
    const { projectId, mergeRequestIid } = req.body;
    
    if (!projectId || !mergeRequestIid) {
      return res.status(400).json({ message: 'projectId and mergeRequestIid are required' });
    }
    
    // Process the review asynchronously
    process.nextTick(async () => {
      try {
        await codeReviewService.reviewMergeRequest(projectId, mergeRequestIid);
      } catch (error) {
        logger.error(`Error processing manual review: ${error.message}`);
      }
    });
    
    // Respond immediately
    return res.status(202).json({ 
      message: 'Review request received and being processed',
      projectId,
      mergeRequestIid,
    });
  } catch (error) {
    logger.error(`Error in manual review route: ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Health check route
 */
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;