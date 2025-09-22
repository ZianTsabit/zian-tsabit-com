import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from './components/Header';
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Books from "./pages/Books";
import Garage from "./pages/Garage";
import About from "./pages/About";
import './App.css'

function App() {
  return (
    <>
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/books" element={<Books />} />
        <Route path="/garage" element={<Garage />} />
      </Routes>
    </Router>

    </>
  )
}

export default App
