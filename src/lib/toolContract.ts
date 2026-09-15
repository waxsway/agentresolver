type JsonSchema = Record<string, unknown>;

export type ToolContractReport = {
  verdict: "compatible" | "adaptable" | "incompatible";
  directMatches: string[];
  normalizedMappings: Array<{ from: string; to: string }>;
  missingRequired: string[];
  typeConflicts: Array<{ field: string; producerType: string | null; consumerType: string | null }>;
  notes: string[];
};

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function types(schema: unknown): string[] {
  const r = rec(schema); if (!r) return [];
  const t = r.type;
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  if (Array.isArray(r.enum)) return [...new Set(r.enum.map(v => v === null ? "null" : typeof v))];
  return [];
}
function norm(name: string) { return name.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function compatibleTypes(a: unknown, b: unknown) {
  const at = types(a), bt = types(b);
  if (!at.length || !bt.length) return true;
  if (at.some(t => bt.includes(t))) return true;
  return at.includes("integer") && bt.includes("number");
}

export function evaluateToolContract(producerOutputSchema: JsonSchema, consumerInputSchema: JsonSchema): ToolContractReport {
  const pp = rec(producerOutputSchema.properties) || {};
  const cp = rec(consumerInputSchema.properties) || {};
  const required = Array.isArray(consumerInputSchema.required) ? consumerInputSchema.required.filter((x): x is string => typeof x === "string") : [];
  const directMatches: string[] = [];
  const normalizedMappings: Array<{ from: string; to: string }> = [];
  const missingRequired: string[] = [];
  const typeConflicts: Array<{ field: string; producerType: string | null; consumerType: string | null }> = [];

  for (const field of required) {
    if (field in pp) {
      if (compatibleTypes(pp[field], cp[field])) directMatches.push(field);
      else typeConflicts.push({ field, producerType: types(pp[field])[0] || null, consumerType: types(cp[field])[0] || null });
      continue;
    }
    const candidate = Object.keys(pp).find(name => norm(name) === norm(field));
    if (candidate && compatibleTypes(pp[candidate], cp[field])) normalizedMappings.push({ from: candidate, to: field });
    else missingRequired.push(field);
  }

  const verdict: ToolContractReport["verdict"] = typeConflicts.length || missingRequired.length
    ? "incompatible"
    : normalizedMappings.length
      ? "adaptable"
      : "compatible";
  const notes = [
    "Deterministic schema check only; semantic meaning is not inferred from field names.",
    ...(normalizedMappings.length ? ["Adaptable means only normalized-name mappings are required; callers should still validate runtime values."] : [])
  ];
  return { verdict, directMatches, normalizedMappings, missingRequired, typeConflicts, notes };
}
