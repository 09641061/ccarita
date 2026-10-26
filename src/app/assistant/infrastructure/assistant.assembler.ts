import type {
  AssistantSettings as AssistantSettingsResource,
  AssistantSettingsRequest,
  AssistantUsage as AssistantUsageResource,
  UsageTotals as UsageTotalsResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { LocalDate } from '../../shared/domain/model/local-date';
import { required } from '../../shared/infrastructure/api/required';
import { AssistantSettings, ConfigureAssistant } from '../domain/model/assistant-settings';
import { AssistantUsage, UsageTotals } from '../domain/model/assistant-usage';
import { UsagePeriod } from '../../shared/domain/model/usage-period';

export function toAssistantSettings(resource: AssistantSettingsResource): AssistantSettings {
  return new AssistantSettings(
    required(resource.establishmentId, 'AssistantSettings.establishmentId'),
    required(resource.enabled, 'AssistantSettings.enabled'),
    resource.businessInfo ?? '',
  );
}

export function toAssistantSettingsRequest(command: ConfigureAssistant): AssistantSettingsRequest {
  return { enabled: command.enabled, businessInfo: command.businessInfo };
}

export function toUsageTotals(resource: UsageTotalsResource | undefined): UsageTotals {
  return {
    turns: resource?.turns ?? 0,
    inputTokens: resource?.inputTokens ?? 0,
    cachedTokens: resource?.cachedTokens ?? 0,
    outputTokens: resource?.outputTokens ?? 0,
    toolCalls: resource?.toolCalls ?? 0,
  };
}

export function toAssistantUsage(resource: AssistantUsageResource): AssistantUsage {
  return new AssistantUsage(
    UsagePeriod.of(
      LocalDate.parse(required(resource.from, 'AssistantUsage.from')),
      LocalDate.parse(required(resource.to, 'AssistantUsage.to')),
    ),
    required(resource.timeZone, 'AssistantUsage.timeZone'),
    toUsageTotals(resource.totals),
    (resource.days ?? []).map((day) => ({
      date: LocalDate.parse(required(day.date, 'DailyUsage.date')),
      totals: toUsageTotals(day.totals),
    })),
  );
}
