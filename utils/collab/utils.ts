import {
  TimelineEntry,
  QueueEntry,
  TransactionEntry,
  Transaction,
  SpliceOperation,
  ToggleOperation,
  VersionRecord,
  CollabVersion,
} from "./types";

export function read<TE extends TransactionEntry = TransactionEntry>(
  entry: TimelineEntry
) {
  return {
    queue: entry[0],
    prev: entry[1],
    user: entry[2],
    transactions: entry.slice(3) as Transaction<TE>[],
  };
}

export function getId(entry: TimelineEntry): string;
export function getId(entry: undefined): null;
export function getId(entry: TimelineEntry | undefined): string | null {
  if (!entry) return null;
  const { prev, user, queue } = read(entry);
  return `${prev}-${user}-${queue}`;
}

export const getTransactionId = (t: QueueEntry) => {
  if (t.transactionIndex === null) {
    // if it is waiting to be merged
    return null;
  }
  return `${t.timelineIndex ?? ""}${t.prev}${t.queue}${t.transactionIndex}`;
};

export const createQueueFromTimeline = <
  TE extends TransactionEntry = TransactionEntry
>(
  entries: TimelineEntry[],
  options: {
    includeTimelineIndex?: boolean;
    trackers?: WeakMap<Transaction, WeakSet<object>>;
  } = {}
): QueueEntry<TE>[] => {
  const queueEntries: QueueEntry<TE>[] = [];

  entries.forEach((el: TimelineEntry, timelineIndex_: number) => {
    const { transactions, ...metadata } = read(el);
    const timelineIndex = options.includeTimelineIndex ? timelineIndex_ : null;

    transactions.forEach((transaction, transactionIndex) => {
      queueEntries.push({
        ...metadata,
        timelineIndex,
        transactionIndex,
        transaction: transaction as Transaction<TE>,
        trackers: options.trackers?.get(transaction),
      });
    });
  });

  return queueEntries;
};

/*
A very important function that ensures consistency of the queue.

If I have a queue with indexes 1 [seen 0], 2 [seen 1], 3 [seen 2], 4 [seen 3], 5 [seen 4].
And someone saves at index 2 [seen 1].
Then the version is 2.
So I can keep 3, 4, and 5.

If I have a queue with indexes 1 [seen 0], 2 [seen 1], 3 [seen 2], 4 [seen *1*], 5 [seen 4].
And someone saves at index 2 [seen 1].
Then the version is 2.
So I can keep 3.
But I cannot keep 4! - the state cannot be determined, since we do not know the state at 1.
So I cannot keep 5 either since it needs to know the state of 4.
Everything that is editing on top of 4 and 5 cannot be used.

We could then just filter them out:
The first package that has seen the current version is kept and defines the next index.
The next package that has seen either the current version or the first package is kept and defines the next index.
And so on...

But then some future packages take the indexes of the packages that were filtered out.

we push x [seen 3].
is x = 4 or 6?

What if some stale queue thinks it pushes 6 [seen 3].
- what I though for a moment: it could then push 7 [seen 6].
- but it would not do that. "6" dos not have that index before it has been fetched from the server.
- but when it is fetched from the server, the queue now knows it is stale.
- so it does the filtering. And it makes it 4 [seen 3].

so to answer the question. it is x!
But when it goes through the server, it becomes something.

what about
1 [seen 0], 2 [seen 1], 3 [seen 2], 4 [seen *1*], 5 [seen 3], 6 [seen 5]
save at 2 [seen 1].
3 is okay. 4 is not, 5 is okay. and 6??
It has seen 4, but 4 is a lost state.

what about
1 [seen 0], 2 [seen 1], [3 seen *1*], 4 [seen 2], 5 [seen 4]
save at 2 [seen 1].
3 is lost, 4 is okay.
but 5 is not okay.

So the first package seeing the version takes the first index.
As soon as a package is lost, any package seeing that or a higher index is lost.
So there is no need to correct the indexes.

but if the next package is [seen 3]
how do I know if it is referring to 3 or 4 (corrected to 3 after save)

THIS IS WHY WE INTRODUCE VERSION NUMBER INTO THE TIMELINE ENTRIES THEMSELVES

Different versions create different branches of events.

Strategy:
- items with the same version number as the current are always kept
- items with lower version number that has seen the exact version number is kept

Impossible state: an item with
- a lower version number
- a higher seen index
- no path directly to the version number

1 [0@0], 2 [seen 1@0], 3 [seen 2@0], 4 [seen 2@0], 5 [seen 4@0]
If I save at 2 like this
1 [0@0], 2 [1@0], 3 [2@2], 4 [2@0], 5 [4@0]
This is not possible. You cannot see 4 and push at version 0.

It could be like this
1 [0@0], 2 [1@0], 3 [2@0], 4 [3@0], 5 [2@2]
All are saved

This
1 [0@0], 2 [1@0], 3 [1@0], 4 [3@0], 5 [2@2]
3 is lost, so 4 is lost

This
1 [0@0], 2 [1@0], 3 [2@0], 4 [1@0], 5 [4@0], 6 [2@2]
4 is lost, so 5 is lost, 6 is saved by version number

This
1 [0@0], 2 [1@0], 3 [2@0], 4 [1@0], 5 [3@0], 6 [2@2]
3 is saved, 4 is lost, but 5 is saved

Jeg har en forældet kø, og får et nyt versionsnummer.

Hvordan kan jeg finde det sande index?
Jeg skal kunne afgøre, hvilket element, der er det næste, uanset om jeg har en forældet kø eller ej.
Det sidst gemte element kan ikke have set versionsnummeret.
Hvis den er forældet, så kan jeg have det gemte element et sted.

Lad os sige, det her er objektivt:
1 [0@0], 2 [1@0], 3 [2@0], 4 [1@0], 5 [3@0], 6 [2@2]

jeg har:
[0@0], [1@0], [2@0], [1@0], [3@0], [2@2]
gemmer ved 2. tredje element har set 2. Er det så objektivt nummer 3?

Problemet:
Får nyt dokument, men gammel kø.

[0@0], [1@0], [1@0], [2@0], _[3@0]_, [2@2]
dokument gemt ved 2. nu er det først fjerde element, der har set 2. Men det bliver så nummer 3? Men det markerede element har faktisk set den før og er ugyldig

Hvis jeg gemmer bruger, kan jeg afgøre, hvilken det er.

Hvad med det omvendte
Gammel dokument, ny kø

[0@0], [1@0], [1@0], [0@0], [4@0], [2@0], [3@0]
gemmer ved 2. Har modtaget
[1@0], [0@0], [4@0], [2@0], [3@0]
Nu kan jeg bruge de her levn. Alt ser normalt ud.

- eller ikke: Hvis jeg er på 0, kan den første ikke have set 1. Noget er blevet slettet.

[0@0], [1@0], [0@0], [0@0], [2@0]
gemmer ved 2. Får
[0@0], [0@0], _[2@0]_
den sidste har ikke set de to forinden. Men det ligner det her.
*/

