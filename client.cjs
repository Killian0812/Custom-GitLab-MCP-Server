const { spawn } = require("child_process");

const server = spawn("node", ["dist/index.js"], {
  stdio: ["pipe", "pipe", "inherit"],
});

function sendRequest(request) {
  return new Promise((resolve, reject) => {
    server.stdin.write(JSON.stringify(request) + "\n");
    server.stdout.once("data", (data) => {
      resolve(JSON.parse(data.toString()));
    });
    server.on("error", reject);
  });
}

const listToolsRequest = {
  id: "1",
  type: "request",
  schema: "ListToolsRequest",
  params: {},
};

sendRequest(listToolsRequest)
  .then((response) => console.log("Tools:", response))
  .catch((err) => console.error("Error:", err));
