# HireOS Part 2 — End-to-End Test Checklist

> Manual testing scenarios that must all pass before Part 2 is considered complete.

---

## Flow 1 — Complete OA Round

- [ ] HR creates a job with an OA round configured
- [ ] HR adds a candidate to the job
- [ ] HR copies the invite link
- [ ] Open invite link in incognito browser
- [ ] System check wizard runs (camera, microphone, network, browser)
- [ ] System check passes → directed to OA round
- [ ] OA round loads with the correct number of problems matching job config
- [ ] MCQ problems display options without revealing correct answers
- [ ] Coding problems display with visible test cases only (hidden test cases not shown)
- [ ] Submit MCQ answers → correct answers graded server-side
- [ ] Submit coding solution → test results stream in via SSE
- [ ] All test results (visible + hidden) shown with pass/fail
- [ ] OA round completes → combined score calculated (40% MCQ + 60% coding)
- [ ] Score appears in HR dashboard under the candidate's profile
- [ ] Auto-advance rule triggers if configured and threshold met
- [ ] Auto-reject rule triggers if configured and threshold not met

---

## Flow 2 — Complete Voice Round (Telephonic Screen)

- [ ] HR configures a telephonic screen round with custom topics and must-cover list
- [ ] Candidate opens invite → system check passes
- [ ] Voice round UI loads with timer, transcript panel, and tips
- [ ] Candidate speaks → real-time transcript appears in the panel
- [ ] AI responds with audio (< 800ms end-to-end voice latency target)
- [ ] AI asks relevant follow-up questions based on candidate responses
- [ ] Must-cover topics are tracked and AI naturally covers them
- [ ] Timer counts down correctly
- [ ] At 2 minutes remaining, AI begins wrapping up naturally
- [ ] AI delivers a closing statement with candidate's name
- [ ] Round completes → round_results written with transcript, score, evaluation
- [ ] Report visible in HR dashboard with transcript and skill scores
- [ ] Recording playback works with timeline markers

---

## Flow 3 — Complete Live Coding Round

- [ ] Live coding round configured → candidate directed to coding UI
- [ ] Monaco editor loads with correct language and starter template
- [ ] Problem statement appears in the problem panel
- [ ] Candidate types code → code snapshots captured for replay
- [ ] Deliberately write an O(n²) brute-force solution
- [ ] AI CodeWatcher detects nested loops and sends a contextual follow-up question via voice
- [ ] Run code → test results appear inline
- [ ] All tests pass → AI asks optimization question
- [ ] Switch to optimized solution → AI acknowledges improvement
- [ ] Round completes with code evaluation
- [ ] Code replay visible in HR report (play/pause/scrub works)
- [ ] Recording shows synchronized transcript + code timeline

---

## Flow 4 — Reconnection Recovery

- [ ] Start a voice interview
- [ ] Disconnect network for 30 seconds
- [ ] Reconnect banner shows "Reconnecting..."
- [ ] Connection restored → banner shows "Resuming..."
- [ ] Interview continues from last transcript position
- [ ] No duplicate questions asked
- [ ] Checkpoint was saved and loaded correctly
- [ ] Proctor log records the disconnection event with timestamp

---

## Flow 5 — Session Timeout

- [ ] Start a round with a configured time limit
- [ ] Do nothing for the configured duration
- [ ] AI wraps up at the 2-minute warning mark
- [ ] Round auto-completes when time expires
- [ ] round_results record is written with status 'completed'
- [ ] Candidate status is updated appropriately
- [ ] Durable Object alarm fires for abandoned sessions (5 min no WebSocket)
- [ ] Abandoned session triggers auto-completion

---

## Flow 6 — Hindi Language Switch

- [ ] Start a voice round
- [ ] Click "Switch to Hindi / हिंदी में जवाब दें" toggle
- [ ] Confirmation dialog appears
- [ ] Confirm → `candidate:language_switch` sent via WebSocket
- [ ] Server reconfigures STT for Hindi transcription
- [ ] Respond in Hindi → transcript shows Hindi text correctly
- [ ] AI continues asking questions in English
- [ ] Technical content evaluation is fair regardless of language
- [ ] TranscriptNormalizer fixes common Hindi technical terms

---

## Flow 7 — Proctoring

- [ ] Proctor overlay loads and initializes camera feed
- [ ] Face detection runs in Web Worker (no UI freeze)
- [ ] Cover camera → "face_missing" proctor event logged
- [ ] Multiple faces → "multiple_faces" event with severity
- [ ] Switch to another browser tab → "tab_switch" event logged
- [ ] Events clustered within 10-second windows
- [ ] Proctor report shows integrity score (starts at 100, deductions applied)
- [ ] HR dashboard report shows proctor summary with expandable flag timeline
- [ ] If Web Worker fails, proctor degrades to tab-switch detection only
- [ ] Proctoring never blocks or freezes the interview UI

---

## Flow 8 — Adaptive Difficulty

- [ ] Start voice round → first question at medium difficulty
- [ ] Give a strong answer → next question increases in difficulty
- [ ] Give a weak answer → next question decreases in difficulty
- [ ] Running score follows EMA formula (0.65 * old + 0.35 * new)
- [ ] Difficulty transitions: <40 easy, 40-72 medium, >72 hard
- [ ] adaptive_difficulty_log recorded in session state

---

## Flow 9 — System Design Round

- [ ] System design round loads with Excalidraw whiteboard
- [ ] Candidate can draw diagrams and add text
- [ ] AI asks questions about the design via voice
- [ ] Whiteboard snapshots captured periodically
- [ ] Round completes with evaluation of design discussion

---

## Flow 10 — Dashboard Report

- [ ] Open candidate report page
- [ ] ReportHeader shows name, avatar, overall score, recommendation badge
- [ ] Each completed round has a RoundScoreCard with skill scores
- [ ] ComparisonPanel shows candidate vs cohort average
- [ ] Percentile rank displayed (e.g., "Top 23%")
- [ ] Recording player loads with presigned R2 URLs
- [ ] Action buttons (Advance/Hold/Reject) work correctly
- [ ] In-progress interviews show "Interview in Progress" spinner

---

## Non-Functional Verification

- [ ] Voice pipeline end-to-end latency < 800ms (STT → LLM → TTS)
- [ ] WebSocket reconnection within 30 seconds
- [ ] All candidate code runs inside gVisor sandbox (never on host)
- [ ] If sandbox is unavailable, coding round shows "Code execution unavailable" and continues with voice
- [ ] No raw error messages shown to candidates (always human-readable)
- [ ] AI interviewer remains respectful and encouraging in all scenarios
- [ ] KINDNESS_INSTRUCTION cannot be overridden by HR's custom prompt
- [ ] LLM routing: Cloudflare first → Anthropic fallback → graceful degradation
- [ ] Evaluation uses Anthropic direct (not CF Workers AI)
- [ ] All proctor processing is non-blocking (Web Worker)
