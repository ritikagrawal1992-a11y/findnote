import type { Express } from "express";
import type { Store } from "../store";
import { fail, text, integer } from "../validation";

export function registerSearch(app: Express, { all, run }: Store) {
  app.get("/api/documents", (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length > 200) fail(400, "Search must be at most 200 characters.");
    if (!q) {
      res.json(all("SELECT * FROM documents ORDER BY id DESC"));
      return;
    }
    const words = q.match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!words.length) {
      res.json([]);
      return;
    }
    const query = words.map((w) => `"${w}"*`).join(" AND ");
    res.json(
      all(
        `SELECT d.*,bm25(document_fts) AS rank FROM document_fts JOIN documents d ON d.id=document_fts.rowid WHERE document_fts MATCH ? ORDER BY rank LIMIT 50`,
        query,
      ),
    );
  });
  app.post("/api/documents", (req, res) => {
    const title = text(req.body.title, "Document title"),
      body = text(req.body.body, "Document body", 20000);
    const result = run(
      "INSERT INTO documents(title,body) VALUES(?,?)",
      title,
      body,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });
  app.delete("/api/documents/:id", (req, res) => {
    if (
      !run(
        "DELETE FROM documents WHERE id=?",
        integer(Number(req.params.id), "Document ID", 1),
      ).changes
    )
      fail(404, "Document not found.");
    res.status(204).end();
  });
}
