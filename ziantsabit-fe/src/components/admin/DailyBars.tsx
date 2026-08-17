import Bars, { type Bar } from "./Bars";
import {
  dayLabel,
  dayOfMonth,
  monthLabel,
  type DayCount,
} from "../../services/adminStats";

/** Narrower than the monthly chart's: thirty bars at 26px would be 780px wide
 *  and would scroll on every screen the admin is read on. */
const MIN_BAR = 12;
const MAX_BAR = 28;
/** A tick every fifth bar. Counted back from the last one, so today -- the bar
 *  anyone reads first -- is always the labelled one, and the spacing stays even
 *  however many days the window holds. */
const TICK_EVERY = 5;

interface Props {
  days: DayCount[];
}

/**
 * Reads per day over the window the API sends (see `views_by_day`).
 *
 * The series arrives dense, zeros and all, so there is no gap-filling here --
 * every bar is a real day, and an empty one draws the floor `Bars` gives it.
 */
function DailyBars({ days }: Props) {
  // The month name rides under a labelled bar rather than under whichever bar
  // happens to be a 1st: the ticks are five days apart, so a month that begins
  // between two of them would otherwise go unnamed, and a name under an
  // unlabelled bar would float with no number to attach to.
  let namedMonth = "";

  const bars: Bar[] = days.map((row, index) => {
    const labelled = (days.length - 1 - index) % TICK_EVERY === 0;
    const month = row.date.slice(0, 7);
    const showsMonth = labelled && month !== namedMonth;
    if (labelled) namedMonth = month;

    return {
      key: row.date,
      value: row.count,
      label: `${dayLabel(row.date)}: ${row.count} ${
        row.count === 1 ? "view" : "views"
      }`,
      ticks: [
        labelled ? dayOfMonth(row.date) : "",
        showsMonth ? monthLabel(month).split(" ")[0] : "",
      ],
    };
  });

  return <Bars bars={bars} minBar={MIN_BAR} maxBar={MAX_BAR} />;
}

export default DailyBars;
