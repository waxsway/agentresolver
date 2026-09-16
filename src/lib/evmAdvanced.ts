import {
  decodeAbiParameters,
  encodeAbiParameters,
  hashTypedData,
  isHex,
  parseAbiParameters,
  type AbiParameter,
  type Hex
} from "viem";
import { labelhash, namehash, normalize } from "viem/ens";

const MAX_JSON_BYTES = 128 * 1024;

function assertJsonBounded(value: unknown, label: string) {
  let json: string;
  try { json = JSON.stringify(value) ?? "null"; }
  catch { throw new Error(`${label} must be JSON-serializable.`); }
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_JSON_BYTES) throw new Error(`${label} exceeds ${MAX_JSON_BYTES} bytes.`);
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, jsonSafe(child)]));
  }
  return value;
}

function coerceInteger(value: unknown, label: string) {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  throw new Error(`${label} integer values must be safe integers or base-10 integer strings.`);
}

function coerceAbiValue(param: AbiParameter, value: unknown, label: string): unknown {
  const arrayMatch = /^(.*)\[([0-9]*)\]$/.exec(param.type);
  if (arrayMatch) {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
    const fixedLength = arrayMatch[2] ? Number(arrayMatch[2]) : null;
    if (fixedLength !== null && value.length !== fixedLength) throw new Error(`${label} must contain exactly ${fixedLength} items.`);
    const child = { ...param, type: arrayMatch[1] } as AbiParameter;
    return value.map((item, index) => coerceAbiValue(child, item, `${label}[${index}]`));
  }

  if (param.type === "tuple") {
    const components = "components" in param && Array.isArray(param.components) ? param.components : [];
    if (Array.isArray(value)) {
      if (value.length !== components.length) throw new Error(`${label} tuple length does not match ABI components.`);
      return components.map((component, index) => coerceAbiValue(component, value[index], `${label}[${index}]`));
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const names = components.map((component) => ("name" in component ? component.name : "")).filter(Boolean);
      if (names.length !== components.length) throw new Error(`${label} unnamed tuple components require array values.`);
      return Object.fromEntries(components.map((component) => {
        const name = "name" in component ? String(component.name) : "";
        if (!(name in record)) throw new Error(`${label} is missing tuple field ${name}.`);
        return [name, coerceAbiValue(component, record[name], `${label}.${name}`)];
      }));
    }
    throw new Error(`${label} must be a tuple object or array.`);
  }

  if (/^u?int(?:[0-9]{0,3})?$/.test(param.type)) return coerceInteger(value, label);
  if (param.type === "bool") {
    if (typeof value !== "boolean") throw new Error(`${label} must be boolean.`);
    return value;
  }
  if (param.type === "address") {
    if (typeof value !== "string") throw new Error(`${label} must be an address string.`);
    return value;
  }
  if (param.type === "string") {
    if (typeof value !== "string") throw new Error(`${label} must be a string.`);
    return value;
  }
  if (/^bytes(?:[0-9]{1,2})?$/.test(param.type)) {
    if (typeof value !== "string" || !isHex(value, { strict: true })) throw new Error(`${label} must be 0x-prefixed hex.`);
    return value;
  }
  return value;
}

export function ethereumAbiEncode(input: { types: string[]; values: unknown[] }) {
  assertJsonBounded(input, "ABI input");
  if (!Array.isArray(input.types) || input.types.length < 1 || input.types.length > 32) throw new Error("types must contain 1 to 32 ABI parameter definitions.");
  if (!Array.isArray(input.values) || input.values.length !== input.types.length) throw new Error("values length must equal types length.");
  const params = parseAbiParameters(input.types as [string, ...string[]]) as unknown as readonly AbiParameter[];
  const values = params.map((param: AbiParameter, index: number) => coerceAbiValue(param, input.values[index], `values[${index}]`));
  const encoded = encodeAbiParameters(params as never, values as never);
  return { types: input.types, encoded, bytes: (encoded.length - 2) / 2 };
}

