import express from "express";
import { codeReviewService } from "../services/code-review.service";
import logger from "../utils/logger";
import { gitlabService } from "../services/gitlab.service";

const router = express.Router();

router.post("/webhook", async (req, res) => {
  try {
    const event = req.headers["x-gitlab-event"];
    logger.info("Received webhook event:", JSON.stringify(req.body));

    if (event !== "Merge Request Hook") {
      return res.status(200).send("Unsupported event type");
    }

    const { object_attributes, project } = req.body;

    if (
      object_attributes &&
      object_attributes.target_branch === "internal" &&
      object_attributes.state === "opened"
    ) {
      const projectId = project.id;
      const mergeRequestIid = object_attributes.iid;

      // Trigger the review_code tool
      const review = await codeReviewService.reviewCode(
        projectId,
        mergeRequestIid
      );

      // Post the overall comment to the merge request
      if (review.overallComment) {
        await gitlabService.addMergeRequestComment(
          projectId,
          mergeRequestIid,
          review.overallComment
        );
      }

      // Post specific comments as discussion threads
      for (const comment of review.specificComments) {
        await gitlabService.createDiscussion(
          projectId,
          mergeRequestIid,
          comment.comment,
          comment.filePath,
          comment.line
        );
      }

      // Approve if score >= 8
      const approved = review.score >= 8;
      if (approved)
        await gitlabService.approveMergeRequest(projectId, mergeRequestIid);

      return res.status(200).json({
        message: "Code review triggered successfully. Action taken.",
        review,
      });
    }

    res.status(200).send("No action taken");
  } catch (error) {
    logger.error("Error handling webhook:", error);
    res.status(200).send({ message: "Error handling webhook", error });
  }
});

export default router;
