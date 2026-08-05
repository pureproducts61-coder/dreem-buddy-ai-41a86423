import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MANIFEST = `{
  "id": "screenshot-annotator",
  "name": "Screenshot Annotator",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Captures the screen and marks what the AI found.",
  "kind": "tool",
  "entry": "screen.capture",
  "permissions": ["screen.capture", "clipboard"],
  "capabilities": ["vision", "clipboard"],
  "dependencies": [],
  "requiredModels": [],
  "requiredBridgePermissions": ["screen.capture"],
  "config": {}
}`;

export default function PluginGuidePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plugin development guide</CardTitle>
        <CardDescription>Build new abilities without touching the core architecture.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <section className="space-y-1">
          <h3 className="font-medium">1. Folder structure</h3>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px]">{`my-plugin/
  manifest.json     # required — see below
  index.js          # entry: exports run({ payload, bridge, ai })
  README.md`}</pre>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">2. Manifest format</h3>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px]">{MANIFEST}</pre>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">3. Permission rules</h3>
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>Declare every Bridge permission in <code>requiredBridgePermissions</code>. Undeclared calls are refused.</li>
            <li>Permissions are granted by the user in Desktop Bridge → Permissions; never assume they exist.</li>
            <li>A plugin must fail soft with a human sentence when a permission is missing.</li>
          </ul>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">4. Capability registration</h3>
          <p className="text-muted-foreground">
            Capabilities listed in <code>capabilities</code> appear in the Capability registry once the plugin is enabled.
            The AI only offers an ability when its capability reports <strong>ready</strong>.
          </p>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">5. Example entry</h3>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px]">{`export async function run({ payload, bridge }) {
  const shot = await bridge.call('screen.capture', 'screenshot', {});
  return { ok: true, image: shot.dataUrl, note: payload.note ?? '' };
}`}</pre>
        </section>
        <p className="text-muted-foreground">
          Register the plugin in the Plugins tab with the same id, entry and permissions. Core files never need to change.
        </p>
      </CardContent>
    </Card>
  );
}