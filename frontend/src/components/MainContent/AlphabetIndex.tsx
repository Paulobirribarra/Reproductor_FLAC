import React, { useMemo } from 'react';

interface AlphabetIndexProps {
  items: { name: string }[];
  onSelectLetter: (letter: string) => void;
  activeLetter?: string;
}

export const AlphabetIndex: React.FC<AlphabetIndexProps> = ({
  items,
  onSelectLetter,
  activeLetter,
}) => {
  // Extraer las letras disponibles a partir de los elementos
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    items.forEach((item) => {
      const firstChar = (item.name[0] || '').toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar);
      } else {
        letters.add('#');
      }
    });
    return letters;
  }, [items]);

  // Lista de caracteres a desplegar
  const alphabet = useMemo(() => {
    const list = ['#'];
    for (let i = 65; i <= 90; i++) {
      list.push(String.fromCharCode(i));
    }
    return list;
  }, []);

  if (items.length < 15) {
    return null;
  }

  return (
    <nav
      aria-label="Índice alfabético"
      className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-1 py-1.5 px-3 mb-4 bg-zinc-900/90 backdrop-blur-md rounded-lg border border-zinc-800 shadow-md text-xs select-none"
    >
      {alphabet.map((letter) => {
        const isAvailable = availableLetters.has(letter);
        const isActive = activeLetter === letter;

        return (
          <button
            key={letter}
            disabled={!isAvailable}
            onClick={() => isAvailable && onSelectLetter(letter)}
            className={`w-6 h-6 flex items-center justify-center rounded font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : isAvailable
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer active:scale-95'
                : 'text-zinc-600 opacity-40 cursor-not-allowed'
            }`}
            title={isAvailable ? `Ir a "${letter}"` : `Sin elementos con "${letter}"`}
          >
            {letter}
          </button>
        );
      })}
    </nav>
  );
};
