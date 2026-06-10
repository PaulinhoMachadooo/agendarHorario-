export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cliente_id: string;
          created_at: string;
          data_hora: string;
          funcionario: string;
          funcionario_id: string | null;
          forma_pagamento: string | null;
          id: string;
          observacoes: string | null;
          servico_id: string;
          status: string;
          tipo_pet: string;
          updated_at: string;
        };
        Insert: {
          cliente_id: string;
          created_at?: string;
          data_hora: string;
          funcionario?: string;
          funcionario_id?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          observacoes?: string | null;
          servico_id: string;
          status?: string;
          tipo_pet?: string;
          updated_at?: string;
        };
        Update: {
          cliente_id?: string;
          created_at?: string;
          data_hora?: string;
          funcionario?: string;
          funcionario_id?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          observacoes?: string | null;
          servico_id?: string;
          status?: string;
          tipo_pet?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agendamentos_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey";
            columns: ["servico_id"];
            isOneToOne: false;
            referencedRelation: "servicos";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          created_at: string;
          data_cadastro: string;
          email: string;
          id: string;
          nome: string;
          telefone: string;
          ultima_visita: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          data_cadastro?: string;
          email?: string;
          id?: string;
          nome: string;
          telefone?: string;
          ultima_visita?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          data_cadastro?: string;
          email?: string;
          id?: string;
          nome?: string;
          telefone?: string;
          ultima_visita?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      comissoes: {
        Row: {
          created_at: string;
          funcionario_id: string;
          id: string;
          tipo_comissao: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          funcionario_id: string;
          id?: string;
          tipo_comissao?: string;
          valor?: number;
        };
        Update: {
          created_at?: string;
          funcionario_id?: string;
          id?: string;
          tipo_comissao?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comissoes_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionarios";
            referencedColumns: ["id"];
          },
        ];
      };
      configuracoes_barbearia: {
        Row: {
          banner_url: string;
          created_at: string;
          dias_funcionamento: string[];
          endereco: string;
          horario_abertura: string;
          horario_almoco_fim: string | null;
          horario_almoco_inicio: string | null;
          horario_fechamento: string;
          id: string;
          logo_url: string;
          nome: string;
          telefone: string;
          updated_at: string;
        };
        Insert: {
          banner_url?: string;
          created_at?: string;
          dias_funcionamento?: string[];
          endereco?: string;
          horario_abertura?: string;
          horario_almoco_fim?: string | null;
          horario_almoco_inicio?: string | null;
          horario_fechamento?: string;
          id?: string;
          logo_url?: string;
          nome?: string;
          telefone?: string;
          updated_at?: string;
        };
        Update: {
          banner_url?: string;
          created_at?: string;
          dias_funcionamento?: string[];
          endereco?: string;
          horario_abertura?: string;
          horario_almoco_fim?: string | null;
          horario_almoco_inicio?: string | null;
          horario_fechamento?: string;
          id?: string;
          logo_url?: string;
          nome?: string;
          telefone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      funcionarios: {
        Row: {
          ativo: boolean;
          cargo: string;
          created_at: string;
          email: string;
          id: string;
          nivel_acesso: string;
          nome: string;
          telefone: string;
          user_id: string | null;
        };
        Insert: {
          ativo?: boolean;
          cargo?: string;
          created_at?: string;
          email?: string;
          id?: string;
          nivel_acesso?: string;
          nome: string;
          telefone?: string;
          user_id?: string | null;
        };
        Update: {
          ativo?: boolean;
          cargo?: string;
          created_at?: string;
          email?: string;
          id?: string;
          nivel_acesso?: string;
          nome?: string;
          telefone?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      servicos: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          preco: number;
          tempo_medio: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          preco?: number;
          tempo_medio?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          preco?: number;
          tempo_medio?: number;
        };
        Relationships: [];
      };
      quitados: {
        Row: {
          agendamento_id: string | null;
          cliente_id: string;
          created_at: string;
          data_hora: string;
          data_quitacao: string;
          forma_pagamento: string;
          funcionario: string;
          funcionario_id: string | null;
          id: string;
          observacoes: string | null;
          servico_id: string;
          updated_at: string;
          valor_comissao: number;
          valor_servico: number;
        };
        Insert: {
          agendamento_id?: string | null;
          cliente_id: string;
          created_at?: string;
          data_hora: string;
          data_quitacao?: string;
          forma_pagamento: string;
          funcionario?: string;
          funcionario_id?: string | null;
          id?: string;
          observacoes?: string | null;
          servico_id: string;
          updated_at?: string;
          valor_comissao?: number;
          valor_servico?: number;
        };
        Update: {
          agendamento_id?: string | null;
          cliente_id?: string;
          created_at?: string;
          data_hora?: string;
          data_quitacao?: string;
          forma_pagamento?: string;
          funcionario?: string;
          funcionario_id?: string | null;
          id?: string;
          observacoes?: string | null;
          servico_id?: string;
          updated_at?: string;
          valor_comissao?: number;
          valor_servico?: number;
        };
        Relationships: [];
      };
      transacoes_financeiras: {
        Row: {
          agendamento_id: string | null;
          created_at: string;
          forma_pagamento: string | null;
          funcionario_id: string | null;
          id: string;
          valor_comissao: number;
          valor_servico: number;
          updated_at: string;
        };
        Insert: {
          agendamento_id?: string | null;
          created_at?: string;
          forma_pagamento?: string | null;
          funcionario_id?: string | null;
          id?: string;
          valor_comissao?: number;
          valor_servico?: number;
          updated_at?: string;
        };
        Update: {
          agendamento_id?: string | null;
          created_at?: string;
          forma_pagamento?: string | null;
          funcionario_id?: string | null;
          id?: string;
          valor_comissao?: number;
          valor_servico?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transacoes_financeiras_agendamento_id_fkey";
            columns: ["agendamento_id"];
            isOneToOne: false;
            referencedRelation: "agendamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transacoes_financeiras_funcionario_id_fkey";
            columns: ["funcionario_id"];
            isOneToOne: false;
            referencedRelation: "funcionarios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
