export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  source_branch: string;
  target_branch: string;
  work_in_progress: boolean;
  web_url: string;
  changes: GitLabFileChange[];
}

export interface GitLabFileChange {
  old_path: string;
  new_path: string;
  new_file: boolean;
  deleted_file: boolean;
  diff: string;
}

export interface GitLabWebhookData {
  object_kind: string;
  object_attributes: {
    id: number;
    iid: number;
    action: string;
    work_in_progress: boolean;
  };
  project: {
    id: number;
    name: string;
    web_url: string;
  };
  changes: {
    title?: {
      previous: string;
      current: string;
    };
    description?: {
      previous: string;
      current: string;
    };
  };
}

export interface GitLabComment {
  id: number;
  body: string;
  author: {
    id: number;
    name: string;
    username: string;
  };
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_type: string;
  noteable_id: number;
  position: {
    base_sha: string;
    start_sha: string;
    head_sha: string;
    old_path: string;
    new_path: string;
    position_type: string;
    old_line: number | null;
    new_line: number;
  };
}

export interface GitLabDiscussion extends GitLabComment {
  position: {
    base_sha: string;
    start_sha: string;
    head_sha: string;
    position_type: string;
    new_path: string;
    new_line: number;
    old_path: string;
    old_line: number | null;
  };
}

export interface GitLabApproval {
  id: number;
  user: {
    id: number;
    name: string;
    username: string;
  };
  approved_at: string;
}
