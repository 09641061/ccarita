import type {
  SessionTokens as SessionTokensResource,
  User as UserResource,
} from '../../shared/infrastructure/api/pibble.schema';
import { required } from '../../shared/infrastructure/api/required';
import { Session } from '../domain/model/session';
import { SessionUser } from '../domain/model/session-user';

export function toSession(resource: SessionTokensResource): Session {
  return new Session(
    required(resource.sessionId, 'SessionTokens.sessionId'),
    toSessionUser(required(resource.user, 'SessionTokens.user')),
    required(resource.accessToken, 'SessionTokens.accessToken'),
    new Date(required(resource.accessTokenExpiresAt, 'SessionTokens.accessTokenExpiresAt')),
    required(resource.refreshToken, 'SessionTokens.refreshToken'),
  );
}

export function toSessionUser(resource: UserResource): SessionUser {
  return new SessionUser(
    required(resource.id, 'User.id'),
    required(resource.email, 'User.email'),
    resource.name ?? null,
  );
}
