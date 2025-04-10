const logger = require('../utils/logger');
const slack = require('../utils/slack');
const gitlabService = require('./gitlab.service');
const claudeService = require('./claude.service');

/**
 * Main function to review a merge request
 * @param {number} projectId - GitLab project ID
 * @param {number} mergeRequestIid - Merge request IID
 * @returns {Promise<Object>} - Review result
 */
const reviewMergeRequest = async (projectId, mergeRequestIid) => {
  try {
    logger.info(`Starting code review for MR ${mergeRequestIid} in project ${projectId}`);
    
    // Get merge request details
    const mrDetails = await gitlabService.getMergeRequestDetails(projectId, mergeRequestIid);
    
    // Get changed files
    const changedFiles = await gitlabService.getChangedFiles(projectId, mergeRequestIid);
    
    // Filter files to review (exclude certain types)
    const filesToReview = changedFiles.filter(file => {
      const extension = file.new_path.split('.').pop().toLowerCase();
      const excludedExtensions = ['md', 'txt', 'json', 'lock', 'png', 'jpg', 'jpeg', 'gif', 'svg'];
      return !excludedExtensions.includes(extension);
    });
    
    // Review each file
    const fileReviews = [];
    for (const file of filesToReview) {
      // Skip deleted files
      if (file.deleted_file) {
        continue;
      }
      
      // Get file content
      const fileContent = await gitlabService.getFileContent(projectId, file.new_path, mrDetails.source_branch);
      
      // Get language type
      const languageType = claudeService.getLanguageType(file.new_path);
      
      // Get file review
      const fileReview = await claudeService.getFileReview({ path: file.new_path, content: fileContent }, languageType);
      fileReviews.push(fileReview);
      
      // Post file-specific review comment
      await gitlabService.postMergeRequestComment(projectId, mergeRequestIid, `### AI Code Review for \`${file.new_path}\`\n\n${fileReview.review}`);
    }
    
    // Evaluate checklist
    const checklistResults = await claudeService.evaluateChecklist(
      mrDetails, 
      changedFiles, 
      fileReviews, 
      (projectId, filePath, ref) => gitlabService.getFileContent(projectId, filePath, ref),
      projectId
    );
    
    // Generate overall review with checklist results
    const overallReview = await claudeService.getOverallReview(mrDetails, fileReviews, checklistResults);
    
    // Post overall review comment
    await gitlabService.postMergeRequestComment(projectId, mergeRequestIid, `# AI Code Review Summary\n\n${overallReview}`);
    
    // Extract recommendation
    const recommendation = claudeService.extractRecommendation(overallReview);
    
    // Approve if recommendation is APPROVE
    if (recommendation === 'APPROVE') {
      await gitlabService.approveMergeRequest(projectId, mergeRequestIid);
    }
    
    // Post checklist compliance comment
    const checklistComment = formatChecklistComment(checklistResults);
    await gitlabService.postMergeRequestComment(projectId, mergeRequestIid, checklistComment);
    
    // Send notification
    const reviewData = {
      projectId,
      mergeRequestIid,
      recommendation,
      fileReviews,
      overallReview,
      checklistResults,
    };
    
    await slack.sendReviewCompletedNotification(reviewData);
    
    return reviewData;
  } catch (error) {
    logger.error(`Error in reviewMergeRequest for MR ${mergeRequestIid}: ${error.message}`);
    slack.sendErrorMessage(`Error in reviewMergeRequest for MR ${mergeRequestIid}: ${error.message}`);
    throw error;
  }
};

/**
 * Format checklist results as a comment
 * @param {Object} checklistResults - Checklist evaluation results
 * @returns {string} - Formatted comment
 */
const formatChecklistComment = (checklistResults) => {
  const lines = ['# MR Checklist Compliance\n'];
  
  const getStatusEmoji = (status) => status ? '✅' : '❌';
  
  // Add each checklist item with status
  for (const [item, result] of Object.entries(checklistResults)) {
    const formattedItem = item
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
      
    lines.push(`### ${formattedItem} ${getStatusEmoji(result.status)}`);
    lines.push(result.message);
    lines.push('');
  }
  
  // Add summary
  const passedItems = Object.values(checklistResults).filter(r => r.status).length;
  const totalItems = Object.keys(checklistResults).length;
  const passPercentage = Math.round((passedItems / totalItems) * 100);
  
  lines.push(`## Summary`);
  lines.push(`${passedItems} of ${totalItems} checklist items passed (${passPercentage}%)`);
  
  return lines.join('\n');
};

/**
 * Webhook handler for merge request events
 * @param {Object} webhookData - GitLab webhook data
 * @returns {Promise<Object>} - Review result or null
 */
const handleMergeRequestWebhook = async (webhookData) => {
  // Process only if it's a merge request event and the action is open or update
  if (webhookData.object_kind === 'merge_request' && 
     (webhookData.object_attributes.action === 'open' || webhookData.object_attributes.action === 'update')) {
    
    const projectId = webhookData.project.id;
    const mergeRequestIid = webhookData.object_attributes.iid;
    
    // Skip if work in progress
    if (webhookData.object_attributes.work_in_progress) {
      logger.info(`Skipping WIP MR ${mergeRequestIid}`);
      return null;
    }
    
    // Review the merge request
    return await reviewMergeRequest(projectId, mergeRequestIid);
  }
  
  return null;
};

module.exports = {
  reviewMergeRequest,
  handleMergeRequestWebhook,
};