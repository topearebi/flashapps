/**
 * js/github-sync.js - Serverless Cross-Device Sync Engine
 * Direct integration with GitHub REST API (v3) via Personal Access Token (PAT).
 * 
 * Endpoints targeted:
 *  GET  /repos/{owner}/{repo}/contents/{path} -> Fetch remote JSON & file SHA
 *  PUT  /repos/{owner}/{repo}/contents/{path} -> Commit merged JSON state
 */

export class GitHubSync extends EventTarget {
  static CONFIG_KEY = "speedrecall_github_sync_cfg_v1";

  constructor(store) {
    super();
    this.store = store;
    this.config = {
      token: "",
      repo: "",        // Format: "owner/repository"
      branch: "main",
      filePath: "speedrecall-decks.json"
    };
    this.lastRemoteSha = null;
    this.loadConfig();
  }

  loadConfig() {
    const raw = localStorage.getItem(GitHubSync.CONFIG_KEY);
    if (raw) {
      try {
        this.config = { ...this.config, ...JSON.parse(raw) };
      } catch (err) {
        console.warn("Could not read GitHub sync configuration:", err);
      }
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(GitHubSync.CONFIG_KEY, JSON.stringify(this.config));
    this.dispatchEvent(new CustomEvent("config-updated", { detail: { ...this.config } }));
  }

  isConfigured() {
    return Boolean(this.config.token && this.config.repo && this.config.filePath);
  }

  /**
   * Helper to construct authorized GitHub API headers
   */
  getHeaders() {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${this.config.token.trim()}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  /**
   * Converts UTF-8 string to base64 safely without Latin-1 clipping
   */
  static encodeBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Decodes base64 string back to valid UTF-8 string
   */
  static decodeBase64(b64) {
    const binary = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  /**
   * Pulls remote data from repository and merges it into the local store
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async pullFromRemote() {
    if (!this.isConfigured()) {
      return { success: false, message: "Missing required token, repository, or file path." };
    }

    const { repo, filePath, branch } = this.config;
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;

    try {
      const res = await fetch(url, { headers: this.getHeaders() });

      if (res.status === 404) {
        return { success: false, message: "Remote file not found. Push local state first to create it." };
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const fileData = await res.json();
      this.lastRemoteSha = fileData.sha;

      const rawJson = GitHubSync.decodeBase64(fileData.content);
      const parsed = JSON.parse(rawJson);

      if (!parsed.decks) {
        throw new Error("Invalid payload: Missing 'decks' object in remote file.");
      }

      // Merge remote decks into local store
      this.store.replaceDecks(parsed.decks);

      return { 
        success: true, 
        message: `Successfully pulled ${Object.keys(parsed.decks).length} deck(s) from GitHub.` 
      };
    } catch (err) {
      return { success: false, message: `Pull failed: ${err.message}` };
    }
  }

  /**
   * Commits local state directly to the GitHub repository via REST API
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async pushToRemote() {
    if (!this.isConfigured()) {
      return { success: false, message: "Missing required token, repository, or file path." };
    }

    const { repo, filePath, branch } = this.config;
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    try {
      // Step 1: Ensure we have the current remote file SHA if not cached
      if (!this.lastRemoteSha) {
        const checkRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
          headers: this.getHeaders()
        });

        if (checkRes.ok) {
          const remoteInfo = await checkRes.json();
          this.lastRemoteSha = remoteInfo.sha;
        } else if (checkRes.status !== 404) {
          const errPayload = await checkRes.json().catch(() => ({}));
          throw new Error(errPayload.message || `HTTP ${checkRes.status}`);
        }
      }

      // Step 2: Prepare payload
      const syncPayload = {
        schemaVersion: this.store.schemaVersion,
        timestamp: new Date().toISOString(),
        decks: this.store.decks
      };

      const contentBase64 = GitHubSync.encodeBase64(JSON.stringify(syncPayload, null, 2));

      const requestBody = {
        message: `SpeedRecall Sync: ${new Date().toLocaleString()}`,
        content: contentBase64,
        branch: branch || "main"
      };

      if (this.lastRemoteSha) {
        requestBody.sha = this.lastRemoteSha;
      }

      // Step 3: Send commit
      const putRes = await fetch(url, {
        method: "PUT",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!putRes.ok) {
        const errorData = await putRes.json().catch(() => ({}));
        if (putRes.status === 409) {
          this.lastRemoteSha = null; // Clear invalidated SHA
          throw new Error("Conflict detected (409): Remote repository has newer changes. Pull first.");
        }
        throw new Error(errorData.message || `HTTP ${putRes.status}`);
      }

      const result = await putRes.json();
      this.lastRemoteSha = result.content.sha;

      return { success: true, message: "Pushed state successfully to GitHub." };
    } catch (err) {
      return { success: false, message: `Push failed: ${err.message}` };
    }
  }
}
