type HourMinuteSecond = [number, number | null, number | null];

const months = [
  "januar",
  "februar",
  "marts",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "december",
];

const days = [
  "søndag",
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
];

const talord1 = {
  et: 1,
  en: 1,
  to: 2,
  tre: 3,
  fire: 4,
  fem: 5,
  seks: 6,
  syv: 7,
  otte: 8,
  ni: 9,
  ti: 10,
  elleve: 11,
  tolv: 12,
  tretten: 13,
  fjorten: 14,
  femten: 15,
  seksten: 16,
  sytten: 17,
  atten: 18,
  nitten: 19,
  tyve: 20,
};

const talord2 = [
  "første",
  "anden",
  "tredje",
  "fjerde",
  "femte",
  "sjette",
  "syvende",
  "ottende",
  "niende",
  "tiende",
  "ellevte",
  "tolvte",
  "trettende",
  "fjortende",
  "femtende",
  "sekstende",
  "syttende",
  "attenende",
  "nittende",
  "tyvende",
  "enogtyvende",
  "toogtyvende",
  "treogtyvende",
  "fireogtyvende",
  "femogtyvende",
  "seksogtyvende",
  "syvogtyvende",
  "otteogtyvende",
  "niogtyvende",
  "tredivte",
  "enogtredivte",
];

const timeReg = RegExp(
  "(\\d+\\.?\\d*(?:[:h]\\d+\\.?\\d*(?:[:m]\\d+\\.\\d*s?)?)?)"
);
const dateReg = RegExp("(\\d+\\/\\d+(?:\\/\\d+)?)");
const tokenReg = RegExp(
  "\\s+|(\\d+(?:th|nd|rd|th))" +
    "|" +
    timeReg.source +
    "([A-Za-z]+)" +
    "|([A-Za-z]+)" +
    timeReg.source +
    "|" +
    dateReg.source
);

