/**
 * useEnvironmentForm Hook
 *
 * Manages form state and logic for environment creation/editing
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { calculateCapacity, type TentPreset } from "../utils/tentCapacity";
import type {
  CreateGrowEnvironmentRequest,
  UpdateGrowEnvironmentRequest,
  GrowEnvironment,
  EnvironmentType,
  LightType,
} from "../types/growEnvironment";

/**
 * Zod validation schema for environment form
 */
export const environmentFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  type: z.enum(["tent", "room", "closet", "outdoor", "greenhouse"]),
  width_inches: z.number().int().positive("Width must be a positive number").optional().nullable(),
  depth_inches: z.number().int().positive("Depth must be a positive number").optional().nullable(),
  height_inches: z.number().int().positive("Height must be a positive number").optional().nullable(),
  light_type: z.enum(["led", "hps", "mh", "cfl", "sun", "other"]).or(z.literal("")).optional().nullable(),
  light_wattage: z.number().int().positive("Wattage must be a positive number").optional().nullable(),
  ventilation_cfm: z.number().int().positive("CFM must be a positive number").optional().nullable(),
  has_carbon_filter: z.boolean().optional(),
  has_humidifier: z.boolean().optional(),
  has_dehumidifier: z.boolean().optional(),
  has_ac: z.boolean().optional(),
  has_heater: z.boolean().optional(),
  max_plants: z.number().int().positive("Max plants must be a positive number").optional().nullable(),
  notes: z.string().max(2000, "Notes must be 2000 characters or less").optional().nullable(),
  is_active: z.boolean().optional(),
  display_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional().nullable(),
  capacity_warning_threshold: z.number().int().min(0).max(100, "Must be between 0 and 100").optional().nullable(),
});

export type EnvironmentFormData = z.infer<typeof environmentFormSchema>;

interface UseEnvironmentFormProps {
  initialData?: GrowEnvironment;
  onSubmit: (data: CreateGrowEnvironmentRequest | UpdateGrowEnvironmentRequest) => Promise<void>;
}

export const useEnvironmentForm = ({ initialData, onSubmit }: UseEnvironmentFormProps) => {
  const form = useForm<EnvironmentFormData>({
    resolver: zodResolver(environmentFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      type: initialData?.type || "tent",
      width_inches: initialData?.width_inches || null,
      depth_inches: initialData?.depth_inches || null,
      height_inches: initialData?.height_inches || null,
      light_type: initialData?.light_type || null,
      light_wattage: initialData?.light_wattage || null,
      ventilation_cfm: initialData?.ventilation_cfm || null,
      has_carbon_filter: initialData?.has_carbon_filter || false,
      has_humidifier: initialData?.has_humidifier || false,
      has_dehumidifier: initialData?.has_dehumidifier || false,
      has_ac: initialData?.has_ac || false,
      has_heater: initialData?.has_heater || false,
      max_plants: initialData?.max_plants || null,
      notes: initialData?.notes || "",
      is_active: initialData?.is_active ?? true,
    },
  });

  const { watch, setValue } = form;
  const widthInches = watch("width_inches");
  const depthInches = watch("depth_inches");
  const heightInches = watch("height_inches");

  // Calculate capacity when dimensions change
  const capacity =
    widthInches && depthInches ? calculateCapacity(widthInches, depthInches) : null;

  // Auto-update max_plants when dimensions change (if not manually set)
  useEffect(() => {
    if (capacity && !initialData?.max_plants) {
      setValue("max_plants", capacity.flowerPlants);
    }
  }, [capacity, setValue, initialData?.max_plants]);

  const handlePresetSelect = (preset: TentPreset) => {
    setValue("width_inches", preset.width);
    setValue("depth_inches", preset.depth);
    setValue("height_inches", preset.height);
    setValue("light_wattage", preset.recommendedWattage);
    setValue("max_plants", preset.flowerPlants);
  };

  const handleFormSubmit = async (data: EnvironmentFormData) => {
    // Filter out empty string for light_type
    const validLightTypes: LightType[] = ["led", "hps", "mh", "cfl", "sun", "other"];
    const lightTypeValue = data.light_type && validLightTypes.includes(data.light_type as LightType)
      ? (data.light_type as LightType)
      : undefined;

    const requestData: CreateGrowEnvironmentRequest = {
      name: data.name,
      type: data.type as EnvironmentType,
      width_inches: data.width_inches || undefined,
      depth_inches: data.depth_inches || undefined,
      height_inches: data.height_inches || undefined,
      light_type: lightTypeValue,
      light_wattage: data.light_wattage || undefined,
      ventilation_cfm: data.ventilation_cfm || undefined,
      has_carbon_filter: data.has_carbon_filter,
      has_humidifier: data.has_humidifier,
      has_dehumidifier: data.has_dehumidifier,
      has_ac: data.has_ac,
      has_heater: data.has_heater,
      max_plants: data.max_plants || undefined,
      notes: data.notes || undefined,
      is_active: data.is_active,
    };

    await onSubmit(requestData);
  };

  return {
    form,
    capacity,
    widthInches,
    depthInches,
    heightInches,
    handlePresetSelect,
    handleFormSubmit,
  };
};
