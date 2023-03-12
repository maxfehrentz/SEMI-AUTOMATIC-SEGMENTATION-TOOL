import {Link} from 'react-router-dom';
import './Navbar.css';

// adapted from https://www.youtube.com/watch?v=DO-pSysGItQ
const Navbar = () => {
    return (
        <nav className="navbar">
            <h1 className="navbarHeader">Semi-Automatic Segmentation</h1>
            <div className="links">
                <Link to="/bounding">Start Annotating</Link>
            </div>
        </nav>
    );
}

export default Navbar;