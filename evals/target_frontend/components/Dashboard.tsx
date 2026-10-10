"use client"

import type React from "react"
import { AlertTriangle, Calendar, CheckCircle, Droplets, Zap } from "lucide-react"
import { Box, Flex, HStack, VStack, Text, IconButton, Skeleton, Icon as ChakraIcon } from "@chakra-ui/react"
import { useDashboard } from "../hooks/useDashboard"
import { SeasonalTips } from "./SeasonalTips"
import type { DashboardTask } from "../types"

interface TaskCardProps {
  task: DashboardTask
  onComplete: (taskId: string) => void
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onComplete }) => {
  const Icon = task.taskType === "water" ? Droplets : Zap
  const bgColor = task.overdue ? "red.50" : "white"
  const borderColor = task.overdue ? "red.200" : "gray.200"
  const iconColor = task.taskType === "water" ? "blue.500" : "yellow.500"

  return (
    <Box
      p={4}
      rounded="lg"
      borderWidth="1px"
      borderColor={borderColor}
      bg={bgColor}
      shadow="sm"
    >
      <Flex align="center" justify="space-between">
        <HStack gap={3}>
          <ChakraIcon as={Icon} boxSize={5} color={iconColor} />
          <Box>
            <Text fontWeight="medium" color="gray.900">{task.plantName}</Text>
            <Text fontSize="sm" color="gray.500">
              {task.taskType === "water" ? "Water" : "Fertilize"}
            </Text>
          </Box>
        </HStack>
        <HStack gap={2}>
          {task.overdue && <ChakraIcon as={AlertTriangle} boxSize={4} color="red.500" />}
          <IconButton
            onClick={() => onComplete(task.id)}
            aria-label="Complete task"
            variant="ghost"
            colorScheme="green"
            rounded="full"
            data-testid="complete-task"
          >
            <ChakraIcon as={CheckCircle} boxSize={5} />
          </IconButton>
        </HStack>
      </Flex>
    </Box>
  )
}

export const Dashboard: React.FC = () => {
  const { todaysTasks, upcomingTasks, overdueTasks, isLoading, refreshTasks } = useDashboard()

  const handleCompleteTask = async (_taskId: string) => {
    // TODO: Create a journal entry when completing a task
    await refreshTasks()
  }

  if (isLoading) {
    return (
      <VStack gap={4} align="stretch">
        <Skeleton height="16px" width="25%" />
        <VStack gap={3} align="stretch">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="64px" rounded="md" />
          ))}
        </VStack>
      </VStack>
    )
  }

  return (
    <VStack gap={6} align="stretch">
      {/* Welcome Section */}
      <Box bg="white" p={4} rounded="lg" shadow="sm">
        <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb={2}>
          Welcome back! 🌱
        </Text>
        <Text color="gray.600">Here&apos;s what your plants need today</Text>
      </Box>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Box data-testid="overdue-tasks">
          <HStack gap={2} mb={3}>
            <ChakraIcon as={AlertTriangle} boxSize={5} color="red.500" />
            <Text fontWeight="semibold" color="red.700">
              Overdue ({overdueTasks.length})
            </Text>
          </HStack>
          <VStack gap={3} align="stretch">
            {overdueTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={handleCompleteTask} />
            ))}
          </VStack>
        </Box>
      )}

      {/* Today's Tasks */}
      <Box data-testid="today-tasks">
        <HStack gap={2} mb={3}>
          <ChakraIcon as={Calendar} boxSize={5} color="green.600" />
          <Text fontWeight="semibold" color="gray.900">
            Today ({todaysTasks.length})
          </Text>
        </HStack>
        {todaysTasks.length > 0 ? (
          <VStack gap={3} align="stretch">
            {todaysTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={handleCompleteTask} />
            ))}
          </VStack>
        ) : (
          <Box bg="white" p={6} rounded="lg" textAlign="center">
            <ChakraIcon as={CheckCircle} boxSize={12} color="green.500" mx="auto" mb={2} />
            <Text color="gray.600">All caught up for today! 🎉</Text>
          </Box>
        )}
      </Box>

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <Box data-testid="upcoming-tasks">
          <Text fontWeight="semibold" color="gray.900" mb={3}>
            Coming Up ({upcomingTasks.length})
          </Text>
          <VStack gap={3} align="stretch">
            {upcomingTasks.slice(0, 3).map((task) => (
              <Box
                key={task.id}
                bg="white"
                p={4}
                rounded="lg"
                borderWidth="1px"
                borderColor="gray.200"
                shadow="sm"
              >
                <HStack gap={3}>
                  <ChakraIcon
                    as={task.taskType === "water" ? Droplets : Zap}
                    boxSize={5}
                    color={task.taskType === "water" ? "blue.500" : "yellow.500"}
                  />
                  <Box>
                    <Text fontWeight="medium" color="gray.900">{task.plantName}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {task.taskType === "water" ? "Water" : "Fertilize"} on{" "}
                      {new Date(task.dueDate).toLocaleDateString()}
                    </Text>
                  </Box>
                </HStack>
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {/* Seasonal Tips */}
      <Box data-testid="seasonal-tips">
        <SeasonalTips compact />
      </Box>
    </VStack>
  )
}
