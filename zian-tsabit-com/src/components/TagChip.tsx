import { Box } from "@mui/material";

/** Pill used for CV skills and About interests. */
function TagChip({ label }: { label: string }) {
  return (
    <Box
      sx={{
        fontFamily: "'Ubuntu', sans-serif",
        fontSize: { xs: "11px", sm: "13px", md: "14px" },
        color: "text.primary",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
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