/*




Antagelser:
- hvis en queue har opdateret sin version, så der er en "død" pakke, så vil pakker, der tilføjes under det versionsnummer, ikke se den.
- efterfølgende pakker kan ikke se pakker, der er tilføjet under et højere versionsnummer, uden selv at blive opdateret.
  - For når man henter den højere pakke, vil startpakker ikke længere passe. (der er nogle 100 millisekunder mellem at et dokument gemmes og en kø opdateres - er det et problem kan jeg overveje at tilføje versionsnummer)
- derfor kan jeg vide, at efterfølgende filters ikke kan undgå at regne en pakke for død, når der er senere pakker, der også gør det.


Begreber (indeksering):
- Versionspakke: Den sidste pakke, der er gemt, og som definerer den aktuelle version.
- Forsinket pakke: pakke, der er pushet efter en versionspakke (og er indekseret efter), men stadig er på gammel version.
- Forældet pakke: pakke, hvis egen indeksering er før versionspakken (dvs. den er blevet slettet).
- Aktiv pakke: pakke, hvis egen indeksering er efter versionspakken (dvs. den er blevet slettet).
- Indledende pakke: pakke, hvis indeksering er lige efter versionspakken.

Begreber (referencer):
- Skyggepakke: En pakke, hvis reference indekserer lavere end den nuværende versionspakke.
- Direkte pakke: Pakke der refererer til versionspakken.
- Indirekte pakke: Pakke, hvis "synslinje" fører tilbage til versionspakken.
- Afkoblet pakke: Pakke, der er ikke kan føres tilbage til versionspakken

- Forældet kø: indeholder forældede pakker

Teser:
- Når kø og dokument er i sync er det altid første pakke, der er den indledende pakke (fordi vi altid sletter fast antal pakker).
- Hvis kø indeholder en direkte pakke, indeholder den også den indledende pakke (eller også er den direkte pakke forældet).
- Hvis der er en afkoblet pakke, så er dokumentet forældet (stale).
- Hvis dokumentet er forældet, indeholder en up-to-date kø kun forsinkede eller afkoblede pakker relativt til dokumentets version.

Find indledende pakke:

Forældet kø:
- er versionspakken i køen, er køen forældet, men næste pakke er indledende
- er pakker alle fra før versionspakken, vil de alle være skygger. men er de alle skygger, er køen ikke nødvendigvis forældet (pga. forsinkede pakker).
- det kan ikke lade sig gøre, at alle pakker er fra efter versionspakken, for så er versionspakken slettet, og så kan køen ikke være forældet

=> Hvis versionspakken ikke i køen, og hvis ikke alle pakker er skygger, er køen ikke forældet.

Vi håndterer de to cases:
- *case 1*: er versionspakken i køen, så filtrerer vi op til og inklusiv den, og den første bliver vores indeks.
  - INDEX FUNDET!
- *case 2*: hvis alle pakker er skygger, kan vi upropblematisk returnere en tom kø, så vi refererer til versionen.
  - INDEX FUNDET!
  - selvom skyggerne er en del af køen, er der ikke behov for dem her ift. referencer. Det bliver der. Men under sync hentes køen igen, og vi får en ikke-forældet kø.

Forældet dokument:
- *case 3*: Hvis der er pakker, der refererer over versionen, så er de afkoblede (og så kan jeg konkludere staleness)
  - hvis vi går ud fra, at første pakke er indledende pakke, finder vi egentlig bare en afkoblet pakke ved, at den refererer over sit index.
  - 
  - returnerer tom kø?
- (*) Hvis der er pakke, der faktisk refererer til versionen, så er de i virkeligheden skygger
  - DEN UKLARE CASE! Vil forveksles med up-to-date.
  - behandles som up-to-date.
    - INDEX FUNDET.
  - Hvis jeg pusher på de skyggepakker, så bliver de selv skygger (men jeg kender jo ikke deres indeks. Jeg pusher bare lidt random)

Up-to-date:
- Antager vi, at vi er endt på up-to-date kø, er første pakke vores index!
  - INDEX FUNDET.
  - der kan stadig være skyggepakker, men vi tæller index fra den første pakke.
- Når vi pusher på en direkte pakke ovenpå de skyggepakker, så ved vi, at den ikke har talt de skyggepakker med. (Se antagelser)


*/

