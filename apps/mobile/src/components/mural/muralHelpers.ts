// Rótulos do mural (categorias de conteúdo educativo). Sem imports de RN.
import type { ContentCategory } from '@/types/domain';

/** Ordem dos chips de filtro. */
export const CATEGORY_ORDER: readonly ContentCategory[] = ['lente', 'colirio', 'oculos', 'geral'];

export function categoryLabel(category: ContentCategory): string {
  switch (category) {
    case 'lente':
      return 'Lente de contato';
    case 'colirio':
      return 'Colírio';
    case 'oculos':
      return 'Óculos';
    case 'geral':
    default:
      return 'Geral';
  }
}
