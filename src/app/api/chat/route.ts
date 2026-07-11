import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateEmbedding } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { getCachedResponse, setCachedResponse, ratelimit } from "@/lib/redis";

// Initialize the Google provider with our custom env variable
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

// Set runtime to edge or nodejet
export const runtime = 'edge';

// We need to define the type that our Supabase RPC function returns
interface DocumentChunk {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
}

export async function POST(req: Request) {
  try {
    // --- REDIS RATE LIMITING ---
    // Protect the API from spam by tracking the IP address
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    if (process.env.UPSTASH_REDIS_REST_URL) {
      const { success, limit, reset, remaining } = await ratelimit.limit(ip);
      if (!success) {
        console.log(`🔴 RATE LIMIT EXCEEDED FOR IP: ${ip}`);
        return new Response(
          JSON.stringify({ 
            error: "Too many requests. Please wait 60 seconds before asking another question." 
          }), 
          { 
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString()
            }
          }
        );
      }
    }
    const { messages } = await req.json();

    // Get the latest message from the user
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || latestMessage.role !== 'user') {
      return new Response("Missing user message", { status: 400 });
    }

    // Extract text from either legacy content or new parts array
    let latestMessageText = latestMessage.content;
    if (!latestMessageText && latestMessage.parts && Array.isArray(latestMessage.parts)) {
      latestMessageText = latestMessage.parts.map((p: any) => p.text || "").join("");
    }

    if (!latestMessageText) {
      return new Response("Missing user message content", { status: 400 });
    }

    // --- REDIS SEMANTIC CACHING ---
    // Check if we've answered this exact question before
    const cachedText = await getCachedResponse(latestMessageText);
    
    if (cachedText) {
      console.log("🟢 CACHE HIT: Returning cached response for:", latestMessageText);
      // Construct a simulated UIMessageStream response using Vercel AI SDK protocol
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: {"type":"start"}\n\n`));
          controller.enqueue(encoder.encode(`data: {"type":"start-step"}\n\n`));
          controller.enqueue(encoder.encode(`data: {"type":"text-start","id":"0"}\n\n`));
          controller.enqueue(encoder.encode(`data: {"type":"text-delta","id":"0","delta":${JSON.stringify(cachedText)}}\n\n`));
          controller.enqueue(encoder.encode(`data: {"type":"text-end","id":"0"}\n\n`));
          controller.enqueue(encoder.encode(`data: {"type":"finish-step"}\n\n`));
          controller.enqueue(encoder.encode(`data: {"type":"finish","finishReason":"stop"}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    }
    console.log("🔴 CACHE MISS: Processing question:", latestMessageText);

    // 1. Convert the user's question into a math vector using Gemini Embedding
    // This allows us to search the database by meaning rather than exact keywords
    const questionEmbedding = await generateEmbedding(latestMessageText);

    // 2. Perform Vector Search (Cosine Similarity) in Supabase
    // We use the RPC function we defined in schema.sql to find the closest matches
    const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: JSON.stringify(questionEmbedding),
      match_threshold: 0.1, // Lowered significantly to catch short conversational queries
      match_count: 20,      // Increased to pull in almost the entire resume context
    });

    if (error) {
      console.error("Vector search error:", error);
      throw new Error("Failed to search documents");
    }

    // 3. Prepare the context for the AI
    // We combine all the retrieved chunks into a single string
    const contextText = (chunks as DocumentChunk[] | null)
      ?.map((chunk) => chunk.content)
      .join("\n\n---\n\n") || "No relevant information found in the documents.";

    // 4. Construct the System Prompt
    // We tell the AI how it should behave and give it the specific document context
    const systemPrompt = `You are a helpful, intelligent assistant. 
    You have been given the following excerpts from documents that the user uploaded.
    Use ONLY this provided context to answer the user's question. 
    If the context does not contain the answer, explicitly state "I don't know based on the provided documents."
    Do not use outside knowledge.
    
    CONTEXT:
    ${contextText}
    `;

    // 5. Generate and stream the response
    // We use Google's gemini-2.0-flash model (1500 req/day free tier vs 20/day for 2.5-flash)
    // The Vercel AI SDK strictly expects { role: 'user' | 'assistant', content: string }
    // We filter out any undefined roles or data messages, and ensure content is a string
    const mappedMessages = messages
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => {
        // In the new UIMessageStream protocol, the assistant's past text might be stored in parts instead of content
        let textContent = m.content;
        if (!textContent && m.parts && Array.isArray(m.parts)) {
          textContent = m.parts.map((p: any) => p.text || "").join("");
        }
        return {
          role: m.role,
          content: String(textContent || ""),
        };
      });

    const result = streamText({
      model: google("gemini-2.0-flash"),
      system: systemPrompt,
      messages: mappedMessages,
      maxRetries: 0, // Disable automatic retries to protect free-tier API quota
      onFinish: async ({ text }) => {
        // Save the generated response to Redis in the background
        if (text) {
          await setCachedResponse(latestMessageText, text).catch(() => {});
        }
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Chat API Error:", error);
    
    // Check if it's a rate limit error from Google
    const isRateLimit = error?.statusCode === 429 || error?.message?.includes("429") || error?.message?.includes("quota");
    
    return new Response(
      JSON.stringify({ 
        error: isRateLimit 
          ? "API quota exceeded. Please wait a minute and try again." 
          : (error.message || "An error occurred during chat") 
      }),
      { 
        status: isRateLimit ? 429 : 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
