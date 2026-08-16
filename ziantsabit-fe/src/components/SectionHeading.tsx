import type { ReactNode } from "react";
import { Typography } from "@mui/material";

/** Underlined section title, shared by the CV and About pages. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{
        fontWeight: "bold",
        fontSize: { xs: "16px", sm: "18px", md: "20px" },
        color: "text.primary",
        mb: 2,
        pb: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      {children}
    </Typography>
  );
}

export default SectionHeading;
