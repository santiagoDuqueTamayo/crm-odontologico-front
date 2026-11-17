import express, { type ErrorRequestHandler, type Express } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3';
const MAX_AUDIO_BYTES = 25_000_000;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a'
]);

function resolveGroqApiKey(): string | undefined {
  const fromEnv = process.env['GROQ_API_KEY']?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const candidatePaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'src/app/features/odontograma/models/.env')
  ];

  for (const envPath of candidatePaths) {
    if (!existsSync(envPath)) continue;
    try {
      const content = readFileSync(envPath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = /^GROQ_API_KEY\s*=\s*(.+)$/.exec(line);
        if (match?.[1]) {
          const key = match[1].trim().replace(/^['"]|['"]$/g, '');
          if (key) {
            process.env['GROQ_API_KEY'] = key;
            return key;
          }
        }
      }
    } catch {
      // Ignorar errores de lectura de archivo local
    }
  }
  return undefined;
}

export interface TranscriptionProvider {
  transcribir(audio: Buffer, mimeType: string): Promise<string>;
}

export class GroqTranscriptionProvider implements TranscriptionProvider {
  async transcribir(audio: Buffer, mimeType: string): Promise<string> {
    const apiKey = resolveGroqApiKey();
    if (!apiKey) {
      throw new Error('Falta configurar GROQ_API_KEY en el servidor.');
    }

    const extension = mimeType.split('/')[1]?.split(';')[0] || 'webm';
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([Uint8Array.from(audio)], { type: mimeType }),
      `dictado.${extension}`
    );
    formData.append('model', GROQ_TRANSCRIPTION_MODEL);
    formData.append('language', 'es');
    formData.append(
      'prompt',
      'Transcribe en español de Colombia dictados odontológicos (diente, cuadrante, oclusal, incisal, mesial, distal, vestibular, palatino, lingual, sano, caries, resina, amalgama, restaurado, fracturado, ausente, extraído, retenido, corona, implante, sellante, ICDAS, abfracción, abrasión, atrición, erosión, endodoncia) y datos del paciente (nombres, documento, teléfono, dirección, edad, género, correo, ocupación, aseguradora, contacto de emergencia, alergias, medicamentos y antecedentes).'
    );
    formData.append('response_format', 'json');

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Groq devolvió el estado HTTP ${response.status}.`);
    }

    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      !('text' in result) ||
      typeof result.text !== 'string' ||
      !result.text.trim()
    ) {
      throw new Error('Groq no devolvió una transcripción válida.');
    }
    return result.text.trim();
  }
}

export function registerSpeechTranscriptionRoute(
  app: Express,
  provider: TranscriptionProvider = new GroqTranscriptionProvider()
): void {
  app.post(
    '/api/speech-to-text',
    express.raw({ type: 'audio/*', limit: MAX_AUDIO_BYTES }),
    async (request, response) => {
      const mimeType = request.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!mimeType || !ALLOWED_AUDIO_TYPES.has(mimeType)) {
        response.status(415).json({ message: 'El formato de audio no es compatible.' });
        return;
      }
      if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
        response.status(400).json({ message: 'No se recibió audio para transcribir.' });
        return;
      }

      try {
        const text = await provider.transcribir(request.body, mimeType);
        response.json({ text });
      } catch (error) {
        console.error('Falló la transcripción de audio:', error);
        response.status(502).json({
          message: 'No fue posible transcribir el audio. Verifica la configuración de Groq e inténtalo de nuevo.'
        });
      }
    }
  );

  const audioErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
    if (error?.type === 'entity.too.large') {
      response.status(413).json({
        message: 'El audio supera el límite de 25 MB permitido por Groq.'
      });
      return;
    }
    next(error);
  };
  app.use('/api/speech-to-text', audioErrorHandler);
}
