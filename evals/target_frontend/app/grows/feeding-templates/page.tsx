"use client";

/**
 * Feeding-template manager: list, create, edit, and delete reusable weekly
 * feeding-schedule templates. Templates are applied to grows from the grow
 * detail page's Feeding tab.
 */

import { useState } from "react";
import NextLink from "next/link";
import {
  Container,
  VStack,
  HStack,
  Box,
  Heading,
  Text,
  Button,
  IconButton,
  Input,
  Card,
  Spinner,
  Flex,
  Badge,
} from "@chakra-ui/react";
import { ArrowLeft, Plus, Pencil, Trash2, Copy } from "lucide-react";
import { toaster } from "../../../components/ChakraProvider";
import {
  useFeedingTemplates,
  useCreateFeedingTemplate,
  useUpdateFeedingTemplate,
  useDeleteFeedingTemplate,
  useCloneFeedingTemplate,
} from "../../../hooks/useFeedingSchedule";
import { FeedingScheduleEditor } from "../../../components/grows/FeedingScheduleEditor";
import type { FeedingScheduleTemplate, WeekInput } from "../../../types/feedingSchedule";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; template: FeedingScheduleTemplate };

function templateToWeeks(t: FeedingScheduleTemplate): WeekInput[] {
  return t.weeks.map((w) => ({
    week_number: w.week_number,
    notes: w.notes ?? undefined,
    nutrients: w.weekNutrients.map((wn) => ({
      nutrient_id: wn.nutrient_id,
      dosage_ml_per_gallon: wn.dosage_ml_per_gallon,
    })),
  }));
}

