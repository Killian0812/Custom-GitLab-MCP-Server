import { GitLabMergeRequest, GitLabFileChange, GitLabComment } from '../types/gitlab.types';
import { ReviewData } from '../types/review.types';
import logger from '../utils/logger';
import claudeService from './claude.service';

const analyzeMergeRequest = async (mergeRequest: GitLabMergeRequest): Promise<ReviewData> => {
  try {
    const fileChanges = mergeRequest.changes;
    const comments: GitLabComment[] = [];

    for (const fileChange of fileChanges) {
      const analysis = await claudeService.analyzeCode(fileChange);
      
      if (analysis.error) {
        logger.error('Error analyzing file:', { file: fileChange.new_path, error: analysis.error });
        continue;
      }

      if (analysis.content) {
        comments.push({
          body: analysis.content,
          position: {
            base_sha: fileChange.base_sha,
            start_sha: fileChange.start_sha,
            head_sha: fileChange.head_sha,
            old_path: fileChange.old_path,
            new_path: fileChange.new_path,
            position_type: 'text',
            old_line: null,
            new_line: 1,
          },
        });
      }
    }

    return {
      mergeRequestId: mergeRequest.id,
      projectId: mergeRequest.project_id,
      comments,
    };
  } catch (error) {
    logger.error('Error analyzing merge request:', error);
    throw error;
  }
};

export default {
  analyzeMergeRequest,
}; 