import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("member drawing prompts are mounted in the active viewport", () => {
  const viewport = source("components/ThatOpenViewportV03.tsx");
  const prompt = source("components/MemberDrawStatusBarV01.tsx");

  assert.match(viewport, /MemberDrawStatusBarV01/);
  assert.match(prompt, /Pick first point/);
  assert.match(prompt, /Pick second point/);
  assert.match(prompt, /Esc to cancel/);
  assert.match(prompt, /useMemberDrawState/);
  assert.match(prompt, /aria-live="polite"/);
});
