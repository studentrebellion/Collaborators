import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import API_BASE_URL from '../config';

function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [activists, setActivists] = useState([]);
    const [search, setSearch] = useState({ keyword: '', location: '' });
    const [loading, setLoading] = useState(false);
    const [expandedCards, setExpandedCards] = useState({});
    const cardRefs = useRef({});

    // Change Password State
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (response.ok) {
                setIsAuthenticated(true);
                fetchActivists();
            } else {
                alert('Invalid Password');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed');
        }
    };

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
        if (isAuthenticated) {
            fetchActivists();
        }
    }, [search, isAuthenticated]);

    const handleDelete = async (id) => {
        if (!window.confirm('ADMIN ACTION: Are you sure you want to delete this post? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/activists/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminPassword: password })
            });

            if (response.ok) {
                setActivists(prev => prev.filter(a => a.id !== id));
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert("New passwords don't match");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: password, newPassword })
            });

            if (response.ok) {
                alert('Password changed successfully. Please log in again.');
                setIsAuthenticated(false);
                setPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setShowChangePassword(false);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to change password');
            }
        } catch (error) {
            console.error('Change password error:', error);
            alert('Failed to change password');
        }
    };

    const toggleExpand = (id) => {
        setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!isAuthenticated) {
        return (
            <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="form-container" style={{ width: '100%', maxWidth: '400px' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Admin Login</h2>
                    <form onSubmit={handleLogin} className="input-group vertical-form">
                        <input
                            type="password"
                            placeholder="Enter Admin Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                        <button type="submit" style={{ width: '100%' }}>Login</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <header className="page-header">
                <Link to="/" className="back-link">← Home</Link>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                    <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
                    <button
                        onClick={() => setShowChangePassword(!showChangePassword)}
                        style={{ position: 'absolute', right: 0, fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                    >
                        {showChangePassword ? 'Cancel' : 'Change Password'}
                    </button>
                </div>
            </header>

            {showChangePassword && (
                <section className="form-container" style={{ marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Change Admin Password</h3>
                    <form onSubmit={handleChangePassword} className="input-group vertical-form">
                        <input
                            type="password"
                            placeholder="New Password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Confirm New Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <button type="submit">Update Password</button>
                    </form>
                </section>
            )}

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
                    const shouldExpand = isExpanded;

                    const displayText = isLong && !isExpanded
                        ? activist.interest.substring(0, 200) + '...'
                        : activist.interest;

                    return (
                        <div
                            key={activist.id}
                            className="activist-card-wrapper"
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
                                style={{ border: '1px solid rgba(220, 38, 38, 0.3)' }} // Red border for admin view
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

                                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                                    <button
                                        onClick={() => handleDelete(activist.id)}
                                        style={{
                                            width: '100%',
                                            background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        DELETE POST (ADMIN)
                                    </button>
                                </div>
                            </article>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AdminDashboard;
