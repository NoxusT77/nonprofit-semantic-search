import { call, InfraiError } from "./infrai.ts";
import { embed } from "./embed.ts";
import { COLLECTION, scopeFilter, type NonprofitRecord, type SearchRequest } from "./nonprofit_records.ts";

type QueryMatch = {
  id: string;
  score: number;
  metadata?: { kind?: string; program?: string; text?: string };
};

export type SearchHit = {
  id: string;
  kind: string;
  program: string;
  text: string;
  vectorScore: number;
};

/**
 * Retrieve wide from the vector index, then let the reranker put the answer on
 * top. Both steps are plain REST calls behind the same key.
 */
export async function searchNonprofitContent(req: SearchRequest): Promise<SearchHit[]> {
  const [embedding] = await embed([req.query]);

  const result = await call<{ matches: QueryMatch[] }>("/vector/query", {
    collection: COLLECTION,
    embedding,
    top_k: Math.max(req.limit * 4, 20),
    filter: scopeFilter(req),
    include_metadata: true,
  });

  const matches = (result.matches ?? []).filter((m) => typeof m.metadata?.text === "string");
  if (matches.length === 0) return [];

  const ranked = await call<{ results: Array<{ index: number; score: number }> }>("/ai/rerank", {
    query: req.query,
    candidates: matches.map((m) => m.metadata!.text as string),
    top_k: req.limit,
  });

  return ranked.results.map((r) => {
    const match = matches[r.index];
    return {
      id: match.id,
      kind: match.metadata?.kind ?? "campaign_report",
      program: match.metadata?.program ?? "general",
      text: match.metadata!.text as string,
      vectorScore: match.score,
    };
  });
}

/** Write the corpus. Each vector carries the record id, so re-running the seed replaces rather than duplicates. */
export async function indexRecords(records: NonprofitRecord[]): Promise<number> {
  const embeddings = await embed(records.map((r) => r.text));
  await call("/vector/upsert", {
    collection: COLLECTION,
    vectors: records.map((record, i) => ({
      id: record.id,
      embedding: embeddings[i],
      metadata: { kind: record.kind, program: record.program, text: record.text },
    })),
  });
  return records.length;
}

export { InfraiError };
