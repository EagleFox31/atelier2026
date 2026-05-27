import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

export interface AppEvent {
  type: string;
  [key: string]: unknown;
}

interface ClientEntry {
  userId: string;
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

  emitToRoles(roleCodes: string[], event: AppEvent): void {
    const msg: MessageEvent = { data: event };
    for (const client of this.clients) {
      if (client.roles.some((r) => roleCodes.includes(r))) {
        client.subject.next(msg);
      }
    }
  }
}
