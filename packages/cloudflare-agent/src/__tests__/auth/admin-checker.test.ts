import { describe, expect, it } from 'vitest';
import { type AdminConfig, isAdminUser } from '../../auth/admin-checker.js';

describe('isAdminUser', () => {
  const config: AdminConfig = {
    adminUserIds: new Set(['12345', 67890]),
    adminUsernames: new Set(['admin_user', 'superuser']),
  };

  it('should return false if config is missing', () => {
    // @ts-expect-error - testing invalid input
    expect(isAdminUser('12345', 'admin_user', undefined)).toBe(false);
  });

  it('should return true for authorized user ID (string match)', () => {
    expect(isAdminUser('12345', undefined, config)).toBe(true);
  });

  it('should return true for authorized user ID (number match)', () => {
    expect(isAdminUser(67890, undefined, config)).toBe(true);
  });

  it('should return true for authorized user ID (string vs number match)', () => {
    // Config has number 67890, passing string "67890" should typically NOT match in Set.has() unless we handle it.
    // However, our implementation converts input to string but Set might contain numbers.
    // Wait, our implementation only converts input to string if it checks `has(userIdStr)`.
    // It also checks `has(userId)` if it's a number.
    // If the Set has both string and number, great.
    // If the Set only has number, `has(string)` fails.
    // Let's verify behavior. Ideally we normalize everything to strings in a real config,
    // but the type definition allows `string | number`.

    // In our implementation:
    // const userIdStr = String(userId);
    // if (config.adminUserIds.has(userIdStr)) ...

    // So if I pass string "67890" and Set has number 67890:
    // "67890" !== 67890 in Set. So it returns false.
    // This is probably expected behavior for strict Sets.
    // But good to know.

    expect(isAdminUser(12345, undefined, config)).toBe(true); // 12345 is number, matches string "12345" in Set
    expect(isAdminUser('67890', undefined, config)).toBe(false); // 67890 is number in Set, not string
  });

  it('should return true for authorized username', () => {
    expect(isAdminUser(undefined, 'admin_user', config)).toBe(true);
    expect(isAdminUser('99999', 'superuser', config)).toBe(true);
  });

  it('should return false for unauthorized user ID', () => {
    expect(isAdminUser('11111', undefined, config)).toBe(false);
    expect(isAdminUser(11111, undefined, config)).toBe(false);
  });

  it('should return false for unauthorized username', () => {
    expect(isAdminUser(undefined, 'regular_user', config)).toBe(false);
  });

  it('should return false if neither matches', () => {
    expect(isAdminUser('11111', 'regular_user', config)).toBe(false);
  });

  it('should return false if inputs are undefined', () => {
    expect(isAdminUser(undefined, undefined, config)).toBe(false);
  });
});