export default function FeedingTemplatesPage() {
  const { data, isLoading } = useFeedingTemplates();
  const createMut = useCreateFeedingTemplate();
  const updateMut = useUpdateFeedingTemplate();
  const deleteMut = useDeleteFeedingTemplate();
  const cloneMut = useCloneFeedingTemplate();

  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [name, setName] = useState("");
  const [ppmScale, setPpmScale] = useState(500);
  const [displayUnit, setDisplayUnit] = useState("ml/gal");

  const templates = data?.templates ?? [];
  const saving = createMut.isPending || updateMut.isPending;

  const startCreate = () => {
    setName("");
    setPpmScale(500);
    setDisplayUnit("ml/gal");
    setMode({ kind: "create" });
  };
  const startEdit = (t: FeedingScheduleTemplate) => {
    setName(t.name);
    setPpmScale(t.ppm_scale ?? 500);
    setDisplayUnit(t.display_unit ?? "ml/gal");
    setMode({ kind: "edit", template: t });
  };

  const handleSave = (weeks: WeekInput[]) => {
    if (!name.trim()) {
      toaster.create({ title: "Name required", type: "error", duration: 3000 });
      return;
    }
    const payload = { name: name.trim(), ppm_scale: ppmScale, display_unit: displayUnit, weeks };
    const onDone = (title: string) => {
      toaster.create({ title, type: "success", duration: 3000 });
      setMode({ kind: "list" });
    };
    if (mode.kind === "edit") {
      updateMut.mutate(
        { id: mode.template.id, data: payload },
        { onSuccess: () => onDone("Template updated") }
      );
    } else {
      createMut.mutate(payload, { onSuccess: () => onDone("Template created") });
    }
  };

  const handleDelete = (t: FeedingScheduleTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    deleteMut.mutate(t.id, {
      onSuccess: () => toaster.create({ title: "Template deleted", type: "success", duration: 3000 }),
    });
  };

  return (
    <Container maxW="container.lg" py={8} data-testid="feeding-templates-page">
      <HStack mb={6}>
        <Button asChild size="sm" variant="outline" colorPalette="green">
          <NextLink href="/grows">
            <ArrowLeft size={16} /> All Grows
          </NextLink>
        </Button>
      </HStack>

      <Heading size="2xl" mb={1}>
        Feeding Templates
      </Heading>
      <Text color="gray.600" mb={6}>
        Build reusable weekly feeding charts, then apply them to any grow from its Feeding tab.
      </Text>

      {mode.kind !== "list" ? (
        <VStack align="stretch" gap={4}>
          <Heading size="md">
            {mode.kind === "edit" ? "Edit template" : "New template"}
          </Heading>
          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={1}>
              Template name
            </Text>
            <Input
              placeholder="e.g. Synthetic Bloom — 9 week"
              data-testid="template-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxW="420px"
            />
          </Box>
          <HStack gap={4} flexWrap="wrap">
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Dose units
              </Text>
              <select
                data-testid="template-unit-select"
                value={displayUnit}
                onChange={(e) => setDisplayUnit(e.target.value)}
                style={{ padding: "6px", border: "1px solid #e2e8f0", borderRadius: 6 }}
              >
                {["ml/gal", "ml/L", "tsp/gal", "tbsp/gal"].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </HStack>
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                PPM scale
              </Text>
              <select
                data-testid="template-ppm-scale-select"
                value={String(ppmScale)}
                onChange={(e) => setPpmScale(Number(e.target.value))}
                style={{ padding: "6px", border: "1px solid #e2e8f0", borderRadius: 6 }}
              >
                <option value="500">500</option>
                <option value="700">700</option>
              </select>
            </HStack>
          </HStack>
          <FeedingScheduleEditor
            initialWeeks={mode.kind === "edit" ? templateToWeeks(mode.template) : undefined}
            onSave={handleSave}
            saving={saving}
            saveLabel={mode.kind === "edit" ? "Save changes" : "Create template"}
          />
          <Button variant="ghost" alignSelf="flex-start" onClick={() => setMode({ kind: "list" })}>
            Cancel
          </Button>
        </VStack>
      ) : (
        <VStack align="stretch" gap={4}>
          <Button
            colorPalette="green"
            alignSelf="flex-start"
            data-testid="new-template-btn"
            onClick={startCreate}
          >
            <Plus size={16} /> New Template
          </Button>

          {isLoading ? (
            <Flex justify="center" py={10}>
              <Spinner color="green.500" />
            </Flex>
          ) : templates.length === 0 ? (
            <Text color="gray.500" data-testid="templates-empty">
              No templates yet. Create your first feeding chart.
            </Text>
          ) : (
            templates.map((t) => (
              <Card.Root key={t.id} data-testid="template-row">
                <Card.Body p={4}>
                  <HStack justify="space-between">
                    <Box>
                      <HStack gap={2}>
                        <Heading size="sm">{t.name}</Heading>
                        {t.is_system && (
                          <Badge colorPalette="blue" variant="subtle" data-testid="system-badge">
                            System
                          </Badge>
                        )}
                      </HStack>
                      <Text fontSize="sm" color="gray.500">
                        {t.weeks.length} week{t.weeks.length === 1 ? "" : "s"}
                      </Text>
                    </Box>
                    <HStack>
                      {t.is_system ? (
                        <Button
                          size="sm"
                          variant="outline"
                          colorPalette="green"
                          data-testid={`clone-template-${t.id}`}
                          loading={cloneMut.isPending}
                          onClick={() =>
                            cloneMut.mutate(t.id, {
                              onSuccess: () =>
                                toaster.create({ title: "Template cloned", type: "success", duration: 3000 }),
                            })
                          }
                        >
                          <Copy size={16} /> Clone
                        </Button>
                      ) : (
                        <>
                          <IconButton
                            aria-label="Edit template"
                            size="sm"
                            variant="outline"
                            data-testid={`edit-template-${t.id}`}
                            onClick={() => startEdit(t)}
                          >
                            <Pencil size={16} />
                          </IconButton>
                          <IconButton
                            aria-label="Delete template"
                            size="sm"
                            variant="outline"
                            colorPalette="red"
                            data-testid={`delete-template-${t.id}`}
                            onClick={() => handleDelete(t)}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </>
                      )}
                    </HStack>
                  </HStack>
                </Card.Body>
              </Card.Root>
            ))
          )}
        </VStack>
      )}
    </Container>
  );
}
