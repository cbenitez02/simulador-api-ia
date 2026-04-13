import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authenticateApiRequest } from './auth/middleware.js';
import { createCorsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestContextMiddleware } from './middleware/request-context.js';
import { aiRouter } from './management/ai/router.js';
import { dashboardRouter } from './management/dashboard/router.js';
import { endpointConfigRouter } from './management/endpoint-config/router.js';
import { endpointsRouter } from './management/endpoints/router.js';
import { globalConfigRouter } from './management/global-config/router.js';
import { logsRouter } from './management/logs/router.js';
import { projectsRouter } from './management/projects/router.js';
import { scenariosRouter } from './management/scenarios/router.js';
import { opsRouter } from './management/ops/router.js';
import { mockRouter } from './mock-server/mock.router.js';

export const app = express();

app.use(helmet());
app.use(cors(createCorsOptions(env)));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}
app.use(requestContextMiddleware);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});
app.use('/ops', opsRouter);

app.use('/api/v1', authenticateApiRequest);

app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/projects/:projectId/dashboard-summary', dashboardRouter);
app.use('/api/v1/projects/:projectId/endpoints', endpointsRouter);
app.use('/api/v1/projects/:projectId/endpoints', aiRouter);
app.use('/api/v1/endpoints/:endpointId/scenarios', scenariosRouter);
app.use('/api/v1/endpoints/:endpointId/config', endpointConfigRouter);
app.use('/api/v1/projects/:projectId/config', globalConfigRouter);
app.use('/api/v1/projects/:projectId/logs', logsRouter);
app.use('/mock', mockRouter);

app.use(errorHandler);
