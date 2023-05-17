import type {
  GetVariables,
  Modifiers,
  Translation,
  // TranslationFunction,
} from "./types";

export function replacePlaceholders<T extends string, M extends Modifiers>(
  str: T,
  vars: GetVariables<T, M>,
  modifiers?: M
): string {
  let output = "";

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "{" && str[i + 1] === "{") {
      let placeholder = "";
      i += 2;

      while (!(str[i] === "}" && str[i + 1] === "}")) {
        placeholder += str[i];
        i++;
      }

      const parts = placeholder.split(":");
      let value = vars[parts[0] as keyof typeof vars] as string | number;

      if (value !== undefined) {
        if (parts[1] && modifiers && parts[1] in modifiers) {
          value = modifiers[parts[1] as keyof typeof modifiers](value);
        }
        output += value;
      } else {
        output += "{{" + placeholder + "}}";
      }

      i++;
    } else if (str[i] === "|") {
      let iSaved = i;
      let options = [""];
      let optionIndex = 1;

      i--;
      while (str[i] !== "(") {
        options[0] = str[i] + options[0];
        i--;
      }

      output = output.slice(0, -1 * options[0].length - 1);

      i = iSaved;

      i++;
      while (str[i] !== ")") {
        if (str[i] === "|") {
          optionIndex++;
        } else {
          if (!options[optionIndex]) {
            options[optionIndex] = "";
          }
          options[optionIndex] += str[i];
        }
        i++;
      }

      let count = 0;
      if (
        vars &&
        typeof vars === "object" &&
        "count" in vars &&
        typeof vars["count"] === "number"
      ) {
        count = vars.count;
      }

      output += (count === 1 ? options[0] : options[1]) ?? "";
    } else {
      output += str[i];
    }
  }

  return output;
}

/*
export function createTranslation<
  const T extends Translation,
  M extends Modifiers
>(object: T, modifiers: M) {
  return new Proxy({} as TranslationFunction<T, M>, {
    get(_, namespace) {
      return new Proxy(
        {},
        {
          get(_, key) {
            const string = object[namespace as string][key as string];
            return (obj: any) => replacePlaceholders(string, obj, modifiers);
          },
        }
      );
    },
  });
}
*/
