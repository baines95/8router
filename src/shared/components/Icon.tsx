"use client";

import * as React from "react";
import {
  CloudArrowUpIcon as CloudArrowUp,
  LockIcon as Lock,
  PlusIcon as Plus,
  CheckIcon as Check,
  CopyIcon as Copy,
  XIcon as X,
  WarningCircleIcon as AlertCircle,
  MagnifyingGlassIcon as Search,
  GearIcon as Settings,
  CaretDownIcon as ChevronDown,
  InfoIcon as Info,
  CheckCircleIcon as CheckCircle,
  WarningIcon as Warning,
  LightningIcon as Zap,
  ClockCounterClockwiseIcon as History,
  TranslateIcon as Languages,
  MoonIcon as Moon,
  SunIcon as Sun,
  MonitorIcon as Monitor,
  SignOutIcon as LogOut,
  QuestionIcon as Question,
  ArrowSquareOutIcon as ExternalLink,
  CaretRightIcon as ChevronRight,
  DotsThreeVerticalIcon as MoreVertical,
  DotsThreeIcon as MoreHorizontal,
  TrashIcon as Trash,
  PencilSimpleIcon as Edit,
  ArrowsClockwiseIcon as RefreshCw,
  EyeIcon as Eye,
  EyeSlashIcon as EyeOff,
  FunnelIcon as Filter,
  ArrowRightIcon as ArrowRight,
  ArrowLeftIcon as ArrowLeft,
} from "@phosphor-icons/react";
import type { IconProps as PhosphorIconProps } from "@phosphor-icons/react";

const ICON_MAP: Record<string, React.ComponentType<PhosphorIconProps>> = {
  cloud_upload: CloudArrowUp,
  vpn_lock: Lock,
  add: Plus,
  check: Check,
  content_copy: Copy,
  close: X,
  error: AlertCircle,
  search: Search,
  settings: Settings,
  expand_more: ChevronDown,
  info: Info,
  check_circle: CheckCircle,
  warning: Warning,
  flash_on: Zap,
  history: History,
  language: Languages,
  dark_mode: Moon,
  light_mode: Sun,
  computer: Monitor,
  logout: LogOut,
  help: Question,
  open_in_new: ExternalLink,
  chevron_right: ChevronRight,
  more_vert: MoreVertical,
  more_horiz: MoreHorizontal,
  delete: Trash,
  edit: Edit,
  refresh: RefreshCw,
  visibility: Eye,
  visibility_off: EyeOff,
  filter_list: Filter,
  arrow_forward: ArrowRight,
  arrow_back: ArrowLeft,
};

interface IconProps extends Omit<PhosphorIconProps, "size"> {
  name: string;
  className?: string;
}

export function Icon({ name, className, ...props }: IconProps) {
  const IconComponent = ICON_MAP[name];

  if (IconComponent) {
    return <IconComponent className={className} {...props} />;
  }

  return <Question className={className} {...props} />;
}
