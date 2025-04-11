# Gitlab MR Reviewer Release Version

## 1.0.9 [feat] (Cursor AI)
- Fixed TypeScript build errors and linting issues
- Added proper type definitions for Claude service
- Improved error handling in webhook routes
- Removed unused code and functions
- Added proper return types for all functions

## 1.0.8 [feat] (Cursor AI)
- Converted remaining JavaScript files to TypeScript (app.js, gitlab.service.js, webhook.route.js)
- Added proper type definitions for Express routes and middleware
- Improved error handling with TypeScript type checking
- Updated Dockerfile with correct TypeScript build paths

## 1.0.7 [feat] (Cursor AI)
- Converted code-review.service to TypeScript
- Added proper type definitions for review-related interfaces
- Improved error handling with TypeScript type checking
- Fixed TypeScript compilation issues in CI/CD pipeline

## 1.0.6 [feat] (Cursor AI)
- Updated Dockerfile to properly handle TypeScript compilation
- Added multi-stage build process for smaller production image
- Fixed container startup issues with proper working directory

## 1.0.5 [feat] (Cursor AI)
- Converted codebase from JavaScript to TypeScript
- Added strict TypeScript configuration and type definitions
- Implemented stricter ESLint rules
- Fixed TypeScript version compatibility issues

## 1.0.4 [feat] (Cursor AI)
- Added automatic redeployment to Kubernetes after image push
- Added kubectl set image command to update deployment
- Added rollout status check to ensure successful deployment

## 1.0.3 [feat] (Cursor AI)
- Added /ready endpoint for Kubernetes health checks
- Improved application reliability with proper health monitoring

## 1.0.2 [fix] (Cursor AI)
- Fixed Dockerfile to use npm install --omit=dev instead of npm ci --only=production

## 1.0.1 [fix] (Cursor AI)
- Fixed Dockerfile to use npm install instead of npm ci
- Updated version tracking

## 1.0.0 [feat] (Cursor AI)
- Initial setup of GitLab MR Reviewer
- Added Docker configuration
- Added GitLab CI/CD pipeline for building and deploying to Google Cloud Artifact Registry 