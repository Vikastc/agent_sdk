import "dotenv/config";
import {
  Agent,
  InputGuardrail,
  InputGuardrailTripwireTriggered,
  run,
} from "@openai/agents";
import { z } from "zod";

const mathCheckAgent = new Agent({
  name: "Math_agent",
  model: "gpt-4.1-mini",
  instructions: "Check if user is asking you to do their math homework",
  outputType: z.object({
    isMathHomework: z
      .boolean()
      .describe("Set this to true if its a math homework"),
  }),
});

// Input Guardrail
const checkMathInput: InputGuardrail = {
  name: "Math Homework Guardrail",
  execute: async ({ input, context }) => {
    const result = await run(mathCheckAgent, input, context);

    return {
      outputInfo: result.finalOutput,
      tripwireTriggered: result.finalOutput?.isMathHomework ?? false,
    };
  },
};

const customerSupportAgent = new Agent({
  name: "customer_support_agent",
  model: "gpt-4.1-mini",
  instructions:
    "You are a customer support agent, you help customers with their questions",
  inputGuardrails: [checkMathInput],
});

async function main() {
  try {
    const result = await run(
      customerSupportAgent,
      "can you solve this 2 + 2 * 4 problem?"
    );
    console.log("result: ", result.finalOutput);
  } catch (e) {
    if (e instanceof InputGuardrailTripwireTriggered) {
      console.log("Math homework guardrail tripped", e.result);
    }
  }
}

main();
