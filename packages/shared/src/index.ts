// Tipos compartilhados entre o app mobile e o painel.
// Hoje só re-exporta o placeholder de Database; quando `npm run db:types` rodar
// (precisa de Docker), database.types.ts passa a conter o schema real gerado
// pelo Supabase e os dois pacotes trocam os tipos à mão por `Database`.
export type { Database } from './database.types';
