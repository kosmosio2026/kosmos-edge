import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentEdgeContext = {
  edgeNodeId: string;
  edgeCode: string;
  edgeName: string;
  tenantId: string | null;
  apiKeyId: string;
  keyId: string;
};

export const CurrentEdge = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentEdgeContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.edge;
  },
);