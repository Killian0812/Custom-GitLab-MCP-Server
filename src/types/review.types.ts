import { GitLabComment } from './gitlab.types';

export interface FileReview {
  path: string;
  review: string;
}

export interface ChecklistResult {
  [key: string]: boolean;
}

export interface ReviewData {
  mergeRequestIid: number;
  projectId: number;
  comments: GitLabComment[];
  recommendation: 'APPROVE' | 'REJECT' | 'NEEDS_WORK';
  fileReviews: FileReview[];
  overallReview: string;
  checklistResults: ChecklistResult;
}

export interface WebhookData {
  object_kind: string;
  event_type: string;
  project: {
    id: number;
  };
  object_attributes: {
    iid: number;
    action: string;
    state: string;
  };
}
