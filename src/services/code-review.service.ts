import { gitlabService } from "./gitlab.service";
import { chatGptService } from "./chatgpt.service";

interface ReviewResult {
  score: number;
  overallComment: string;
  specificComments: Array<{
    filePath: string;
    line: number;
    comment: string;
  }>;
}

class CodeReviewService {
  defaultIgnoreFiles = [
    ".gitignore",
    "VERSION.md",
    "pubspec.yaml",
    "pubspec.lock",
    "README.md",
    "LICENSE",
    "LICENSE.md",
    "package.json",
    "package-lock.json",
  ];

  async reviewCode(
    projectId: string,
    mergeRequestIid: number,
    ignoreFiles: string[] = []
  ): Promise<ReviewResult> {
    ignoreFiles = [...new Set([...this.defaultIgnoreFiles, ...ignoreFiles])];

    const changes = await gitlabService.getMergeRequestChanges(
      projectId,
      mergeRequestIid
    );

    // Filter out ignored files
    const filteredChanges = changes.changes.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (change: any) => !ignoreFiles.includes(change.new_path)
    );

    // Use LLM to review the changes
    const reviewResult = await chatGptService.reviewChanges(filteredChanges);

    return reviewResult;
  }
}

export const codeReviewService = new CodeReviewService();
