"use client";

import type { ComponentProps } from "react";
import ElementPropertiesV05 from "./ElementPropertiesV05";
import MaterialQuickPanelV05 from "./MaterialQuickPanelV05";
import QuickLibraryPanelStylesV05 from "./QuickLibraryPanelStylesV05";
import SectionQuickPanelV07 from "./SectionQuickPanelV07";

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
      <QuickLibraryPanelStylesV05 />
      <ElementPropertiesV05 {...props} />
      <MaterialQuickPanelV05
        model={props.model}
        members={members}
        surfaces={surfaces}
        onModelChange={onModelChange}
      />
      <SectionQuickPanelV07
        model={props.model}
        members={members}
        onModelChange={onModelChange}
      />
    </>
  );
}
