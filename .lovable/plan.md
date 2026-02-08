

# Dreem Dev — AI-Powered Development Platform (Frontend)

## Phase 1: Foundation & Authentication
**Login Page:**
- Clean, professional login page with Dreem Dev branding/logo
- Email + Password authentication form (mock auth initially, later HF Spaces backend connect)
- "Remember me" option
- Responsive design (mobile, tablet, desktop)

**PWA Setup:**
- Service worker registration
- App manifest with Dreem Dev icon/branding
- Install prompt support
- Offline fallback page

## Phase 2: Main Dashboard
**Project Dashboard (Lovable-style):**
- Grid/list view of projects with thumbnails
- "New Project" button with project creation dialog
- Project cards showing: name, last modified, status
- Search and filter projects
- Quick actions: Open, Delete, Rename

**Sidebar Navigation:**
- Projects list
- Settings
- Account info
- Dark/Light theme toggle (Lovable-style clean design)

## Phase 3: AI Chat + Code Editor Workspace
**Split-pane Layout:**
- Left panel: AI Chat interface (message input, chat history, streaming responses)
- Right panel: Live Preview iframe
- Resizable panels

**AI Chat Interface:**
- Message input with send button
- Chat bubble display (user & AI messages)
- Typing/loading indicator
- Code block rendering in messages
- Chat history per project

**Code Editor View:**
- File tree sidebar
- Code editor with syntax highlighting (using Monaco or CodeMirror)
- Tab-based file switching
- Toggle between Preview and Code view

## Phase 4: Live Preview & Project Management
**Live Preview Panel:**
- Iframe-based live preview
- Device frame selector (mobile, tablet, desktop)
- Refresh button
- URL bar showing current route

**Project Management:**
- Reopen previous projects and continue editing
- Project settings (name, description)
- Version/change history list (mock data)

## Phase 5: Hybrid Storage & Settings
**Hybrid Storage System:**
- LocalStorage/IndexedDB for offline project data
- Data structure ready to sync with Supabase when connected
- Sync status indicator (local-only / synced)

**Settings Page:**
- Backend API URL configuration (for HF Spaces endpoint)
- AI Model selection (Gemini, Groq, DeepSeek)
- Theme preferences
- Account settings
- API keys display (masked)

## Design Approach
- **Style:** Lovable-inspired — clean, minimal, light theme with dark mode support
- **Colors:** Soft whites, subtle grays, accent color for branding
- **Typography:** Clean sans-serif, good readability
- **Responsive:** Mobile-first, works on all devices
- **Animations:** Subtle transitions, smooth panel resizing

## Technical Notes
- All API calls will use configurable base URL (for later HF Spaces connection)
- Mock data and responses initially
- Service layer abstraction so backend can be swapped easily
- IndexedDB for local project storage

