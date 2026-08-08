import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Box from "@mui/material/Box";
import Header from './components/Header';
import Footer from './components/Footer';
import { HEADER_HEIGHT } from "./constants/layout";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Books from "./pages/Books";
import Garage from "./pages/Garage";
import About from "./pages/About";
import CV from "./pages/CV";
import Admin from "./pages/Admin";
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
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/curriculum-vitae" element={<CV />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/books" element={<Books />} />
            <Route path="/garage" element={<Garage />} />
            {/* Not in Header's navItems: the owner's page, not a visitor's. */}
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Box>
        <Footer />
      </Box>
    </Router>
  )
}

export default App
