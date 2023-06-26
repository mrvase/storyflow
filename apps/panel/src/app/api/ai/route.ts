import { Configuration, OpenAIApi } from "openai-edge";
import { OpenAIStream, StreamingTextResponse } from "ai";

export const runtime = "edge";

const apiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});

const openai = new OpenAIApi(apiConfig);

export async function POST(req: Request) {
  // Extract the `prompt` from the body of the request
  const { prompt: json } = await req.json();

  const { contextBefore, contextAfter, prompt, selection, documentContext } =
    JSON.parse(json) as {
      prompt: string;
      contextBefore: string;
      contextAfter: string;
      selection: string;
      documentContext: { label: string; value: string }[];
    };

  let system = "You are a helpful AI assistant that helps with text editing.";

  system += "\n\n";

  const hasDocContext = documentContext.length > 1;
  const hasText = contextBefore || contextAfter || selection;

  if (hasDocContext) {
    system +=
      "We are working on a document that consists of fields with labels and values. One particular fields is marked as the edited field. It is the text in this field we will work with.";

    system += "\n\n";

    system += "Here are the field labels and values:";

    system += "\n\n";

    system += documentContext
      .map(({ label, value }) => {
        const isEdited = value === "<edited field>";
        if (isEdited) {
          return `Label:\n${label} (EDITED FIELD)\nValue:\n${
            hasText ? "<see text below>" : "<empty>"
          }\n\n\n`;
        }
        return `Label:\n${label}\nValue:\n${value || "<empty>"}\n\n\n`;
      })
      .join("");
  }

  if (contextBefore || contextAfter) {
    system +=
      "You are provided with a piece of text" +
      (hasDocContext ? " that belongs to the edited field" : "");
    if (selection) {
      system +=
        " and two markers that indicate a selected part of the text. The markers are <selection> and </selection>. You ar also provided with a command. The command will typically ask you to do something with the selected text.";
    } else {
      system +=
        " and a position in the text marked by <cursor> that indicates a cursor position in the text. You are also provided with a command. The command will often ask you to do something at the cursor position.";
    }
  } else if (selection) {
    system +=
      " You are provided with a piece of text and a command. The command will typically ask you to do something with the text.";
  } else {
    system += " You are provided with a command.";
  }

  system += " Please do what the command says.";

  system += "\n\n";
  system += "Here are the rules:";

  let i = 1;

  system +=
    `\n${i++})` +
    "When responding to a command, do not include any additional text. E.g., do not say: 'Here is a reponse to your command'. Just do what the command says.";
  if (hasDocContext) {
    system +=
      `\n${i++})` +
      "ONLY edit the text in the edited field. Do not add text to any other empty fields.";
    system +=
      `\n${i++})` +
      "Do NOT add labels in your response. Do NOT add the label of the currently edited field. Do not add quote marks around your response.";
  }
  system +=
    `\n${i++})` +
    `It is very important that your response does not include any markers like ~~~${
      contextBefore || contextAfter
        ? selection
          ? " or <selection> or </selection>"
          : " or <cursor>"
        : ""
    }. These markers exist to help you understand the prompt, but DO NOT INCLUDE THEM IN YOUR RESPONSE.`;

  system +=
    `\n${i++})` +
    "If you think you cannot do what the command says, YOU MUST TRY. Do not ask for more context or more specific instructions. Trust your assumptions and do what the command says.";

  if (contextBefore || contextAfter) {
    if (selection) {
      system +=
        `\n${i++})` +
        "Do not include the whole text in your response. E.g. if the command is 'Make this piece of text happier', then your response should be a happier version of the SELECTED text, not the whole text.";
    } else {
      system +=
        `\n${i++})` +
        "Do not include the text in your response. E.g. if the command is 'Add a comma here', then your response should simply be ',' and not all the text with the comma added on the cursor position.";
    }
  }

  system += "\n\n";

  let content = "";

  if (hasText) {
    content += "Here is the text wrapped in start and end markers ~~~:";
    content += "\n";
    content += "~~~\n";

    if (contextBefore || contextAfter) {
      content += contextBefore;
      content += selection
        ? "<selection>" + selection + "</selection>"
        : "<cursor>";
      content += contextAfter;
    } else {
      content += selection;
    }

    content += "\n~~~";
    content += "\n\n";
  }

  content += "Here is the command wrapped in start and end markers ~~~:";
  content += "\n";
  content += "~~~\n";
  content += prompt;
  content += "\n~~~";

  console.log("CONTENT", system, content);

  // Request the OpenAI API for the response based on the prompt
  const response = await openai.createChatCompletion({
    model: "gpt-4",
    stream: true,
    // a precise prompt is important for the AI to reply with the correct tokens
    messages: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content,
      },
    ],
    max_tokens: 1000,
    temperature: 1,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  const stream = OpenAIStream(response);

  return new StreamingTextResponse(stream);
}
