import { GitLabMergeRequest, GitLabFileChange, GitLabComment } from '../types/gitlab.types';
import { ReviewData } from '../types/review.types';
import claudeService from './claude.service';
import logger from '../utils/logger';

export const analyzeMergeRequest = async (mergeRequest: GitLabMergeRequest): Promise<ReviewData> => {
  const comments: GitLabComment[] = [];
  const fileReviews: any[] = []; // TODO: Add proper type for file reviews

  try {
    for (const fileChange of mergeRequest.changes) {
      const analysis = await claudeService.analyzeCode(fileChange);

      if (analysis.error) {
        logger.error('Error analyzing file:', { file: fileChange.new_path, error: analysis.error });
        continue;
      }

      comments.push({
        id: 0, // This will be set by GitLab
        body: analysis.content,
        author: {
          id: 0,
          name: 'Code Reviewer',
          username: 'code-reviewer'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        system: false,
        noteable_type: 'MergeRequest',
        noteable_id: mergeRequest.id,
        position: {
          base_sha: mergeRequest.target_branch,
          start_sha: mergeRequest.target_branch,
          head_sha: mergeRequest.source_branch,
          old_path: fileChange.old_path,
          new_path: fileChange.new_path,
          position_type: 'text',
          old_line: null,
          new_line: 1
        }
      });

      fileReviews.push({
        path: fileChange.new_path,
        review: analysis.content
      });
    }

    return {
      mergeRequestIid: mergeRequest.iid,
      projectId: mergeRequest.project_id,
      comments,
      recommendation: 'NEEDS_WORK', // TODO: Implement proper recommendation logic
      fileReviews,
      overallReview: '', // TODO: Implement overall review
      checklistResults: {} // TODO: Implement checklist results
    };
  } catch (error) {
    logger.error('Error analyzing merge request:', error);
    throw error;
  }
};

export default {
  analyzeMergeRequest,
}; 