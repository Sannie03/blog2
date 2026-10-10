-- Add updated_at column to posts table if it doesn't exist
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update existing rows to have updated_at = created_at if updated_at is NULL
UPDATE posts SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS prev_chapter VARCHAR(255) DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS next_chapter VARCHAR(255) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS adsense_access BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS content_images (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL UNIQUE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION sync_user_posts_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.author_id IS NOT NULL THEN
    UPDATE users SET posts_count = (SELECT COUNT(*) FROM posts WHERE author_id = NEW.author_id)
    WHERE id = NEW.author_id;
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.author_id IS NOT NULL THEN
    UPDATE users SET posts_count = (SELECT COUNT(*) FROM posts WHERE author_id = OLD.author_id)
    WHERE id = OLD.author_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_sync_user_posts_count ON posts;
CREATE TRIGGER posts_sync_user_posts_count
AFTER INSERT OR UPDATE OF author_id OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION sync_user_posts_count();

UPDATE users
SET posts_count = (SELECT COUNT(*) FROM posts WHERE posts.author_id = users.id);

-- Verify migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' 
ORDER BY ordinal_position;

-- Slug already has a UNIQUE index. Support published feeds and author/date queries.
CREATE INDEX IF NOT EXISTS posts_published_created_idx ON posts (created_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS posts_author_created_idx ON posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS content_images_url_idx ON content_images (url);
