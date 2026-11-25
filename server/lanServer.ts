import os from 'node:os';
import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { BikeClassId, LanPlayerInfo, LanRoomState, RiderNetState } from '../src/game/types';

const VALID_CLASSES = new Set<BikeClassId>(['moto3', 'moto2', 'motogp']);

function parseBikeClass(val: unknown): BikeClassId {
  if (typeof val === 'string' && VALID_CLASSES.has(val as BikeClassId)) {
    return val as BikeClassId;
  }
  return 'motogp';
}

export interface LanAddressInfo {
  interfaceName: string;
  address: string;
  wsUrl: string;
  httpUrl: string;
}

export function getLanAddresses(port: number): LanAddressInfo[] {
  const nets = os.networkInterfaces();
  const results: LanAddressInfo[] = [];

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const net of addrs) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({
          interfaceName: name,
          address: net.address,
          httpUrl: `http://${net.address}:${port}`,
          wsUrl: `ws://${net.address}:${port}/ws`,
        });
      }
    }
  }

  return results;
}

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  roomCode: string | null;
}

interface InternalRoom {
  state: LanRoomState;
  telemetry: Map<string, RiderNetState>;
}

export function generateRoomCode(existing: Set<string>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = 'GP';
    for (let i = 0; i < 2; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!existing.has(code)) return code;
  }
  return `GP${Math.floor(10 + Math.random() * 89)}`;
}

export class LanRoomRegistry {
  public rooms = new Map<string, InternalRoom>();

  public createRoom(
    hostId: string,
    playerName: string,
    liveryId: string,
    bikeClass: BikeClassId = 'motogp',
  ): LanRoomState {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const hostPlayer: LanPlayerInfo = {
      id: hostId,
      name: playerName.trim().slice(0, 18) || 'Rider 1',
      liveryId,
      ready: true,
      isHost: true,
    };
    const state: LanRoomState = {
      code,
      hostId,
      status: 'lobby',
      totalLaps: 3,
      bikeClass: parseBikeClass(bikeClass),
      fillWithAi: true,
      players: [hostPlayer],
    };
    this.rooms.set(code, { state, telemetry: new Map() });
    return state;
  }

  public joinRoom(code: string, playerId: string, playerName: string, liveryId: string): LanRoomState | { error: string } {
    const normalized = code.trim().toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) return { error: `Room "${normalized}" not found on this LAN server.` };
    if (room.state.status === 'racing') return { error: 'Race is already in progress.' };
    if (room.state.players.length >= 6) return { error: 'Room is full (max 6 riders).' };

    const existing = room.state.players.find((p) => p.id === playerId);
    if (!existing) {
      room.state.players.push({
        id: playerId,
        name: playerName.trim().slice(0, 18) || `Rider ${room.state.players.length + 1}`,
        liveryId,
        ready: false,
        isHost: false,
      });
    }
    return room.state;
  }

  public leaveRoom(code: string, playerId: string): LanRoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    room.state.players = room.state.players.filter((p) => p.id !== playerId);
    room.telemetry.delete(playerId);

    if (room.state.players.length === 0) {
      this.rooms.delete(code);
      return null;
    }

    if (room.state.hostId === playerId) {
      room.state.hostId = room.state.players[0].id;
      room.state.players[0].isHost = true;
      room.state.players[0].ready = true;
    }
    return room.state;
  }

  public listOpenRooms(): Array<{ code: string; playerCount: number; status: string; hostName: string; bikeClass: BikeClassId }> {
    const list: Array<{ code: string; playerCount: number; status: string; hostName: string; bikeClass: BikeClassId }> = [];
    for (const room of this.rooms.values()) {
      const host = room.state.players.find((p) => p.id === room.state.hostId);
      list.push({
        code: room.state.code,
        playerCount: room.state.players.length,
        status: room.state.status,
        hostName: host?.name ?? 'Host',
        bikeClass: room.state.bikeClass,
      });
    }
    return list;
  }
}

