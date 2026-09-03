"use client";

import type { ComponentProps } from "react";
import ElementPropertiesV05 from "./ElementPropertiesV05";
import MaterialQuickPanelV05 from "./MaterialQuickPanelV05";
import SectionQuickPanelV06 from "./SectionQuickPanelV06";

type Props = ComponentProps<typeof ElementPropertiesV05>;

export default function ElementProperties(props: Props) {
  const selections = props.selections ?? [];
  const members = selections
    .filter((item) => item.type === "member")
    .map((item) => props.model.members.find((member) => member.id === item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const surfaces = selections
    .filter((item) => item.type === "surface")
    .map((item) => props.model.surfaces.find((surface) => surface.id === item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const onModelChange = props.onModelChange ?? (() => undefined);

  return (
    <>
      <ElementPropertiesV05 {...props} />
      <MaterialQuickPanelV05
        model={props.model}
        members={members}
        surfaces={surfaces}
        onModelChange={onModelChange}
      />
      <SectionQuickPanelV06
        model={props.model}
        members={members}
        onModelChange={onModelChange}
      />
    </>
  );
}
