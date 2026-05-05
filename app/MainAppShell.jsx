// Clean main-app shell — 5-tab app.
// On mobile (touch + narrow screen), renders full-screen with no frame.
// On desktop, keeps the centered IOSDevice card.

function MainAppShell() {
  const [tab, setTab] = React.useState('home');
  const [communityHighlight, setCommunityHighlight] = React.useState(false);
  const [homeHighlight, setHomeHighlight] = React.useState(true);

  const isMobile =
    window.matchMedia('(max-width: 600px) and (pointer: coarse)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const handleNavigate = (nextTab, fromBanner = false) => {
    setTab(nextTab);
    if (fromBanner && nextTab === 'community') setCommunityHighlight(true);
  };

  const renderTab = () => {
    switch (tab) {
      case 'home':      return <HouseTab onNavigate={handleNavigate} highlight={homeHighlight} onClearHighlight={() => setHomeHighlight(false)}/>;
      case 'community': return <CommunityTab highlight={communityHighlight} onClearHighlight={() => setCommunityHighlight(false)}/>;
      case 'dashboard': return <DashboardTab onNavigate={handleNavigate}/>;
      case 'profile':   return <ProfileTab/>;
      default:          return <DashboardTab/>;
    }
  };

  // AssistantTab is always mounted to preserve conversation + toggle state.
  // It is shown/hidden via display rather than remounted on tab switch.
  const assistantLayer = (style) => (
    <div style={{ position: 'absolute', inset: 0, display: tab === 'assistant' ? 'flex' : 'none', flexDirection: 'column', ...style }}>
      <AssistantTab/>
      <TabBar active={tab} onChange={setTab}/>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'var(--cream-50, #F4F5F2)',
        overflow: 'hidden',
      }}>
        {assistantLayer({})}
        {tab !== 'assistant' && (
          <div key={tab} style={{ position: 'absolute', inset: 0 }} className="pw-fade-in">
            {renderTab()}
            <TabBar active={tab} onChange={setTab}/>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#E8E3D6',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', boxSizing: 'border-box',
    }}>
      <IOSDevice width={390} height={844}>
        <div style={{ height: '100%', position: 'relative' }}>
          {assistantLayer({})}
          {tab !== 'assistant' && (
            <div key={tab} style={{ height: '100%', position: 'relative' }} className="pw-fade-in">
              {renderTab()}
              <TabBar active={tab} onChange={setTab}/>
            </div>
          )}
        </div>
      </IOSDevice>
    </div>
  );
}

Object.assign(window, { MainAppShell });
