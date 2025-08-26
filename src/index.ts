import "dotenv/config";
import { Agent, run, tool } from "@openai/agents";
import { exec } from "child_process";
import { z } from "zod";

const executeCommand = tool({
  name: "system_access_tool",
  description: "This tool has access to cli",
  parameters: z.object({
    cmd: z.string(),
  }),
  async execute({ cmd }: { cmd: string }) {
    return new Promise((resolve, reject) => {
      exec(cmd, (err: Error | null, data: string) => {
        if (err) reject(err.message);
        else resolve(data);
      });
    });
  },
});

async function main() {
  const agent = new Agent({
    name: "Coding_assistant",
    model: "gpt-4.1-mini",
    instructions: "You are a coding assistant who is an expert in typescript",
    tools: [executeCommand],
  });

  const result = await run(agent, "Push the current code to github, use the tools available");

  console.log(`History`, result.history);
  console.log("result: ", result.finalOutput);
}

main();
