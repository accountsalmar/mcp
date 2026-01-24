import 'dotenv/config';
import { app } from './app.js';
import { config } from './config/environment.js';
import { initializeDatabase } from './config/database.js';

async function main() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized');

    // Start server
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
