-- Prompts table - stores saved prompts
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prompt versions table - stores version history for each prompt
CREATE TABLE IF NOT EXISTS prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL,

  -- 4P Framework inputs
  product TEXT NOT NULL,
  process TEXT,
  performance TEXT,

  -- User refinement answers (JSON)
  answers TEXT,

  -- Generated prompt
  final_prompt TEXT,

  -- Evaluation scores
  product_score INTEGER,
  process_score INTEGER,
  performance_score INTEGER,
  total_score INTEGER,
  percentage_score INTEGER,

  -- Evaluation details (JSON)
  strengths TEXT,
  critical_missing TEXT,
  questions TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Constraints
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  UNIQUE(prompt_id, version_number)
);

-- Full-text search index on prompts
CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
  name,
  content='prompts',
  content_rowid='id'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS prompts_fts_insert AFTER INSERT ON prompts BEGIN
  INSERT INTO prompts_fts(rowid, name) VALUES (new.id, new.name);
END;

CREATE TRIGGER IF NOT EXISTS prompts_fts_delete AFTER DELETE ON prompts BEGIN
  INSERT INTO prompts_fts(prompts_fts, rowid, name) VALUES ('delete', old.id, old.name);
END;

CREATE TRIGGER IF NOT EXISTS prompts_fts_update AFTER UPDATE ON prompts BEGIN
  INSERT INTO prompts_fts(prompts_fts, rowid, name) VALUES ('delete', old.id, old.name);
  INSERT INTO prompts_fts(rowid, name) VALUES (new.id, new.name);
END;

-- Trigger to update updated_at on prompts
CREATE TRIGGER IF NOT EXISTS prompts_updated_at AFTER UPDATE ON prompts BEGIN
  UPDATE prompts SET updated_at = datetime('now') WHERE id = old.id;
END;

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_id ON prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_created_at ON prompt_versions(created_at);
