import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo, useState } from 'react';

type NodeType = 'source' | 'filter' | 'join' | 'formula' | 'aggregate' | 'pivot' | 'union' | 'output';
interface PipelineNodeData { type: NodeType; label: string; config?: any; [key: string]: any; }

const PALETTE: Record<string, { bg: string; border: string; badge: string; accent: string; icon: string }> = {
  source:    { bg: '#eff6ff', border: '#bfdbfe', badge: '#1d4ed8', accent: '#3b82f6', icon: '⬡' },
  filter:    { bg: '#fefce8', border: '#fde68a', badge: '#b45309', accent: '#f59e0b', icon: '⊘' },
  join:      { bg: '#faf5ff', border: '#ddd6fe', badge: '#6d28d9', accent: '#8b5cf6', icon: '⋈' },
  formula:   { bg: '#f0fdf4', border: '#bbf7d0', badge: '#15803d', accent: '#22c55e', icon: 'ƒ' },
  aggregate: { bg: '#fff7ed', border: '#fed7aa', badge: '#c2410c', accent: '#f97316', icon: 'Σ' },
  pivot:     { bg: '#fdf2f8', border: '#f5d0fe', badge: '#a21caf', accent: '#d946ef', icon: '⊞' },
  union:     { bg: '#f0f9ff', border: '#bae6fd', badge: '#0369a1', accent: '#0ea5e9', icon: '∪' },
  output:    { bg: '#fff1f2', border: '#fecdd3', badge: '#be123c', accent: '#f43f5e', icon: '◎' },
};

const TYPE_LABELS: Record<string, string> = {
  source: 'DATA SOURCE', filter: 'FILTER', join: 'JOIN', formula: 'CALCULATED',
  aggregate: 'ROLL-UP', pivot: 'PIVOT', union: 'STACK', output: 'OUTPUT',
};

const Label = ({ children }: { children: any }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, marginTop: 12 }}>{children}</div>
);

const Input = ({ placeholder, value, onChange, type = 'text' }: any) => (
  <input
    type={type} placeholder={placeholder} value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1.5px solid #e2e8f0', borderRadius: 7, outline: 'none', background: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}
    onFocus={e => (e.target.style.borderColor = '#6366f1')}
    onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
  />
);

