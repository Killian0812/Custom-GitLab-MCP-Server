// gitlab.service.ts
import axios from "axios";
import { z } from "zod";

import {
  GitLabForkSchema,
  GitLabReferenceSchema,
  GitLabRepositorySchema,
  GitLabContentSchema,
  GitLabIssueSchema,
  GitLabMergeRequestSchema,
  GitLabCreateUpdateFileResponseSchema,
  GitLabTreeSchema,
  GitLabCommitSchema,
  GitLabSearchResponseSchema,
  CreateBranchOptionsSchema,
  CreateIssueOptionsSchema,
  CreateMergeRequestOptionsSchema,
  CreateRepositoryOptionsSchema,
  GitLabFork,
  GitLabReference,
  GitLabContent,
  GitLabIssue,
  GitLabMergeRequest,
  GitLabCreateUpdateFileResponse,
  GitLabTree,
  GitLabCommit,
  GitLabSearchResponse,
  GitLabRepository,
  FileOperation,
} from "../schemas";

const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const GITLAB_API_URL =
  process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";

if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
  console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
  process.exit(1);
}

class GitLabService {
  constructor() {}

  async forkProject(
    projectId: string,
    namespace?: string
  ): Promise<GitLabFork> {
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/fork`;
    const queryParams = namespace
      ? `?namespace=${encodeURIComponent(namespace)}`
      : "";

    const response = await axios.post(url + queryParams, null, {
      headers: {
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return GitLabForkSchema.parse(response.data);
  }

  async createBranch(
    projectId: string,
    options: z.infer<typeof CreateBranchOptionsSchema>
  ): Promise<GitLabReference> {
    const response = await axios.post(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        projectId
      )}/repository/branches`,
      {
        branch: options.name,
        ref: options.ref,
      },
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return GitLabReferenceSchema.parse(response.data);
  }

  async getDefaultBranchRef(projectId: string): Promise<string> {
    const response = await axios.get(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}`,
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        },
      }
    );

    const project = GitLabRepositorySchema.parse(response.data);
    return project.default_branch;
  }

  async getFileContents(
    projectId: string,
    filePath: string,
    ref?: string
  ): Promise<GitLabContent> {
    const encodedPath = encodeURIComponent(filePath);
    let url = `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/repository/files/${encodedPath}`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      },
    });

    const data = GitLabContentSchema.parse(response.data);

    if (!Array.isArray(data) && data.content) {
      data.content = Buffer.from(data.content, "base64").toString("utf8");
    }

    return data;
  }

  async createIssue(
    projectId: string,
    options: z.infer<typeof CreateIssueOptionsSchema>
  ): Promise<GitLabIssue> {
    const response = await axios.post(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues`,
      {
        title: options.title,
        description: options.description,
        assignee_ids: options.assignee_ids,
        milestone_id: options.milestone_id,
        labels: options.labels?.join(","),
      },
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return GitLabIssueSchema.parse(response.data);
  }

  async createMergeRequest(
    projectId: string,
    options: z.infer<typeof CreateMergeRequestOptionsSchema>
  ): Promise<GitLabMergeRequest> {
    const response = await axios.post(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        projectId
      )}/merge_requests`,
      {
        title: options.title,
        description: options.description,
        source_branch: options.source_branch,
        target_branch: options.target_branch,
        allow_collaboration: options.allow_collaboration,
        draft: options.draft,
      },
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return GitLabMergeRequestSchema.parse(response.data);
  }

  async createOrUpdateFile(
    projectId: string,
    filePath: string,
    content: string,
    commitMessage: string,
    branch: string,
    previousPath?: string
  ): Promise<GitLabCreateUpdateFileResponse> {
    const encodedPath = encodeURIComponent(filePath);
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/repository/files/${encodedPath}`;

    const body = {
      branch,
      content,
      commit_message: commitMessage,
      ...(previousPath ? { previous_path: previousPath } : {}),
    };

    // Check if file exists
    let method = "POST";
    try {
      await this.getFileContents(projectId, filePath, branch);
      method = "PUT";
    } catch (error) {
      // File doesn't exist, use POST
    }

