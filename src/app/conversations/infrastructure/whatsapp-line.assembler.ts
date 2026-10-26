import type {
  ConnectWhatsappLineRequest,
  WhatsappLine as WhatsappLineResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { ConnectLine, TemplateStatus, WhatsappLine } from '../domain/model/whatsapp-line';

export function toWhatsappLine(resource: WhatsappLineResource): WhatsappLine {
  return new WhatsappLine(
    required(resource.id, 'WhatsappLine.id'),
    required(resource.establishmentId, 'WhatsappLine.establishmentId'),
    required(resource.displayPhone, 'WhatsappLine.displayPhone'),
    (resource.mode as WhatsappLine['mode'] | undefined) ?? 'coexistence',
    required(resource.status, 'WhatsappLine.status') === 'connected',
    (resource.templates ?? {}) as Record<string, TemplateStatus>,
  );
}

export function toConnectWhatsappLineRequest(command: ConnectLine): ConnectWhatsappLineRequest {
  return {
    code: command.code,
    wabaId: command.wabaId.trim(),
    phoneNumberId: command.phoneNumberId.trim(),
    mode: command.mode,
    ...(command.mode === 'cloud_api' && command.pin ? { pin: command.pin } : {}),
  };
}
