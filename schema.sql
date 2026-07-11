-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store uploaded documents
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table to store the extracted text chunks and their vector embeddings
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  chunk_index integer not null,
  content text not null,
  -- 768 is the vector dimension for Google's text-embedding-004 (Gemini embedding model)
  embedding vector(768)
);

-- Create an HNSW index for super fast vector similarity searches (optional but recommended for production)
create index on document_chunks using hnsw (embedding vector_cosine_ops);

-- Create a function to perform the vector similarity search
-- This allows us to call supabase.rpc('match_document_chunks', { query_embedding: [...] })
create or replace function match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
