import { Global, Module } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PolicyGuard } from './policy.guard';

@Global()
@Module({
  providers: [PoliciesService, PolicyGuard],
  exports: [PoliciesService, PolicyGuard],
})
export class AuthorizationModule {}
