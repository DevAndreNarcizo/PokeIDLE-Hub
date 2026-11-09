/**
 * Evento do calendário exibido na barra global (preenchido pelo calendário da F4-T1).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

/**
 * Próximo evento já formatado para exibição.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export interface UpcomingEventView {
  id: string;
  label: string;
  detail: string;
  /** O mais urgente aparece em laranja (`--warn`). */
  urgent: boolean;
}
