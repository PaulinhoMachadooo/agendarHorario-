export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  dataCadastro: string;
  ultimaVisita: string;
}

export interface Servico {
  id: string;
  nome: string;
  preco: number;
  tempoMedio: number; // em minutos
}

export interface Agendamento {
  id: string;
  clienteId: string;
  servicoId: string;
  funcionario: string;
  data: string;
  hora: string;
  status: 'agendado' | 'concluido' | 'cancelado';
  observacoes?: string;
}

export const mockClientes: Cliente[] = [
  {
    id: '1',
    nome: 'João Silva',
    telefone: '(11) 99999-9999',
    email: 'joao@email.com',
    dataCadastro: '2024-01-15',
    ultimaVisita: '2024-02-20',
  },
  {
    id: '2',
    nome: 'Pedro Santos',
    telefone: '(11) 88888-8888',
    email: 'pedro@email.com',
    dataCadastro: '2024-02-01',
    ultimaVisita: '2024-02-25',
  },
  {
    id: '3',
    nome: 'Carlos Oliveira',
    telefone: '(11) 77777-7777',
    email: 'carlos@email.com',
    dataCadastro: '2024-01-20',
    ultimaVisita: '2024-02-22',
  },
];

export const mockServicos: Servico[] = [
  {
    id: '1',
    nome: 'Corte Masculino',
    preco: 35,
    tempoMedio: 30,
  },
  {
    id: '2',
    nome: 'Barba',
    preco: 25,
    tempoMedio: 20,
  },
  {
    id: '3',
    nome: 'Corte + Barba',
    preco: 55,
    tempoMedio: 45,
  },
  {
    id: '4',
    nome: 'Sobrancelha',
    preco: 15,
    tempoMedio: 15,
  },
];

export const mockAgendamentos: Agendamento[] = [
  {
    id: '1',
    clienteId: '1',
    servicoId: '1',
    funcionario: 'Roberto',
    data: '2024-02-29',
    hora: '09:00',
    status: 'agendado',
    observacoes: 'Cliente prefere corte baixo',
  },
  {
    id: '2',
    clienteId: '2',
    servicoId: '3',
    funcionario: 'Marco',
    data: '2024-02-29',
    hora: '10:30',
    status: 'agendado',
  },
  {
    id: '3',
    clienteId: '3',
    servicoId: '2',
    funcionario: 'Roberto',
    data: '2024-02-28',
    hora: '14:00',
    status: 'concluido',
  },
];

export const mockFuncionarios = ['Roberto', 'Marco', 'Carlos', 'Antonio'];

// Funções auxiliares
export const getClienteNome = (clienteId: string): string => {
  const cliente = mockClientes.find(c => c.id === clienteId);
  return cliente?.nome || 'Cliente não encontrado';
};

export const getServicoNome = (servicoId: string): string => {
  const servico = mockServicos.find(s => s.id === servicoId);
  return servico?.nome || 'Serviço não encontrado';
};

export const getServicoPreco = (servicoId: string): number => {
  const servico = mockServicos.find(s => s.id === servicoId);
  return servico?.preco || 0;
};