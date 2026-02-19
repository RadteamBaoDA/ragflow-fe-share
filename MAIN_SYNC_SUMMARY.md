# Main Branch Sync Summary

Date: February 12, 2026
Branch: `feature/merge0.24.0`
Reference Main: `main` (`4420efe`)

## Objective

Sync key `main` branch logic into current branch for:

- Share chat flow (`next-chats/share`)
- Share search flow (`next-search`)
- External tracing and history collection
- Message item controls used by share views

While keeping current branch compatibility:

- Vite-based app setup
- `react-router` usage (not `umi`)
- Existing component paths in current codebase

## What Was Implemented

### 1. Share Chat Logic (`next-chats/share`)

- Added/kept external trace flow:
  - User question trace
  - Assistant response trace after stream settle
  - Like/dislike score trace
- Added/kept external history collection:
  - `session_id`, `share_id`, `user_email`
  - `user_prompt`, `llm_response`
  - `citations`, `file_results`
- Restored `INSERT_PROMPT` postMessage handling to inject prompt into textarea.
- Restored stream error surface in UI:
  - `TIMEOUT`, `NETWORK`, `SERVER`, fallback generic
- Kept share input behavior aligned with current `NextMessageInput` API:
  - `showReasoning`
  - `showInternet`
  - `stopOutputMessage`
- Ensured prompt button hidden in share messages with `showPrompt={false}`.

### 2. Share Chat Hook (`use-send-shared-message`)

- Kept `react-router` query param usage.
- Added SSE error outputs to hook return:
  - `errorMessage`
  - `clearError`
- Kept/added reasoning + internet flags in completion payload:
  - `reasoning`
  - `internet`

### 3. Search Logic (`next-search/hooks` + `search-view`)

- Restored/kept search shared params parity, including theme extraction.
- Restored retrieval-gated AI summary trigger:
  - only send summary request when retrieval has results.
- Restored SSE error propagation from hooks to view.
- Restored feedback score flow in search view (like/dislike).
- Restored summary error display and searching overlay.
- Restored relevance score display per chunk.
- Kept external trace and external history logic in search flow.

### 4. Message Item Controls

- Restored optional props used by share logic:
  - `showPrompt`
  - `isLoading` (assistant like/dislike disable state)
- Kept compatibility with current project modal components:
  - `FeedbackDialog` (`src/components/feedback-dialog.tsx`)
  - `PromptDialog` (`src/components/prompt-dialog.tsx`)

### 5. SSE Core Hook (`useSendMessageWithSse`)

- Restored error state support required by share/search UIs:
  - `errorMessage`
  - `clearError`
- Restored timeout/network/server error classification.
- Preserved current branch streaming answer accumulation behavior.

## Files Updated

- `src/components/message-item/group-button.tsx`
- `src/components/message-item/index.tsx`
- `src/hooks/logic-hooks.ts`
- `src/pages/next-chats/hooks/use-send-shared-message.ts`
- `src/pages/next-chats/share/index.tsx`
- `src/pages/next-search/hooks.ts`
- `src/pages/next-search/search-view.tsx`

## Notes on Compatibility Choices

- Kept `react-router` imports instead of switching back to `umi`.
- Used existing modal/dialog components available in this branch where `main` referenced files not present here.
- Avoided reintroducing Umi-era APIs that would break current Vite setup.

## Validation Status

- Targeted checks for edited flows completed via code inspection and local TypeScript checks.
- Full-project TypeScript still reports many pre-existing unrelated errors outside this scope.
- No additional regressions were introduced in the synced feature paths during this update.

