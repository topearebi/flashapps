import { Layout, Button } from '@tope/ui'

function App() {
    return (
        <Layout>
            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '1rem', background: 'linear-gradient(to right, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    AI-Powered Prototypes
                </h1>
                <p style={{ fontSize: '1.25rem', marginBottom: '3rem', opacity: 0.8 }}>
                    A collection of experimental applications exploring the intersection of AI and interactivity.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {/* Project Card: Flashcards */}
                    <div className="glass-panel" style={{ textAlign: 'left' }}>
                        <h3>⚡️ AI Flashcards</h3>
                        <p>Generate study decks from any topic using LLMs. Includes a speed memorization mode.</p>
                        <a href="/flashcards">
                            <Button style={{ marginTop: '1rem' }}>Launch App</Button>
                        </a>
                    </div>

                    {/* Project Card: Puzzle Solver */}
                    <div className="glass-panel" style={{ textAlign: 'left' }}>
                        <h3>🧩 Puzzle Digitizer</h3>
                        <p>Convert physical puzzle images into playable digital versions using Computer Vision.</p>
                        <a href="/puzzle-solver">
                            <Button style={{ marginTop: '1rem' }}>Launch App</Button>
                        </a>
                    </div>
                </div>
            </div>
        </Layout>
    )
}

export default App
