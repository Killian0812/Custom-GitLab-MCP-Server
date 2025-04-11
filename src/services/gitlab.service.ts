import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../../config/config';
import { GitLabMergeRequest, GitLabFileChange, GitLabComment } from '../types/gitlab.types';

class GitLabService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = config.gitlab.baseUrl;
    this.token = config.gitlab.token;
  }

  async getChangedFiles(projectId: number, mergeRequestIid: number): Promise<GitLabFileChange[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/changes`,
        {
          headers: {
            'PRIVATE-TOKEN': this.token,
          },
        }
      );

      return response.data.changes;
    } catch (error) {
      logger.error(
        `Error getting changed files for MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async getFileContent(projectId: number, filePath: string, ref: string): Promise<string> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw`,
        {
          headers: {
            'PRIVATE-TOKEN': this.token,
          },
          params: {
            ref,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error(
        `Error getting file content for ${filePath} at ${ref}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async getMergeRequestDetails(projectId: number, mergeRequestIid: number): Promise<GitLabMergeRequest> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}`,
        {
          headers: {
            'PRIVATE-TOKEN': this.token,
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error(
        `Error getting MR details for ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async postComment(projectId: number, mergeRequestIid: number, comment: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/notes`,
        {
          body: comment,
        },
        {
          headers: {
            'PRIVATE-TOKEN': this.token,
          },
        }
      );
    } catch (error) {
      logger.error(
        `Error posting comment to MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async postLineComment(
    projectId: number,
    mergeRequestIid: number,
    comment: string,
    filePath: string,
    line: number
  ): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/discussions`,
        {
          body: comment,
          position: {
            base_sha: 'HEAD',
            start_sha: 'HEAD',
            head_sha: 'HEAD',
            position_type: 'text',
            new_path: filePath,
            new_line: line,
          },
        },
        {
          headers: {
            'PRIVATE-TOKEN': this.token,
          },
        }
      );
    } catch (error) {
      logger.error(
        `Error posting line comment to MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  async approveMergeRequest(projectId: number, mergeRequestIid: number): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/approve`,
        {},
        {
          headers: {
            'PRIVATE-TOKEN': this.token,
          },
        }
      );
    } catch (error) {
      logger.error(
        `Error approving MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }
}

export const gitlabService = new GitLabService();