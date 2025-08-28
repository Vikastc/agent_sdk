# AI Agent for Browser Automation

An intelligent web automation agent that uses OpenAI's Agent SDK and Playwright to automatically fill forms and interact with web pages through natural language instructions.

## Features

- **Sequential Form Filling**: Automatically fills forms field by field with validation
- **Smart Field Detection**: Intelligently identifies form fields by labels, placeholders, and types
- **Loop Prevention**: Built-in safeguards against infinite loops and repeated actions
- **Screenshot Capture**: Takes screenshots for debugging and verification
- **Field Validation**: Validates each field after filling to ensure accuracy
- **Button Interaction**: Smart button clicking based on text content

## Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- OpenAI API key

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd agent_sdk
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

```bash
# Add your OpenAI API key to .env
OPENAI_API_KEY=your_openai_api_key_here
```

4. Install Playwright browsers:

```bash
npx playwright install
```

## Usage

1. Build the project:

```bash
pnpm build
```

2. Run the automation:

```bash
pnpm start
```

3. Enter your automation query when prompted. Example:

```
Enter the query: Fill the signup form at https://example.com/signup with John Doe, john@example.com, and password123
```

## Supported Operations

### Form Automation

- **Field Types**: firstName, lastName, email, password, confirmPassword, username, phone, address
- **Smart Filling**: Automatically detects and fills appropriate fields
- **Validation**: Verifies field values after filling

### Page Interactions

- **Navigation**: Opens URLs and waits for page load
- **Screenshots**: Captures page state for debugging
- **Button Clicking**: Finds and clicks buttons by text content
- **Page Analysis**: Analyzes form structure and available elements
- **Scrolling**: Scrolls page to reveal hidden elements

## Configuration

### Limits

- **Max Turns**: 25 automation steps
- **Max Screenshots**: 3 screenshots per session
- **Loop Prevention**: Blocks repeated actions after 2 attempts

### Browser Settings

- Runs in non-headless mode for visibility
- Viewport: 1280x720
- Network idle wait for stable page loads

## Example Queries

```bash
# Simple form filling
"Create account on https://example.com/register with name John Smith, email john@test.com, password mypass123"

# Complex form with validation
"Fill registration form at https://site.com/signup - First: Jane, Last: Doe, Email: jane@example.com, Password: secure123"
```

## Architecture

The agent follows a strict sequential workflow:

1. **Navigation** → Open target URL
2. **Analysis** → Analyze page structure
3. **Screenshot** → Capture initial state
4. **Sequential Filling** → Fill and validate each field
5. **Submission** → Click submit button
6. **Completion** → Wait for result

## Error Handling

- **Field Not Found**: Tries alternative selectors
- **Validation Failure**: Retries field filling
- **Network Issues**: Handles timeouts gracefully
- **Loop Detection**: Prevents infinite automation cycles

## Development

### Scripts

```bash
pnpm dev     # Build and run in development
pnpm build   # Compile TypeScript
pnpm start   # Run compiled version
```

### Key Files

- `browser.ts` - Main automation logic
- `package.json` - Dependencies and scripts
- `.env` - Environment configuration

## Troubleshooting

**Common Issues:**

1. **OpenAI API Key Missing**

   - Ensure `.env` file contains valid `OPENAI_API_KEY`

2. **Playwright Browser Not Found**

   - Run `npx playwright install`

3. **Form Fields Not Detected**

   - Check if fields are visible and properly labeled
   - Use custom selectors for complex forms

4. **Screenshots Not Saving**
   - Verify write permissions in project directory

## Limitations

- Maximum 25 automation steps per session
- Limited to 3 screenshots for debugging
- Requires visible form elements (no shadow DOM support)
- Works best with standard HTML forms

# Youtube (Video Demo)
https://youtu.be/__P-O0OOdIA
