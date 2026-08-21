import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class CollaborationBroadcaster {
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  publishSnapshot(documentId: string, snapshot: unknown): void {
    this.server
      ?.to(documentRoom(documentId))
      .emit('document:snapshot', snapshot);
  }

  publishDeleted(documentId: string): void {
    this.server
      ?.to(documentRoom(documentId))
      .emit('document:deleted', { documentId });
  }

  async revokeWorkspaceAccess(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    if (!this.server) return;
    const sockets = await this.server.fetchSockets();
    for (const socket of sockets) {
      const data = socket.data as {
        workspaceId?: string;
        principal?: { user?: { id?: string } };
      };
      if (
        data.workspaceId === workspaceId &&
        data.principal?.user?.id === userId
      ) {
        socket.emit('collaboration:error', { code: 'ACCESS_REVOKED' });
        socket.disconnect(true);
      }
    }
  }
}

export function documentRoom(documentId: string): string {
  return `document:${documentId}`;
}
