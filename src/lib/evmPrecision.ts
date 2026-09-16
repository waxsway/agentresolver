import {
  formatUnits,
  getAddress,
  isHex,
  keccak256,
  parseUnits,
  stringToHex,
  type Hex
} from "viem";

const MAX_INPUT_BYTES = 128 * 1024;

function assertBoundedText(value: string, label: string, maxBytes = MAX_INPUT_BYTES) {
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes.`);
  return bytes;
}

export function evmAddressChecksum(address: string) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("address must be a 20-byte 0x-prefixed EVM address.");
  }
  let checksummed: string;
  try {
    checksummed = getAddress(address);
  } catch {
    throw new Error("address has invalid mixed-case EIP-55 checksum.");
  }
  return {
    input: address,
    checksummed,
    lowercase: checksummed.toLowerCase(),
    eip55: true
  };
}

export function ethereumKeccak256(input: string, encoding: "utf8" | "hex" = "utf8") {
  let bytes: Hex;
  let inputBytes: number;

  if (encoding === "hex") {
    if (!isHex(input, { strict: true }) || (input.length - 2) % 2 !== 0) {
      throw new Error("hex input must be 0x-prefixed and contain complete bytes.");
    }
    inputBytes = (input.length - 2) / 2;
    if (inputBytes > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes.`);
    bytes = input as Hex;
  } else {
    inputBytes = assertBoundedText(input, "input");
    bytes = stringToHex(input);
  }

  return {
    algorithm: "keccak256",
    encoding,
    inputBytes,
    digest: keccak256(bytes)
  };
}

function assertCanonicalSoliditySignature(signature: string) {
  if (signature.length < 3 || signature.length > 1024) {
    throw new Error("signature length must be between 3 and 1024 characters.");
  }
  if (signature.trim() !== signature || /\s/.test(signature)) {
    throw new Error("signature must be canonical and contain no whitespace.");
  }
  const firstParen = signature.indexOf("(");
  if (firstParen <= 0 || !signature.endsWith(")")) {
    throw new Error("signature must look like transfer(address,uint256).");
  }
  const name = signature.slice(0, firstParen);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("signature has an invalid Solidity function/error name.");
  }
  let depth = 0;
  for (let i = firstParen; i < signature.length; i += 1) {
    if (signature[i] === "(") depth += 1;
    else if (signature[i] === ")") depth -= 1;
    if (depth < 0) throw new Error("signature parentheses are unbalanced.");
  }
  if (depth !== 0) throw new Error("signature parentheses are unbalanced.");
}

export function soliditySelector(signature: string) {
  assertCanonicalSoliditySignature(signature);
  const fullHash = keccak256(stringToHex(signature));
  return {
    signature,
    selector: fullHash.slice(0, 10),
    keccak256: fullHash
  };
}

export function convertEvmUnits(input: {
  mode: "parse" | "format";
  value: string;
  decimals: number;
}) {
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 255) {
    throw new Error("decimals must be an integer from 0 to 255.");
  }
  if (input.value.length < 1 || input.value.length > 256) {
    throw new Error("value length must be between 1 and 256 characters.");
  }

  try {
    if (input.mode === "parse") {
      const result = parseUnits(input.value, input.decimals);
      return {
        mode: input.mode,
        value: input.value,
        decimals: input.decimals,
        result: result.toString(),
        resultKind: "base-units"
      };
    }

    if (!/^-?\d+$/.test(input.value)) {
      throw new Error("format mode value must be an integer base-unit string.");
    }
    const result = formatUnits(BigInt(input.value), input.decimals);
    return {
      mode: input.mode,
      value: input.value,
      decimals: input.decimals,
      result,
      resultKind: "decimal"
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("format mode")) throw error;
    throw new Error(error instanceof Error ? error.message : "EVM unit conversion failed.");
  }
}