    const response = await axios({
      method,
      url,
      headers: {
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      data: body,
    });

    return GitLabCreateUpdateFileResponseSchema.parse(response.data);
  }

  async createTree(
    projectId: string,
    files: FileOperation[],
    ref?: string
  ): Promise<GitLabTree> {
    const response = await axios.post(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        projectId
      )}/repository/tree`,
      {
        files: files.map((file) => ({
          file_path: file.path,
          content: file.content,
        })),
        ...(ref ? { ref } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return GitLabTreeSchema.parse(response.data);
  }

  async createCommit(
    projectId: string,
    message: string,
    branch: string,
    actions: FileOperation[]
  ): Promise<GitLabCommit> {
    const response = await axios.post(
      `${GITLAB_API_URL}/projects/${encodeURIComponent(
        projectId
      )}/repository/commits`,
      {
        branch,
        commit_message: message,
        actions: actions.map((action) => ({
          action: "create",
          file_path: action.path,
          content: action.content,
        })),
      },
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return GitLabCommitSchema.parse(response.data);
  }

  async searchProjects(
    query: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<GitLabSearchResponse> {
    const url = new URL(`${GITLAB_API_URL}/projects`);
    url.searchParams.append("search", query);
    url.searchParams.append("page", page.toString());
    url.searchParams.append("per_page", perPage.toString());

    const response = await axios.get(url.toString(), {
      headers: {
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      },
    });

    const projects = response.data;
    return GitLabSearchResponseSchema.parse({
      count: parseInt(response.headers["x-total"] || "0"),
      items: projects,
    });
  }

  async createRepository(
    options: z.infer<typeof CreateRepositoryOptionsSchema>
  ): Promise<GitLabRepository> {
    const response = await axios.post(
      `${GITLAB_API_URL}/projects`,
      {
        name: options.name,
        description: options.description,
        visibility: options.visibility,
        initialize_with_readme: options.initialize_with_readme,
      },
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return GitLabRepositorySchema.parse(response.data);
  }

  async getMergeRequestChanges(
    projectId: string,
    mergeRequestIid: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}/changes`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
      },
    });

    return response.data;
  }

  async approveMergeRequest(
    projectId: string,
    mergeRequestIid: number
  ): Promise<void> {
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}/approve`;

    await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  }

  async addMergeRequestComment(
    projectId: string,
    mergeRequestIid: number,
    body: string
  ): Promise<void> {
    if (!body) return;

    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}/notes`;

    await axios.post(
      url,
      { body },
      {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  }

  async createDiscussion(
    projectId: string,
    mergeRequestIid: number,
    comment: string,
    filePath: string,
    line: number
  ): Promise<void> {
    if (!comment) return;

    // Fetch merge request changes to get diff context
    const changes = await this.getMergeRequestChanges(
      projectId,
      mergeRequestIid
    );
    const diffRefs = changes.diff_refs;

    // Find the diff for the specified filePath
    const fileDiff = changes.changes.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (change: any) =>
        change.new_path === filePath || change.old_path === filePath
    );

    if (!fileDiff) return;

    // Validate line number (basic check; GitLab API will validate further)
    const isNewLine = fileDiff.diff.includes(`+`);
    if (!isNewLine) {
      // If no new lines in diff, fall back to regular comment
      await this.addMergeRequestComment(
        projectId,
        mergeRequestIid,
        `${comment} (Note: Could not create discussion thread for ${filePath}:${line} as no new lines found)`
      );
      return;
    }

    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(
      projectId
    )}/merge_requests/${mergeRequestIid}/discussions`;

    const body = {
      body: comment,
      position: {
        base_sha: diffRefs.base_sha,
        start_sha: diffRefs.start_sha,
        head_sha: diffRefs.head_sha,
        position_type: "text",
        new_path: filePath,
        new_line: line,
      },
    };

    try {
      await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // If discussion creation fails (e.g., invalid line), fall back to regular comment
      console.error(
        `Failed to create discussion for ${filePath}:${line}:`,
        error
      );
      await this.addMergeRequestComment(
        projectId,
        mergeRequestIid,
        `${comment} (Note: Failed to create discussion thread for ${filePath}:${line})`
      );
    }
  }
}

export const gitlabService = new GitLabService();
