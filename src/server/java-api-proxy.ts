import type { Express, Request, Response } from 'express';
import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
  type OutgoingHttpHeaders
} from 'node:http';
import { request as httpsRequest } from 'node:https';

const API_PREFIX = '/api/v1';
const DEFAULT_UPSTREAM_TIMEOUT_MS = 300_000;
const MAX_REQUEST_BODY_BYTES = 2_000_000;
const RETRY_DELAYS_MS = [10_000, 20_000, 30_000];

export function registerJavaApiProxy(
  app: Express,
  backendUrl =
    process.env['JAVA_API_BASE_URL'] || 'https://crm-odontologico-backend-qpca.onrender.com',
  timeoutMs = getUpstreamTimeout()
): void {
  const backend = new URL(backendUrl);
  if (backend.protocol !== 'http:' && backend.protocol !== 'https:') {
    throw new Error('JAVA_API_BASE_URL debe usar el protocolo HTTP o HTTPS.');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('JAVA_API_TIMEOUT_MS debe ser un entero positivo expresado en milisegundos.');
  }

  app.use(API_PREFIX, async (request: Request, response: Response) => {
    const target = new URL(request.originalUrl, backend);
    const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const headers: OutgoingHttpHeaders = {
      ...request.headers,
      host: target.host
    };
    delete headers['connection'];
    delete headers['keep-alive'];
    delete headers['proxy-authenticate'];
    delete headers['proxy-authorization'];
    delete headers['te'];
    delete headers['trailer'];
    delete headers['transfer-encoding'];
    delete headers['upgrade'];

    let body: Buffer;
    try {
      body = await readRequestBody(request);
    } catch (error) {
      if (response.destroyed) return;
      const tooLarge = error instanceof RequestBodyTooLargeError;
      response.status(tooLarge ? 413 : 400).json({
        message: tooLarge
          ? 'El cuerpo de la solicitud supera el límite permitido de 2 MB.'
          : 'No fue posible leer el cuerpo de la solicitud.'
      });
      return;
    }

    if (request.aborted || response.destroyed) return;
    if (body.length > 0) headers['content-length'] = body.length;

    let activeRequest: ClientRequest | undefined;
    const abortUpstream = (): void => {
      activeRequest?.destroy();
    };
    request.once('aborted', abortUpstream);

    try {
      for (let attempt = 0; ; attempt++) {
        if (request.aborted || response.destroyed) return;

        try {
          const upstreamResponse = await sendUpstreamRequest(
            transport,
            target,
            request.method,
            headers,
            body,
            timeoutMs,
            (upstream) => {
              activeRequest = upstream;
            }
          );
          response.status(upstreamResponse.statusCode ?? 502);
          for (const [name, value] of Object.entries(upstreamResponse.headers)) {
            if (value !== undefined) response.setHeader(name, value);
          }
          upstreamResponse.on('error', (error: Error) => response.destroy(error));
          upstreamResponse.pipe(response);
          return;
        } catch (error) {
          if (request.aborted || response.destroyed) return;
          if (!isTransientConnectionError(error) || attempt >= RETRY_DELAYS_MS.length) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            console.error(`Falló el proxy de ${API_PREFIX} hacia ${backend.origin}:`, message);
            response.status(502).json({
              message:
                'No fue posible conectar con el backend clínico. Verifica que esté activo y accesible.'
            });
            return;
          }

          const delay = RETRY_DELAYS_MS[attempt];
          console.warn(
            `Conexión temporalmente fallida con ${backend.origin}; reintento ${attempt + 1}/${RETRY_DELAYS_MS.length} en ${delay / 1000}s.`
          );
          await wait(delay);
        }
      }
    } finally {
      request.off('aborted', abortUpstream);
    }
  });
}

function sendUpstreamRequest(
  transport: typeof httpRequest,
  target: URL,
  method: string,
  headers: OutgoingHttpHeaders,
  body: Buffer,
  timeoutMs: number,
  onRequest: (request: ClientRequest) => void
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const upstream = transport(target, { method, headers }, resolve);
    onRequest(upstream);
    upstream.setTimeout(timeoutMs, () => {
      const error = new Error('El backend clínico excedió el tiempo de respuesta.') as NodeJS.ErrnoException;
      error.code = 'UPSTREAM_TIMEOUT';
      upstream.destroy(error);
    });
    upstream.once('error', reject);
    upstream.end(body);
  });
}

async function readRequestBody(request: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

class RequestBodyTooLargeError extends Error {}

function isTransientConnectionError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) return false;
  const code = error.code;
  return (
    typeof code === 'string' &&
    ['ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN'].includes(code)
  );
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getUpstreamTimeout(): number {
  const configuredTimeout = process.env['JAVA_API_TIMEOUT_MS'];
  if (configuredTimeout === undefined) return DEFAULT_UPSTREAM_TIMEOUT_MS;

  const timeoutMs = Number(configuredTimeout);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('JAVA_API_TIMEOUT_MS debe ser un entero positivo expresado en milisegundos.');
  }
  return timeoutMs;
}
