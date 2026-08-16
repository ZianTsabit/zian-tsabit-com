import { Box } from "@mui/material";

/**
 * Pill used for CV skills, About interests and the admin list's labels.
 *
 * `emphasis` picks one out of a row of them -- the admin page marks a published
 * post with it. It defaults off, so every existing caller renders as before.
 */
function TagChip({ label, emphasis = false }: { label: string; emphasis?: boolean }) {
  return (
    <Box
      sx={{
        fontSize: { xs: "11px", sm: "13px", md: "14px" },
        color: emphasis ? "primary.main" : "text.primary",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: emphasis ? "primary.main" : "divider",
        borderRadius: "999px",
        px: { xs: 1.25, sm: 1.5 },
        py: 0.5,
      }}
    >
      {label}
    </Box>
  );
}

/** Wrapping row of pills. */
export function TagChipRow({ labels }: { labels: string[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 0.75, sm: 1 } }}>
      {labels.map((label) => (
        <TagChip key={label} label={label} />
      ))}
    </Box>
  );
}

export default TagChip;
