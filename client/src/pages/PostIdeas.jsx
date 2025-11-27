import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import API_BASE_URL from '../config';

function PostIdeas() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editMode = searchParams.get('edit') === 'true';
    const editId = searchParams.get('id');

    const [formData, setFormData] = useState({
        interest: '',
        location: '',
        signal_username: '',
        alias: '',
        password: ''
    });

    useEffect(() => {
        // If in edit mode, data should be passed via location state
        if (editMode && window.history.state && window.history.state.usr) {
            const data = window.history.state.usr;
            setFormData({
                interest: data.interest || '',
                location: data.location || '',
                signal_username: data.signal_username || '',
                alias: data.alias || '',
                password: data.password || ''
            });
        }
    }, [editMode]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            ...formData,
            location: formData.location.trim() || 'Online'
        };

        try {
            if (editMode) {
                // Update existing post
                const response = await fetch(`${API_BASE_URL}/api/activists/${editId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    setFormData({ interest: '', location: '', signal_username: '', alias: '', password: '' });
                    navigate('/find');
                } else {
                    const error = await response.json();
                    if (response.status === 401) {
                        alert('Password Incorrect');
                    } else {
                        alert(error.error || 'Failed to update post');
                    }
                }
            } else {
                // Create new post
                const response = await fetch(`${API_BASE_URL}/api/activists`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    setFormData({ interest: '', location: '', signal_username: '', alias: '', password: '' });
                    navigate('/find');
                } else {
                    const error = await response.json();
                    alert(error.error || 'Failed to create post');
                }
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred: ' + error.message);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this post?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/activists/${editId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password: formData.password }),
            });

            if (response.ok) {
                navigate('/find');
            } else {
                const error = await response.json();
                if (response.status === 401) {
                    alert('Password Incorrect');
                } else {
                    alert(error.error || 'Failed to delete post');
                }
            }
        } catch (error) {
            console.error('Error deleting post:', error);
        }
    };

    const handleInterestChange = (e) => {
        const text = e.target.value;
        if (text.length <= 600) {
            setFormData({ ...formData, interest: text });
        }
    };

    const charCount = formData.interest.length;

    return (
        <div className="page-container">
            <header className="page-header">
                <Link to="/find" className="back-link">← Find Collaborators</Link>
                <h1>{editMode ? 'Post a Collaboration Idea' : 'Post a Collaboration Idea'}</h1>
            </header>

            <section className="form-container">

                <form onSubmit={handleSubmit} className="input-group vertical-form">
                    <div style={{ width: '100%' }}>
                        <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>What do you want to collaborate on?</p>
                        <textarea
                            value={formData.interest}
                            onChange={handleInterestChange}
                            required
                            rows={3}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                        <div style={{
                            textAlign: 'right',
                            fontSize: '0.8rem',
                            color: charCount >= 600 ? 'red' : 'var(--text-muted)',
                            marginTop: '0.25rem'
                        }}>
                            {charCount}/600 characters
                        </div>
                    </div>
                    <div>
                        <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Signal Username</p>
                        <input
                            type="text"
                            value={formData.signal_username}
                            onChange={(e) => setFormData({ ...formData, signal_username: e.target.value })}
                            required
                            maxLength={15}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <p style={{ marginBottom: '0.5rem' }}><span style={{ fontWeight: 'bold' }}>Location</span> (In what area(s) do you want to find collaborators? If you want to collaborate remotely, leave this blank.) </p>                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            maxLength={100}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div>
                        <p style={{ marginBottom: '0.5rem' }}><span style={{ fontWeight: 'bold' }}>Alias</span> (Optional)</p>
                        <input
                            type="text"
                            value={formData.alias}
                            onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                            maxLength={15}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <p style={{ marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 'bold' }}>Password</span> {editMode ? "(required to update)" : "(Optional. This allows for editing or deleting your post.)"}
                        </p>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required={editMode}
                            maxLength={15}
                            style={{ width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '15px' }}>
                        <button type="submit" style={{ flex: 1 }}>
                            {editMode ? 'Update' : 'Post'}
                        </button>
                        {editMode && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                style={{
                                    flex: 1,
                                    background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                                }}
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </form>
            </section>
        </div>
    );
}

export default PostIdeas;

