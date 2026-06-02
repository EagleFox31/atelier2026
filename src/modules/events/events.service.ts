import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

export interface AppEvent {
  type: string;
  [key: string]: unknown;
}

interface ClientEntry {
  userId: string;
  garageId: string | null;
  roles: string[];
  subject: Subject<MessageEvent>;
}

@Injectable()
export class EventsService {
  private readonly clients = new Set<ClientEntry>();

  addClient(entry: ClientEntry): () => void {
    this.clients.add(entry);
    return () => this.clients.delete(entry);
  }

  emitToUsers(userIds: string[], event: AppEvent): void {
    const msg: MessageEvent = { data: event };
    for (const client of this.clients) {
      if (userIds.includes(client.userId)) {
        client.subject.next(msg);
      }
    }
  }

  emitToRoles(roleCodes: string[], event: AppEvent, garageId?: string | null): void {
    const msg: MessageEvent = { data: event };
    for (const client of this.clients) {
      if (garageId && client.garageId && client.garageId !== garageId) continue;
      if (client.roles.some((r) => roleCodes.includes(r))) {
        client.subject.next(msg);
      }
    }
  }
}
