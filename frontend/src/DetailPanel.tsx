import { useState, useEffect, useRef, useCallback } from 'react';
import { OrderService, DetailRow } from '../bindings/changeme';

const DETAIL_HEADERS = [
  '日期', '汇率', '执行汇率', '国家', '客户', '产品', '退税率', '工厂',
  '工厂价格', '包装', '柜型', '数量', '起运港', '目的港', '杂费RMB',
  '海运费USD', '利润率%', 'FOB价格', 'CFR价格', 'CIF价格', '利润',
];

const DETAIL_KEYS = [
  'date', 'exchange_rate', 'exec_rate', 'country', 'customer', 'product',
  'rebate_rate', 'factory', 'factory_price', 'packaging', 'container_type',
  'quantity', 'port_of_loading', 'port_of_destination', 'misc_fee_rmb',
  'freight_usd', 'profit_rate', 'fob_price', 'cfr_price', 'cif_price', 'profit',
] as const;

const DEFAULT_DETAIL_WIDTHS: Record<string, number> = {};
DETAIL_KEYS.forEach((k) => (DEFAULT_DETAIL_WIDTHS[k] = 100));

interface Props {
  orderNumber: string;
  details: DetailRow[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function DetailPanel({ orderNumber, details, onClose, onRefresh }: Props) {
  const [localDetails, setLocalDetails] = useState<DetailRow[]>(details);
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_DETAIL_WIDTHS);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; idx: number } | null>(null);
  const [focusedRowIdx, setFocusedRowIdx] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizing = useRef<{ col: string; startX: number; startWidths: Record<string, number> } | null>(null);

  const prevLenRef = useRef(details.length);
  useEffect(() => {
    if (details.length !== prevLenRef.current) {
      setLocalDetails(details);
      prevLenRef.current = details.length;
    }
  }, [details]);

