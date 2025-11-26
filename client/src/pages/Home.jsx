import { Link } from 'react-router-dom';

function Home() {
    return (
        <div className="home-container">
            <header>
                <h1>Collaborations</h1>
                <p className="subtitle">Connect and collaborate.</p>
            </header>

            <div className="action-buttons">
                <Link to="/find" className="big-action-button find-button">
                    <h2>Find Collaborators</h2>
                    <p>Browse profiles and connect with like-minded activists.</p>
                </Link>

                <Link to="/post" className="big-action-button post-button">
                    <h2>Post Collaboration Ideas</h2>
                    <p>Share your vision and find people to help make it happen.</p>
                </Link>
            </div>
        </div>
    );
}

export default Home;
