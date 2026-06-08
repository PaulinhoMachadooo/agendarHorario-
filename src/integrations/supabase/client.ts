import type { Database } from "./types";

// Hostinger API client (Supabase-compatible surface used by the app)

const API_URL = import.meta.env.VITE_HOSTINGER_API_URL;

if (!API_URL) {
  console.warn(
    "VITE_HOSTINGER_API_URL não definida. Configure a URL da API PHP da Hostinger no .env.",
  );
}

type Filter = {
  column: string;
  operator: "eq" | "neq" | "gte" | "lte" | "lt";
  value: unknown;
};

type QueryAction = "select" | "insert" | "update" | "delete";

export type User = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
};

export type Session = {
  access_token: string;
  user: User;
};

type AuthChangeEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT";
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const SESSION_KEY = "hostinger_auth_session";
const listeners = new Set<AuthListener>();

function getStoredSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function setStoredSession(session: Session | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function emitAuth(event: AuthChangeEvent, session: Session | null) {
  listeners.forEach((listener) => listener(event, session));
}

async function request<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!API_URL) {
    throw new Error("Hostinger API não configurada (VITE_HOSTINGER_API_URL).");
  }

  const session = getStoredSession();
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await response.text();
  let json: any = null;

  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      const preview = text
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
      throw new Error(
        preview || "A API Hostinger retornou uma resposta inválida.",
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      (json?.error?.message ?? text.trim()) || "Erro na API Hostinger.",
    );
  }

  if (!json) {
    throw new Error(
      "A API Hostinger retornou uma resposta vazia. Verifique se os arquivos PHP foram publicados corretamente e se o banco está configurado.",
    );
  }

  return json as T;
}

class QueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private action: QueryAction = "select";
  private columns = "*";
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rows: Record<string, unknown>[] = [];
  private values: Record<string, unknown> = {};
  private wantsSingle = false;
  private wantsMaybeSingle = false;

  constructor(private table: keyof Database["public"]["Tables"]) {}

  select(columns = "*") {
    this.action = "select";
    this.columns = columns;
    return this;
  }

  insert(rows: Record<string, unknown>[]) {
    this.action = "insert";
    this.rows = rows;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.action = "update";
    this.values = values;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, operator: "neq", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push({ column, operator: "lt", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this;
  }

  private async execute() {
    try {
      const result = await request<{ data: any; error: any }>("/db/query.php", {
        table: this.table,
        action: this.action,
        columns: this.columns,
        filters: this.filters,
        orderBy: this.orderBy,
        rows: this.rows,
        values: this.values,
        single: this.wantsSingle,
        maybeSingle: this.wantsMaybeSingle,
      });

      return result;
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message ?? "Erro desconhecido" },
      };
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(
      onfulfilled ?? undefined,
      onrejected ?? undefined,
    );
  }
}

export const supabase = {
  from(table: keyof Database["public"]["Tables"]) {
    return new QueryBuilder(table);
  },

  auth: {
    async getSession() {
      const session = getStoredSession();
      return { data: { session }, error: null };
    },

    onAuthStateChange(callback: AuthListener) {
      listeners.add(callback);
      callback("INITIAL_SESSION", getStoredSession());

      return {
        data: {
          subscription: {
            unsubscribe: () => listeners.delete(callback),
          },
        },
      };
    },

    async signInWithPassword({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) {
      try {
        const result = await request<{
          data: { user: User; session: Session };
          error: null;
        }>("/auth/signin.php", {
          email,
          password,
        });

        setStoredSession(result.data.session);
        emitAuth("SIGNED_IN", result.data.session);

        return result;
      } catch (error: any) {
        return {
          data: { user: null, session: null },
          error: { message: error.message },
        };
      }
    },

    async signUp({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
    }) {
      try {
        const result = await request<{
          data: { user: User; session: Session };
          error: null;
        }>("/auth/signup.php", {
          email,
          password,
          metadata: options?.data ?? {},
        });

        setStoredSession(result.data.session);
        emitAuth("SIGNED_IN", result.data.session);

        return result;
      } catch (error: any) {
        return {
          data: { user: null, session: null },
          error: { message: error.message },
        };
      }
    },

    async signOut() {
      try {
        await request("/auth/signout.php");
      } catch {
        // Mesmo se API falhar, limpar sessão local.
      }

      setStoredSession(null);
      emitAuth("SIGNED_OUT", null);
      return { error: null };
    },
  },

  channel() {
    return {
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    };
  },

  removeChannel() {
    return true;
  },
};
