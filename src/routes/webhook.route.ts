import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { gitlabService } from '../services/gitlab.service';
import reviewService from '../services/review.service';
import { config } from '../../config/config';

interface WebhookData {
  object_kind: string;
  object_attributes: {
    id: number;
    iid: number;
    action: string;
    state: string;
  };
  project: {
    id: number;
  };
}

const router = Router();

// Webhook endpoint for GitLab merge request events
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookData: WebhookData = req.body;
    const { object_kind, object_attributes, project } = webhookData;

    // Only process merge request events
    if (object_kind !== 'merge_request') {
      return res.status(200).json({ message: 'Not a merge request event' });
    }

    // Only process open/update actions
    if (!['open', 'update'].includes(object_attributes.action)) {
      return res.status(200).json({ message: 'Not an open/update action' });
    }

    // Only process open state
    if (object_attributes.state !== 'opened') {
      return res.status(200).json({ message: 'Not in open state' });
    }

    // Get merge request details
    const mergeRequest = await gitlabService.getMergeRequestDetails(project.id, object_attributes.iid);

    // Analyze the merge request
    const reviewData = await reviewService.analyzeMergeRequest(mergeRequest);

    // Post comments on the merge request
    for (const comment of reviewData.comments) {
      if (comment.position) {
        await gitlabService.postLineComment(
          project.id,
          object_attributes.iid,
          comment.body,
          comment.position.new_path,
          comment.position.new_line
        );
      } else {
        await gitlabService.postComment(project.id, object_attributes.iid, comment.body);
      }
    }

    // Approve the merge request if all checks pass
    if (reviewData.recommendation === 'APPROVE') {
      await gitlabService.approveMergeRequest(project.id, object_attributes.iid);
    }

    res.status(200).json({ message: 'Merge request reviewed successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error processing webhook: ${errorMessage}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Manual review endpoint
router.post('/review', async (req: Request, res: Response) => {
  try {
    const { projectId, mergeRequestIid } = req.body;

    if (!projectId || !mergeRequestIid) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Get merge request details
    const mergeRequest = await gitlabService.getMergeRequestDetails(projectId, mergeRequestIid);

    // Analyze the merge request
    const reviewData = await reviewService.analyzeMergeRequest(mergeRequest);

    // Post comments on the merge request
    for (const comment of reviewData.comments) {
      if (comment.position) {
        await gitlabService.postLineComment(
          projectId,
          mergeRequestIid,
          comment.body,
          comment.position.new_path,
          comment.position.new_line
        );
      } else {
        await gitlabService.postComment(projectId, mergeRequestIid, comment.body);
      }
    }

    // Approve the merge request if all checks pass
    if (reviewData.recommendation === 'APPROVE') {
      await gitlabService.approveMergeRequest(projectId, mergeRequestIid);
    }

    res.status(200).json({ message: 'Merge request reviewed successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error processing manual review: ${errorMessage}`);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Health check route
 */
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export const webhookRouter = router;