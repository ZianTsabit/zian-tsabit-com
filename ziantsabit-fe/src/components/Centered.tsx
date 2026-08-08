import type { ReactNode } from "react";
import { Box } from "@mui/material";

/** Centers a loading spinner, error or empty-state message in whatever
 *  `flex: 1` space its parent left over, rather than pinning it to the top. */
function Centered({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        py: 4,
      }}
    >
      {children}
    </Box>
  );
}

export default Centered;
