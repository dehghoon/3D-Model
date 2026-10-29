import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
test("mobile uses one bottom sheet; model taps edit canonical geometry and two fingers navigate without selecting", async () => {
  const temp = await mkdtemp(path.resolve("tests/.mobile-"));
  const output = path.join(temp, "harness.mjs");
  await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `import React,{useState}from'react';import{act}from'react';import{createRoot}from'react-dom/client';import Simple from './components/SimpleFrameModeler';import{createSimpleFrame,DEFAULT_FRAME}from'./lib/simple-frame';let current;function App(){const[model,setModel]=useState(()=>createSimpleFrame(DEFAULT_FRAME));current=model;return <Simple model={model} onChange={setModel} onAdvanced={()=>{}}/>;}export{act};export function mount(host){const root=createRoot(host);act(()=>root.render(<App/>));return{model:()=>current,unmount:()=>act(()=>root.unmount())};}`,
    },
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    jsx: "automatic",
  });
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  dom.window.matchMedia = (() => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })) as any;
  const fixture = JSON.parse(
    await readFile(
      new URL("./fixtures/simple-core-catalog.json", import.meta.url),
      "utf8",
    ),
  );
  const originals = new Map();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: unknown) =>
      new Response(
        JSON.stringify(
          String(input).includes("core-catalogs")
            ? {
                ref: "fixture",
                locations: [],
                materials: [],
                sectionDatasetVersion: fixture.dataset_version,
              }
            : fixture,
        ),
      ),
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  const h = await import(pathToFileURL(output).href);
  const host = dom.window.document.getElementById("root")!;
  const app = h.mount(host);
  const click = (selector: string) =>
    h.act(() => host.querySelector<HTMLElement>(selector)!.click());
  const tab = (label: string) =>
    h.act(() =>
      [...host.querySelectorAll<HTMLElement>("[role=tab]")]
        .find((b) => b.textContent?.trim().endsWith(label))!
        .click(),
    );
  const pointer = (
    target: Element,
    type: string,
    id: number,
    x: number,
    y: number,
  ) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    Object.defineProperties(event, {
      pointerId: { value: id },
      pointerType: { value: "touch" },
    });
    target.dispatchEvent(event);
  };
  try {
    await h.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const sheet = host.querySelector<HTMLElement>("[role=tabpanel]")!;
    const svg = host.querySelector("svg")!;
    svg.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 390,
      height: 500,
      right: 390,
      bottom: 500,
      toJSON: () => ({}),
    });
    assert.ok(sheet.hidden);
    assert.equal(host.querySelectorAll("[role=tab]").length, 3);
    assert.equal(host.querySelector(".sfSetup"), null);
    assert.equal(svg.dataset.navigationTool, "select");
    tab("Plan & levels");
    assert.ok(!sheet.hidden);
    assert.ok(sheet.querySelector(".sfSetup"));
    click('[aria-label="Add x"]');
    assert.equal(app.model().nodes.length, 45);
    tab("Project");
    assert.equal(sheet.querySelector(".sfSetup"), null);
    assert.ok(sheet.querySelector(".sfCatalogToolbar"));
    assert.equal(
      host.querySelectorAll("[role=tabpanel]:not([hidden])").length,
      1,
    );
    tab("Members");
    assert.ok(sheet.querySelector(".sfMobileMemberBrowser"));
    const beamButton = [
      ...host.querySelectorAll<HTMLButtonElement>(
        ".sfMobileMemberBrowser li button",
      ),
    ].find((b) => b.textContent?.startsWith("beam"))!;
    h.act(() => beamButton.click());
    assert.ok(sheet.querySelector('[aria-label="Member editor"]'));
    const id = app.model().members.find((m: any) => m.type === "beam").id;
    h.act(() => {
      const select = sheet.querySelector<HTMLSelectElement>(
        '[aria-label="Member section"]',
      )!;
      select.value = "cisc-w250x49";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    assert.equal(
      app.model().members.find((m: any) => m.id === id).sectionId,
      "cisc-w250x49",
    );
    click('[aria-label="Close panel"]');
    assert.ok(sheet.hidden);
    const captures: number[] = [];
    svg.setPointerCapture = (id: number) => captures.push(id);
    const snapshot = JSON.stringify(app.model());
    const initial = svg.getAttribute("viewBox");
    h.act(() => {
      pointer(svg, "pointerdown", 1, 120, 200);
      pointer(svg, "pointerdown", 2, 220, 200);
      pointer(svg, "pointermove", 2, 320, 230);
      pointer(svg, "pointerup", 2, 320, 230);
      pointer(svg, "pointerup", 1, 120, 200);
    });
    assert.notEqual(svg.getAttribute("viewBox"), initial);
    assert.deepEqual(captures, [1, 2]);
    captures.length = 0;
    assert.equal(JSON.stringify(app.model()), snapshot);
    assert.ok(sheet.hidden);
    const member = host.querySelector<SVGGElement>(
      '[aria-label^="Edit column"]',
    )!;
    h.act(() =>
      member.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      ),
    );
    assert.ok(sheet.hidden, "Pinching must not accidentally open a member");
    h.act(() => {
      pointer(member, "pointerdown", 1, 180, 200);
      pointer(member, "pointerup", 1, 180, 200);
      member.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      );
    });
    assert.ok(!sheet.hidden);
    assert.deepEqual(
      captures,
      [],
      "A touch tap must retain its member target rather than capturing to the SVG",
    );
    assert.ok(sheet.querySelector('[aria-label="Member editor"]'));
    h.act(() => {
      pointer(svg, "pointerdown", 1, 5, 5);
      pointer(svg, "pointerup", 1, 5, 5);
      svg.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
    assert.ok(sheet.hidden);
    const dimension = host.querySelector<SVGGElement>(
      '[aria-label="Edit X bay 1: 5 m"]',
    )!;
    h.act(() =>
      dimension.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      ),
    );
    assert.ok(!sheet.hidden);
    assert.ok(sheet.querySelector(".sfEdit"));
    assert.equal(sheet.querySelector(".sfSetup"), null);
    h.act(() => {
      const input = sheet.querySelector<HTMLInputElement>(".sfEdit input")!;
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "7");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    click(".sfEdit button[type=submit]");
    assert.ok(sheet.hidden);
    assert.equal(
      app.model().nodes.find((n: any) => n.id === "SF-N1-0-1").position.x,
      7,
    );
    tab("Plan & levels");
    click('[aria-label="Expand panel"]');
    assert.ok(sheet.classList.contains("sfMobileSheetExpanded"));
    const header = sheet.querySelector(".sfSheetHeader")!;
    h.act(() => {
      pointer(header, "pointerdown", 8, 100, 100);
      pointer(header, "pointerup", 8, 100, 200);
    });
    assert.ok(!sheet.classList.contains("sfMobileSheetExpanded"));
    click('[aria-label="Close panel"]');
    click(".sfDisplayPanel>button");
    assert.equal(
      host
        .querySelector(".sfDisplayPanel>button")!
        .getAttribute("aria-expanded"),
      "true",
    );
    tab("Project");
    assert.equal(
      host
        .querySelector(".sfDisplayPanel>button")!
        .getAttribute("aria-expanded"),
      "false",
    );
  } finally {
    app.unmount();
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await rm(temp, { recursive: true, force: true });
  }
});
