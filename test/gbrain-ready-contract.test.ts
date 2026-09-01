import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const readiness = readFileSync(join(root, "bin/gstack-gbrain-ready"), "utf8");
const skillStart = readFileSync(join(root, "bin/gstack-skill-start"), "utf8");

describe("GBrain readiness bootstrap contract", () => {
  test("cold startup checks are bounded and repair runs separately", () => {
    expect(readiness).toContain("--check-only");
    expect(readiness).toContain('degraded "not_certified"');
    expect(skillStart).toContain('"$_GBRAIN_READY_BIN" --check-only --session-key');
    expect(skillStart).toContain('"$_GBRAIN_READY_BIN" >/dev/null 2>&1');
  });

  test("two changing fingerprints share one source-wide repair cooldown", () => {
    expect(readiness).toContain("REPAIR_COOLDOWN_SECONDS=1800");
    const attemptAssignment = readiness.match(/^ATTEMPT_FILE=(.*)$/m)?.[1] ?? "";
    expect(attemptAssignment).toContain("${SOURCE_ID}.attempted-at");
    expect(attemptAssignment).not.toContain("FINGERPRINT");

    const repairKey = (sourceId: string, _fingerprint: string) =>
      `${sourceId}.attempted-at`;
    expect(repairKey("candor-worktree", "fingerprint-a")).toBe(
      repairKey("candor-worktree", "fingerprint-b"),
    );
    expect(readiness).toContain('degraded "repair_cooldown"');
    expect(skillStart).toContain('*"reason=repair_cooldown"*)');
  });

  test("code readiness never pulls memory ingestion into repair", () => {
    expect(readiness).toContain("--code-only --dream --quiet");
    expect(readiness).not.toContain("gstack-memory-ingest");
  });

  test("the fingerprint includes untracked code and a schema epoch", () => {
    expect(readiness).toContain("READINESS_SCHEMA=3");
    expect(readiness).toContain("ls-files --others --exclude-standard -z");
    expect(readiness).toContain("UNTRACKED_CODE_HASH");
  });

  test("a stale local bootstrap lock is recoverable", () => {
    const removePid = readiness.indexOf('rm -f "$LOCK_DIR/pid"');
    const removeDir = readiness.indexOf('rmdir "$LOCK_DIR"');
    expect(removePid).toBeGreaterThan(-1);
    expect(removeDir).toBeGreaterThan(removePid);
  });

  test("readiness requires resolved callers and a nonempty blast radius", () => {
    expect(readiness).toContain(".count > 0");
    expect(readiness).toContain("[.callers[]?.resolved] | all");
    expect(readiness).toContain('.result == "ok"');
    expect(readiness).toContain("degraded \"no_resolved_canary\"");
  });

  test("a single canary can certify partial utility, never global readiness", () => {
    expect(readiness).toContain("source-wide completeness");
    expect(readiness).toContain("GBRAIN_GRAPH: partial");
    expect(readiness).not.toContain("GBRAIN_GRAPH: ready");
  });
});
