-- ============================================================
-- HireOS Part 2 — Interview Engine Schema Migration
-- Idempotent: safe to run multiple times
-- ============================================================

-- ─── New Enums ──────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE recording_type AS ENUM (
    'video', 'audio', 'screen', 'transcript',
    'code_replay', 'whiteboard', 'proctor_log'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recording_status AS ENUM (
    'processing', 'ready', 'failed', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE oa_problem_type AS ENUM ('mcq', 'coding');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE oa_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Add columns to existing tables ────────────────────────

-- jobs: pipeline_v2
DO $$ BEGIN
  ALTER TABLE jobs ADD COLUMN pipeline_v2 JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- round_results: new columns
DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN session_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN started_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN duration_seconds INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN transcript JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN proctor_log JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN code_replay JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN whiteboard_snapshots JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN anti_ai_signals JSONB DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE round_results ADD COLUMN adaptive_difficulty_log JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── New Tables ─────────────────────────────────────────────

-- recording_files
CREATE TABLE IF NOT EXISTS recording_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type recording_type NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes BIGINT,
  duration_seconds INTEGER,
  status recording_status NOT NULL DEFAULT 'processing',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recording_files_session ON recording_files(session_id);
CREATE INDEX IF NOT EXISTS idx_recording_files_candidate ON recording_files(candidate_id);

-- oa_problems
CREATE TABLE IF NOT EXISTS oa_problems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type oa_problem_type NOT NULL,
  difficulty oa_difficulty NOT NULL,
  topics TEXT[] DEFAULT '{}',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  options JSONB,
  correct_option_id TEXT,
  starter_code JSONB,
  test_cases JSONB,
  solution_reference JSONB,
  estimated_minutes INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oa_problems_org ON oa_problems(organization_id);
CREATE INDEX IF NOT EXISTS idx_oa_problems_type ON oa_problems(type);
CREATE INDEX IF NOT EXISTS idx_oa_problems_difficulty ON oa_problems(difficulty);

-- interview_checkpoints
CREATE TABLE IF NOT EXISTS interview_checkpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  checkpoint_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_session_time ON interview_checkpoints(session_id, created_at DESC);

-- system_check_results
CREATE TABLE IF NOT EXISTS system_check_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  session_id TEXT,
  camera_result JSONB,
  mic_result JSONB,
  network_result JSONB,
  browser_result JSONB,
  overall_pass BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_checks_candidate ON system_check_results(candidate_id);

-- ─── RLS Policies ───────────────────────────────────────────

ALTER TABLE recording_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE oa_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_check_results ENABLE ROW LEVEL SECURITY;

-- recording_files: HR can view files for their org
DO $$ BEGIN
  CREATE POLICY "HR can view recording files"
    ON recording_files FOR SELECT
    USING (organization_id = get_my_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- oa_problems: HR can CRUD org problems and view shared bank
DO $$ BEGIN
  CREATE POLICY "HR can view oa problems"
    ON oa_problems FOR SELECT
    USING (organization_id = get_my_org_id() OR organization_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "HR can insert oa problems"
    ON oa_problems FOR INSERT
    WITH CHECK (organization_id = get_my_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "HR can update oa problems"
    ON oa_problems FOR UPDATE
    USING (organization_id = get_my_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "HR can delete oa problems"
    ON oa_problems FOR DELETE
    USING (organization_id = get_my_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- interview_checkpoints: service role only (no user policies)

-- system_check_results: HR can view
DO $$ BEGIN
  CREATE POLICY "HR can view system checks"
    ON system_check_results FOR SELECT
    USING (candidate_id IN (
      SELECT id FROM candidates WHERE organization_id = get_my_org_id()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Seed Data: OA Problems (Shared Bank) ───────────────────

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, options, correct_option_id, estimated_minutes)
SELECT NULL, 'mcq', 'easy', ARRAY['python', 'basics'],
  'Python List Comprehension',
  'What is the output of the following Python code?\n\n```python\nresult = [x**2 for x in range(5) if x % 2 == 0]\nprint(result)\n```',
  '[{"id":"a","text":"[0, 4, 16]"},{"id":"b","text":"[1, 9, 25]"},{"id":"c","text":"[0, 2, 4]"},{"id":"d","text":"[0, 1, 4, 9, 16]"}]'::jsonb,
  'a', 3
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'Python List Comprehension');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, options, correct_option_id, estimated_minutes)
SELECT NULL, 'mcq', 'easy', ARRAY['arrays', 'complexity'],
  'Array Access Time Complexity',
  'What is the time complexity of accessing an element at index i in an array (not a linked list)?',
  '[{"id":"a","text":"O(1)"},{"id":"b","text":"O(n)"},{"id":"c","text":"O(log n)"},{"id":"d","text":"O(n²)"}]'::jsonb,
  'a', 2
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'Array Access Time Complexity');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, options, correct_option_id, estimated_minutes)
SELECT NULL, 'mcq', 'medium', ARRAY['big-o', 'complexity'],
  'Nested Loop Complexity',
  'Consider the following pseudocode:\n\n```\nfor i = 1 to n:\n  for j = 1 to n:\n    for k = 1 to j:\n      print(i, j, k)\n```\n\nWhat is the tightest Big-O bound on the number of print statements?',
  '[{"id":"a","text":"O(n²)"},{"id":"b","text":"O(n³)"},{"id":"c","text":"O(n² log n)"},{"id":"d","text":"O(n⁴)"}]'::jsonb,
  'b', 5
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'Nested Loop Complexity');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, options, correct_option_id, estimated_minutes)
SELECT NULL, 'mcq', 'medium', ARRAY['hash-maps', 'data-structures'],
  'Hash Map Collision Resolution',
  'In a hash map using separate chaining, what is the worst-case time complexity for a lookup operation if all n keys hash to the same bucket?',
  '[{"id":"a","text":"O(1)"},{"id":"b","text":"O(log n)"},{"id":"c","text":"O(n)"},{"id":"d","text":"O(n log n)"}]'::jsonb,
  'c', 4
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'Hash Map Collision Resolution');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, options, correct_option_id, estimated_minutes)
SELECT NULL, 'mcq', 'hard', ARRAY['distributed-systems', 'cap-theorem'],
  'CAP Theorem Trade-offs',
  'A distributed database must handle network partitions. According to the CAP theorem, during a network partition, the system can guarantee at most two of the three properties. If you choose to maintain Consistency and Partition Tolerance (CP), what happens to requests during a partition?\n\nSelect the most accurate answer.',
  '[{"id":"a","text":"All reads and writes succeed but may return stale data"},{"id":"b","text":"Some requests may be rejected or timeout to preserve consistency"},{"id":"c","text":"The system shuts down entirely until the partition heals"},{"id":"d","text":"Writes succeed everywhere but reads are blocked"}]'::jsonb,
  'b', 5
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'CAP Theorem Trade-offs');

