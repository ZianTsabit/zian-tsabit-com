import Bars, { type Bar } from "./Bars";
import { monthLabel, type MonthCount } from "../../services/adminStats";

interface Props {
  months: MonthCount[];
}

/**
 * Posts published per month.
 *
 * The drawing is `Bars`; this decides what a month is called and how many
 * posts reads in words. Splitting it that way is what lets the daily chart
 * share every pixel of the scale and spacing without sharing the wording.
 */
function MonthlyBars({ months }: Props) {
  const bars: Bar[] = months.map((row, index) => {
    const [month, year] = monthLabel(row.month).split(" ");
    // The year only where it changes -- the first bar, and each January.
    // Repeating "2026" a dozen times is noise; dropping it altogether leaves a
    // chart that spans a new year ambiguous.
    const startsYear = index === 0 || row.month.endsWith("-01");
    return {
      key: row.month,
      value: row.count,
      label: `${monthLabel(row.month)}: ${row.count} ${
        row.count === 1 ? "post" : "posts"
      }`,
      ticks: [month, startsYear ? year : ""],
    };
  });

  return <Bars bars={bars} />;
}

export default MonthlyBars;
