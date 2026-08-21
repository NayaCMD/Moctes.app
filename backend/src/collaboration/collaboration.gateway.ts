import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { AuthPrincipal } from '../auth/auth.types';
import { AuthService } from '../auth/auth.service';
import { readSessionToken } from '../auth/session-cookie';
import type { Server, Socket } from 'socket.io';
import {
  CollaborationBroadcaster,
  documentRoom,
} from './collaboration-broadcaster.service';
import { CollaborationService } from './collaboration.service';
import type {
  CollaborationCursor,
  CollaborationOperationInput,
} from './collaboration.types';

interface CollaborationSocketData {
  principal?: AuthPrincipal;
  sessionToken?: string;
  documentId?: string;
  workspaceId?: string;
  canEdit?: boolean;
}

interface ClientToServerEvents {
  [event: string]: (...args: unknown[]) => void;
}

interface ServerToClientEvents {
  [event: string]: (...args: unknown[]) => void;
  'collaboration:ready': () => void;
  'collaboration:error': (data: { code: string }) => void;
  'document:snapshot': (data: unknown) => void;
  'document:deleted': (data: { documentId: string }) => void;
  'presence:updated': (data: unknown) => void;
  'cursor:updated': (data: unknown) => void;
  'operation:applied': (data: unknown) => void;
  'interaction:previewed': (data: unknown) => void;
  'interaction:ended': (data: unknown) => void;
}

type CollaborationSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  ClientToServerEvents,
  CollaborationSocketData
>;

