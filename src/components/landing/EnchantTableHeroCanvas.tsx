"use client";

import { Canvas } from "@react-three/fiber";
import EnchantTable, { TableCameraRig, type TableItem } from "@/components/EnchantTable";

interface EnchantTableHeroCanvasProps {
  items: TableItem[];
  spread: number;
  onSpreadChange: (n: number) => void;
}

export function EnchantTableHeroCanvas({
  items,
  spread,
  onSpreadChange,
}: EnchantTableHeroCanvasProps) {
  return (
    <div className="h-[46vh] min-h-[300px] w-full md:absolute md:inset-0 md:h-full">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 40, position: [0, 2.9, 7.4] }}
      >
        <TableCameraRig />
        <EnchantTable items={items} spread={spread} onSpreadChange={onSpreadChange} />
      </Canvas>
    </div>
  );
}
