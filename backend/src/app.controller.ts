import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): {
    status: string;
    application: string;
    timestamp: string;
  } {
    return this.appService.getHealth();
  }

  @Get('health/ready')
  async getReadiness() {
    const readiness = await this.appService.getReadiness();
    if (readiness.status !== 'ready') {
      throw new ServiceUnavailableException(readiness);
    }
    return readiness;
  }
}
