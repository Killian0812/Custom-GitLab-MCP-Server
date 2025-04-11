import { Router, Request, Response } from 'express';
import * as codeReviewService from '../services/code-review.service';
import * as gitlabService from '../services/gitlab.service';
import logger from '../utils/logger';
import { config } from '../../config/config';
import { GitLabWebhookData } from '../types/gitlab.types';

interface ReviewRequestBody {
  projectId: number;
  mergeRequestIid: number;
}

export const router = Router();

/**
 * Route for GitLab webhook
 */
router.post('/gitlab', (req: Request, res: Response): void => {
  try {
    // Verify GitLab webhook token
    const token = req.headers['x-gitlab-token'] as string;
    if (!gitlabService.verifyWebhookSignature(token, config.gitlab.webhookSecret)) {
      logger.warn('Invalid GitLab webhook token');
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    // Process the webhook asynchronously
    void (async (): Promise<void> => {
      try {
        await codeReviewService.handleMergeRequestWebhook(req.body as GitLabWebhookData);
      } catch (error) {
        logger.error(
          `Error processing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    })();

    // Respond immediately
    res.status(202).json({ message: 'Webhook received and being processed' });
  } catch (error) {
    logger.error(
      `Error in webhook route: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Route to manually trigger a code review
 */
router.post('/review', (req: Request<unknown, unknown, ReviewRequestBody>, res: Response): void => {
  try {
    const { projectId, mergeRequestIid } = req.body;

    if (!projectId || !mergeRequestIid) {
      res.status(400).json({ message: 'projectId and mergeRequestIid are required' });
      return;
    }

    // Process the review asynchronously
    void (async (): Promise<void> => {
      try {
        await codeReviewService.reviewMergeRequest(projectId, mergeRequestIid);
      } catch (error) {
        logger.error(
          `Error processing manual review: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    })();

    // Respond immediately
    res.status(202).json({
      message: 'Review request received and being processed',
      projectId,
      mergeRequestIid,
    });
  } catch (error) {
    logger.error(
      `Error in manual review route: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Health check route
 */
router.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
});
