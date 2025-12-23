---
description: How to add a new application to the monorepo
---

# Workflow: Add New App

1. **Create Directory**:
   ```bash
   mkdir apps/<app-name>
   cd apps/<app-name>
   ```

2. **Initialize Vite App**:
   ```bash
   pnpm create vite . --template react
   ```

3. **Configure `package.json`**:
   - Change `name` to `@tope/<app-name>`.
   - Add dependencies:
     ```json
     "dependencies": {
       "@tope/ui": "workspace:*",
       "@tope/utils": "workspace:*"
     }
     ```

4. **Configure `vite.config.js`**:
   - Set base path:
     ```javascript
     export default defineConfig({
       base: '/<app-name>/', // OR '/' for the main portfolio
       // ...
     })
     ```

5. **Install Dependencies**:
   ```bash
   pnpm install
   ```

6. **Start Dev Server**:
   ```bash
   pnpm dev
   ```
