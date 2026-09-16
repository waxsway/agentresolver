import assert from "node:assert/strict";
import test from "node:test";
import {
  eip712TypedDataHash,
  ensNamehash,
  ethereumAbiDecode,
  ethereumAbiEncode
} from "../src/lib/evmAdvanced";

test("ABI encode and decode match canonical 32-byte word layout", () => {
  const expected = "0x" + "0".repeat(62) + "2a" + "0".repeat(63) + "1";
  const encoded = ethereumAbiEncode({ types: ["uint256", "bool"], values: ["42", true] });
  assert.equal(encoded.encoded, expected);
  assert.equal(encoded.bytes, 64);

  const decoded = ethereumAbiDecode({ types: ["uint256", "bool"], data: expected });
  assert.deepEqual(decoded.values, ["42", true]);
});

test("EIP-712 hash matches the canonical Ether Mail example", () => {
  const out = eip712TypedDataHash({
    domain: {
      name: "Ether Mail",
      version: "1",
      chainId: 1,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
    },
    types: {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" }
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" }
      ]
    },
    primaryType: "Mail",
    message: {
      from: {
        name: "Cow",
        wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
      },
      to: {
        name: "Bob",
        wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
      },
      contents: "Hello, Bob!"
    }
  });
  assert.equal(out.digest, "0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2");
});

test("ENS namehash normalizes before hashing and matches viem documented vector", () => {
  const out = ensNamehash("WeVm.eTh");
  assert.equal(out.normalized, "wevm.eth");
  assert.equal(out.namehash, "0xf246651c1b9a6b141d19c2604e9a58f567973833990f830d882534a747801359");
  assert.equal(out.labels.length, 2);
  assert.match(out.labels[0].labelhash, /^0x[0-9a-f]{64}$/);
});

test("ABI encoder rejects unsafe numeric integers", () => {
  assert.throws(
    () => ethereumAbiEncode({ types: ["uint256"], values: [Number.MAX_SAFE_INTEGER + 1] }),
    /safe integers/
  );
});
