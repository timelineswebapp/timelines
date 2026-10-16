import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/src/server/api/responses";
import { institutionalActorFromAppointments } from "./institutional-actor-resolution";

test("institutional actor resolution fails closed without exactly one active appointment", () => {
  assert.throws(() => institutionalActorFromAppointments("operator-1", []), (error: unknown) => error instanceof ApiError && error.code === "INSTITUTIONAL_AUTHORIZATION_REQUIRED");
  assert.throws(() => institutionalActorFromAppointments("operator-1", [
    { appointmentId: "a", institutionId: "governance", role: "governance_reviewer", authorizationVersion: 1 },
    { appointmentId: "b", institutionId: "governance", role: "governance_reviewer", authorizationVersion: 2 }
  ]), ApiError);
});

test("institutional actor resolution preserves only the governed appointment identity", () => {
  assert.deepEqual(institutionalActorFromAppointments("operator-1", [{ appointmentId: "a", institutionId: "governance", role: "governance_reviewer", authorizationVersion: 1 }]), {
    actorId: "operator-1", institutionId: "governance", role: "governance_reviewer"
  });
});