const Select = ({ options, value, onChange, placeholder }: any) => (
  <select value={value ?? ''} onChange={e => onChange(e.target.value)}
    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1.5px solid #e2e8f0', borderRadius: 7, outline: 'none', background: '#f8fafc', color: value ? '#1e293b' : '#94a3b8', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
    {placeholder && <option value="" disabled>{placeholder}</option>}
    {options.map((o: any) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
);

const Pill = ({ label, onRemove, color = '#6366f1' }: any) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', background: color + '18', border: `1px solid ${color}40`, borderRadius: 20, fontSize: 11, color, fontWeight: 600, margin: '2px' }}>
    {label}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
  </span>
);

const AddButton = ({ onClick, label }: any) => (
  <button onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#f1f5f9', border: '1.5px dashed #cbd5e1', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#64748b', cursor: 'pointer', width: '100%', marginTop: 6 }}
    onMouseEnter={e => { (e.currentTarget.style.borderColor = '#6366f1'); (e.currentTarget.style.color = '#6366f1'); }}
    onMouseLeave={e => { (e.currentTarget.style.borderColor = '#cbd5e1'); (e.currentTarget.style.color = '#64748b'); }}>
    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {label}
  </button>
);

const Divider = () => <div style={{ height: 1, background: '#f1f5f9', margin: '16px 0' }} />;

const InfoBox = ({ children }: any) => (
  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#64748b', lineHeight: 1.6, marginTop: 8 }}>{children}</div>
);

const Toggle = ({ value, onChange, label }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
    <span style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>{label}</span>
    <div onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', background: value ? '#6366f1' : '#cbd5e1', position: 'relative', transition: 'background 0.2s' }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: 'white', position: 'absolute', top: 3, left: value ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  </div>
);

// ─── Source Panel ─────────────────────────────────────────────────────────────
function SourcePanel({ config, onChange }: any) {
  const c = config || {};
  return (
    <>
      <InfoBox>Pull in any table, report, or price list as the starting point. Choose what data to bring in and which columns are needed downstream.</InfoBox>
      <Label>Data source type</Label>
      <Select
        value={c.entityType}
        onChange={(v: string) => onChange({ ...c, entityType: v })}
        placeholder="Select source type..."
        options={[
          { value: 'datasets', label: 'Dataset (transaction data, master data)' },
          { value: 'views', label: 'Saved View (another pipeline output)' },
          { value: 'pricelists', label: 'Price List' },
        ]}
      />
      <Label>Source name</Label>
      <Input placeholder="e.g. Invoice Line Items 2024" value={c.entityName} onChange={(v: string) => onChange({ ...c, entityName: v })} />
      {c.entityType === 'pricelists' && (
        <>
          <Label>Price list version</Label>
          <Toggle value={!c.pinVersion} onChange={(v: boolean) => onChange({ ...c, pinVersion: !v })} label="Always use latest version" />
          {c.pinVersion && <Input placeholder="Version number, e.g. 12" value={c.version} onChange={(v: string) => onChange({ ...c, version: v })} type="number" />}
        </>
      )}
      <Divider />
      <Label>Columns to include</Label>
      <InfoBox>Leave blank to bring in all columns. Selecting specific columns reduces noise for downstream steps.</InfoBox>
      <div style={{ marginTop: 8 }}>
        {(c.selectedColumns || []).map((col: string, i: number) => (
          <Pill key={i} label={col} color="#3b82f6" onRemove={() => {
            const next = [...(c.selectedColumns || [])]; next.splice(i, 1); onChange({ ...c, selectedColumns: next });
          }} />
        ))}
      </div>
      <input placeholder="Type column name and press Enter"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '7px 10px', fontSize: 11, border: '1.5px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}
        onKeyDown={(e: any) => { if (e.key === 'Enter' && e.target.value.trim()) { onChange({ ...c, selectedColumns: [...(c.selectedColumns || []), e.target.value.trim()] }); e.target.value = ''; } }}
      />
    </>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
function FilterPanel({ config, onChange }: any) {
  const c = config || { operator: 'AND', conditions: [] };
  const conditions = c.conditions || [];
  const OPERATORS = [
    { value: '==', label: 'equals' }, { value: '!=', label: 'does not equal' },
    { value: '>', label: 'is greater than' }, { value: '<', label: 'is less than' },
    { value: '>=', label: 'is at least' }, { value: '<=', label: 'is at most' },
    { value: 'in', label: 'is one of' }, { value: 'not_in', label: 'is not one of' },
    { value: 'contains', label: 'contains' }, { value: 'does_not_contain', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' }, { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is blank' }, { value: 'is_non_empty', label: 'is not blank' },
    { value: 'between', label: 'is between' },
  ];
  const updateCondition = (i: number, key: string, val: any) => {
    onChange({ ...c, conditions: conditions.map((cond: any, idx: number) => idx === i ? { ...cond, [key]: val } : cond) });
  };
  return (
    <>
      <InfoBox>Keep only the rows that meet your criteria. All other rows are dropped before any calculations run.</InfoBox>
      {conditions.length > 1 && (
        <>
          <Label>How conditions are combined</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['AND', 'OR'].map(op => (
              <button key={op} onClick={() => onChange({ ...c, operator: op })} style={{ flex: 1, padding: '8px', fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: 'pointer', background: c.operator === op ? '#6366f1' : '#f1f5f9', color: c.operator === op ? 'white' : '#64748b', border: `1.5px solid ${c.operator === op ? '#6366f1' : '#e2e8f0'}` }}>
                {op === 'AND' ? 'ALL must match' : 'ANY one matches'}
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ marginTop: 12 }}>
        {conditions.map((cond: any, i: number) => (
          <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '12px', marginBottom: 8, position: 'relative' }}>
            {conditions.length > 1 && i > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>{c.operator}</div>}
            <button onClick={() => onChange({ ...c, conditions: conditions.filter((_: any, idx: number) => idx !== i) })}
              style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8' }}>×</button>
            <Label>Field to test</Label>
            <Input placeholder="e.g. Transaction Type" value={cond.fieldId} onChange={(v: string) => updateCondition(i, 'fieldId', v)} />
            <Label>Condition</Label>
            <Select value={cond.operator} onChange={(v: string) => updateCondition(i, 'operator', v)} options={OPERATORS} placeholder="Choose condition..." />
            {!['is_empty', 'is_non_empty'].includes(cond.operator) && (
              <>
                <Label>{cond.operator === 'in' || cond.operator === 'not_in' ? 'Values (comma-separated)' : cond.operator === 'between' ? 'From value' : 'Value'}</Label>
                <Input placeholder={cond.operator === 'in' ? 'e.g. VOID, CREDIT, TEST' : 'e.g. 0'} value={cond.value} onChange={(v: string) => updateCondition(i, 'value', v)} />
                {cond.operator === 'between' && (
                  <><Label>To value</Label><Input placeholder="Upper bound" value={cond.valueTo} onChange={(v: string) => updateCondition(i, 'valueTo', v)} /></>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <AddButton onClick={() => onChange({ ...c, conditions: [...conditions, { fieldId: '', operator: '==', value: '' }] })} label="Add condition" />
    </>
  );
}

// ─── Join Panel ───────────────────────────────────────────────────────────────
function JoinPanel({ config, onChange }: any) {
  const c = config || { joinType: 'left', predicates: [] };
  const predicates = c.predicates || [];
  const JOIN_TYPES = [
    { value: 'left', label: 'Left Join', desc: 'Keep all rows from the primary table. Adds columns from the lookup; unmatched rows show blanks.' },
    { value: 'inner', label: 'Inner Join', desc: 'Only rows with a match in both tables are kept. Unmatched rows are dropped.' },
    { value: 'full', label: 'Full Join', desc: 'Keep all rows from both tables. Blanks where there is no match on either side.' },
  ];
  const updatePredicate = (i: number, key: string, val: string) => {
    onChange({ ...c, predicates: predicates.map((p: any, idx: number) => idx === i ? { ...p, [key]: val } : p) });
  };
  return (
    <>
      <InfoBox>Merge two tables side-by-side on a shared key. Connect the primary table to the left handle, and the lookup table to the right handle.</InfoBox>
      <Label>Join behaviour</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        {JOIN_TYPES.map(jt => (
          <div key={jt.value} onClick={() => onChange({ ...c, joinType: jt.value })} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${c.joinType === jt.value ? '#8b5cf6' : '#e2e8f0'}`, background: c.joinType === jt.value ? '#faf5ff' : '#f8fafc' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: c.joinType === jt.value ? '#6d28d9' : '#334155' }}>{jt.label}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>{jt.desc}</div>
          </div>
        ))}
      </div>
      <Divider />
      <Label>Match rows on</Label>
      <InfoBox>Define which columns link the two tables together. Multiple conditions are all required (AND).</InfoBox>
      {predicates.map((pred: any, i: number) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 4, alignItems: 'center', marginTop: 8 }}>
          <Input placeholder="Left column" value={pred.leftColumn} onChange={(v: string) => updatePredicate(i, 'leftColumn', v)} />
          <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700, padding: '0 2px' }}>=</span>
          <Input placeholder="Right column" value={pred.rightColumn} onChange={(v: string) => updatePredicate(i, 'rightColumn', v)} />
          <button onClick={() => onChange({ ...c, predicates: predicates.filter((_: any, idx: number) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
        </div>
      ))}
      <AddButton onClick={() => onChange({ ...c, predicates: [...predicates, { leftColumn: '', operator: '==', rightColumn: '' }] })} label="Add match condition" />
      <Divider />
      <InfoBox>If both tables share a column name, the right table column is automatically prefixed with <strong>right_</strong> to avoid conflicts.</InfoBox>
    </>
  );
}

// ─── Formula Panel ────────────────────────────────────────────────────────────
function FormulaPanel({ config, onChange }: any) {
  const c = config || { fields: [] };
  const fields = c.fields || [];
  const DATATYPES = [
    { value: 'number', label: '# Number' }, { value: 'money', label: '$ Currency' },
    { value: 'percentage', label: '% Percentage' }, { value: 'text', label: 'Aa Text' },
    { value: 'date', label: 'Date' }, { value: 'bool', label: 'True / False' },
  ];
  const updateField = (i: number, key: string, val: any) => {
    onChange({ ...c, fields: fields.map((f: any, idx: number) => idx === i ? { ...f, [key]: val } : f) });
  };
  return (
    <>
      <InfoBox>Add new calculated columns to every row. Reference any existing column using curly braces: {'{column_name}'}. Row count is unchanged.</InfoBox>
      {fields.map((field: any, i: number) => (
        <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>Column {i + 1}</span>
            <button onClick={() => onChange({ ...c, fields: fields.filter((_: any, idx: number) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}>Remove</button>
          </div>
          <Label>Column label</Label>
          <Input placeholder="e.g. Pocket Margin %" value={field.label} onChange={(v: string) => updateField(i, 'label', v)} />
          <Label>Formula</Label>
          <textarea
            placeholder="e.g. ({invoice_price} - {standard_cogs}) / {invoice_price}"
            value={field.formula || ''}
            onChange={e => updateField(i, 'formula', e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1.5px solid #e2e8f0', borderRadius: 7, resize: 'vertical', minHeight: 64, background: '#0f172a', color: '#86efac', fontFamily: 'monospace', lineHeight: 1.6, outline: 'none' }}
          />
          <Label>Result type</Label>
          <Select value={field.datatype?.type} onChange={(v: string) => updateField(i, 'datatype', { ...field.datatype, type: v })} options={DATATYPES} placeholder="Choose type..." />
          {field.datatype?.type === 'money' && (
            <>
              <Label>Currency</Label>
              <Select value={field.datatype?.properties?.currency} onChange={(v: string) => updateField(i, 'datatype', { ...field.datatype, properties: { currency: v } })} options={['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']} placeholder="Select currency..." />
            </>
          )}
        </div>
      ))}
      <AddButton onClick={() => onChange({ ...c, fields: [...fields, { name: '', label: '', formula: '', datatype: { type: 'number' } }] })} label="Add calculated column" />
    </>
  );
}

// ─── Aggregate Panel ──────────────────────────────────────────────────────────
function AggregatePanel({ config, onChange }: any) {
  const c = config || { groupBy: [], aggregations: [] };
  const aggs = c.aggregations || [];
  const AGG_FUNCTIONS = [
    { value: 'sum', label: 'Sum (total)' }, { value: 'avg', label: 'Average' },
    { value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' },
    { value: 'count', label: 'Count rows' }, { value: 'count_distinct', label: 'Count unique values' },
  ];
  const updateAgg = (i: number, key: string, val: any) => {
    onChange({ ...c, aggregations: aggs.map((a: any, idx: number) => idx === i ? { ...a, [key]: val } : a) });
  };
  return (
    <>
      <InfoBox>Collapse many rows into summary rows. Only your chosen dimensions and summary metrics appear in the output. All other columns are dropped.</InfoBox>
      <Label>Group by (dimensions)</Label>
      <InfoBox>One summary row is produced per unique combination of these columns.</InfoBox>
      <div style={{ marginTop: 6 }}>
        {(c.groupBy || []).map((col: string, i: number) => (
          <Pill key={i} label={col} color="#f97316" onRemove={() => {
            const next = [...(c.groupBy || [])]; next.splice(i, 1); onChange({ ...c, groupBy: next });
          }} />
        ))}
      </div>
      <input placeholder="Type column name and press Enter"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '7px 10px', fontSize: 11, border: '1.5px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}
        onKeyDown={(e: any) => { if (e.key === 'Enter' && e.target.value.trim()) { onChange({ ...c, groupBy: [...(c.groupBy || []), e.target.value.trim()] }); e.target.value = ''; } }}
      />
      <Divider />
      <Label>Summary metrics</Label>
      {aggs.map((agg: any, i: number) => (
        <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>Metric {i + 1}</span>
            <button onClick={() => onChange({ ...c, aggregations: aggs.filter((_: any, idx: number) => idx !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}>Remove</button>
          </div>
          <Label>Column to summarise</Label>
          <Input placeholder="e.g. invoice_price" value={agg.columnId} onChange={(v: string) => updateAgg(i, 'columnId', v)} />
          <Label>Calculation</Label>
          <Select value={agg.function} onChange={(v: string) => updateAgg(i, 'function', v)} options={AGG_FUNCTIONS} placeholder="Choose calculation..." />
          <Label>Output label</Label>
          <Input placeholder="e.g. Total Revenue" value={agg.label} onChange={(v: string) => updateAgg(i, 'label', v)} />
        </div>
      ))}
      <AddButton onClick={() => onChange({ ...c, aggregations: [...aggs, { function: 'sum', columnId: '', alias: '', label: '' }] })} label="Add summary metric" />
    </>
  );
}

// ─── Pivot Panel ──────────────────────────────────────────────────────────────
function PivotPanel({ config, onChange }: any) {
  const c = config || { rowGroupCols: [], aggFunction: 'sum', pivotValues: [] };
  return (
    <>
      <InfoBox>Rotate a category column into side-by-side column headers — e.g. turn Q1, Q2, Q3, Q4 rows into four columns for easy period comparison.</InfoBox>
      <Label>Row dimensions (kept as rows)</Label>
      <div style={{ marginTop: 4 }}>
        {(c.rowGroupCols || []).map((col: string, i: number) => (
          <Pill key={i} label={col} color="#d946ef" onRemove={() => {
            const next = [...(c.rowGroupCols || [])]; next.splice(i, 1); onChange({ ...c, rowGroupCols: next });
          }} />
        ))}
      </div>
      <input placeholder="Type dimension and press Enter"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '7px 10px', fontSize: 11, border: '1.5px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}
        onKeyDown={(e: any) => { if (e.key === 'Enter' && e.target.value.trim()) { onChange({ ...c, rowGroupCols: [...(c.rowGroupCols || []), e.target.value.trim()] }); e.target.value = ''; } }}
      />
      <Divider />
      <Label>Pivot column</Label>
      <InfoBox>The column whose unique values become the new column headers (e.g. "Quarter" becomes Q1, Q2, Q3, Q4).</InfoBox>
      <Input placeholder="e.g. Quarter" value={c.pivotCol} onChange={(v: string) => onChange({ ...c, pivotCol: v })} />
      <Label>Column headers to generate</Label>
      <InfoBox>List every value explicitly. Only these will appear as columns.</InfoBox>
      <div style={{ marginTop: 4 }}>
        {(c.pivotValues || []).map((val: string, i: number) => (
          <Pill key={i} label={val} color="#d946ef" onRemove={() => {
            const next = [...(c.pivotValues || [])]; next.splice(i, 1); onChange({ ...c, pivotValues: next });
          }} />
        ))}
      </div>
      <input placeholder="Type header value and press Enter, e.g. Q1 2024"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '7px 10px', fontSize: 11, border: '1.5px solid #e2e8f0', borderRadius: 7, background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}
        onKeyDown={(e: any) => { if (e.key === 'Enter' && e.target.value.trim()) { onChange({ ...c, pivotValues: [...(c.pivotValues || []), e.target.value.trim()] }); e.target.value = ''; } }}
      />
      <Divider />
      <Label>Value column</Label>
      <Input placeholder="e.g. pocket_margin_usd" value={c.valueCol} onChange={(v: string) => onChange({ ...c, valueCol: v })} />
      <Label>How to aggregate values</Label>
      <Select value={c.aggFunction} onChange={(v: string) => onChange({ ...c, aggFunction: v })}
        options={[{ value: 'sum', label: 'Sum (total)' }, { value: 'avg', label: 'Average' }, { value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' }, { value: 'count', label: 'Count rows' }]}
        placeholder="Choose aggregation..." />
    </>
  );
}

// ─── Union Panel ──────────────────────────────────────────────────────────────
function UnionPanel({ config, onChange }: any) {
  const c = config || { targetNodeIds: [] };
  return (
    <>
      <InfoBox>Stack two or more tables on top of each other, appending rows vertically. All columns from all tables are included; gaps are filled with blanks.</InfoBox>
      <Label>Tables to stack</Label>
      <InfoBox>Connect each source table to this node using the pipeline canvas.</InfoBox>
      {(c.targetNodeIds || []).length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 11, background: '#f8fafc', borderRadius: 8, border: '1.5px dashed #e2e8f0', marginTop: 8 }}>
          Connect tables to this node using the pipeline canvas to add them here.
        </div>
      ) : (
        (c.targetNodeIds || []).map((id: string, i: number) => (
          <Pill key={i} label={`Table: ${id}`} color="#0ea5e9" onRemove={() => {
            const next = [...(c.targetNodeIds || [])]; next.splice(i, 1); onChange({ ...c, targetNodeIds: next });
          }} />
        ))
      )}
      <Divider />
      <InfoBox><strong>Column alignment:</strong> Columns are matched by name. If a table is missing a column that others have, that column will be blank for those rows.</InfoBox>
    </>
  );
}

// ─── Output Panel ─────────────────────────────────────────────────────────────
function OutputPanel({ config, onChange }: any) {
  const c = config || {};
  return (
    <>
      <InfoBox>This is the final result set that powers your report or dashboard. All upstream steps feed into this single node. Only one output is allowed per pipeline.</InfoBox>
      <Label>Output label</Label>
      <Input placeholder="e.g. Pricing Analytics — Q4 2024" value={c.outputLabel} onChange={(v: string) => onChange({ ...c, outputLabel: v })} />
      <Divider />
      <InfoBox><strong>How to preview:</strong> Click any node on the canvas to inspect a live sample of rows at that stage. Save your pipeline first to see the latest results.</InfoBox>
      <InfoBox><strong>Execution note:</strong> The pipeline runs against the last saved state. Always save before running a preview to ensure your latest changes are reflected.</InfoBox>
    </>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────
function ConfigPanel({ node, onClose, onConfigChange }: { node: any; onClose: () => void; onConfigChange: (id: string, config: any) => void }) {
  const data: PipelineNodeData = node.data;
  const p = PALETTE[data.type] ?? PALETTE.source;
  const panels: Record<string, any> = {
    source: SourcePanel, filter: FilterPanel, join: JoinPanel,
    formula: FormulaPanel, aggregate: AggregatePanel, pivot: PivotPanel,
    union: UnionPanel, output: OutputPanel,
  };
  const PanelComp = panels[data.type] ?? SourcePanel;
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 360, background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.10)', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: p.badge, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'white' }}>{p.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>{TYPE_LABELS[data.type]}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.3 }}>{data.label}</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: 'white', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
        <PanelComp config={data.config} onChange={(cfg: any) => onConfigChange(node.id, cfg)} />
      </div>
      <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '9px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer', background: p.badge, color: 'white', border: 'none' }}>Save changes</button>
        <button onClick={onClose} style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer', background: '#f1f5f9', color: '#64748b', border: 'none' }}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Pipeline Node Component ──────────────────────────────────────────────────
function PipelineNodeComp({ data, selected }: { data: PipelineNodeData; selected?: boolean }) {
  const s = PALETTE[data.type] ?? PALETTE.source;
  return (
    <div style={{ background: s.bg, border: `1.5px solid ${selected ? s.badge : s.border}`, borderRadius: 10, minWidth: 170, fontFamily: 'Inter, sans-serif', boxShadow: selected ? `0 0 0 3px ${s.accent}30` : '0 1px 4px rgba(0,0,0,0.07)' }}>
      <Handle type="target" position={Position.Left} style={{ background: s.border, width: 8, height: 8 }} />
      <div style={{ background: s.badge, color: 'white', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '8px 8px 0 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span>{s.icon}</span><span>{TYPE_LABELS[data.type]}</span>
      </div>
      <div style={{ padding: '8px 12px 4px', fontWeight: 700, fontSize: 12, color: '#1e293b', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{data.label}</div>
      <div style={{ padding: '0 10px 8px' }}>
        <div style={{ fontSize: 9, color: s.accent, fontWeight: 600, background: s.accent + '18', padding: '2px 7px', borderRadius: 10, display: 'inline-block' }}>Click to configure</div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: s.border, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { pipeline: PipelineNodeComp };

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const nd = { sourcePosition: Position.Right, targetPosition: Position.Left };

  const initialNodes = useMemo(() => [
    { id: "src_invoices",    type: 'pipeline', ...nd, position: { x: 20,   y: 20  }, data: { type: 'source',    label: 'Invoice Line Items',                   config: { entityType: 'datasets', entityName: 'Invoices 2024' } } },
    { id: "src_customers",   type: 'pipeline', ...nd, position: { x: 20,   y: 150 }, data: { type: 'source',    label: 'Customer Master',                      config: { entityType: 'datasets' } } },
    { id: "src_products",    type: 'pipeline', ...nd, position: { x: 20,   y: 280 }, data: { type: 'source',    label: 'Product Catalogue',                    config: { entityType: 'datasets' } } },
    { id: "src_pricelist",   type: 'pipeline', ...nd, position: { x: 20,   y: 410 }, data: { type: 'source',    label: 'Approved Price List',                  config: { entityType: 'pricelists' } } },
    { id: "src_cost",        type: 'pipeline', ...nd, position: { x: 20,   y: 540 }, data: { type: 'source',    label: 'Standard Cost History',                config: { entityType: 'datasets' } } },
    { id: "flt_invoices",    type: 'pipeline', ...nd, position: { x: 280,  y: 20  }, data: { type: 'filter',    label: 'Exclude Voids,\nCredits & Tests',       config: { operator: 'AND', conditions: [{ fieldId: 'transaction_type', operator: 'not_in', value: 'VOID, CREDIT, TEST' }] } } },
    { id: "jn_inv_cust",     type: 'pipeline', ...nd, position: { x: 540,  y: 60  }, data: { type: 'join',      label: 'Add Customer\nSegment & Region',        config: { joinType: 'left', predicates: [{ leftColumn: 'customer_id', operator: '==', rightColumn: 'customer_id' }] } } },
    { id: "jn_inv_prod",     type: 'pipeline', ...nd, position: { x: 800,  y: 110 }, data: { type: 'join',      label: 'Add Product\nFamily & Category',        config: { joinType: 'left', predicates: [] } } },
    { id: "jn_listprice",    type: 'pipeline', ...nd, position: { x: 1060, y: 160 }, data: { type: 'join',      label: 'Add List Price\n& Contract Price',      config: { joinType: 'left', predicates: [] } } },
    { id: "jn_cost",         type: 'pipeline', ...nd, position: { x: 1320, y: 210 }, data: { type: 'join',      label: 'Add Standard\nCost of Goods',           config: { joinType: 'left', predicates: [] } } },
    { id: "fx_txn",          type: 'pipeline', ...nd, position: { x: 1580, y: 210 }, data: { type: 'formula',   label: 'Calculate Pocket Price,\nGross Margin & Leakage', config: { fields: [{ label: 'Pocket Price', formula: '{invoice_price} - {rebates} - {freight}', datatype: { type: 'money' } }] } } },
    { id: "agg_month",       type: 'pipeline', ...nd, position: { x: 1860, y: 110 }, data: { type: 'aggregate', label: 'Roll Up by Customer,\nProduct & Month', config: { groupBy: ['customer_id', 'product_family', 'invoice_month'], aggregations: [] } } },
    { id: "agg_segment",     type: 'pipeline', ...nd, position: { x: 1860, y: 360 }, data: { type: 'aggregate', label: 'Summarise by\nCustomer Segment',        config: { groupBy: ['customer_segment', 'quarter'], aggregations: [] } } },
    { id: "fx_dispersion",   type: 'pipeline', ...nd, position: { x: 2140, y: 110 }, data: { type: 'formula',   label: 'Price Realisation %\n& Dispersion Band', config: { fields: [] } } },
    { id: "pivot_waterfall", type: 'pipeline', ...nd, position: { x: 2140, y: 360 }, data: { type: 'pivot',     label: 'Quarterly Price\nWaterfall Bridge',     config: { rowGroupCols: ['product_family'], pivotCol: 'quarter', valueCol: 'pocket_margin_usd', aggFunction: 'sum', pivotValues: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'] } } },
    { id: "out_dashboard",   type: 'pipeline', ...nd, position: { x: 2420, y: 230 }, data: { type: 'output',    label: 'Pricing Analytics\nDashboard Output',   config: {} } },
  ], []);

  const initialEdges = useMemo(() => [
    { id: "e1",  source: "src_invoices",   target: "flt_invoices",    style: { stroke: '#93c5fd' } },
    { id: "e2",  source: "flt_invoices",   target: "jn_inv_cust",     style: { stroke: '#c4b5fd' } },
    { id: "e3",  source: "src_customers",  target: "jn_inv_cust",     style: { stroke: '#c4b5fd' } },
    { id: "e4",  source: "jn_inv_cust",    target: "jn_inv_prod",     style: { stroke: '#c4b5fd' } },
    { id: "e5",  source: "src_products",   target: "jn_inv_prod",     style: { stroke: '#c4b5fd' } },
    { id: "e6",  source: "jn_inv_prod",    target: "jn_listprice",    style: { stroke: '#c4b5fd' } },
    { id: "e7",  source: "src_pricelist",  target: "jn_listprice",    style: { stroke: '#c4b5fd' } },
    { id: "e8",  source: "jn_listprice",   target: "jn_cost",         style: { stroke: '#c4b5fd' } },
    { id: "e9",  source: "src_cost",       target: "jn_cost",         style: { stroke: '#c4b5fd' } },
    { id: "e10", source: "jn_cost",        target: "fx_txn",          style: { stroke: '#86efac' } },
    { id: "e11", source: "fx_txn",         target: "agg_month",       style: { stroke: '#fdba74' } },
    { id: "e12", source: "agg_month",      target: "fx_dispersion",   style: { stroke: '#86efac' } },
    { id: "e13", source: "fx_txn",         target: "agg_segment",     style: { stroke: '#fdba74' } },
    { id: "e14", source: "agg_segment",    target: "pivot_waterfall", style: { stroke: '#f9a8d4' } },
    { id: "e15", source: "fx_dispersion",  target: "out_dashboard",   style: { stroke: '#fca5a5', strokeWidth: 2 } },
    { id: "e16", source: "pivot_waterfall",target: "out_dashboard",   style: { stroke: '#fca5a5', strokeWidth: 2 } },
  ], []);

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback((c: any) => setNodes((n) => applyNodeChanges(c, n)), []);
  const onEdgesChange = useCallback((c: any) => setEdges((e) => applyEdgeChanges(c, e)), []);
  const onConnect = useCallback((p: any) => setEdges((e) => addEdge(p, e)), []);
  const onNodeClick = useCallback((_: any, node: any) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const handleConfigChange = useCallback((nodeId: string, config: any) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, config } } : n));
  }, []);

  const activeNode = selectedNode ? nodes.find(n => n.id === selectedNode.id) : null;

  return (
    <div style={{ width: '100vw', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} onPaneClick={onPaneClick} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.1 }}>
        <Controls />
        <MiniMap nodeColor={(n: any) => PALETTE[n.data?.type]?.bg ?? '#e2e8f0'} />
        <Background variant="dots" gap={12} size={1} color="#e2e8f0" />
      </ReactFlow>
      {activeNode && <ConfigPanel node={activeNode} onClose={() => setSelectedNode(null)} onConfigChange={handleConfigChange} />}
    </div>
  );
}