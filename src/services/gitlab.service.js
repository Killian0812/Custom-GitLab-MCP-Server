const axios = require('axios');
const logger = require('../utils/logger');
const config = require('../../config/config');

// Initialize GitLab API client
const gitlabApiClient = axios.create({
  baseURL: config.gitlab.apiUrl,
  headers: {
    'PRIVATE-TOKEN': config.gitlab.privateToken,
  },
});

/**
 * Get files changed in a merge request
 * @param {number} projectId - GitLab project ID
 * @param {number} mergeRequestIid - Merge request IID
 * @returns {Promise<Array>} - List of files changed in the merge request
 */
const getChangedFiles = async (projectId, mergeRequestIid) => {
  try {
    const response = await gitlabApiClient.get(`/projects/${projectId}/merge_requests/${mergeRequestIid}/changes`);
    return response.data.changes;
  } catch (error) {
    logger.error(`Error getting changed files for MR ${mergeRequestIid}: ${error.message}`);
    throw error;
  }
};

/**
 * Get file content from GitLab
 * @param {number} projectId - GitLab project ID
 * @param {string} filePath - Path to the file
 * @param {string} ref - Git reference (branch, commit)
 * @returns {Promise<string>} - File content
 */
const getFileContent = async (projectId, filePath, ref) => {
  try {
    const response = await gitlabApiClient.get(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw`, {
      params: { ref },
    });
    return response.data;
  } catch (error) {
    logger.error(`Error getting file content for ${filePath} at ${ref}: ${error.message}`);
    throw error;
  }
};

/**
 * Get merge request details
 * @param {number} projectId - GitLab project ID
 * @param {number} mergeRequestIid - Merge request IID
 * @returns {Promise<Object>} - Merge request details
 */
const getMergeRequestDetails = async (projectId, mergeRequestIid) => {
  try {
    const response = await gitlabApiClient.get(`/projects/${projectId}/merge_requests/${mergeRequestIid}`);
    return response.data;
  } catch (error) {
    logger.error(`Error getting MR details for ${mergeRequestIid}: ${error.message}`);
    throw error;
  }
};

/**
 * Post a comment on a merge request
 * @param {number} projectId - GitLab project ID
 * @param {number} mergeRequestIid - Merge request IID
 * @param {string} body - Comment body
 * @returns {Promise<Object>} - Comment data
 */
const postMergeRequestComment = async (projectId, mergeRequestIid, body) => {
  try {
    const response = await gitlabApiClient.post(`/projects/${projectId}/merge_requests/${mergeRequestIid}/notes`, {
      body,
    });
    return response.data;
  } catch (error) {
    logger.error(`Error posting comment to MR ${mergeRequestIid}: ${error.message}`);
    throw error;
  }
};

/**
 * Post a comment on a specific line of code in a merge request
 * @param {number} projectId - GitLab project ID
 * @param {number} mergeRequestIid - Merge request IID
 * @param {string} body - Comment body
 * @param {Object} position - Position data
 * @returns {Promise<Object>} - Comment data
 */
const postLineComment = async (projectId, mergeRequestIid, body, position) => {
  try {
    const response = await gitlabApiClient.post(`/projects/${projectId}/merge_requests/${mergeRequestIid}/discussions`, {
      body,
      position,
    });
    return response.data;
  } catch (error) {
    logger.error(`Error posting line comment to MR ${mergeRequestIid}: ${error.message}`);
    throw error;
  }
};

/**
 * Approve a merge request
 * @param {number} projectId - GitLab project ID
 * @param {number} mergeRequestIid - Merge request IID
 * @returns {Promise<Object>} - Approval data
 */
const approveMergeRequest = async (projectId, mergeRequestIid) => {
  try {
    const response = await gitlabApiClient.post(`/projects/${projectId}/merge_requests/${mergeRequestIid}/approve`);
    return response.data;
  } catch (error) {
    logger.error(`Error approving MR ${mergeRequestIid}: ${error.message}`);
    throw error;
  }
};

/**
 * Verify GitLab webhook signature
 * @param {string} token - Webhook token from header
 * @param {string} secret - Configured webhook secret
 * @returns {boolean} - Whether the signature is valid
 */
const verifyWebhookSignature = (token, secret) => {
  return token === secret;
};

module.exports = {
  getChangedFiles,
  getFileContent,
  getMergeRequestDetails,
  postMergeRequestComment,
  postLineComment,
  approveMergeRequest,
  verifyWebhookSignature,
};