import { createProcedure, createRoute } from "@sfrpc/server";
import { success } from "@storyflow/result";
import { z } from "zod";
import { globals } from "../globals";
import { Configuration, OpenAIApi } from "openai";
import util from "util";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
/*
const systemPrompt = `You are a programming assistant for users of a content management system.

The CMS consists of folders. Folders contain documents. Documents contain fields.

Folders can have a template of fields that the documents of the folder adheres to.

Given a prompt, you will recognize one or more actions that needs to be taken.

Possible actions are:

Create folder named "[name]"
Create folder template named "[name]" for folder "[name]"
Create folder template named "[name]" for folder "[name]" with fields [[field name 1], ...]
Create fields for folder template named "[name]" [[field name 1], ...]
Create document named ["name"] in folder "[name]"
Create document named ["name"] in folder "[name]" with fields { [field name 1]: [value], ... }
Create fields for document named "[name]" { [field name 1]: [value], ... }
Find document named "[name]"
Find document named "[name]" in folder "[name]"
Update document named "[name]" { [field name 1]: [value], ... }

Templates should be named the same as the folder but singular.

Your response should start and end with ~~~ and have the format:

~~~
[action]
[action]
~~~

Always respond with a list of one or more actions in between.`;
*/

const introduction = `You are a programming assistant that serves users of a CMS. You only respond with JSON.`;

const CMSRules = `Rules of the CMS:

* The CMS has folders.
* Folders contain documents.
* Documents contain fields.
* A folder has one document which is its template.
* All documents in the folder have the fields of the template.
* Folders that do not exist are created before a template is created.
* Templates should be named the same as the folder but in singular.
* Templates should not be created for folders that are websites.
* For folders that are websites only, assume that you have already created the template with fields "Titel", "Beskrivelse" and "URL" (URL is a slug of the title and specifies when a page is a subpage of another). Use this template when adding documents to websites.`;

const sharedRules = `Rules of the response:

* Begin your response with ~~~
* Write out the JSON.
* End your response with ~~~
* EXCLUDE any additional text. Do not add any additional text.
* Please identify one or more requested actions. An action is a JSON object of the following type:`;

const extendedActionFormat = `Action has the format
{
  type: "folder";
  label: string;
  category?: "website" | "app";
  action: { type: "create" | "delete" } | { type: "update"; label: string; };
}
or
{
  type: "template"
  folder: string;
  label: string;
  action: { type: "create"; fields: { name: string; type: string; label: string; }[]; } | { type: "update"; fields: { name: string; type: string; label: string; }[]; } | { type: "delete" }; | { type: "deleteFields", fields: string[] };
}
or
{
  type: "document";
  folder?: string;
  label: string;
  action: { type: "create"; fields: { name: string; value: string; }[]; } | { type: "update"; fields: { name: string; value: string; }[]; } | { type: "delete" }; | { type: "deleteFields", fields: string[] };
}

where field types can be "any", "string", "number", "boolean", "date", "markdown", "reference", or "image".

Dates are formatted as DD/MM/YYYY. The current date is 05/03/2023.

References are written as REF(<label>)`;

const extendedActionFormatArray = `Action has the format of an array of the following type:
["folder", <label: string>, <category: "folder" | "website" | "app">, <action: ["create"] | ["delete"] | ["update", <label: string;>]];
or
["template", <label: string>, <folder: string>, <action: ["create", <fields: [<name: string>, <label: string>][]>] | ["update", <fields: [<name: string>, <label: string>][]>]} | ["delete"] | ["deleteFields", <fields: <name: string>[]>]>];
or
["template", <label: string>, <folder: string | undefined>, <action: ["create", <fields: [<name: string>, <value: string>][]>] | ["update", <fields: [<name: string>, <value: string>][]>]} | ["delete"] | ["deleteFields", <fields: <name: string>[]>]>];`;

const specifiedFormat = `That is, your response should have the format:

~~~
[
  <action>,
  <action>
]
~~~`;

const ending = `TRUST YOUR ASSUMPTIONS.`;

/* */

const ignore = `* IGNORE requests for the values of fields. Do not add a "fields" props. Adhere to the type of the action.`;

const systemPrompt1 = `${introduction}

${CMSRules}

Existing content:

* Folders: Begivenheder, Ansatte, Nyheder, Forfattere

${sharedRules}

${extendedActionFormat}

${specifiedFormat}

${ending}
`;

/* */

const systemPrompt2 = `${introduction}

${CMSRules}

Existing content:

Folders:
Begivenheder (folder), Ansatte (folder), Nyheder (folder), Hjemmeside (website)

The template for Begivenheder has fields:
{ type: "string", label: "Titel" }
{ type: "string", label: "Beskrivelse" }
{ type: "string", label: "Dato" }
{ type: "string", label: "Arrangør" }, required, can be "Kirken" or "Frivillige",
{ type: "string", label: "Kategori" }, required, can be "Gudstjeneste" or "Event",

${sharedRules}

${extendedActionFormat}

${specifiedFormat}

${ending}`;

type ActionType =
  | "createFolder"
  | "createDocument"
  | "createFolderTemplate"
  | "createFieldsForFolderTemplate"
  | "createFieldsForDocument"
  | "findDocument"
  | "updateDocument";

type Action = {
  text: string;
  type: ActionType;
  label: string;
  folder?: string;
};

