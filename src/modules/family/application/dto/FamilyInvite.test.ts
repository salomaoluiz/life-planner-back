import { emailsMatch } from './FamilyInvite';

it('SHOULD match emails ignoring case and surrounding whitespace', () => {
  expect(emailsMatch(' Invitee@Example.COM ', 'invitee@example.com')).toBe(true);
});

it('SHOULD NOT match different emails', () => {
  expect(emailsMatch('a@example.com', 'b@example.com')).toBe(false);
});
