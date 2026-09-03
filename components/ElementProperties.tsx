"use client";

import { useEffect, type ComponentProps } from "react";
import ElementPropertiesV05 from "./ElementPropertiesV05";
import MaterialQuickPanelV05 from "./MaterialQuickPanelV05";

type Props = ComponentProps<typeof ElementPropertiesV05>;

const MATERIAL_OPEN_EVENT = "linkoteq:material-panel-open";

export default function ElementProperties(props: Props) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>(
        'button[aria-label="Open canonical material selector"]',
      );
      if (!button) return;
      window.dispatchEvent(new Event(MATERIAL_OPEN_EVENT));
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const selections = props.selections ?? [];
  const members = selections
    .filter((item) => item.type === "member")
    .map((item) => props.model.members.find((member) => member.id === item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const surfaces = selections
    .filter((item) => item.type === "surface")
    .map((item) => props.model.surfaces.find((surface) => surface.id === item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <>
      <ElementPropertiesV05 {...props} />
      <MaterialQuickPanelV05
        model={props.model}
        members={members}
        surfaces={surfaces}
        onModelChange={props.onModelChange ?? (() => undefined)}
      />
    </>
  );
}
