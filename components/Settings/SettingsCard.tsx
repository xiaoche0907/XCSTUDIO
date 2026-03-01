import React from 'react';

interface SettingsCardProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    badge?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({ title, description, icon, children, badge }) => {
    return (
        <div className="bg-card border border-border/60 rounded-lg p-6 shadow-premium hover:shadow-hover transition-all duration-300">
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/5 text-primary rounded-md ring-1 ring-primary/10">
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-lg font-display font-semibold text-foreground tracking-tight flex items-center gap-2">
                            {title}
                            {badge && (
                                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] uppercase font-bold tracking-wider">
                                    {badge}
                                </span>
                            )}
                        </h3>
                        {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-sm">{description}</p>}
                    </div>
                </div>
            </div>
            <div className="space-y-5 pt-4 border-t border-border/40">
                {children}
            </div>
        </div>
    );
};
