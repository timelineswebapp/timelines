import { GoogleAuth } from "google-auth-library";
import { z } from "zod";

const schedulerJobSchema = z.object({ state: z.enum(["ENABLED", "PAUSED", "DISABLED", "UPDATE_FAILED"]) }).passthrough();

export async function readSchedulerState(projectId: string, location: string, jobName: string): Promise<string> {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/u.test(projectId)) throw new Error("Invalid scheduler project ID.");
  if (!/^[a-z0-9-]{2,40}$/u.test(location) || !/^[a-z][a-z0-9-]{1,78}[a-z0-9]$/u.test(jobName)) throw new Error("Invalid scheduler resource identity.");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const response = await client.request({ url: `https://cloudscheduler.googleapis.com/v1/projects/${projectId}/locations/${location}/jobs/${jobName}` });
  return schedulerJobSchema.parse(response.data).state;
}
