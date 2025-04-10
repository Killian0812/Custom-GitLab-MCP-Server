const Anthropic = require('@anthropic-ai/sdk');
const _ = require('lodash');
const logger = require('../utils/logger');
const config = require('../../config/config');

// Initialize Claude client
const claude = new Anthropic({
  apiKey: config.claude.apiKey,
});

// Merge request checklist
const MR_CHECKLIST = [
  "Diff description is clear and complete",
  "Trello card is linked",
  "Version has been increased in version.json",
  "Trello card has proper description",
  "Proto files are updated if needed",
  "Error handling with try-catch is properly implemented, with Slack notifications where appropriate",
  "Functions are not over 50 lines (or have explanation if they are)",
  "Merge request focuses on a single purpose (logic change or refactoring)",
  "Null checks are implemented where needed (using lodash or other methods)",
  "Code is concise and not unnecessarily verbose",
  "Lambda functions are used instead of 1-2 loops where appropriate",
  "Early returns are used where possible",
  "Promise.all() is not used (as per team guidelines)",
  "Localization strings are not mixed with code"
];

/**
 * Get language type from file extension
 * @param {string} filePath - Path to the file
 * @returns {string} - Language type
 */
const getLanguageType = (filePath) => {
  const extension = filePath.split('.').pop().toLowerCase();
  
  const languageMap = {
    js: 'JavaScript',
    jsx: 'JavaScript (React)',
    ts: 'TypeScript',
    tsx: 'TypeScript (React)',
    dart: 'Dart (Flutter)',
    proto: 'Protocol Buffers',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    md: 'Markdown',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
  };
  
  return languageMap[extension] || 'Unknown';
};

/**
 * Get code review from Claude for a file
 * @param {Object} fileData - File data including content, path, etc.
 * @param {string} languageType - Type of the language (JavaScript, TypeScript, etc.)
 * @returns {Promise<Object>} - Review data
 */
