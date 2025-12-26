import { useState } from 'react';
import { Layout, Button, APIKeyModal } from '@tope/ui';
import { getStoredKey, setStoredKey, createAIClient } from '@tope/utils';

function App() {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [cards, setCards] = useState([]);
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [flipped, setFlipped] = useState({});

    const generateCards = async () => {
        const key = getStoredKey('openai');
        if (!key) {
            setIsKeyModalOpen(true);
            return;
        }

        setLoading(true);
        try {
            const ai = createAIClient(key);
            const completion = await ai.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a flashcard generator. Return a JSON array of 5 objects with 'front' and 'back' keys. No other text." },
                    { role: "user", content: `Generate flashcards for: ${topic}` }
                ],
                model: "gpt-3.5-turbo",
            });

            const content = completion.choices[0].message.content;
            // Basic cleaning to ensure JSON parse works
            const jsonStr = content.replace(/^```json/, '').replace(/```$/, '');
            const data = JSON.parse(jsonStr);
            setCards(data);
        } catch (error) {
            console.error(error);
            alert('Failed to generate cards. Check console/API Key.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = (key) => {
        setStoredKey('openai', key);
        setIsKeyModalOpen(false);
        generateCards(); // Retry
    };

    return (
        <Layout>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ textAlign: 'center' }}>⚡️ AI Flashcards</h1>

                <div className="glass-panel" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <input
                        type="text"
                        placeholder="Enter a topic (e.g., 'Photosynthesis', 'React Hooks')"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                    />
                    <Button onClick={generateCards} disabled={loading}>
                        {loading ? 'Generating...' : 'Create Deck'}
                    </Button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                    {cards.map((card, index) => (
                        <div
                            key={index}
                            className="glass-panel"
                            style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', perspective: '1000px' }}
                            onClick={() => setFlipped(prev => ({ ...prev, [index]: !prev[index] }))}
                        >
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                {flipped[index] ? (
                                    <div style={{ color: 'var(--secondary-color)', fontWeight: 'bold' }}>{card.back}</div>
                                ) : (
                                    <div style={{ fontSize: '1.2rem' }}>{card.front}</div>
                                )}
                                <div style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.5 }}>
                                    {flipped[index] ? '(Back)' : '(Front)'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <APIKeyModal
                    isOpen={isKeyModalOpen}
                    onClose={() => setIsKeyModalOpen(false)}
                    onSave={handleSaveKey}
                />
            </div>
        </Layout>
    )
}

export default App
