import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Box from "@mui/material/Box";
import Header from './components/Header';
import Footer from './components/Footer';
import { HEADER_HEIGHT } from "./constants/layout";
import Blog from "./pages/Blog";
import Books from "./pages/Books";
import BookDetail from "./pages/BookDetail";
import About from "./pages/About";
import CV from "./pages/CV";
import Admin from "./pages/Admin";
import AdminConsole from "./components/admin/AdminConsole";
import AdminOverview from "./pages/AdminOverview";
import AdminStats from "./pages/AdminStats";
import AdminNewPost from "./pages/AdminNewPost";
import AdminEditPost from "./pages/AdminEditPost";
import AdminBookConsole from "./components/admin/AdminBookConsole";
import AdminCommentConsole from "./components/admin/AdminCommentConsole";
import AdminNewBook from "./pages/AdminNewBook";
import AdminEditBook from "./pages/AdminEditBook";
import PostDetail from "./pages/PostDetail";
import NotFound from "./pages/NotFound";
import './App.css'

function App() {
  return (
    <Router>
      <Header />
      {/* Sticky-footer shell: the column is at least a viewport tall and <main>
          takes the slack, so the footer sits at the bottom of a short page
          instead of one full screen below the fold. Pages therefore set
          `flex: 1` rather than a height of their own. */}
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* The header is fixed, so every page is offset by its height here
            rather than each page guessing at its own top margin. */}
        <Box
          component="main"
          sx={{
            pt: HEADER_HEIGHT,
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Routes>
            {/* The feed is the home page: there is no separate landing page,
                so "/" is the blog itself. */}
            <Route path="/" element={<Blog />} />
            <Route path="/about" element={<About />} />
            <Route path="/curriculum-vitae" element={<CV />} />
            {/* The list lives at "/", but every card ever built links to
                /posts/:slug -- so the detail route stays exactly where it is
                and only the list URL redirects. The page is called Blog now;
                the URLs deliberately did not move with the name, since a
                rename is not worth breaking every link over.

                /projects and /projects/:slug were removed with the category
                enum: that page listed one hardcoded section, and browsing by
                tag on "/" is what replaced it. */}
            <Route path="/posts" element={<Navigate to="/" replace />} />
            <Route
              path="/posts/:slug"
              element={<PostDetail backTo="/" backLabel="Blog" />}
            />
            {/* The catalogue. `/books/:slug` is a `Book`, so it renders
                `BookDetail` rather than `PostDetail`; a post *about* a book is
                writing, lives in the feed at "/", and reaches its own page at
                /posts/:slug like every other post. */}
            <Route path="/books" element={<Books />} />
            <Route path="/books/:slug" element={<BookDetail />} />
            {/* Not in Header's navItems: the owner's page, not a visitor's.
                Nested so `Admin` checks the session exactly once and hands it
                down via `<Outlet context>` to whichever of these is active. */}
            <Route path="/admin" element={<Admin />}>
              <Route index element={<AdminOverview />} />
              <Route path="posts" element={<AdminConsole />} />
              <Route path="stats" element={<AdminStats />} />
              <Route path="new" element={<AdminNewPost />} />
              <Route path="edit/:slug" element={<AdminEditPost />} />
              {/* The catalogue's own section, nested under the same shell so
                  the session is checked once for it too. Its editors sit under
                  `books/` rather than beside the post ones, since `edit/:slug`
                  at the top level is already the post editor's. */}
              <Route path="books" element={<AdminBookConsole />} />
              <Route path="books/new" element={<AdminNewBook />} />
              <Route path="books/edit/:slug" element={<AdminEditBook />} />
              {/* Moderation for what visitors leave. No editor route beside
                  it: a comment is the visitor's, so the only things the owner
                  has over one are hiding it and removing it -- both of which
                  happen on the list itself. */}
              <Route path="comments" element={<AdminCommentConsole />} />
            </Route>
            {/* Must stay last: `*` matches anything, and the routes above are
                only reached because a more specific match wins. `/admin/typo`
                lands here too -- a parent route whose children all miss is not
                a match, so the whole branch fails rather than rendering the
                console. Deliberately not a nested catch-all inside `/admin`:
                that would put the 404 behind the session check, so a logged-out
                visitor would get a login form for a page that does not exist. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>
        <Footer />
      </Box>
    </Router>
  )
}

export default App
