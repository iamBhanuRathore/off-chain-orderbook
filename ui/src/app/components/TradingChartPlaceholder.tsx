
import { Card } from "@/components/ui/card";
import Image from "next/image";

export function TradingChartPlaceholder() {
  return (
    <Card className="h-full flex flex-col items-center justify-center bg-card">
      {/* The image is wrapped in a div to allow for centering and relative positioning if needed */}
      <div className="w-full h-full relative opacity-70 flex-grow">
        <Image
          src="https://placehold.co/1200x600.png"
          alt="Trading chart placeholder"
          layout="fill"
          objectFit="contain"
          data-ai-hint="trading graph dark"
          className="rounded-md" // rounded-b-md removed as the card itself is rounded
        />
      </div>
    </Card>
  );
}
