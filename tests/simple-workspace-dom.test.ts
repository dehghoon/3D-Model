import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
test("Simple creates floor geometry; Undo/Redo and mode switches preserve the shared model; Advanced keeps explicit points", async () => {
  const temp = await mkdtemp(path.resolve("tests/.simple-"));
  const output = path.join(temp, "shell.mjs");
  await build({
    entryPoints: ["components/StructuralEditorShellV3.tsx"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    packages: "external",
    plugins: [
      {
        name: "unrelated-dialogs",
        setup(b) {
          b.onResolve(
            {
              filter:
                /\/(ThatOpenViewportV01|CiscSectionSelectorV05|LevelGridEditorV05|LoadManager|ElementProperties|NodeCreatorV05|SelectedNodeSupportV05)$/,
            },
            () => ({ path: "null", namespace: "stub" }),
          );
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: "export default function Stub(){return null;}",
          }));
        },
      },
    ],
  });
  const dom = new JSDOM("<body><div id='root'></div></body>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  const original = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    CustomEvent: dom.window.CustomEvent,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const React = await import("react"),
    { createRoot } = await import("react-dom/client"),
    Shell = (await import(pathToFileURL(output).href)).default;
  const host = dom.window.document.getElementById("root")!,
    root = createRoot(host);
  const act = React.act;
  const click = (label: string) =>
    act(() => {
      const button = [
        ...host.querySelectorAll<HTMLButtonElement>("button"),
      ].find(
        (b) =>
          b.textContent?.trim() === label ||
          b.querySelector("span:last-child")?.textContent === label,
      );
      assert.ok(button, `Missing ${label}`);
      button.click();
    });
  const pick = (x: number, y: number, z: number) =>
    act(() =>
      dom.window.dispatchEvent(
        new dom.window.CustomEvent("linkoteq:member-draw-pick", {
          detail: {
            point: { x, y, z },
            kind: "work-plane",
            label: "Test floor point",
          },
        }),
      ),
    );
  const model = () =>
    JSON.parse(host.querySelector(".inspector pre")!.textContent!);
  try {
    act(() => root.render(React.createElement(Shell)));
    assert.ok(host.querySelector('[aria-label="Building setup"]'));
    const initial = model(),
      floor = [...initial.levels].sort((a, b) => a.elevation - b.elevation)[0];
    click("Column");
    // Exercise the actual SVG click path without a GPU. Browser matrix maps client coordinates to plan units.
    const svg = host.querySelector("svg")! as any;
    svg.getScreenCTM = () => ({ inverse: () => ({}) });
    svg.createSVGPoint = () => ({
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: this.x, y: this.y };
      },
    });
    act(() =>
      svg.dispatchEvent(
        new dom.window.MouseEvent("click", {
          bubbles: true,
          clientX: 20,
          clientY: -20,
        }),
      ),
    );
    assert.equal(model().members.length, initial.members.length + 1);
    assert.deepEqual(model().nodes.at(-2).position, {
      x: 20,
      y: 20,
      z: floor.elevation,
    });
    click("Wall");
    pick(30, 30, floor.elevation);
    pick(35, 30, floor.elevation);
    assert.equal(
      model().surfaces.length,
      initial.surfaces.length,
      "Boundary stays uncommitted until Finish",
    );
    click("Finish Wall");
    assert.equal(model().surfaces.length, initial.surfaces.length + 1);
    click("Slab");
    pick(40, 40, floor.elevation);
    pick(45, 44, floor.elevation);
    click("Finish Slab");
    const complete = model();
    assert.equal(complete.surfaces.length, initial.surfaces.length + 2);
    click("Undo");
    assert.equal(model().surfaces.length, complete.surfaces.length - 1);
    click("Redo");
    assert.deepEqual(model(), complete);
    click("Advanced Mode");
    assert.deepEqual(model(), complete);
    assert.equal(host.querySelector('[aria-label="Building setup"]'), null);
    click("Column");
    pick(50, 50, 1);
    assert.equal(model().members.length, complete.members.length);
    pick(50, 50, 5);
    assert.equal(model().members.length, complete.members.length + 1);
    const advanced = model();
    click("Simple Mode");
    assert.deepEqual(model(), advanced);
    click("Undo");
    assert.deepEqual(
      model(),
      complete,
      "Undo includes changes made in Advanced",
    );
    click("Beam");
    pick(60, 60, 99);
    assert.deepEqual(
      model(),
      complete,
      "Simple rejects off-floor coordinates without mutation",
    );
  } finally {
    act(() => root.unmount());
    dom.window.close();
    for (const [key, value] of original) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(temp, { recursive: true, force: true });
  }
});
