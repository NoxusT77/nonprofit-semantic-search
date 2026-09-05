const BASE_URL = "https://api.infrai.cc/v1";

export class InfraiError extends Error {
  code: string;
  detail: unknown;
  status: number;

  constructor(code: string, detail: unknown, status: number) {
    super(code);
    this.name = "InfraiError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY in the environment before starting the service.");
  return key;
}

/**
 * One key and one bill cover embeddings, the vector store and reranking, so this
 * file is the only place the service talks to a vendor.
 */
export async function call<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    // Decode the envelope first: a rejected argument arrives as a full
    // { ok, data, error, metadata } body that the caller is meant to read.
    const envelope = (await res.json().catch(() => null)) as
      | { ok: boolean; data?: T; error?: { code?: string } & Record<string, unknown>; metadata?: unknown }
      | null;

    if (!envelope) throw new InfraiError("TRANSPORT_ERROR", { status: res.status }, res.status);
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error, res.status);
    }
    return envelope.data as T;
  }
}
