import { useState } from 'react';
import { Dialogs } from '@wailsio/runtime';
import { OrderService } from '../bindings/changeme';

interface Props {
  onConfigured: () => void;
}

function FirstLaunch({ onConfigured }: Props) {
  const [folderPath, setFolderPath] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const handleSelectFolder = async () => {
    try {
      const path = await Dialogs.OpenFile({
        CanChooseDirectories: true,
        CanChooseFiles: false,
        Title: '选择配置文件所在文件夹',
      });
      if (path && typeof path === 'string') {
        setFolderPath(path);
        setStatus('已选择: ' + path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirm = async () => {
    if (!folderPath) {
      setStatus('请先选择文件夹');
      return;
    }
    try {
      await OrderService.SetConfigPath(folderPath);
      onConfigured();
    } catch (e) {
      setStatus('保存配置失败: ' + e);
    }
  };

  return (
    <div className="first-launch">
      <h2>欢迎使用 OrdersTrack</h2>
      <p className="subtitle">首次启动，请选择配置文件所在文件夹</p>
      <p className="hint">文件夹中将存放 orders.yaml 配置文件</p>
      <div className="folder-select">
        <button className="btn" onClick={handleSelectFolder}>
          选择文件夹
        </button>
        <span className="folder-path">{folderPath || '未选择'}</span>
      </div>
      <button className="btn btn-primary" onClick={handleConfirm} disabled={!folderPath}>
        确认并进入
      </button>
      {status && <p className="status-msg">{status}</p>}
    </div>
  );
}

export default FirstLaunch;
