"use client";

import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  Badge, 
  Button, 
  Tooltip 
} from "@/shared/components";
import { 
  ChevronDown, 
  ChevronUp, 
  Settings, 
  RotateCcw, 
  ExternalLink, 
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Terminal
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const ICON_MAP = {
  terminal: Terminal,
  settings: Settings,
  help: HelpCircle,
};

/**
 * BaseToolCard - Component nền tảng cho các công cụ CLI
 */
export default function BaseToolCard({
  tool,
  isExpanded,
  onToggle,
  status, // "configured" | "not_configured" | "other" | "error" | null
  checking = false,
  applying = false,
  restoring = false,
  message = null, // { type: "success" | "error", text: string }
  onApply,
  onReset,
  onShowManualConfig,
  onCheckStatus,
  hasActiveProviders = true,
  children
}) {
  const IconComponent = typeof tool.icon === 'string' ? (ICON_MAP[tool.icon] || Settings) : (tool.icon || Settings);
  
  const renderStatusBadge = () => {
    if (checking) {
      return (
        <Badge variant="outline" className="flex items-center gap-1.5 bg-muted/30">
          <Clock className="size-3 animate-pulse" />
          <span>Đang kiểm tra...</span>
        </Badge>
      );
    }

    switch (status) {
      case "configured":
        return (
          <Badge variant="outline" className="flex items-center gap-1.5 border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-500">
            <CheckCircle2 className="size-3" />
            <span>Đã cấu hình</span>
          </Badge>
        );
      case "not_configured":
        return (
          <Badge variant="outline" className="flex items-center gap-1.5 border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-500">
            <HelpCircle className="size-3" />
            <span>Chưa cấu hình</span>
          </Badge>
        );
      case "other":
        return (
          <Badge variant="outline" className="flex items-center gap-1.5 border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-500">
            <Settings className="size-3" />
            <span>Cấu hình tùy chỉnh</span>
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="flex items-center gap-1.5 border-destructive/20 bg-destructive/5 text-destructive">
            <AlertCircle className="size-3" />
            <span>Lỗi</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
            Không rõ
          </Badge>
        );
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 border-border/50",
      isExpanded ? "shadow-md ring-1 ring-primary/10" : "hover:shadow-sm hover:border-border"
    )}>
      {/* Header - Có thể click để toggle Accordion */}
      <div 
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer select-none transition-colors",
          isExpanded ? "bg-muted/30 border-b border-border/50" : "hover:bg-muted/20"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className="relative size-10 flex-shrink-0 bg-background rounded-lg border border-border/50 p-1.5 flex items-center justify-center shadow-sm">
            {tool.image ? (
              <Image src={tool.image} alt={tool.name} width={28} height={28} className="object-contain" />
            ) : (
              <IconComponent className="text-muted-foreground size-5" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight">{tool.name}</h3>
              {renderStatusBadge()}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">{tool.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onCheckStatus && !isExpanded && (
            <Button 
              variant="ghost" 
              size="icon-xs" 
              onClick={(e) => { e.stopPropagation(); onCheckStatus(); }}
              disabled={checking}
              title="Làm mới trạng thái"
            >
              <RotateCcw className={cn("size-3", checking && "animate-spin")} />
            </Button>
          )}
          {isExpanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Content - Chỉ hiển thị khi isExpanded */}
      <div className={cn(
        "grid transition-all duration-300 ease-in-out",
        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 overflow-hidden"
      )}>
        <div className="overflow-hidden">
          <CardContent className="p-6 pt-5 space-y-6">
            {/* Custom Configuration UI */}
            <div className="space-y-6">
              {children}
            </div>

            {/* Notification Message */}
            {message && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium animate-in fade-in slide-in-from-top-1",
                message.type === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500" : "bg-destructive/10 text-destructive"
              )}>
                {message.type === "success" ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                <span>{message.text}</span>
              </div>
            )}

            {/* Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2">
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={onApply} 
                  disabled={applying || !hasActiveProviders} 
                  loading={applying}
                  className="font-bold min-w-[100px]"
                >
                  Áp dụng
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onReset} 
                  disabled={restoring || status === "not_configured"} 
                  loading={restoring}
                  className="font-semibold"
                >
                  <RotateCcw className="mr-2 size-3.5" />
                  Đặt lại
                </Button>
              </div>

              {onShowManualConfig && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onShowManualConfig}
                  className="text-muted-foreground hover:text-foreground h-8"
                >
                  <ExternalLink className="mr-2 size-3.5" />
                  Cấu hình thủ công
                </Button>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}
