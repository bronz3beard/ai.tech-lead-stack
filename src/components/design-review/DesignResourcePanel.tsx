'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, ExternalLink, Eye, Layers, PenTool } from 'lucide-react';

const RESOURCES = [
  {
    category: 'Visual Quality & Testing',
    icon: Eye,
    links: [
      {
        name: 'Chromatic Designer Mode',
        href: 'https://www.chromatic.com/docs/designer-mode',
        color: 'text-amber-400',
      },
      {
        name: 'Storybook Design Addon',
        href: 'https://storybook.js.org/addons/storybook-addon-designs',
        color: 'text-amber-400',
      },
    ],
  },
  {
    category: 'UI Foundations',
    icon: Layers,
    links: [
      {
        name: 'Shadcn UI',
        href: 'https://ui.shadcn.com/',
        color: 'text-blue-400',
      },
      {
        name: 'Radix UI Primitives',
        href: 'https://www.radix-ui.com/primitives',
        color: 'text-blue-400',
      },
      {
        name: 'Tailwind CSS v3.4',
        href: 'https://v3.tailwindcss.com/',
        color: 'text-sky-400',
      },
    ],
  },
  {
    category: 'Design Handover',
    icon: PenTool,
    links: [
      {
        name: 'Figma Dev Mode',
        href: 'https://www.figma.com/dev-mode/',
        color: 'text-violet-400',
      },
      {
        name: 'Shadcn Figma Plugin',
        href: 'https://www.figma.com/community/plugin/1217032731210486966',
        color: 'text-violet-400',
      },
    ],
  },
];

interface DesignResourcePanelProps {
  figmaUrl?: string;
  chromaticUrl?: string;
}
export function DesignResourcePanel({
  figmaUrl,
  chromaticUrl,
}: DesignResourcePanelProps) {
  const activeResources = RESOURCES.map((category) => {
    if (category.category === 'Live Design Embed') {
      const links = [];
      if (figmaUrl)
        links.push({
          name: 'Figma File Preview',
          href: figmaUrl,
          color: 'text-emerald-400',
        });
      if (chromaticUrl)
        links.push({
          name: 'Chromatic Build Status',
          href: chromaticUrl,
          color: 'text-emerald-400',
        });
      return { ...category, links };
    }
    return category;
  }).filter((category) => category.links && category.links.length > 0);

  if (activeResources.length === 0) {
    return null;
  }

  return (
    <Card className="bg-zinc-900/40 border-zinc-800 mt-4 overflow-hidden">
      <CardHeader className="px-4 py-3 border-b border-zinc-800">
        <CardTitle className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-2">
          <BookOpen className="h-3 w-3" />
          Design Resources
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-3 space-y-4">
        {activeResources.map((group) => (
          <div key={group.category} className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-tight">
              <group.icon className="h-3 w-3" />
              {group.category}
            </div>
            <ul className="space-y-1">
              {group.links.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1.5 text-[11px] ${link.color} hover:underline transition-all group`}
                  >
                    <span className="truncate">{link.name}</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
