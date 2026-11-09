/**
 * Próximos eventos do calendário (F4-T1) formatados para a barra global e para a seção
 * "Próximos eventos" do celular. Recalcula a cada minuto.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { GameEvent } from '@pokeidle-hub/shared/domain';
import { localDay, nextEvents } from '@pokeidle-hub/shared/domain';
import type { UpcomingEventView } from '../shared/upcoming-event';

const TIME_ZONE = 'America/Sao_Paulo';
const weekdayDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const time = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
});

/**
 * Formata um evento relativo a `now` ("Inscrição fecha hoje, 16:00", "Qua 11/11 · 20:00").
 *
 * @param event Evento.
 * @param now Agora.
 * @param urgent Se é o evento mais próximo (destaque em laranja).
 * @returns Visão para exibição.
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function toEventView(event: GameEvent, now: Date, urgent: boolean): UpcomingEventView {
  const at = new Date(event.at);
  const day = localDay(at);
  const today = localDay(now);
  const tomorrow = localDay(new Date(now.getTime() + 86_400_000));
  let when: string;
  if (event.allDay) {
    when = day === today ? 'hoje é o último dia' : `até ${dayMonth.format(at)}`;
  } else if (day === today) {
    when = `hoje, ${time.format(at)}`;
  } else if (day === tomorrow) {
    when = `amanhã, ${time.format(at)}`;
  } else {
    const label = weekdayDate.format(at).replace('.', '').replace(',', '');
    when = `${label.charAt(0).toUpperCase()}${label.slice(1)} · ${time.format(at)}`;
  }
  return {
    id: event.id,
    label: event.title,
    detail: `${event.action} ${event.allDay ? '' : '· '}${when}`.replace(' · hoje', ' hoje').trim(),
    urgent,
  };
}

/**
 * Serviço dos próximos eventos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
@Injectable({ providedIn: 'root' })
export class UpcomingEvents {
  readonly list = signal<UpcomingEventView[]>([]);

  constructor() {
    const refresh = () => {
      const now = new Date();
      this.list.set(nextEvents(now, 5).map((e, i) => toEventView(e, now, i === 0)));
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