  useEffect(() => {
    OrderService.GetDetailColWidths().then((w) => {
      if (w) {
        try {
          setColWidths((prev) => ({ ...prev, ...JSON.parse(w) }));
        } catch {}
      }
    });
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const saveWidths = useCallback((w: Record<string, number>) => {
    OrderService.SaveDetailColWidths(JSON.stringify(w));
  }, []);

  const handleResizeStart = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { col, startX: e.clientX, startWidths: { ...colWidths } };
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => {
      const r = resizing.current;
      if (!r || !tableRef.current) return;
      const tw = tableRef.current.getBoundingClientRect().width;
      const dp = ((e.clientX - r.startX) / tw) * 100;
      const idx = DETAIL_KEYS.indexOf(r.col as any);
      const nk = idx < DETAIL_KEYS.length - 1 ? DETAIL_KEYS[idx + 1] : null;
      const nw = { ...r.startWidths };
      const c = Math.max(40, r.startWidths[r.col] + dp * 100);
      const ad = c - r.startWidths[r.col];
      nw[r.col] = c;
      if (nk) nw[nk] = Math.max(40, r.startWidths[nk] - ad);
      setColWidths(nw);
    };
    const mu = () => {
      if (resizing.current) {
        resizing.current = null;
        setColWidths((latest) => {
          saveWidths(latest);
          return latest;
        });
      }
    };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
    };
  }, [colWidths, saveWidths]);

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cells = text.split(/\t|\n/).map((s) => s.trim()).filter((s) => s !== '');
      if (cells.length === 0) return;
      const row = cells.slice(0, 21);
      await OrderService.AddDetail(orderNumber, row);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (idx: number) => {
    await OrderService.DeleteDetail(orderNumber, idx);
    setContextMenu(null);
    onRefresh();
  };

  const handleDuplicate = async (idx: number) => {
    await OrderService.DuplicateDetail(orderNumber, idx);
    setContextMenu(null);
    onRefresh();
  };

  const handleCellChange = (idx: number, key: string, val: string) => {
    setLocalDetails((prev) => {
      const next = [...prev];
      const row = { ...(next[idx] as any) };
      row[key] = val;
      next[idx] = row as DetailRow;
      return next;
    });
    const updated = { ...(localDetails[idx] as any) };
    updated[key] = val;
    OrderService.UpdateDetailRow(orderNumber, idx, updated).then(() => {
      onRefresh();
    });
  };

  const safeNum = (v: string): number => parseFloat(v) || 0;
  const ceilInt = (v: number): number => Math.ceil(v);

  const calcQuote = (rebateRateOverride?: number) => {
    if (focusedRowIdx === null) return;
    setLocalDetails((prev) => {
      const next = [...prev];
      const r = { ...(next[focusedRowIdx] as any) };
      const factoryPrice = safeNum(r['factory_price']);
      const rebateRate = rebateRateOverride ?? safeNum(r['rebate_rate']);
      const execRate = safeNum(r['exec_rate']);
      const miscFee = safeNum(r['misc_fee_rmb']);
      const quantity = safeNum(r['quantity']);
      const profitRate = safeNum(r['profit_rate']);
      const freight = safeNum(r['freight_usd']);

      if (!quantity || !execRate) return prev;

      const freightPerUnit = freight / quantity;
      const profitFactor = 1 + profitRate / 100;
      const baseCost = factoryPrice / (1 + rebateRate) / execRate + miscFee / execRate / quantity;
      const fob = ceilInt(baseCost * profitFactor);
      const cfr = ceilInt(fob + freightPerUnit);
      const cif = ceilInt(cfr + cfr * 1.1 * 0.0005 / quantity);
      const profit = ceilInt(baseCost * (profitRate / 100));

      r['fob_price'] = String(fob);
      r['cfr_price'] = String(cfr);
      r['cif_price'] = String(cif);
      r['profit'] = String(profit);
      next[focusedRowIdx] = r as DetailRow;
      OrderService.UpdateDetailRow(orderNumber, focusedRowIdx, r).then(() => onRefresh());
      return next;
    });
  };

  const handleNormalQuote = () => calcQuote();
  const handleZeroRebate = () => calcQuote(0);
  const handleDollarQuote = () => {
    if (focusedRowIdx === null) return;
    setLocalDetails((prev) => {
      const next = [...prev];
      const r = { ...(next[focusedRowIdx] as any) };
      const factoryPrice = safeNum(r['factory_price']);
      const execRate = safeNum(r['exec_rate']);
      const miscFee = safeNum(r['misc_fee_rmb']);
      const quantity = safeNum(r['quantity']);
      const profitRate = safeNum(r['profit_rate']);
      const freight = safeNum(r['freight_usd']);

      if (!quantity || !execRate) return prev;

      const freightPerUnit = freight / quantity;
      const profitFactor = 1 + profitRate / 100;
      const baseCost = factoryPrice + miscFee / execRate / quantity;
      const fob = ceilInt(baseCost * profitFactor);
      const cfr = ceilInt(fob + freightPerUnit);
      const cif = ceilInt(cfr + cfr * 1.1 * 0.0005 / quantity);
      const profit = ceilInt(baseCost * (profitRate / 100));

      r['fob_price'] = String(fob);
      r['cfr_price'] = String(cfr);
      r['cif_price'] = String(cif);
      r['profit'] = String(profit);
      next[focusedRowIdx] = r as DetailRow;
      OrderService.UpdateDetailRow(orderNumber, focusedRowIdx, r).then(() => onRefresh());
      return next;
    });
  };

  const handleRMBQuote = () => {
    if (focusedRowIdx === null) return;
    setLocalDetails((prev) => {
      const next = [...prev];
      const r = { ...(next[focusedRowIdx] as any) };
      const factoryPrice = safeNum(r['factory_price']);
      const rebateRate = safeNum(r['rebate_rate']);
      const execRate = safeNum(r['exec_rate']);
      const miscFee = safeNum(r['misc_fee_rmb']);
      const quantity = safeNum(r['quantity']);
      const profitRate = safeNum(r['profit_rate']);
      const freight = safeNum(r['freight_usd']);

      if (!quantity) return prev;

      const freightRMB = freight * execRate / quantity;
      const profitFactor = 1 + profitRate / 100;
      const baseCost = factoryPrice / (1 + rebateRate) + miscFee / quantity;
      const fob = ceilInt(baseCost * profitFactor);
      const cfr = ceilInt(fob + freightRMB);
      const cif = ceilInt(cfr + cfr * 1.1 * 0.0005 / quantity);
      const profit = ceilInt(baseCost * (profitRate / 100));

      r['fob_price'] = String(fob);
      r['cfr_price'] = String(cfr);
      r['cif_price'] = String(cif);
      r['profit'] = String(profit);
      next[focusedRowIdx] = r as DetailRow;
    OrderService.UpdateDetailRow(orderNumber, focusedRowIdx, r).then(() => onRefresh());
      return next;
    });
  };

  const getCell = (row: DetailRow, key: string): string => {
    return (row as any)[key] || '';
  };

  const hasCopied = localDetails.some((r) => (r as any)['copied']);

  return (
    <div className="detail-panel">
      <div className="detail-toolbar">
        <button className="btn-icon" onClick={handleImport} title="导入剪切板">📥</button>
        <button className="btn-icon" onClick={onClose} title="取消">✕</button>
      </div>
      {localDetails.length > 0 && (
        <div className="detail-table-wrap">
          <table className="detail-table" ref={tableRef}>
            <thead>
              <tr>
                {DETAIL_HEADERS.map((h, i) => (
                  <th key={i} style={{ width: (colWidths[DETAIL_KEYS[i]] || 100) + 'px' }}>
                    {h}
                    <div className="resize-handle" onMouseDown={(e) => handleResizeStart(DETAIL_KEYS[i], e)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
                  {localDetails.map((row, idx) => (
                <tr
                  key={idx}
                  className={
                    (row as any)['copied'] ? 'detail-row-copied' : 'detail-row-imported'
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, idx });
                  }}
                >
                  {DETAIL_KEYS.map((k, ci) => {
                    const val = getCell(row, k);
                    const isCopied = (row as any)['copied'];
                    return (
                      <td key={ci}>
                        {isCopied ? (
                          <input
                            className="detail-cell-input"
                            value={val}
                            onFocus={() => setFocusedRowIdx(idx)}
                            onChange={(e) => handleCellChange(idx, k, e.target.value)}
                          />
                        ) : (
                          <span className="detail-cell-text">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasCopied && (
        <div className="detail-actions">
          <button className="btn btn-action" onClick={handleNormalQuote}>正常报价</button>
          <button className="btn btn-action" onClick={handleZeroRebate}>0退税</button>
          <button className="btn btn-action" onClick={handleDollarQuote}>美元报价</button>
          <button className="btn btn-action" onClick={handleRMBQuote}>人民币报价</button>
        </div>
      )}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-menu-item" onClick={() => handleDuplicate(contextMenu.idx)}>
            复制
          </div>
          <div className="context-menu-item" onClick={() => handleDelete(contextMenu.idx)}>
            删除此行
          </div>
        </div>
      )}
    </div>
  );
}
