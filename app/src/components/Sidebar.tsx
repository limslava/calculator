import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

export type PageId =
  | 'complex'
  | 'sea'
  | 'directSea'
  | 'rail'
  | 'directRail'
  | 'uploadSea'
  | 'uploadDirectSea'
  | 'uploadRail'
  | 'uploadDirectRail'
  | 'tariffTerminal'
  | 'tariffAgent'
  | 'adminUsers'
  | 'adminEmail'
  | 'adminHistory'
  | 'account';

export type SidebarUser = {
  email: string;
  fullName?: string;
  role?: string;
};

type SidebarProps = {
  user: SidebarUser;
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
  onCollapse: () => void;
};

const ROLE_TITLES: Record<string, string> = {
  admin: 'Панель администратора',
  sales: 'Менеджер по продажам',
  purchaser: 'Менеджер по закупу'
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  sales: 'Менеджер по продажам',
  purchaser: 'Менеджер по закупу'
};

export default function Sidebar({
  user,
  activePage,
  onNavigate,
  onLogout,
  onCollapse
}: SidebarProps) {
  const [openGroups, setOpenGroups] = useState({
    purchaser: false,
    purchaserData: false,
    sales: false,
    salesSeparate: false,
    settings: false
  });

  useEffect(() => {
    setOpenGroups({
      purchaser: false,
      purchaserData: false,
      sales: false,
      salesSeparate: false,
      settings: false
    });
  }, [user.email, user.role]);

  const title = useMemo(() => {
    if (user.role === 'sales') return '';
    if (user.role && ROLE_TITLES[user.role]) return ROLE_TITLES[user.role];
    return 'Панель';
  }, [user.role]);

  const subtitle = useMemo(() => {
    if (user.fullName && user.fullName.trim()) return user.fullName.trim();
    return user.email || 'Пользователь';
  }, [user]);

  const isAdmin = user.role === 'admin';
  const isSales = user.role === 'sales';
  const isPurchaser = user.role === 'purchaser';
  const canSales = isSales || isAdmin;
  const canPurchase = isPurchaser || isAdmin;
  const renderSalesItems = () => (
    <>
      <button
        type="button"
        className={activePage === 'sea' ? 'menu-item is-active' : 'menu-item'}
        onClick={() => onNavigate('sea')}
      >
        Море
      </button>
      <button
        type="button"
        className={activePage === 'directSea' ? 'menu-item is-active' : 'menu-item'}
        onClick={() => onNavigate('directSea')}
      >
        Прямое море
      </button>
      <button
        type="button"
        className={activePage === 'rail' ? 'menu-item is-active' : 'menu-item'}
        onClick={() => onNavigate('rail')}
      >
        ЖД
      </button>
      <button
        type="button"
        className={activePage === 'directRail' ? 'menu-item is-active' : 'menu-item'}
        onClick={() => onNavigate('directRail')}
      >
        Прямое ЖД
      </button>
      <button
        type="button"
        className={activePage === 'complex' ? 'menu-item is-active' : 'menu-item'}
        onClick={() => onNavigate('complex')}
      >
        Комплекс
      </button>
    </>
  );

  const handleToggle = (key: keyof typeof openGroups) => (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = (event.currentTarget as HTMLDetailsElement).open;
    setOpenGroups(prev => ({ ...prev, [key]: isOpen }));
  };

  return (
    <aside className="app-sidebar sidebar">
      <div className={`sidebar-brand ${title ? '' : 'sidebar-brand--compact'}`}>
        <div className="sidebar-brand-row">
          {title && <div className="brand-title">{title}</div>}
          <button
            type="button"
            className="sidebar-toggle sidebar-toggle--arrow"
            onClick={onCollapse}
            aria-label="Скрыть меню"
          >
            <span className="sidebar-toggle-icon">←</span>
            <span className="sidebar-toggle-text">Скрыть меню</span>
          </button>
        </div>
        <div className="brand-subtitle">{subtitle}</div>
      </div>
      <nav className="sidebar-nav">
        {canPurchase && !isAdmin && (
          <details className="menu-group" open={openGroups.purchaser} onToggle={handleToggle('purchaser')}>
            <summary>
              <span>Загрузка данных</span>
              <span className="menu-chevron">▾</span>
            </summary>
            <div className="menu-items">
              <button
                type="button"
                className={activePage === 'uploadSea' ? 'menu-item is-active' : 'menu-item'}
                onClick={() => onNavigate('uploadSea')}
              >
                Море
              </button>
              <button
                type="button"
                className={activePage === 'uploadDirectSea' ? 'menu-item is-active' : 'menu-item'}
                onClick={() => onNavigate('uploadDirectSea')}
              >
                Прямое море
              </button>
              <button
                type="button"
                className={activePage === 'uploadRail' ? 'menu-item is-active' : 'menu-item'}
                onClick={() => onNavigate('uploadRail')}
              >
                ЖД
              </button>
              <button
                type="button"
                className={activePage === 'uploadDirectRail' ? 'menu-item is-active' : 'menu-item'}
                onClick={() => onNavigate('uploadDirectRail')}
              >
                Прямое ЖД
              </button>
              <button
                type="button"
                className={activePage === 'tariffTerminal' ? 'menu-item is-active' : 'menu-item'}
                onClick={() => onNavigate('tariffTerminal')}
              >
                Тарифы терминалов
              </button>
              <button
                type="button"
                className={activePage === 'tariffAgent' ? 'menu-item is-active' : 'menu-item'}
                onClick={() => onNavigate('tariffAgent')}
              >
                Тарифы агентов
              </button>
            </div>
          </details>
        )}

        {isAdmin && (
          <details className="menu-group" open={openGroups.purchaser} onToggle={handleToggle('purchaser')}>
            <summary>
              <span>Менеджер по закупу</span>
              <span className="menu-chevron">▾</span>
            </summary>
            <div className="menu-items">
              <details
                className="menu-subgroup"
                open={openGroups.purchaserData}
                onToggle={handleToggle('purchaserData')}
              >
                <summary>
                  <span>Загрузка данных</span>
                  <span className="menu-chevron">▾</span>
                </summary>
                <div className="menu-items">
                  <button
                    type="button"
                    className={activePage === 'uploadSea' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('uploadSea')}
                  >
                    Море
                  </button>
                  <button
                    type="button"
                    className={activePage === 'uploadDirectSea' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('uploadDirectSea')}
                  >
                    Прямое море
                  </button>
                  <button
                    type="button"
                    className={activePage === 'uploadRail' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('uploadRail')}
                  >
                    ЖД
                  </button>
                  <button
                    type="button"
                    className={activePage === 'uploadDirectRail' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('uploadDirectRail')}
                  >
                    Прямое ЖД
                  </button>
                  <button
                    type="button"
                    className={activePage === 'tariffTerminal' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('tariffTerminal')}
                  >
                    Тарифы
                  </button>
                  <button
                    type="button"
                    className={activePage === 'tariffAgent' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('tariffAgent')}
                  >
                    Тарифы агентов
                  </button>
                </div>
              </details>
            </div>
          </details>
        )}

        {canSales && !isAdmin && (
          <>
            <details
              className="menu-group"
              open={openGroups.salesSeparate}
              onToggle={handleToggle('salesSeparate')}
            >
              <summary>
                <span>Ставки</span>
                <span className="menu-chevron">▾</span>
              </summary>
              <div className="menu-items">
                {renderSalesItems()}
              </div>
            </details>
          </>
        )}

        {canSales && isAdmin && (
          <details className="menu-group" open={openGroups.sales} onToggle={handleToggle('sales')}>
            <summary>
              <span>Менеджер по продажам</span>
              <span className="menu-chevron">▾</span>
            </summary>
            <div className="menu-items">
              <details
                className="menu-subgroup"
                open={openGroups.salesSeparate}
                onToggle={handleToggle('salesSeparate')}
              >
                <summary>
                  <span>Ставки</span>
                  <span className="menu-chevron">▾</span>
                </summary>
                <div className="menu-items">
                  {renderSalesItems()}
                </div>
              </details>
            </div>
          </details>
        )}

        {(isAdmin || isSales || isPurchaser) && (
          <details className="menu-group" open={openGroups.settings} onToggle={handleToggle('settings')}>
            <summary>
              <span>Настройки</span>
              <span className="menu-chevron">▾</span>
            </summary>
            <div className="menu-items">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className={activePage === 'adminUsers' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('adminUsers')}
                  >
                    Управление пользователями
                  </button>
                  <button
                    type="button"
                    className={activePage === 'adminEmail' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('adminEmail')}
                  >
                    Настройка email
                  </button>
                  <button
                    type="button"
                    className={activePage === 'adminHistory' ? 'menu-item is-active' : 'menu-item'}
                    onClick={() => onNavigate('adminHistory')}
                  >
                    История загрузок
                  </button>
                </>
              )}
              <button
                type="button"
                className={activePage === 'account' ? 'menu-item is-active' : 'menu-item'}
                onClick={() => onNavigate('account')}
              >
                Сменить пароль
              </button>
            </div>
          </details>
        )}

        <button type="button" className="menu-item menu-item-danger" onClick={onLogout}>
          Выйти
        </button>
      </nav>
    </aside>
  );
}
