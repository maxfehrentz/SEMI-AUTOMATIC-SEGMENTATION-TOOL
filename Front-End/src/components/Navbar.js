import {Link} from 'react-router-dom';

// adapted from https://www.youtube.com/watch?v=DO-pSysGItQ
// TODO: create a CSS file to make this look prettier
const Navbar = () => {
    return (
        <nav className="navbar">
            <h1>Semi-Automatic Segmentation</h1>
            <div className="links">
                <Link to="/bounding">Start Annotating</Link>
            </div>
        </nav>
    );
}

export default Navbar;