export function ethereumAbiDecode(input: { types: string[]; data: string }) {
  assertJsonBounded(input, "ABI input");
  if (!Array.isArray(input.types) || input.types.length < 1 || input.types.length > 32) throw new Error("types must contain 1 to 32 ABI parameter definitions.");
  if (typeof input.data !== "string" || !isHex(input.data, { strict: true }) || (input.data.length - 2) % 2 !== 0) throw new Error("data must be complete 0x-prefixed hex bytes.");
  if ((input.data.length - 2) / 2 > MAX_JSON_BYTES) throw new Error("data exceeds 131072 bytes.");
  const params = parseAbiParameters(input.types as [string, ...string[]]) as unknown as readonly AbiParameter[];
  const decoded = decodeAbiParameters(params as never, input.data as Hex);
  return { types: input.types, data: input.data, values: jsonSafe(decoded) };
}

type TypedField = { name: string; type: string };
type TypedMap = Record<string, TypedField[]>;

function coerceTypedValue(type: string, value: unknown, types: TypedMap, label: string): unknown {
  const arrayMatch = /^(.*)\[([0-9]*)\]$/.exec(type);
  if (arrayMatch) {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
    const fixedLength = arrayMatch[2] ? Number(arrayMatch[2]) : null;
    if (fixedLength !== null && value.length !== fixedLength) throw new Error(`${label} must contain exactly ${fixedLength} items.`);
    return value.map((item, index) => coerceTypedValue(arrayMatch[1], item, types, `${label}[${index}]`));
  }
  if (types[type]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object for struct ${type}.`);
    const record = value as Record<string, unknown>;
    return Object.fromEntries(types[type].map((field) => {
      if (!(field.name in record)) throw new Error(`${label} is missing field ${field.name}.`);
      return [field.name, coerceTypedValue(field.type, record[field.name], types, `${label}.${field.name}`)];
    }));
  }
  if (/^u?int(?:[0-9]{0,3})?$/.test(type)) return coerceInteger(value, label);
  if (type === "bool") {
    if (typeof value !== "boolean") throw new Error(`${label} must be boolean.`);
    return value;
  }
  if (type === "address" || type === "string" || /^bytes(?:[0-9]{1,2})?$/.test(type)) {
    if (typeof value !== "string") throw new Error(`${label} must be a string.`);
    return value;
  }
  return value;
}

export function eip712TypedDataHash(input: {
  domain: Record<string, unknown>;
  types: TypedMap;
  primaryType: string;
  message: Record<string, unknown>;
}) {
  assertJsonBounded(input, "typed data");
  const typeEntries = Object.entries(input.types);
  if (typeEntries.length < 1 || typeEntries.length > 32) throw new Error("types must define 1 to 32 structs.");
  let fieldCount = 0;
  for (const [typeName, fields] of typeEntries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(typeName)) throw new Error(`invalid struct type name ${typeName}.`);
    if (!Array.isArray(fields) || fields.length > 64) throw new Error(`type ${typeName} has too many fields.`);
    fieldCount += fields.length;
    if (fieldCount > 256) throw new Error("typed data exceeds 256 total fields.");
    for (const field of fields) {
      if (!field || typeof field.name !== "string" || typeof field.type !== "string") throw new Error(`type ${typeName} contains an invalid field.`);
    }
  }
  if (!input.types[input.primaryType]) throw new Error("primaryType must exist in types.");
  const message = coerceTypedValue(input.primaryType, input.message, input.types, "message") as Record<string, unknown>;
  const domain: Record<string, unknown> = { ...input.domain };
  if (typeof domain.chainId === "string" && /^\d+$/.test(domain.chainId)) domain.chainId = BigInt(domain.chainId);
  const dynamicHashTypedData = hashTypedData as unknown as (args: Record<string, unknown>) => Hex;
  const digest = dynamicHashTypedData({
    domain,
    types: input.types,
    primaryType: input.primaryType,
    message
  });
  return { primaryType: input.primaryType, digest };
}

export function ensNamehash(inputName: string) {
  if (Buffer.byteLength(inputName, "utf8") > 255) throw new Error("name exceeds 255 bytes.");
  let normalized: string;
  try { normalized = normalize(inputName); }
  catch { throw new Error("name is not valid under ENSIP-15 normalization."); }
  const labels = normalized.split(".");
  return {
    input: inputName,
    normalized,
    namehash: namehash(normalized),
    labels: labels.map((label) => ({ label, labelhash: labelhash(label) }))
  };
}
