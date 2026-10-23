declare module 'virtual:compound-content' {
  import type { GameContent, Locale } from './content/types';
  const data: { content: GameContent; locale: Locale };
  export default data;
}
