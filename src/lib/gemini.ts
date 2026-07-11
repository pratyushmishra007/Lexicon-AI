import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY!;

if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

export const ai = new GoogleGenAI({ apiKey });

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: text,
      config: { outputDimensionality: 768 },
    });
    if (!response.embeddings || !response.embeddings[0].values) {
      throw new Error("Gemini returned an empty embedding");
    }
    return response.embeddings[0].values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
