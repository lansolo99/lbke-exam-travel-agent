import { createServer } from "node:http";
import { randomUUID, timingSafeEqual, createHash } from "node:crypto";

const PORT = process.env.WRAPPER_PORT || 8080;
const MASTRA_URL =
  process.env.MASTRA_AGENT_URL ||
  "http://127.0.0.1:4111/api/agents/travel-agent/generate";
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

function lastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i].content;
  }
  return null;
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

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    sendJson(res, 400, { error: "messages must be a non-empty array" });
    return;
  }

  const userContent = lastUserMessage(messages);
  if (!userContent) {
    sendJson(res, 400, { error: "No user message found" });
    return;
  }

  const threadId = body?.metadata?.thread_id || randomUUID();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const mastraRes = await fetch(MASTRA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: userContent }],
        threadId,
        resourceId: threadId,
      }),
      signal: controller.signal,
    });

    if (!mastraRes.ok) {
      console.error(
        `Mastra agent error: ${mastraRes.status} ${await mastraRes.text().catch(() => "")}`,
      );
      sendJson(res, 502, { error: "Agent invocation failed" });
      return;
    }

    const data = await mastraRes.json();
    const text = data?.text;
    if (typeof text !== "string") {
      console.error("Unexpected Mastra response shape:", JSON.stringify(data));
      sendJson(res, 502, { error: "Unexpected agent response" });
      return;
    }

    sendJson(res, 200, {
      response: { role: "assistant", content: text },
      metadata: { thread_id: threadId },
    });
  } catch (err) {
    console.error("Wrapper error:", err?.message || err);
    sendJson(res, 502, { error: "Agent invocation failed" });
  } finally {
    clearTimeout(timeout);
  }
});

server.listen(PORT, () => {
  console.log(`Hub wrapper listening on http://127.0.0.1:${PORT}/giskard/invoke`);
});
