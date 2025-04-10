const codeReviewService = require('../../src/services/code-review.service');
const gitlabService = require('../../src/services/gitlab.service');
const claudeService = require('../../src/services/claude.service');
const slack = require('../../src/utils/slack');

// Mock dependencies
jest.mock('../../src/services/gitlab.service');
jest.mock('../../src/services/claude.service');
jest.mock('../../src/utils/slack');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Code Review Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reviewMergeRequest', () => {
    const projectId = 123;
    const mergeRequestIid = 456;

    const mockMrDetails = {
      id: 789,
      iid: mergeRequestIid,
      title: 'Test MR',
      description: 'Test description',
      source_branch: 'feature-branch',
    };

    const mockChangedFiles = [
      {
        new_path: 'src/test.js',
        deleted_file: false,
      },
      {
        new_path: 'README.md',
        deleted_file: false,
      },
    ];

    const mockFileContent = 'const test = () => { console.log("test"); };';

    const mockFileReview = {
      path: 'src/test.js',
      review: 'Test review',
    };

    const mockOverallReview = '## Summary\nTest summary\n\n## Recommendation\nAPPROVE';

    beforeEach(() => {
      gitlabService.getMergeRequestDetails.mockResolvedValue(mockMrDetails);
      gitlabService.getChangedFiles.mockResolvedValue(mockChangedFiles);
      gitlabService.getFileContent.mockResolvedValue(mockFileContent);
      gitlabService.postMergeRequestComment.mockResolvedValue({});
      gitlabService.approveMergeRequest.mockResolvedValue({});

      claudeService.getLanguageType.mockReturnValue('JavaScript');
      claudeService.getFileReview.mockResolvedValue(mockFileReview);
      claudeService.getOverallReview.mockResolvedValue(mockOverallReview);
      claudeService.extractRecommendation.mockReturnValue('APPROVE');

      slack.sendReviewCompletedNotification.mockResolvedValue();
    });

    it('should review a merge request successfully', async () => {
      const result = await codeReviewService.reviewMergeRequest(projectId, mergeRequestIid);

      expect(gitlabService.getMergeRequestDetails).toHaveBeenCalledWith(projectId, mergeRequestIid);
      expect(gitlabService.getChangedFiles).toHaveBeenCalledWith(projectId, mergeRequestIid);
      expect(gitlabService.getFileContent).toHaveBeenCalledWith(projectId, 'src/test.js', 'feature-branch');
      expect(claudeService.getFileReview).toHaveBeenCalled();
      expect(claudeService.getOverallReview).toHaveBeenCalled();
      expect(gitlabService.postMergeRequestComment).toHaveBeenCalledTimes(2);
      expect(gitlabService.approveMergeRequest).toHaveBeenCalledWith(projectId, mergeRequestIid);
      expect(slack.sendReviewCompletedNotification).toHaveBeenCalled();

      expect(result).toEqual({
        projectId,
        mergeRequestIid,
        recommendation: 'APPROVE',
        fileReviews: [mockFileReview],
        overallReview: mockOverallReview,
      });
    });

    it('should not approve if recommendation is not APPROVE', async () => {
      claudeService.extractRecommendation.mockReturnValue('APPROVE WITH MINOR CHANGES');

      await codeReviewService.reviewMergeRequest(projectId, mergeRequestIid);

      expect(gitlabService.approveMergeRequest).not.toHaveBeenCalled();
    });

    it('should handle error and throw', async () => {
      const error = new Error('Test error');
      gitlabService.getMergeRequestDetails.mockRejectedValue(error);

      await expect(codeReviewService.reviewMergeRequest(projectId, mergeRequestIid))
        .rejects.toThrow(error);

      expect(slack.sendErrorMessage).toHaveBeenCalled();
    });
  });

  describe('handleMergeRequestWebhook', () => {
    const mockWebhookData = {
      object_kind: 'merge_request',
      object_attributes: {
        action: 'open',
        iid: 456,
        work_in_progress: false,
      },
      project: {
        id: 123,
      },
    };

    beforeEach(() => {
      jest.spyOn(codeReviewService, 'reviewMergeRequest').mockResolvedValue({});
    });

    it('should process a merge request webhook', async () => {
      await codeReviewService.handleMergeRequestWebhook(mockWebhookData);

      expect(codeReviewService.reviewMergeRequest).toHaveBeenCalledWith(123, 456);
    });

    it('should not process a non-merge request webhook', async () => {
      const nonMrWebhook = { ...mockWebhookData, object_kind: 'push' };

      const result = await codeReviewService.handleMergeRequestWebhook(nonMrWebhook);

      expect(codeReviewService.reviewMergeRequest).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should not process a work in progress MR', async () => {
      const wipMrWebhook = {
        ...mockWebhookData,
        object_attributes: {
          ...mockWebhookData.object_attributes,
          work_in_progress: true,
        },
      };

      const result = await codeReviewService.handleMergeRequestWebhook(wipMrWebhook);

      expect(codeReviewService.reviewMergeRequest).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});