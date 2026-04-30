import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function Placeholder({ title, round }: { title: string; round: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Construction className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">قريباً</p>
          <p className="text-sm text-muted-foreground mt-1">سيتم بناء هذه الشاشة في {round}.</p>
        </CardContent>
      </Card>
    </div>
  );
}
