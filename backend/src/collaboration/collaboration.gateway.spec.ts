import type { AuthService } from '../auth/auth.service';
import type { CollaborationBroadcaster } from './collaboration-broadcaster.service';
import { CollaborationGateway } from './collaboration.gateway';
import type { CollaborationService } from './collaboration.service';

describe('CollaborationGateway', () => {
  it('only announces readiness after the socket session is authenticated', async () => {
    const principal = {
      sessionId: 'session-1',
      user: {
        id: 'user-1',
        name: 'Pessoa de Teste',
        email: 'pessoa@moctes.local',
      },
      workspaces: [],
    };
    const auth = {
      authenticate: jest.fn().mockResolvedValue(principal),
    };
    const client = {
      handshake: { headers: { cookie: 'moctes_session=session-token' } },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const gateway = new CollaborationGateway(
      auth as unknown as AuthService,
      {} as CollaborationService,
      {} as CollaborationBroadcaster,
    );

    await gateway.handleConnection(client as never);

    expect(auth.authenticate).toHaveBeenCalledWith('session-token');
    expect(client.data).toEqual({ principal, sessionToken: 'session-token' });
    expect(client.emit).toHaveBeenCalledWith('collaboration:ready');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects an unauthenticated socket without announcing readiness', async () => {
    const client = {
      handshake: { headers: {} },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    const gateway = new CollaborationGateway(
      { authenticate: jest.fn() } as unknown as AuthService,
      {} as CollaborationService,
      {} as CollaborationBroadcaster,
    );

    await gateway.handleConnection(client as never);

    expect(client.emit).toHaveBeenCalledWith('collaboration:error', {
      code: 'UNAUTHORIZED',
    });
    expect(client.emit).not.toHaveBeenCalledWith('collaboration:ready');
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('revalidates the session before joining a document', async () => {
    const principal = {
      sessionId: 'session-1',
      user: {
        id: 'user-1',
        name: 'Pessoa de Teste',
        email: 'pessoa@moctes.local',
      },
      workspaces: [],
    };
    const auth = { authenticate: jest.fn().mockResolvedValue(principal) };
    const collaboration = {
      getSnapshot: jest.fn().mockResolvedValue({
        workspaceId: 'workspace-1',
        role: 'EDITOR',
        documentId: 'document-1',
      }),
    };
    const roomEmitter = { emit: jest.fn() };
    const client = {
      id: 'socket-1',
      handshake: { headers: { cookie: 'moctes_session=session-token' } },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = new CollaborationGateway(
      auth as unknown as AuthService,
      collaboration as unknown as CollaborationService,
      {} as CollaborationBroadcaster,
    );
    gateway.server = { to: jest.fn().mockReturnValue(roomEmitter) } as never;

    await gateway.handleConnection(client as never);
    await gateway.join(client as never, {
      documentId: 'document-1',
      afterSequence: 0,
    });

    expect(auth.authenticate).toHaveBeenCalledTimes(2);
    expect(client.join).toHaveBeenCalledWith('document:document-1');
    expect(client.data).toMatchObject({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      canEdit: true,
    });
  });
});
