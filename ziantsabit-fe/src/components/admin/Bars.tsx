import { Box, Tooltip, Typography } from "@mui/material";

const PLOT_HEIGHT = 132;
/** Room for a three-letter month at 10px without the labels touching. */
const DEFAULT_MIN_BAR = 26;
/**
 * And a ceiling, so a short history does not stretch into slabs. Ten months
 * across a desktop column would otherwise give each bar ~85px, which reads as
 * a row of blocks rather than a chart.
 */
const DEFAULT_MAX_BAR = 44;
/** The direct label sits in a reserved line above the tallest bar. */
const LABEL_LINE = 16;

/** One bar, already reduced to what the chart draws: a height, a sentence, and
 *  the tick lines underneath it. Which period it represents, and how that is
 *  worded, belongs to the caller -- `MonthlyBars` and `DailyBars` are the two
 *  that decide it. */
export interface Bar {
  key: string;
  value: number;
  /** Tooltip and screen-reader text, e.g. "Mar 2026: 3 posts". */
  label: string;
  /** Up to two lines of axis text. An empty string still holds its line, so
   *  every tick keeps one baseline across the chart. */
  ticks: [string, string];
}

interface Props {
  bars: Bar[];
  /** Widen for few, wide bars; narrow for a long series that would otherwise
   *  only be readable by scrolling. */
  minBar?: number;
  maxBar?: number;
}

/**
 * A column chart of one series.
 *
 * One series, so one colour and no legend -- the heading names it. Plain boxes
 * rather than a charting library: this is a few dozen rectangles and a
 * baseline, and the smallest chart dependency would outweigh the whole feature.
 *
 * Colour is `primary.main`, which differs between the two schemes, so the bars
 * stay legible in both. Nothing here reads a colour literal; see the palette
 * rules in CLAUDE.md.
 *
 * Every chart on the statistics page renders through this, so the two of them
 * cannot drift apart in scale, spacing or the way an empty period is drawn.
 */
function Bars({ bars, minBar = DEFAULT_MIN_BAR, maxBar = DEFAULT_MAX_BAR }: Props) {
  // The tallest bar sets the scale. `|| 1` keeps a run of empty periods from
  // dividing by zero -- they all render at the floor instead.
  const peak = Math.max(...bars.map((bar) => bar.value), 0) || 1;
  // Labelled directly, so the chart can be read for magnitude without hovering
  // anything. Only the extreme: a number over every bar is chaos and goes
  // unread, and the rest are in the table below.
  const peakAt = bars.findIndex((bar) => bar.value === peak);
  const width = bars.length * minBar;
  // Caps the plot at the width its bars can actually fill, so the baseline
  // ends with the data instead of running on to the edge of a wide column.
  const fullWidth = bars.length * (maxBar + 2);

  return (
    // The labels scroll with the bars they belong to, and the box is sized to
    // hold both: a fixed height that excluded the label band would put a
    // second, nested scrollbar inside the card.
    <Box sx={{ overflowX: "auto", pb: 0.5 }}>
      <Box
        sx={{
          display: "flex",
          // 2px of surface between neighbours rather than a border drawn round
          // each: a border adds a line the data does not have.
          gap: "2px",
          alignItems: "stretch",
          height: PLOT_HEIGHT,
          minWidth: width,
          maxWidth: fullWidth,
          // The baseline: a solid hairline one shade off the surface. Dashing
          // it would read as a threshold rather than an axis.
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {bars.map((bar, index) => {
          const empty = bar.value === 0;
          return (
            <Box
              key={bar.key}
              sx={{
                flex: 1,
                minWidth: minBar - 2,
                maxWidth: maxBar,
                display: "flex",
                flexDirection: "column",
                // Bars grow up from the baseline; the label line rides on top.
                justifyContent: "flex-end",
              }}
            >
              <Typography
                sx={{
                  height: LABEL_LINE,
                  textAlign: "center",
                  fontSize: "11px",
                  // Text keeps its own token rather than the series colour --
                  // the bar beneath already carries the identity.
                  color: "text.secondary",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {index === peakAt && !empty ? bar.value : ""}
              </Typography>

              <Tooltip title={bar.label}>
                <Box
                  // Focusable so a keyboard reaches the same reading a hover
                  // gives, and labelled so the tooltip is never the only way
                  // to the number -- the table below carries every one.
                  tabIndex={0}
                  aria-label={bar.label}
                  sx={{
                    // A visible floor for an empty period, in the divider
                    // colour: a zero-height bar is indistinguishable from one
                    // the chart forgot to draw.
                    height: empty
                      ? 2
                      : Math.max(
                          4,
                          (bar.value / peak) * (PLOT_HEIGHT - LABEL_LINE - 4),
                        ),
                    bgcolor: empty ? "divider" : "primary.main",
                    // Rounded at the data end only, anchored to the baseline.
                    borderRadius: "4px 4px 0 0",
                    "&:focus-visible": {
                      outline: "2px solid",
                      outlineColor: "primary.main",
                      outlineOffset: 2,
                    },
                  }}
                />
              </Tooltip>
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: "2px",
          minWidth: width,
          maxWidth: fullWidth,
          mt: 0.75,
        }}
      >
        {bars.map((bar) => (
          <Box
            key={bar.key}
            sx={{ flex: 1, minWidth: minBar - 2, maxWidth: maxBar }}
          >
            {bar.ticks.map((text, line) => (
              <Typography
                key={line}
                sx={{
                  textAlign: "center",
                  fontSize: "10px",
                  color: "text.secondary",
                  // Ticks are a column of numbers, so they align.
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  // Held even when blank, so both label rows keep one baseline
                  // right across the chart.
                  minHeight: 14,
                }}
              >
                {text}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default Bars;
