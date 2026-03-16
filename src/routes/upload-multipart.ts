import type { FastifyInstance } from "fastify";
import { uploadController } from "../controllers/upload-controller.js";

type UploadQuerystring = {
  placa?: string;
};

export function registerMultipartUploadRoute(app: FastifyInstance) {
  app.post<{ Querystring: UploadQuerystring }>(
    "/upload",
    (request, reply) => uploadController.uploadMultipart(request, reply),
  );
}
