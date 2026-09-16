import assert from "node:assert/strict";
import test from "node:test";
import {
  convertEvmUnits,
  ethereumKeccak256,
  evmAddressChecksum,
  soliditySelector
} from "../src/lib/evmPrecision";

test("EIP-55 checksum normalization matches canonical Ethereum vector", () => {
  const out = evmAddressChecksum("0x52908400098527886e0f7030069857d2e4169ee7");
  assert.equal(out.checksummed, "0x52908400098527886E0F7030069857D2E4169EE7");
  assert.equal(out.eip55, true);
});

test("keccak256 matches Ethereum empty-string vector", () => {
  const out = ethereumKeccak256("", "utf8");
  assert.equal(out.digest, "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  assert.equal(out.inputBytes, 0);
});

test("Solidity selector matches ERC-20 transfer selector", () => {
  const out = soliditySelector("transfer(address,uint256)");
  assert.equal(out.selector, "0xa9059cbb");
  assert.equal(out.keccak256.length, 66);
});

test("EVM units parse and format avoid floating point", () => {
  const parsed = convertEvmUnits({ mode: "parse", value: "1.5", decimals: 18 });
  assert.equal(parsed.result, "1500000000000000000");
  assert.equal(parsed.resultKind, "base-units");

  const formatted = convertEvmUnits({ mode: "format", value: "1500000000000000000", decimals: 18 });
  assert.equal(formatted.result, "1.5");
  assert.equal(formatted.resultKind, "decimal");
});

test("invalid mixed-case EVM checksum is rejected", () => {
  assert.throws(
    () => evmAddressChecksum("0x52908400098527886E0f7030069857D2E4169EE7"),
    /invalid mixed-case/
  );
});