export function filterTimeline(
  timelines: TimelineEntry[][],
  versions: VersionRecord | CollabVersion | null
) {
  if (versions === null) {
    return timelines;
  }

  let queueMap = new Map<
    string,
    {
      version: CollabVersion;
      index: number;
      elements: TimelineEntry[];
      shadows: Set<number>;
      allAreShadows: boolean;
    }
  >();

  const getData = (queue: string) => {
    let exists = queueMap.get(queue);
    if (!exists) {
      const version = Array.isArray(versions)
        ? versions
        : versions[queue] ?? [0];
      exists = {
        version,
        index: version[0] + 0,
        elements: [],
        shadows: new Set(),
        allAreShadows: true,
      };
      queueMap.set(queue, exists);
    }
    return exists;
  };

  let newTimelines = timelines.map(() => [] as TimelineEntry[]);

  let isDecoupled = false;

  timelines.forEach((entries, i) => {
    if (isDecoupled) return;

    let timeline = newTimelines[i];

    entries.forEach((el) => {
      if (isDecoupled) return;

      const { prev, queue, user } = read(el);
      const data = getData(queue);
      data.elements.push(el);

      isDecoupled = prev > data.index;
      if (isDecoupled) return;

      const isVersionEntry =
        prev === data.version[1] && user === data.version[2];

      if (isVersionEntry) {
        newTimelines.forEach((arr) => (arr.length = 0));
        data.index = 0;
        return;
      }

      const isShadow = prev < data.version[0] || data.shadows.has(prev);

      if (isShadow) {
        timeline.push([queue, prev, user]); // transactions removed
        data.shadows.add(data.index);
      } else {
        data.allAreShadows = false;
        timeline.push(el);
      }
      data.index++;
    });
  });

  if (isDecoupled) {
    newTimelines.forEach((arr) => (arr.length = 0));
    return newTimelines;
  }

  const filteredShadows: TimelineEntry[] = [];

  for (let [, data] of queueMap) {
    if (data.allAreShadows && data.elements.length) {
      filteredShadows.push(...data.elements);
    }
  }

  if (filteredShadows.length) {
    newTimelines = newTimelines.map((arr) =>
      arr.filter((el) => !filteredShadows.includes(el))
    );
  }

  return newTimelines;
}

