import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Box from "@mui/material/Box";
import Header from './components/Header';
import { HEADER_HEIGHT } from "./constants/layout";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Books from "./pages/Books";
import Garage from "./pages/Garage";
import About from "./pages/About";
import CV from "./pages/CV";
import './App.css'

function App() {
  return (
    <>
    <Router>
      <Header />
      {/* The header is fixed, so every page is offset by its height here rather
          than each page guessing at its own top margin. */}
      <Box component="main" sx={{ pt: HEADER_HEIGHT }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/curriculum-vitae" element={<CV />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/books" element={<Books />} />
          <Route path="/garage" element={<Garage />} />
        </Routes>
      </Box>
    </Router>

    </>
  )
}

export default App
