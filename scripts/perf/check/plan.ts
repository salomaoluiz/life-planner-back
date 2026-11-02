interface PlanNode {
  'Index Name'?: string;
  'Node Type'?: string;
  Plans?: PlanNode[];
  'Relation Name'?: string;
}

function walk(node: PlanNode, visit: (node: PlanNode) => void): void {
  visit(node);
  node.Plans?.forEach((child) => walk(child, visit));
}

export function inspectPlan(
  plan: unknown,
  opts: { indexes: string[]; seqScanException?: string; table: string },
): string[] {
  const root = (Array.isArray(plan) ? plan[0] : plan) as { Plan?: PlanNode } | undefined;
  if (!root?.Plan) return ['plan has no Plan node'];
  const used = new Set<string>();
  let seqScan = false;
  walk(root.Plan, (node) => {
    if (node['Node Type'] === 'Seq Scan' && node['Relation Name'] === opts.table) seqScan = true;
    if (node['Index Name']) used.add(node['Index Name']);
  });

  const violations: string[] = [];
  if (seqScan && !opts.seqScanException) violations.push(`Seq Scan on ${opts.table}`);
  for (const index of opts.indexes) {
    if (!used.has(index)) violations.push(`index ${index} not used`);
  }

  return violations;
}
