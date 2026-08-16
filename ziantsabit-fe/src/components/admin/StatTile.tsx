import { Box, Typography } from "@mui/material";

interface Props {
  label: string;
  value: number | string;
  /** One short line under the value -- "6 drafts", "per published post". Not a
   *  second number competing with the first. */
  hint?: string;
}

/**
 * One headline number.
 *
 * A tile rather than a chart, because a single value has nothing to compare
 * against: a one-bar bar chart or a two-slice pie says less than the number
 * does, and takes more room to say it.
 *
 * Proportional figures deliberately -- `tabular-nums` gives every digit the
 * width of a zero, which makes a value like 121 look gappy at this size. The
 * "most read" table opposite does use tabular figures, because those numbers
 * sit in a column and have to line up.
 */
function StatTile({ label, value, hint }: Props) {
  return (
    <Box
      sx={{
        flex: "1 1 160px",
        minWidth: 0,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
        px: 2,
        py: 1.75,
      }}
    >
      <Typography sx={{ fontSize: "13px", color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: "26px", sm: "30px" },
          fontWeight: 600,
          lineHeight: 1.2,
          color: "text.primary",
        }}
      >
        {value}
      </Typography>
      {/* Reserved even when empty, so a row of tiles keeps one baseline
          whether or not each has something to add. */}
      <Typography
        sx={{ fontSize: "12px", color: "text.secondary", minHeight: 18 }}
      >
        {hint ?? ""}
      </Typography>
    </Box>
  );
}

export default StatTile;
