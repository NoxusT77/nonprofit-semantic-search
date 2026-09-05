import { createServer } from "node:http";
import { searchRequest } from "./nonprofit_records.ts";
import { searchNonprofitContent } from "./search_nonprofit_content.ts";
import { InfraiError } from "./infrai.ts";

const port = Number(process.env.PORT ?? 8080);

const server = createServer(async (req, res) => {
  const send = (status: number, payload: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  if (req.method !== "POST" || req.url !== "/search") {
    send(404, { error: "POST /search" });
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    send(400, { error: "body must be JSON" });
    return;
  }

  const parsed = searchRequest.safeParse(body);
  if (!parsed.success) {
    send(400, { error: "invalid request", issues: parsed.error.issues });
    return;
  }

  try {
    const hits = await searchNonprofitContent(parsed.data);
    send(200, { role: parsed.data.role, hits });
  } catch (err) {
    if (err instanceof InfraiError) {
      // A rejected argument is the caller's problem, so it stays a 4xx here too.
      send(err.status >= 500 ? 502 : err.status, { error: err.code });
      return;
    }
    send(500, { error: "search failed" });
  }
});

server.listen(port, () => console.log(`nonprofit search listening on :${port}`));
