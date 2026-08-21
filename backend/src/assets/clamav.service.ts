import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'node:net';

export type AntivirusScanResult =
  | { status: 'clean'; engine: 'clamav' | 'disabled' }
  | { status: 'infected'; engine: 'clamav'; signature: string };

@Injectable()
export class ClamAvService {
  private readonly logger = new Logger(ClamAvService.name);
  private readonly enabled: boolean;
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  private warnedDisabled = false;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('ASSET_ANTIVIRUS_ENABLED') !== 'false';
    this.host = config.get<string>('CLAMAV_HOST') ?? '127.0.0.1';
    this.port = positiveInteger(config.get<string>('CLAMAV_PORT'), 3310);
    this.timeoutMs = positiveInteger(
      config.get<string>('CLAMAV_TIMEOUT_MS'),
      15_000,
    );
    if (!this.enabled && config.get<string>('NODE_ENV') === 'production') {
      throw new Error('Antivirus cannot be disabled in production.');
    }
  }

  async scan(buffer: Buffer): Promise<AntivirusScanResult> {
    if (!this.enabled) {
      if (!this.warnedDisabled) {
        this.warnedDisabled = true;
        this.logger.warn(
          'Asset antivirus is disabled. This setting is only acceptable in local development.',
        );
      }
      return { status: 'clean', engine: 'disabled' };
    }

    const response = await scanWithClamd(
      buffer,
      this.host,
      this.port,
      this.timeoutMs,
    );
    if (response.endsWith('OK')) {
      return { status: 'clean', engine: 'clamav' };
    }
    const found = /:\s+(.+)\s+FOUND$/.exec(response);
    if (found) {
      return {
        status: 'infected',
        engine: 'clamav',
        signature: found[1],
      };
    }
    throw new Error(`ClamAV returned an unexpected response: ${response}`);
  }

  async checkHealth(): Promise<void> {
    if (!this.enabled) return;
    const response = await commandWithClamd(
      'zPING\0',
      this.host,
      this.port,
      Math.min(this.timeoutMs, 5_000),
    );
    if (response !== 'PONG') {
      throw new Error(
        `ClamAV health check returned ${response || 'no response'}.`,
      );
    }
  }
}

function commandWithClamd(
  command: string,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const response: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve(
        Buffer.concat(response).toString('utf8').replace(/\0/g, '').trim(),
      );
    };
    socket.setTimeout(timeoutMs);
    socket.once('timeout', () =>
      finish(new Error('ClamAV health check timed out.')),
    );
    socket.once('error', finish);
    socket.on('data', (chunk: Buffer) => {
      response.push(chunk);
      if (chunk.includes(0) || chunk.includes(10)) finish();
    });
    socket.once('close', () => {
      if (!settled && response.length > 0) finish();
      else if (!settled) {
        finish(new Error('ClamAV closed the connection without a response.'));
      }
    });
    socket.connect(port, host, () => socket.write(command));
  });
}

function scanWithClamd(
  buffer: Buffer,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const response: Buffer[] = [];
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve(
        Buffer.concat(response).toString('utf8').replace(/\0/g, '').trim(),
      );
    };

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => finish(new Error('ClamAV scan timed out.')));
    socket.once('error', (error) => finish(error));
    socket.on('data', (chunk: Buffer) => {
      response.push(chunk);
      const text = Buffer.concat(response).toString('utf8');
      if (text.includes('\0') || text.includes('\n')) {
        finish();
      }
    });
    socket.once('close', () => {
      if (!settled && response.length > 0) {
        finish();
      } else if (!settled) {
        finish(new Error('ClamAV closed the connection without a response.'));
      }
    });
    socket.connect(port, host, () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, offset + 64 * 1024);
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.length, 0);
        socket.write(length);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
