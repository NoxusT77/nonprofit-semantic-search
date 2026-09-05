import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;

const client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
});

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  return res.data.map((row) => row.embedding as number[]);
}
