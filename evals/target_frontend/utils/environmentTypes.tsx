import React from "react";
import {
  Tent,
  Home,
  DoorOpen,
  Trees,
  Warehouse,
} from "lucide-react";
import type { EnvironmentType } from "../types/growEnvironment";

export const getTypeIcon = (type: EnvironmentType) => {
  switch (type) {
    case "tent":
      return <Tent size={20} />;
    case "room":
      return <Home size={20} />;
    case "closet":
      return <DoorOpen size={20} />;
    case "outdoor":
      return <Trees size={20} />;
    case "greenhouse":
      return <Warehouse size={20} />;
    default:
      return <Tent size={20} />;
  }
};

export const getTypeName = (type: EnvironmentType): string => {
  const names: Record<EnvironmentType, string> = {
    tent: "Grow Tent",
    room: "Grow Room",
    closet: "Closet",
    outdoor: "Outdoor",
    greenhouse: "Greenhouse",
  };
  return names[type] || type;
};
