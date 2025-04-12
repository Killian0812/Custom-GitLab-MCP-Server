import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import express from "express";
import dotenv from "dotenv";
dotenv.config();

import {
  CreateOrUpdateFileSchema,
  SearchRepositoriesSchema,
  CreateRepositorySchema,
  GetFileContentsSchema,
  PushFilesSchema,
  CreateIssueSchema,
  CreateMergeRequestSchema,
  ForkRepositorySchema,
  CreateBranchSchema,
  ReviewMergeRequestSchema,
} from "./schemas";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { readFileSync } from "fs";
import { join } from "path";
import callToolController from "./controller/call-tool.controller";
import webhookRouter from "./controller/routes/webhook.route";

const server = new Server(
  {
    name: "gitlab-mcp-server",
    version: "0.5.1",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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
        description:
          "Get the contents of a file or directory from a GitLab project",
        inputSchema: zodToJsonSchema(GetFileContentsSchema),
      },
      {
        name: "push_files",
        description:
          "Push multiple files to a GitLab project in a single commit",
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
        description:
          "Fork a GitLab project to your account or specified namespace",
        inputSchema: zodToJsonSchema(ForkRepositorySchema),
      },
      {
        name: "create_branch",
        description: "Create a new branch in a GitLab project",
        inputSchema: zodToJsonSchema(CreateBranchSchema),
      },
      {
        name: "review_code",
        description:
          "Review a merge request for naming and coding standards, approving if met or commenting if not",
        inputSchema: zodToJsonSchema(ReviewMergeRequestSchema),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, callToolController);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function runServer() {
  const transportType = process.env.TRANSPORT;

  if (transportType === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("GitLab MCP Server running on stdio");
  } else {
    const app = express();

    app.use(express.json()); // Middleware to parse JSON requests

    app.get("/health", (req, res) => {
      const versionFilePath = join(__dirname, "..", "version.json");
      const versionData = JSON.parse(readFileSync(versionFilePath, "utf8"));

      res.status(200).json({ version: versionData.version });
    });

    // Register the webhook router
    app.use("/api", webhookRouter);

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
      const transport = server["transport"] as SSEServerTransport;
      if (transport) {
        transport.handlePostMessage(req, res);
      } else {
        res.status(400).send("No active SSE transport");
      }
    });

    // Http transport
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(
        `GitLab MCP Server running with SSE on http://localhost:${PORT}`
      );
    });
  }
}

runServer().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
