import type { BikeClassId, LanRoomState, RiderNetState } from '../game/types';

export interface OpenRoomSummary {
  code: string;
  playerCount: number;
  status: string;
  hostName: string;
  bikeClass?: BikeClassId;
}

export interface LanClientCallbacks {
  onConnectionChange: (connected: boolean, clientId: string | null) => void;
  onRoomList: (rooms: OpenRoomSummary[]) => void;
  onRoomState: (room: LanRoomState | null) => void;
  onRoomError: (message: string) => void;
  onRaceStart: (room: LanRoomState) => void;
  onRaceSnapshot: (states: RiderNetState[]) => void;
}

const STORAGE_KEY = 'apexgp_lan_url';

export function getDefaultWsUrl(): string {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (saved && (saved.startsWith('ws://') || saved.startsWith('wss://'))) {
    return saved;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function saveLanWsUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, trimmed);
}

export class LanMultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: LanClientCallbacks;
  private wsUrl: string;
  private clientId: string | null = null;
  private reconnectTimer: number | null = null;
  private intentionallyClosed = false;

  constructor(callbacks: LanClientCallbacks, wsUrl?: string) {
    this.callbacks = callbacks;
    this.wsUrl = wsUrl || getDefaultWsUrl();
  }

  public updateCallbacks(callbacks: LanClientCallbacks): void {
    this.callbacks = callbacks;
  }

  public getWsUrl(): string {
    return this.wsUrl;
  }

  public getClientId(): string | null {
    return this.clientId;
  }

  public connect(customUrl?: string): void {
    if (customUrl) {
      this.wsUrl = customUrl.trim();
      saveLanWsUrl(this.wsUrl);
    }
    this.intentionallyClosed = false;
    this.cleanupSocket();

    try {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.callbacks.onConnectionChange(true, this.clientId);
      };

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const type = String(msg.type || '');
        if (type === 'welcome') {
          this.clientId = String(msg.clientId || '');
          this.callbacks.onConnectionChange(true, this.clientId);
          this.callbacks.onRoomList((msg.rooms as OpenRoomSummary[]) || []);
        } else if (type === 'room:list') {
          this.callbacks.onRoomList((msg.rooms as OpenRoomSummary[]) || []);
        } else if (type === 'room:state') {
          this.callbacks.onRoomState((msg.room as LanRoomState) || null);
        } else if (type === 'room:left') {
          this.callbacks.onRoomState(null);
        } else if (type === 'room:error') {
          this.callbacks.onRoomError(String(msg.error || 'LAN error'));
        } else if (type === 'race:start') {
          this.callbacks.onRaceStart(msg.room as LanRoomState);
        } else if (type === 'race:snapshot') {
          this.callbacks.onRaceSnapshot((msg.states as RiderNetState[]) || []);
        }
      };

      ws.onclose = () => {
        this.callbacks.onConnectionChange(false, this.clientId);
        if (!this.intentionallyClosed) {
          this.reconnectTimer = window.setTimeout(() => this.connect(), 2200);
        }
      };

      ws.onerror = () => {
        this.callbacks.onRoomError(`Unable to connect to ${this.wsUrl}`);
      };
    } catch {
      this.callbacks.onConnectionChange(false, null);
    }
  }

  public disconnect(): void {
    this.intentionallyClosed = true;
    this.cleanupSocket();
  }

  private cleanupSocket(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public refreshRooms(): void {
    this.send({ type: 'room:list' });
  }

  public createRoom(name: string, liveryId: string, bikeClass: BikeClassId = 'motogp'): void {
    this.send({ type: 'room:create', name, liveryId, bikeClass });
  }

  public joinRoom(code: string, name: string, liveryId: string): void {
    this.send({ type: 'room:join', code, name, liveryId });
  }

  public leaveRoom(): void {
    this.send({ type: 'room:leave' });
  }

  public updatePlayer(patch: { name?: string; liveryId?: string; ready?: boolean }): void {
    this.send({ type: 'room:update_player', ...patch });
  }

  public updateSettings(patch: { totalLaps?: number; fillWithAi?: boolean; bikeClass?: BikeClassId }): void {
    this.send({ type: 'room:update_settings', ...patch });
  }

  public startRace(): void {
    this.send({ type: 'race:start' });
  }

  public sendTelemetry(state: RiderNetState): void {
    this.send({ type: 'race:telemetry', state });
  }

  public returnToLobby(): void {
    this.send({ type: 'race:return_lobby' });
  }
}
