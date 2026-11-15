import Peer, { type DataConnection } from 'peerjs';
import { generateRoomCode, sanitizeRoomCode } from '../game/rules';
import type {
  NetPacket,
  NetworkStatus,
  PeerPlayerInfo,
  PlayableMode,
} from '../game/types';

const PEER_PREFIX = 'legion-ww2-arena-';

export interface PeerManagerCallbacks {
  onStatusChange: (status: NetworkStatus, message?: string) => void;
  onRosterChange: (players: PeerPlayerInfo[], mode: PlayableMode) => void;
  onStartMatch: (mode: PlayableMode) => void;
  onPacket: (packet: NetPacket, fromPeerId: string) => void;
}

export class PeerMultiplayerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private roster: PeerPlayerInfo[] = [];
  private roomCode = '';
  private isHost = false;
  private callsign = 'Operative';
  private mode: PlayableMode = 'tdm';
  private callbacks: PeerManagerCallbacks;

  constructor(callbacks: PeerManagerCallbacks) {
    this.callbacks = callbacks;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getLocalPeerId(): string {
    return this.peer?.id ?? 'local';
  }

  public getRoster(): PeerPlayerInfo[] {
    return this.roster;
  }

  public setMode(mode: PlayableMode): void {
    this.mode = mode;
    if (this.isHost) {
      this.broadcastRoster();
    }
  }

  public hostRoom(callsign: string, mode: PlayableMode): string {
    this.disconnect();
    this.callsign = callsign.trim() || 'Commander';
    this.mode = mode;
    this.isHost = true;
    this.roomCode = generateRoomCode();
    const peerId = `${PEER_PREFIX}${this.roomCode}`;

    this.callbacks.onStatusChange('connecting', `Opening channel ${this.roomCode}...`);

    try {
      this.peer = new Peer(peerId, { debug: 0 });
    } catch (err) {
      this.callbacks.onStatusChange(
        'error',
        err instanceof Error ? err.message : 'Unable to initialize WebRTC'
      );
      return this.roomCode;
    }

    this.peer.on('open', (id) => {
      this.roster = [
        {
          peerId: id,
          callsign: this.callsign,
          team: 'allies',
          isHost: true,
          ready: true,
        },
      ];
      this.callbacks.onStatusChange('hosting', `Room ${this.roomCode} active`);
      this.callbacks.onRosterChange([...this.roster], this.mode);
    });

    this.peer.on('connection', (conn) => {
      this.wireConnection(conn);
    });

    this.peer.on('error', (err) => {
      this.callbacks.onStatusChange('error', err.message || 'PeerJS broker error');
    });

    return this.roomCode;
  }

  public joinRoom(rawCode: string, callsign: string): void {
    const code = sanitizeRoomCode(rawCode);
    if (code.length !== 4) {
      this.callbacks.onStatusChange('error', 'Enter a 4-character Room Code');
      return;
    }

    this.disconnect();
    this.callsign = callsign.trim() || 'Rifleman';
    this.isHost = false;
    this.roomCode = code;
    this.callbacks.onStatusChange('connecting', `Dialing room ${code}...`);

    try {
      this.peer = new Peer({ debug: 0 });
    } catch (err) {
      this.callbacks.onStatusChange(
        'error',
        err instanceof Error ? err.message : 'Unable to initialize WebRTC'
      );
      return;
    }

    this.peer.on('open', (myId) => {
      if (!this.peer) return;
      const conn = this.peer.connect(`${PEER_PREFIX}${code}`, { reliable: true });
      this.wireConnection(conn, () => {
        conn.send({
          type: 'hello',
          peerId: myId,
          callsign: this.callsign,
        } satisfies NetPacket);
        this.callbacks.onStatusChange('joined', `Connected to ${code}`);
      });
    });

    this.peer.on('error', (err) => {
      this.callbacks.onStatusChange(
        'error',
        err.message || `Could not reach room ${code}`
      );
    });
  }

  private wireConnection(conn: DataConnection, onOpen?: () => void): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      onOpen?.();
    });

    conn.on('data', (raw) => {
      const packet = raw as NetPacket;
      if (!packet || typeof packet !== 'object' || !('type' in packet)) return;

      if (packet.type === 'hello' && this.isHost) {
        const team = this.roster.length % 2 === 1 ? 'axis' : 'allies';
        const existing = this.roster.find((p) => p.peerId === packet.peerId);
        if (!existing) {
          this.roster.push({
            peerId: packet.peerId,
            callsign: packet.callsign,
            team,
            isHost: false,
            ready: true,
          });
        }
        this.broadcastRoster();
        return;
      }

      if (packet.type === 'roster') {
        this.roster = packet.players;
        this.mode = packet.mode;
        this.callbacks.onRosterChange([...this.roster], this.mode);
        return;
      }

      if (packet.type === 'start_match') {
        this.callbacks.onStartMatch(packet.mode);
        return;
      }

      // Host relays state/shot/hit packets to other clients
      if (this.isHost) {
        this.broadcastPacket(packet, conn.peer);
      }
      this.callbacks.onPacket(packet, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      if (this.isHost) {
        this.roster = this.roster.filter((p) => p.peerId !== conn.peer);
        this.broadcastRoster();
      }
    });
  }

  private broadcastRoster(): void {
    const pkt: NetPacket = {
      type: 'roster',
      mode: this.mode,
      players: this.roster,
    };
    this.broadcastPacket(pkt);
    this.callbacks.onRosterChange([...this.roster], this.mode);
  }

  public broadcastStartMatch(mode: PlayableMode): void {
    this.mode = mode;
    this.broadcastPacket({ type: 'start_match', mode });
  }

  public broadcastPacket(packet: NetPacket, excludePeerId?: string): void {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        conn.send(packet);
      }
    });
  }

  public disconnect(): void {
    this.connections.forEach((c) => {
      try {
        c.close();
      } catch {
        // ignore
      }
    });
    this.connections.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
      this.peer = null;
    }
    this.roster = [];
    this.isHost = false;
    this.roomCode = '';
    this.callbacks.onStatusChange('offline');
    this.callbacks.onRosterChange([], this.mode);
  }
}
