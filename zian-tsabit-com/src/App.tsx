import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from './components/Header';
import Footer from './components/Footer';
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Books from "./pages/Books";
import Garage from "./pages/Garage";
import './App.css'

function App() {
  return (
    <>
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/books" element={<Books />} />
        <Route path="/garage" element={<Garage />} />
      </Routes>
      <Footer />
    </Router>

    </>
  )
}

export default App
