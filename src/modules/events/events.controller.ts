import { Controller, Get, Query, Req, Sse, UnauthorizedException } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import type { MessageEvent } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../decorators/auth.decorator';
import { EventsService } from './events.service';
import { JwtService } from '@nestjs/jwt';
import { JwtSecretsService } from '../auth/jwt-secrets.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

const HEARTBEAT_MS = 25_000;

@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly jwtService: JwtService,
    private readonly jwtSecrets: JwtSecretsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Sse()
  async stream(
    @Query('token') token: string,
    @Req() req: Request,
  ): Promise<Observable<MessageEvent>> {
    if (!token) throw new UnauthorizedException('Token manquant');

    let payload: { sub: string; version: number };
    try {
      payload = await this.jwtSecrets.verifyAsync(this.jwtService, token);
    } catch {
      throw new UnauthorizedException('Token invalide');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.version) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }

    const roles = user.roles.map((ur: any) => ur.role.code);
    const subject = new Subject<MessageEvent>();
    const disconnect$ = new Subject<void>();
    const remove = this.events.addClient({ userId: user.id, garageId: user.garageId, roles, subject });

    req.on('close', () => {
      disconnect$.next();
      disconnect$.complete();
      remove();
      subject.complete();
    });

    // Heartbeat every 25s to keep Fly.io proxy alive (75s idle timeout)
    const heartbeat$ = interval(HEARTBEAT_MS).pipe(
      takeUntil(disconnect$),
      map(() => ({ data: { type: 'ping' } }) as MessageEvent),
    );

    subject.next({ data: { type: 'connected', userId: user.id } });
    return merge(subject.asObservable(), heartbeat$);
  }
}
