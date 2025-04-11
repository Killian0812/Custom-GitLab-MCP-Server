import { gitlabService } from "./gitlab.service";

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
  ): Promise<{ approved: boolean; comments: string[] }> {
    ignoreFiles = [...new Set([...this.defaultIgnoreFiles, ...ignoreFiles])];

    const changes = await gitlabService.getMergeRequestChanges(
      projectId,
      mergeRequestIid
    );
    const comments: string[] = [];

    const namingRegex = /^[a-z0-9_.-]+$/;
    const reservedWords = ["delete", "update", "create"];

    const maxLineLength = 200;
    const requiredTestPattern = /(test|spec)/i;

    for (const change of changes.changes) {
      const filePath = change.new_path;

      if (ignoreFiles.includes(filePath)) {
        continue;
      }

      const fileName = filePath.split("/").pop() || "";
      if (!namingRegex.test(fileName)) {
        comments.push(
          `File ${filePath} does not follow naming conventions: use lowercase letters, numbers, underscores, hyphens, and dots only.`
        );
      }
      if (reservedWords.some((word) => fileName.includes(word))) {
        comments.push(
          `File ${filePath} contains reserved word(s). Avoid using: ${reservedWords.join(", ")}.`
        );
      }

      if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
        const diffLines = change.diff.split("\n");

        const longLines = diffLines.filter(
          (line: string) => line.startsWith("+") && line.length > maxLineLength
        );
        if (longLines.length > 0) {
          comments.push(
            `File ${filePath} has lines exceeding ${maxLineLength} characters. Please keep lines shorter.`
          );
        }

        if (!requiredTestPattern.test(change.diff)) {
          comments.push(
            `File ${filePath} lacks test references (e.g., 'test' or 'spec'). Please add tests.`
          );
        }
      }
    }

    return {
      approved: comments.length === 0,
      comments,
    };
  }
}

export const codeReviewService = new CodeReviewService();
