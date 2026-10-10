const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

console.log("API_BASE_URL:", API_BASE_URL); // Temporary debug line

// Cookie utility functions
const COOKIE_OPTIONS = {
  path: "/",
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict" as const,
  httpOnly: false, // We need client-side access for API calls
};

function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=${
    COOKIE_OPTIONS.path
  };${COOKIE_OPTIONS.secure ? "secure;" : ""}samesite=${
    COOKIE_OPTIONS.sameSite
  }`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=${COOKIE_OPTIONS.path};`;
}

export class ApiClient {
  private static instance: ApiClient;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private useCookies: boolean = true; // Toggle between cookies and localStorage
  private tokenVersion: number = 0; // Track token changes

  private constructor() {
    if (typeof window !== "undefined") {
      this.loadTokensFromStorage();
    }
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private loadTokensFromStorage() {
    if (typeof window === "undefined") return;

    if (this.useCookies) {
      this.accessToken = getCookie("accessToken");
      this.refreshToken = getCookie("refreshToken");
    } else {
      this.accessToken = localStorage.getItem("accessToken");
      this.refreshToken = localStorage.getItem("refreshToken");
    }
  }

  private saveTokensToStorage(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    if (typeof window === "undefined") return;

    if (this.useCookies) {
      // Access token expires in 15 minutes, refresh token in 7 days
      setCookie("accessToken", accessToken, 1 / 96); // 15 minutes
      setCookie("refreshToken", refreshToken, 7);
    } else {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
    }
  }

  private clearTokensFromStorage() {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window === "undefined") return;

    if (this.useCookies) {
      deleteCookie("accessToken");
      deleteCookie("refreshToken");
    } else {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }

  // Method to toggle between cookie and localStorage storage
  public setStorageMethod(useCookies: boolean) {
    this.useCookies = useCookies;
    // Reload tokens from the new storage method
    this.loadTokensFromStorage();
  }

  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public getTokenVersion(): number {
    return this.tokenVersion;
  }

  /**
   * Restore a session at app start. If the (short-lived, 15-min) access token
   * has expired but a valid refresh token remains, silently mint a new access
   * token so a page reload / direct navigation doesn't bounce the user to
   * /login (BUG-003). Returns whether a usable access token is available after.
   */
  public async restoreSession(): Promise<boolean> {
    if (this.accessToken) return true;
    if (this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) this.tokenVersion++;
      return refreshed;
    }
    return false;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokensToStorage(data.accessToken, data.refreshToken);
        return true;
      } else {
        this.clearTokensFromStorage();
        return false;
      }
    } catch (error) {
      this.clearTokensFromStorage();
      return false;
    }
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // If unauthorized and we have a refresh token, try to refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Network error" }));

      // Standardize error format to ensure consistent structure
      let errorMessage = "An error occurred";

      if (typeof errorData === "string") {
        errorMessage = errorData;
      } else if (errorData.error && typeof errorData.error === "string") {
        errorMessage = errorData.error;
      } else if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        // Handle validation errors array from express-validator
        errorMessage = errorData.errors.map((e: any) => e.msg).join(", ");
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }

      // Throw a standardized error object with message property
      const standardError = new Error(errorMessage);
      (standardError as any).details = errorData;
      (standardError as any).status = response.status;
      throw standardError;
    }

    return response.json();
  }

  public setTokens(accessToken: string, refreshToken: string) {
    this.saveTokensToStorage(accessToken, refreshToken);
    this.tokenVersion++;
  }

  public clearTokens() {
    this.clearTokensFromStorage();
    this.tokenVersion++;
  }
}
