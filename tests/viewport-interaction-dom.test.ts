import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

// Exercise the real React tool -> canvas pointer -> snap -> canonical writeback
// chain. Only the WebGL renderer and unrelated library dialogs are replaced.
test("canvas taps create members and surfaces; copy/move commit once; WebGL failure keeps the editor mounted", async () => {
  const temp = await mkdtemp(path.resolve("tests/.interaction-"));
  const output = path.join(temp, "harness.mjs");
  try {
    await build({
      entryPoints: ["tests/helpers/modeling-interaction-harness.tsx"], outfile: output,
      bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external",
      plugins: [{ name: "renderer-test-double", setup(builder) {
        builder.onResolve({ filter: /\/that-open-runtime$/ }, () => ({ path: "runtime", namespace: "test" }));
        builder.onResolve({ filter: /\/(CiscSectionSelectorV05|LevelGridEditorV05)$/ }, () => ({ path: "dialog", namespace: "test" }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path: id }) => id === "dialog"
          ? { contents: "export default function Dialog() { return null; }" }
          : { resolveDir: process.cwd(), contents: `
import * as THREE from "three";
import { resolveSnapPoint } from "./lib/visualization/snap-resolver";
export function createThatOpenRuntime(container) {
  if (document.body.dataset.failWebgl) throw new Error("WebGL unavailable");
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  container.append(canvas);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  return { camera: { three: camera, controls: { enabled: false } }, renderer: { three: { domElement: canvas } }, build: null };
}
export function snapThatOpen(runtime, event, model, selection) {
 return resolveSnapPoint(event, model, selection, runtime.camera.three, runtime.renderer.three.domElement, 13);
}
export const pickThatOpen = async () => null;
export const rebuildThatOpenScene = () => {};
export const renderTransformPreview = () => {};
export const clearTransformPreview = () => {};
export const setThatOpenView = () => {};
export const stepThatOpenAxis = () => {};
export const stepThatOpenLevel = () => {};
export function deltaBetween(a, b) { return { x: b.x-a.x, y: b.y-a.y, z: b.z-a.z }; }
export function disposeThatOpenRuntime(runtime) { runtime.renderer.three.domElement.remove(); }
` });
      } }],
    });
    const dom = new JSDOM("<body><div id='root'></div></body>", { url: "http://localhost" });
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
      navigator: dom.window.navigator, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent,
      Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true })) {
      original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    const harness = await import(pathToFileURL(output).href);
    const host = dom.window.document.getElementById("root")!;
    let mounted = harness.mount(host);
    const click = (label: string, utility = false) => harness.act(() => {
      const buttons = [...host.querySelectorAll<HTMLButtonElement>(utility ? ".architectQuickActions button" : ".toolGrid button")];
      const button = buttons.find(item => item.textContent?.trim() === label);
      assert.ok(button, `Missing ${label} button`);
      button.click();
    });
    const tap = (x: number, y: number, endX = x, endY = y) => harness.act(() => {
      const canvas = host.querySelector("canvas")!;
      for (const [type, clientX, clientY] of [["pointerdown", x, y], ["pointerup", endX, endY]] as const) {
        const event = new dom.window.MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 });
        Object.defineProperties(event, { isPrimary: { value: true }, pointerId: { value: 1 }, pointerType: { value: "mouse" } });
        canvas.dispatchEvent(event);
      }
    });
    try {
      for (const tool of ["Column", "Beam", "Brace"]) {
        const before = mounted.model().members.length;
        click(tool);
        tap(80, 480, 160, 400); // A drag must not create a point/member.
        tap(80, 480);
        assert.equal(mounted.model().members.length, before);
        tap(tool === "Column" ? 80 : 200, tool === "Beam" ? 480 : 300);
        assert.equal(mounted.model().members.length, before + 1);
        assert.equal(mounted.model().members.at(-1).type, tool.toLowerCase());
        click("Select", true);
        assert.equal(harness.getModelingPointTool(), null);
      }
      for (const tool of ["Slab", "Wall"]) {
        const before = mounted.model().surfaces.length;
        click(tool);
        tap(80, 480); tap(200, 480); tap(200, 300);
        harness.act(() => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim().startsWith(`Finish ${tool}`))!.click());
        assert.equal(mounted.model().surfaces.length, before + 1);
      }
      click("Select", true);
      harness.act(() => harness.publishSelection({ type: "member", id: mounted.model().members.at(-1).id }));
      const originalCount = mounted.model().members.length;
      click("Copy", true); tap(80, 480); tap(140, 480);
      assert.equal(mounted.model().members.length, originalCount + 1);
      assert.equal(harness.getInteractionState().mode, "select");
      click("Move", true); tap(80, 480); tap(140, 480);
      assert.equal(mounted.model().members.length, originalCount + 1);
      assert.equal(harness.getInteractionState().mode, "select");
      harness.act(() => harness.publishSelection({ type: "member", id: "MISSING" }));
      click("Copy", true); tap(80, 480); tap(140, 480);
      assert.equal(harness.getInteractionState().mode, "copy-target", "Failed writeback must retain the target step");
      assert.equal(mounted.model().members.length, originalCount + 1);
      assert.match(mounted.messages.at(-1)!, /UNKNOWN_MEMBER/);
      click("Select", true);
      click("Beam");
      harness.act(() => dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" })));
      assert.equal(harness.getModelingPointTool(), null);
      assert.equal(harness.getInteractionState().mode, "select");
      mounted.unmount();
      dom.window.document.body.dataset.failWebgl = "true";
      mounted = harness.mount(host);
      assert.match(host.querySelector('[role="alert"]')!.textContent!, /WebGL/);
      assert.ok(host.querySelector(".toolGrid"), "Renderer failure must preserve the editor");
    } finally {
      mounted.unmount();
      dom.window.close();
      for (const [key, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
