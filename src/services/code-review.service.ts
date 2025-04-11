import logger from '../utils/logger';
import slack from '../utils/slack';
import { gitlabService } from './gitlab.service';
import claudeService from './claude.service';
import { ReviewData, FileReview, ChecklistResult } from '../types/review.types';
import { GitLabFileChange, GitLabMergeRequest } from '../types/gitlab.types';

const getFileExtension = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  return extension;
};

const shouldReviewFile = (file: GitLabFileChange): boolean => {
  const extension = getFileExtension(file.new_path);
  const excludedExtensions = ['md', 'txt', 'json', 'lock', 'png', 'jpg', 'jpeg', 'gif', 'svg'];
  return !excludedExtensions.includes(extension);
};

const reviewFile = async (
  projectId: number,
  mergeRequestIid: number,
  file: GitLabFileChange,
  sourceBranch: string,
): Promise<FileReview> => {
  if (file.deleted_file) {
    return {
      path: file.new_path,
      review: 'File deleted, no review needed.'
    };
  }

  const fileContent = await gitlabService.getFileContent(projectId, file.new_path, sourceBranch);
  const languageType = claudeService.getLanguageType(file.new_path);
  const fileReview = await claudeService.getFileReview(
    { path: file.new_path, content: fileContent },
    languageType,
  );

  return {
    path: file.new_path,
    review: fileReview.review
  };
};

const formatChecklistComment = (checklistResults: ChecklistResult): string => {
  const getStatusEmoji = (status: boolean): string => (status ? '✅' : '❌');

  let comment = '## Checklist Compliance\n\n';

  for (const [item, status] of Object.entries(checklistResults)) {
    comment += `${getStatusEmoji(status)} ${item}\n`;
  }

  return comment;
};

/**
 * Main function to review a merge request
 * @param projectId - GitLab project ID
 * @param mergeRequestIid - Merge request IID
 * @returns Review result
 */
const reviewMergeRequest = async (projectId: number, mergeRequestIid: number): Promise<ReviewData> => {
  try {
    logger.info(`Starting code review for MR ${mergeRequestIid} in project ${projectId}`);

    const mrDetails = await gitlabService.getMergeRequestDetails(projectId, mergeRequestIid);
    const changedFiles = await gitlabService.getChangedFiles(projectId, mergeRequestIid);
    const filesToReview = changedFiles.filter(shouldReviewFile);

    // Review each file
    const fileReviews: FileReview[] = [];
    for (const file of filesToReview) {
      const review = await reviewFile(projectId, mergeRequestIid, file, mrDetails.source_branch);
      fileReviews.push(review);
    }

    // Evaluate checklist
    const checklistResults = await claudeService.evaluateChecklist(
      mrDetails,
      changedFiles,
      fileReviews,
      (projectId: number, filePath: string, ref: string) => gitlabService.getFileContent(projectId, filePath, ref),
      projectId,
    );

    // Generate overall review with checklist results
    const overallReview = await claudeService.getOverallReview(mrDetails, fileReviews, checklistResults);

    // Extract recommendation
    const recommendation = claudeService.extractRecommendation(overallReview);

    // Create review data
    const reviewData: ReviewData = {
      projectId,
      mergeRequestIid,
      recommendation,
      fileReviews,
      overallReview,
      checklistResults,
      comments: [] // Initialize empty comments array
    };

    await slack.sendReviewCompletedNotification(reviewData);

    return reviewData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in reviewMergeRequest for MR ${mergeRequestIid}: ${errorMessage}`);
    await slack.sendErrorMessage(`Error in reviewMergeRequest for MR ${mergeRequestIid}: ${errorMessage}`);
    throw error;
  }
};

export default {
  reviewMergeRequest
}; 