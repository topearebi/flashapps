import React from 'react';

export const Button = ({ children, onClick, className = '' }) => {
    return (
        <button className={`btn-primary ${className}`} onClick={onClick}>
            {children}
        </button>
    );
};
