import { Link } from 'react-router-dom';

function Home() {
    return (
        <div className="home-container">
            <header>
                <h1>Collaborators</h1>
                <p className="subtitle">Find and connect.</p>
            </header>

            <div className="action-buttons">
                <Link to="/find" className="big-action-button find-button">
                    <h2>Find Collaborators</h2>
                    <p>Browse collaboration possibilties</p>
                </Link>

                <Link to="/post" className="big-action-button post-button">
                    <h2>Post Collaboration Idea</h2>
                    <p>Share your vision so others can find you</p>
                </Link>
            </div>
        </div>
    );
}

export default Home;
