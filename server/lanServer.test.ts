import test from 'node:test';
import assert from 'node:assert/strict';
import { LanRoomRegistry } from './lanServer';

test('LanRoomRegistry creates rooms with bikeClass and circuitId, validates join codes, and migrates host on disconnect', () => {
  const reg = new LanRoomRegistry();
  const room = reg.createRoom('host-1', 'Marc', 'ducati', 'moto2', 'mugello');
  assert.ok(room.code.startsWith('GP'));
  assert.equal(room.bikeClass, 'moto2');
  assert.equal(room.circuitId, 'mugello');
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].isHost, true);

  const fallbackRoom = reg.createRoom('host-2', 'Alex', 'ducati', 'motogp', 'unknown' as never);
  assert.equal(fallbackRoom.circuitId, 'lusail');
  reg.leaveRoom(fallbackRoom.code, 'host-2');

  const missing = reg.joinRoom('NOPE', 'p2', 'Fabio', 'yamaha');
  assert.ok('error' in missing);

  const joined = reg.joinRoom(room.code, 'p2', 'Fabio', 'yamaha');
  assert.ok(!('error' in joined));
  if (!('error' in joined)) {
    assert.equal(joined.players.length, 2);
    assert.equal(joined.players[1].isHost, false);
  }

  // Host leaves -> p2 becomes host
  const afterLeave = reg.leaveRoom(room.code, 'host-1');
  assert.ok(afterLeave !== null);
  assert.equal(afterLeave.players.length, 1);
  assert.equal(afterLeave.hostId, 'p2');
  assert.equal(afterLeave.players[0].isHost, true);

  // Last player leaves -> room deleted
  const empty = reg.leaveRoom(room.code, 'p2');
  assert.equal(empty, null);
  assert.equal(reg.listOpenRooms().length, 0);
});
