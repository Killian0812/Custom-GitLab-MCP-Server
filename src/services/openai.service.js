const { OpenAI } = require('openai');
const _ = require('lodash');
const logger = require('../utils/logger');
const config = require('../../config/config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

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
 * Get code review from OpenAI for a file
 * @param {Object} fileData - File data including content, path, etc.
 * @param {string} languageType - Type of the language (JavaScript, TypeScript, etc.)
 * @returns {Promise<Object>} - Review data
 */
const getFileReview = async (fileData, languageType) => {
  try {
    const messages = [
      {
        role: 'system',
        content: `You are a senior software engineer specializing in ${languageType} development. 
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
        
        Provide a detailed review of the code, including:
        1. Critical issues (security, bugs, errors)
        2. Code style/quality issues
        3. Architectural suggestions
        4. Performance considerations
        
        Format your response as:
        - Critical issues: <list issues>
        - Style/quality issues: <list issues>
        - Suggestions: <list suggestions>
        - Positive aspects: <list good patterns and practices>
        
        If you see no issues in a category, say "None found" in that category.
        Be constructive and specific, providing line numbers when possible.`,
      },
      {
        role: 'user',
        content: `Review this ${languageType} code file:
        
File path: ${fileData.path}
        
\`\`\`${languageType}
${fileData.content}
\`\`\``,
      },
    ];

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      temperature: 0.2,
      max_tokens: 4000,
    });

    return {
      path: fileData.path,
      review: _.get(response, 'choices.0.message.content', ''),
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
 * Get overall merge request review from OpenAI
 * @param {Object} mrDetails - Merge request details
 * @param {Array} fileReviews - File reviews
 * @returns {Promise<string>} - Overall review
 */
const getOverallReview = async (mrDetails, fileReviews) => {
  try {
    // Prepare the summary of file reviews
    const reviewSummaries = fileReviews.map(review => 
      `File: ${review.path}\n${review.review}\n---`
    ).join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are a senior software engineering team lead reviewing a GitLab merge request. 
        Based on the individual file reviews, provide an overall assessment of the merge request.
        
        Consider:
        1. Overall code quality and consistency
        2. Architectural design
        3. Security concerns
        4. Performance implications
        5. Testing adequacy
        
        Be constructive and provide a final recommendation: APPROVE, APPROVE WITH MINOR CHANGES, or REQUEST CHANGES.
        
        Format your response as:
        ## Summary
        <1-2 sentence overall assessment>
        
        ## Key Findings
        <bullet list of main points>
        
        ## Recommendation
        <APPROVE, APPROVE WITH MINOR CHANGES, or REQUEST CHANGES>
        
        ## Action Items
        <bullet list of specific actions for the developer>`,
      },
      {
        role: 'user',
        content: `Merge Request: "${mrDetails.title}"
        Description: ${mrDetails.description || 'No description provided'}
        
        Individual file reviews:
        ${reviewSummaries}`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      temperature: 0.2,
      max_tokens: 2000,
    });

    return _.get(response, 'choices.0.message.content', '');
  } catch (error) {
    logger.error(`Error getting overall review for MR ${mrDetails.iid}: ${error.message}`);
    return 'Error generating overall review. Please check the logs.';
  }
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
};