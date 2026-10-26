import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
test("simple dimensions edit canonical geometry, grids/storeys grow, and Advanced shares the exact model", async () => {
  const temp = await mkdtemp(path.resolve("tests/.simple-"));
  const output = path.join(temp, "ui.mjs");
  await build({
    stdin: {
      contents: `import React from 'react';import {act} from 'react';import {createRoot} from 'react-dom/client';import Shell from './components/StructuralEditorShellV3';export {act};export function mount(host){const root=createRoot(host);act(()=>root.render(<Shell/>));return ()=>act(()=>root.unmount());}`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    packages: "external",
    plugins: [
      {
        name: "advanced-double",
        setup(b) {
          b.onResolve({ filter: /\/StructuralEditorV05$/ }, () => ({
            path: "editor",
            namespace: "mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            resolveDir: process.cwd(),
            contents: `import React from 'react';export default function Editor({model,onModelChange}) {return <div><pre data-model>{JSON.stringify(model)}</pre><button onClick={()=>onModelChange({...model,project:{...model.project,name:'Advanced edit'}})}>Edit advanced model</button></div>}`,
            loader: "tsx",
          }));
        },
      },
    ],
  });
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
  const originals = new Map();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  const h = await import(pathToFileURL(output).href);
  const host = dom.window.document.getElementById("root")!;
  const unmount = h.mount(host);
  const button = (text: string) =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent?.trim() === text,
    )!;
  const click = (text: string) => h.act(() => button(text).click());
  const setInput = (input: HTMLInputElement, value: string) =>
    h.act(() => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  try {
    assert.ok(host.querySelector(".simpleFrameWorkspace"));
    assert.equal(host.querySelector(".architectToolstrip"), null);
    h.act(() =>
      host
        .querySelector<SVGGElement>('[aria-label="Edit X bay 1: 5 m"]')!
        .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
    );
    setInput(host.querySelector(".sfEdit input")!, "7");
    click("Apply");
    assert.ok(host.querySelector('[aria-label="Edit X bay 1: 7 m"]'));
    assert.match(
      host.querySelector(".sfCanvas header")!.textContent!,
      /17.0 × 10.0/,
    );
    h.act(() =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Add heights"]')!
        .click(),
    );
    h.act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Add x"]')!.click(),
    );
    click("Advanced Mode");
    const model = JSON.parse(host.querySelector("[data-model]")!.textContent!);
    assert.equal(model.levels.length, 4);
    assert.equal(model.nodes.length, 60);
    assert.equal(
      model.nodes.find((n: any) => n.id === "SF-N1-0-1").position.x,
      7,
    );
    click("Simple Mode");
    assert.ok(host.querySelector('[aria-label="Edit X bay 1: 7 m"]'));
    click("Advanced Mode");
    click("Edit advanced model");
    click("Simple Mode");
    assert.ok(host.querySelector(".sfNotice"));
    h.act(() =>
      host.querySelector<HTMLButtonElement>('[aria-label="Add x"]')!.click(),
    );
    assert.match(
      host.querySelector("[role=alert]")!.textContent!,
      /Create a quick frame first/,
    );
    click("Advanced Mode");
    assert.equal(
      JSON.parse(host.querySelector("[data-model]")!.textContent!).project.name,
      "Advanced edit",
    );
  } finally {
    unmount();
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(temp, { recursive: true, force: true });
  }
});
