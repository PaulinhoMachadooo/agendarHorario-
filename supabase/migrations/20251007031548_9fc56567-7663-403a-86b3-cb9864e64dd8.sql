-- Adicionar campos de dias de funcionamento e horários de almoço
ALTER TABLE public.configuracoes_barbearia
ADD COLUMN dias_funcionamento text[] DEFAULT ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'],
ADD COLUMN horario_almoco_inicio time DEFAULT '12:00:00',
ADD COLUMN horario_almoco_fim time DEFAULT '13:00:00';