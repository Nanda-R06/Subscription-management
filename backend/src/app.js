import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import catalogRoutes from './routes/catalog.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import reportRoutes from './routes/report.routes.js';
import { NotFoundError } from './utils/errors.js';

export function createApp() {
  const app = express();

  // 1. Security headers via Helmet
  app.use(helmet());

  // 2. CORS configuration
  app.use(
    cors({
      origin: [config.frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Rate Limiter on API routes
  app.use('/api/', generalLimiter);

  // 5. Health Check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Brightloop Billing API',
      timestamp: new Date().toISOString(),
      environment: config.env,
    });
  });

  // 6. Mount Module Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/catalog', catalogRoutes);
  app.use('/api/v1/subscriptions', subscriptionRoutes);
  app.use('/api/v1/invoices', invoiceRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/reports', reportRoutes);

  // 7. 404 Handler
  app.use((req, res, next) => {
    next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
  });

  // 8. Central Error Handler
  app.use(errorHandler);

  return app;
}
