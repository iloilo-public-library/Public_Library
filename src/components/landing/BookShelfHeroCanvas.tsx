"use client";

import { Canvas } from "@react-three/fiber";
import BookShelf, { type ShelfItem } from "@/components/BookShelf";

interface BookShelfHeroCanvasProps {
  items: ShelfItem[];
  selected: string | null;
  setSelected: (id: string | null) => void;
}

export function BookShelfHeroCanvas({
  items,
  selected,
  setSelected,
}: BookShelfHeroCanvasProps) {
  return (
    <div className="h-[60vh] w-full md:absolute md:inset-0 md:h-full">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 40, position: [0, 2.7, 8.2] }}
        onPointerMissed={() => setSelected(null)}
      >
        <BookShelf items={items} selectedId={selected} onSelect={setSelected} />
      </Canvas>
    </div>
  );
}
