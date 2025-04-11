import { GitLabFileChange } from '../types/gitlab.types';
import logger from '../utils/logger';

interface ClaudeResponse {
  content: string;
  error?: string;
}

const analyzeCode = async (fileChange: GitLabFileChange): Promise<ClaudeResponse> => {
  try {
    // TODO: Implement Claude API integration
    logger.info('Claude analysis would be performed here', { fileChange });
    return {
      content: 'Sample analysis result',
    };
  } catch (error) {
    logger.error('Error analyzing code with Claude:', error);
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export default {
  analyzeCode,
}; 