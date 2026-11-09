CREATE TABLE IF NOT EXISTS topic_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  topic_slug text NOT NULL REFERENCES topics(slug) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS topic_pdfs_user_topic_idx ON topic_pdfs(user_id, topic_slug, created_at DESC);