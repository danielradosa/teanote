export const storage = {
    get<T>(key: string, fallback?: T): T {
        try {
            const data = localStorage.getItem(key)
            return data ? JSON.parse(data) : (fallback as T)
        } catch {
            return fallback as T
        }
    },

    set<T>(key: string, value: T) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    remove(key: string) {
        localStorage.removeItem(key);
    }
};