import { validateProductionHardening } from "@/src/server/operations/production-hardening";

const result = validateProductionHardening();

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, component: "production_hardening_verification", result }));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, component: "production_hardening_verification", result }));
