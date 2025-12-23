import React, { useState, useEffect } from 'react';

export const APIKeyModal = ({ isOpen, onClose, onSave }) => {
    const [key, setKey] = useState('');

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel" style={{ width: '400px' }}>
                <h3>Enter OpenAI Key</h3>
                <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Your key is stored locally in your browser.</p>
                <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px' }}>Cancel</button>
                    <button onClick={() => onSave(key)} className="btn-primary">Save Token</button>
                </div>
            </div>
        </div>
    );
};
