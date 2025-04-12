import express from "express";
import { codeReviewService } from "../services/code-review.service";

const router = express.Router();

router.post("/webhook", async (req, res) => {
  try {
    const event = req.headers["x-gitlab-event"];

    if (event !== "Merge Request Hook") {
      return res.status(400).send("Unsupported event type");
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
      const reviewResult = await codeReviewService.reviewCode(
        projectId,
        mergeRequestIid
      );

      return res.status(200).json({
        message: "Code review triggered successfully",
        reviewResult,
      });
    }

    res.status(200).send("No action taken");
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
