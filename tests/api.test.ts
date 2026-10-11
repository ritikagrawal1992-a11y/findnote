import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../server/app";
async function fixture(t: TestContext) {
  const { app, db } = createApp(":memory:", false),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  return async (
    path: string,
    method = "GET",
    body?: unknown,
    headers?: Record<string, string>,
  ) => {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api${path}`,
      {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    return {
      status: response.status,
      data: response.status === 204 ? null : await response.json(),
    };
  };
}
test("FTS prefix and multi-term search update after create/delete; punctuation is safe", async (t) => {
  const call = await fixture(t);
  const doc = await call("/documents", "POST", {
    title: "Deployment runbook",
    body: "Database migrations require a rollback plan.",
  });
  assert.equal((await call("/documents?q=deploy")).data.length, 1);
  assert.equal((await call("/documents?q=database%20rollback")).data.length, 1);
  assert.equal((await call("/documents?q=unknown")).data.length, 0);
  assert.equal((await call("/documents?q=%22%20OR%20*")).status, 200);
  assert.equal((await call("/documents/" + doc.data.id, "DELETE")).status, 204);
  assert.equal((await call("/documents?q=deploy")).data.length, 0);
});
