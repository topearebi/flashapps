export const getStoredKey = (provider) => {
    return localStorage.getItem(`tope_ai_key_${provider}`);
};

export const setStoredKey = (provider, key) => {
    localStorage.setItem(`tope_ai_key_${provider}`, key);
};
