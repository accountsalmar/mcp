# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, and the AI generates editable React/TypeScript code with real-time preview capabilities. The application uses a virtual file system (no files written to disk) and supports both authenticated and anonymous usage.

## Key Commands

### Development
```bash
npm run setup          # Install dependencies, generate Prisma client, run migrations
npm run dev            # Start development server with Turbopack (localhost:3000)
npm run dev:daemon     # Start dev server in background, logs to logs.txt
npm run build          # Production build
npm run start          # Start production server
```

### Testing
```bash
npm test               # Run Vitest tests
```

### Database
```bash
npx prisma generate    # Generate Prisma client (required after schema changes)
npx prisma migrate dev # Create and apply new migration
npm run db:reset       # Reset database (WARNING: deletes all data)
```

**CRITICAL**: After modifying `prisma/schema.prisma`, you MUST run `npx prisma generate` to regenerate the client at `src/generated/prisma`.

### Linting
```bash
npm run lint           # Run ESLint
```

## Architecture

### Core Flow: AI-Powered Component Generation

1. **User Input** → Chat interface sends message to `/api/chat` route
2. **API Processing** → Streams AI responses using Vercel AI SDK with Claude
3. **Tool Execution** → AI uses tools to manipulate virtual file system:
   - `str_replace_editor`: Create, view, edit files (like Claude's bash tool)
   - `file_manager`: Rename, delete, move files
4. **Virtual File System** → Changes stored in `VirtualFileSystem` class (memory only)
5. **JSX Transformation** → Files transformed via Babel for browser execution
6. **Live Preview** → Transformed code injected into sandboxed iframe with import maps
7. **Persistence** → For authenticated users, state saved to SQLite via Prisma

### Virtual File System (`src/lib/file-system.ts`)

The entire codebase operates on an in-memory file system - **no files are ever written to disk**. This is the core abstraction of the entire application.

**Key Implementation Details:**
- Uses `Map<string, FileNode>` for O(1) file lookups
- Maintains parent-child relationships via `children: Map<string, FileNode>`
- All paths normalized to start with `/` and use forward slashes
- Serializable to JSON for database storage
- Methods mirror standard filesystem operations: `createFile`, `readFile`, `updateFile`, `deleteFile`, `rename`

**Critical for AI Tool Integration:**
- `viewFile(path, viewRange?)` - Returns file content with line numbers (like `cat -n`)
- `createFileWithParents(path, content)` - Auto-creates parent directories
- `replaceInFile(path, oldStr, newStr)` - String replacement for editing
- `insertInFile(path, insertLine, text)` - Line-based insertion

### AI Tools (`src/lib/tools/`)

Two tools exposed to the AI model for file manipulation:

**`str_replace_editor`** (`str-replace.ts`):
- Commands: `view`, `create`, `str_replace`, `insert`, `undo_edit`
- Mimics Claude's text editor tool for familiarity
- `view`: Shows file with line numbers or directory listing
- `create`: Creates new file with content
- `str_replace`: Replaces exact string matches (all occurrences)
- `insert`: Inserts text at specific line number

**`file_manager`** (`file-manager.ts`):
- Commands: `rename`, `delete`
- `rename`: Moves/renames files, auto-creates parent directories
- `delete`: Recursively removes files/folders

### JSX Transformation Pipeline (`src/lib/transform/jsx-transformer.ts`)

Transforms user code for browser execution without a build step:

1. **Babel Transformation**:
   - Transpiles JSX/TSX to browser-compatible JavaScript
   - Uses React automatic runtime (no `React.createElement` needed)
   - Presets: `react` (with automatic runtime), `typescript`

2. **Import Resolution**:
   - Third-party packages → `https://esm.sh/{package}` CDN
   - Local files → Blob URLs created from transformed code
   - `@/` alias → Maps to root directory `/`
   - Extension-less imports → Automatically resolves `.jsx`, `.tsx`, `.js`, `.ts`

3. **CSS Handling**:
   - CSS imports detected and removed from JS code
   - Content collected and injected into `<style>` tag in preview HTML
   - Supports relative paths and `@/` alias

4. **Error Handling**:
   - Syntax errors caught per-file and displayed in preview
   - Missing imports replaced with placeholder components
   - Transformation errors isolated to prevent cascade failures

5. **Import Map Generation**:
   - Creates ES module import map for browser
   - Maps all file variations (with/without extension, with/without leading slash, @/ alias)
   - Example: `/components/Button.jsx` accessible as:
     - `/components/Button.jsx`
     - `components/Button.jsx`
     - `@/components/Button.jsx`
     - `/components/Button` (without extension)

### Preview System (`src/components/preview/PreviewFrame.tsx`)

Renders generated code in a sandboxed iframe:

**Sandbox Attributes**: `allow-scripts allow-same-origin allow-forms`
- Required for ES module import maps with blob URLs
- Uses `srcdoc` attribute for immediate rendering

**Entry Point Detection**:
- Priority order: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → `/src/App.jsx` → first `.jsx/.tsx` file
- Dynamically adjusts when files are created/deleted

**Error Boundary**:
- React error boundary injected into preview HTML
- Catches runtime errors and displays user-friendly messages
- Syntax errors shown before attempting to render

### Authentication & Sessions (`src/lib/auth.ts`)

**JWT-based authentication** using `jose` library:
- Cookie name: `auth-token`
- Expiration: 7 days
- Secret: `JWT_SECRET` env var (defaults to `development-secret-key`)
- HttpOnly cookies in production, secure cookies enabled

**Session Flow**:
1. User signs up/in → Server validates credentials
2. `createSession(userId, email)` → Generates JWT, sets cookie
3. Middleware checks `verifySession()` on protected routes
4. Server actions use `getSession()` to get current user
5. `deleteSession()` clears cookie on logout

### Anonymous User Support (`src/lib/anon-work-tracker.ts`)

Anonymous users can create components without signing up:
- Work stored in `sessionStorage` (tab-scoped, lost on tab close)
- Keys: `uigen_has_anon_work` (boolean), `uigen_anon_data` (JSON)
- Tracks messages and virtual file system state
- Used to show "sign up to save" prompts

### Database Schema (Prisma + SQLite)

**Location**: `prisma/schema.prisma`
**Output**: `src/generated/prisma` (MUST regenerate after schema changes)

**Models**:
```prisma
User {
  id: String (cuid)
  email: String (unique)
  password: String (bcrypt hashed)
  projects: Project[]
}

Project {
  id: String (cuid)
  name: String
  userId: String? (nullable for future anonymous project support)
  messages: String (JSON stringified)
  data: String (JSON stringified VirtualFileSystem)
  user: User (relation)
}
```

**Critical**: `messages` and `data` are JSON strings, not JSON columns. Always `JSON.parse()` on read, `JSON.stringify()` on write.

### API Route: `/api/chat` (`src/app/api/chat/route.ts`)

**Core AI interaction endpoint** using Vercel AI SDK:

**Request Body**:
```typescript
{
  messages: any[];           // Chat history
  files: Record<string, FileNode>;  // Serialized virtual file system
  projectId?: string;        // For authenticated users
}
```

**Response**: Streaming response with AI tool calls and text deltas

**Flow**:
1. Prepends system prompt (`generationPrompt`) with cache control
2. Deserializes virtual file system from `files`
3. Calls `streamText()` with Claude model and tools
4. `onFinish`: Saves updated messages + file system to database (if authenticated)
5. Returns `DataStreamResponse` for client-side consumption

**Model Configuration**:
- Model: `claude-haiku-4-5` (fast, cost-effective)
- Max tokens: 10,000
- Max steps: 40 (or 4 for mock provider)
- Timeout: 120 seconds (`maxDuration`)

**Mock Provider**: If `ANTHROPIC_API_KEY` is missing, uses `MockLanguageModel` which generates static counter/form/card components in a scripted 4-step flow.

### Context Providers

**`FileSystemContext`** (`src/lib/contexts/file-system-context.tsx`):
- Wraps `VirtualFileSystem` for React components
- Provides: `createFile`, `readFile`, `updateFile`, `deleteFile`, `getFileTree`, `getAllFiles`
- `refreshTrigger`: Counter that increments on changes to trigger re-renders
- Deserializes project data on mount

**`ChatContext`** (`src/lib/contexts/chat-context.tsx`):
- Manages AI chat state using Vercel AI SDK's `useChat`
- Tracks which files were modified by AI in each turn
- Syncs file system changes to context for preview updates

### Routing & Page Structure

**Next.js 15 App Router** with React Server Components:

- `/` (anonymous) → Shows chat + preview interface
- `/` (authenticated) → Redirects to most recent project or creates new one
- `/[projectId]` → Loads specific project from database
- `/api/chat` → AI chat endpoint (POST only)

**Server Actions** (`src/actions/`):
- `getUser()` - Gets current user from session
- `getProjects()` - Lists all projects for current user
- `getProject(id)` - Fetches single project with access check
- `createProject(data)` - Creates new project for authenticated user

### Middleware (`src/middleware.ts`)

Currently minimal - could be extended for:
- Route protection (redirect unauthenticated users)
- Session validation
- Rate limiting

## Component Testing

Tests use **Vitest** + **React Testing Library**:

**Test Files**: `src/**/__tests__/*.test.tsx`

**Running Tests**:
```bash
npm test                    # Watch mode
npm test -- --run          # Single run
npm test -- path/to/test   # Run specific test
```

**Key Test Patterns**:
- Mock `VirtualFileSystem` for file system tests
- Use `render()` from `@testing-library/react` for component tests
- Mock Next.js router with `next/navigation`

## Development Patterns

### Adding a New AI Tool

1. Create tool builder in `src/lib/tools/your-tool.ts`:
```typescript
export const buildYourTool = (fileSystem: VirtualFileSystem) => ({
  id: "tool_name",
  parameters: z.object({ /* zod schema */ }),
  execute: async (params) => { /* implementation */ }
});
```

2. Register in `/api/chat/route.ts`:
```typescript
tools: {
  str_replace_editor: buildStrReplaceTool(fileSystem),
  file_manager: buildFileManagerTool(fileSystem),
  your_tool: buildYourTool(fileSystem),  // Add here
}
```

### Modifying the System Prompt

Edit `src/lib/prompts/generation.tsx`. This prompt guides the AI's behavior when generating components. Changes affect how the AI uses tools and structures responses.

### Adding Database Models

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name your_migration_name`
3. Run `npx prisma generate` (regenerates client)
4. Restart dev server to pick up new types

### Supporting New File Types in Preview

1. Update `transformJSX()` in `jsx-transformer.ts` to handle new extension
2. Add Babel preset/plugin if needed
3. Update import map generation in `createImportMap()`
4. Test in preview iframe

## Environment Variables

Required:
- `JWT_SECRET` - JWT signing secret (defaults to development key if missing)

Optional:
- `ANTHROPIC_API_KEY` - Claude API key (uses mock provider if missing)
- `NODE_ENV` - Set to `production` for production builds

## Common Issues

**Prisma Client Not Found**:
- Error: `Can't resolve '@/generated/prisma'`
- Fix: Run `npx prisma generate`

**Preview Not Updating**:
- Check browser console for import errors
- Verify entry point file exists (`/App.jsx` or `/index.jsx`)
- Check `FileSystemContext` `refreshTrigger` is incrementing

**AI Tools Not Working**:
- Verify tool is registered in `/api/chat/route.ts`
- Check tool schema matches AI's expectations
- Review AI's tool call arguments in network tab

**Session/Auth Issues**:
- Clear cookies and restart dev server
- Verify `JWT_SECRET` is set
- Check cookie settings (httpOnly, secure) match environment

## Tech Stack Summary

- **Framework**: Next.js 15 (App Router, React Server Components)
- **UI**: React 19, Tailwind CSS v4, Radix UI components
- **AI**: Vercel AI SDK, Anthropic Claude (claude-haiku-4-5)
- **Database**: Prisma + SQLite
- **Auth**: JWT (jose library) with httpOnly cookies
- **Testing**: Vitest + React Testing Library
- **Code Transform**: Babel (standalone), ES modules + import maps
- **Styling**: Tailwind CSS (CDN in preview iframe)
- @prisma\schema.prisma , the schema of the database in this file , you can refer anytime when you need to understand the schema