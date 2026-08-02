// Shared layout metrics. The Header is `position: fixed`, so its height has to be
// known in two places: the Header itself, and the top offset every page sits behind.
// Keeping them here stops the two from drifting apart.

export const HEADER_HEIGHT = { xs: "56px", sm: "64px" };

// Full-viewport page height, minus the fixed header, so a page that fills the
// screen does not also introduce a scrollbar worth exactly one header.
export const PAGE_MIN_HEIGHT = {
  xs: "calc(100vh - 56px)",
  sm: "calc(100vh - 64px)",
};
