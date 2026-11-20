import { sessionHeaders } from "./agent";
import { digestPayload } from "../utils/forYou";
import type { ForYouProfile } from "../utils/forYou";

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/**
 * Register (or update) the daily match email for a signed-in user. In
 * production the backend sends to the account's verified email, not the
 * contact email typed into the profile.
 */
export async function syncDigest(
    userId: string,
    email: string,
    profile: ForYouProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const res = await fetch(`${BASE_URL}/foryou/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": import.meta.env.VITE_API_KEY,
                ...(await sessionHeaders()),
            },
            body: JSON.stringify({
                user_id: userId,
                email,
                opt_in: profile.digestOptIn,
                prefs: digestPayload(profile),
            }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            return { ok: false, error: body?.detail ?? `HTTP ${res.status}` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
}
