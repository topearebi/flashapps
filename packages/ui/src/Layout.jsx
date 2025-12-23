import React from 'react';

export const Layout = ({ children }) => {
    return (
        <div className="app-container" style={{ minHeight: '100vh', padding: '2rem' }}>
            <nav className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Tope AI Portfolio</h2>
                <div>
                    {/* Navigation will go here - need to handle cross-app linking */}
                </div>
            </nav>
            <main>
                {children}
            </main>
        </div>
    );
};
