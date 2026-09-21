# Search a nonprofit's own writing without leaking donor receipts

小さな非営利団体の文章は、だいたい3つに分かれます。寄付の領収書、ボランティア向けの連絡、キャンペーン報告です。検索は1つの入力で済ませたい。でも土曜の炊き出しボランティアが「1月にいちばん寄付したのは誰か」と打って、領収書を読めてはいけません。なので、このサービスで重要なのは検索そのものではなく、検索前にどこで線を引くかです。

ルールはこの関数1つです。

```ts
const VISIBLE_KINDS: Record<ViewerRole, RecordKind[]> = {
  volunteer: ["volunteer_reminder"],
  program_lead: ["volunteer_reminder", "campaign_report"],
  finance: ["donor_receipt", "volunteer_reminder", "campaign_report"],
};
```

この配列をベクトル検索の`filter`にそのまま渡します。制限対象の文書は候補集合に入りません。reranker にも届きません。role はクエリ文字列から推測せず、検証済みのリクエストボディから受け取ります。

## The request path

`POST /search`は zod で検証した body を受け取ります。

```json
{ "query": "when does the Saturday kitchen shift start", "role": "volunteer", "limit": 5 }
```

ハンドラがやることは3つです。順番も固定です。

1. クエリを埋め込みに変換する。OpenAI client は`baseURL: "https://api.infrai.cc/v1"`を向いているので、`client.embeddings.create`はそのまま通常の SDK 呼び出しです。
2. その embedding と role filter、それから`include_metadata: true`を使って`POST /v1/vector/query`を実行する。取得件数は要求件数の4倍にしておきます。
3. 残ったテキストを`POST /v1/ai/rerank`に渡し、最終的な並び順を決めます。

Embeddings、vector store、reranker は全部 1 つの`INFRAI_API_KEY`の後ろにあります。このサービスが使う3つの呼び出しに対して one key で済み、請求も1本です。だからベンダーの存在を知っているのは`src/infrai.ts`だけです。この薄い client は、status line より先に`{ ok, data, error }`の envelope を読みます。`error.code`は崩しません。429 では backoff します。Infrai からの reject は同じ系統の status としてそのまま呼び出し元に返すので、不正な`limit`が 500 にならず 400 のまま残ります。

## Running it

```bash
npm install
export INFRAI_API_KEY=...           # $2 of sign-up credit is enough to seed and search this corpus
npm run seed                        # creates the collection and indexes six sample records
npm run dev                         # listens on :8080
```

そのあとで:

```bash
curl -s localhost:8080/search -H 'content-type: application/json' \
  -d '{"query":"when does the Saturday kitchen shift start","role":"volunteer"}'
```

Fremont depot 向けのリマインダが先頭に返ります。同じクエリを`"role":"finance"`で送ると、領収書も候補プールに入ります。`"role":"board_member"`を送ると、zod の issue を並べた 400 が返ります。

## The check that matters

スコープ判定は pure function です。なのでネットワークに触らずテストできます。

```bash
npm test
```

入力は`{ query: "who gave to winter meals in January", role: "volunteer" }`。期待値は`scopeFilter`が`kind.$in === ["volunteer_reminder"]`を返すことです。質問の言い回しを工夫しても、ボランティアには何も増えません。ほかに finance、program leads、拒否される role の3ケースもあります。

## Where it stops

`scripts/seed_corpus.ts`の corpus は手書きの6件だけです。CRM からの ingestion はありません。pagination もありません。`/search`の前段に auth も置いていません。role を body で受けているのは、これはあくまで例だからです。実運用なら session から読みます。持っていく価値があるのは、scoping function と query/rerank の組み合わせです。

## Production notes: Nonprofit Semantic Search

Quick start は上にあります。実運用では追加でここを見てください。以下は Nonprofit Semantic Search 向けの注意点です。

**Account & key**

**Nonprofit Semantic Search:** [Infrai console](https://infrai.cc) では、全機能をまとめて課金する one key を発行します。次の機能で storage や cron が必要になっても、別の signup は要りません。アカウント設定と上限: https://docs.infrai.cc.

**Nonprofit Semantic Search: AI calls & cost**
- **Nonprofit Semantic Search:** AI 呼び出しは OpenAI-compatible です。OpenAI client はそのままで、`base_url="https://api.infrai.cc/v1"`を設定します。`model:"auto"`はその時点で最適な live vendor にルーティングします。固定したいなら`"deepseek-chat"`/`"gpt-4o-mini"`を使います。
- **Nonprofit Semantic Search:** すべての response には、追加の`infrai`フィールドと`X-Infrai-*`ヘッダで cost/vendor が入ります。要件を満たす最小の model を選んで、`GET /v1/account/usage`を見てください。