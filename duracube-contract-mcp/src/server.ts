import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  getDuracubePrinciples,
  getLearnedCorrections,
  getOutputFormat,
  getFinanceExtractionGuide,
  toolDefinitions,
} from './tools/knowledge-tools.js';
import {
  GetPrinciplesSchema,
  GetLearnedCorrectionsSchema,
  GetFinanceExtractionGuideSchema,
} from './schemas/tool-schemas.js';

const app = express();
app.use(express.json());

// Session management for MCP protocol
const sessions = new Map<string, { createdAt: Date }>();

// Clean up old sessions (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.createdAt.getTime() < oneHourAgo) {
      sessions.delete(sessionId);
    }
  }
}, 10 * 60 * 1000); // Run every 10 minutes

// CORS middleware for claude.ai access
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Mcp-Session-Id');
  res.header('Access-Control-Expose-Headers', 'Content-Type, Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// HEAD request support for protocol discovery
app.head('/', (req: Request, res: Response) => {
  res.sendStatus(200);
});

app.head('/mcp', (req: Request, res: Response) => {
  res.sendStatus(200);
});

// Health check endpoint for Railway
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'duracube-contract-mcp',
    version: '1.0.0',
    protocol: '2025-03-26',
    tools: ['get_duracube_principles', 'get_learned_corrections', 'get_output_format', 'get_finance_extraction_guide'],
    activeSessions: sessions.size,
  });
});

// List available tools
app.get('/tools', (req: Request, res: Response) => {
  res.json({
    tools: [
      toolDefinitions.get_duracube_principles,
      toolDefinitions.get_learned_corrections,
      toolDefinitions.get_output_format,
      toolDefinitions.get_finance_extraction_guide,
    ],
  });
});

// SSE endpoint for Claude.ai MCP connection (legacy support)
app.get('/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial connection event
  const sessionId = randomUUID();
  sessions.set(sessionId, { createdAt: new Date() });
  res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sessions.delete(sessionId);
  });
});

// Helper function to handle MCP requests
function handleMcpRequest(req: Request, res: Response, sessionId: string | null) {
  const { method, params, id } = req.body;

  // Handle initialize - create new session
  if (method === 'initialize') {
    const newSessionId = randomUUID();
    sessions.set(newSessionId, { createdAt: new Date() });

    res.setHeader('Mcp-Session-Id', newSessionId);
    res.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: { listChanged: true },
        },
        serverInfo: {
          name: 'duracube-contract-mcp',
          version: '1.0.0',
        },
      },
    });
    return;
  }

  // For all other methods, validate session if provided
  if (sessionId && !sessions.has(sessionId)) {
    // Session invalid but let's be lenient and create a new one
    const newSessionId = randomUUID();
    sessions.set(newSessionId, { createdAt: new Date() });
    res.setHeader('Mcp-Session-Id', newSessionId);
    sessionId = newSessionId;
  } else if (sessionId) {
    res.setHeader('Mcp-Session-Id', sessionId);
  }

  // Handle notifications/initialized - return 202 Accepted
  if (method === 'notifications/initialized' || method === 'initialized') {
    res.status(202).send();
    return;
  }

  // Handle tools/list request
  if (method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          toolDefinitions.get_duracube_principles,
          toolDefinitions.get_learned_corrections,
          toolDefinitions.get_output_format,
          toolDefinitions.get_finance_extraction_guide,
        ],
      },
    });
    return;
  }

  // Handle tools/call request
  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    let result: string;

    try {
      switch (name) {
        case 'get_duracube_principles': {
          const validatedArgs = GetPrinciplesSchema.parse(args || {});
          result = getDuracubePrinciples(validatedArgs);
          break;
        }

        case 'get_learned_corrections': {
          const validatedArgs = GetLearnedCorrectionsSchema.parse(args || {});
          result = getLearnedCorrections(validatedArgs);
          break;
        }

        case 'get_output_format': {
          result = getOutputFormat();
          break;
        }

        case 'get_finance_extraction_guide': {
          const validatedArgs = GetFinanceExtractionGuideSchema.parse(args || {});
          result = getFinanceExtractionGuide(validatedArgs);
          break;
        }

        default:
          res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`,
            },
          });
          return;
      }

      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: errorMessage,
        },
      });
    }
    return;
  }

  // Handle ping
  if (method === 'ping') {
    res.json({
      jsonrpc: '2.0',
      id,
      result: {},
    });
    return;
  }

  // Unknown method
  res.json({
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Unknown method: ${method}`,
    },
  });
}

// Messages endpoint for SSE-based MCP
app.post('/messages', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.sessionId as string) || (req.headers['mcp-session-id'] as string) || null;
    handleMcpRequest(req, res, sessionId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: {
        code: -32603,
        message: errorMessage,
      },
    });
  }
});

// Main MCP endpoint (Streamable HTTP)
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string || null;
    handleMcpRequest(req, res, sessionId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: {
        code: -32603,
        message: errorMessage,
      },
    });
  }
});

// DELETE endpoint to close session (MCP protocol requirement)
app.delete('/mcp', (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Direct tool endpoints for simpler access
app.post('/tools/get_duracube_principles', (req: Request, res: Response) => {
  try {
    const validatedArgs = GetPrinciplesSchema.parse(req.body || {});
    const result = getDuracubePrinciples(validatedArgs);
    res.json(JSON.parse(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/tools/get_learned_corrections', (req: Request, res: Response) => {
  try {
    const validatedArgs = GetLearnedCorrectionsSchema.parse(req.body || {});
    const result = getLearnedCorrections(validatedArgs);
    res.json(JSON.parse(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

app.get('/tools/get_output_format', (req: Request, res: Response) => {
  try {
    const result = getOutputFormat();
    res.json(JSON.parse(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/tools/get_finance_extraction_guide', (req: Request, res: Response) => {
  try {
    const validatedArgs = GetFinanceExtractionGuideSchema.parse(req.body || {});
    const result = getFinanceExtractionGuide(validatedArgs);
    res.json(JSON.parse(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

export function startHttpServer(port: number = 3000): void {
  app.listen(port, () => {
    console.error(`DuraCube Contract MCP Server running on http://localhost:${port}`);
    console.error('Protocol Version: 2025-03-26 (Streamable HTTP)');
    console.error('Endpoints:');
    console.error(`  GET  /health - Health check`);
    console.error(`  HEAD /mcp - Protocol discovery`);
    console.error(`  POST /mcp - MCP Streamable HTTP endpoint`);
    console.error(`  DELETE /mcp - Close session`);
    console.error(`  GET  /sse - SSE endpoint (legacy)`);
    console.error(`  POST /messages - MCP messages endpoint`);
    console.error(`  GET  /tools - List available tools`);
  });
}

export { app };