export function parseDateFromString(str: string) {
  const talord1Keys = Object.keys(talord1);

  const now = new Date();
  const tokens = str
    .split(tokenReg)
    .filter(Boolean)
    .map((raw) => {
      let token = raw.toLowerCase();

      if (talord1Keys.includes(token)) {
        token = `${talord1[token as keyof typeof talord1]}`;
      }

      return token;
    })
    .reduce((acc, raw, index, array) => {
      if (["over", "i"].includes(raw) && /^(\d+)/.exec(array[index + 1])) {
        if (acc[acc.length - 1] === "kvart") {
          acc.pop();
          acc.push("15", "minutter");
        } else if (/^(\d+)$/.exec(acc[acc.length - 1])) {
          acc.push("minutter");
        }
        acc.push(raw);
      } else if (raw === "halv" && /^(\d+)/.exec(array[index + 1])) {
        acc.push("30", "minutter", "i");
      }

      acc.push(raw);

      return acc;
    }, [] as string[]);

  console.log("TOKENS", tokens);

  const res: {
    date?: number;
    month?: number | string;
    year?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
  } = {};
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    let next = tokens[i + 1];
    let prev = tokens[i - 1];

    if (token === "i" && ["dag", "morgen", "går"].includes(next)) {
      token = `i ${next}`;
      next = tokens[i + 2];
      i++;
    }

    let match;

    if (
      (match = /(\d+)\./i.exec(token)) ||
      (match = talord2.indexOf(token.toLowerCase())) !== -1
    ) {
      /*
      if (next === "of") {
        next = tokens[i + 2];
        i++;
      }
      */
      res.date = typeof match === "number" ? match + 1 : Number(match[1]);
      if (monthish(next)) {
        res.month = next;
        i++;
      }
    } else if ((match = timeReg.exec(token)) && isAnyUnit(next)) {
      if (prev === "om") {
        let j = i;
        for (; j < tokens.length; j += 2) {
          if (tokens[j] === "og") {
            j--;
          } else if (
            (match = timeReg.exec(tokens[j])) &&
            isTimeUnit(tokens[j + 1])
          ) {
            addTimeUnit(parseTime(tokens[j]), getUnitName(tokens[j + 1])!);
          } else if (
            (match = /^(\d+\.?\d*)/.exec(tokens[j])) &&
            isDateUnit(tokens[j + 1])
          ) {
            addDayUnit(Number(match[1]), getUnitName(tokens[j + 1])!);
          } else {
            break;
          }
        }
        i = j;
      } else {
        let isHourModifier = false;
        let j = i + 2;
        for (; j < tokens.length; j++) {
          if (
            tokens[j] === "siden" ||
            (isHourModifier = Boolean(
              ["i", "over"].includes(tokens[j]) && /^(\d+)/.exec(tokens[j + 1])
            ))
          ) {
            break;
          }
        }
        if (j === tokens.length) {
          continue;
        }

        if (isHourModifier) {
          res.hours = Number(tokens[j + 1]);
          res.minutes = 0;
          res.seconds = 0;
        }

        let op =
          tokens[j] === "over"
            ? ([addTimeUnit, addDayUnit] as const)
            : ([subtractTimeUnit, subtractDayUnit] as const);

        for (let k = i; k < j; k++) {
          if ((match = timeReg.exec(tokens[k])) && isTimeUnit(tokens[k + 1])) {
            op[0](parseTime(tokens[k]), getUnitName(tokens[k + 1])!);
          } else if (
            (match = /^(\d+\.?\d*)/.exec(tokens[k])) &&
            isDateUnit(tokens[k + 1])
          ) {
            op[1](Number(match[1]), getUnitName(tokens[k + 1])!);
          }
        }
        i = j + Number(isHourModifier);
      }
    } else if ((match = dateReg.exec(token))) {
      const date = parseDate(token);
      if (date[0] !== null) res.date = date[0];
      if (date[1] !== null) res.month = date[1];
      if (date[2] !== null) res.year = date[2];
    } else if (/\d+[:h]\d+/.test(token) || /^(am|pm)/.test(next)) {
      let time = parseTime(token, next);
      if (time[0] !== null) res.hours = time[0];
      if (time[1] !== null) res.minutes = time[1];
      if (time[2] !== null) res.seconds = time[2];
    } else if ((match = /^(\d+)/.exec(token)) && monthish(next)) {
      let x = Number(match[1]);
      if (res.year === undefined && x > 31) res.year = x;
      else if (res.date === undefined) res.date = x;
      if (res.month === undefined) res.month = next;
      i++;
    } else if (monthish(token) && (match = /^(\d+)/.exec(next))) {
      let x = Number(match[1]);
      if (res.year === undefined && x > 31) res.year = x;
      else if (res.date === undefined) res.date = x;
      if (res.month === undefined) res.month = token;
      i++;
    } else if ((match = /^(\d+)/.exec(token)) && monthish(prev)) {
      let x = Number(match[1]);
      if (res.year === undefined) res.year = x;
      else if (res.hours === undefined) res.hours = x;
    } else if ((match = /^[`'\u00b4\u2019](\d+)/.exec(token))) {
      res.year = Number(match[1]);
    } else if ((match = /^(\d+)/.exec(token))) {
      let x = Number(match[1]);
      if (res.hours === undefined && x < 24) res.hours = x;
      else if (res.date === undefined && x <= 31) res.date = x;
      else if (res.year === undefined && x > 31) res.year = x;
      else if (
        res.year == undefined &&
        res.hours !== undefined &&
        res.date !== undefined
      ) {
        res.year = x;
      } else if (
        res.hours === undefined &&
        res.date !== undefined &&
        res.year !== undefined
      ) {
        res.hours = x;
      } else if (
        res.date === undefined &&
        res.hours !== undefined &&
        res.year !== undefined
      ) {
        res.date = x;
      }
    } else if (/^i ?dag$/.test(token) && res.date === undefined) {
      res.date = now.getDate();
      res.month = months[now.getMonth()];
      res.year = now.getFullYear();
    } else if (/^nu$/.test(token) && res.date === undefined) {
      res.hours = now.getHours();
      res.minutes = now.getMinutes();
      res.seconds = now.getSeconds();
      res.date = now.getDate();
      res.month = months[now.getMonth()];
      res.year = now.getFullYear();
    } else if (/^i ?morgen/.test(token) && res.date === undefined) {
      let tomorrow = new Date(now.valueOf() + 24 * 60 * 60 * 1000);
      res.date = tomorrow.getDate();
      if (res.month === undefined) {
        res.month = months[tomorrow.getMonth()];
      }
      if (res.year === undefined) {
        res.year = tomorrow.getFullYear();
      }
    } else if (/^i ?går/.test(token) && res.date === undefined) {
      let yesterday = new Date(now.valueOf() - 24 * 60 * 60 * 1000);
      res.date = yesterday.getDate();
      if (res.month === undefined) {
        res.month = months[yesterday.getMonth()];
      }
      if (res.year === undefined) {
        res.year = yesterday.getFullYear();
      }
    } else if (token === "næste" && dayish(next) && res.date === undefined) {
      setFromDay(next, 7);
      i++;
    } else if (token === "sidste" && dayish(next) && res.date === undefined) {
      setFromDay(next, -7);
      i++;
    } else if (token === "i" && dayish(next) && res.date === undefined) {
      setFromDay(next, -7);
      i++;
    } else if (dayish(token) && res.date === undefined) {
      setFromDay(token, 0);
    }
  }

  if (typeof res.year === "number" && res.year < 100) {
    let y = now.getFullYear();
    let py = y % 100;
    if (py + 10 < res.year) {
      res.year += y - py - 100;
    } else res.year += y - py;
  }

  if (res.month && typeof res.month !== "number") {
    // normalize month name
    res.month = getMonthName(res.month);
  }

  let out = new Date(now);

  // could set time after date so that we don't get into trouble with DST
  // still getting in trouble though (d. 1. april om 1 time)

  out.setHours(res.hours === undefined ? 0 : res.hours);
  out.setMinutes(res.minutes === undefined ? 0 : res.minutes);
  out.setSeconds(res.seconds === undefined ? 0 : res.seconds);

  if (res.date) {
    out.setDate(res.date);
  }

  if (typeof res.month === "number") {
    out.setMonth(res.month);
  } else if (res.month) {
    out.setMonth(months.indexOf(res.month));
  }

  if (res.year) out.setFullYear(res.year);

  return out;

  function setFromDay(t: string, x: number) {
    let dayi = days.indexOf(getWeekdayName(t)!);
    let xdays = ((7 + dayi - now.getDay()) % 7) + x;
    let d = new Date(now.valueOf() + xdays * 24 * 60 * 60 * 1000);
    res.date = d.getDate();
    if (res.month === undefined) {
      res.month = months[d.getMonth()];
    }
    if (res.year === undefined) {
      res.year = d.getFullYear();
    }
  }

  function operateTimeUnit(
    time: HourMinuteSecond,
    unit: string,
    operation: (a: number, b: number) => number
  ) {
    if (unit == "timer") {
      res.hours = operation(res.hours ?? now.getHours(), time[0]!);
      res.minutes = operation(
        res.minutes ?? now.getMinutes(),
        time[1] === null ? 0 : time[1]
      );
      res.seconds = operation(
        res.seconds ?? now.getSeconds(),
        time[2] === null ? 0 : time[2]
      );
    } else if (unit == "minutter" || unit === "kvarter") {
      const scale = unit === "kvarter" ? 15 : 1;
      if (res.hours === undefined) res.hours = now.getHours();
      res.minutes = operation(
        res.minutes ?? now.getMinutes(),
        time[0] === null ? 0 : time[0] * scale
      );
      res.seconds = operation(
        res.seconds ?? now.getSeconds(),
        time[1] === null ? 0 : time[1]
      );
    } else if (unit == "sekunder") {
      if (res.hours === undefined) res.hours = now.getHours();
      if (res.minutes === undefined) res.minutes = now.getMinutes();
      res.seconds = operation(
        res.seconds ?? now.getSeconds(),
        time[0] === null ? 0 : time[0]
      );
    }
  }

  function subtractTimeUnit(hms: HourMinuteSecond, u: Unit) {
    operateTimeUnit(hms, u, sub);
  }
  function addTimeUnit(hms: HourMinuteSecond, u: Unit) {
    operateTimeUnit(hms, u, add);
  }

  function operateDayUnit(
    number: number,
    unit: Unit,
    operation: (a: number, b: number) => number
  ) {
    if (res.hours === undefined) res.hours = now.getHours();
    if (res.minutes === undefined) res.minutes = now.getMinutes();
    if (res.seconds === undefined) res.seconds = now.getSeconds();
    if (unit === "dage") {
      res.date = operation(now.getDate(), number);
    } else if (unit === "uger") {
      res.date = operation(now.getDate(), number * 7);
    } else if (unit === "måneder") {
      res.month = operation(now.getMonth(), number);
    } else if (unit === "år") {
      res.year = operation(now.getFullYear(), number);
    }
  }
  function subtractDayUnit(n: number, u: Unit) {
    operateDayUnit(n, u, sub);
  }
  function addDayUnit(n: number, u: Unit) {
    operateDayUnit(n, u, add);
  }
}

function add(a: number, b: number) {
  return a + b;
}
function sub(a: number, b: number) {
  return a - b;
}

function isTimeUnit(s: string) {
  let n = getUnitName(s);
  return (
    n === "timer" || n === "kvarter" || n === "minutter" || n === "sekunder"
  );
}

function isDateUnit(s: string) {
  let n = getUnitName(s);
  return n === "dage" || n === "uger" || n === "måneder" || n === "år";
}

function isAnyUnit(s: string) {
  return Boolean(getUnitName(s));
}

function getUnitName(s: string) {
  if (/^(ms|millisecs?|milliseks?|millisekunde?r?)$/.test(s))
    return "millisekunder";
  if (/^(s|sec?s?|seks?|sekunde?r?)$/.test(s)) return "sekunder";
  if (/^(m|mins?|minutt?e?r?)$/.test(s)) return "minutter";
  if (/^(kvarter?e?r?)$/.test(s)) return "kvarter";
  if (/^(h|t|hrs?|timer?)$/.test(s)) return "timer";
  if (/^(d|dage?)$/.test(s)) return "dage";
  if (/^(w|u|wks?|uger?)$/.test(s)) return "uger";
  if (/^(mnde?r?|månede?r?)$/.test(s)) return "måneder";
  if (/^(år)$/.test(s)) return "år";
}

type Unit = Exclude<ReturnType<typeof getUnitName>, undefined>;

function monthish(s: string) {
  return Boolean(getMonthName(s));
}

function dayish(s: string) {
  return Boolean(getWeekdayName(s));
}

function getMonthName(s: string) {
  return months.find((el) => el.startsWith(s));
}

function getWeekdayName(s: string) {
  if (!s || s.length < 3) return;
  return days.find((el) => el.startsWith(s.replace("dags", "dag")));
}

function parseTime(s: string, next?: string) {
  let m = /(\d+\.?\d*)(?:[:h](\d+\.?\d*)(?:[:m](\d+\.?\d*s?\.?\d*))?)?/.exec(s);
  if (!m) {
    throw new Error("Invalid time: " + s);
  }
  let hms: HourMinuteSecond = [Number(m[1]), null, null];
  if (next && /^pm/.test(next) && hms[0] < 12) hms[0] += 12;
  if (m[2]) hms[1] = Number(m[2]);
  if (m[3]) hms[2] = Number(m[3]);
  if (hms[0] > floorup(hms[0])) {
    hms[1] = floorup((hms[0] - floorup(hms[0])) * 60);
    hms[0] = floorup(hms[0]);
  }
  if (hms[1] && hms[1] > floorup(hms[1])) {
    hms[2] = floorup((hms[1] - floorup(hms[1])) * 60);
    hms[1] = floorup(hms[1]);
  }
  return hms;
}

function parseDate(s: string) {
  let m = /(\d+)\/(\d+)(?:\/(\d+))?/.exec(s);
  if (!m) {
    throw new Error("Invalid date format: " + s);
  }
  let dmy = [Number(m[1]), null, null];
  if (m[2]) dmy[1] = Number(m[2]) - 1;
  if (m[3]) dmy[2] = Number(m[3]);
  return dmy;
}

function floorup(x: number) {
  return Math.floor(Math.round(x * 1e6) / 1e6);
}
