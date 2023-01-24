import { Narrow, Operators } from "./types";
import {
  ComputationBlock,
  FlatComputation,
  DBDocument,
  FieldId,
  FieldImport,
  FunctionName,
  Operator,
  FlatFieldImport,
  DocumentId,
} from "@storyflow/core/types";

type Accummulator = {
  value: FlatComputation[];
  stack: FlatComputation[][];
  imports: FieldId[];
  function: FlatComputation;
};

const calculateCombinations = (
  $: Operators<DBDocument>,
  value: FlatComputation[]
) => {
  return $.reduce(
    value,
    (combinations, array) =>
      $.reduce(
        array,
        (result, element) =>
          $.concatArrays(
            result,
            $.map(combinations, (combination) =>
              $.concatArrays([], combination, [element])
            )
          ),
        [] as FlatComputation[]
      ),
    [[]] as FlatComputation[]
  );
};

const compute = (
  $: Operators<DBDocument>,
  operator:
    | Operator
    | "["
    | "]"
    | "("
    | ")"
    | "n"
    | FunctionName
    | "merge"
    | null,
  acc: Accummulator
) =>
  $.mergeObjects(acc, {
    value: $.concatArrays(
      $.last(acc.stack),
      $.switch()
        .case($.eq(operator, null), () => [
          $.reduce(
            acc.value,
            (acc, cur) =>
              $.reduce(cur, (acc, cur) => $.concatArrays(acc, [cur]), acc),
            [] as FlatComputation
          ),
        ])
        .case($.eq(operator, "merge"), () => [
          $.filter(
            $.reduce(
              acc.value,
              (acc, cur) =>
                $.reduceWithIndex(
                  cur,
                  (acc, cur, index) =>
                    $.cond(
                      $.in($.type(cur), ["object", "array"]),
                      () =>
                        $.cond(
                          $.eq($.last(acc), ""),
                          () => acc,
                          () => $.concatArrays(acc, [""])
                        ),
                      () =>
                        $.cond(
                          $.gt(index, 0),
                          () =>
                            $.concatArrays(acc, [$.toString(cur as string)]),
                          () =>
                            $.concatArrays($.pop(acc), [
                              $.concat($.last(acc), $.toString(cur as string)),
                            ])
                        )
                    ),
                  acc
                ),
              [""] as string[]
            ),
            (el) => $.ne(el, "")
          ),
        ])
        .case($.eq(operator, "sum"), () => [])
        .case($.eq(operator, "filter"), () => [])
        .default(() =>
          $.define()
            .let({
              combinations: calculateCombinations($, acc.value),
            })
            .return(({ combinations }) =>
              $.switch()
                .case($.eq(operator, "in"), () => [
                  [
                    $.reduce(
                      combinations,
                      (acc, values) =>
                        $.or(acc, $.eq($.at(values, 0), $.at(values, 1))),
                      false
                    ),
                  ],
                ])
                .case($.eq(operator, "concat"), () => [
                  $.reduce(
                    combinations,
                    (acc, values) =>
                      $.concatArrays(
                        acc,
                        $.reduce(
                          values,
                          (acc, cur) =>
                            $.cond(
                              $.and(
                                $.or(
                                  $.isNumber(cur),
                                  $.eq($.type(cur), "string")
                                ),
                                $.or(
                                  $.isNumber($.last(acc)),
                                  $.eq($.type($.last(acc)), "string")
                                )
                              ),
                              () =>
                                $.concatArrays($.pop(acc), [
                                  $.concat(
                                    $.toString($.last(acc)),
                                    $.toString(cur)
                                  ),
                                ]),
                              () => $.concatArrays(acc, [cur])
                            ),
                          [] as FlatComputation
                        )
                      ),
                    [] as FlatComputation
                  ),
                ])
                .case($.in(operator, ["url", "slug"]), () => [
                  $.map(combinations, (values) =>
                    $.toLower(
                      $.reduce(
                        values,
                        (acc, cur) =>
                          $.concat(
                            acc,
                            $.switch()
                              .case($.isNumber(cur), () => $.toString(cur))
                              .case($.eq($.type(cur), "string"), () =>
                                $.concat(
                                  $.cond(
                                    $.and(
                                      $.eq(operator, "url"),
                                      $.ne(cur, ""),
                                      $.ne(acc, "")
                                    ),
                                    () => "/",
                                    () => ""
                                  ),
                                  replaceAllWithRegex(
                                    $,
                                    cur as string,
                                    $.cond(
                                      $.eq(operator, "url"),
                                      () => "[^\\w\\-\\*\\/]",
                                      () => "[^\\w\\-]"
                                    ),
                                    "i"
                                  )
                                )
                              )
                              .default(() => "")
                          ),
                        ""
                      )
                    )
                  ),
                ])
                .case($.eq(operator, "="), () => [
                  $.map(combinations, (values) =>
                    $.eq($.at(values, 0), $.at(values, 1))
                  ),
                ])
                .case($.in(operator, ["+", "-"]), () => [
                  $.map(combinations, (values) =>
                    $.reduce(
                      $.slice(values, 1),
                      (a, c) =>
                        $.switch()
                          .case($.eq(operator, "+"), () =>
                            $.add([a, $.number(c)])
                          )
                          .case($.eq(operator, "-"), () =>
                            $.subtract([a, $.number(c)])
                          )
                          .default(() => a),
                      $.number($.first(values))
                    )
                  ),
                ])
                .case($.in(operator, ["*", "/"]), () => [
                  $.map(combinations, (values) =>
                    $.reduce(
                      $.slice(values, 1),
                      (a, c) =>
                        $.switch()
                          .case($.eq(operator, "*"), () =>
                            $.multiply([a, $.number(c, 1)])
                          )
                          .case($.eq(operator, "/"), () =>
                            $.divide([a, $.number(c, 1)])
                          )
                          .default(() => a),
                      $.number($.first(values), 1)
                    )
                  ),
                ])
                .default(() => combinations)
            )
        )
    ),
    stack: $.pop(acc.stack),
  });

