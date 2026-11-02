import { ApiClient } from './client';

export interface FamilyPlan {
  invites: string[];
  name: string;
}

export function buildFamilyPlan(count: number, invitesPerFamily: number): FamilyPlan[] {
  return Array.from({ length: count }, (_, i) => ({
    invites: Array.from(
      { length: invitesPerFamily },
      (_, k) => `perf-invite-${i + 1}-${k + 1}@example.com`,
    ),
    name: `Perf family ${i + 1}`,
  }));
}

export async function seedFamilies(
  client: ApiClient,
  cfg: { families: number; invitesPerFamily: number },
): Promise<{ created: number; familyIds: string[] }> {
  const existing = await client.get<{ id: string; name: string }[]>('/api/v1/families');
  const idByName = new Map(existing.map((family) => [family.name, family.id]));
  let created = 0;
  const familyIds: string[] = [];

  for (const plan of buildFamilyPlan(cfg.families, cfg.invitesPerFamily)) {
    let id = idByName.get(plan.name);
    if (!id) {
      id = (await client.post<{ id: string }>('/api/v1/families', { name: plan.name })).id;
      created += 1;
    }
    familyIds.push(id);

    const members = await client.get<{ email: string }[]>(`/api/v1/families/${id}/members`);
    const known = new Set(members.map((member) => member.email));
    for (const email of plan.invites.filter((invite) => !known.has(invite))) {
      await client.post(`/api/v1/families/${id}/members`, { email });
      created += 1;
    }
  }

  return { created, familyIds };
}
