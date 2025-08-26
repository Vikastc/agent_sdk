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

const getCurrentTime = tool({
  name: "fetch_current_time",
  description: "This tool fetches the current time",
  parameters: z.object({}),
  async execute() {
    return new Date().toString();
  },
});

async function main() {
  const agent = new Agent({
    name: "Coding_assistant",
    model: "gpt-5-mini",
    instructions: "You are a coding assistant who is an expert in typescript",
    tools: [executeCommand, getCurrentTime],
  });

  //   const result = await run(
  //     agent,
  //     "What is the current time and Give me the code to add two numbers"
  //   );

  const result = await run(
    agent,
    "Push this code to the current branch with an appropriate commit message"
  );

  console.log(`History`, result.history);
  console.log("result: ", result.finalOutput);
}

main();
