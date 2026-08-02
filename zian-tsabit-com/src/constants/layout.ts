// Shared layout metrics. The Header is `position: fixed`, so its height has to be
// known in two places: the Header itself, and the top offset the page content
// sits behind. Keeping them here stops the two from drifting apart.

export const HEADER_HEIGHT = { xs: "56px", sm: "64px" };

// Page height is deliberately NOT a constant. App.tsx is a flex column that is
// at least `100vh` tall, <main> takes the slack with `flex: 1`, and each page
// fills <main> with `flex: 1` of its own. That is what keeps the footer at the
// bottom of a short page rather than one screen below the fold.
