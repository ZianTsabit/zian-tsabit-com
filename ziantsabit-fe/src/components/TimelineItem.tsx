import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface TimelineItemProps {
  title: string;
  subtitle?: string;
  subtitleLink?: string;
  location?: string;
  duration: string;
  blurb?: string;
  /** ReactNode, not string: a point may carry an inline link (see the Bamtren
   *  entry on the CV). Plain strings still work unchanged. */
  points?: ReactNode[];
  /** The last entry in a section draws no connecting line below its dot. */
  last?: boolean;
}

function TimelineItem({
  title,
  subtitle,
  subtitleLink,
  location,
  duration,
  blurb,
  points,
  last = false,
}: TimelineItemProps) {
  return (
    <Box
      sx={{
        position: "relative",
        pl: { xs: 2.5, sm: 3.5 },
        pb: last ? 0 : { xs: 3, sm: 4 },
        // The rail runs from just under the dot to the bottom of the entry, so
        // consecutive items read as one continuous line.
        "&::before": {
          content: '""',
          display: last ? "none" : "block",
          position: "absolute",
          left: "5px",
          top: "20px",
          bottom: 0,
          width: "2px",
          bgcolor: "divider",
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: "7px",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          bgcolor: "primary.main",
        }}
      />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "baseline" },
          gap: { xs: 0.25, sm: 2 },
        }}
      >
        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            color: "text.primary",
            fontSize: { xs: "15px", sm: "17px", md: "18px" },
          }}
        >
          {title}
        </Typography>
        <Typography
          component="div"
          sx={{
            color: "text.secondary",
            fontSize: { xs: "12px", sm: "13px", md: "14px" },
            whiteSpace: "nowrap",
          }}
        >
          {duration}
        </Typography>
      </Stack>

      {subtitle && (
        <Typography
          component="div"
          sx={{
            fontSize: { xs: "13px", sm: "15px", md: "16px" },
            mt: 0.25,
          }}
        >
          {subtitleLink ? (
            <Box
              component="a"
              href={subtitleLink}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "primary.main", textDecoration: "underline" }}
            >
              {subtitle}
            </Box>
          ) : (
            <Box component="span" sx={{ color: "text.secondary" }}>
              {subtitle}
            </Box>
          )}
        </Typography>
      )}

      {location && (
        <Typography
          component="div"
          sx={{
            color: "text.secondary",
            fontSize: { xs: "11px", sm: "12px", md: "13px" },
            mt: 0.25,
          }}
        >
          {location}
        </Typography>
      )}

      {blurb && (
        <Typography
          component="div"
          sx={{
            color: "text.secondary",
            fontStyle: "italic",
            fontSize: { xs: "12px", sm: "13px", md: "14px" },
            textAlign: { xs: "left", sm: "justify" },
            mt: 1,
          }}
        >
          {blurb}
        </Typography>
      )}

      {points && points.length > 0 && (
        <Box
          component="ul"
          sx={{
            listStyle: "none",
            m: 0,
            mt: 1.25,
            p: 0,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {points.map((point, index) => (
            <Box
              component="li"
              // Index, since a point is no longer necessarily a string it can
              // be keyed by. The list is a hardcoded constant -- it is never
              // reordered or filtered at runtime, so this is stable.
              key={index}
              sx={{
                position: "relative",
                pl: 2,
                "&::before": {
                  content: '"▸"',
                  position: "absolute",
                  left: 0,
                  color: "primary.main",
                  lineHeight: 1.6,
                },
              }}
            >
              <Typography
                component="div"
                sx={{
                  color: "text.primary",
                  fontSize: { xs: "12px", sm: "14px", md: "15px" },
                  lineHeight: 1.6,
                  textAlign: { xs: "left", sm: "justify" },
                }}
              >
                {point}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default TimelineItem;