type Middleware = {
  (...args: any): any;
  this: Operators<DBDocument>;
};

const isObjectWithProp = <Object, Prop extends string>(
  $: Operators<DBDocument>,
  object: Object,
  prop: Prop,
  type: string
): boolean => {
  return $.cond(
    $.eq($.type(object), "object"),
    () => {
      return $.eq($.type((object as any)[prop]), type);
    },
    () => false
  );
};
const isArrayWithFirstElement = <Object, Prop extends string>(
  $: Operators<DBDocument>,
  object: Object,
  type: any
): boolean => {
  return $.cond(
    $.isArray(object),
    () => {
      return $.eq($.first(object as Narrow<Object, any[]>), type);
    },
    () => false
  );
};

const slugCharacters = [
  [" ", "-"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
];

const replaceAllWithRegex = (
  $: Operators<DBDocument>,
  string: string,
  regex: string,
  options: string
) => {
  return $.reduce(
    $.regexFindAll(string, regex, options),
    (acc, cur) =>
      $.replaceOne(
        acc,
        cur.match,
        $.define()
          .let({
            repl: $.filter(slugCharacters, (ref) =>
              $.eq(cur.match, $.first(ref))
            ),
          })
          .return(({ repl }) =>
            $.cond(
              $.eq($.size(repl), 1),
              () => $.last($.first(repl)),
              () => ""
            )
          )
      ),
    string
  );
};

export const calculate = (
  $: Operators<DBDocument>,
  block: ComputationBlock,
  imports: ComputationBlock[]
) => {
  return $.define()
    .let({
      result: $.reduce(
        block.value,
        (acc, cur) => {
          // håndter import generators ("pick" og layout element props)
          // håndter imports / parameters
          // håndter beregninger

          return $.define()
            .let({ pick: isArrayWithFirstElement($, cur, "p") })
            .let(({ pick }) => ({
              next: $.switch()
                .case(isObjectWithProp($, cur, "type", "string"), () =>
                  $.concatArrays(
                    [["("], ""] as FlatComputation,
                    $.reduce(
                      (cur as any).props,
                      (acc, el: string) =>
                        $.concatArrays(acc, [
                          {
                            fref: $.concat((cur as any).id, "/", el),
                          } as FlatFieldImport,
                        ]),
                      [] as FlatComputation
                    ),
                    ["", [")"]] as FlatComputation
                  )
                )
                .case(pick, () =>
                  $.concatArrays(
                    [["("]] as FlatComputation,
                    $.reduce(
                      acc.value,
                      (acc, comp) =>
                        $.reduce(
                          comp,
                          (acc, el) =>
                            $.cond(
                              isObjectWithProp($, el, "dref", "string"),
                              () =>
                                $.concatArrays(acc, [
                                  {
                                    fref: $.concat(
                                      (
                                        el as Narrow<
                                          typeof el,
                                          { dref: DocumentId }
                                        >
                                      ).dref,
                                      $.last(
                                        cur as Narrow<typeof cur, ["p", any?]>
                                      )
                                    ),
                                  } as FieldImport,
                                ]),
                              () => acc
                            ),
                          acc
                        ),
                      [] as FlatComputation
                    ),
                    [[")"]] as FlatComputation
                  )
                )
                .default(() => [cur]),
              acc: $.cond(
                pick,
                () =>
                  $.mergeObjects(acc, {
                    value: $.last(acc.stack),
                    stack: $.pop(acc.stack),
                  }),
                () => acc
              ),
            }))
            .return(({ next, acc }) =>
              $.reduce(
                next,
                (acc, cur) =>
                  $.define()
                    .let({
                      imp: $.cond(
                        isObjectWithProp($, cur, "fref", "string"),
                        () => cur as FieldImport,
                        () => null
                      ),
                    })
                    .let(({ imp }) => ({
                      args: $.cond(
                        $.toBool(imp),
                        () =>
                          $.map(
                            $.range(0, 2),
                            (index) =>
                              $.find(imports, (el) =>
                                $.eq(
                                  el.id,
                                  $.concat(
                                    (imp as FieldImport).id,
                                    "/",
                                    $.toString(index)
                                  )
                                )
                              ) as ComputationBlock & {
                                result: FlatComputation;
                                function: FlatComputation;
                              }
                          ),
                        () => [null]
                      ),
                      importedField: $.cond(
                        $.toBool(imp),
                        () =>
                          $.find(imports, (el) =>
                            $.eq(el.id, (imp as FieldImport).fref)
                          ) as ComputationBlock & {
                            result: FlatComputation;
                            function: FlatComputation;
                          },
                        () => null
                      ),
                    }))
                    .let(({ importedField, args }) => ({
                      next: $.cond(
                        $.toBool(importedField),
                        () =>
                          $.concatArrays(
                            [["("]] as FlatComputation,
                            $.cond(
                              $.anyElementTrue(args),
                              () =>
                                $.getField(
                                  importedField as Exclude<
                                    typeof importedField,
                                    null
                                  >,
                                  "function"
                                ),
                              () =>
                                $.getField(
                                  importedField as Exclude<
                                    typeof importedField,
                                    null
                                  >,
                                  "result"
                                )
                            ),
                            [[")"]] as FlatComputation
                          ),
                        () => [cur] as FlatComputation
                      ),
                    }))
                    .return(({ imp, args, next }) =>
                      $.mergeObjects(
                        $.reduce(
                          next,
                          (acc, cur) =>
                            $.cond(
                              $.isArray(cur),
                              () => {
                                const curArr = cur as Narrow<typeof cur, any[]>;
                                return (
                                  $.switch()
                                    // if [number]:
                                    .case($.isNumber($.first(curArr)), () =>
                                      $.define()
                                        .let({
                                          arg: $.at(
                                            args,
                                            $.first(curArr) as number
                                          ),
                                        })
                                        .return(({ arg }) =>
                                          $.mergeObjects(acc, {
                                            value: $.concatArrays(
                                              acc.value,
                                              $.switch()
                                                .case($.toBool(arg), () => [
                                                  arg!.result,
                                                ])
                                                .case(
                                                  $.ne(
                                                    $.type($.at(curArr, 1)),
                                                    "missing"
                                                  ),
                                                  () => [[$.at(curArr, 1)!]]
                                                )
                                                .default(() => [])
                                            ),
                                          })
                                        )
                                    )
                                    // if ["n"]: IGNORE
                                    .case($.eq($.first(curArr), "n"), () => acc)
                                    // if ["("] or ["["]: STACK
                                    .case(
                                      $.in($.first(curArr), ["(", "{"]),
                                      () =>
                                        $.mergeObjects(acc, {
                                          stack: $.concatArrays(acc.stack, [
                                            acc.value,
                                          ]),
                                          value: [],
                                        })
                                    )
                                    // if [")"] or ["]"]: OPERATE
                                    .case(
                                      $.in($.first(curArr), [")", "}"]),
                                      () =>
                                        $.define()
                                          .let({
                                            operator: $.cond(
                                              $.gt($.size(curArr), 1),
                                              () =>
                                                $.last(
                                                  cur as Narrow<
                                                    typeof cur,
                                                    [")" | "}", any]
                                                  >
                                                ),
                                              () =>
                                                $.cond(
                                                  $.eq($.first(curArr), "}"),
                                                  () => "merge" as "merge",
                                                  () => null
                                                )
                                            ),
                                          })
                                          .return(({ operator }) =>
                                            compute($, operator, acc)
                                          )
                                    )
                                    .default(() =>
                                      $.mergeObjects(acc, {
                                        value: $.concatArrays(acc.value, [
                                          [
                                            $.first(
                                              cur as Narrow<typeof cur, any[]>
                                            ),
                                          ],
                                        ]),
                                      })
                                    )
                                );
                              },
                              () =>
                                $.mergeObjects(acc, {
                                  value: $.concatArrays(acc.value, [
                                    $.cond(
                                      isObjectWithProp(
                                        $,
                                        cur,
                                        "filters",
                                        "array"
                                      ),
                                      () => [],
                                      () => [cur]
                                    ),
                                  ]),
                                })
                            ),
                          acc
                        ),
                        {
                          imports: $.setUnion(
                            acc.imports,
                            [$.ifNull(imp?.fref, "")],
                            $.reduce(
                              $.range(0, 2),
                              (acc, index) =>
                                $.cond(
                                  $.toBool($.at(args, index)),
                                  () =>
                                    $.concatArrays(acc, [
                                      $.concat(
                                        (imp as FieldImport).id,
                                        "/",
                                        $.toString(index)
                                      ),
                                    ]),
                                  () => acc
                                ),
                              [] as string[]
                            )
                          ),
                          function: $.concatArrays(acc.function, next),
                        }
                      )
                    ),
                acc
              )
            );
        },
        {
          value: [],
          stack: [],
          imports: [],
          function: [],
        } as Accummulator
      ),
    })
    .return(({ result }) => ({
      result: $.reduce(
        result.value,
        (acc, cur) => $.concatArrays(acc, cur),
        [] as FlatComputation
      ),
      imports: result.imports,
      function: result.function,
    }));
};