interface PresenceRecord {
  socketId: string;
  user: { id: string; name: string };
  color: string;
}

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly presence = new Map<string, Map<string, PresenceRecord>>();

  constructor(
    private readonly auth: AuthService,
    private readonly collaboration: CollaborationService,
    private readonly broadcaster: CollaborationBroadcaster,
  ) {}

  afterInit(server: Server): void {
    this.broadcaster.attach(server);
  }

  async handleConnection(client: CollaborationSocket): Promise<void> {
    const token = readSessionToken({
      headers: { cookie: client.handshake.headers.cookie },
    } as Parameters<typeof readSessionToken>[0]);
    const principal = token ? await this.auth.authenticate(token) : null;
    if (!principal) {
      client.emit('collaboration:error', { code: 'UNAUTHORIZED' });
      client.disconnect(true);
      return;
    }
    client.data.principal = principal;
    client.data.sessionToken = token;
    client.emit('collaboration:ready');
  }

  handleDisconnect(client: CollaborationSocket): void {
    this.leaveCurrentDocument(client);
  }

  @SubscribeMessage('document:join')
  async join(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() body: { documentId?: string; afterSequence?: number },
  ) {
    const principal = await this.requireFreshPrincipal(client);
    const documentId = readDocumentId(body?.documentId);
    this.leaveCurrentDocument(client);
    const snapshot = await this.collaboration.getSnapshot(
      principal.user.id,
      documentId,
      Number.isInteger(body?.afterSequence) ? body.afterSequence : 0,
    );
    await client.join(documentRoom(documentId));
    client.data.documentId = documentId;
    client.data.workspaceId = snapshot.workspaceId;
    client.data.canEdit = snapshot.role !== 'VIEWER';
    const documentPresence =
      this.presence.get(documentId) ?? new Map<string, PresenceRecord>();
    documentPresence.set(client.id, {
      socketId: client.id,
      user: { id: principal.user.id, name: principal.user.name },
      color: colorForUser(principal.user.id),
    });
    this.presence.set(documentId, documentPresence);
    this.broadcastPresence(documentId);
    return snapshot;
  }

  @SubscribeMessage('document:leave')
  leave(@ConnectedSocket() client: CollaborationSocket): void {
    this.leaveCurrentDocument(client);
  }

  @SubscribeMessage('cursor:update')
  async cursor(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() body: CollaborationCursor,
  ): Promise<void> {
    const principal = await this.requireFreshPrincipal(client);
    const documentId = client.data.documentId;
    if (!documentId || !isCursor(body)) return;
    client.to(documentRoom(documentId)).emit('cursor:updated', {
      documentId,
      user: { id: principal.user.id, name: principal.user.name },
      color: colorForUser(principal.user.id),
      cursor: body,
      at: new Date().toISOString(),
    });
  }

  @SubscribeMessage('operation:submit')
  async operation(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody()
    body: CollaborationOperationInput & { documentId?: string },
  ) {
    const principal = await this.requireFreshPrincipal(client);
    const documentId = readDocumentId(body?.documentId);
    if (client.data.documentId !== documentId) {
      throw new WsException('Join the document before submitting operations.');
    }
    const operation = await this.collaboration.applyOperation(
      principal.user.id,
      documentId,
      body,
    );
    this.server
      .to(documentRoom(documentId))
      .emit('operation:applied', operation);
    return operation;
  }

  @SubscribeMessage('interaction:preview')
  async preview(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody()
    body: { elementId?: string; preview?: Record<string, unknown> },
  ): Promise<void> {
    const principal = await this.requireFreshPrincipal(client);
    const documentId = client.data.documentId;
    if (!documentId || !client.data.canEdit) return;
    const elementId = readElementId(body?.elementId);
    const preview = readTransformPreview(body?.preview);
    client.to(documentRoom(documentId)).emit('interaction:previewed', {
      documentId,
      user: { id: principal.user.id, name: principal.user.name },
      color: colorForUser(principal.user.id),
      elementId,
      preview,
    });
  }

  @SubscribeMessage('interaction:end')
  endPreview(
    @ConnectedSocket() client: CollaborationSocket,
    @MessageBody() body: { elementId?: string },
  ): void {
    const documentId = client.data.documentId;
    if (!documentId || !client.data.canEdit) return;
    client.to(documentRoom(documentId)).emit('interaction:ended', {
      documentId,
      elementId: readElementId(body?.elementId),
    });
  }

  private leaveCurrentDocument(client: CollaborationSocket): void {
    const documentId = client.data.documentId;
    if (!documentId) return;
    void client.leave(documentRoom(documentId));
    const documentPresence = this.presence.get(documentId);
    documentPresence?.delete(client.id);
    if (documentPresence?.size === 0) this.presence.delete(documentId);
    client.data.documentId = undefined;
    client.data.workspaceId = undefined;
    client.data.canEdit = undefined;
    this.broadcastPresence(documentId);
  }

  private broadcastPresence(documentId: string): void {
    this.server.to(documentRoom(documentId)).emit('presence:updated', {
      documentId,
      participants: [...(this.presence.get(documentId)?.values() ?? [])],
    });
  }

  private async requireFreshPrincipal(
    client: CollaborationSocket,
  ): Promise<AuthPrincipal> {
    const token = client.data.sessionToken;
    const principal = token ? await this.auth.authenticate(token) : null;
    if (!principal) {
      client.emit('collaboration:error', { code: 'UNAUTHORIZED' });
      client.disconnect(true);
      throw new WsException('Authentication is required.');
    }
    client.data.principal = principal;
    return principal;
  }
}

function readElementId(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new WsException('A valid element id is required.');
  }
  return value;
}

function readTransformPreview(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WsException('A valid interaction preview is required.');
  }
  const preview: Record<string, number> = {};
  for (const key of ['x', 'y', 'width', 'height', 'rotation']) {
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      preview[key] = candidate;
    }
  }
  if (Object.keys(preview).length === 0) {
    throw new WsException('Interaction preview has no transform fields.');
  }
  return preview;
}

function readDocumentId(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new WsException('A valid document id is required.');
  }
  return value;
}

function isCursor(value: unknown): value is CollaborationCursor {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pageId' in value &&
    typeof value.pageId === 'string' &&
    'x' in value &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    value.x >= 0 &&
    value.x <= 100 &&
    'y' in value &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    value.y >= 0 &&
    value.y <= 100
  );
}

function colorForUser(userId: string): string {
  const colors = [
    '#526ed4',
    '#c45776',
    '#2f9474',
    '#9b6ac7',
    '#d17a32',
    '#2f84a8',
  ];
  const hash = [...userId].reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  return colors[hash % colors.length];
}
