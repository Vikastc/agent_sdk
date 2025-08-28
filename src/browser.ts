import "dotenv/config";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { chromium } from "playwright";
import readline from "readline";

const MAX_TURNS = 25;
const MAX_SCREENSHOTS = 3;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

interface AutomationState {
  screenshotCount: number;
  turnCount: number;
  lastAction: string;
  repeatActionCount: number;
}

async function main() {
  const userPrompt = await askQuestion("Enter the query: ");
  rl.close();

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-extensions", "--disable-file-system", "--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  const automationState: AutomationState = {
    screenshotCount: 0,
    turnCount: 0,
    lastAction: "",
    repeatActionCount: 0,
  };

  async function getAllFormFields() {
    return await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll("input, select, textarea")
      );
      return inputs.map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";

        const getLabel = () => {
          if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label) return label.textContent?.trim();
          }
          const parentLabel = el.closest("label");
          if (parentLabel) return parentLabel.textContent?.trim();
          return null;
        };

        return {
          name: el.getAttribute("name"),
          id: el.getAttribute("id"),
          placeholder: el.getAttribute("placeholder"),
          type: el.getAttribute("type") || el.tagName.toLowerCase(),
          value: (el as HTMLInputElement).value || "",
          tagName: el.tagName.toLowerCase(),
          visible: isVisible,
          required: el.hasAttribute("required"),
          label: getLabel(),
          className: el.className,
        };
      });
    });
  }

  async function getAllButtons() {
    return await page.evaluate(() => {
      const buttonElements = Array.from(
        document.querySelectorAll(
          'button, input[type="submit"], input[type="button"], [role="button"]'
        )
      );
      return buttonElements.map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none";

        const text =
          el.textContent?.trim() ||
          el.getAttribute("value") ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          "";

        return {
          text,
          selector: el.id
            ? `#${el.id}`
            : el.className
            ? `.${el.className.split(" ")[0]}`
            : `${el.tagName.toLowerCase()}`,
          visible: isVisible,
          className: el.className,
        };
      });
    });
  }

  function trackAction(action: string): boolean {
    if (automationState.lastAction === action) {
      automationState.repeatActionCount++;
    } else {
      automationState.lastAction = action;
      automationState.repeatActionCount = 1;
    }

    if (automationState.repeatActionCount > 2) {
      return false;
    }

    automationState.turnCount++;
    return automationState.turnCount < MAX_TURNS;
  }

  const takeScreenShot = tool({
    name: "take_screenshot",
    description: "Save screenshots to disk with strict limits.",
    parameters: z.object({
      reason: z
        .string()
        .default("debug")
        .describe("Reason for taking screenshot"),
    }),
    async execute({ reason }) {
      if (automationState.screenshotCount >= MAX_SCREENSHOTS) {
        return `Screenshot limit reached (${MAX_SCREENSHOTS}).`;
      }

      if (!trackAction(`screenshot_${reason}`)) {
        return "Action blocked to prevent infinite loop.";
      }

      automationState.screenshotCount++;
      const timestamp = Date.now();
      const path = `screenshot-${reason}-${timestamp}.png`;

      try {
        await page.screenshot({ path, fullPage: false });
        return `Screenshot saved (${automationState.screenshotCount}/${MAX_SCREENSHOTS}): ${path}`;
      } catch (error) {
        return `Screenshot failed: ${error}`;
      }
    },
  });

  const openURL = tool({
    name: "open_url",
    description: "Navigates to the specified URL.",
    parameters: z.object({
      url: z.string().describe("The URL to open in the browser"),
    }),
    async execute({ url }) {
      if (!trackAction(`navigate_${url}`)) {
        return "Navigation blocked to prevent infinite loop.";
      }

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
        const fields = await getAllFormFields();
        const buttons = await getAllButtons();
        return `Navigated to ${url}. Found ${fields.length} form fields and ${buttons.length} buttons.`;
      } catch (error) {
        return `Failed to navigate to ${url}: ${error}`;
      }
    },
  });

  const smartFillField = tool({
    name: "smart_fill_field",
    description:
      "Intelligently fill form fields by matching labels, placeholders, or field types",
    parameters: z.object({
      fieldType: z
        .enum([
          "firstName",
          "lastName",
          "email",
          "password",
          "confirmPassword",
          "username",
          "phone",
          "address",
          "custom",
        ])
        .describe("Type of field to fill"),
      value: z.string().describe("Value to fill"),
      customSelector: z
        .string()
        .nullable()
        .optional()
        .describe("Custom selector if fieldType is 'custom'"),
    }),
    async execute({ fieldType, value, customSelector }) {
      const actionKey = `fill_${fieldType}_${value}`;
      if (!trackAction(actionKey)) {
        return "Fill action blocked to prevent infinite loop.";
      }

      try {
        const fields = await getAllFormFields();
        let targetField = null;

        if (fieldType === "custom" && customSelector) {
          const element = page.locator(customSelector).first();
          await element.fill(value);
          return `Successfully filled custom field "${customSelector}" with "${value}"`;
        }

        const fieldMatchers: Record<string, (field: any) => boolean> = {
          firstName: (field: any) =>
            field.id?.includes("first") ||
            field.name?.includes("first") ||
            field.placeholder?.toLowerCase().includes("first") ||
            field.label?.toLowerCase().includes("first"),
          lastName: (field: any) =>
            field.id?.includes("last") ||
            field.name?.includes("last") ||
            field.placeholder?.toLowerCase().includes("last") ||
            field.label?.toLowerCase().includes("last"),
          email: (field: any) =>
            field.type === "email" ||
            field.id?.includes("email") ||
            field.name?.includes("email") ||
            field.placeholder?.toLowerCase().includes("email") ||
            field.label?.toLowerCase().includes("email"),
          password: (field: any) =>
            field.type === "password" &&
            !field.id?.includes("confirm") &&
            !field.name?.includes("confirm"),
          confirmPassword: (field: any) =>
            field.type === "password" &&
            (field.id?.includes("confirm") || field.name?.includes("confirm")),
          username: (field: any) =>
            field.id?.includes("user") ||
            field.name?.includes("user") ||
            field.placeholder?.toLowerCase().includes("user") ||
            field.label?.toLowerCase().includes("user"),
          phone: (field: any) =>
            field.type === "tel" ||
            field.id?.includes("phone") ||
            field.name?.includes("phone"),
          address: (field: any) =>
            field.id?.includes("address") || field.name?.includes("address"),
          custom: () => false,
        };

        targetField = fields.find(
          (field: any) => field.visible && fieldMatchers[fieldType]?.(field)
        );

        if (!targetField) {
          return `No matching field found for type: ${fieldType}`;
        }

        let locator;
        if (targetField.id) {
          locator = page.locator(`#${targetField.id}`);
        } else if (targetField.name) {
          locator = page.locator(`input[name="${targetField.name}"]`);
        } else if (targetField.placeholder) {
          locator = page.locator(
            `input[placeholder="${targetField.placeholder}"]`
          );
        } else {
          return `Unable to create selector for field type: ${fieldType}`;
        }

        await locator.waitFor({ timeout: 10000 });
        await locator.scrollIntoViewIfNeeded();
        await locator.click({ clickCount: 3 });
        await locator.fill(value);
        await locator.blur();

        return `Successfully filled ${fieldType} field with "${value}"`;
      } catch (error) {
        return `Failed to fill ${fieldType} field: ${error}`;
      }
    },
  });

  const smartClickButton = tool({
    name: "smart_click_button",
    description: "Click button elements by text content",
    parameters: z.object({
      buttonText: z.string().describe("Text content of the button to click"),
    }),
    async execute({ buttonText }) {
      const actionKey = `click_${buttonText}`;
      if (!trackAction(actionKey)) {
        return "Click action blocked to prevent infinite loop.";
      }

      try {
        // Get available buttons and find the target
        const buttons = await getAllButtons();
        const targetButton = buttons.find(
          (button) =>
            button.visible &&
            button.text.toLowerCase().includes(buttonText.toLowerCase())
        );

        if (!targetButton) {
          return `No button found with text: "${buttonText}"`;
        }

        // Try to click using the most reliable selector
        const element = page.locator(targetButton.selector).first();

        // Ensure element is visible and scroll if needed
        await element.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        // Click the button
        await element.click();
        await page.waitForTimeout(2000); // Wait for form submission

        return `Successfully clicked: "${buttonText}"`;
      } catch (error) {
        return `Failed to click button: ${error}`;
      }
    },
  });

  const analyzePageStructure = tool({
    name: "analyze_page_structure",
    description:
      "Analyze page structure and return form fields and buttons information",
    parameters: z.object({}),
    async execute() {
      if (!trackAction("analyze_page")) {
        return "Analysis blocked to prevent infinite loop.";
      }

      try {
        const url = await page.url();
        const title = await page.title();
        const fields = await getAllFormFields();
        const buttons = await getAllButtons();

        return {
          type: "json",
          json: {
            url,
            title,
            fields: fields.filter((f) => f.visible),
            buttons: buttons.filter((b) => b.visible),
            stats: {
              totalFields: fields.length,
              visibleFields: fields.filter((f) => f.visible).length,
              totalButtons: buttons.length,
              visibleButtons: buttons.filter((b) => b.visible).length,
            },
          },
        };
      } catch (error) {
        return `Analysis failed: ${error}`;
      }
    },
  });

  const validateField = tool({
    name: "validate_field",
    description: "Validate that a field contains expected value",
    parameters: z.object({
      fieldType: z.enum([
        "firstName",
        "lastName",
        "email",
        "password",
        "confirmPassword",
        "username",
        "custom",
      ]),
      expectedValue: z.string(),
      customSelector: z.string().nullable().optional(),
    }),
    async execute({ fieldType, expectedValue, customSelector }) {
      try {
        let locator;

        if (fieldType === "custom" && customSelector) {
          locator = page.locator(customSelector);
        } else {
          const fields = await getAllFormFields();
          const fieldMatchers: any = {
            firstName: (field: any) =>
              field.id?.includes("first") || field.name?.includes("first"),
            lastName: (field: any) =>
              field.id?.includes("last") || field.name?.includes("last"),
            email: (field: any) => field.type === "email",
            password: (field: any) =>
              field.type === "password" && !field.id?.includes("confirm"),
            confirmPassword: (field: any) =>
              field.type === "password" && field.id?.includes("confirm"),
            username: (field: any) =>
              field.id?.includes("user") || field.name?.includes("user"),
          };

          const targetField = fields.find((field: any) =>
            fieldMatchers[fieldType]?.(field)
          );
          if (!targetField) {
            return `No field found for validation: ${fieldType}`;
          }

          locator = targetField.id
            ? page.locator(`#${targetField.id}`)
            : targetField.name
            ? page.locator(`input[name="${targetField.name}"]`)
            : null;
        }

        if (!locator) {
          return `Unable to create locator for field: ${fieldType}`;
        }

        const actualValue = await locator.inputValue();
        const isValid = actualValue === expectedValue;

        return `Field ${fieldType} validation: Expected "${expectedValue}", Got "${actualValue}", Valid: ${isValid}`;
      } catch (error) {
        return `Validation failed for ${fieldType}: ${error}`;
      }
    },
  });

  const scrollPage = tool({
    name: "scroll_page",
    description: "Scroll the page to see more content",
    parameters: z.object({
      direction: z.enum(["up", "down"]).describe("Direction to scroll"),
      amount: z.number().default(500).describe("Pixels to scroll"),
    }),
    async execute({ direction, amount }) {
      try {
        const scrollY = direction === "down" ? amount : -amount;
        await page.mouse.wheel(0, scrollY);
        await page.waitForTimeout(500);
        return `Scrolled ${direction} by ${amount} pixels`;
      } catch (error) {
        return `Failed to scroll: ${error}`;
      }
    },
  });

  const websiteAutomationAgent = new Agent({
    name: "Sequential Form Automation Agent",
    model: "gpt-4o-mini",
    instructions: `
      You are a sequential form automation agent. Fill ONE field at a time and validate each field before proceeding.

      STRICT SEQUENTIAL WORKFLOW:
      1. Navigate to the URL using 'open_url'
      2. Analyze the page structure with 'analyze_page_structure'
      3. Take initial screenshot for reference
      4. Fill fields ONE AT A TIME in this exact order:
         - First call 'smart_fill_field' for firstName
         - Then call 'validate_field' for firstName
         - Then call 'smart_fill_field' for lastName
         - Then call 'validate_field' for lastName
         - Then call 'smart_fill_field' for email
         - Then call 'validate_field' for email
         - Then call 'smart_fill_field' for password
         - Then call 'validate_field' for password
         - Then call 'smart_fill_field' for confirmPassword
         - Then call 'validate_field' for confirmPassword
      5. After all fields are filled and validated, scroll down to click the "Create Account" button
      6. Click submit button using 'smart_click_button'

      BUTTON CLICKING RULES:
        - Before clicking "Create Account", ensure all fields are validated
        - Scroll DOWN to make the button visible before clicking
        - Wait for the button click to complete before ending
        - Do not close browser immediately after clicking
        - Wait to see if the form submission was successful

      CRITICAL RULES:
      - NEVER fill multiple fields in one turn
      - ALWAYS validate each field immediately after filling it
      - Use ONLY ONE tool call per response
      - Wait for validation success before proceeding to next field
      - If validation fails, retry filling that same field
      - Extract user data from query: First Name, Last Name, Email, Password
      - For confirmPassword, use the same value as password

      FIELD SEQUENCE (follow exactly):
      1. smart_fill_field firstName
      2. validate_field firstName  
      3. smart_fill_field lastName
      4. validate_field lastName
      5. smart_fill_field email
      6. validate_field email
      7. smart_fill_field password
      8. validate_field password
      9. smart_fill_field confirmPassword
      10. validate_field confirmPassword
      11. smart_click_button for submit

      ERROR HANDLING:
      - If any field validation fails, retry filling that specific field
      - Take screenshot only when there are issues
      - Do not proceed to next field until current field is validated successfully
    `,
    tools: [
      takeScreenShot,
      openURL,
      smartFillField,
      smartClickButton,
      analyzePageStructure,
      validateField,
      scrollPage,
    ],
  });

  try {
    const result = await run(websiteAutomationAgent, userPrompt, {
      maxTurns: MAX_TURNS,
    });

    console.log("\nAUTOMATION SUMMARY:");
    console.log(`- Turns used: ${automationState.turnCount}/${MAX_TURNS}`);
    console.log(
      `- Screenshots taken: ${automationState.screenshotCount}/${MAX_SCREENSHOTS}`
    );
    console.log("\nFinal Result:", result.finalOutput);
  } catch (error) {
    console.error("Automation failed:", error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
