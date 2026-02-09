import { Moon, Sun, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {theme === 'light' ? t('theme.dark') : t('theme.light')}
      </TooltipContent>
    </Tooltip>
  );
}

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLanguage}
          className="h-9 w-9"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {language === 'en' ? t('language.bengali') : t('language.english')}
      </TooltipContent>
    </Tooltip>
  );
}

export function ThemeLanguageToggle() {
  return (
    <div className="flex items-center gap-1">
      <ThemeToggle />
      <LanguageToggle />
    </div>
  );
}
