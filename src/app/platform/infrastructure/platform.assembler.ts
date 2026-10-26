import type {
  ChangePlan as ChangePlanRequest,
  OrganizationAccount as OrganizationAccountResource,
  OrganizationAssistantUsage as OrganizationAssistantUsageResource,
  PlanChange as PlanChangeResource,
  UsageTotals as UsageTotalsResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { LocalDate } from '../../shared/domain/model/local-date';
import { UsagePeriod } from '../../shared/domain/model/usage-period';
import { required } from '../../shared/infrastructure/api/required';
import { OrganizationAccount } from '../domain/model/organization-account';
import { OrganizationUsage, UsageTotals } from '../domain/model/organization-usage';
import { ChangePlan, PlanChange } from '../domain/model/plan-change';

const instant = (value: string | undefined | null) => (value ? new Date(value) : null);

export function toOrganizationAccount(resource: OrganizationAccountResource): OrganizationAccount {
  return new OrganizationAccount(
    required(resource.id, 'OrganizationAccount.id'),
    required(resource.name, 'OrganizationAccount.name'),
    required(resource.plan, 'OrganizationAccount.plan'),
    instant(resource.planActiveUntil),
    required(resource.planActive, 'OrganizationAccount.planActive'),
    resource.ownerEmail ?? '',
    resource.activeEstablishments ?? 0,
  );
}

export function toPlanChange(resource: PlanChangeResource): PlanChange {
  return new PlanChange(
    required(resource.id, 'PlanChange.id'),
    required(resource.fromPlan, 'PlanChange.fromPlan'),
    required(resource.toPlan, 'PlanChange.toPlan'),
    instant(resource.fromActiveUntil),
    instant(resource.toActiveUntil),
    resource.note ?? '',
    resource.changedByEmail ?? '',
    new Date(required(resource.changedAt, 'PlanChange.changedAt')),
  );
}

/** Only the fields the change sets: pibble refuses `activeUntil` and `extendDays` together. */
export function toChangePlanRequest(change: ChangePlan): ChangePlanRequest {
  const period = change.period;
  return {
    ...(change.plan ? { plan: change.plan } : {}),
    ...(period.kind === 'extend' ? { extendDays: period.days } : {}),
    ...(period.kind === 'until' ? { activeUntil: period.activeUntil.toISOString() } : {}),
    note: change.note.trim(),
  };
}

function toUsageTotals(resource: UsageTotalsResource | undefined): UsageTotals {
  return {
    turns: resource?.turns ?? 0,
    inputTokens: resource?.inputTokens ?? 0,
    cachedTokens: resource?.cachedTokens ?? 0,
    outputTokens: resource?.outputTokens ?? 0,
    toolCalls: resource?.toolCalls ?? 0,
  };
}

export function toOrganizationUsage(
  resource: OrganizationAssistantUsageResource,
): OrganizationUsage {
  return new OrganizationUsage(
    UsagePeriod.of(
      LocalDate.parse(required(resource.from, 'OrganizationAssistantUsage.from')),
      LocalDate.parse(required(resource.to, 'OrganizationAssistantUsage.to')),
    ),
    toUsageTotals(resource.totals),
    (resource.establishments ?? []).map((establishment) => ({
      establishmentId: required(establishment.establishmentId, 'AssistantUsage.establishmentId'),
      name: establishment.establishmentName ?? '',
      timeZone: required(establishment.timeZone, 'AssistantUsage.timeZone'),
      totals: toUsageTotals(establishment.totals),
      days: (establishment.days ?? []).map((day) => ({
        date: LocalDate.parse(required(day.date, 'DailyUsage.date')),
        totals: toUsageTotals(day.totals),
      })),
    })),
  );
}
