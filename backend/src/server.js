import { createApp } from './app.js';
import { config } from './config/index.js';
import { closeDb, getActiveEngine, initDb } from './db/index.js';
import { startBackgroundJobs, stopBackgroundJobs } from './jobs/index.js';

async function bootstrap() {
  try {
    console.log('🚀 Starting Brightloop Billing Platform...');

    // 1. Initialize Database
    await initDb();
    console.log(`📦 Database operational (Engine: ${getActiveEngine()})`);

    // 2. Initialize Background Cron Schedules
    startBackgroundJobs();

    // 3. Create Express App
    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`⚡ Brightloop Billing API listening on http://localhost:${config.port}`);
      console.log(`🛡️ Environment: ${config.env}`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      stopBackgroundJobs();
      server.close(async () => {
        console.log('HTTP server closed.');
        await closeDb();
        console.log('Database connections closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('💥 Fatal error during bootstrap:', err);
    process.exit(1);
  }
}

bootstrap();