export const ai = createRoute({
  getActions: createProcedure({
    middleware(ctx) {
      return ctx.use(globals);
    },
    schema() {
      return z.object({
        prompt: z.string(),
        actions: z.array(z.string()).optional(),
      });
    },
    async query({ prompt }) {
      /*
      const content =
        actions && actions.length
          ? `Previous actions are:

${actions.join("\n")}

Do not include these in your response.

${prompt}
  `
          : prompt;
      */

      console.time("openai");

      const result1 = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: systemPrompt1,
              },
              {
                role: "user",
                content: `${prompt}

Ignorer anmodning om at udfylde felter i det ovenstående. Hvis du har svar på en sådan anmodning, slut svar med "Udfylder felter senere"`,
              },
            ],
          }),
        }
      )
        .then(async (res) => {
          const json = await res.json();
          console.log("RESPONSE", json);
          return json;
        })
        .then((res) => res.choices[0].message?.content);

      /*
      const result1 = await openai
        .createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: systemPrompt1,
            },
            {
              role: "user",
              content: `${prompt}

Ignorer anmodning om at udfylde felter i det ovenstående. Hvis du har svar på en sådan anmodning, slut svar med "Udfylder felter senere"`,
            },
          ],
        })
        .then((res) => res.data.choices[0].message?.content);
        */

      console.timeEnd("openai");

      if (!result1) return success([]);

      console.log(result1);

      const JSON1 = result1.replace(/[^~]*\~\~\~/, "").replace(/\~\~\~.*/, "");
      try {
        console.log(util.inspect(JSON.parse(JSON1), { depth: null }));
      } catch (err) {
        console.error("COULD NOT PARSE");
      }

      return success([]);
      /*
        console.time("openai");
        const result2 = await openai
          .createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: systemPrompt1,
              },
              {
                role: "user",
                content: `${prompt}

Ignorer anmodning om at udfylde felter i det ovenstående.`,
              },
              {
                role: "assistant",
                content: `~~~
${JSON1}
~~~`,
              },
              {
                role: "user",
                content:
                  "Udfyld nu efterspurgte eller påkrævede felter. Efterlad resterende felter tomme.",
              },
            ],
          })
          .then((res) => res.data.choices[0].message?.content);
        console.timeEnd("openai");

        console.log("AI RESULT 2", result2);

        if (!result2) return success([]);

        const JSON2 = result2
          .replace(/[^~]*\~\~\~/, "")
          .replace(/\~\~\~(.*)/, "");
      }
      */
      /*
      const newActions = list
        .split("\n")
        .filter((x) => x.trim().length > 0)
        .map((text) => {
          if (text.startsWith("Create folder named ")) {
            return {
              text,
              type: "createFolder",
              label: text.match(/Create folder named \"([^"]+)\"/)?.[1],
            };
          } else if (text.startsWith("Create document named ")) {
            const label = text.match(/Create document named \"([^"]+)\"/)?.[1];
            const document = {
              text,
              type: "createDocument",
              label,
              folder: text.match(/in folder \"([^"]+)\"/)?.[1],
            };
            if (text.includes("with fields")) {
              return [
                document,
                {
                  text,
                  type: "createFieldsForDocument",
                  label,
                },
              ];
            }
            return {
              text,
              type: "createDocument",
              label: text.match(/Create document named \"([^"]+)\"/)?.[1],
              folder: text.match(/in folder \"([^"]+)\"/)?.[1],
            };
          } else if (text.startsWith("Create folder template named ")) {
            const label = text.match(
              /Create folder template named \"([^"]+)\"/
            )?.[1];
            const template = {
              text,
              type: "createFolderTemplate",
              label,
              folder: text.match(/for folder \"([^"]+)\"/)?.[1],
            };

            if (text.includes("with fields")) {
              return [
                template,
                {
                  text,
                  type: "createFieldsForFolderTemplate",
                  label,
                },
              ];
            }
          } else if (
            text.startsWith("Create fields for folder template named ")
          ) {
            return {
              text,
              type: "createFieldsForFolderTemplate",
              label: text.match(
                /Create fields for folder template named \"([^"]+)\"/
              )?.[1],
            };
          } else if (text.startsWith("Create fields for document named ")) {
            return {
              text,
              type: "createFieldsForDocument",
              label: text.match(
                /Create fields for document named \"([^"]+)\"/
              )?.[1],
            };
          } else if (text.startsWith("Find document named ")) {
            const folder = text.match(/in folder \"([^"]+)\"/)?.[1];
            return {
              text,
              type: "findDocument",
              label: text.match(/Find document named \"([^"]+)\"/)?.[1],
              ...(folder && { folder }),
            };
          } else if (text.startsWith("Update document named ")) {
            return {
              text,
              type: "updateDocument",
              label: text.match(/Update document named \"([^"]+)\"/)?.[1],
            };
          }
          return undefined;
        })
        .flat(1)
        .filter((x): x is Action => Boolean(x));

      return success(newActions);
      */
    },
  }),
});

/*
Create folder named "[name]"
Create folder template named "[name]" for folder "[name]"
Create folder template named "[name]" for folder "[name]" with fields [[field name 1], ...]
Create fields for folder template named "[name]" [[field name 1], ...]
Create document named ["name"] in folder "[name]"
Create document named ["name"] in folder "[name]" with fields { [field name 1]: [value], ... }
Create fields for document named "[name]" { [field name 1]: [value], ... }
Find document named "[name]"
Find document named "[name]" in folder "[name]"
Update document named "[name]" { [field name 1]: [value], ... }
*/
