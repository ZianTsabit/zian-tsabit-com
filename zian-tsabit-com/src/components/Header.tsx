import { useState } from 'react'
import { Link } from "react-router-dom";
import '../css/Header.css';;

function Header() {
    return (
        <header className="header">
            <nav>
                <ul>
                    <li><Link to="/">Home</Link></li>
                    <li><Link to="/projects">Projects</Link></li>
                    <li><Link to="/books">Books</Link></li>
                </ul>
            </nav>
        </header>
    );
}

export default Header