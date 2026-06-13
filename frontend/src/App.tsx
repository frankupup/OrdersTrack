import { useState, useEffect } from 'react';
import { OrderService } from '../bindings/changeme';
import FirstLaunch from './FirstLaunch';
import MainView from './MainView';

function App() {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    OrderService.GetConfigPath()
      .then((path: string) => {
        if (path && path !== '') {
          setReady(true);
        } else {
          setReady(false);
        }
      })
      .catch(() => {
        setReady(false);
      });
  }, []);

  const handleConfigured = () => {
    setReady(true);
  };

  if (ready === null) {
    return (
      <div className="loading">
        <p>加载中...</p>
      </div>
    );
  }

  if (!ready) {
    return <FirstLaunch onConfigured={handleConfigured} />;
  }

  return <MainView />;
}

export default App;
