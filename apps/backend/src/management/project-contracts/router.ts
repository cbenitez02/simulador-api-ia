import multer from 'multer';
import { Router } from 'express';
import { requireRequestActor } from '../../auth/request-context.js';
import { AppError } from '../../middleware/error-handler.js';
import { projectContractFormatQuerySchema, projectContractParamsSchema } from './schema.js';
import { analyzeProjectContract, exportProjectContract, importProjectContract } from './service.js';

const upload = multer({ storage: multer.memoryStorage() });

export const projectContractsRouter = Router({ mergeParams: true });

function requireUploadedContract(req: Parameters<typeof projectContractsRouter.post>[1][0]) {
  const file = (req as typeof req & { file?: { buffer: Buffer; originalname?: string } }).file;
  if (!file?.buffer?.length) {
    throw new AppError(400, 'Contract file is required', { code: 'OPENAPI_FILE_REQUIRED' });
  }

  return {
    sourceText: file.buffer.toString('utf8'),
    sourceName: file.originalname,
  };
}

projectContractsRouter.get('/', async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectContractParamsSchema.parse(req.params);
    const { format } = projectContractFormatQuerySchema.parse(req.query);
    const exported = await exportProjectContract(actor, projectId, format);
    res
      .status(200)
      .type(format === 'yaml' ? 'application/yaml' : 'application/json')
      .setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`)
      .setHeader(
        'X-Simulador-Contract-Warnings',
        encodeURIComponent(JSON.stringify(exported.warnings))
      )
      .send(exported.body);
  } catch (error) {
    next(error);
  }
});

projectContractsRouter.post('/analyze', upload.single('file'), async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectContractParamsSchema.parse(req.params);
    const { sourceText, sourceName } = requireUploadedContract(req);
    res.status(200).json(await analyzeProjectContract(actor, projectId, sourceText, sourceName));
  } catch (error) {
    next(error);
  }
});

projectContractsRouter.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    const actor = requireRequestActor(req);
    const { projectId } = projectContractParamsSchema.parse(req.params);
    const { sourceText, sourceName } = requireUploadedContract(req);
    res.status(200).json(await importProjectContract(actor, projectId, sourceText, sourceName));
  } catch (error) {
    next(error);
  }
});
