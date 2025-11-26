import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';

function FindCollaborators() {
    const navigate = useNavigate();
    const [activists, setActivists] = useState([]);
    const [search, setSearch] = useState({
        keyword: '',
        location: ''
    });
    const [loading, setLoading] = useState(false);
    const [expandedCards, setExpandedCards] = useState({});
    const [showPasswordPrompt, setShowPasswordPrompt] = useState({});
    const [passwords, setPasswords] = useState({});
    const [passwordErrors, setPasswordErrors] = useState({});
    const cardRefs = useRef({});

    const fetchActivists = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search.keyword) params.append('keyword', search.keyword);
            if (search.location) params.append('location', search.location);

            const response = await fetch(`${API_BASE_URL}/api/activists?${params}`);
            const data = await response.json();
            if (data.message === 'success') {
                setActivists(data.data);
            }
        } catch (error) {
            console.error('Error fetching activists:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivists();
    }, [search]);

    const toggleExpand = (id) => {
        setExpandedCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const togglePasswordPrompt = (id) => {
        setShowPasswordPrompt(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
        if (showPasswordPrompt[id]) {
            setPasswords(prev => ({
                ...prev,
                [id]: ''
            }));
            setPasswordErrors(prev => ({
                ...prev,
                [id]: ''
            }));
        }
    };

    const handlePasswordChange = (id, value) => {
        setPasswords(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleEditSubmit = async (id) => {
        const password = passwords[id];

        if (!password || password.trim() === '') {
            alert('Please enter a password');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/activists/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, password }),
            });

            if (response.ok) {
                const result = await response.json();
                const postData = result.data;

                navigate(`/post?edit=true&id=${id}`, {
                    state: {
                        ...postData,
                        password
                    }
                });
            } else {
                const error = await response.json();
                if (response.status === 401) {
                    setPasswordErrors(prev => ({
                        ...prev,
                        [id]: 'Password Incorrect'
                    }));
                } else if (response.status === 429) {
                    setPasswordErrors(prev => ({
                        ...prev,
                        [id]: error.error || 'Too many attempts. Please wait an hour before trying again.'
                    }));
                } else {
                    setPasswordErrors(prev => ({
                        ...prev,
                        [id]: error.error || 'Failed to verify password'
                    }));
                }
            }
        } catch (error) {
            console.error('Error verifying password:', error);
            alert('Failed to verify password');
        }
    };

    return (
        <div className="page-container">
            <header className="page-header">
                <Link to="/post" className="back-link">← Post a Collaboration Idea</Link>
                <h1>Find Collaborators</h1>
            </header>

            <section className="form-container search-container">
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Search by keyword..."
                        value={search.keyword}
                        onChange={(e) => setSearch({ ...search, keyword: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Filter by location..."
                        value={search.location}
                        onChange={(e) => setSearch({ ...search, location: e.target.value })}
                    />
                </div>
            </section>

            <div className="activist-grid">
                {activists.map((activist) => {
                    const isLong = activist.interest.length > 200;
                    const isExpanded = !!expandedCards[activist.id];
                    const isEditing = !!showPasswordPrompt[activist.id];
                    const shouldExpand = isExpanded || isEditing;

                    const displayText = isLong && !isExpanded
                        ? activist.interest.substring(0, 200) + '...'
                        : activist.interest;

                    return (
                        <div
                            key={activist.id}
                            style={{
                                position: 'relative',
                                minHeight: shouldExpand && cardRefs.current[activist.id]
                                    ? `${cardRefs.current[activist.id]}px`
                                    : 'auto'
                            }}
                        >
                            <article
                                ref={(el) => {
                                    if (el && !shouldExpand) {
                                        const style = window.getComputedStyle(el);
                                        const marginBottom = parseFloat(style.marginBottom);
                                        cardRefs.current[activist.id] = el.offsetHeight + marginBottom;
                                    }
                                }}
                                className={`activist-card ${shouldExpand ? 'expanded' : ''}`}
                            >
                                <div className="card-header">
                                    <span className="alias-badge">{activist.alias || 'Anonymous'}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }}>
                                        {new Date(activist.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="interest">
                                    {displayText}
                                    {isLong && !isExpanded && (
                                        <button
                                            onClick={() => toggleExpand(activist.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#80A8FF',
                                                cursor: 'pointer',
                                                padding: 0,
                                                font: 'inherit',
                                                textDecoration: 'underline',
                                                display: 'block',
                                                marginTop: '0.5rem'
                                            }}
                                        >
                                            continue reading
                                        </button>
                                    )}
                                    {isLong && isExpanded && (
                                        <button
                                            onClick={() => toggleExpand(activist.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#80A8FF',
                                                cursor: 'pointer',
                                                padding: '0.5rem 0 0 0',
                                                font: 'inherit',
                                                fontSize: '0.9em',
                                                textDecoration: 'underline',
                                                display: 'block'
                                            }}
                                        >
                                            Show less
                                        </button>
                                    )}
                                </h3>
                                <div className="location-badge">{activist.location}</div>
                                <div className="signal-box">
                                    <svg className="signal-icon" viewBox="0 0 24 24">
                                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                                    </svg>
                                    {activist.signal_username}
                                </div>

                                {activist.hasPassword && (
                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                                        {!showPasswordPrompt[activist.id] ? (
                                            <button
                                                onClick={() => {
                                                    togglePasswordPrompt(activist.id);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#80A8FF',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    font: 'inherit',
                                                    fontSize: '0.9rem',
                                                    textDecoration: 'underline'
                                                }}
                                            >
                                                Edit
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <input
                                                    type="password"
                                                    placeholder="Enter password"
                                                    value={passwords[activist.id] || ''}
                                                    onChange={(e) => handlePasswordChange(activist.id, e.target.value)}
                                                    style={{
                                                        padding: '0.5rem',
                                                        borderRadius: '0.25rem',
                                                        border: '1px solid var(--glass-border)',
                                                        fontSize: '0.9rem'
                                                    }}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleEditSubmit(activist.id);
                                                        }
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={() => handleEditSubmit(activist.id)}
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.5rem',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        Submit
                                                    </button>
                                                    <button
                                                        onClick={() => togglePasswordPrompt(activist.id)}
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.5rem',
                                                            fontSize: '0.85rem',
                                                            background: '#6b7280'
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                                {passwordErrors[activist.id] && (
                                                    <div style={{
                                                        color: 'red',
                                                        fontSize: '0.85rem',
                                                        marginTop: '0.5rem',
                                                        textAlign: 'center'
                                                    }}>
                                                        {passwordErrors[activist.id]}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        </div>
                    );
                })}
            </div>

            {activists.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>
                    No activists found matching your criteria.
                </div>
            )}
        </div>
    );
}

export default FindCollaborators;
