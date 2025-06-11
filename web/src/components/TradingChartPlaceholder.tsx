import { Card } from "@/components/ui/card";

export function TradingChartPlaceholder() {
  return (
    <Card className="h-full flex flex-col items-center justify-center bg-card">
      {/* The image is wrapped in a div to allow for centering and relative positioning if needed */}
      <div className="w-full h-full relative opacity-70 flex-grow">
        <img
          src="https://placehold.co/1200x600.png"
          alt="Trading chart placeholder"
          className="rounded-md" // rounded-b-md removed as the card itself is rounded
        />
      </div>
    </Card>
  );
}
