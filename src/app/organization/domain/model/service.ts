import { Money } from '../../../shared/domain/model/money';

/** Something an establishment sells by appointment (O14). */
export class Service {
  constructor(
    readonly id: string,
    readonly establishmentId: string,
    readonly name: string,
    readonly durationMinutes: number,
    readonly price: Money,
    /** O14: a deactivated service takes no new appointments; booked ones keep their snapshot. */
    readonly active: boolean,
    /** O15: the members who perform it. */
    readonly performerIds: readonly string[],
    /** Sent to the customer when booked. */
    readonly instructions = '',
  ) {}
}
