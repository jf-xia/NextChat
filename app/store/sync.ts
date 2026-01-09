import { getClientConfig } from "../config/client";
import { ApiPath, STORAGE_KEY, StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import {
  AppState,
  getLocalAppState,
  GetStoreState,
  mergeAppState,
  setLocalAppState,
} from "../utils/sync";
import { downloadAs, readFromFile } from "../utils";
import { showToast } from "../components/ui-lib";
import Locale from "../locales";
import { createSyncClient, ProviderType } from "../utils/cloud";
import { getToken, msalInstance } from "../auth/authConfig";
import { createEmptyMask } from "./mask";

export interface WebDavConfig {
  server: string;
  username: string;
  password: string;
}

const isApp = !!getClientConfig()?.isApp;
export type SyncStore = GetStoreState<typeof useSyncStore>;

const DEFAULT_SYNC_STATE = {
  provider: ProviderType.WebDAV,
  useProxy: true,
  proxyUrl: ApiPath.Cors as string,

  webdav: {
    endpoint: "",
    username: "",
    password: "",
  },

  upstash: {
    endpoint: "",
    username: STORAGE_KEY,
    apiKey: "",
  },

  lastSyncTime: 0,
  lastProvider: "",
};

export const useSyncStore = createPersistStore(
  DEFAULT_SYNC_STATE,
  (set, get) => ({
    cloudSync() {
      const config = get()[get().provider];
      return Object.values(config).every((c) => c.toString().length > 0);
    },

    markSyncTime() {
      set({ lastSyncTime: Date.now(), lastProvider: get().provider });
    },

    export() {
      const state = getLocalAppState();
      const datePart = isApp
        ? `${new Date().toLocaleDateString().replace(/\//g, "_")} ${new Date()
            .toLocaleTimeString()
            .replace(/:/g, "_")}`
        : new Date().toLocaleString();

      const fileName = `Backup-${datePart}.json`;
      downloadAs(JSON.stringify(state), fileName);
    },

    async import() {
      const rawContent = await readFromFile();

      try {
        const remoteState = JSON.parse(rawContent) as AppState;
        const localState = getLocalAppState();
        mergeAppState(localState, remoteState);
        setLocalAppState(localState);
        location.reload();
      } catch (e) {
        console.error("[Import]", e);
        showToast(Locale.Settings.Sync.ImportFailed);
      }
    },

    getClient() {
      const provider = get().provider;
      const client = createSyncClient(provider, get());
      return client;
    },

    async sync() {
      const localState = getLocalAppState();
      const provider = get().provider;
      const config = get()[provider];
      const client = this.getClient();

      try {
        const remoteState = await client.get(config.username);
        if (!remoteState || remoteState === "") {
          await client.set(config.username, JSON.stringify(localState));
          console.log(
            "[Sync] Remote state is empty, using local state instead.",
          );
          return;
        } else {
          const parsedRemoteState = JSON.parse(
            await client.get(config.username),
          ) as AppState;
          mergeAppState(localState, parsedRemoteState);
          setLocalAppState(localState);
        }
      } catch (e) {
        console.log("[Sync] failed to get remote state", e);
        throw e;
      }

      await client.set(config.username, JSON.stringify(localState));

      this.markSyncTime();
    },

    async syncApi() {
      const localState = getLocalAppState();

      try {
        const accessToken = await getToken(msalInstance);
        if (!accessToken) {
          showToast(Locale.Settings.Sync.ImportFailed);
          return;
        }

        const res = await fetch("/api/sessions", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("[SyncApi] failed to fetch /api/sessions", res.status, text);
          showToast(Locale.Settings.Sync.ImportFailed);
          return;
        }

        const remoteSessions = (await res.json()) as any[];

        const normalizedSessions = Array.isArray(remoteSessions)
          ? remoteSessions.map((s) => {
              let messages: any[] = [];
              try {
                if (typeof s?.messages === "string") {
                  messages = JSON.parse(s.messages);
                } else if (Array.isArray(s?.messages)) {
                  messages = s.messages;
                }
              } catch (e) {
                console.warn("[SyncApi] failed to parse session messages", e);
              }

              const lastUpdateMs = s?.lastUpdate
                ? new Date(s.lastUpdate).getTime()
                : Date.now();

              return {
                id: String(s?.id ?? ""),
                topic: String(s?.topic ?? ""),
                memoryPrompt: String(s?.memoryPrompt ?? ""),
                messages,
                stat: {
                  tokenCount: Number(s?.tokenCount ?? 0),
                  wordCount: Number(s?.wordCount ?? 0),
                  charCount: Number(s?.charCount ?? 0),
                },
                lastUpdate: Number.isFinite(lastUpdateMs) ? lastUpdateMs : Date.now(),
                lastSummarizeIndex: Number(s?.lastSummarizeIndex ?? 0),
                clearContextIndex: Number(s?.clearContextIndex ?? 0),
                mask: createEmptyMask(),
              };
            })
          : [];

        const parsedRemoteState = {
          [StoreKey.Chat]: {
            sessions: normalizedSessions,
          },
        } as any as AppState;
        mergeAppState(localState, parsedRemoteState);
        setLocalAppState(localState);
      } catch (e) {
        console.log("[Sync] failed to get remote state", e);
        throw e;
      }

      // await client.set(config.username, JSON.stringify(localState));
      this.markSyncTime();
    },

    async check() {
      const client = this.getClient();
      return await client.check();
    },
  }),
  {
    name: StoreKey.Sync,
    version: 1.2,

    migrate(persistedState, version) {
      const newState = persistedState as typeof DEFAULT_SYNC_STATE;

      if (version < 1.1) {
        newState.upstash.username = STORAGE_KEY;
      }

      if (version < 1.2) {
        if (
          (persistedState as typeof DEFAULT_SYNC_STATE).proxyUrl ===
          "/api/cors/"
        ) {
          newState.proxyUrl = "";
        }
      }

      return newState as any;
    },
  },
);
