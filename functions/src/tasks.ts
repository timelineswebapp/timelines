import { CloudTasksClient, protos } from "@google-cloud/tasks";
import { ACTIVE_CORPUS_ID, COMPUTE_REGION, FUNCTION_NAMES, PROJECT_ID, QUEUES, TASK_INVOKER_EMAIL } from "./config";
import type { TaskPayload } from "./schemas";

const client = new CloudTasksClient();

function functionUrl(functionName: string) {
  return `https://${COMPUTE_REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;
}

function queuePath(queue: string) {
  return client.queuePath(PROJECT_ID, COMPUTE_REGION, queue);
}

function taskPath(queue: string, taskId: string) {
  return client.taskPath(PROJECT_ID, COMPUTE_REGION, queue, taskId);
}

async function createHttpTask(input: {
  queue: string;
  taskId: string;
  functionName: string;
  payload: Record<string, unknown>;
  deadlineSeconds: number;
  scheduleTime?: Date;
}) {
  const task: protos.google.cloud.tasks.v2.ITask = {
    name: taskPath(input.queue, input.taskId),
    dispatchDeadline: { seconds: input.deadlineSeconds },
    httpRequest: {
      httpMethod: "POST",
      url: functionUrl(input.functionName),
      headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify(input.payload)).toString("base64"),
      oidcToken: {
        serviceAccountEmail: TASK_INVOKER_EMAIL,
        audience: functionUrl(input.functionName)
      }
    },
    scheduleTime: input.scheduleTime
      ? { seconds: Math.floor(input.scheduleTime.getTime() / 1000) }
      : undefined
  };
  try {
    const [created] = await client.createTask({ parent: queuePath(input.queue), task });
    return { created: true, name: created.name || task.name! };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 6) {
      return { created: false, name: task.name! };
    }
    throw error;
  }
}

export function enqueueGenerationTask(payload: TaskPayload, priority: boolean, scheduleTime?: Date) {
  const queue = priority ? QUEUES.priority : QUEUES.autonomous;
  const functionName = priority ? FUNCTION_NAMES.priorityWorker : FUNCTION_NAMES.autonomousWorker;
  return createHttpTask({
    queue,
    functionName,
    taskId: `${ACTIVE_CORPUS_ID}-${payload.topicId}-g${payload.generation}`,
    payload,
    deadlineSeconds: 1800,
    scheduleTime
  });
}

export function enqueueInstitutionalTask(payload: TaskPayload & { packageId: string; decision: "routine" | "exceptional" }) {
  return createHttpTask({
    queue: QUEUES.institutional,
    functionName: FUNCTION_NAMES.institutionalWorker,
    taskId: `${ACTIVE_CORPUS_ID}-${payload.topicId}-g${payload.generation}-institutional`,
    payload,
    deadlineSeconds: 900
  });
}
