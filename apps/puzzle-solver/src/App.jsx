import { useState } from 'react';
import { Layout, Button, APIKeyModal } from '@tope/ui';
import { getStoredKey, setStoredKey, createAIClient } from '@tope/utils';

function App() {
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const solvePuzzle = async () => {
        const key = getStoredKey('openai');
        if (!key) {
            setIsKeyModalOpen(true);
            return;
        }

        if (!image) return;

        setLoading(true);
        try {
            const ai = createAIClient(key);
            const completion = await ai.chat.completions.create({
                model: "gpt-4-vision-preview",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Identify this puzzle (Crossword/Sudoku) and provide a JSON representation of the grid and clues so it can be played digitally." },
                            { type: "image_url", image_url: { url: image } },
                        ],
                    },
                ],
            });

            setResult(completion.choices[0].message.content);
        } catch (error) {
            console.error(error);
            alert('Failed to analyze puzzle. Check API Key validity for Vision access.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = (key) => {
        setStoredKey('openai', key);
        setIsKeyModalOpen(false);
        solvePuzzle();
    };

    return (
        <Layout>
            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <h1>🧩 Puzzle Digitizer</h1>

                <div className="glass-panel" style={{ padding: '3rem', borderStyle: 'dashed' }}>
                    {!image ? (
                        <>
                            <p>Upload a photo of a Sudoku or Crossword puzzle</p>
                            <input type="file" accept="image/*" onChange={handleImageUpload} />
                        </>
                    ) : (
                        <div>
                            <img src={image} alt="Puzzle" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', marginBottom: '1rem' }} />
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <Button onClick={() => setImage(null)} style={{ background: 'gray' }}>Clear</Button>
                                <Button onClick={solvePuzzle} disabled={loading}>
                                    {loading ? 'Analyzing...' : 'Digitize Puzzle'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {result && (
                    <div className="glass-panel" style={{ marginTop: '2rem', textAlign: 'left', overflowX: 'auto' }}>
                        <h3>Analysis Result</h3>
                        <pre>{result}</pre>
                    </div>
                )}

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
