import { z } from "zod";
import {
  CreateBranchSchema,
  CreateIssueSchema,
  CreateMergeRequestSchema,
  CreateOrUpdateFileSchema,
  CreateRepositorySchema,
  ForkRepositorySchema,
  GetFileContentsSchema,
  PushFilesSchema,
  ReviewMergeRequestSchema,
  SearchRepositoriesSchema,
} from "../schemas";
import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { gitlabService } from "../services/gitlab.service";
import { codeReviewService } from "../services/code-review.service";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const callToolController = async (request: CallToolRequest) => {
  try {
    if (!request.params.arguments) {
      throw new Error("Arguments are required");
    }

    switch (request.params.name) {
      case "fork_repository": {
        const args = ForkRepositorySchema.parse(request.params.arguments);
        const fork = await gitlabService.forkProject(
          args.project_id,
          args.namespace
        );
        return {
          content: [{ type: "text", text: JSON.stringify(fork, null, 2) }],
        };
      }

      case "create_branch": {
        const args = CreateBranchSchema.parse(request.params.arguments);
        let ref = args.ref;
        if (!ref) {
          ref = await gitlabService.getDefaultBranchRef(args.project_id);
        }

        const branch = await gitlabService.createBranch(args.project_id, {
          name: args.branch,
          ref,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
        };
      }

      case "search_repositories": {
        const args = SearchRepositoriesSchema.parse(request.params.arguments);
        const results = await gitlabService.searchProjects(
          args.search,
          args.page,
          args.per_page
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      }

      case "create_repository": {
        const args = CreateRepositorySchema.parse(request.params.arguments);
        const repository = await gitlabService.createRepository(args);
        return {
          content: [
            { type: "text", text: JSON.stringify(repository, null, 2) },
          ],
        };
      }

      case "get_file_contents": {
        const args = GetFileContentsSchema.parse(request.params.arguments);
        const contents = await gitlabService.getFileContents(
          args.project_id,
          args.file_path,
          args.ref
        );
        return {
          content: [{ type: "text", text: JSON.stringify(contents, null, 2) }],
        };
      }

      case "create_or_update_file": {
        const args = CreateOrUpdateFileSchema.parse(request.params.arguments);
        const result = await gitlabService.createOrUpdateFile(
          args.project_id,
          args.file_path,
          args.content,
          args.commit_message,
          args.branch,
          args.previous_path
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "push_files": {
        const args = PushFilesSchema.parse(request.params.arguments);

        if (args.branch.toLowerCase() === "main") {
          throw new Error(
            "Committing directly to the 'main' branch is not allowed."
          );
        }

        const result = await gitlabService.createCommit(
          args.project_id,
          args.commit_message,
          args.branch,
          args.files.map((f) => ({ path: f.file_path, content: f.content }))
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "create_issue": {
        const args = CreateIssueSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const issue = await gitlabService.createIssue(project_id, options);
        return {
          content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "create_merge_request": {
        const args = CreateMergeRequestSchema.parse(request.params.arguments);
        const { project_id, ...options } = args;
        const mergeRequest = await gitlabService.createMergeRequest(
          project_id,
          options
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(mergeRequest, null, 2) },
          ],
        };
      }

      case "review_code": {
        const args = ReviewMergeRequestSchema.parse(request.params.arguments);
        const review = await codeReviewService.reviewCode(
          args.project_id,
          args.merge_request_iid,
          args.ignore_files
        );

        if (review.approved) {
          await gitlabService.approveMergeRequest(
            args.project_id,
            args.merge_request_iid
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "approved",
                    message:
                      "Merge request meets naming and coding standards. Approved successfully.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          for (const comment of review.comments) {
            await gitlabService.addMergeRequestComment(
              args.project_id,
              args.merge_request_iid,
              comment
            );
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "comments_added",
                    comments: review.comments,
                    message:
                      "Merge request does not meet standards. Comments added.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`
      );
    }
    throw error;
  }
};

export default callToolController;
