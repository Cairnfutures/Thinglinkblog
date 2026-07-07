-- Run this in the Supabase SQL editor to create the support_articles table

create extension if not exists vector;

create table if not exists support_articles (
  id            uuid primary key default gen_random_uuid(),
  zendesk_id    bigint unique not null,
  title         text not null,
  url           text not null,
  section       text,
  body_text     text,
  embedding     vector(1536),
  updated_at    timestamptz,
  created_at    timestamptz default now()
);

-- Index for vector similarity search
create index if not exists support_articles_embedding_idx
  on support_articles
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- RPC for vector similarity search
create or replace function match_support_articles(
  query_embedding vector(1024),
  match_count     int default 5
)
returns table (
  id        uuid,
  title     text,
  url       text,
  section   text,
  body_text text,
  similarity float
)
language sql stable
as $$
  select
    id, title, url, section, body_text,
    1 - (embedding <=> query_embedding) as similarity
  from support_articles
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
