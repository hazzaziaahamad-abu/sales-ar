/**
 * permissions.ts couples to Supabase, so we mock the admin client and the
 * server-client factory to exercise the pure authorization + caching logic.
 */

// ─── Mocks ───
const singleMock = jest.fn();
const eqSelectMock = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: (...args: unknown[]) => eqSelectMock(...args),
      })),
    })),
  },
}));

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn(),
}));

import {
  isSuperAdmin,
  getUserPermissions,
  hasPermission,
  invalidateUserCache,
} from "@/lib/permissions";

// Helpers to shape the chained supabase responses.
function mockSuperAdmin(value: boolean | null) {
  eqSelectMock.mockReturnValueOnce({
    single: () => Promise.resolve({ data: value === null ? null : { is_super_admin: value } }),
  });
}

function mockPermissions(rows: { permission_key: string; granted: boolean }[] | null) {
  eqSelectMock.mockReturnValueOnce(Promise.resolve({ data: rows }));
}

describe("isSuperAdmin", () => {
  beforeEach(() => {
    eqSelectMock.mockReset();
    singleMock.mockReset();
  });

  it("returns true when the profile flag is set", async () => {
    mockSuperAdmin(true);
    await expect(isSuperAdmin("u1")).resolves.toBe(true);
  });

  it("returns false when the flag is false or missing", async () => {
    mockSuperAdmin(false);
    await expect(isSuperAdmin("u1")).resolves.toBe(false);

    mockSuperAdmin(null);
    await expect(isSuperAdmin("u2")).resolves.toBe(false);
  });
});

describe("getUserPermissions", () => {
  beforeEach(() => {
    eqSelectMock.mockReset();
    invalidateUserCache("cacheUser");
  });

  it("maps permission rows into a key->granted record", async () => {
    mockPermissions([
      { permission_key: "sales.view", granted: true },
      { permission_key: "sales.edit", granted: false },
    ]);
    const perms = await getUserPermissions("cacheUser");
    expect(perms).toEqual({ "sales.view": true, "sales.edit": false });
  });

  it("caches results so a second call does not hit the database again", async () => {
    mockPermissions([{ permission_key: "sales.view", granted: true }]);
    await getUserPermissions("cacheUser2");
    const callsAfterFirst = eqSelectMock.mock.calls.length;

    // No new mock queued — if it queried again it would throw/undefined.
    const perms = await getUserPermissions("cacheUser2");
    expect(perms).toEqual({ "sales.view": true });
    expect(eqSelectMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("re-queries after the cache is invalidated", async () => {
    mockPermissions([{ permission_key: "a", granted: true }]);
    await getUserPermissions("cacheUser3");
    const before = eqSelectMock.mock.calls.length;

    invalidateUserCache("cacheUser3");
    mockPermissions([{ permission_key: "a", granted: false }]);
    const perms = await getUserPermissions("cacheUser3");
    expect(perms).toEqual({ a: false });
    expect(eqSelectMock.mock.calls.length).toBe(before + 1);
  });

  it("returns an empty object when there are no rows", async () => {
    mockPermissions(null);
    const perms = await getUserPermissions("emptyUser");
    expect(perms).toEqual({});
  });
});

describe("hasPermission", () => {
  beforeEach(() => {
    eqSelectMock.mockReset();
    invalidateUserCache("permUser");
  });

  it("short-circuits to true for super admins without checking the key", async () => {
    mockSuperAdmin(true);
    await expect(hasPermission("admin", "anything.at.all")).resolves.toBe(true);
  });

  it("grants a specific permission for a non-admin", async () => {
    mockSuperAdmin(false);
    mockPermissions([{ permission_key: "sales.view", granted: true }]);
    await expect(hasPermission("permUser", "sales.view")).resolves.toBe(true);
  });

  it("denies a permission that is not granted", async () => {
    mockSuperAdmin(false);
    mockPermissions([{ permission_key: "sales.view", granted: false }]);
    await expect(hasPermission("permUser", "sales.view")).resolves.toBe(false);
  });

  it("denies a permission key that is absent entirely", async () => {
    mockSuperAdmin(false);
    mockPermissions([{ permission_key: "other", granted: true }]);
    await expect(hasPermission("permUser", "sales.view")).resolves.toBe(false);
  });
});
