// WorldGraph — Defines the complete room layout, connections, and biome regions

import type { RoomData, RoomId } from "./Room";

export interface WorldRegion {
  id: string;
  name: string;
  biomeId: string;
  roomIds: RoomId[];
}

export interface WorldGraphData {
  regions: WorldRegion[];
  startingRoomId: RoomId;
  hubRoomId: RoomId;
}

export class WorldGraph {
  data: WorldGraphData;
  rooms: Map<RoomId, RoomData>;

  constructor(data: WorldGraphData, rooms: Map<RoomId, RoomData>) {
    this.data = data;
    this.rooms = rooms;
  }

  getRegion(roomId: RoomId): WorldRegion | null {
    for (const region of this.data.regions) {
      if (region.roomIds.includes(roomId)) return region;
    }
    return null;
  }

  getRoomsInRegion(regionId: string): RoomData[] {
    const region = this.data.regions.find((r) => r.id === regionId);
    if (!region) return [];
    return region.roomIds
      .map((id) => this.rooms.get(id))
      .filter((r): r is RoomData => r !== undefined);
  }

  getAdjacentRooms(roomId: RoomId): RoomId[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return room.exits.map((e) => e.targetRoomId);
  }

  getBiomeId(roomId: RoomId): string {
    const room = this.rooms.get(roomId);
    if (room) return room.biomeId;
    const region = this.getRegion(roomId);
    return region?.biomeId ?? "default";
  }

  isHub(roomId: RoomId): boolean {
    return roomId === this.data.hubRoomId;
  }

  getAllRoomIds(): RoomId[] {
    return Array.from(this.rooms.keys());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
