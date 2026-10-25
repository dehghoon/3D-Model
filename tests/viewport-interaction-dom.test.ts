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
        builder.onResolve({ filter: /\/StructuralEditorV05$/ }, () => ({ path: "editor", namespace: "test" }));
        builder.onResolve({ filter: /\/that-open-runtime$/ }, () => ({ path: "runtime", namespace: "test" }));
        builder.onResolve({ filter: /\/(CiscSectionSelectorV05|LevelGridEditorV05)$/ }, () => ({ path: "dialog", namespace: "test" }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, ({ path: id }) => id === "editor"
          ? { resolveDir: process.cwd(), contents: 'export { EditorHarness as default } from "./tests/helpers/modeling-interaction-harness";' }
          : id === "dialog"
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
export const pickThatOpen = async (runtime,event) => ({type:"member",id:runtime.model.members[event.clientX < 400 ? 0 : 1].id});
export const rebuildThatOpenScene = (runtime,model) => {runtime.model=model;};
export const renderTransformPreview = () => {};
export const renderModelingPreview = () => {};
export const clearTransformPreview = () => {};
export const setThatOpenView = () => {};
export const stepThatOpenAxis = () => {};
export const stepThatOpenLevel = () => {};
export function deltaBetween(a, b) { return { x: b.x-a.x, y: b.y-a.y, z: b.z-a.z }; }
export function disposeThatOpenRuntime(runtime) { runtime.renderer.three.domElement.remove(); }
` });
      } }],
    });
    const dom = new JSDOM("<body><div id='root'></div></body>", { url: "http://localhost", pretendToBeVisual: true });
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
    harness.act(() => [...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.trim()==="Advanced Mode")!.click());
    const click = (label: string, utility = false) => harness.act(() => {
      const buttons = [...host.querySelectorAll<HTMLButtonElement>(".architectToolstrip button")];
      const button = buttons.find(item => utility ? item.textContent?.trim() === label : item.querySelector("span:last-child")?.textContent?.trim() === label);
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
    const inputPoint = (values: [string,string,string], relative = false) => {
      const panel = host.querySelector('[aria-label="Point input"]')!;
      harness.act(() => {
        const select = panel.querySelector("select")!;
        select.value = relative ? "relative" : "absolute";
        select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      harness.act(() => {
        [...panel.querySelectorAll<HTMLInputElement>(".pointCoordinateFields input")].forEach((input,index) => {
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,"value")!.set!.call(input,values[index]);
          input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        });
      });
      harness.act(() => panel.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click());
    };
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
      click("Column");
      const beforeLevel = mounted.model().members.length;
      inputPoint(["30","30","0"]);
      const endLevel = mounted.model().levels.find((level: {elevation:number}) => level.elevation !== 0)!;
      const levelSelect = [...host.querySelectorAll("label")].find(item => item.textContent?.startsWith("Column end level"))!.querySelector("select")!;
      harness.act(() => {levelSelect.value=endLevel.id;levelSelect.dispatchEvent(new dom.window.Event("change",{bubbles:true}));});
      harness.act(() => [...host.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent==="Use end level")!.click());
      assert.equal(mounted.model().members.length,beforeLevel+1);
      const levelMember = mounted.model().members.at(-1)!;
      assert.deepEqual(mounted.model().nodes.find((node:{id:string})=>node.id===levelMember.endNodeId).position,{x:30,y:30,z:endLevel.elevation});
      click("Beam"); inputPoint(["40","10","3"]); inputPoint(["5","0","0"],true);
      const beam = mounted.model().members.at(-1)!;
      assert.deepEqual(mounted.model().nodes.find((node:{id:string})=>node.id===beam.endNodeId).position,{x:45,y:10,z:3});
      click("Slab");
      const beforeSurfaceNodes = mounted.model().nodes.length;
      inputPoint(["50","50","3"]); inputPoint(["4","0","0"],true); inputPoint(["0","4","0"],true); inputPoint(["-4","0","0"],true);
      assert.equal(mounted.model().nodes.length,beforeSurfaceNodes,"Pending boundaries must not create orphan nodes");
      assert.equal(harness.getPointToolState().points.length,4);
      harness.act(()=>[...host.querySelectorAll<HTMLButtonElement>(".architectToolstrip button")].find(item=>item.textContent==="Finish Slab")!.click());
      assert.equal(mounted.model().nodes.length,beforeSurfaceNodes+4);
      click("Wall"); inputPoint(["70","70","0"]);
      const beforeCancel = mounted.model().nodes.length;
      harness.act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Cancel active tool"]')!.click());
      assert.equal(harness.getPointToolState().tool,null);
      assert.equal(mounted.model().nodes.length,beforeCancel);
      // The visible multiple-selection toggle must accumulate canvas selections.
      const multipleButton=host.querySelector<HTMLButtonElement>(".viewportMultiSelect")!;
      harness.act(()=>multipleButton.click());
      await harness.act(async()=>tap(280,260));
      await harness.act(async()=>tap(520,260));
      assert.equal(harness.getPublishedSelections().length,2);
      assert.equal(multipleButton.getAttribute("aria-pressed"),"true");
      // Full shell -> group command -> numeric base/target -> shared-node mapping.
      const source = structuredClone(mounted.model());
      const selected = [...mounted.initial.members.map((member:{id:string})=>({type:"member",id:member.id})),{type:"node",id:mounted.initial.nodes[1].id}];
      harness.act(()=>harness.publishSelections(selected));
      click("Copy",true); inputPoint(["0","0","0"]); inputPoint(["10","0","0"],true);
      assert.equal(mounted.model().nodes.length,source.nodes.length+mounted.initial.nodes.length);
      assert.equal(mounted.model().members.length,source.members.length+mounted.initial.members.length);
      assert.equal(harness.getPublishedSelections().length,selected.length);
      assert.deepEqual(mounted.model().nodes.slice(0,source.nodes.length),source.nodes);
      const clones=structuredClone(mounted.model().nodes.slice(source.nodes.length));
      click("Move",true); inputPoint(["0","0","0"]); inputPoint(["0","0","2"]);
      for(const node of clones) assert.deepEqual(mounted.model().nodes.find((item:{id:string})=>item.id===node.id).position,{...node.position,z:node.position.z+2});
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
      assert.ok(host.querySelector(".architectToolstrip"), "Renderer failure must preserve the editor");
      harness.act(()=>harness.publishSelections([{type:"member",id:mounted.model().members[0].id},{type:"member",id:mounted.model().members[1].id}]));
      assert.match(host.querySelector(".viewportMultiSelect")!.textContent!,/2 selected/);
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

