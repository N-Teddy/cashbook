## Updated implementation plan (Tauri Mobile + SQLite + direct MongoDB + biometric/pattern + hybrid voice AI)

### Context / constraints (as requested)
- **No separate backend**: the app hits MongoDB directly from the client.
- **No auth**: no JWT, no user verification; biometric/pattern is “enough”.
- **Voice AI**: hybrid approach.
- **Mongo credential**: provided via GitHub Actions secrets at build time.
- **No rate limiting or conflict resolution**.

### Reality check (so the plan is honest)
- **If the app talks to MongoDB directly, your MongoDB credential will end up inside the shipped APK/IPA.** GitHub Actions secrets only protect build time, not runtime. Anyone can extract it and use it unless you add server-side gates.
- **Biometric/pattern protects only local UI access**, not your cloud DB. Without auth/verification, the cloud is effectively accessible to anyone who has the credential.

Given the constraints, the safest achievable design is: **client-side end-to-end encryption (E2EE)** + **heavily restricted MongoDB access**.

---

## 1) Architecture (no backend)
- **Tauri Mobile app**
  - **UI**: React + Vite (or Svelte)
  - **Rust commands**: DB access, crypto, import/export
- **Local storage (authoritative)**: **SQLite** (offline-first)
- **Cloud backup/sync**: **MongoDB over HTTPS** (e.g., Atlas Data API or similar HTTP endpoint)
  - Avoid shipping a raw `mongodb://` driver connection in mobile; prefer HTTPS API calls.
  - Store only **encrypted blobs** and minimal metadata in MongoDB.

---

## 2) Local data model (SQLite)
Core entities:
- **Transactions**: income/expense/transfer, category, account, merchant, note, tags, occurred_at
- **Accounts**: cash/bank/mobile money/etc.
- **Categories**: hierarchical, income vs expense
- **Debts**: owed_by_me / owed_to_me, counterparty, due date, status
- **Debt payments**: partial repayments against a debt
- **Budgets**: monthly per-category limits

Sync/backup support:
- `device(id, created_at)`
- `sync_state(last_pushed_at, last_pulled_at)`
- `change_log(id, ts, entity_type, entity_id, op, payload_json)` (recommended even if “no conflicts”; it enables reliable uploads/backups)

Key principles:
- **UUIDs everywhere** (client-generated IDs)
- **soft deletes** (`deleted_at`) to avoid accidental data loss

---

## 3) Cloud strategy (no conflict resolution)
Because you don’t want conflict handling, the plan assumes either:
- **Single device**, or
- You accept **last-write-wins silently** if multiple devices overwrite.

### Recommended under your constraints: encrypted snapshot backup (not true sync)
- App produces an **encrypted snapshot** (SQLite export or JSON snapshot).
- Upload to MongoDB as one “latest backup” document (and optionally keep history).
- Restore simply **replaces local DB** from the latest snapshot.
- This avoids multi-device merge/conflict logic entirely.

### If you still want “sync”
- Use a change log push/pull and apply **last-write-wins** by timestamp/device ordering.
- Note: that *is* conflict resolution (just the simplest form), even if you don’t expose any UI for it.

---

## 4) Cloud security (without auth)
Since there’s no auth, the only meaningful protection is **cryptography**:

### End-to-end encryption (E2EE)
- Generate a **master sync key** on first run.
- Store it in **platform secure storage** (Keychain/Keystore).
- Optionally support a **recovery key/phrase** export (otherwise reinstall = cloud data becomes unrecoverable).

Mongo stores:
- `ciphertext`
- `nonce/iv`
- `kdf params`
- `updated_at`
- Minimal metadata (avoid plaintext amounts/merchants/categories)

### About “Mongo credential via GitHub Actions secrets”
- You can inject a Data API key at build time, but it becomes a **public app secret** after shipping.
- Damage control steps (strongly recommended):
  - restrict scope to a single DB/collection and minimal actions
  - rotate keys regularly
  - understand this still does not prevent abuse if the key is extracted

---

## 5) App protection (biometric / pattern)
Implementation path:
- **Phase 1**: Biometric unlock + fallback PIN
  - Store only a salted hash of PIN (or rely on platform secure auth gating where possible)
  - Lock on launch + when returning from background
- **Phase 2**: Pattern lock (draw)
  - Pattern grid UI in frontend
  - Store hashed pattern representation locally

Also:
- auto-lock timeout
- hide sensitive previews in app switcher (platform-dependent)

---

## 6) Hybrid voice AI (as requested)
User flow:
- Tap mic → record → transcript displayed
- App creates a “draft card” (transaction/debt) extracted from transcript
- User confirms/edits → save to SQLite

Hybrid pipeline:
1) **On-device speech-to-text** where available; fallback to cloud STT
2) Send transcript to **AI parser (cloud LLM)** to produce structured draft:
   - expense/income/debt
   - amount, currency
   - merchant/counterparty
   - category (inferred)
   - date (inferred)
3) Deterministic rules first, LLM fallback for ambiguity
4) Local “learning”:
   - merchant → category mapping based on history
   - frequent tags/accounts suggestions

Privacy mode (optional):
- disable cloud parsing or redact content before sending (true privacy requires on-device parsing)

---

## 7) GitHub Actions (Android build/bundle)
Pipeline:
- install deps (pnpm)
- install Rust toolchain + Android targets
- build Tauri Android (APK/AAB)
- sign using keystore in GitHub Secrets
- upload artifacts and optionally create GitHub Release on tags

Build-time config injected:
- Mongo Data API base URL + API key (again: becomes extractable at runtime once shipped)

---

## 8) Delivery phases (updated)
- **Phase A (MVP offline)**: SQLite schema + CRUD + dashboard + debts/budgets basics
- **Phase B (lock & crypto)**: biometric/pattern + secure storage + E2EE key management
- **Phase C (cloud backup)**: encrypted snapshot upload/download to MongoDB
- **Phase D (voice/AI)**: STT + AI draft + confirmation UI
- **Phase E (optional “sync”)**: change_log push/pull with last-write-wins

