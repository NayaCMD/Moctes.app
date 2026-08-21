import { CollaborationBroadcaster } from './collaboration-broadcaster.service';

describe('CollaborationBroadcaster', () => {
  it('disconnects sockets whose workspace membership changed', async () => {
    const matching = socket('workspace-1', 'user-1');
    const otherUser = socket('workspace-1', 'user-2');
    const otherWorkspace = socket('workspace-2', 'user-1');
    const server = {
      fetchSockets: jest
        .fn()
        .mockResolvedValue([matching, otherUser, otherWorkspace]),
    };
    const broadcaster = new CollaborationBroadcaster();
    broadcaster.attach(server as never);

    await broadcaster.revokeWorkspaceAccess('workspace-1', 'user-1');

    expect(matching.emit).toHaveBeenCalledWith('collaboration:error', {
      code: 'ACCESS_REVOKED',
    });
    expect(matching.disconnect).toHaveBeenCalledWith(true);
    expect(otherUser.disconnect).not.toHaveBeenCalled();
    expect(otherWorkspace.disconnect).not.toHaveBeenCalled();
  });
});

function socket(workspaceId: string, userId: string) {
  return {
    data: { workspaceId, principal: { user: { id: userId } } },
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}