export const isSpliceOperation = (
  action: unknown
): action is SpliceOperation<any> => {
  return (
    Array.isArray(action) &&
    typeof action[0] === "number" &&
    (action.length === 1 || typeof action[1] === "number")
  );
};

export const isToggleOperation = (
  action: unknown
): action is ToggleOperation<string, any> => {
  return (
    Array.isArray(action) &&
    action.length === 2 &&
    typeof action[1] === "string"
  );
};

type InferSplice<TE, K extends string | undefined> = K extends string
  ? Extract<TE, TransactionEntry<K, SpliceOperation>>[1][number]
  : never;

type InferToggle<TE, K extends string | undefined> = K extends string
  ? Extract<TE, TransactionEntry<K, ToggleOperation>>[1][number]
  : never;

type EntryCreator<
  TE extends TransactionEntry,
  Target extends string | undefined
> = {
  target: <K extends TE extends TransactionEntry<infer K, any> ? K : never>(
    target: K
  ) => EntryCreator<TE, K>;
  splice: <S extends InferSplice<TE, Target>>(
    ...splice: (
      | {
          index: S[0];
          remove?: S[1];
          insert?: S[2];
        }
      | undefined
    )[]
  ) => EntryCreator<TE, Target>;
  toggle: <T extends InferToggle<TE, Target>>(
    ...toggle: (
      | {
          [ObjKey in T[0]]: {
            name: ObjKey;
            value: Extract<T, [ObjKey, any]>[1];
          };
        }[T[0]]
      | undefined
    )[]
  ) => EntryCreator<TE, Target>;
};

export const createTransaction = <
  TE extends TransactionEntry,
  Target extends string | undefined
>(
  callback: (t: EntryCreator<TE, Target>) => EntryCreator<TE, Target>
): Transaction<TE> => {
  const entries: Record<string, any> = [];
  let currentTarget: string | undefined;

  const obj: EntryCreator<TE, Target> = {
    target<NewTarget extends string>(target: NewTarget) {
      currentTarget = target;
      return this;
    },
    splice(...ops_) {
      if (currentTarget === undefined) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        if (!entries[currentTarget]) entries[currentTarget] = [];
        entries[currentTarget].push(
          ...ops.map(({ index, remove, insert }) =>
            insert
              ? [index, remove ?? 0, insert]
              : remove
              ? [index, remove]
              : [index]
          )
        );
      }
      return this;
    },
    toggle(...ops_) {
      if (currentTarget === undefined) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        if (!entries[currentTarget]) entries[currentTarget] = [];
        entries[currentTarget].push(
          ...ops.map(({ name, value }) => [name, value])
        );
      }
      return this;
    },
  };

  callback(obj);

  return Object.entries(entries) as Transaction<TE>;
};

/*
interface EntryCreator<TE extends TransactionEntry, Target extends string> {
  addSplice: () => EntryCreator<TE, Target>;
}

function entry<TE extends TransactionEntry, Target extends string>(
  target: Target
): EntryCreator<TE, Target> {
  const operations: TE[1] = [];

  type Key = TE extends TransactionEntry<infer Key, any> ? Key : never;
  type Splice<K extends Key> = Extract<
    TE,
    TransactionEntry<K, SpliceOperation>
  >[1][number];
  type Toggle<K extends Key> = Extract<
    TE,
    TransactionEntry<K, ToggleOperation>
  >[1][number];

  const obj = {
    addSplice<S extends Splice<Target>>(
      ...ops_: (
        | {
            index: S[0];
            remove?: S[1];
            insert?: S[2];
          }
        | undefined
      )[]
    ) {
      if (!target) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        operations.push(
          ...ops.map(({ index, remove, insert }) =>
            insert
              ? [index, remove ?? 0, insert]
              : remove
              ? [index, remove]
              : [index]
          )
        );
      }
      return obj;
    },
    addToggle<T extends Toggle<Target>>(
      ...ops_: ({ name: T[0]; value: T[1] } | undefined)[]
    ) {
      if (!target) {
        throw new Error("No target specified.");
      }
      const ops = ops_.filter(
        (el): el is Exclude<typeof el, undefined> => el !== undefined
      );
      if (ops.length) {
        operations.push(...ops.map(({ name, value }) => [name, value]));
      }
      return obj;
    },
    create() {
      return [target, operations] as [TE[0], TE[1]];
    },
  };

  return obj;
}

function create<TE extends TransactionEntry>(
  ...entries: EntryCreator<TE, string>[]
) {
  return entries
    .map((el) => el.create())
    .filter((el) => el[1].length > 0) as Transaction<TE>;
}

export const t = {
  create,
  entry,
};
*/
