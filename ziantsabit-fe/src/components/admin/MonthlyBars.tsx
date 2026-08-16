import { Box, Tooltip, Typography } from "@mui/material";

import { monthLabel, type MonthCount } from "../../services/adminStats";

const PLOT_HEIGHT = 132;
/** Room for a three-letter month at 10px without the labels touching. */
const MIN_BAR = 26;
/**
 * And a ceiling, so a short history does not stretch into slabs. Ten months
 * across a desktop column would otherwise give each bar ~85px, which reads as
 * a row of blocks rather than a chart.
 */
const MAX_BAR = 44;
/** The direct label sits in a reserved line above the tallest bar. */
const LABEL_LINE = 16;

interface Props {
  months: MonthCount[];
}

/**
 * Posts published per month.
 *
 * One series, so one colour and no legend -- the heading names it. Plain boxes
 * rather than a charting library: this is a dozen rectangles and a baseline,
 * and the smallest chart dependency would outweigh the whole feature.
 *
 * Colour is `primary.main`, which differs between the two schemes, so the bars
 * stay legible in both. Nothing here reads a colour literal; see the palette
 * rules in CLAUDE.md.
 */
function MonthlyBars({ months }: Props) {
  // The tallest bar sets the scale. `|| 1` keeps a run of empty months from
  // dividing by zero -- they all render at the floor instead.
  const peak = Math.max(...months.map((row) => row.count), 0) || 1;
  // Labelled directly, so the chart can be read for magnitude without hovering
  // anything. Only the extreme: a number over every bar is chaos and goes
  // unread, and the rest are in the table below.
  const peakAt = months.findIndex((row) => row.count === peak);
  const width = months.length * MIN_BAR;
  // Caps the plot at the width its bars can actually fill, so the baseline
  // ends with the data instead of running on to the edge of a wide column.
  const fullWidth = months.length * (MAX_BAR + 2);

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
        {months.map((row, index) => {
          const empty = row.count === 0;
          const label = `${monthLabel(row.month)}: ${row.count} ${
            row.count === 1 ? "post" : "posts"
          }`;
          return (
            <Box
              key={row.month}
              sx={{
                flex: 1,
                minWidth: MIN_BAR - 2,
                maxWidth: MAX_BAR,
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
                {index === peakAt && !empty ? row.count : ""}
              </Typography>

              <Tooltip title={label}>
                <Box
                  // Focusable so a keyboard reaches the same reading a hover
                  // gives, and labelled so the tooltip is never the only way
                  // to the number -- the table below carries every one.
                  tabIndex={0}
                  aria-label={label}
                  sx={{
                    // A visible floor for an empty month, in the divider
                    // colour: a zero-height bar is indistinguishable from a
                    // month the chart forgot to draw.
                    height: empty
                      ? 2
                      : Math.max(
                          4,
                          (row.count / peak) * (PLOT_HEIGHT - LABEL_LINE - 4),
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
        {months.map((row, index) => {
          const [month, year] = monthLabel(row.month).split(" ");
          // The year only where it changes -- the first bar, and each January.
          // Repeating "2026" a dozen times is noise; dropping it altogether
          // leaves a chart that spans a new year ambiguous.
          const startsYear = index === 0 || row.month.endsWith("-01");
          return (
            <Box
              key={row.month}
              sx={{ flex: 1, minWidth: MIN_BAR - 2, maxWidth: MAX_BAR }}
            >
              {[month, startsYear ? year : ""].map((text, line) => (
                <Typography
                  key={line}
                  sx={{
                    textAlign: "center",
                    fontSize: "10px",
                    color: "text.secondary",
                    // Ticks are a column of numbers, so they align.
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                    // Held even when blank, so both label rows keep one
                    // baseline right across the chart.
                    minHeight: 14,
                  }}
                >
                  {text}
                </Typography>
              ))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default MonthlyBars;
