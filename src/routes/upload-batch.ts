import type { FastifyInstance } from "fastify";
import { uploadController } from "../controllers/upload-controller.js";

export function registerBatchUploadRoute(app: FastifyInstance) {
  app.post("/upload-batch", (request, reply) =>
    uploadController.uploadBatch(request, reply)
  );
}
