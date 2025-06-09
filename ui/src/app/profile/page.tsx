
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserCircle } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-4">
            <UserCircle className="h-12 w-12 text-primary" />
            <div>
              <CardTitle className="text-2xl">User Profile</CardTitle>
              <CardDescription>Manage your profile information.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Account Details</h3>
            <p className="text-muted-foreground">This is where your account details would be displayed and editable.</p>
            <p><strong>Username:</strong> SwiftTraderUser</p>
            <p><strong>Email:</strong> user@example.com</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Preferences</h3>
            <p className="text-muted-foreground">This section would allow you to customize your platform preferences.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
