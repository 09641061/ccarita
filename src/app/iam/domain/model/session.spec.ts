import { Session } from './session';
import { SessionUser } from './session-user';

const user = new SessionUser('u-1', 'luis@donlucho.pe', null);

describe('Session', () => {
  const session = new Session('s-1', user, 'access', new Date('2026-10-23T15:15:00Z'), 'refresh');

  it('keeps the access token until shortly before it expires (I5)', () => {
    expect(session.accessTokenExpired(new Date('2026-10-23T15:14:00Z'))).toBe(false);
    expect(session.accessTokenExpired(new Date('2026-10-23T15:14:31Z'))).toBe(true);
    expect(session.accessTokenExpired(new Date('2026-10-23T15:16:00Z'))).toBe(true);
  });
});

describe('SessionUser', () => {
  it('shows the email until the user has a name (I1)', () => {
    expect(user.displayName).toBe('luis@donlucho.pe');
    expect(new SessionUser('u-1', 'luis@donlucho.pe', 'Luis Ramírez').displayName).toBe(
      'Luis Ramírez',
    );
    expect(new SessionUser('u-1', 'luis@donlucho.pe', '  ').displayName).toBe('luis@donlucho.pe');
  });
});
