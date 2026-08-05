import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: string;
  application: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      application: 'MOCTES API',
      timestamp: new Date().toISOString(),
    };
  }
}
