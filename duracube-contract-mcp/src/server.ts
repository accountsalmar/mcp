import express, { Request, Response, NextFunction } from 'express';
import {
  getDuracubePrinciples,
  getLearnedCorrections,
  getOutputFormat,
  toolDefinitions,
} from './tools/knowledge-tools.js';
import {
  GetPrinciplesSchema,
  GetLearnedCorrectionsSchema,
} from './schemas/tool-schemas.js';

const app = express();
app.use(express.json());

// CORS middleware for claude.ai access
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check endpoint for Railway
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    server: 'duracube-contract-mcp',
    version: '1.0.0',
    tools: ['get_duracube_principles', 'get_learned_corrections', 'get_output_format'],
  });
});

// List available tools
app.get('/tools', (req: Request, res: Response) => {
  res.json({
    tools: [
      toolDefinitions.get_duracube_principles,
      toolDefinitions.get_learned_corrections,
      toolDefinitions.get_output_format,
    ],
  });
});

// MCP tool call endpoint
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const { method, params } = req.body;

    // Handle tools/list request
    if (method === 'tools/list') {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: {
          tools: [
            toolDefinitions.get_duracube_principles,
            toolDefinitions.get_learned_corrections,
            toolDefinitions.get_output_format,
          ],
        },
      });
      return;
    }

    // Handle tools/call request
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      let result: string;

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

        default:
          res.status(400).json({
            jsonrpc: '2.0',
            id: req.body.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`,
            },
          });
          return;
      }

      res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        },
      });
      return;
    }

    // Unknown method
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32601,
        message: `Unknown method: ${method}`,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32603,
        message: errorMessage,
      },
    });
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

export function startHttpServer(port: number = 3000): void {
  app.listen(port, () => {
    console.error(`DuraCube Contract MCP Server running on http://localhost:${port}`);
    console.error('Endpoints:');
    console.error(`  GET  /health - Health check`);
    console.error(`  GET  /tools - List available tools`);
    console.error(`  POST /mcp - MCP JSON-RPC endpoint`);
    console.error(`  POST /tools/get_duracube_principles - Direct tool call`);
    console.error(`  POST /tools/get_learned_corrections - Direct tool call`);
    console.error(`  GET  /tools/get_output_format - Direct tool call`);
  });
}

export { app };
