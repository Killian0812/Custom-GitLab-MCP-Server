export interface FileReview {
  path: string;
  review: string;
}

export interface ChecklistResult {
  status: boolean;
  message: string;
}

export interface ChecklistResults {
  [key: string]: ChecklistResult;
}

export interface ReviewData {
  projectId: number;
  mergeRequestIid: number;
  recommendation: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES';
  fileReviews: FileReview[];
  overallReview: string;
  checklistResults: ChecklistResults;
}

export interface FileData {
  path: string;
  content: string;
}
