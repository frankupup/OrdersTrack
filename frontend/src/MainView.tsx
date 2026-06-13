import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialogs } from '@wailsio/runtime';
import { OrderService, Order } from '../bindings/changeme';

const COL_KEYS = ['no', 'ordering', 'ship', 'docs', 'telex', 'remarks'] as const;
type ColKey = (typeof COL_KEYS)[number];

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  no: 12, ordering: 16, ship: 12, docs: 16, telex: 16, remarks: 28,
};

function MainView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [todayDate, setTodayDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; orderNumber: string; isPinned: boolean } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizing = useRef<{ col: ColKey; startX: number; startWidths: Record<ColKey, number> } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const loadData = async () => {
    const date = await OrderService.GetTodayDate();
    setTodayDate(date);
    const list = await OrderService.LoadOrders();
    setOrders(list || []);
    const dir = await OrderService.GetSortDir();
    setSortDir(dir === 'desc' ? 'desc' : 'asc');
    const widths = await OrderService.GetColumnWidths();
    if (widths) {
      try {
        const parsed = JSON.parse(widths);
        setColWidths((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  };

  const handleAdd = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[,，]/g).map((s) => s.trim()).filter((s) => s !== '');
    if (parts.length === 0) return;
    const existingSet = new Set(orders.map((o) => o["order_number"]));
    const duplicates: string[] = [];
    const toAdd: string[] = [];
    for (const no of parts) {
      if (existingSet.has(no)) {
        duplicates.push(no);
      } else {
        toAdd.push(no);
      }
    }
    const addedOrders: Order[] = [];
    for (const no of toAdd) {
      const result = await OrderService.AddOrder(no);
      if (result) {
        addedOrders.push(result);
      } else {
        duplicates.push(no);
      }
    }
    if (addedOrders.length > 0) {
      setOrders((prev) => [...prev, ...addedOrders]);
      setInputValue('');
    }
    if (duplicates.length > 0) {
      alert('订单"' + duplicates.join('、') + '"已存在');
    }
  };

  const handleReload = async () => {
    try {
      const path = await Dialogs.OpenFile({
        CanChooseDirectories: false,
        CanChooseFiles: true,
        Title: '选择 orders.yaml 配置文件',
        Filters: [{ DisplayName: 'YAML 配置文件', Pattern: '*.yaml;*.yml' }],
      });
      if (!path || typeof path !== 'string') return;
      const dirPath = path.replace(/[/\\][^/\\]+$/, '');
      await OrderService.SetConfigPath(dirPath);
      const list = await OrderService.LoadOrders();
      setOrders(list || []);
      setSelectedOrder(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    await OrderService.DeleteOrder(selectedOrder);
    setOrders((prev) => prev.filter((o) => o["order_number"] !== selectedOrder));
    setSelectedOrder(null);
  };

  const handleComplete = async () => {
    if (!selectedOrder) return;
    await OrderService.MarkCompleted(selectedOrder);
    setOrders((prev) =>
      prev.map((o) => {
        if (o["order_number"] !== selectedOrder) return o;
        const c = clone(o);
        c["completed"] = true;
        return c;
      })
    );
    setSelectedOrder(null);
  };

  const handleRestore = async () => {
    if (!selectedOrder) return;
    await OrderService.UnmarkCompleted(selectedOrder);
    setOrders((prev) =>
      prev.map((o) => {
        if (o["order_number"] !== selectedOrder) return o;
        const c = clone(o);
        c["completed"] = false;
        return c;
      })
    );
    setSelectedOrder(null);
  };

  const toggleSort = () => {
    const next = sortDir === 'asc' ? 'desc' : 'asc';
    setSortDir(next);
    OrderService.SaveSortDir(next);
  };

  const sortedOrders = [...orders]
    .filter((o) => o["completed"] === showCompleted)
    .sort((a, b) => {
      const aPin = a["pinned"];
      const bPin = b["pinned"];
      if (aPin && !bPin) return -1;
      if (!aPin && bPin) return 1;
      const cmp = a["order_number"].localeCompare(b["order_number"]);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const searchTerms = inputValue
    .split(/[,，]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '');

  const filteredOrders =
    searchTerms.length === 0
      ? sortedOrders
      : sortedOrders.filter((o) => {
          const text =
            o["order_number"].toLowerCase() +
            ' ' +
            o["ordering_date"] +
            ' ' +
            o["shipping_date"] +
            ' ' +
            o["documents_date"] +
            ' ' +
            o["telex_rel_date"] +
            ' ' +
            o["remarks"].toLowerCase();
          return searchTerms.some((t) => text.includes(t));
        });

  const saveWidths = useCallback((w: Record<ColKey, number>) => {
    OrderService.SaveColumnWidths(JSON.stringify(w));
  }, []);

  const handleResizeStart = (col: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { col, startX: e.clientX, startWidths: { ...colWidths } };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const r = resizing.current;
      if (!r || !tableRef.current) return;
      const tableWidth = tableRef.current.getBoundingClientRect().width;
      const deltaPct = ((e.clientX - r.startX) / tableWidth) * 100;
      const colIdx = COL_KEYS.indexOf(r.col);
      const nextCol = colIdx < COL_KEYS.length - 1 ? COL_KEYS[colIdx + 1] : null;
      const newWidths = { ...r.startWidths };
      const clamped = Math.max(5, r.startWidths[r.col] + deltaPct);
      const actualDelta = clamped - r.startWidths[r.col];
      newWidths[r.col] = clamped;
      if (nextCol) {
        newWidths[nextCol] = Math.max(5, r.startWidths[nextCol] - actualDelta);
      }
      setColWidths(newWidths);
    };
    const handleMouseUp = () => {
      if (resizing.current) {
        resizing.current = null;
        saveWidths({ ...colWidths });
        // re-read latest state via closure issue, so save what's in state now
        setTimeout(() => {
          const el = tableRef.current;
          if (!el) return;
          // Use a functional update to get latest
          setColWidths((latest) => {
            saveWidths(latest);
            return latest;
          });
        }, 0);
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [colWidths, saveWidths]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const clone = (o: Order): Order => {
    return new Order({
      order_number: o["order_number"],
      ordering: o["ordering"],
      ordering_date: o["ordering_date"],
      shipping_date: o["shipping_date"],
      documents: o["documents"],
      documents_date: o["documents_date"],
      telex_release: o["telex_release"],
      telex_rel_date: o["telex_rel_date"],
      remarks: o["remarks"],
      completed: o["completed"],
      pinned: o["pinned"],
    });
  };

  const updateOrder = (updated: Order) => {
    const newOrders = orders.map((o) =>
      o["order_number"] === updated["order_number"] ? updated : o
    );
    setOrders(newOrders);
    OrderService.UpdateOrder(updated);
  };

  const handleOrderingToggle = (order: Order) => {
    const o = clone(order);
    o["ordering"] = !o["ordering"];
    o["ordering_date"] = o["ordering"] ? todayDate : '';
    updateOrder(o);
  };

  const handleOrderingDateChange = (order: Order, val: string) => {
    const o = clone(order);
    o["ordering_date"] = val;
    updateOrder(o);
  };

  const handleShippingDateChange = (order: Order, val: string) => {
    const o = clone(order);
    o["shipping_date"] = val;
    updateOrder(o);
  };

  const handleDocumentsToggle = (order: Order) => {
    const o = clone(order);
    o["documents"] = !o["documents"];
    o["documents_date"] = o["documents"] ? todayDate : '';
    updateOrder(o);
  };

  const handleDocumentsDateChange = (order: Order, val: string) => {
    const o = clone(order);
    o["documents_date"] = val;
    updateOrder(o);
  };

  const handleTelexToggle = (order: Order) => {
    const o = clone(order);
    o["telex_release"] = !o["telex_release"];
    o["telex_rel_date"] = o["telex_release"] ? todayDate : '';
    updateOrder(o);
  };

  const handleTelexDateChange = (order: Order, val: string) => {
    const o = clone(order);
    o["telex_rel_date"] = val;
    updateOrder(o);
  };

  const handleRemarksChange = (order: Order, val: string) => {
    const o = clone(order);
    o["remarks"] = val;
    updateOrder(o);
  };

  const handleOrderNumberChange = (order: Order, val: string) => {
    const trimmed = val.trim();
    if (!trimmed || trimmed === order["order_number"]) return;
    const exists = orders.some((o) => o["order_number"] === trimmed);
    if (exists) {
      alert('订单"' + trimmed + '"已存在');
      return;
    }
    const oldNo = order["order_number"];
    OrderService.RenameOrder(oldNo, trimmed);
    const o = clone(order);
    o["order_number"] = trimmed;
    const newOrders = orders.map((x) =>
      x["order_number"] === oldNo ? o : x
    );
    setOrders(newOrders);
    if (selectedOrder === oldNo) {
      setSelectedOrder(trimmed);
    }
  };

  return (
    <div className="main-view">
      <div className="toolbar">
        <div className="input-wrap">
          <input
            className="input order-input"
            type="text"
            placeholder="~"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          {inputValue && (
            <button className="input-clear" onClick={() => setInputValue('')} tabIndex={-1}>
              &times;
            </button>
          )}
        </div>
        <button className="btn" onClick={handleAdd}>
          添加
        </button>
        <button
          className={'btn' + (selectedOrder ? ' btn-delete-active' : '')}
          onClick={handleDelete}
          disabled={!selectedOrder}
        >
          删除
        </button>
        <button
          className={'btn' + (selectedOrder ? ' btn-action-active' : '')}
          onClick={showCompleted ? handleRestore : handleComplete}
          disabled={!selectedOrder}
        >
          {showCompleted ? '恢复订单' : '订单结束'}
        </button>
        <button className="btn btn-reload" onClick={handleReload}>
          加载配置
        </button>
        <button className="btn btn-action" onClick={() => setShowCompleted((v) => !v)}>
          {showCompleted ? '未结束订单' : '已结束订单'}
        </button>
      </div>

      <div className="table-wrapper">
        <table className="order-table" ref={tableRef}>
          <thead>
            <tr>
              <th className="col-no sortable" style={{ width: colWidths.no + '%' }} onClick={toggleSort}>
                订单号 {sortDir === 'asc' ? '▲' : '▼'}
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart('no', e)} />
              </th>
              <th className="col-ordering" style={{ width: colWidths.ordering + '%' }}>
                订货
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart('ordering', e)} />
              </th>
              <th className="col-ship" style={{ width: colWidths.ship + '%' }}>
                船期
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart('ship', e)} />
              </th>
              <th className="col-docs" style={{ width: colWidths.docs + '%' }}>
                单据
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart('docs', e)} />
              </th>
              <th className="col-telex" style={{ width: colWidths.telex + '%' }}>
                放单
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart('telex', e)} />
              </th>
              <th className="col-remarks" style={{ width: colWidths.remarks + '%' }}>
                备注
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart('remarks', e)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-msg">
                  暂无订单，请在上方输入订单号并点击"添加"
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-msg">
                  未找到匹配的订单
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order["order_number"]}
                  className={
                    (order["order_number"] === selectedOrder ? 'row-selected' : '') +
                    (order["pinned"] ? ' row-pinned' : '')
                  }
                  onClick={() =>
                    setSelectedOrder(
                      order["order_number"] === selectedOrder
                        ? null
                        : order["order_number"]
                    )
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      orderNumber: order["order_number"],
                      isPinned: order["pinned"],
                    });
                  }}
                >
                  <td className="col-no">
                    <input
                      type="text"
                      className="input order-no-input"
                      defaultValue={order["order_number"]}
                      onBlur={(e) => handleOrderNumberChange(order, e.target.value)}
                      autoComplete="off"
                    />
                  </td>
                  <td className="col-ordering">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={order["ordering"]}
                        onChange={() => handleOrderingToggle(order)}
                      />
                    </label>
                    {order["ordering"] && (
                      <input
                        type="date"
                        className="input date-input"
                        value={order["ordering_date"]}
                        onChange={(e) =>
                          handleOrderingDateChange(order, e.target.value)
                        }
                      />
                    )}
                  </td>
                  <td className="col-ship">
                    <input
                      type="date"
                      className="input date-input"
                      value={order["shipping_date"]}
                      onChange={(e) =>
                        handleShippingDateChange(order, e.target.value)
                      }
                    />
                  </td>
                  <td className="col-docs">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={order["documents"]}
                        onChange={() => handleDocumentsToggle(order)}
                      />
                    </label>
                    {order["documents"] && (
                      <input
                        type="date"
                        className="input date-input"
                        value={order["documents_date"]}
                        onChange={(e) =>
                          handleDocumentsDateChange(order, e.target.value)
                        }
                      />
                    )}
                  </td>
                  <td className="col-telex">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={order["telex_release"]}
                        onChange={() => handleTelexToggle(order)}
                      />
                    </label>
                    {order["telex_release"] && (
                      <input
                        type="date"
                        className="input date-input"
                        value={order["telex_rel_date"]}
                        onChange={(e) =>
                          handleTelexDateChange(order, e.target.value)
                        }
                      />
                    )}
                  </td>
                  <td className="col-remarks">
                    <input
                      type="text"
                      className="input remarks-input"
                      value={order["remarks"]}
                      onChange={(e) =>
                        handleRemarksChange(order, e.target.value)
                      }
                      autoComplete="off"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              const pinned = !contextMenu.isPinned;
              setOrders((prev) =>
                prev.map((o) => {
                  if (o["order_number"] !== contextMenu.orderNumber) return o;
                  const c = clone(o);
                  c["pinned"] = pinned;
                  return c;
                })
              );
              const target = orders.find(
                (o) => o["order_number"] === contextMenu.orderNumber
              );
              if (target) {
                const c = clone(target);
                c["pinned"] = pinned;
                OrderService.UpdateOrder(c);
              }
              setContextMenu(null);
            }}
          >
            {contextMenu.isPinned ? '取消置顶' : '置顶'}
          </div>
        </div>
      )}
    </div>
  );
}

export default MainView;
