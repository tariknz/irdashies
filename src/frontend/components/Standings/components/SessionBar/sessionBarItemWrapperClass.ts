export const sessionBarItemWrapperClass = (standalone: boolean): string =>
  standalone
    ? 'whitespace-nowrap shrink-0 text-center first:text-left last:text-right'
    : 'whitespace-nowrap';
