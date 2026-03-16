import type { FastifyReply, FastifyRequest } from "fastify";
import type { Multipart } from "@fastify/multipart";
import { config } from "../config/index.js";
import { uploadToBucket } from "../services/upload-to-bucket.js";
import { sanitizePath } from "../utils/path.js";

type UploadQuerystring = {
  placa?: string;
};

type UploadBase64Body = {
  data?: string;
  filename?: string;
  contentType?: string;
};

type BatchUploadBody = {
  arquitetura_de_pasta?: string;
  arquivos?: Array<{
    data: string;
    filename: string;
    contentType?: string;
  }>;
};

export class UploadController {
  async uploadMultipart(
    request: FastifyRequest<{ Querystring: UploadQuerystring }>,
    reply: FastifyReply,
  ) {
    if (!config.gcsBucket) {
      return reply.status(500).send({
        ok: false,
        error: "GCS_BUCKET nao configurado.",
      });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({
        ok: false,
        error: 'Envie um arquivo no campo "file" (multipart/form-data).',
      });
    }

    const fileBytes = await file.toBuffer();
    const contentType = file.mimetype || "application/octet-stream";
    const placaFromFields = this.extractFieldValue(file.fields?.placa);
    const placaFromQuery = request.query.placa;
    const folderSubpath = sanitizePath(placaFromFields ?? placaFromQuery);

    try {
      const result = await uploadToBucket(
        fileBytes,
        file.filename,
        contentType,
        folderSubpath,
      );
      return reply.status(201).send({
        ok: true,
        bucket: config.gcsBucket,
        objectName: result.objectName,
        contentType,
        size: fileBytes.byteLength,
        gcsUri: `gs://${config.gcsBucket}/${result.objectName}`,
        publicUrl: result.publicUrl,
      });
    } catch (error) {
      request.log.error({ err: error }, "Falha ao enviar arquivo para o GCS.");
      return reply.status(500).send({
        ok: false,
        error:
          "Falha ao fazer upload para o bucket. Verifique credenciais e permissoes no GCP.",
      });
    }
  }

  async uploadBase64(request: FastifyRequest, reply: FastifyReply) {
    if (!config.gcsBucket) {
      return reply.status(500).send({
        ok: false,
        error: "GCS_BUCKET nao configurado.",
      });
    }

    const body = request.body as UploadBase64Body | undefined;
    if (!body?.data || !body?.filename) {
      return reply.status(400).send({
        ok: false,
        error: 'Envie "data" (base64) e "filename" no corpo JSON.',
      });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(body.data, "base64");
      if (fileBuffer.length === 0) {
        throw new Error("empty");
      }
    } catch {
      return reply.status(400).send({
        ok: false,
        error: 'Base64 invalido em "data".',
      });
    }

    if (fileBuffer.byteLength > config.maxFileSizeBytes) {
      return reply.status(413).send({
        ok: false,
        error: `Arquivo excede limite de ${config.maxFileSizeBytes} bytes.`,
      });
    }

    const contentType = body.contentType ?? "image/jpeg";

    try {
      const result = await uploadToBucket(
        fileBuffer,
        body.filename,
        contentType,
      );
      return reply.status(201).send({
        ok: true,
        bucket: config.gcsBucket,
        objectName: result.objectName,
        contentType,
        size: fileBuffer.byteLength,
        gcsUri: `gs://${config.gcsBucket}/${result.objectName}`,
        publicUrl: result.publicUrl,
      });
    } catch (error) {
      request.log.error({ err: error }, "Falha ao enviar base64 para o GCS.");
      return reply.status(500).send({
        ok: false,
        error:
          "Falha ao fazer upload para o bucket. Verifique credenciais e permissoes no GCP.",
      });
    }
  }

  async uploadBatch(request: FastifyRequest, reply: FastifyReply) {
    if (!config.gcsBucket) {
      return reply.status(500).send({
        ok: false,
        error: "GCS_BUCKET nao configurado.",
      });
    }

    const body = request.body as BatchUploadBody | undefined;
    if (!body?.arquivos || !Array.isArray(body.arquivos)) {
      return reply.status(400).send({
        ok: false,
        error: 'Envie um array "arquivos" no corpo JSON.',
      });
    }

    const folderSubpath = sanitizePath(body.arquitetura_de_pasta);
    const results = [];

    for (const item of body.arquivos) {
      if (!item.data || !item.filename) {
        results.push({
          filename: item.filename || "unknown",
          ok: false,
          error: 'Campos "data" e "filename" obrigatorios.',
        });
        continue;
      }

      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(item.data, "base64");
        if (fileBuffer.length === 0) throw new Error("empty");
      } catch {
        results.push({
          filename: item.filename,
          ok: false,
          error: "Base64 invalido.",
        });
        continue;
      }

      if (fileBuffer.byteLength > config.maxFileSizeBytes) {
        results.push({
          filename: item.filename,
          ok: false,
          error: "Tamanho excede o limite.",
        });
        continue;
      }

      const contentType = item.contentType ?? "application/octet-stream";

      try {
        const result = await uploadToBucket(
          fileBuffer,
          item.filename,
          contentType,
          folderSubpath,
        );
        results.push({
          filename: item.filename,
          ok: true,
          objectName: result.objectName,
          publicUrl: result.publicUrl,
        });
      } catch (error) {
        results.push({
          filename: item.filename,
          ok: false,
          error: "Erro no upload para o GCS.",
        });
      }
    }

    return reply.status(200).send({
      ok: true,
      folder: folderSubpath,
      results,
    });
  }

  private extractFieldValue(
    field?: Multipart | Multipart[] | undefined,
  ): string | undefined {
    if (!field) {
      return undefined;
    }

    const firstField = Array.isArray(field) ? field[0] : field;
    if (!firstField || firstField.type !== "field") {
      return undefined;
    }

    const { value } = firstField;
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Buffer.isBuffer(value)) {
      return value.toString("utf-8");
    }

    return undefined;
  }
}

export const uploadController = new UploadController();
