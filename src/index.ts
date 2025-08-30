import "dotenv/config";
import { Agent, run, tool, AgentInputItem } from "@openai/agents";
import { exec } from "child_process";
import { z } from "zod";

let thread: AgentInputItem[] = [];

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

const getCurrentMenu = tool({
  name: "get_current_menu",
  description: "This tool returns the current menu available",
  parameters: z.object({}),
  async execute() {
    return {
      Food: {
        DalMakhni: "INR 250",
        Panner: "INR 400",
      },
      Drinks: {
        Chai: "INR 50",
        Coffee: "INR 70",
      },
    };
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
  const coadingAgent = new Agent({
    name: "Coding_assistant",
    model: "gpt-4.1-mini",
    instructions: "You are a coding assistant who is an expert in typescript",
    tools: [executeCommand, getCurrentTime],
  });

  const cookingAgent = new Agent({
    name: "Cooking_agent",
    model: "gpt-4.1-mini",
    instructions:
      "You are a cooking assistant who is an expert in culinary arts",
    tools: [getCurrentTime, getCurrentMenu],
  });

  const gatewayAgent = Agent.create({
    name: "Triage Agent",
    model: "gpt-4.1-mini",
    instructions: `
          You determine which agent to call based on user query,
          If it is food related handoff to cookingAgent and if it is coding related handoff to coadingAgent
    `,
    handoffs: [cookingAgent, coadingAgent],
  });

  async function handleUserQuery(query: string) {
    const result = await run(
      gatewayAgent,
      thread.concat({ role: "user", content: query })
    );

    thread = result.history;

    console.log(`History`, result.history);
    console.log("result: ", result.finalOutput);

    return result.finalOutput;
  }

  //   const result = await run(
  //     gatewayAgent,
  //     "Push this code to the current branch with an appropriate commit message based on the changes"
  //   );

//   await handleUserQuery("Hi my name is vikas");

  await handleUserQuery(
    "Push this code to the current branch with an appropriate commit message based on the changes"
  );

//   await handleUserQuery("What is my name?");
}

main();
