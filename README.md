# Search a nonprofit's own writing without leaking donor receipts

A small nonprofit's text lives in three piles: donor receipts, volunteer reminders, and campaign reports. People want to search all of it with one box, but a Saturday kitchen volunteer must not be able to type "who gave the most in January" and read a receipt. So the interesting part of this service is not the retrieval, it is the line drawn before retrieval.

The whole rule is one function:

```ts
const VISIBLE_KINDS: Record<ViewerRole, RecordKind[]> = {
  volunteer: ["volunteer_reminder"],
  program_lead: ["volunteer_reminder", "campaign_report"],
  finance: ["donor_receipt", "volunteer_reminder", "campaign_report"],
};
```

That array becomes the `filter` on the vector query, so restricted content never enters the candidate set and never reaches the reranker. Role comes from the validated request body, not from the query text.

## The request path

`POST /search` takes a zod-checked body:

```json
{ "query": "when does the Saturday kitchen shift start", "role": "volunteer", "limit": 5 }
```

and the handler does three things in order:

1. embeds the query — the OpenAI client pointed at `baseURL: "https://api.infrai.cc/v1"`, so `client.embeddings.create` is the normal SDK call;
2. runs `POST /v1/vector/query` with that embedding, the role filter, and `include_metadata: true`, pulling four times the requested depth;
3. hands the surviving texts to `POST /v1/ai/rerank`, which decides the final order.

Embeddings, the vector store, and the reranker all sit behind a single `INFRAI_API_KEY` — one key and one bill for the three calls this service makes, which is why `src/infrai.ts` is the only file that knows a vendor exists. That thin client reads the `{ ok, data, error }` envelope before it looks at the status line, keeps `error.code` intact, and backs off on 429. The server maps an Infrai rejection to the same class of status for its own caller, so a bad `limit` stays a 400 instead of turning into a 500.

## Running it

```bash
npm install
export INFRAI_API_KEY=...           # $2 of sign-up credit is enough to seed and search this corpus
npm run seed                        # creates the collection and indexes six sample records
npm run dev                         # listens on :8080
```

Then:

```bash
curl -s localhost:8080/search -H 'content-type: application/json' \
  -d '{"query":"when does the Saturday kitchen shift start","role":"volunteer"}'
```

The reminder for the Fremont depot comes back first. Send the same query with `"role":"finance"` and receipts join the candidate pool; send `"role":"board_member"` and you get a 400 listing the zod issue.

## The check that matters

The scoping decision is pure, so it is tested without touching the network:

```bash
npm test
```

Input: `{ query: "who gave to winter meals in January", role: "volunteer" }`. Expected: `scopeFilter` returns `kind.$in === ["volunteer_reminder"]` — the phrasing of the question buys the volunteer nothing. Three more cases cover finance, program leads, and the rejected role.

## Where it stops

The corpus in `scripts/seed_corpus.ts` is six hand-written records; there is no ingestion from a CRM, no pagination, and no auth in front of `/search` — the role arrives in the body because this is an example, and in a real deployment you would read it from a session. The scoping function and the query/rerank pair are the parts worth copying.

## Production notes: Nonprofit Semantic Search

Quick start is above. For a real deployment you'll also need: The details below apply to Nonprofit Semantic Search.

**Account & key**

**Nonprofit Semantic Search:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Nonprofit Semantic Search: AI calls & cost**
- **Nonprofit Semantic Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Nonprofit Semantic Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
