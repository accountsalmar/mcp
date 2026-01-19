<!-- Copilot / AI agent instructions for this repository -->

# Copilot Instructions

These notes help AI coding agents be productive in this repository. Focus on the two MCP server implementations and the UIGen app: where to find code, how to run it, and important project-specific constraints.

- **Which subsystems:**
  - Root Python MCP servers: `fabric-model-reader-mcp.py`, `fabric-workspace-reader-mcp.py` (FastMCP).
  - Full TypeScript MCP server: `Power-bi-map-server/` (built on `@modelcontextprotocol/sdk`).
  - UI generator app: `uigen/` (Next.js + VirtualFileSystem + Vercel AI SDK).

- **Run / build shortcuts:**
  - Python servers: `python fabric-model-reader-mcp.py` or `python fabric-workspace-reader-mcp.py`.
  - TypeScript server: `cd Power-bi-map-server && npm install && npm run build && npm start` (or `npm run dev`).
  - UIGen dev: `cd uigen && npm run setup && npm run dev` (run `npx prisma generate` after schema changes).

- **Critical runtime constraints (must obey):**
  - TypeScript MCP server: never write debugging output to STDOUT — that breaks the MCP JSON-RPC stream. Use `console.error()` for logs. Do not use `console.log()` in `Power-bi-map-server/src/*` unless `ALLOW_UNSAFE_STDOUT=true` for controlled debugging.
  - UIGen uses an in-memory `VirtualFileSystem` (`uigen/src/lib/file-system.ts`). AI tools operate on this virtual FS; no disk writes occur. Use the exposed tools (`str_replace_editor`, `file_manager`) when editing project files programmatically.

- **Patterns and examples to follow:**
  - Long running Fabric APIs return `202 Accepted` with a `Location` header — poll the Location URL (respect `Retry-After`) until status `Succeeded` or `Failed`. See `fabric-model-reader-mcp.py` and `Power-bi-map-server/src/*` for implementations.
  - Tool registration (TypeScript): register tool builders in `Power-bi-map-server/src/index.ts` / `/src/...` and expose them to the MCP server. Example registration snippet used in `uigen/api/chat/route.ts`:

```ts
tools: {
  str_replace_editor: buildStrReplaceTool(fileSystem),
  file_manager: buildFileManagerTool(fileSystem),
  // add new tool here
}
```

- **Where to look for conventions and schema examples:**
  - Authentication flows and supported methods: `Power-bi-map-server/README.md` and `Power-bi-map-server/src/auth-client.ts`.
  - Prisma schema and DB patterns (UIGen): `uigen/prisma/schema.prisma` — `messages` and `data` fields are stored as JSON strings; remember to `JSON.parse()`/`JSON.stringify()`.
  - JSX transform + import map behavior in `uigen/src/lib/transform/jsx-transformer.ts` (resolves `@/` alias, extension-less imports, and third-party CDN mapping to `https://esm.sh`).

- **Testing & E2E notes:**
  - TypeScript E2E tests may create real Fabric resources. Check `Power-bi-map-server/tests` and `.env.e2e` for required env vars like `FABRIC_CAPACITY_ID` and prefer simulation mode for CI/local dry runs.
  - UIGen tests: `uigen` uses Vitest. Run `npm test` in `uigen/`.

- **Safe code-editing guidance for agents:**
  - When modifying MCP servers, preserve stdout/stderr behaviors and existing authentication order (env vars → azure-cli → keyring / service principal).
  - For UIGen editing flows, prefer using the existing tools and VirtualFileSystem APIs rather than creating ad-hoc file writes.
  - When adding new AI tools, follow the pattern in `uigen/src/lib/tools/*`: export a `buildX` function that returns `{ id, parameters: z.object(...), execute }` and register it in the chat route.

- **Quick file references** (examples of authoritative source locations):
  - Python MCP examples: `fabric-model-reader-mcp.py`, `fabric-workspace-reader-mcp.py`
  - TypeScript MCP server: `Power-bi-map-server/src/index.ts`, `Power-bi-map-server/src/auth-client.ts`, `Power-bi-map-server/src/azure-openai-analyzer.ts`
  - UIGen AI & FS: `uigen/src/app/api/chat/route.ts`, `uigen/src/lib/file-system.ts`, `uigen/src/lib/tools/str-replace.ts`, `uigen/src/lib/tools/file-manager.ts`

If anything above is unclear or you want more specific examples (e.g., a sample tool implementation or a short test harness), tell me which area to expand and I'll iterate.
