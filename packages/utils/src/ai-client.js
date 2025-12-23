import OpenAI from 'openai';

export const createAIClient = (apiKey) => {
    return new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // For this portfolio demo, we allow client-side calls
    });
};
