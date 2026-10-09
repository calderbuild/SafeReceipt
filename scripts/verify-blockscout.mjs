// Verify a deployed contract on a Blockscout explorer from the Hardhat build-info.
// No API key. Run `npx hardhat compile` first so build-info matches the deployed bytecode.
//
//   node scripts/verify-blockscout.mjs https://scan.bohr.life <address> contracts/ActionRegistry.sol:ActionRegistry
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [explorer, address, fqName] = process.argv.slice(2);
if (!explorer || !address || !fqName?.includes(":")) {
  console.error("usage: verify-blockscout.mjs <explorer> <address> <path.sol:Name>");
  process.exit(1);
}
const [source, name] = fqName.split(":");

const dir = "artifacts/build-info";
const build = readdirSync(dir)
  .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
  .find((b) => b.output.contracts[source]?.[name]);
if (!build) throw new Error(`${fqName} not found in ${dir}`);

const form = new FormData();
form.append("compiler_version", `v${build.solcLongVersion}`);
form.append("contract_name", name);
form.append("autodetect_constructor_args", "true");
form.append("license_type", "mit");
form.append("files[0]", new Blob([JSON.stringify(build.input)], { type: "application/json" }), "input.json");

const res = await fetch(`${explorer}/api/v2/smart-contracts/${address}/verification/via/standard-input`, {
  method: "POST",
  body: form,
});
console.log(`submit ${res.status} ${await res.text()}`);
if (!res.ok) process.exit(1);

// Verification runs asynchronously; poll until the explorer reports it.
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const sc = await (await fetch(`${explorer}/api/v2/smart-contracts/${address}`)).json();
  if (sc.is_verified) {
    console.log(`verified: ${sc.name} (${sc.compiler_version}) ${explorer}/address/${address}?tab=contract`);
    process.exit(0);
  }
}
console.error("not verified after polling");
process.exit(1);
