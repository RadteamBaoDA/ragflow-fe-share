# Change Overview for Merging

This document provides an overview of the changes in the current branch compared to `main`, organized by folder structure. This is intended to assist in merging these changes into a higher version (e.g., `nightly-20251212`).

## Root Configuration
- **.env**: Added.
- **.env.example**: Deleted.
- **.gitignore**: Modified.
- **.umirc.ts**: Modified.
- **LICENSE**: Added.
- **package-lock.json**: Modified.

## Source Code Changes

### src/components
- **embed-container.tsx**: Modified.
- **theme-provider.tsx**: Modified.

#### src/components/pdf-drawer
- **index.tsx**: Modified.

#### src/components/pdf-previewer
- **index.less**: Modified.
- **index.tsx**: Modified.

#### src/components/ui
- **ragflow-pagination.tsx**: Modified.
- **spin.tsx**: Modified.
- **modal/modal.tsx**: Modified.

### src/hooks
- **document-hooks.ts**: Modified.
- **user-external-trace.ts**: Deleted (was 'D' in status).

### src/locales
- **en.ts**: Modified.
- **ja.ts**: Modified.
- **vi.ts**: Modified.

### src/pages

#### src/pages/chunk
- **parsed-result/add-knowledge/components/knowledge-chunk/components/document-preview**:
    - **index.less**: Modified.
    - **index.tsx**: Modified.
    - **pdf-preview.tsx**: Modified.

#### src/pages/next-chats
- **hooks/use-send-shared-message.ts**: Modified.
- **share/index.tsx**: Modified.

#### src/pages/next-search
- **document-preview-modal/index.tsx**: Modified.
- **embed-app-modal.tsx**: Modified.
- **hooks.ts**: Modified.
- **markdown-content/index.tsx**: Modified.
- **retrieval-documents/index.tsx**: Modified.
- **search-home.tsx**: Modified.
- **search-setting.tsx**: Modified.
- **search-view.tsx**: Modified.
- **share/index.tsx**: Modified.

### src/services
- **external-trace-service.ts**: Deleted.

### src/utils
- **document-util.ts**: Modified.

## Summary of Key Changes
*   **PDF Handling**: Significant changes in `src/components/pdf-previewer` and `src/components/pdf-drawer`, as well as `src/pages/chunk/.../document-preview`. This suggests a refactor or enhancement of PDF viewing capabilities.
*   **Search Functionality**: Extensive modifications in `src/pages/next-search`, affecting hooks, modals, and the main search view.
*   **External Traces**: Deletion of `src/hooks/user-external-trace.ts` and `src/services/external-trace-service.ts` indicates removal or refactoring of this feature.
*   **Localization**: Updates to English, Japanese, and Vietnamese locale files.
