
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

export default function ApiKeysPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-4">
            <KeyRound className="h-12 w-12 text-primary" />
            <div>
              <CardTitle className="text-2xl">API Keys</CardTitle>
              <CardDescription>Manage your API keys for programmatic access.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-end">
            <Button>Generate New API Key</Button>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Active Keys</h3>
            <p className="text-muted-foreground">You currently have no active API keys.</p>
            {/* Placeholder for a table or list of API keys */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