export function attachLanWebSocketServer(httpServer: HttpServer): {
  wss: WebSocketServer;
  registry: LanRoomRegistry;
} {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const registry = new LanRoomRegistry();
  const clients = new Map<string, ConnectedClient>();
  let nextSeq = 1;

  const send = (ws: WebSocket, payload: unknown) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  const broadcastRoom = (code: string, payload: unknown, excludeId?: string) => {
    for (const client of clients.values()) {
      if (client.roomCode === code && client.id !== excludeId) {
        send(client.ws, payload);
      }
    }
  };

  wss.on('connection', (ws) => {
    const clientId = `r-${Date.now().toString(36)}-${nextSeq++}`;
    const client: ConnectedClient = { id: clientId, ws, roomCode: null };
    clients.set(clientId, client);

    send(ws, {
      type: 'welcome',
      clientId,
      rooms: registry.listOpenRooms(),
    });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room:list') {
        send(ws, { type: 'room:list', rooms: registry.listOpenRooms() });
        return;
      }

      if (type === 'room:create') {
        if (client.roomCode) {
          const prev = registry.leaveRoom(client.roomCode, client.id);
          if (prev) broadcastRoom(prev.code, { type: 'room:state', room: prev });
        }
        const room = registry.createRoom(
          client.id,
          String(msg.name || 'Rider 1'),
          String(msg.liveryId || 'ducati'),
          parseBikeClass(msg.bikeClass),
        );
        client.roomCode = room.code;
        send(ws, { type: 'room:state', room });
        return;
      }

      if (type === 'room:join') {
        const code = String(msg.code || '').toUpperCase();
        if (client.roomCode && client.roomCode !== code) {
          const prev = registry.leaveRoom(client.roomCode, client.id);
          if (prev) broadcastRoom(prev.code, { type: 'room:state', room: prev });
        }
        const res = registry.joinRoom(
          code,
          client.id,
          String(msg.name || 'Rider'),
          String(msg.liveryId || 'yamaha'),
        );
        if ('error' in res) {
          send(ws, { type: 'room:error', error: res.error });
          return;
        }
        client.roomCode = res.code;
        broadcastRoom(res.code, { type: 'room:state', room: res });
        return;
      }

      if (type === 'room:leave') {
        if (client.roomCode) {
          const updated = registry.leaveRoom(client.roomCode, client.id);
          const oldCode = client.roomCode;
          client.roomCode = null;
          if (updated) {
            broadcastRoom(oldCode, { type: 'room:state', room: updated });
          }
        }
        send(ws, { type: 'room:left' });
        return;
      }

      if (type === 'room:update_player' && client.roomCode) {
        const room = registry.rooms.get(client.roomCode);
        if (!room) return;
        const player = room.state.players.find((p) => p.id === client.id);
        if (!player) return;
        if (typeof msg.name === 'string') player.name = msg.name.trim().slice(0, 18) || player.name;
        if (typeof msg.liveryId === 'string') player.liveryId = msg.liveryId;
        if (typeof msg.ready === 'boolean') player.ready = msg.ready;
        broadcastRoom(room.state.code, { type: 'room:state', room: room.state });
        return;
      }

      if (type === 'room:update_settings' && client.roomCode) {
        const room = registry.rooms.get(client.roomCode);
        if (!room || room.state.hostId !== client.id) return;
        if (typeof msg.totalLaps === 'number') {
          room.state.totalLaps = Math.max(1, Math.min(10, Math.round(msg.totalLaps)));
        }
        if (typeof msg.fillWithAi === 'boolean') {
          room.state.fillWithAi = msg.fillWithAi;
        }
        if (typeof msg.bikeClass === 'string' && VALID_CLASSES.has(msg.bikeClass as BikeClassId)) {
          room.state.bikeClass = msg.bikeClass as BikeClassId;
        }
        broadcastRoom(room.state.code, { type: 'room:state', room: room.state });
        return;
      }

      if (type === 'race:start' && client.roomCode) {
        const room = registry.rooms.get(client.roomCode);
        if (!room || room.state.hostId !== client.id) return;
        room.state.status = 'racing';
        room.telemetry.clear();
        broadcastRoom(room.state.code, {
          type: 'race:start',
          room: room.state,
          seed: Date.now(),
        });
        return;
      }

      if (type === 'race:telemetry' && client.roomCode) {
        const room = registry.rooms.get(client.roomCode);
        if (!room) return;
        const telemetry = msg.state as RiderNetState | undefined;
        if (!telemetry || typeof telemetry.x !== 'number' || typeof telemetry.z !== 'number') return;
        telemetry.id = client.id;
        room.telemetry.set(client.id, telemetry);
        broadcastRoom(
          room.state.code,
          {
            type: 'race:snapshot',
            states: Array.from(room.telemetry.values()),
          },
          client.id,
        );
        return;
      }

      if (type === 'race:return_lobby' && client.roomCode) {
        const room = registry.rooms.get(client.roomCode);
        if (!room || room.state.hostId !== client.id) return;
        room.state.status = 'lobby';
        room.telemetry.clear();
        broadcastRoom(room.state.code, { type: 'room:state', room: room.state });
      }
    });

    ws.on('close', () => {
      if (client.roomCode) {
        const updated = registry.leaveRoom(client.roomCode, client.id);
        if (updated) {
          broadcastRoom(updated.code, { type: 'room:state', room: updated });
        }
      }
      clients.delete(clientId);
    });
  });

  return { wss, registry };
}
