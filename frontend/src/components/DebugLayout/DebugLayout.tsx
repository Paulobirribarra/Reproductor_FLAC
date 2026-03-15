import React, { useEffect, useState } from 'react';

interface ElementInfo {
  name: string;
  height: number;
  top: number;
  bottom: number;
  element: HTMLElement | null;
}

export const DebugLayout: React.FC = () => {
  const [elements, setElements] = useState<ElementInfo[]>([]);
  const [fileItems, setFileItems] = useState<any[]>([]);

  useEffect(() => {
    const checkLayout = () => {
      const elementsToCheck = [
        { selector: 'header', name: 'Header (ActionBar + FolderBrowser)' },
        { selector: 'main', name: 'MainContent' },
        { selector: '[class*="overflow-y-auto"]', name: 'Scroll Container' },
        { selector: '[class*="from-blue-600"]', name: 'Player Footer' },
      ];

      const info: ElementInfo[] = [];
      
      elementsToCheck.forEach(({ selector, name }) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          const rect = element.getBoundingClientRect();
          info.push({
            name,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom,
            element,
          });
        }
      });

      setElements(info);
      
      // Buscar TODOS los elementos con texto
      const allElements = document.querySelectorAll('*');
      const withFlac = Array.from(allElements).filter((el) => el.textContent?.includes('.flac'));
      const withDies = Array.from(allElements).filter((el) => el.textContent?.includes('Dies'));
      
      // Verificar FileItems - buscar por h4 o p dentro de divs
      const h4Elements = document.querySelectorAll('h4, p');
      const fileItemsInfo = Array.from(h4Elements)
        .filter((el) => el.textContent?.includes('.flac') || el.textContent?.includes('.mp3'))
        .map((el) => {
          const parent = (el as HTMLElement).closest('div[class*="p-4"]');
          const rect = parent ? parent.getBoundingClientRect() : (el as HTMLElement).getBoundingClientRect();
          const computed = window.getComputedStyle(el as HTMLElement);
          return {
            name: (el as HTMLElement).textContent?.substring(0, 50),
            height: `${rect.height.toFixed(0)}px`,
            top: `${rect.top.toFixed(0)}px`,
            tag: el.tagName,
            display: computed.display,
            opacity: computed.opacity,
            color: computed.color,
          };
        });
      
      setFileItems(fileItemsInfo);
      
      console.log('=== DEBUG LAYOUT ===');
      console.log('Viewport height:', window.innerHeight);
      info.forEach((el) => {
        console.log(`${el.name}:`, {
          height: `${el.height.toFixed(0)}px`,
          top: `${el.top.toFixed(0)}px`,
          bottom: `${el.bottom.toFixed(0)}px`,
          visible: el.top >= 0 && el.top < window.innerHeight,
        });
      });
      console.log('Buscando .flac/.mp3:', withFlac.length, 'elementos');
      console.log('Buscando Dies:', withDies.length, 'elementos');
      console.log('H4/P con flac/mp3:', fileItemsInfo.length);
      fileItemsInfo.forEach((item) => {
        console.log('File:', item);
      });
      console.log('=================');
    };

    checkLayout();
    window.addEventListener('resize', checkLayout);
    const interval = setInterval(checkLayout, 500);
    return () => {
      window.removeEventListener('resize', checkLayout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white p-3 rounded text-xs font-mono max-w-md z-50 max-h-96 overflow-y-auto border border-purple-500">
      <div className="font-bold mb-2 text-purple-400">📐 Layout Debug</div>
      <div className="text-gray-300">Viewport: {window.innerHeight}px</div>
      
      <div className="mt-2 border-t border-purple-600 pt-2">
        <div className="font-bold text-purple-400">Contenedores:</div>
        {elements.map((el) => (
          <div key={el.name} className={`mt-1 p-2 rounded text-xs ${el.top >= 0 && el.top < window.innerHeight ? 'bg-green-900' : 'bg-red-900'}`}>
            <div className="font-bold">{el.name}</div>
            <div>H: {el.height.toFixed(0)}px | Top: {el.top.toFixed(0)}px</div>
            <div>{el.top >= 0 && el.top < window.innerHeight ? '✅ Visible' : '❌ Fuera'}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 border-t border-purple-600 pt-2">
        <div className="font-bold text-purple-400">Archivos ({fileItems.length}):</div>
        {fileItems.map((item, idx) => (
          <div key={idx} className="mt-1 p-2 rounded bg-blue-900 text-xs">
            <div className="truncate">{item.name}</div>
            <div>Top: {item.top} | Height: {item.height}</div>
            <div>Display: {item.display} | Opacity: {item.opacity}</div>
            <div className="text-gray-300">{item.color}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