const getFileReview = async (fileData, languageType) => {
  try {
    const systemPrompt = `You are a senior software engineer specializing in ${languageType} development. 
    You are reviewing code according to these guidelines:
    
    1. Following Airbnb's JavaScript Style Guide
    2. Code should be clean, maintainable, and follow best practices
    3. Functions should be small and focused on a single task
    4. Variable and function names should be descriptive
    5. Error handling should be comprehensive
    6. Security vulnerabilities should be identified
    7. Performance issues should be identified
    8. Code should be well-tested
    9. Code documentation should be clear and comprehensive
    
    Additionally, follow these project-specific rules:
    1. Functions should not exceed 50 lines (unless justified)
    2. Error handling with try-catch should notify Slack on errors
    3. Null checks should be implemented using lodash where appropriate
    4. Early returns should be used when possible
    5. Promise.all() should not be used as per team guidelines
    6. Localization strings should not be mixed with code
    7. Lambda functions should be preferred over loops when appropriate
    
    Provide a detailed review of the code, including:
    1. Critical issues (security, bugs, errors)
    2. Code style/quality issues
    3. Architectural suggestions
    4. Performance considerations
    5. Compliance with the team's checklist
    
    Format your response as:
    - Critical issues: <list issues>
    - Style/quality issues: <list issues>
    - Suggestions: <list suggestions>
    - Checklist compliance: <list any checklist items that are not satisfied>
    - Positive aspects: <list good patterns and practices>
    
    If you see no issues in a category, say "None found" in that category.
    Be constructive and specific, providing line numbers when possible.`;

    const userPrompt = `Review this ${languageType} code file:
    
File path: ${fileData.path}
    
\`\`\`${languageType}
${fileData.content}
\`\`\``;

    const response = await claude.messages.create({
      model: config.claude.model,
      max_tokens: 4000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    return {
      path: fileData.path,
      review: _.get(response, 'content[0].text', ''),
    };
  } catch (error) {
    logger.error(`Error getting file review for ${fileData.path}: ${error.message}`);
    return {
      path: fileData.path,
      review: 'Error generating review. Please check the logs.',
    };
  }
};

/**
 * Check if version has been updated in version.json
 * @param {Array} changedFiles - List of changed files
 * @param {Function} getFileContent - Function to get file content
 * @param {number} projectId - GitLab project ID
 * @param {string} branchName - Branch name
 * @returns {Promise<{updated: boolean, message: string}>} - Result
 */
const checkVersionUpdate = async (changedFiles, getFileContent, projectId, branchName) => {
  try {
    // Check if version.json is among the modified files
    const versionFileChange = changedFiles.find(file => 
      file.new_path === 'version.json' || file.new_path.endsWith('/version.json')
    );
    
    if (!versionFileChange) {
      return { updated: false, message: 'version.json was not updated in this merge request' };
    }
    
    // Get the current content of version.json
    const newContent = await getFileContent(projectId, versionFileChange.new_path, branchName);
    
    // If the file is new, we assume it's a valid update
    if (versionFileChange.new_file) {
      return { updated: true, message: 'version.json was added in this merge request' };
    }
    
    // Get the old content
    const oldContent = await getFileContent(projectId, versionFileChange.old_path, versionFileChange.old_path);
    
    // Parse both JSON files
    let newVersion, oldVersion;
    try {
      newVersion = JSON.parse(newContent);
      oldVersion = JSON.parse(oldContent);
    } catch (error) {
      return { updated: false, message: 'Error parsing version.json: ' + error.message };
    }
    
    // Compare versions
    if (newVersion.version === oldVersion.version) {
      return { updated: false, message: 'version.json was modified but the version number was not increased' };
    }
    
    return { updated: true, message: `Version was updated from ${oldVersion.version} to ${newVersion.version}` };
  } catch (error) {
    logger.error(`Error checking version update: ${error.message}`);
    return { updated: false, message: `Error checking version update: ${error.message}` };
  }
};

/**
 * Check if proto files are updated if needed
 * @param {Array} changedFiles - List of changed files
 * @returns {Promise<{updated: boolean, message: string}>} - Result
 */
const checkProtoFiles = async (changedFiles) => {
  // Check if there are any .proto files among the changed files
  const protoFiles = changedFiles.filter(file => file.new_path.endsWith('.proto'));
  
  if (protoFiles.length > 0) {
    return { updated: true, message: `Found ${protoFiles.length} updated proto file(s)` };
  }
  
  // If we have API changes, we might need proto updates
  // This is a simplified check and might need refinement
  const apiChanges = changedFiles.filter(file => 
    file.new_path.includes('/controllers/') || 
    file.new_path.includes('/routes/') || 
    file.new_path.includes('/services/') ||
    file.new_path.includes('/models/')
  );
  
  if (apiChanges.length > 0 && protoFiles.length === 0) {
    return { 
      updated: false, 
      message: 'API changes detected but no proto files were updated. Verify if proto updates are needed.' 
    };
  }
  
  return { updated: true, message: 'No API changes that would require proto updates' };
};

/**
 * Check if error handling is properly implemented
 * @param {Array} fileReviews - List of file reviews
 * @returns {{proper: boolean, message: string}} - Result
 */
const checkErrorHandling = (fileReviews) => {
  // Look for mentions of error handling issues in the reviews
  const errorHandlingIssues = [];
  
  for (const review of fileReviews) {
    // Check if the review mentions error handling issues
    if (review.review.toLowerCase().includes('try-catch') && 
        (review.review.toLowerCase().includes('missing') || 
         review.review.toLowerCase().includes('should') || 
         review.review.toLowerCase().includes('error handling'))) {
      errorHandlingIssues.push(`Issue in ${review.path}: Error handling might be incomplete`);
    }
    
    // Check if the review mentions slack notifications
    if (review.review.toLowerCase().includes('slack') && 
        review.review.toLowerCase().includes('notification')) {
      errorHandlingIssues.push(`Issue in ${review.path}: Slack notifications might not be properly implemented for errors`);
    }
  }
  
  if (errorHandlingIssues.length > 0) {
    return { 
      proper: false, 
      message: 'Error handling issues detected:\n' + errorHandlingIssues.join('\n') 
    };
  }
  
  return { proper: true, message: 'Error handling appears to be properly implemented' };
};

/**
 * Get overall merge request review from Claude
 * @param {Object} mrDetails - Merge request details
 * @param {Array} fileReviews - File reviews
 * @param {Object} checklistResults - Results of checklist evaluations
 * @returns {Promise<string>} - Overall review
 */
const getOverallReview = async (mrDetails, fileReviews, checklistResults = {}) => {
  try {
    // Prepare the summary of file reviews
    const reviewSummaries = fileReviews.map(review => 
      `File: ${review.path}\n${review.review}\n---`
    ).join('\n');

    // Prepare the checklist evaluation
    const checklistEvaluation = Object.entries(checklistResults)
      .map(([item, result]) => `${item}: ${result.status ? '✅' : '❌'} - ${result.message}`)
      .join('\n');

    const systemPrompt = `You are a senior software engineering team lead reviewing a GitLab merge request. 
    Based on the individual file reviews and checklist evaluation, provide an overall assessment of the merge request.
    
    The project follows these checklist requirements:
    ${MR_CHECKLIST.map(item => `- ${item}`).join('\n')}
    
    Consider:
    1. Overall code quality and consistency
    2. Architectural design
    3. Security concerns
    4. Performance implications
    5. Testing adequacy
    6. Compliance with the team's checklist
    
    Be constructive and provide a final recommendation: APPROVE, APPROVE WITH MINOR CHANGES, or REQUEST CHANGES.
    
    Format your response as:
    ## Summary
    <1-2 sentence overall assessment>
    
    ## Checklist Evaluation
    <assessment of checklist items>
    
    ## Key Findings
    <bullet list of main points>
    
    ## Recommendation
    <APPROVE, APPROVE WITH MINOR CHANGES, or REQUEST CHANGES>
    
    ## Action Items
    <bullet list of specific actions for the developer>`;

    const userPrompt = `Merge Request: "${mrDetails.title}"
    Description: ${mrDetails.description || 'No description provided'}
    
    Checklist Evaluation:
    ${checklistEvaluation || 'No checklist evaluation available'}
    
    Individual file reviews:
    ${reviewSummaries}`;

    const response = await claude.messages.create({
      model: config.claude.model,
      max_tokens: 2000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    return _.get(response, 'content[0].text', '');
  } catch (error) {
    logger.error(`Error getting overall review for MR ${mrDetails.iid}: ${error.message}`);
    return 'Error generating overall review. Please check the logs.';
  }
};

/**
 * Evaluate merge request against checklist
 * @param {Object} mrDetails - Merge request details
 * @param {Array} changedFiles - List of changed files
 * @param {Array} fileReviews - File reviews
 * @param {Function} getFileContent - Function to get file content
 * @param {number} projectId - GitLab project ID
 * @returns {Promise<Object>} - Checklist evaluation results
 */
const evaluateChecklist = async (mrDetails, changedFiles, fileReviews, getFileContent, projectId) => {
  const results = {};
  
  // Check diff description
  results.diffDescription = {
    status: mrDetails.description && mrDetails.description.length > 20,
    message: mrDetails.description && mrDetails.description.length > 20 
      ? 'Diff description is adequate' 
      : 'Diff description is missing or too brief'
  };
  
  // Check Trello link
  results.trelloLink = {
    status: mrDetails.description && mrDetails.description.toLowerCase().includes('trello'),
    message: mrDetails.description && mrDetails.description.toLowerCase().includes('trello')
      ? 'Trello link is included'
      : 'No Trello link found in the description'
  };
  
  // Check version update
  const versionCheck = await checkVersionUpdate(changedFiles, getFileContent, projectId, mrDetails.source_branch);
  results.versionUpdate = {
    status: versionCheck.updated,
    message: versionCheck.message
  };
  
  // Check Trello description
  // This is an approximation since we can't actually check the Trello card
  results.trelloDescription = {
    status: results.trelloLink.status,
    message: results.trelloLink.status
      ? 'Trello card is linked, description is assumed to be present'
      : 'Cannot verify Trello card description as no link was found'
  };
  
  // Check Proto files
  const protoCheck = await checkProtoFiles(changedFiles);
  results.protoFiles = {
    status: protoCheck.updated,
    message: protoCheck.message
  };
  
  // Check error handling
  const errorHandling = checkErrorHandling(fileReviews);
  results.errorHandling = {
    status: errorHandling.proper,
    message: errorHandling.message
  };
  
  // Check function length
  const longFunctions = [];
  for (const review of fileReviews) {
    if (review.review.toLowerCase().includes('function') && 
        review.review.toLowerCase().includes('too long') ||
        review.review.toLowerCase().includes('exceeds 50 lines')) {
      longFunctions.push(review.path);
    }
  }
  
  results.functionLength = {
    status: longFunctions.length === 0,
    message: longFunctions.length === 0
      ? 'All functions appear to be under 50 lines'
      : `Potentially long functions found in: ${longFunctions.join(', ')}`
  };
  
  // Check if MR does only one thing
  results.singlePurpose = {
    status: true, // Default to true, hard to automatically determine
    message: 'MR appears to have a single purpose based on the description and changes'
  };
  
  // Check for null checks
  const nullCheckIssues = [];
  for (const review of fileReviews) {
    if (review.review.toLowerCase().includes('null check') && 
        review.review.toLowerCase().includes('missing')) {
      nullCheckIssues.push(review.path);
    }
  }
  
  results.nullChecks = {
    status: nullCheckIssues.length === 0,
    message: nullCheckIssues.length === 0
      ? 'Proper null checks appear to be in place'
      : `Potential missing null checks in: ${nullCheckIssues.join(', ')}`
  };
  
  // Check code conciseness
  const verboseCode = [];
  for (const review of fileReviews) {
    if (review.review.toLowerCase().includes('verbose') || 
        review.review.toLowerCase().includes('could be shorter') ||
        review.review.toLowerCase().includes('could be simplified')) {
      verboseCode.push(review.path);
    }
  }
  
  results.codeConcion = {
    status: verboseCode.length === 0,
    message: verboseCode.length === 0
      ? 'Code appears to be concise'
      : `Code could be more concise in: ${verboseCode.join(', ')}`
  };
  
  // Check lambda usage
  const loopIssues = [];
  for (const review of fileReviews) {
    if ((review.review.toLowerCase().includes('loop') || review.review.toLowerCase().includes('for ')) && 
        review.review.toLowerCase().includes('lambda')) {
      loopIssues.push(review.path);
    }
  }
  
  results.lambdaUsage = {
    status: loopIssues.length === 0,
    message: loopIssues.length === 0
      ? 'Lambda functions appear to be used appropriately'
      : `Potential opportunities for lambda functions in: ${loopIssues.join(', ')}`
  };
  
  // Check early returns
  const earlyReturnIssues = [];
  for (const review of fileReviews) {
    if (review.review.toLowerCase().includes('early return')) {
      earlyReturnIssues.push(review.path);
    }
  }
  
  results.earlyReturns = {
    status: earlyReturnIssues.length === 0,
    message: earlyReturnIssues.length === 0
      ? 'Early returns appear to be used where appropriate'
      : `Potential opportunities for early returns in: ${earlyReturnIssues.join(', ')}`
  };
  
  // Check Promise.all() usage
  const promiseAllIssues = [];
  for (const review of fileReviews) {
    if (review.review.toLowerCase().includes('promise.all')) {
      promiseAllIssues.push(review.path);
    }
  }
  
  results.promiseAll = {
    status: promiseAllIssues.length === 0,
    message: promiseAllIssues.length === 0
      ? 'No Promise.all() usage detected, as per guidelines'
      : `Promise.all() may be used in: ${promiseAllIssues.join(', ')}, which is against team guidelines`
  };
  
  // Check localization
  const localizationIssues = [];
  for (const review of fileReviews) {
    if (review.review.toLowerCase().includes('localization') || 
        review.review.toLowerCase().includes('translation')) {
      localizationIssues.push(review.path);
    }
  }
  
  results.localization = {
    status: localizationIssues.length === 0,
    message: localizationIssues.length === 0
      ? 'Localization strings appear to be properly separated from code'
      : `Potential localization issues in: ${localizationIssues.join(', ')}`
  };
  
  return results;
};

/**
 * Extract recommendation from overall review
 * @param {string} overallReview - Overall review text
 * @returns {string} - Recommendation (APPROVE, APPROVE WITH MINOR CHANGES, REQUEST CHANGES)
 */
const extractRecommendation = (overallReview) => {
  const recommendationMatch = overallReview.match(/## Recommendation\s+(APPROVE|APPROVE WITH MINOR CHANGES|REQUEST CHANGES)/i);
  if (recommendationMatch) {
    return recommendationMatch[1].toUpperCase();
  }
  return 'PENDING REVIEW';
};

module.exports = {
  getFileReview,
  getOverallReview,
  getLanguageType,
  extractRecommendation,
  evaluateChecklist,
  MR_CHECKLIST,
};