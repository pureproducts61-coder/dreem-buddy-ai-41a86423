import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LocalModelsPanel from './LocalModelsPanel';
import ConstitutionPanel from './ConstitutionPanel';
import DesktopBridgePanel from './DesktopBridgePanel';
import PluginsPanel from './PluginsPanel';

export default function AiOsTab() {
  return (
    <Tabs defaultValue="models" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4 h-auto">
        <TabsTrigger value="models" className="py-2 text-[11px] sm:text-xs">Local models</TabsTrigger>
        <TabsTrigger value="constitution" className="py-2 text-[11px] sm:text-xs">Constitution</TabsTrigger>
        <TabsTrigger value="bridge" className="py-2 text-[11px] sm:text-xs">Desktop bridge</TabsTrigger>
        <TabsTrigger value="plugins" className="py-2 text-[11px] sm:text-xs">Plugins</TabsTrigger>
      </TabsList>
      <TabsContent value="models"><LocalModelsPanel /></TabsContent>
      <TabsContent value="constitution"><ConstitutionPanel /></TabsContent>
      <TabsContent value="bridge"><DesktopBridgePanel /></TabsContent>
      <TabsContent value="plugins"><PluginsPanel /></TabsContent>
    </Tabs>
  );
}