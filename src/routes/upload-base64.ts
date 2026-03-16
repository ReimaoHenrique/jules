import type { FastifyInstance } from "fastify";
import { uploadController } from "../controllers/upload-controller.js";

export function registerBase64UploadRoute(app: FastifyInstance) {
  app.post(
    "/upload-base64",
    (request, reply) => uploadController.uploadBase64(request, reply),
  );
}
