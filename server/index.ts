import dotenv from 'dotenv';
dotenv.config({ override: true });
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log, serveStatic } from "./static";

// Configure SSL handling for UK Land Registry API in development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // In production, serve pre-built static files.
  // In development, tsx runs this file directly and loads vite dev server.
  serveStatic(app);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  // Start daily scheduler for arrears detection and renewal reminders
  const { startScheduler } = await import('./schedulerService');
  startScheduler();

  // Start IMAP polling for SMTP email connections (every 5 minutes)
  const { imapPollingService } = await import('./services/email/imapPollingService');
  imapPollingService.start(5 * 60 * 1000); // Poll every 5 minutes

  // Register portfolio monitoring cron jobs (lazy, non-blocking)
  import('./services/portfolioMonitorService')
    .then(mod => mod.registerPortfolioMonitorJobs())
    .catch(err => console.error('Failed to register portfolio monitor jobs:', err));

  // Register Taylor's finance cron jobs and deal event subscriptions
  import('./agents/services/financeCronJobs')
    .then(mod => mod.registerFinanceCronJobs())
    .catch(err => log('Finance cron registration failed: ' + err));

  // Register Riley's business accounts cron jobs and deal event hooks
  import('./services/businessAccountsService')
    .then(async (mod) => {
      await mod.registerBusinessAccountsCronJobs();
      await mod.registerBusinessAccountsEventHooks();
    })
    .catch(err => log('Business accounts cron registration failed: ' + err));

  // Register Charlie's sourcing cron jobs
  import('./agents/services/sourcingCronJobs')
    .then(mod => mod.registerSourcingCronJobs())
    .catch(err => console.error('Failed to register sourcing cron jobs:', err));

  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