-- Coding problems
INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, starter_code, test_cases, solution_reference, estimated_minutes)
SELECT NULL, 'coding', 'easy', ARRAY['arrays', 'hash-maps'],
  'Two Sum',
  'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.\n\nYou may assume each input has exactly one solution and you may not use the same element twice.\n\n**Example:**\n```\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1]\nExplanation: nums[0] + nums[1] = 2 + 7 = 9\n```',
  '{"python":"def two_sum(nums: list[int], target: int) -> list[int]:\n    # Your code here\n    pass","javascript":"function twoSum(nums, target) {\n    // Your code here\n}"}'::jsonb,
  '[{"input":"[2,7,11,15]\n9","expected":"[0,1]","isHidden":false},{"input":"[3,2,4]\n6","expected":"[1,2]","isHidden":false},{"input":"[3,3]\n6","expected":"[0,1]","isHidden":false},{"input":"[1,5,3,7,2,8]\n10","expected":"[1,4]","isHidden":true},{"input":"[-1,-2,-3,-4,-5]\n-8","expected":"[2,4]","isHidden":true}]'::jsonb,
  '{"approach":"Use a hash map to store complement values. For each number, check if target - num exists in the map.","timeComplexity":"O(n)","spaceComplexity":"O(n)"}'::jsonb,
  15
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'Two Sum' AND type = 'coding');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, starter_code, test_cases, solution_reference, estimated_minutes)
SELECT NULL, 'coding', 'easy', ARRAY['loops', 'conditionals'],
  'FizzBuzz',
  'Write a function that returns an array of strings for numbers from 1 to n:\n- For multiples of 3, use "Fizz"\n- For multiples of 5, use "Buzz"\n- For multiples of both 3 and 5, use "FizzBuzz"\n- Otherwise, use the number as a string\n\n**Example:**\n```\nInput: n = 5\nOutput: ["1", "2", "Fizz", "4", "Buzz"]\n```',
  '{"python":"def fizzbuzz(n: int) -> list[str]:\n    # Your code here\n    pass","javascript":"function fizzBuzz(n) {\n    // Your code here\n}"}'::jsonb,
  '[{"input":"5","expected":"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\"]","isHidden":false},{"input":"15","expected":"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\",\"Fizz\",\"7\",\"8\",\"Fizz\",\"Buzz\",\"11\",\"Fizz\",\"13\",\"14\",\"FizzBuzz\"]","isHidden":false},{"input":"1","expected":"[\"1\"]","isHidden":true},{"input":"30","expected":"[\"1\",\"2\",\"Fizz\",\"4\",\"Buzz\",\"Fizz\",\"7\",\"8\",\"Fizz\",\"Buzz\",\"11\",\"Fizz\",\"13\",\"14\",\"FizzBuzz\",\"16\",\"17\",\"Fizz\",\"19\",\"Buzz\",\"Fizz\",\"22\",\"23\",\"Fizz\",\"Buzz\",\"26\",\"Fizz\",\"28\",\"29\",\"FizzBuzz\"]","isHidden":true}]'::jsonb,
  '{"approach":"Iterate 1 to n, check divisibility by 15 first, then 3, then 5.","timeComplexity":"O(n)","spaceComplexity":"O(n)"}'::jsonb,
  10
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'FizzBuzz' AND type = 'coding');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, starter_code, test_cases, solution_reference, estimated_minutes)
SELECT NULL, 'coding', 'medium', ARRAY['binary-search', 'arrays'],
  'Search in Rotated Sorted Array',
  'Given a sorted integer array `nums` that has been rotated at an unknown pivot, and a `target` value, return the index of `target` or -1 if not found. Your solution must run in O(log n) time.\n\n**Example:**\n```\nInput: nums = [4,5,6,7,0,1,2], target = 0\nOutput: 4\n```',
  '{"python":"def search(nums: list[int], target: int) -> int:\n    # Your code here\n    pass","javascript":"function search(nums, target) {\n    // Your code here\n}"}'::jsonb,
  '[{"input":"[4,5,6,7,0,1,2]\n0","expected":"4","isHidden":false},{"input":"[4,5,6,7,0,1,2]\n3","expected":"-1","isHidden":false},{"input":"[1]\n0","expected":"-1","isHidden":false},{"input":"[3,1]\n1","expected":"1","isHidden":true},{"input":"[1,3,5,7,9,11,2]\n11","expected":"5","isHidden":true}]'::jsonb,
  '{"approach":"Modified binary search. Determine which half is sorted, then decide which half to search.","timeComplexity":"O(log n)","spaceComplexity":"O(1)"}'::jsonb,
  20
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'Search in Rotated Sorted Array' AND type = 'coding');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, starter_code, test_cases, solution_reference, estimated_minutes)
SELECT NULL, 'coding', 'medium', ARRAY['intervals', 'sorting'],
  'Merge Intervals',
  'Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals and return an array of the non-overlapping intervals that cover all input intervals.\n\n**Example:**\n```\nInput: intervals = [[1,3],[2,6],[8,10],[15,18]]\nOutput: [[1,6],[8,10],[15,18]]\n```',
  '{"python":"def merge(intervals: list[list[int]]) -> list[list[int]]:\n    # Your code here\n    pass","javascript":"function merge(intervals) {\n    // Your code here\n}"}'::jsonb,
  '[{"input":"[[1,3],[2,6],[8,10],[15,18]]","expected":"[[1,6],[8,10],[15,18]]","isHidden":false},{"input":"[[1,4],[4,5]]","expected":"[[1,5]]","isHidden":false},{"input":"[[1,4],[0,4]]","expected":"[[0,4]]","isHidden":true},{"input":"[[1,4],[2,3]]","expected":"[[1,4]]","isHidden":true},{"input":"[[1,10],[2,3],[4,5],[6,7]]","expected":"[[1,10]]","isHidden":true}]'::jsonb,
  '{"approach":"Sort by start time, then iterate and merge overlapping intervals.","timeComplexity":"O(n log n)","spaceComplexity":"O(n)"}'::jsonb,
  20
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'Merge Intervals' AND type = 'coding');

