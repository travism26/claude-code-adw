"use client";

/**
 * RecurrenceBuilder Component
 *
 * Visual RRULE editor with preview of upcoming occurrences.
 * Supports daily, weekly, and monthly recurrence patterns.
 */

import React, { useEffect, useState } from "react";
import { RRule } from "rrule";
import {
  Box,
  Field,
  Grid,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Text,
  VStack,
} from "@chakra-ui/react";
import { RadioGroup } from "@chakra-ui/react";

interface RecurrenceBuilderProps {
  value: string | null;
  onChange: (rrule: string | null) => void;
}

type FrequencyType = "DAILY" | "WEEKLY" | "MONTHLY";
type EndConditionType = "never" | "count" | "until";

/**
 * RecurrenceBuilder component
 * Provides UI for building RRULE strings and previewing occurrences
 */
export const RecurrenceBuilder: React.FC<RecurrenceBuilderProps> = ({
  value,
  onChange,
}) => {
  const [frequency, setFrequency] = useState<FrequencyType>("DAILY");
  const [interval, setInterval] = useState<number>(1);
  const [endCondition, setEndCondition] = useState<EndConditionType>("never");
  const [count, setCount] = useState<number>(10);
  const [until, setUntil] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Parse existing RRULE on mount
  useEffect(() => {
    if (value) {
      try {
        const rule = RRule.fromString(value);
        const options = rule.origOptions;

        // Set frequency
        if (options.freq === RRule.DAILY) setFrequency("DAILY");
        else if (options.freq === RRule.WEEKLY) setFrequency("WEEKLY");
        else if (options.freq === RRule.MONTHLY) setFrequency("MONTHLY");

        // Set interval
        if (options.interval) setInterval(options.interval);

        // Set end condition
        if (options.count) {
          setEndCondition("count");
          setCount(options.count);
        } else if (options.until) {
          setEndCondition("until");
          setUntil(new Date(options.until).toISOString().slice(0, 10));
        } else {
          setEndCondition("never");
        }

        setError(null);
      } catch (err) {
        setError("Invalid recurrence rule");
      }
    }
  }, [value]);

  // Generate RRULE string whenever form values change
  useEffect(() => {
    try {
      const ruleOptions: any = {
        freq: RRule[frequency],
        interval: interval,
      };

      if (endCondition === "count") {
        ruleOptions.count = count;
      } else if (endCondition === "until" && until) {
        ruleOptions.until = new Date(until);
      }

      const rule = new RRule(ruleOptions);
      const rruleString = rule.toString();
      onChange(rruleString);
      setError(null);
    } catch (err) {
      setError("Failed to generate recurrence rule");
    }
  }, [frequency, interval, endCondition, count, until, onChange]);

  // Generate preview occurrences
  const getPreviewOccurrences = (): string[] => {
    try {
      const ruleOptions: any = {
        freq: RRule[frequency],
        interval: interval,
        dtstart: new Date(),
      };

      // For preview, limit to 3 occurrences
      if (endCondition === "count") {
        ruleOptions.count = Math.min(count, 3);
      } else if (endCondition === "until" && until) {
        ruleOptions.until = new Date(until);
        ruleOptions.count = 3;
      } else {
        ruleOptions.count = 3;
      }

      const rule = new RRule(ruleOptions);
      const dates = rule.all();

      return dates.map((date) =>
        date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      );
    } catch (err) {
      return [];
    }
  };

  const previewOccurrences = getPreviewOccurrences();

  return (
    <VStack align="stretch" gap={4} data-testid="recurrence-builder">
      {/* Frequency Selector */}
      <Field.Root>
        <Field.Label>Frequency</Field.Label>
        <NativeSelectRoot>
          <NativeSelectField
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as FrequencyType)}
            data-testid="frequency-select"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </NativeSelectField>
        </NativeSelectRoot>
      </Field.Root>

      {/* Interval Input */}
      <Field.Root>
        <Field.Label>
          Repeat every{" "}
          {frequency === "DAILY" && "day(s)"}
          {frequency === "WEEKLY" && "week(s)"}
          {frequency === "MONTHLY" && "month(s)"}
        </Field.Label>
        <Input
          type="number"
          min={1}
          max={365}
          value={interval}
          onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
          data-testid="interval-input"
        />
      </Field.Root>

      {/* End Condition Selector */}
      <Field.Root>
        <Field.Label>End Condition</Field.Label>
        <VStack align="stretch" gap={2}>
          <RadioGroup.Root
            value={endCondition}
            onValueChange={(e) => setEndCondition(e.value as EndConditionType)}
            data-testid="end-condition-radio"
          >
            <VStack align="stretch" gap={2}>
              <RadioGroup.Item value="never">
                <RadioGroup.ItemText>Never</RadioGroup.ItemText>
              </RadioGroup.Item>

              <RadioGroup.Item value="count">
                <RadioGroup.ItemText>After</RadioGroup.ItemText>
              </RadioGroup.Item>
              {endCondition === "count" && (
                <HStack ml={6}>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                    maxW="100px"
                    data-testid="count-input"
                  />
                  <Text>occurrences</Text>
                </HStack>
              )}

              <RadioGroup.Item value="until">
                <RadioGroup.ItemText>On specific date</RadioGroup.ItemText>
              </RadioGroup.Item>
              {endCondition === "until" && (
                <Box ml={6}>
                  <Input
                    type="date"
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                    data-testid="until-input"
                  />
                </Box>
              )}
            </VStack>
          </RadioGroup.Root>
        </VStack>
      </Field.Root>

      {/* Preview Section */}
      <Box
        borderWidth={1}
        borderRadius="md"
        p={3}
        bg="blue.50"
        data-testid="recurrence-preview"
      >
        <Text fontWeight="bold" fontSize="sm" mb={2}>
          Next 3 occurrences:
        </Text>
        {error ? (
          <Text color="red.500" fontSize="sm">
            {error}
          </Text>
        ) : previewOccurrences.length > 0 ? (
          <VStack align="start" gap={1}>
            {previewOccurrences.map((date, index) => (
              <Text key={index} fontSize="sm" color="gray.700">
                {index + 1}. {date}
              </Text>
            ))}
          </VStack>
        ) : (
          <Text fontSize="sm" color="gray.500">
            No occurrences to preview
          </Text>
        )}
      </Box>
    </VStack>
  );
};
