import React from "react";
import { useContextWithError } from "../utils/contextError";
import type { Modifiers, Translation, TranslationFunction } from "./types";
import { replacePlaceholders } from "./placeholders";
import { en } from "./languages/en";

const createModifiers = ({
  numerals,
  ordinals,
}: {
  numerals: Record<number, string>;
  ordinals: Record<number | "defaultSuffix", string>;
}) => {
  return {
    number: (value: number) => value,
    numeral: (value: number) => {
      return numerals[value] ?? value;
    },
    ordinal: (value: number) => {
      return ordinals[value] ?? `${value}${ordinals.defaultSuffix}` ?? value;
    },
  } satisfies Modifiers;
};

type BaseModifiers = ReturnType<typeof createModifiers>;
type BaseTranslation = typeof en;

const TranslationContext = React.createContext<TranslationFunction<
  BaseTranslation,
  BaseModifiers
> | null>(null);

export function TranslationProvider({
  children,
  lang = "en",
}: {
  children: React.ReactNode;
  lang?: "en" | "da";
}) {
  // TODO it is possible that there will be a flash of english text,
  // but unlikely since it has to handle the slower process of auth
  // before rendering any text.

  // only to push re-render on load
  const [isLoaded, setIsLoaded] = React.useState(false);

  const translation = React.useRef<
    Translation & {
      numerals: Record<number, string>;
      ordinals: Record<number | "defaultSuffix", string>;
    }
  >(en);

  React.useLayoutEffect(() => {
    if (lang === "en") {
      setIsLoaded(true);
    }

    import(`./languages/${lang}.ts`)
      .then((mod) => {
        translation.current = mod[lang];
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, [lang]);

  const modifiers = React.useMemo(() => {
    return createModifiers(translation.current);
  }, []);

  const t = React.useMemo(() => {
    return new Proxy(
      {} as TranslationFunction<BaseTranslation, BaseModifiers>,
      {
        get(_, namespace) {
          return new Proxy(
            {},
            {
              get(_, key) {
                const string =
                  translation.current?.[namespace as string]?.[key as string];
                return (obj: any) => {
                  return replacePlaceholders(string, obj, modifiers);
                };
              },
            }
          );
        },
      }
    );
  }, [isLoaded]);

  return (
    <TranslationContext.Provider value={t}>
      {children}
    </TranslationContext.Provider>
  );
}

export const useTranslation = <
  T extends Translation = BaseTranslation,
  M extends Modifiers = {}
>() => {
  return useContextWithError(
    TranslationContext,
    "TranslationContext"
  ) as TranslationFunction<T, BaseModifiers & M>;
};
