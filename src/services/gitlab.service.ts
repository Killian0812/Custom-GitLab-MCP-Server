import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { config } from '../../config/config';
import {
  GitLabMergeRequest,
  GitLabFileChange,
  GitLabComment,
  GitLabDiscussion,
  GitLabApproval,
} from '../types/gitlab.types';

// Initialize GitLab API client
const gitlabApiClient: AxiosInstance = axios.create({
  baseURL: config.gitlab.apiUrl,
  headers: {
    'PRIVATE-TOKEN': config.gitlab.privateToken,
  },
});

/**
 * Get files changed in a merge request
 * @param projectId - GitLab project ID
 * @param mergeRequestIid - Merge request IID
 * @returns List of files changed in the merge request
 */
export const getChangedFiles = async (
  projectId: number,
  mergeRequestIid: number,
): Promise<GitLabFileChange[]> => {
  try {
    const response = await gitlabApiClient.get<{ changes: GitLabFileChange[] }>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/changes`,
    );
    return response.data.changes;
  } catch (error) {
    logger.error(
      `Error getting changed files for MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw error;
  }
};

/**
 * Get file content from GitLab
 * @param projectId - GitLab project ID
 * @param filePath - Path to the file
 * @param ref - Git reference (branch, commit)
 * @returns File content
 */
export const getFileContent = async (
  projectId: number,
  filePath: string,
  ref: string,
): Promise<string> => {
  try {
    const response = await gitlabApiClient.get<string>(
      `/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw`,
      { params: { ref } },
    );
    return response.data;
  } catch (error) {
    logger.error(
      `Error getting file content for ${filePath} at ${ref}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw error;
  }
};

/**
 * Get merge request details
 * @param projectId - GitLab project ID
 * @param mergeRequestIid - Merge request IID
 * @returns Merge request details
 */
export const getMergeRequestDetails = async (
  projectId: number,
  mergeRequestIid: number,
): Promise<GitLabMergeRequest> => {
  try {
    const response = await gitlabApiClient.get<GitLabMergeRequest>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}`,
    );
    return response.data;
  } catch (error) {
    logger.error(
      `Error getting MR details for ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw error;
  }
};

/**
 * Post a comment on a merge request
 * @param projectId - GitLab project ID
 * @param mergeRequestIid - Merge request IID
 * @param body - Comment body
 * @returns Comment data
 */
export const postMergeRequestComment = async (
  projectId: number,
  mergeRequestIid: number,
  body: string,
): Promise<GitLabComment> => {
  try {
    const response = await gitlabApiClient.post<GitLabComment>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/notes`,
      { body },
    );
    return response.data;
  } catch (error) {
    logger.error(
      `Error posting comment to MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw error;
  }
};

/**
 * Post a comment on a specific line of code in a merge request
 * @param projectId - GitLab project ID
 * @param mergeRequestIid - Merge request IID
 * @param body - Comment body
 * @param position - Position data for the comment
 * @returns Discussion data
 */
export const postLineComment = async (
  projectId: number,
  mergeRequestIid: number,
  body: string,
  position: GitLabDiscussion['position'],
): Promise<GitLabDiscussion> => {
  try {
    const response = await gitlabApiClient.post<GitLabDiscussion>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/discussions`,
      { body, position },
    );
    return response.data;
  } catch (error) {
    logger.error(
      `Error posting line comment to MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw error;
  }
};

/**
 * Approve a merge request
 * @param projectId - GitLab project ID
 * @param mergeRequestIid - Merge request IID
 * @returns Approval data
 */
export const approveMergeRequest = async (
  projectId: number,
  mergeRequestIid: number,
): Promise<GitLabApproval> => {
  try {
    const response = await gitlabApiClient.post<GitLabApproval>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/approve`,
    );
    return response.data;
  } catch (error) {
    logger.error(
      `Error approving MR ${mergeRequestIid}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    throw error;
  }
};

/**
 * Verify GitLab webhook signature
 * @param token - Webhook token from header
 * @param secret - Configured webhook secret
 * @returns Whether the signature is valid
 */
export const verifyWebhookSignature = (token: string, secret: string): boolean => token === secret;
