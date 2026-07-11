import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { chunkText } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    // 1. Parse the incoming multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    // 2. Read the file into a Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extract raw text from the PDF
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 400 });
    }

    // 4. Create a document record in Supabase
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({ name: file.name })
      .select("id")
      .single();

    if (docError || !docData) {
      console.error("Supabase insert error:", docError);
      return NextResponse.json({ error: "Failed to create document record" }, { status: 500 });
    }

    const documentId = docData.id;

    // 5. Chunk the text
    // 1000 characters per chunk with 200 character overlap
    const chunks = chunkText(rawText, 1000, 200);

    // 6. Generate embeddings and insert chunks into database
    // Engineering Decision (Tradeoff): 
    // In a massive production system with enterprise API quotas, we would process these in parallel 
    // using `Promise.all()` or a concurrency limiter (like p-limit) to drastically reduce ingestion latency. 
    // However, to protect our Gemini Free Tier quota from HTTP 429 (Too Many Requests) errors during a burst, 
    // we explicitly map these sequentially. Reliability > Latency for the free tier.
    const chunksToInsert = [];

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      // Generate the vector representation of this chunk using Gemini
      const embedding = await generateEmbedding(content);

      chunksToInsert.push({
        document_id: documentId,
        chunk_index: i,
        content: content,
        embedding: embedding // pgvector accepts standard JSON arrays
      });
    }

    // Insert all chunks at once
    const { error: chunksError } = await supabase
      .from("document_chunks")
      .insert(chunksToInsert);

    if (chunksError) {
      console.error("Failed to insert chunks:", chunksError);
      // Optional: Cleanup the document if chunk insertion failed
      await supabase.from("documents").delete().eq("id", documentId);
      return NextResponse.json({ error: "Failed to store document chunks" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documentId,
      chunksProcessed: chunks.length
    });

  } catch (error: any) {
    console.error("Ingestion API Error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during ingestion" },
      { status: 500 }
    );
  }
}