INSERT INTO oa_problems (organization_id, type, difficulty, topics, title, description, starter_code, test_cases, solution_reference, estimated_minutes)
SELECT NULL, 'coding', 'hard', ARRAY['design', 'hash-maps', 'linked-lists'],
  'LRU Cache',
  'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.\n\nImplement the class with:\n- `LRUCache(capacity)` — Initialize with positive capacity.\n- `get(key)` — Return value if key exists, otherwise -1.\n- `put(key, value)` — Update or insert. If capacity exceeded, evict the least recently used key.\n\nBoth `get` and `put` must run in O(1) average time.\n\n**Example:**\n```\ncache = LRUCache(2)\ncache.put(1, 1)\ncache.put(2, 2)\ncache.get(1)    # returns 1\ncache.put(3, 3) # evicts key 2\ncache.get(2)    # returns -1\n```',
  '{"python":"class LRUCache:\n    def __init__(self, capacity: int):\n        # Your code here\n        pass\n\n    def get(self, key: int) -> int:\n        # Your code here\n        pass\n\n    def put(self, key: int, value: int) -> None:\n        # Your code here\n        pass","javascript":"class LRUCache {\n    constructor(capacity) {\n        // Your code here\n    }\n\n    get(key) {\n        // Your code here\n    }\n\n    put(key, value) {\n        // Your code here\n    }\n}"}'::jsonb,
  '[{"input":"[\"LRUCache\",\"put\",\"put\",\"get\",\"put\",\"get\",\"put\",\"get\",\"get\",\"get\"]\n[[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]","expected":"[null,null,null,1,null,-1,null,-1,3,4]","isHidden":false},{"input":"[\"LRUCache\",\"put\",\"get\"]\n[[1],[2,1],[2]]","expected":"[null,null,1]","isHidden":false},{"input":"[\"LRUCache\",\"put\",\"put\",\"put\",\"get\",\"get\"]\n[[2],[1,10],[2,20],[3,30],[1],[2]]","expected":"[null,null,null,null,-1,20]","isHidden":true}]'::jsonb,
  '{"approach":"Use a doubly-linked list + hash map. The list maintains access order, the map provides O(1) key lookup.","timeComplexity":"O(1) per operation","spaceComplexity":"O(capacity)"}'::jsonb,
  30
WHERE NOT EXISTS (SELECT 1 FROM oa_problems WHERE title = 'LRU Cache' AND type = 'coding');
