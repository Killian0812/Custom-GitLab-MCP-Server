#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { GitLabForkSchema, GitLabReferenceSchema, GitLabRepositorySchema, GitLabIssueSchema, GitLabMergeRequestSchema, GitLabContentSchema, GitLabCreateUpdateFileResponseSchema, GitLabSearchResponseSchema, GitLabTreeSchema, GitLabCommitSchema, CreateOrUpdateFileSchema, SearchRepositoriesSchema, CreateRepositorySchema, GetFileContentsSchema, PushFilesSchema, CreateIssueSchema, CreateMergeRequestSchema, ForkRepositorySchema, CreateBranchSchema, ReviewMergeRequestSchema, } from "./schemas.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
const server = new Server({
    name: "gitlab-mcp-server",
    version: "0.5.1",
}, {
    capabilities: {
        tools: {},
    },
});
const GITLAB_PERSONAL_ACCESS_TOKEN = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
const GITLAB_API_URL = process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";
if (!GITLAB_PERSONAL_ACCESS_TOKEN) {
    console.error("GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set");
    process.exit(1);
}
async function forkProject(projectId, namespace) {
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/fork`;
    const queryParams = namespace
        ? `?namespace=${encodeURIComponent(namespace)}`
        : "";
    const response = await fetch(url + queryParams, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabForkSchema.parse(await response.json());
}
async function createBranch(projectId, options) {
    const response = await fetch(`${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/branches`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            branch: options.name,
            ref: options.ref,
        }),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabReferenceSchema.parse(await response.json());
}
async function getDefaultBranchRef(projectId) {
    const response = await fetch(`${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}`, {
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        },
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    const project = GitLabRepositorySchema.parse(await response.json());
    return project.default_branch;
}
async function getFileContents(projectId, filePath, ref) {
    const encodedPath = encodeURIComponent(filePath);
    let url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/files/${encodedPath}`;
    if (ref) {
        url += `?ref=${encodeURIComponent(ref)}`;
    }
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        },
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    const data = GitLabContentSchema.parse(await response.json());
    if (!Array.isArray(data) && data.content) {
        data.content = Buffer.from(data.content, "base64").toString("utf8");
    }
    return data;
}
async function createIssue(projectId, options) {
    const response = await fetch(`${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/issues`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            title: options.title,
            description: options.description,
            assignee_ids: options.assignee_ids,
            milestone_id: options.milestone_id,
            labels: options.labels?.join(","),
        }),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabIssueSchema.parse(await response.json());
}
async function createMergeRequest(projectId, options) {
    const response = await fetch(`${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            title: options.title,
            description: options.description,
            source_branch: options.source_branch,
            target_branch: options.target_branch,
            allow_collaboration: options.allow_collaboration,
            draft: options.draft,
        }),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabMergeRequestSchema.parse(await response.json());
}
async function createOrUpdateFile(projectId, filePath, content, commitMessage, branch, previousPath) {
    const encodedPath = encodeURIComponent(filePath);
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/files/${encodedPath}`;
    const body = {
        branch,
        content,
        commit_message: commitMessage,
        ...(previousPath ? { previous_path: previousPath } : {}),
    };
    // Check if file exists
    let method = "POST";
    try {
        await getFileContents(projectId, filePath, branch);
        method = "PUT";
    }
    catch (error) {
        // File doesn't exist, use POST
    }
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabCreateUpdateFileResponseSchema.parse(await response.json());
}
async function createTree(projectId, files, ref) {
    const response = await fetch(`${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/tree`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            files: files.map((file) => ({
                file_path: file.path,
                content: file.content,
            })),
            ...(ref ? { ref } : {}),
        }),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabTreeSchema.parse(await response.json());
}
async function createCommit(projectId, message, branch, actions) {
    const response = await fetch(`${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/commits`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            branch,
            commit_message: message,
            actions: actions.map((action) => ({
                action: "create",
                file_path: action.path,
                content: action.content,
            })),
        }),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabCommitSchema.parse(await response.json());
}
async function searchProjects(query, page = 1, perPage = 20) {
    const url = new URL(`${GITLAB_API_URL}/projects`);
    url.searchParams.append("search", query);
    url.searchParams.append("page", page.toString());
    url.searchParams.append("per_page", perPage.toString());
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        },
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    const projects = await response.json();
    return GitLabSearchResponseSchema.parse({
        count: parseInt(response.headers.get("X-Total") || "0"),
        items: projects,
    });
}
async function createRepository(options) {
    const response = await fetch(`${GITLAB_API_URL}/projects`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: options.name,
            description: options.description,
            visibility: options.visibility,
            initialize_with_readme: options.initialize_with_readme,
        }),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return GitLabRepositorySchema.parse(await response.json());
}
async function getMergeRequestChanges(projectId, mergeRequestIid) {
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/changes`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
        },
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
    return await response.json();
}
async function approveMergeRequest(projectId, mergeRequestIid) {
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/approve`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
}
async function addMergeRequestComment(projectId, mergeRequestIid, body) {
    const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/merge_requests/${mergeRequestIid}/notes`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${GITLAB_PERSONAL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
    });
    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`);
    }
}
const defaultIgnoreFiles = [
    ".gitignore",
    "VERSION.md", "pubspec.yaml",
    "pubspec.lock", "README.md",
    "LICENSE", "LICENSE.md",
    "package.json",
    "package-lock.json",
];
// Single review_code function with naming/coding standards
async function reviewCode(projectId, mergeRequestIid, ignoreFiles = []) {
    // Merge the default ignore files with the provided ones
    ignoreFiles = [...new Set([...defaultIgnoreFiles, ...ignoreFiles])];
    const changes = await getMergeRequestChanges(projectId, mergeRequestIid);
    const comments = [];
    // Naming standards
    const namingRegex = /^[a-z0-9_-]+$/; // Lowercase, numbers, underscores, hyphens only
    const reservedWords = ["delete", "update", "create"]; // Example reserved words
    // Coding standards
    const maxLineLength = 120;
    const requiredTestPattern = /(test|spec)/i;
    for (const change of changes.changes) {
        const filePath = change.new_path;
        // Skip ignored files
        if (ignoreFiles.includes(filePath)) {
            continue;
        }
        // Check naming conventions
        const fileName = filePath.split("/").pop() || "";
        if (!namingRegex.test(fileName)) {
            comments.push(`File ${filePath} does not follow naming conventions: use lowercase letters, numbers, underscores, or hyphens only.`);
        }
        if (reservedWords.some((word) => fileName.includes(word))) {
            comments.push(`File ${filePath} contains reserved word(s). Avoid using: ${reservedWords.join(", ")}.`);
        }
        // Check coding standards for JS/TS files
        if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
            const diffLines = change.diff.split("\n");
            // Check line length
            const longLines = diffLines.filter((line) => line.startsWith("+") && line.length > maxLineLength);
            if (longLines.length > 0) {
                comments.push(`File ${filePath} has lines exceeding ${maxLineLength} characters. Please keep lines shorter.`);
            }
            // Check for test references
            if (!requiredTestPattern.test(change.diff)) {
                comments.push(`File ${filePath} lacks test references (e.g., 'test' or 'spec'). Please add tests.`);
            }
        }
    }
    return {
        approved: comments.length === 0,
        comments,
    };
}
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "create_or_update_file",
                description: "Create or update a single file in a GitLab project",
                inputSchema: zodToJsonSchema(CreateOrUpdateFileSchema),
            },
            {
                name: "search_repositories",
                description: "Search for GitLab projects",
                inputSchema: zodToJsonSchema(SearchRepositoriesSchema),
            },
            {
                name: "create_repository",
                description: "Create a new GitLab project",
                inputSchema: zodToJsonSchema(CreateRepositorySchema),
            },
            {
                name: "get_file_contents",
                description: "Get the contents of a file or directory from a GitLab project",
                inputSchema: zodToJsonSchema(GetFileContentsSchema),
            },
            {
                name: "push_files",
                description: "Push multiple files to a GitLab project in a single commit",
                inputSchema: zodToJsonSchema(PushFilesSchema),
            },
            {
                name: "create_issue",
                description: "Create a new issue in a GitLab project",
                inputSchema: zodToJsonSchema(CreateIssueSchema),
            },
            {
                name: "create_merge_request",
                description: "Create a new merge request in a GitLab project",
                inputSchema: zodToJsonSchema(CreateMergeRequestSchema),
            },
            {
                name: "fork_repository",
                description: "Fork a GitLab project to your account or specified namespace",
                inputSchema: zodToJsonSchema(ForkRepositorySchema),
            },
            {
                name: "create_branch",
                description: "Create a new branch in a GitLab project",
                inputSchema: zodToJsonSchema(CreateBranchSchema),
            },
            {
                name: "review_code",
                description: "Review a merge request for naming and coding standards, approving if met or commenting if not",
                inputSchema: zodToJsonSchema(ReviewMergeRequestSchema),
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (!request.params.arguments) {
            throw new Error("Arguments are required");
        }
        switch (request.params.name) {
            case "fork_repository": {
                const args = ForkRepositorySchema.parse(request.params.arguments);
                const fork = await forkProject(args.project_id, args.namespace);
                return {
                    content: [{ type: "text", text: JSON.stringify(fork, null, 2) }],
                };
            }
            case "create_branch": {
                const args = CreateBranchSchema.parse(request.params.arguments);
                let ref = args.ref;
                if (!ref) {
                    ref = await getDefaultBranchRef(args.project_id);
                }
                const branch = await createBranch(args.project_id, {
                    name: args.branch,
                    ref,
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(branch, null, 2) }],
                };
            }
            case "search_repositories": {
                const args = SearchRepositoriesSchema.parse(request.params.arguments);
                const results = await searchProjects(args.search, args.page, args.per_page);
                return {
                    content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
                };
            }
            case "create_repository": {
                const args = CreateRepositorySchema.parse(request.params.arguments);
                const repository = await createRepository(args);
                return {
                    content: [
                        { type: "text", text: JSON.stringify(repository, null, 2) },
                    ],
                };
            }
            case "get_file_contents": {
                const args = GetFileContentsSchema.parse(request.params.arguments);
                const contents = await getFileContents(args.project_id, args.file_path, args.ref);
                return {
                    content: [{ type: "text", text: JSON.stringify(contents, null, 2) }],
                };
            }
            case "create_or_update_file": {
                const args = CreateOrUpdateFileSchema.parse(request.params.arguments);
                const result = await createOrUpdateFile(args.project_id, args.file_path, args.content, args.commit_message, args.branch, args.previous_path);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "push_files": {
                const args = PushFilesSchema.parse(request.params.arguments);
                if (args.branch.toLowerCase() === "main") {
                    throw new Error("Committing directly to the 'main' branch is not allowed.");
                }
                const result = await createCommit(args.project_id, args.commit_message, args.branch, args.files.map((f) => ({ path: f.file_path, content: f.content })));
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            case "create_issue": {
                const args = CreateIssueSchema.parse(request.params.arguments);
                const { project_id, ...options } = args;
                const issue = await createIssue(project_id, options);
                return {
                    content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
                };
            }
            case "create_merge_request": {
                const args = CreateMergeRequestSchema.parse(request.params.arguments);
                const { project_id, ...options } = args;
                const mergeRequest = await createMergeRequest(project_id, options);
                return {
                    content: [
                        { type: "text", text: JSON.stringify(mergeRequest, null, 2) },
                    ],
                };
            }
            case "review_code": {
                const args = ReviewMergeRequestSchema.parse(request.params.arguments);
                const review = await reviewCode(args.project_id, args.merge_request_iid, args.ignore_files);
                if (review.approved) {
                    await approveMergeRequest(args.project_id, args.merge_request_iid);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    status: "approved",
                                    message: "Merge request meets naming and coding standards. Approved successfully.",
                                }, null, 2),
                            },
                        ],
                    };
                }
                else {
                    for (const comment of review.comments) {
                        await addMergeRequestComment(args.project_id, args.merge_request_iid, comment);
                    }
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    status: "comments_added",
                                    comments: review.comments,
                                    message: "Merge request does not meet standards. Comments added.",
                                }, null, 2),
                            },
                        ],
                    };
                }
            }
            default:
                throw new Error(`Unknown tool: ${request.params.name}`);
        }
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid arguments: ${error.errors
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join(", ")}`);
        }
        throw error;
    }
});
async function runServer() {
    const transportType = process.env.TRANSPORT || "stdio";
    if (transportType === "stdio") {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("GitLab MCP Server running on stdio");
    }
    else if (transportType === "sse") {
        const app = express();
        // SSE endpoint using SSEServerTransport
        app.get("/mcp/stream", async (req, res) => {
            const transport = new SSEServerTransport("/mcp/messages", res);
            await server.connect(transport);
            res.on("close", () => {
                server.close();
            });
        });
        // Endpoint to receive messages from clients
        app.post("/mcp/messages", (req, res) => {
            const transport = server["transport"];
            if (transport) {
                transport.handlePostMessage(req, res);
            }
            else {
                res.status(400).send("No active SSE transport");
            }
        });
        // Http transport
        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
            console.log(`GitLab MCP Server running with SSE on http://localhost:${PORT}`);
        });
    }
    else {
        console.error(`Unknown transport type: ${transportType}`);
        process.exit(1);
    }
}
runServer().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
