/** O4: the plans pibble sells. */
export type PlanName = 'standard' | 'max';

/** The Takodu team works from Lima; plan dates, which are instants, are shown and typed in its zone. */
export const OPERATOR_TIME_ZONE = 'America/Lima';

const DAY_MS = 24 * 60 * 60 * 1000;

/** O4: active establishments a plan allows; `null` for no limit. */
export function establishmentLimit(plan: PlanName): number | null {
  return plan === 'standard' ? 1 : null;
}

/** Lower case without accents, so "Peluquería" matches "peluqueria". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** An organization as the Takodu team follows its plan (O4, O5). */
export class OrganizationAccount {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly plan: PlanName,
    /** O5: the end of the paid period; `null` for an organization that never had one. */
    readonly planActiveUntil: Date | null,
    /** As pibble judged it when it answered. */
    readonly planActive: boolean,
    readonly ownerEmail: string,
    readonly activeEstablishments: number,
  ) {}

  get establishmentLimit(): number | null {
    return establishmentLimit(this.plan);
  }

  /** O4: more establishments are open than the plan allows, as after a downgrade; they stay open. */
  get overLimit(): boolean {
    const limit = this.establishmentLimit;
    return limit !== null && this.activeEstablishments > limit;
  }

  /** The search box matches the business name or the owner's email, ignoring case and accents. */
  matches(query: string): boolean {
    const wanted = normalize(query);
    return (
      !wanted ||
      normalize(this.name).includes(wanted) ||
      normalize(this.ownerEmail).includes(wanted)
    );
  }

  /** O5: extending counts from the current end while the plan is active, and from now once it has ended. */
  endAfterExtending(days: number, now: Date): Date {
    const end = this.planActiveUntil;
    const from = end && end.getTime() > now.getTime() ? end : now;
    return new Date(from.getTime() + days * DAY_MS);
  }
}
