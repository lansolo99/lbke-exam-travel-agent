import { createServer } from "node:http";
import { timingSafeEqual, createHash } from "node:crypto";

const PORT = process.env.WRAPPER_PORT || 8081;
const MASTRA_BASE_URL = process.env.MASTRA_WORKFLOW_BASE_URL || "http://localhost:4111";
const WORKFLOW_ID = "travelSearchWorkflow";
const WRAPPER_API_KEY = process.env.AGENT_WRAPPER_API_KEY;
const REQUEST_TIMEOUT_MS = 30_000;

if (!WRAPPER_API_KEY) {
  console.error("AGENT_WRAPPER_API_KEY must be set (and non-empty).");
  process.exit(1);
}

function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function runWorkflow(inputData, signal) {
  const createRunRes = await fetch(
    `${MASTRA_BASE_URL}/api/workflows/${WORKFLOW_ID}/create-run`,
    { method: "POST", signal },
  );
  if (!createRunRes.ok) {
    throw new Error(`create-run failed: ${createRunRes.status}`);
  }
  const { runId } = await createRunRes.json();

  const startRes = await fetch(
    `${MASTRA_BASE_URL}/api/workflows/${WORKFLOW_ID}/start-async?runId=${runId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputData }),
      signal,
    },
  );
  if (!startRes.ok) {
    throw new Error(`start-async failed: ${startRes.status}`);
  }
  const run = await startRes.json();
  if (run.status !== "success") {
    throw new Error(`workflow run did not succeed: ${run.status}`);
  }
  return run.result;
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/giskard/invoke") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const providedKey = req.headers["x-api-key"];
  if (!providedKey || !safeEqual(providedKey, WRAPPER_API_KEY)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }

  if (typeof body?.location !== "string" || body.location.length === 0) {
    sendJson(res, 400, { error: "'location' must be a non-empty string" });
    return;
  }
  if (typeof body.maxPrice !== "number") {
    sendJson(res, 400, { error: "'maxPrice' must be a number" });
    return;
  }

  const inputData = { location: body.location, maxPrice: body.maxPrice };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await runWorkflow(inputData, controller.signal);
    // Structured agent: return the output object directly, no chat envelope.
    sendJson(res, 200, result);
  } catch (err) {
    console.error("Wrapper error:", err?.message || err);
    sendJson(res, 502, { error: "Workflow invocation failed" });
  } finally {
    clearTimeout(timeout);
  }
});

server.listen(PORT, () => {
  console.log(`Structured Hub wrapper listening on http://127.0.0.1:${PORT}/giskard/invoke`);
});
