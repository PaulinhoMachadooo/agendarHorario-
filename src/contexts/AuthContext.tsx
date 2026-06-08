import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";

interface Funcionario {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  nivel_acesso: string;
  ativo: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  funcionario: Funcionario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    userData: { nome: string; cargo: string; nivel_acesso: string },
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: () => boolean;
  isBarbeiro: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFuncionario = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle();

      if (error) throw error;
      setFuncionario(data);
    } catch (error) {
      console.error("Erro ao buscar funcionário:", error);
      setFuncionario(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          fetchFuncionario(session.user.id);
        }, 0);
      } else {
        setFuncionario(null);
      }

      setLoading(false);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchFuncionario(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    userData: { nome: string; cargo: string; nivel_acesso: string },
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: userData.nome,
          cargo: userData.cargo,
          nivel_acesso: userData.nivel_acesso,
        },
      },
    });

    if (error) return { error };

    // Se confirmação de email está desabilitada, criar funcionário imediatamente
    if (data.user && data.session) {
      try {
        const { error: funcionarioError } = await supabase
          .from("funcionarios")
          .insert([
            {
              user_id: data.user.id,
              nome: userData.nome,
              email: email,
              telefone: "",
              cargo: userData.cargo as any,
              nivel_acesso: userData.nivel_acesso as any,
            },
          ]);

        if (funcionarioError) {
          console.error("Erro ao criar funcionário:", funcionarioError);
          // Não retornar erro aqui pois o trigger pode ter criado
        }
      } catch (insertError) {
        console.error("Erro na inserção:", insertError);
        // Não retornar erro aqui pois o trigger pode ter criado
      }
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setFuncionario(null);
  };

  const isAdmin = () => {
    // Check funcionario record first
    if (funcionario?.nivel_acesso === "administrador") return true;

    // Fallback: check user metadata
    if (session?.user?.user_metadata?.nivel_acesso === "administrador")
      return true;

    return false;
  };
  const isBarbeiro = () => funcionario?.cargo === "barbeiro";

  const value = {
    user,
    session,
    funcionario,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isBarbeiro,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
