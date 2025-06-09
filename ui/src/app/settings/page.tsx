
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react"; // Renamed to avoid conflict with page name
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-4">
            <SettingsIcon className="h-12 w-12 text-primary" />
            <div>
              <CardTitle className="text-2xl">Platform Settings</CardTitle>
              <CardDescription>Customize your SwiftTrade experience.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="email-notifications" className="font-medium">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive important updates and alerts via email.
                </p>
              </div>
              <Switch id="email-notifications" defaultChecked />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="trade-confirmations" className="font-medium">Trade Confirmations</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your trades are executed.
                </p>
              </div>
              <Switch id="trade-confirmations" defaultChecked />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Security</h3>
             <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="two-factor-auth" className="font-medium">Two-Factor Authentication (2FA)</Label>
                <p className="text-sm text-muted-foreground">
                  Enhance your account security. (Currently Disabled)
                </p>
              </div>
              <Switch id="two-factor-auth" disabled />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
