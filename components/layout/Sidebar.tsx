'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, SETTINGS_ITEMS, type NavItem } from '@/lib/constants';
import { NAV_TOUR_TARGET_BY_HREF } from '@/lib/getting-started';
import { motion } from 'motion/react';
import { LogOut, ChevronLeft, ChevronRight, Wrench, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { isTechnicianProfile, isReceptionnisteProfile, isCaissierProfile, RECEPTION_MOBILE_NAV, TECH_MOBILE_NAV, CASHIER_MOBILE_NAV } from '@/lib/role-routing';
import { countActiveOrders, scopeOrdersForUser } from '@/lib/workshop-orders';
import { workshopApi, notificationsApi, demoRequestsApi } from '@/lib/api';
import { useRealtimeEvents } from '@/hooks/use-realtime-events';

const ROLE_DISPLAY: Record<string, string> = {
  ADMIN:          'Administrateur',
  SUPER_ADMIN:    'Super Admin',
  CHEF_ATELIER:   "Chef d'atelier",
  TECHNICIEN:     'Technicien',
  RECEPTIONNISTE: 'Réceptionnaire',
  CAISSIER:       'Caissier',
};

function useSidebarBadges() {
  const [otCount, setOtCount] = React.useState(0);
  const [notifCount, setNotifCount] = React.useState(0);
  const [demoNewCount, setDemoNewCount] = React.useState(0);
  const { user, hasRole } = useAuth();

  const loadOtCount = React.useCallback(() => {
    workshopApi.listOTs()
      .then((ots: unknown) => {
        setOtCount(countActiveOrders(scopeOrdersForUser(ots as any[], user)));
      })
      .catch(() => {});
  }, [user]);

  React.useEffect(() => {
    loadOtCount();

    if (user?.roles?.includes('ADMIN')) {
      notificationsApi.smsHistory()
        .then((res: unknown) => {
          setNotifCount((res as any[]).filter((n) => n.status === 'FAILED').length);
        })
        .catch(() => {});
    } else {
      setNotifCount(0);
    }

    if (hasRole('SUPER_ADMIN')) {
      demoRequestsApi.stats()
        .then((res) => setDemoNewCount(res.new))
        .catch(() => setDemoNewCount(0));
    } else {
      setDemoNewCount(0);
    }
  }, [user, loadOtCount, hasRole]);

  useRealtimeEvents({
    onOtCreated: loadOtCount,
    onOtStatusChanged: loadOtCount,
    onNotificationNew: () => {
      notificationsApi.unreadCount()
        .then((res: unknown) => setNotifCount((res as any)?.count ?? 0))
        .catch(() => {});
    },
  });

  return { otCount, notifCount, demoNewCount };
}

function useVisibleItems(items: NavItem[]) {
  const { hasPermission, hasRole } = useAuth();
  return items.filter(item => {
    if (item.hideForRoles?.some(r => hasRole(r))) return false;
    if (!item.permission && !item.roles) return true;
    if (item.permission && hasPermission(item.permission)) return true;
    if (item.roles?.some(r => hasRole(r))) return true;
    return false;
  });
}

function NavLink({
  item,
  isActive,
  isCollapsed,
  badge,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  isCollapsed?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const tourTarget = NAV_TOUR_TARGET_BY_HREF[item.href];

  return (
    <Link key={item.href} href={item.href} onClick={onClick} data-tour={tourTarget}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
        isActive
          ? "bg-brand/20 text-brand ring-1 ring-brand/50 shadow-lg shadow-brand/10"
          : "hover:bg-white/5 hover:text-white",
        isCollapsed ? "justify-center px-0" : ""
      )}>
        <item.icon size={20} className={cn(
          "shrink-0",
          isActive ? "text-brand" : "text-slate-400 group-hover:text-white"
        )} />
        {!isCollapsed && (
          <span className="font-medium text-sm">{item.title}</span>
        )}
        {!isCollapsed && !!badge && badge > 0 && (
          <Badge className={cn(
            "ml-auto border-none h-5 px-1.5 text-[10px]",
            item.href === '/workshop' ? "bg-red-500 text-white" : "bg-brand text-white"
          )}>
            {badge}
          </Badge>
        )}
      </div>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { user } = useAuth();
  const isCashier = isCaissierProfile(user);
  const { otCount, notifCount, demoNewCount } = useSidebarBadges();

  const visibleNav = useVisibleItems(NAV_ITEMS);
  const visibleSettings = useVisibleItems(SETTINGS_ITEMS);

  const GESTION_HREFS = ['/admin/tenants','/vehicles','/stock','/stock/movements','/billing','/customers','/history','/demo-requests','/audit','/reports','/help'];
  const gestionStartIdx = visibleNav.findIndex(i => GESTION_HREFS.includes(i.href));

  const principal = isCashier
    ? visibleNav.filter(i => ['/', ...CASHIER_MOBILE_NAV.map(t => t.href)].includes(i.href))
    : visibleNav.slice(0, gestionStartIdx === -1 ? 4 : gestionStartIdx);
  const gestion = isCashier
    ? visibleNav.filter(i => ['/customers', '/cashier/history'].includes(i.href))
    : visibleNav.filter(i =>
      GESTION_HREFS
        .includes(i.href)
    );

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';
  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  const roleName = ROLE_DISPLAY[user?.roles?.[0] ?? ''] ?? user?.roles?.[0] ?? '';

  function getBadge(item: NavItem) {
    if (item.href === '/workshop') return otCount;
    if (item.href === '/notifications') return notifCount;
    if (item.href === '/demo-requests') return demoNewCount;
    return 0;
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      className={cn(
        'hidden md:flex flex-col h-screen min-h-0 overflow-hidden bg-sidebar-bg text-slate-300 border-r border-white/5 transition-all duration-300 ease-in-out z-50',
        isCollapsed ? 'items-center' : '',
      )}
    >
      {/* Logo */}
      <div className={cn(
        'shrink-0 h-16 flex items-center px-6 border-b border-white/5',
        isCollapsed ? 'justify-center px-0' : 'justify-between',
      )}>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-lg shadow-brand/20">
              <Wrench size={18} className="text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-bold text-white tracking-tight leading-tight">
                Atelier<span className="text-brand"> Maître</span>
              </span>
              {user?.garage?.name && (
                <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                  {user.garage.name}
                </span>
              )}
            </div>
          </motion.div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </Button>
      </div>

      <div className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4">
        <div className="space-y-6 pb-2">
          {principal.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Principal</p>
              )}
              {principal.map(item => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  isCollapsed={isCollapsed}
                  badge={getBadge(item)}
                />
              ))}
            </div>
          )}

          {gestion.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Gestion</p>
              )}
              {gestion.map(item => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  isCollapsed={isCollapsed}
                  badge={getBadge(item)}
                />
              ))}
            </div>
          )}

          {visibleSettings.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <>
                  <Separator className="my-3 bg-white/10" />
                  <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Réglages
                  </p>
                </>
              )}
              {visibleSettings.map(item => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  isCollapsed={isCollapsed}
                  badge={getBadge(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profil utilisateur — fixe en bas */}
      <div className={cn(
        'shrink-0 p-4 border-t border-white/5',
        isCollapsed ? 'flex flex-col items-center' : '',
      )}>
        <div className={cn(
          'flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5',
          isCollapsed ? 'p-0 bg-transparent' : '',
        )}>
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-bold shrink-0 shadow-inner">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{fullName}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-wider">{roleName}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

export function MobileSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isCashier = isCaissierProfile(user);
  const { otCount, notifCount, demoNewCount } = useSidebarBadges();

  const visibleNav = useVisibleItems(NAV_ITEMS);
  const visibleSettings = useVisibleItems(SETTINGS_ITEMS);

  const MOBILE_GESTION_HREFS = ['/admin/tenants','/vehicles','/stock','/stock/movements','/billing','/customers','/history','/demo-requests','/audit','/reports','/help'];

  const principal = isCashier
    ? visibleNav.filter(i => ['/', ...CASHIER_MOBILE_NAV.map(t => t.href)].includes(i.href))
    : visibleNav.filter(i =>
      ['/', '/planning', '/team', '/workshop'].includes(i.href)
    );
  const gestion = isCashier
    ? visibleNav.filter(i => ['/customers', '/cashier/history'].includes(i.href))
    : visibleNav.filter(i =>
      MOBILE_GESTION_HREFS.includes(i.href)
    );

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?';
  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';

  function getBadge(item: NavItem) {
    if (item.href === '/workshop') return otCount;
    if (item.href === '/notifications') return notifCount;
    if (item.href === '/demo-requests') return demoNewCount;
    return 0;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar-bg text-slate-300 w-full">
      <div className="shrink-0 h-16 flex items-center px-6 border-b border-white/5 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shadow-lg shadow-brand/20 shrink-0">
            <Wrench size={18} className="text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xl font-bold text-white tracking-tight leading-tight">
              Atelier<span className="text-brand"> Maître</span>
            </span>
            {user?.garage?.name && (
              <span className="text-[11px] text-slate-400 truncate leading-tight">
                {user.garage.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4">
        <div className="space-y-6 pb-2">
          {principal.length > 0 && (
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Principal</p>
              {principal.map(item => (
                <NavLink key={item.href} item={item} isActive={pathname === item.href} badge={getBadge(item)} onClick={onClose} />
              ))}
            </div>
          )}
          {gestion.length > 0 && (
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Gestion</p>
              {gestion.map(item => (
                <NavLink key={item.href} item={item} isActive={pathname === item.href} badge={getBadge(item)} onClick={onClose} />
              ))}
            </div>
          )}
          {visibleSettings.length > 0 && (
            <div className="space-y-1">
              <Separator className="my-3 bg-white/10" />
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Réglages</p>
              {visibleSettings.map(item => (
                <NavLink key={item.href} item={item} isActive={pathname === item.href} badge={getBadge(item)} onClick={onClose} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5">
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-bold shrink-0 shadow-inner">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{fullName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { otCount } = useSidebarBadges();
  const { user } = useAuth();
  const visibleNav = useVisibleItems(NAV_ITEMS);
  const isTechnician = isTechnicianProfile(user);
  const isReception = isReceptionnisteProfile(user);
  const isCashier = isCaissierProfile(user);

  const navs = isTechnician
    ? visibleNav
        .filter(i => TECH_MOBILE_NAV.some(t => t.href === i.href))
        .sort((a, b) => TECH_MOBILE_NAV.findIndex(t => t.href === a.href) - TECH_MOBILE_NAV.findIndex(t => t.href === b.href))
        .map(i => ({
          ...i,
          title: TECH_MOBILE_NAV.find(t => t.href === i.href)?.label ?? i.title,
        }))
    : isReception
      ? visibleNav
          .filter(i => RECEPTION_MOBILE_NAV.some(t => t.href === i.href))
          .sort((a, b) => RECEPTION_MOBILE_NAV.findIndex(t => t.href === a.href) - RECEPTION_MOBILE_NAV.findIndex(t => t.href === b.href))
          .map(i => {
            const meta = RECEPTION_MOBILE_NAV.find(t => t.href === i.href);
            return {
              ...i,
              title: meta?.label ?? i.title,
              linkHref: meta?.search ? `${i.href}${meta.search}` : i.href,
            };
          })
      : isCashier
        ? visibleNav
            .filter(i => CASHIER_MOBILE_NAV.some(t => t.href === i.href))
            .sort((a, b) => CASHIER_MOBILE_NAV.findIndex(t => t.href === a.href) - CASHIER_MOBILE_NAV.findIndex(t => t.href === b.href))
            .map(i => ({
              ...i,
              title: CASHIER_MOBILE_NAV.find(t => t.href === i.href)?.label ?? i.title,
            }))
        : visibleNav
          .filter(i => ['/dashboard', '/planning', '/workshop'].includes(i.href))
          .sort((a, b) => ['/dashboard', '/planning', '/workshop'].indexOf(a.href) - ['/dashboard', '/planning', '/workshop'].indexOf(b.href));

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border flex items-center justify-around z-[100] px-2 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]" style={{ height: 'calc(68px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {navs.map(item => {
        const href = 'linkHref' in item && item.linkHref ? item.linkHref : item.href;
        const isActive = item.href === '/dashboard'
          ? pathname === '/dashboard'
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const tourTarget = NAV_TOUR_TARGET_BY_HREF[item.href];
        return (
          <Link
            key={item.href}
            href={href}
            data-tour={tourTarget}
            className="flex flex-col items-center justify-center w-16 h-full relative group"
          >
            <item.icon size={22} className={cn("mb-1 transition-colors", isActive ? "text-brand" : "text-muted-foreground group-hover:text-foreground")} />
            <span className={cn("text-[10px] font-medium transition-colors", isActive ? "text-brand font-bold" : "text-muted-foreground group-hover:text-foreground")}>
              {item.title}
            </span>
            {item.href === '/workshop' && otCount > 0 && (
              <Badge className="absolute top-1 right-2 w-4 h-4 p-0 flex items-center justify-center bg-red-500 text-white border-none text-[9px] font-bold">
                {otCount > 9 ? '9+' : otCount}
              </Badge>
            )}
          </Link>
        );
      })}

      {!isTechnician && (
        <button onClick={onOpenMenu} className="flex flex-col items-center justify-center w-16 h-full relative group">
          <Menu size={22} className="mb-1 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Menu
          </span>
        </button>
      )}
    </div>
  );
}
