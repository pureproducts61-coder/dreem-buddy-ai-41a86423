import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LocalModelsPanel from './LocalModelsPanel';
import ConstitutionPanel from './ConstitutionPanel';
import DesktopBridgePanel from './DesktopBridgePanel';
import PluginsPanel from './PluginsPanel';
import EngineRouterPanel from './EngineRouterPanel';
import CapabilitiesPanel from './CapabilitiesPanel';
import BrainPanel from './BrainPanel';
import PluginGuidePanel from './PluginGuidePanel';
import SelfTestPanel from './SelfTestPanel';

export default function AiOsTab() {
  return (
    <Tabs defaultValue="engine" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 h-auto sm:grid-cols-9">
        <TabsTrigger value="engine" className="py-2 text-[11px] sm:text-xs">AI engine</TabsTrigger>
        <TabsTrigger value="models" className="py-2 text-[11px] sm:text-xs">Local models</TabsTrigger>
        <TabsTrigger value="brain" className="py-2 text-[11px] sm:text-xs">AI brain</TabsTrigger>
        <TabsTrigger value="capabilities" className="py-2 text-[11px] sm:text-xs">Capabilities</TabsTrigger>
        <TabsTrigger value="constitution" className="py-2 text-[11px] sm:text-xs">Constitution</TabsTrigger>
        <TabsTrigger value="bridge" className="py-2 text-[11px] sm:text-xs">Desktop bridge</TabsTrigger>
        <TabsTrigger value="plugins" className="py-2 text-[11px] sm:text-xs">Plugins</TabsTrigger>
        <TabsTrigger value="guide" className="py-2 text-[11px] sm:text-xs">Plugin guide</TabsTrigger>
        <TabsTrigger value="selftest" className="py-2 text-[11px] sm:text-xs">Self test</TabsTrigger>
      </TabsList>
      <TabsContent value="engine"><EngineRouterPanel /></TabsContent>
      <TabsContent value="models"><LocalModelsPanel /></TabsContent>
      <TabsContent value="brain"><BrainPanel /></TabsContent>
      <TabsContent value="capabilities"><CapabilitiesPanel /></TabsContent>
      <TabsContent value="constitution"><ConstitutionPanel /></TabsContent>
      <TabsContent value="bridge"><DesktopBridgePanel /></TabsContent>
      <TabsContent value="plugins"><PluginsPanel /></TabsContent>
      <TabsContent value="guide"><PluginGuidePanel /></TabsContent>
      <TabsContent value="selftest"><SelfTestPanel /></TabsContent>
    </Tabs>
  );
}